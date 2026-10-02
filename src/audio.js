// One reusable context; short sine tones need no downloaded audio assets.
export function createGameAudio(settings) {
  let context;
  let unavailable = false;
  let lastSoundAt = -Infinity;
  const active = new Set();
  const melodies = {
    flip: [[660, 0, 0.08]],
    match: [[659, 0, 0.12], [880, 0.10, 0.16]],
    mismatch: [[392, 0, 0.10], [330, 0.09, 0.13]],
    won: [[523, 0, 0.16], [659, 0.13, 0.16], [784, 0.26, 0.24]],
    expired: [[440, 0, 0.16], [349, 0.16, 0.22]],
  };
  function unlock() {
    if (!settings.enabled || unavailable) return;
    try {
      if (!context) {
        const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioContext) { unavailable = true; return; }
        context = new AudioContext();
      }
      if (context.state === 'suspended') context.resume().catch(() => {});
    } catch { unavailable = true; }
  }
  function stop() {
    if (!context) return;
    const now = context.currentTime;
    for (const node of active) {
      try {
        node.gain.gain.cancelScheduledValues(now);
        node.gain.gain.setTargetAtTime(0, now, 0.005);
        node.oscillator.stop(now + 0.025);
      } catch { /* Already completed. */ }
    }
    lastSoundAt = -Infinity;
  }
  function play(kind) {
    if (!settings.enabled || !context || context.state !== 'running' || !melodies[kind]) return;
    const now = context.currentTime;
    if (kind === 'flip' && now - lastSoundAt < 0.07) return;
    stop();
    lastSoundAt = now;
    try {
      const volume = Math.max(0, Math.min(1, settings.volume));
      for (const [frequency, offset, length] of melodies[kind]) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const node = { oscillator, gain };
        active.add(node);
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        const at = now + offset;
        gain.gain.setValueAtTime(0, now);
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(volume * 0.3, at + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
          active.delete(node);
        };
        oscillator.start(at);
        oscillator.stop(at + length + 0.015);
      }
    } catch { stop(); }
  }
  return { unlock, play, stop };
}
