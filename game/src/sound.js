// Procedural sound: every effect is a WebAudio oscillator or a burst of
// filtered noise, made on first use. No audio files, no network. Everything
// is guarded — a browser without audio simply stays silent.
export function createSound() {
  let context = null;
  let noiseBuffer = null;
  let unlocked = false;

  function ensure() {
    if (!unlocked) return null;
    try {
      if (!context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return null;
        context = new AudioContext();
        const length = Math.floor(context.sampleRate * 0.5);
        noiseBuffer = context.createBuffer(1, length, context.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      }
      if (context.state === 'suspended') void context.resume();
      return context;
    } catch {
      return null;
    }
  }

  function burst(duration, filterFreq, gainValue, type = 'lowpass') {
    const ctx = ensure();
    if (!ctx) return;
    try {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = filterFreq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(gainValue, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      source.connect(filter).connect(gain).connect(ctx.destination);
      source.start();
      source.stop(ctx.currentTime + duration);
    } catch { /* silent */ }
  }

  function tone(freq, duration, gainValue, slideTo) {
    const ctx = ensure();
    if (!ctx) return;
    try {
      const oscillator = ctx.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(gainValue, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + duration);
    } catch { /* silent */ }
  }

  return {
    unlock() {
      unlocked = true;
      ensure();
    },
    shot() {
      burst(0.09, 1800, 0.22);
      tone(180, 0.07, 0.12, 60);
    },
    enemyShot() {
      burst(0.08, 1200, 0.1);
    },
    explosion() {
      burst(0.7, 400, 0.5);
      tone(120, 0.5, 0.3, 35);
    },
    beep() {
      tone(880, 0.08, 0.12);
    },
    hit() {
      tone(1400, 0.05, 0.1);
    },
    dry() {
      tone(300, 0.04, 0.08);
    },
    reload() {
      tone(500, 0.05, 0.08);
      setTimeout(() => tone(650, 0.05, 0.08), 120);
    },
    plant() {
      tone(520, 0.3, 0.1, 780);
    },
  };
}
