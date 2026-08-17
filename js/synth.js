/* Procedural sound effects generated with the Web Audio API.
   No audio files or network requests required — these work fully offline
   and act as the built-in defaults for every button. Each generator
   returns a "voice" (its nodes) so a caller can force-stop it early,
   which lets the app retrigger a button cleanly on repeat presses. */

var Synth = (function () {
  var ctx = null;

  function getCtx() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function noiseBuffer(c, duration) {
    var len = Math.max(1, Math.floor(c.sampleRate * duration));
    var buf = c.createBuffer(1, len, c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function envGain(c, t0, peak, attack, decay) {
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    return g;
  }

  function fart(c, t0) {
    var osc = c.createOscillator();
    osc.type = "sawtooth";
    var filt = c.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(900, t0);
    filt.frequency.exponentialRampToValueAtTime(140, t0 + 0.55);
    var g = envGain(c, t0, 0.5, 0.02, 0.6);
    osc.frequency.setValueAtTime(130, t0);
    osc.frequency.exponentialRampToValueAtTime(55, t0 + 0.5);
    osc.frequency.linearRampToValueAtTime(70, t0 + 0.62);
    osc.connect(filt).connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.65);
    return { nodes: [osc], gain: g };
  }

  function burp(c, t0) {
    var osc = c.createOscillator();
    osc.type = "square";
    var filt = c.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(1100, t0);
    filt.frequency.exponentialRampToValueAtTime(220, t0 + 0.3);
    var g = envGain(c, t0, 0.45, 0.01, 0.32);
    osc.frequency.setValueAtTime(160, t0);
    osc.frequency.exponentialRampToValueAtTime(70, t0 + 0.28);
    osc.connect(filt).connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.35);
    return { nodes: [osc], gain: g };
  }

  function boing(c, t0) {
    var osc = c.createOscillator();
    osc.type = "sine";
    var g = envGain(c, t0, 0.5, 0.01, 0.5);
    osc.frequency.setValueAtTime(90, t0);
    osc.frequency.exponentialRampToValueAtTime(900, t0 + 0.12);
    osc.frequency.exponentialRampToValueAtTime(180, t0 + 0.5);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.55);
    return { nodes: [osc], gain: g };
  }

  function honk(c, t0) {
    var osc1 = c.createOscillator();
    var osc2 = c.createOscillator();
    osc1.type = "sawtooth";
    osc2.type = "sawtooth";
    osc1.frequency.setValueAtTime(220, t0);
    osc2.frequency.setValueAtTime(221.5, t0);
    var g = envGain(c, t0, 0.4, 0.02, 0.35);
    var filt = c.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 900;
    osc1.connect(filt);
    osc2.connect(filt);
    filt.connect(g).connect(c.destination);
    osc1.start(t0); osc2.start(t0);
    osc1.stop(t0 + 0.4); osc2.stop(t0 + 0.4);
    return { nodes: [osc1, osc2], gain: g };
  }

  function laser(c, t0) {
    var osc = c.createOscillator();
    osc.type = "sawtooth";
    var g = envGain(c, t0, 0.4, 0.005, 0.25);
    osc.frequency.setValueAtTime(1800, t0);
    osc.frequency.exponentialRampToValueAtTime(120, t0 + 0.25);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.28);
    return { nodes: [osc], gain: g };
  }

  function airhorn(c, t0) {
    var freqs = [220, 330, 440];
    var g = envGain(c, t0, 0.35, 0.03, 0.9);
    var oscs = freqs.map(function (f) {
      var osc = c.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = f;
      osc.connect(g);
      osc.start(t0);
      osc.stop(t0 + 0.95);
      return osc;
    });
    g.connect(c.destination);
    return { nodes: oscs, gain: g };
  }

  function buzzer(c, t0) {
    var osc = c.createOscillator();
    osc.type = "square";
    osc.frequency.value = 220;
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    for (var i = 0; i < 4; i++) {
      var s = t0 + i * 0.15;
      g.gain.setValueAtTime(0.35, s);
      g.gain.setValueAtTime(0.0001, s + 0.08);
    }
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.65);
    return { nodes: [osc], gain: g };
  }

  function drumroll(c, t0) {
    var buf = noiseBuffer(c, 0.35);
    var src = c.createBufferSource();
    src.buffer = buf;
    var filt = c.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 1200;
    var g = envGain(c, t0, 0.5, 0.005, 0.3);
    src.connect(filt).connect(g).connect(c.destination);
    src.start(t0);
    src.stop(t0 + 0.35);
    return { nodes: [src], gain: g };
  }

  var GENERATORS = { fart: fart, burp: burp, boing: boing, honk: honk, laser: laser, airhorn: airhorn, buzzer: buzzer, drumroll: drumroll };

  function play(type) {
    var c = getCtx();
    var fn = GENERATORS[type] || fart;
    var voice = fn(c, c.currentTime + 0.001);
    return { ctx: c, voice: voice };
  }

  function stop(handle) {
    if (!handle || !handle.voice) return;
    var c = handle.ctx;
    var v = handle.voice;
    var now = c.currentTime;
    try {
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setValueAtTime(Math.max(v.gain.gain.value, 0.0001), now);
      v.gain.gain.linearRampToValueAtTime(0.0001, now + 0.02);
    } catch (e) {}
    v.nodes.forEach(function (n) {
      try { n.stop(now + 0.03); } catch (e) {}
    });
  }

  function unlock() {
    getCtx();
  }

  return { play: play, stop: stop, unlock: unlock, types: Object.keys(GENERATORS) };
})();
