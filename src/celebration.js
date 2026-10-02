// Own every victory callback so resetting or leaving invalidates the sequence.
export function createWinCelebration({ board, screen, durationMs, reducedMotion, onSound, onResult }) {
  const events = new Set();
  let generation = 0;
  let active = false;
  let paused = false;
  let confetti;
  function arm(event) {
    const round = generation;
    event.deadline = Date.now() + event.remaining;
    event.id = setTimeout(() => {
      if (round !== generation || paused) return;
      events.delete(event);
      event.callback();
    }, event.remaining);
  }
  function schedule(callback, delay) {
    const event = { callback, remaining: delay };
    events.add(event);
    arm(event);
  }
  function cancel() {
    generation++;
    events.forEach(event => clearTimeout(event.id));
    events.clear();
    active = paused = false;
    confetti?.remove();
    confetti = null;
    board.classList.remove('is-celebrating', 'celebration-paused');
    screen.classList.remove('is-leaving');
  }
  function start(round, flipDurationMs) {
    cancel();
    active = true;
    const reduced = reducedMotion.matches;
    const hold = reduced ? 400 : durationMs;
    schedule(() => {
      board.classList.add('is-celebrating');
      onSound('won');
      if (reducedMotion.matches) return;
      confetti = document.createElement('div');
      confetti.className = 'win-confetti';
      confetti.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 24; i++) {
        const piece = document.createElement('i');
        piece.style.cssText = `--x:${(i * 37) % 100}%;--drift:${(i % 5 - 2) * 18}px;--spin:${i % 2 ? 160 : -140}deg;--delay:${i % 6 * 25}ms;--color:var(${i % 2 ? '--gold' : '--brand-cyan'})`;
        confetti.append(piece);
      }
      board.append(confetti);
    }, reduced ? 0 : flipDurationMs);
    if (!reduced) schedule(() => screen.classList.add('is-leaving'), Math.max(0, hold - 180));
    schedule(() => { cancel(); onResult(round); }, hold);
  }
  function pause() {
    if (!active || paused) return false;
    paused = true;
    for (const event of events) {
      clearTimeout(event.id);
      event.remaining = Math.max(0, event.deadline - Date.now());
    }
    board.classList.add('celebration-paused');
    return true;
  }
  function resume() {
    if (!active || !paused) return;
    paused = false;
    board.classList.remove('celebration-paused');
    events.forEach(arm);
  }
  return { start, cancel, pause, resume };
}
