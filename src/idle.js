// Expo inactivity uses its own deadline; it never pauses or resets the round.
export function createExpoIdle({ target, canShowCountdown, onCountdown, onDismiss, onExpire, isUserEvent = event => event.isTrusted,
  idleMs = 60000, countdownMs = 10000, now = () => Date.now() }) {
  let lastActivity = now();
  let lastScheduled = lastActivity;
  let timer;
  let generation = 0;
  let warning = false;
  let running = true;
  let consumeGesture = false;
  let consumeKey = false;
  let dismissGuardUntil = 0;
  let pointerDismissedAt = -Infinity;
  const listeners = [];
  function clear() { generation++; clearTimeout(timer); timer = undefined; }
  function dismiss() {
    if (!warning) return;
    warning = false;
    onDismiss();
  }
  function schedule(delay) {
    clear();
    if (!running) return;
    const current = generation;
    timer = setTimeout(() => { if (current === generation && running) tick(); }, Math.max(0, delay));
  }
  function tick() {
    const elapsed = now() - lastActivity;
    if (elapsed >= idleMs + countdownMs) {
      clear();
      dismiss();
      lastActivity = now();
      onExpire();
      if (running) schedule(idleMs);
    } else if (elapsed >= idleMs) {
      const seconds = Math.ceil((idleMs + countdownMs - elapsed) / 1000);
      if (canShowCountdown()) { warning = true; onCountdown(seconds); }
      else dismiss();
      schedule(Math.min(1000, idleMs + countdownMs - elapsed));
    } else schedule(idleMs - elapsed);
  }
  function activity({ movement = false } = {}) {
    if (!running) return;
    lastActivity = now();
    const wasWarning = warning;
    dismiss();
    // Remember every move, but avoid repeatedly replacing the same timer.
    if (!movement || wasWarning || lastActivity - lastScheduled >= 250) {
      lastScheduled = lastActivity;
      schedule(idleMs);
    }
  }
  function consume(event) {
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();
  }
  function track(event) {
    if (!running || !isUserEvent(event)) return;
    const type = event.type;
    const down = type === 'pointerdown' || type === 'touchstart';
    const pointerFollowup = ['pointerup', 'mousedown', 'mouseup', 'touchend', 'click', 'dblclick'].includes(type);
    if (down && !warning && (now() < dismissGuardUntil || type === 'touchstart' && consumeGesture && now() - pointerDismissedAt < 1000)) {
      consumeGesture = true;
      consume(event);
      activity();
      return;
    }
    if (down && !warning) consumeGesture = false;
    if (consumeGesture && pointerFollowup) {
      consume(event);
      if (type === 'click') consumeGesture = false;
      activity();
      return;
    }
    if (consumeKey && (type === 'keyup' || type === 'keydown')) {
      consume(event);
      if (type === 'keyup') consumeKey = false;
      activity();
      return;
    }
    if (warning) {
      dismissGuardUntil = now() + 500;
      if (down) { consumeGesture = true; pointerDismissedAt = now(); }
      if (type === 'keydown') consumeKey = true;
      consume(event);
    }
    activity({ movement: type === 'pointermove' || type === 'touchmove' });
  }
  for (const type of ['pointermove', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'touchmove', 'click', 'dblclick', 'keydown', 'keyup', 'input', 'wheel']) {
    target.addEventListener(type, track, { capture: true, passive: false });
    listeners.push(type);
  }
  function navigate() {
    clear();
    if (!canShowCountdown()) dismiss();
    if (running) tick(); // Navigation caused by timers is not user activity.
  }
  function stop() { running = false; clear(); dismiss(); }
  function dispose() { stop(); listeners.forEach(type => target.removeEventListener(type, track, true)); }
  schedule(idleMs);
  return { activity, navigate, stop, dispose, isWarning: () => warning };
}
