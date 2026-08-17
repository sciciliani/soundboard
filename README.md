# Botonera 🕹️

An arcade-style soundboard that runs **entirely offline** in a mobile browser.
Tap the big buttons to play a sound; flip on Edit mode (or long-press a
button) to reassign its label, description, color, and audio.

No build step, no server-side code, no external requests — it's plain
HTML/CSS/JS plus a service worker, so it works from a phone with the radio
off.

## Features

- Default buttons are defined in [`defaults.json`](defaults.json), mapping
  each button to a label, description, color, and an mp3 in
  [`audios/`](audios/). **Edit that JSON file to change the defaults — no
  source code changes needed.** See "Editing the defaults" below.
- A few built-in arcade sound effects (fart, burp, boing, honk, laser, air
  horn, buzzer, drum hit) are also available, synthesized live with the Web
  Audio API — no audio file required, useful as a fallback or for new
  buttons.
- Fully configurable per button: rename it, edit its description, pick a
  color, and choose its sound source — a bundled mp3, a built-in synth, a
  file picked live from the device, or an internet URL.
- **No file uploads.** Nothing is ever copied into the app or sent
  anywhere:
  - *File on this device* lets you browse and pick a local audio file to
    play. On browsers with the File System Access API (Chrome/Edge on
    desktop and Android) only a permission reference is remembered, so it
    keeps working after a reload without the file's bytes ever being
    duplicated anywhere. On browsers without that API (notably iOS Safari)
    the pick only lasts the current session — you'll reselect it next time,
    which is the trade-off for never storing the file's content.
  - *Internet URL* stores just the link; the audio streams from the
    internet at play time (so that button needs connectivity), and again no
    audio content is ever downloaded into the app's storage.
- **Reset to default** any single button (⚙️ editor → "Reset to default")
  or the whole board (menu → "Reset to defaults") — both re-read
  `defaults.json` fresh, so editing it and resetting is the simple way to
  push changes without hand-editing every button.
- Pressing a button that's already playing stops and restarts it from the
  top instead of layering another copy on top — handy for mashing the same
  button repeatedly. Different buttons can still play over each other.
- All the bundled mp3s currently on the board are preloaded up front, with
  a small spinner at the bottom of the screen ("Precargando sonidos...")
  while that happens, so the first tap on any button plays instantly.
- On a computer, every button also has a keyboard shortcut: keys are
  assigned in board order down the keyboard rows —
  `1234567890` / `qwertyuiop` / `asdfghjkl` / `zxcvbnm` — shown as a small
  tag on each button (hidden on touch-only devices). Typing in a text
  field or having the editor open disables the shortcuts so you can type
  normally.
- The UI is in Argentine Spanish (castellano rioplatense).
- Add or delete buttons; export/import your board layout as a small JSON
  file (labels, colors, which bundled/synth/URL sound each uses). Local
  device-file picks can't be exported by design — reselect them after
  importing on a different device.
- Everything lives only in your browser's local storage on your own device
  (`localStorage` for layout, `IndexedDB` only for local-file permission
  references) — nothing is ever saved back to wherever this app is hosted,
  so every user's customized board stays private and local to them.
- Installable as a Progressive Web App: add it to your phone's home screen
  and it launches full-screen with no browser chrome, no network required
  after the first load.
- Arcade-cabinet look with a press animation and (where supported) haptic
  buzz on tap.

## Editing the defaults

Open [`defaults.json`](defaults.json) in any text editor. Each entry looks
like:

```json
{ "id": "perfect-fart", "label": "FART", "desc": "Perfect fart", "color": "#db273c", "file": "audios/perfect-fart.mp3" }
```

- `label` / `desc` / `color` — shown on the button and in its editor.
- `file` — path to an mp3 (or wav/ogg) relative to this file, normally
  inside `audios/`. Drop new audio files into `audios/` and point `file`
  at them.
- `id` — a stable key used only so "Reset to default" can find this
  button again later even if you've renamed it. Keep it once set.
- Add, remove, or reorder entries in the `buttons` array to change the
  board. Reload the page (or use "Reset to defaults") to pick up changes.

This only takes effect when the app is served over `http(s)` (see Option B
below) — opening `index.html` straight from `file://` can't fetch the JSON
due to browser restrictions, and falls back to a minimal built-in set.

## Running it fully offline on a phone

Pick whichever is easiest:

### Option A — just open the file
Copy the `botonera` folder onto the phone (e.g. via USB, AirDrop, or a
file-sync app) and open `index.html` directly from a file manager / the
browser's "open file" dialog. Playing/editing buttons works with no network
at all. Two limitations under plain `file://`: the install-to-home-screen
prompt generally isn't offered, and `defaults.json` can't be fetched (the
app falls back to a minimal built-in set) — for defaults.json editing to
work, use Option B.

### Option B — install as an app (recommended)
1. Serve the folder once over local HTTP so the browser can register the
   service worker and offer "Add to Home Screen":
   - On the phone itself (Android, via Termux):
     ```
     pkg install python
     cd botonera
     python -m http.server 8080
     ```
     then open `http://localhost:8080` in the phone's browser.
   - Or from a computer on the same Wi-Fi:
     ```
     cd botonera
     python3 -m http.server 8080
     ```
     then visit `http://<computer-ip>:8080` from the phone once.
2. In the browser menu choose **Add to Home Screen** / **Install app**.
3. Launch Botonera from the home screen icon. From then on it works with
   Wi-Fi and mobile data both off — the service worker caches every asset
   and IndexedDB/localStorage hold your button configuration and sounds.

You only need the local server for that *first* visit so the browser can
cache the app; after installing, no server needs to be running at all.

## Using it

- **Play**: tap a button.
- **Edit a button**: toggle **✏️ Edit** in the top bar and tap the ⚙️ that
  appears on each button — or just press and hold any button at any time.
  In the editor you can change the label, description, color, and sound
  source: a bundled mp3, a built-in synth, a file picked from this device,
  or an internet URL. Use **▶️ Test** to preview before saving.
- **Add a button**: the **➕** tile at the end of the grid, or the menu
  (**⋮ → Add button**).
- **Reset one button**: open its editor and tap **↩️ Reset to default**
  (only shown for buttons that came from `defaults.json`).
- **Reset everything**: menu → **♻️ Reset to defaults** — wipes custom
  buttons/sounds and rebuilds the board fresh from `defaults.json`.
- **Export / Import**: menu (**⋮**) → **Export config** downloads a small
  JSON with your layout, colors, and which bundled/synth/URL sound each
  button uses; **Import config** restores one. Local device-file picks
  aren't included (see Features above) — reselect them after importing.

## File layout

```
botonera/
  index.html         entry point / markup
  defaults.json       editable map of default buttons -> mp3 files (edit this, not the code)
  audios/              bundled mp3 files referenced by defaults.json
  css/style.css        arcade styling, responsive layout
  js/synth.js          Web Audio procedural sound generators (built-in fallback sounds)
  js/db.js             IndexedDB wrapper for local-file *permission references* only
  js/app.js            app logic: board rendering, editor, import/export
  manifest.json        PWA metadata
  sw.js                service worker (offline asset cache, reads defaults.json)
  icons/               app icons (192/512/maskable), generated locally
```

All state lives only in your own browser on your own device
(`localStorage` for the button layout, `IndexedDB` only for local-file
permission references — never file content) — nothing is ever uploaded or
sent to wherever this app happens to be hosted. Each user's customized
board is theirs alone.
