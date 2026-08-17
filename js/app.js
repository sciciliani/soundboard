(function () {
  "use strict";

  var STORAGE_KEY = "botonera-config-v2";
  var DEFAULTS_URL = "defaults.json";
  var COLORS = ["#db273c", "#ff8a3d", "#ffcc4d", "#4dd68a", "#3dbeff", "#7c5cff", "#ff5cb8", "#8d99a6"];
  var HAS_FS_ACCESS = typeof window.showOpenFilePicker === "function";

  // Keyboard rows, left to right, mapped in order to the buttons as they
  // appear on the board — so row 1 of the board gets 1234567890, row 2
  // gets qwertyuiop, and so on down the keyboard.
  var KEY_ROWS = ["1234567890", "qwertyuiop", "asdfghjkl", "zxcvbnm"];
  var KEY_SEQUENCE = KEY_ROWS.join("").split("");

  // Used only if defaults.json can't be fetched at all (e.g. opened via
  // file:// instead of a local server) so the app still has something to show.
  var FALLBACK_DEFAULTS = [
    { id: "fallback-fart", label: "PEDO", desc: "Sonido sintetizado integrado", synthType: "fart" },
    { id: "fallback-burp", label: "ERUCTO", desc: "Sonido sintetizado integrado", synthType: "burp" },
    { id: "fallback-boing", label: "RESORTE", desc: "Sonido sintetizado integrado", synthType: "boing" },
    { id: "fallback-honk", label: "BOCINAZO", desc: "Sonido sintetizado integrado", synthType: "honk" }
  ];

  var state = {
    buttons: [],
    defaultsList: [],
    editMode: false,
    editingId: null,
    editingLocalHandle: null, // staged FileSystemFileHandle picked during this edit
    editingLocalFile: null,   // staged File (fallback path) picked during this edit
    sessionLocalFiles: {},    // id -> File, in-memory only, never persisted (fallback browsers)
    activeSounds: {},         // id -> {kind:'audio', el, revoke} | {kind:'synth', handle} — currently playing, so repeat presses restart cleanly
    keyMap: {}                // key char -> button id, rebuilt on every render
  };

  var els = {};

  function $(id) { return document.getElementById(id); }

  function uid() {
    return "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { els.toast.classList.add("hidden"); }, 2200);
  }

  function vibrate(ms) {
    if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} }
  }

  // ---------- defaults.json ----------

  function fetchDefaults() {
    return fetch(DEFAULTS_URL, { cache: "no-store" })
      .then(function (res) { if (!res.ok) throw new Error("bad status"); return res.json(); })
      .then(function (data) {
        var list = (data && data.buttons) || [];
        state.defaultsList = list.length ? list : FALLBACK_DEFAULTS;
        return state.defaultsList;
      })
      .catch(function () {
        state.defaultsList = FALLBACK_DEFAULTS;
        toast("No se pudo cargar defaults.json (abrí el sitio con un servidor local, no con file://) — usando un set mínimo de respaldo");
        return state.defaultsList;
      });
  }

  function buttonFromDefaultEntry(entry, index) {
    return {
      id: uid(),
      defaultId: entry.id || null,
      label: entry.label || "BOTÓN",
      desc: entry.desc || "",
      color: entry.color || COLORS[index % COLORS.length],
      soundSource: entry.file ? "bundled" : "synth",
      bundledFile: entry.file || null,
      synthType: entry.synthType || "fart",
      localName: null,
      url: null
    };
  }

  // ---------- Config persistence ----------

  function loadSavedConfig() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (e) {}
    return null;
  }

  function saveConfig() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.buttons));
  }

  // ---------- Preloading ----------

  function preloadSounds() {
    var files = [];
    var seen = {};
    state.buttons.forEach(function (cfg) {
      if (cfg.soundSource === "bundled" && cfg.bundledFile && !seen[cfg.bundledFile]) {
        seen[cfg.bundledFile] = true;
        files.push(cfg.bundledFile);
      }
    });
    if (!files.length) return;

    els.preloadBar.classList.remove("hidden");
    var done = 0;
    var update = function () {
      done++;
      els.preloadText.textContent = "Precargando sonidos... (" + done + "/" + files.length + ")";
    };

    var loadOne = function (src) {
      return new Promise(function (resolve) {
        var audio = new Audio();
        var finished = false;
        var finish = function () { if (finished) return; finished = true; update(); resolve(); };
        audio.addEventListener("canplaythrough", finish, { once: true });
        audio.addEventListener("error", finish, { once: true });
        setTimeout(finish, 8000); // safety net so one slow/broken file can't hang the bar
        audio.src = src;
        audio.load();
      });
    };

    Promise.all(files.map(loadOne)).then(function () {
      els.preloadBar.classList.add("hidden");
    });
  }

  // ---------- Rendering ----------

  function renderBoard() {
    els.board.innerHTML = "";
    els.board.classList.toggle("edit-mode", state.editMode);
    state.keyMap = {};

    state.buttons.forEach(function (cfg, i) {
      var key = KEY_SEQUENCE[i] || null;
      if (key) state.keyMap[key] = cfg.id;
      els.board.appendChild(renderButton(cfg, key));
    });

    var addTile = document.createElement("button");
    addTile.className = "add-tile";
    addTile.type = "button";
    addTile.setAttribute("aria-label", "Agregar botón");
    addTile.textContent = "+";
    addTile.addEventListener("click", addButton);
    els.board.appendChild(addTile);
  }

  function renderButton(cfg, key) {
    var btn = document.createElement("button");
    btn.className = "arcade-btn";
    btn.type = "button";
    btn.style.setProperty("--btn-color", cfg.color);
    btn.dataset.id = cfg.id;
    btn.setAttribute("aria-label", cfg.label + (cfg.desc ? ", " + cfg.desc : ""));

    var bezel = document.createElement("div");
    bezel.className = "bezel";
    var face = document.createElement("div");
    face.className = "face";
    var wrap = document.createElement("div");
    wrap.className = "label-wrap";
    var label = document.createElement("div");
    label.className = "label";
    label.textContent = cfg.label;
    wrap.appendChild(label);

    var gear = document.createElement("span");
    gear.className = "gear";
    gear.textContent = "⚙️";
    gear.addEventListener("click", function (e) {
      e.stopPropagation();
      openEditor(cfg.id);
    });

    btn.appendChild(bezel);
    btn.appendChild(face);
    btn.appendChild(wrap);
    btn.appendChild(gear);

    if (key) {
      var keycap = document.createElement("span");
      keycap.className = "keycap";
      keycap.textContent = key;
      btn.appendChild(keycap);
    }

    attachPressHandlers(btn, cfg);
    return btn;
  }

  var DRAG_THRESHOLD = 10; // px of movement before a press becomes a reorder-drag

  function attachPressHandlers(btn, cfg) {
    var pressTimer = null;
    var longPressed = false;
    var pointerDown = false;
    var dragging = false;
    var pointerId = null;
    var startX = 0, startY = 0;

    function start(e) {
      if (e.button !== undefined && e.button !== 0) return; // left click / touch / pen only
      pointerDown = true;
      longPressed = false;
      dragging = false;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      pressTimer = setTimeout(function () {
        longPressed = true;
        vibrate(25);
        openEditor(cfg.id);
      }, 550);
    }

    function move(e) {
      if (!pointerDown) return;
      if (dragging) { handleDragMove(btn, e); return; }
      if (!state.editMode) return; // reordering only available in edit mode
      var dx = e.clientX - startX, dy = e.clientY - startY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      dragging = true;
      longPressed = true; // suppress the tap-to-play / long-press-to-edit that would otherwise fire on release
      clearTimeout(pressTimer);
      try { btn.setPointerCapture(pointerId); } catch (err) {}
      btn.classList.add("dragging");
      vibrate(20);
    }

    function cancel() {
      if (dragging) return; // an active drag only ends via pointerup/pointercancel
      pointerDown = false;
      clearTimeout(pressTimer);
    }

    function finishDrag() {
      btn.classList.remove("dragging");
      try { btn.releasePointerCapture(pointerId); } catch (err) {}
      commitOrderFromDOM();
    }

    function end() {
      if (!pointerDown) return;
      pointerDown = false;
      clearTimeout(pressTimer);
      if (dragging) { dragging = false; finishDrag(); return; }
      if (!longPressed) playButton(cfg, btn);
    }

    function onCancel() {
      pointerDown = false;
      clearTimeout(pressTimer);
      if (dragging) { dragging = false; finishDrag(); }
    }

    btn.addEventListener("pointerdown", start);
    btn.addEventListener("pointermove", move);
    btn.addEventListener("pointerup", end);
    btn.addEventListener("pointerleave", cancel);
    btn.addEventListener("pointercancel", onCancel);
    btn.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  }

  function boardTiles() {
    return Array.prototype.filter.call(els.board.children, function (el) {
      return el.classList.contains("arcade-btn");
    });
  }

  function handleDragMove(btn, e) {
    var target = document.elementFromPoint(e.clientX, e.clientY);
    var hovered = target && target.closest ? target.closest(".arcade-btn") : null;
    if (!hovered || hovered === btn || !els.board.contains(hovered)) return;

    var tiles = boardTiles();
    var draggedIndex = tiles.indexOf(btn);
    var hoveredIndex = tiles.indexOf(hovered);
    if (draggedIndex === -1 || hoveredIndex === -1) return;

    if (draggedIndex < hoveredIndex) {
      els.board.insertBefore(btn, hovered.nextSibling);
    } else {
      els.board.insertBefore(btn, hovered);
    }
  }

  function commitOrderFromDOM() {
    var tiles = boardTiles();
    var newOrder = tiles.map(function (el) {
      return state.buttons.find(function (b) { return b.id === el.dataset.id; });
    }).filter(Boolean);
    if (newOrder.length !== state.buttons.length) return; // safety net, shouldn't happen
    state.buttons = newOrder;
    saveConfig();
    renderBoard(); // refresh so keyboard shortcuts follow the new order
  }

  // ---------- Playback ----------

  function stopActive(id) {
    var active = state.activeSounds[id];
    if (!active) return;
    if (active.kind === "audio") {
      try { active.el.pause(); active.el.currentTime = 0; } catch (e) {}
      if (active.revoke) URL.revokeObjectURL(active.revoke);
    } else if (active.kind === "synth") {
      Synth.stop(active.handle);
    }
    delete state.activeSounds[id];
  }

  function stopAllSounds() {
    Object.keys(state.activeSounds).forEach(stopActive);
  }

  function playAudioEl(cfg, src, revokeUrl, onerror) {
    var audio = new Audio(src);
    state.activeSounds[cfg.id] = { kind: "audio", el: audio, revoke: revokeUrl || null };
    audio.addEventListener("ended", function () {
      if (state.activeSounds[cfg.id] && state.activeSounds[cfg.id].el === audio) delete state.activeSounds[cfg.id];
      if (revokeUrl) URL.revokeObjectURL(revokeUrl);
    });
    audio.play().catch(function () { if (onerror) onerror(); });
    audio.addEventListener("error", function () { if (onerror) onerror(); });
  }

  function playButton(cfg, btnEl) {
    stopAllSounds(); // only one sound plays at a time; a new press cuts off whatever else was playing

    if (btnEl) {
      btnEl.classList.add("pressed");
      setTimeout(function () { btnEl.classList.remove("pressed"); }, 90);
    }
    vibrate(15);

    var fallback = function () {
      state.activeSounds[cfg.id] = { kind: "synth", handle: Synth.play(cfg.synthType || "fart") };
    };

    switch (cfg.soundSource) {
      case "bundled":
        if (cfg.bundledFile) playAudioEl(cfg, cfg.bundledFile, null, fallback); else fallback();
        break;

      case "url":
        if (cfg.url) {
          playAudioEl(cfg, cfg.url, null, function () { toast("No se pudo reproducir esa URL (sin conexión o link inválido)"); });
        } else fallback();
        break;

      case "local":
        playLocal(cfg, fallback);
        break;

      case "synth":
      default:
        fallback();
    }
  }

  function playLocal(cfg, fallback) {
    if (HAS_FS_ACCESS) {
      BotoneraDB.getHandle(cfg.id).then(function (handle) {
        if (!handle) { toast("No hay ningún archivo local guardado — abrí el ⚙️ para elegir uno"); return; }
        return ensurePermission(handle).then(function (ok) {
          if (!ok) { toast("Se necesita permiso — abrí el ⚙️ y volvé a elegir el archivo"); return; }
          return handle.getFile();
        }).then(function (file) {
          if (!file) return;
          var url = URL.createObjectURL(file);
          playAudioEl(cfg, url, url, fallback);
        });
      }).catch(function () { toast("No se pudo abrir ese archivo local"); });
    } else {
      var file = state.sessionLocalFiles[cfg.id];
      if (!file) { toast("Tocá el ⚙️ para (volver a) elegir este archivo en este dispositivo"); return; }
      var url = URL.createObjectURL(file);
      playAudioEl(cfg, url, url, fallback);
    }
  }

  function ensurePermission(handle) {
    return handle.queryPermission({ mode: "read" }).then(function (state) {
      if (state === "granted") return true;
      return handle.requestPermission({ mode: "read" }).then(function (s) { return s === "granted"; });
    });
  }

  // ---------- Keyboard shortcuts (desktop) ----------

  function onKeyDown(e) {
    if (e.repeat) return; // don't stutter-restart while a key is held
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!els.modalOverlay.classList.contains("hidden")) return;

    var tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    var key = e.key.toLowerCase();
    var id = state.keyMap[key];
    if (!id) return;

    var cfg = state.buttons.find(function (b) { return b.id === id; });
    if (!cfg) return;
    e.preventDefault();
    var btnEl = els.board.querySelector('[data-id="' + id + '"]');
    playButton(cfg, btnEl);
  }

  // ---------- Add / Edit / Delete ----------

  function addButton() {
    var cfg = {
      id: uid(),
      defaultId: null,
      label: "NUEVO",
      desc: "",
      color: COLORS[state.buttons.length % COLORS.length],
      soundSource: "synth",
      bundledFile: null,
      synthType: Synth.types[state.buttons.length % Synth.types.length],
      localName: null,
      url: null
    };
    state.buttons.push(cfg);
    saveConfig();
    renderBoard();
    openEditor(cfg.id);
  }

  function populateBundledSelect() {
    els.fieldBundled.innerHTML = "";
    state.defaultsList.filter(function (e) { return e.file; }).forEach(function (entry) {
      var opt = document.createElement("option");
      opt.value = entry.file;
      opt.textContent = entry.label + (entry.desc ? " — " + entry.desc : "");
      els.fieldBundled.appendChild(opt);
    });
  }

  function updateSourcePanels() {
    var v = els.fieldSource.value;
    els.sourceBundled.classList.toggle("active", v === "bundled");
    els.sourceSynth.classList.toggle("active", v === "synth");
    els.sourceLocal.classList.toggle("active", v === "local");
    els.sourceUrl.classList.toggle("active", v === "url");
  }

  function openEditor(id) {
    var cfg = state.buttons.find(function (b) { return b.id === id; });
    if (!cfg) return;
    state.editingId = id;
    state.editingLocalHandle = null;
    state.editingLocalFile = null;

    $("modalTitle").textContent = "Configurar botón";
    els.fieldLabel.value = cfg.label || "";
    els.fieldDesc.value = cfg.desc || "";
    buildSwatches(cfg.color);

    populateBundledSelect();
    if (cfg.bundledFile) els.fieldBundled.value = cfg.bundledFile;
    els.fieldSynth.value = cfg.synthType || "fart";
    els.fieldUrl.value = cfg.url || "";
    els.fieldSource.value = cfg.soundSource || "synth";
    updateSourcePanels();
    updateLocalStatus(cfg);

    els.resetBtnAction.classList.toggle("hidden", !cfg.defaultId);

    els.modalOverlay.classList.remove("hidden");
  }

  function closeEditor() {
    els.modalOverlay.classList.add("hidden");
    state.editingId = null;
    els.fieldLocalFile.value = "";
  }

  function updateLocalStatus(cfg) {
    var note = HAS_FS_ACCESS
      ? "Solo se guarda una referencia de permiso — el archivo en sí nunca se copia ni se sube."
      : "Este navegador no puede recordar archivos locales entre visitas — vas a tener que volver a elegirlo después de recargar.";
    if (cfg.soundSource === "local" && cfg.localName) {
      els.localStatus.textContent = "Actual: " + cfg.localName + ". " + note;
    } else {
      els.localStatus.textContent = "No elegiste ningún archivo. " + note;
    }
  }

  function buildSwatches(selected) {
    els.swatches.innerHTML = "";
    COLORS.forEach(function (c) {
      var sw = document.createElement("div");
      sw.className = "swatch" + (c === selected ? " selected" : "");
      sw.style.background = c;
      sw.dataset.color = c;
      sw.addEventListener("click", function () {
        els.swatches.querySelectorAll(".swatch").forEach(function (s) { s.classList.remove("selected"); });
        sw.classList.add("selected");
      });
      els.swatches.appendChild(sw);
    });
  }

  function getSelectedColor() {
    var el = els.swatches.querySelector(".swatch.selected");
    return el ? el.dataset.color : COLORS[0];
  }

  function pickLocalFile() {
    if (HAS_FS_ACCESS) {
      window.showOpenFilePicker({
        types: [{ description: "Audio", accept: { "audio/*": [".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac"] } }],
        multiple: false
      }).then(function (handles) {
        var handle = handles[0];
        return ensurePermission(handle).then(function (ok) {
          if (!ok) { toast("Permiso denegado"); return; }
          state.editingLocalHandle = handle;
          state.editingLocalFile = null;
          var cfg = state.buttons.find(function (b) { return b.id === state.editingId; });
          updateLocalStatus(Object.assign({}, cfg, { localName: handle.name }));
        });
      }).catch(function () { /* el usuario canceló */ });
    } else {
      els.fieldLocalFile.click();
    }
  }

  function saveEditor() {
    var cfg = state.buttons.find(function (b) { return b.id === state.editingId; });
    if (!cfg) return;

    var source = els.fieldSource.value;

    if (source === "url" && !els.fieldUrl.value.trim()) {
      toast("Primero ingresá una URL");
      return;
    }
    if (source === "local" && !state.editingLocalHandle && !state.editingLocalFile &&
        !(cfg.soundSource === "local" && cfg.localName)) {
      toast("Primero elegí un archivo");
      return;
    }

    cfg.label = (els.fieldLabel.value || "BOTÓN").trim().slice(0, 24);
    cfg.desc = (els.fieldDesc.value || "").trim().slice(0, 60);
    cfg.color = getSelectedColor();
    cfg.soundSource = source;

    var finish = function () {
      saveConfig();
      renderBoard();
      closeEditor();
      toast("Guardado");
    };

    if (source === "bundled") {
      cfg.bundledFile = els.fieldBundled.value;
      BotoneraDB.deleteHandle(cfg.id).finally(finish);
    } else if (source === "synth") {
      cfg.synthType = els.fieldSynth.value;
      BotoneraDB.deleteHandle(cfg.id).finally(finish);
    } else if (source === "url") {
      cfg.url = els.fieldUrl.value.trim();
      BotoneraDB.deleteHandle(cfg.id).finally(finish);
    } else if (source === "local") {
      if (state.editingLocalHandle) {
        cfg.localName = state.editingLocalHandle.name;
        BotoneraDB.putHandle(cfg.id, state.editingLocalHandle).then(finish);
      } else if (state.editingLocalFile) {
        cfg.localName = state.editingLocalFile.name;
        state.sessionLocalFiles[cfg.id] = state.editingLocalFile;
        finish();
      } else {
        finish(); // keeping previously chosen local file
      }
    } else {
      finish();
    }
  }

  function deleteButtonAction() {
    if (!state.editingId) return;
    if (!confirm("¿Eliminar este botón?")) return;
    var id = state.editingId;
    stopActive(id);
    state.buttons = state.buttons.filter(function (b) { return b.id !== id; });
    delete state.sessionLocalFiles[id];
    BotoneraDB.deleteHandle(id).finally(function () {
      saveConfig();
      renderBoard();
      closeEditor();
      toast("Eliminado");
    });
  }

  function resetButtonToDefault() {
    var cfg = state.buttons.find(function (b) { return b.id === state.editingId; });
    if (!cfg || !cfg.defaultId) return;
    fetchDefaults().then(function (list) {
      var entry = list.find(function (e) { return e.id === cfg.defaultId; });
      if (!entry) { toast("Ya no existe esa entrada en defaults.json"); return; }
      stopActive(cfg.id);
      cfg.label = entry.label || cfg.label;
      cfg.desc = entry.desc || "";
      cfg.color = entry.color || cfg.color;
      cfg.soundSource = entry.file ? "bundled" : "synth";
      cfg.bundledFile = entry.file || null;
      cfg.synthType = entry.synthType || "fart";
      cfg.localName = null;
      cfg.url = null;
      delete state.sessionLocalFiles[cfg.id];
      BotoneraDB.deleteHandle(cfg.id).finally(function () {
        saveConfig();
        renderBoard();
        closeEditor();
        toast("Restablecido por defecto");
      });
    });
  }

  // ---------- Export / Import (text-only, no audio bytes ever) ----------

  function exportConfig() {
    var payload = {
      app: "botonera",
      version: 2,
      exportedAt: new Date().toISOString(),
      buttons: state.buttons.map(function (b) {
        return {
          id: b.id, defaultId: b.defaultId, label: b.label, desc: b.desc, color: b.color,
          soundSource: b.soundSource, bundledFile: b.bundledFile, synthType: b.synthType,
          localName: b.localName, url: b.url
        };
      })
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "botonera-config.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    toast("Exportado (los sonidos de archivos locales hay que volver a elegirlos después de importar)");
  }

  function importConfig(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var payload = JSON.parse(reader.result);
        var buttons = payload.buttons || payload;
        if (!Array.isArray(buttons)) throw new Error("bad format");

        stopAllSounds();
        state.buttons = buttons.map(function (b) {
          return {
            id: b.id || uid(),
            defaultId: b.defaultId || null,
            label: b.label || "BOTÓN",
            desc: b.desc || "",
            color: b.color || COLORS[0],
            soundSource: b.soundSource === "local" ? "synth" : (b.soundSource || "synth"), // local refs can't travel between devices
            bundledFile: b.bundledFile || null,
            synthType: b.synthType || "fart",
            localName: null,
            url: b.url || null
          };
        });
        saveConfig();
        renderBoard();
        preloadSounds();
        toast("Se importaron " + state.buttons.length + " botones");
      } catch (e) {
        toast("Error al importar: archivo inválido");
      }
    };
    reader.readAsText(file);
  }

  function resetToDefaults() {
    if (!confirm("¿Restablecer todos los botones a los valores por defecto? Esto elimina los botones y personalizaciones que hayas hecho.")) return;
    fetchDefaults().then(function (list) {
      stopAllSounds();
      BotoneraDB.clearAll().finally(function () {
        state.sessionLocalFiles = {};
        localStorage.removeItem(STORAGE_KEY);
        state.buttons = list.map(buttonFromDefaultEntry);
        saveConfig();
        renderBoard();
        preloadSounds();
        toast("Restablecido a los valores por defecto");
      });
    });
  }

  // ---------- Wiring ----------

  function bindEvents() {
    els.editToggle.addEventListener("click", function () {
      state.editMode = !state.editMode;
      els.editToggle.setAttribute("aria-pressed", String(state.editMode));
      els.board.classList.toggle("edit-mode", state.editMode);
    });

    els.menuToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      els.menuPanel.classList.toggle("hidden");
    });
    document.addEventListener("click", function () { els.menuPanel.classList.add("hidden"); });
    els.menuPanel.addEventListener("click", function (e) { e.stopPropagation(); });

    els.addBtnAction.addEventListener("click", function () { els.menuPanel.classList.add("hidden"); addButton(); });
    els.exportAction.addEventListener("click", function () { els.menuPanel.classList.add("hidden"); exportConfig(); });
    els.importAction.addEventListener("click", function () { els.menuPanel.classList.add("hidden"); els.importFile.click(); });
    els.resetAction.addEventListener("click", function () { els.menuPanel.classList.add("hidden"); resetToDefaults(); });
    els.importFile.addEventListener("change", function () {
      if (els.importFile.files[0]) importConfig(els.importFile.files[0]);
      els.importFile.value = "";
    });

    els.fieldSource.addEventListener("change", updateSourcePanels);

    els.pickLocalBtn.addEventListener("click", pickLocalFile);
    els.fieldLocalFile.addEventListener("change", function () {
      if (els.fieldLocalFile.files[0]) {
        state.editingLocalFile = els.fieldLocalFile.files[0];
        state.editingLocalHandle = null;
        updateLocalStatus({ soundSource: "local", localName: state.editingLocalFile.name });
      }
    });

    els.testSoundBtn.addEventListener("click", function () {
      var v = els.fieldSource.value;
      if (v === "bundled") {
        var a = new Audio(els.fieldBundled.value);
        a.play().catch(function () { toast("No se pudo reproducir ese archivo"); });
      } else if (v === "synth") {
        Synth.play(els.fieldSynth.value);
      } else if (v === "url") {
        if (!els.fieldUrl.value.trim()) { toast("Primero ingresá una URL"); return; }
        var au = new Audio(els.fieldUrl.value.trim());
        au.play().catch(function () { toast("No se pudo reproducir esa URL"); });
      } else if (v === "local") {
        if (state.editingLocalHandle) {
          state.editingLocalHandle.getFile().then(function (f) {
            var url = URL.createObjectURL(f);
            var au2 = new Audio(url);
            au2.play().catch(function () { toast("No se pudo reproducir ese archivo"); });
          });
        } else if (state.editingLocalFile) {
          var url2 = URL.createObjectURL(state.editingLocalFile);
          var au3 = new Audio(url2);
          au3.play().catch(function () { toast("No se pudo reproducir ese archivo"); });
        } else {
          toast("Primero elegí un archivo");
        }
      }
    });

    els.cancelBtnAction.addEventListener("click", closeEditor);
    els.saveBtnAction.addEventListener("click", saveEditor);
    els.deleteBtnAction.addEventListener("click", deleteButtonAction);
    els.resetBtnAction.addEventListener("click", resetButtonToDefault);
    els.modalOverlay.addEventListener("click", function (e) {
      if (e.target === els.modalOverlay) closeEditor();
    });

    els.stopAllBtn.addEventListener("click", function () {
      stopAllSounds();
      vibrate(15);
      toast("Sonidos detenidos");
    });

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", Synth.unlock, { once: true });
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }
  }

  function init() {
    els.board = $("board");
    els.editToggle = $("editToggle");
    els.menuToggle = $("menuToggle");
    els.menuPanel = $("menuPanel");
    els.addBtnAction = $("addBtnAction");
    els.exportAction = $("exportAction");
    els.importAction = $("importAction");
    els.resetAction = $("resetAction");
    els.importFile = $("importFile");
    els.modalOverlay = $("modalOverlay");
    els.fieldLabel = $("fieldLabel");
    els.fieldDesc = $("fieldDesc");
    els.fieldSource = $("fieldSource");
    els.sourceBundled = $("sourceBundled");
    els.sourceSynth = $("sourceSynth");
    els.sourceLocal = $("sourceLocal");
    els.sourceUrl = $("sourceUrl");
    els.fieldBundled = $("fieldBundled");
    els.fieldSynth = $("fieldSynth");
    els.pickLocalBtn = $("pickLocalBtn");
    els.fieldLocalFile = $("fieldLocalFile");
    els.localStatus = $("localStatus");
    els.fieldUrl = $("fieldUrl");
    els.swatches = $("swatches");
    els.testSoundBtn = $("testSoundBtn");
    els.cancelBtnAction = $("cancelBtnAction");
    els.saveBtnAction = $("saveBtnAction");
    els.deleteBtnAction = $("deleteBtnAction");
    els.resetBtnAction = $("resetBtnAction");
    els.toast = $("toast");
    els.preloadBar = $("preloadBar");
    els.preloadText = $("preloadText");
    els.stopAllBtn = $("stopAllBtn");

    bindEvents();
    registerServiceWorker();

    fetchDefaults().then(function (list) {
      var saved = loadSavedConfig();
      state.buttons = saved || list.map(buttonFromDefaultEntry);
      saveConfig();
      renderBoard();
      preloadSounds();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
