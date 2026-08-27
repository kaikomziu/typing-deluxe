// WebAudio による効果音
const SFX = (() => {
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem("td_muted") === "1"; } catch (e) {}

  function ac() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type = "square", gain = 0.15, when = 0) {
    const c = ac();
    if (!c || muted) return;
    const t0 = c.currentTime + when;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  return {
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      try { localStorage.setItem("td_muted", muted ? "1" : "0"); } catch (e) {}
      return muted;
    },
    unlock() { ac(); },
    key() { tone(1400 + Math.random() * 120, 0.05, "square", 0.06); },
    miss() { tone(150, 0.16, "sawtooth", 0.18); },
    word() { tone(880, 0.08, "triangle", 0.14); tone(1320, 0.1, "triangle", 0.12, 0.06); },
    combo(n) { tone(660 + n * 40, 0.09, "triangle", 0.13); },
    start() { [523, 659, 784].forEach((f, i) => tone(f, 0.12, "triangle", 0.14, i * 0.08)); },
    finish() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, "triangle", 0.16, i * 0.1)); },
    fail() { [400, 320, 240].forEach((f, i) => tone(f, 0.2, "sawtooth", 0.16, i * 0.12)); },
  };
})();
