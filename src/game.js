// Round logic owns every scheduled callback, independent of the screen.
export function createMemoryGame(config, onChange, onEnd, onSound = () => {}) {
  let state;
  let countdown;
  let mismatch;
  let lastRemaining;
  let entrance;
  let generation = 0;
  const durationMs = config.roundDurationSeconds * 1000;
  function cancelTimers() {
    generation++;
    clearTimeout(countdown);
    clearTimeout(mismatch);
    clearTimeout(entrance);
  }
  function schedule(callback, delay) {
    const round = generation;
    return setTimeout(() => { if (round === generation) callback(); }, delay);
  }
  function remaining() {
    if (state.status === 'won' || state.status === 'expired') return state.finalRemainingMs;
    if (state.status === 'entering') return durationMs;
    if (state.status === 'paused') return state.pausedRemaining;
    return Math.max(0, state.deadline - Date.now());
  }
  function publish() {
    lastRemaining = Math.ceil(remaining() / 1000);
    onChange({ ...state, remainingSeconds: lastRemaining });
  }
  function end(outcome) {
    if (state?.status !== 'playing') return;
    state.finalRemainingMs = remaining();
    state.elapsedMs = durationMs - state.finalRemainingMs;
    state.elapsedSeconds = state.elapsedMs / 1000;
    state.status = outcome;
    cancelTimers();
    publish();
    onSound(outcome);
    onEnd({ ...state });
  }
  function tick() {
    if (state?.status !== 'playing') return;
    clearTimeout(countdown);
    if (remaining() <= 0) { end('expired'); return; }
    if (lastRemaining !== Math.ceil(remaining() / 1000)) publish();
    countdown = schedule(tick, Math.min(100, remaining()));
  }
  function activate() {
    state.status = 'playing';
    state.deadline = Date.now() + durationMs;
    tick();
    // Publish the status transition even though the displayed time stays 1:00.
    publish();
  }
  function start({ entryDurationMs = 0 } = {}) {
    cancelTimers();
    lastRemaining = undefined;
    const cards = config.pairs.flatMap(pair => [0, 1].map(copy => ({ ...pair, key: `${pair.id}-${copy}`, matched: false, revealed: false })));
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    state = { cards, status: 'entering', selected: [], locked: false, moves: 0, pairsFound: 0,
      deadline: 0, entryDurationMs, entryDeadline: Date.now() + entryDurationMs };
    publish();
    if (entryDurationMs > 0) entrance = schedule(activate, entryDurationMs);
    else activate();
  }
  function resolveMismatch() {
    if (state.status !== 'playing') return;
    if (remaining() <= 0) { end('expired'); return; }
    state.selected.forEach(i => { state.cards[i].revealed = false; });
    state.selected = [];
    state.locked = false;
    publish();
  }
  function select(index) {
    if (state?.status !== 'playing') return;
    if (remaining() <= 0) { end('expired'); return; }
    const card = state.cards[index];
    if (!card || state.locked || card.matched || card.revealed) return;
    card.revealed = true;
    state.selected.push(index);
    if (state.selected.length === 2) {
      state.moves++;
      const [first, second] = state.selected.map(i => state.cards[i]);
      if (first.id === second.id) {
        first.matched = second.matched = true;
        state.selected = [];
        state.pairsFound++;
        if (state.pairsFound === config.pairs.length) { end('won'); return; }
        onSound('match');
      } else {
        state.locked = true;
        state.mismatchDeadline = Date.now() + config.mismatchRevealDelayMs;
        mismatch = schedule(resolveMismatch, config.mismatchRevealDelayMs);
        onSound('mismatch');
      }
    } else onSound('flip');
    publish();
  }
  function pause() {
    if (!['playing', 'entering'].includes(state?.status)) return false;
    if (state.status === 'playing' && remaining() <= 0) { end('expired'); return false; }
    state.pausedRemaining = remaining();
    state.resumeStatus = state.status;
    state.entryRemaining = Math.max(0, state.entryDeadline - Date.now());
    state.mismatchRemaining = Math.max(0, (state.mismatchDeadline || 0) - Date.now());
    state.status = 'paused';
    cancelTimers();
    publish();
    return true;
  }
  function resume() {
    if (state?.status !== 'paused') return;
    state.status = state.resumeStatus;
    if (state.status === 'entering') {
      state.entryDeadline = Date.now() + state.entryRemaining;
      entrance = schedule(activate, state.entryRemaining);
      publish();
    } else {
      state.deadline = Date.now() + state.pausedRemaining;
      if (state.locked) {
        state.mismatchDeadline = Date.now() + state.mismatchRemaining;
        mismatch = schedule(resolveMismatch, state.mismatchRemaining);
      }
      tick();
      publish();
    }
  }
  function stop() { cancelTimers(); if (state) state.status = 'idle'; }
  function finishEntrance() {
    if (state?.status === 'paused' && state.resumeStatus === 'entering') {
      state.entryRemaining = 0;
      return;
    }
    if (state?.status !== 'entering') return;
    clearTimeout(entrance);
    activate();
  }
  return { start, select, stop, pause, resume, finishEntrance, refresh: tick };
}
