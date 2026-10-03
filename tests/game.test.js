import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryGame } from '../src/game.js';
import { gameConfig } from '../src/config.js';

test('multiplayer turn remains locked until cards finish flipping back; reset cancels that transition', () => roundCheck(r => {
  r.game.start({ mode: 'multiplayer', players: ['A', 'B'], startingPlayer: 0, turnTransitionMs: 220 });
  r.mismatch();
  r.advance(900);
  assert.equal(r.state.cards.filter(c => c.revealed).length, 0);
  assert.equal(r.state.activePlayer, 0);
  assert.equal(r.state.locked, true);
  r.game.select(0);
  assert.equal(r.state.selected.length, 0);
  r.advance(219);
  assert.equal(r.state.activePlayer, 0);
  r.advance(1);
  assert.equal(r.state.activePlayer, 1);
  assert.equal(r.state.locked, false);
  r.mismatch(); r.advance(900);
  const callbacks = [...r.callbacks.values()].map(value => value.fn);
  r.game.start({ mode: 'multiplayer', players: ['A', 'B'], startingPlayer: 0 });
  callbacks.forEach(fn => fn());
  assert.equal(r.state.activePlayer, 0);
  assert.equal(r.state.moves, 0);
  assert.equal(r.outcomes.length, 0);
}));

test('multiplayer awards one point, blocks rapid clicks, grants bonus turns, and has no time limit', () => roundCheck(r => {
  r.game.start({ mode: 'multiplayer', players: ['A', 'B'], startingPlayer: 1 });
  r.advance(120000);
  assert.equal(r.state.status, 'playing');
  r.indices('nawras').forEach(r.game.select);
  for (let i = 0; i < 12; i++) r.game.select(i);
  assert.deepEqual(r.state.scores, [0, 1]);
  assert.equal(r.state.moves, 1);
  assert.equal(r.state.activePlayer, 1);
  assert.equal(r.state.locked, true);
  r.advance(gameConfig.matchResolutionMs);
  assert.equal(r.state.locked, false);
  assert.equal(r.state.activePlayer, 1);
  r.indices('python').forEach(r.game.select);
  r.advance(gameConfig.matchResolutionMs);
  assert.deepEqual(r.state.scores, [0, 2]);
}));

test('multiplayer switches players only after the full mismatch delay; pause preserves the turn', () => roundCheck(r => {
  r.game.start({ mode: 'multiplayer', players: ['A', 'B'], startingPlayer: 0 });
  r.mismatch();
  r.advance(400);
  r.game.pause();
  r.advance(10000);
  assert.equal(r.state.activePlayer, 0);
  r.game.resume();
  r.advance(499);
  assert.equal(r.state.activePlayer, 0);
  assert.equal(r.state.cards.filter(c => c.revealed).length, 2);
  r.advance(1);
  assert.equal(r.state.activePlayer, 1);
  assert.equal(r.state.cards.filter(c => c.revealed).length, 0);
  assert.deepEqual(r.state.scores, [0, 0]);
}));

test('multiplayer supports all winning scores and a 3–3 draw', () => roundCheck(r => {
  for (const firstScore of [3, 4, 6]) {
    r.game.start({ mode: 'multiplayer', players: ['A', 'B'], startingPlayer: 0 });
    for (const pair of gameConfig.pairs.slice(0, firstScore)) {
      r.indices(pair.id).forEach(r.game.select);
      r.advance(gameConfig.matchResolutionMs);
    }
    if (firstScore < 6) {
      const remaining = r.state.cards.flatMap((c, i) => !c.matched ? [i] : []);
      r.game.select(remaining[0]);
      r.game.select(remaining.find(i => r.state.cards[i].id !== r.state.cards[remaining[0]].id));
      r.advance(gameConfig.mismatchRevealDelayMs);
      for (const pair of gameConfig.pairs.slice(firstScore)) {
        r.indices(pair.id).forEach(r.game.select);
        r.advance(gameConfig.matchResolutionMs);
      }
    }
    const result = r.outcomes.at(-1);
    assert.deepEqual(result.scores, [firstScore, 6 - firstScore]);
    assert.equal(result.winner, firstScore === 3 ? null : 0);
    assert.equal(r.callbacks.size, 0);
  }
  // Give player B the first pair, then switch and let A take the other five.
  r.game.start({ mode: 'multiplayer', players: ['A', 'B'], startingPlayer: 1 });
  r.indices('nawras').forEach(r.game.select); r.advance(gameConfig.matchResolutionMs);
  const remaining = r.state.cards.flatMap((c, i) => !c.matched ? [i] : []);
  r.game.select(remaining[0]);
  r.game.select(remaining.find(i => r.state.cards[i].id !== r.state.cards[remaining[0]].id));
  r.advance(gameConfig.mismatchRevealDelayMs);
  for (const pair of gameConfig.pairs.slice(1)) { r.indices(pair.id).forEach(r.game.select); r.advance(gameConfig.matchResolutionMs); }
  assert.deepEqual(r.outcomes.at(-1).scores, [5, 1]);
}));

test('multiplayer reset and mode changes invalidate retained callbacks and clear round state', () => roundCheck(r => {
  r.game.start({ mode: 'multiplayer', players: ['A', 'B'], startingPlayer: 0 });
  r.mismatch();
  const stale = [...r.callbacks.values()].map(value => value.fn);
  r.game.pause();
  r.game.start({ mode: 'multiplayer', players: ['A', 'B'], startingPlayer: 1 });
  stale.forEach(fn => fn());
  assert.equal(r.state.activePlayer, 1);
  assert.deepEqual(r.state.scores, [0, 0]);
  assert.equal(r.state.moves, 0);
  assert.equal(r.state.cards.filter(c => c.revealed).length, 0);
  r.mismatch();
  const old = [...r.callbacks.values()].map(value => value.fn);
  r.game.stop(); r.game.start(); old.forEach(fn => fn());
  assert.equal(r.state.mode, 'solo');
  assert.equal(r.state.remainingSeconds, 60);
  assert.equal(r.outcomes.length, 0);
}));

test('multiplayer chooses a random starter and accepts the alternate starter for rematches', () => roundCheck(r => {
  const before = r.randomCalls();
  r.game.start({ mode: 'multiplayer', players: ['A', 'B'] });
  assert.equal(r.randomCalls() - before, 12);
  const first = r.state.startingPlayer;
  assert.ok(first === 0 || first === 1);
  r.game.start({ mode: 'multiplayer', players: ['A', 'B'], startingPlayer: 1 - first });
  assert.equal(r.state.activePlayer, 1 - first);
  assert.deepEqual(r.state.scores, [0, 0]);
}));

// A deterministic scheduler verifies boundary timing without waiting a minute.
function roundCheck(check) {
  const original = { now: Date.now, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, random: Math.random };
  let now = 100000;
  let nextId = 0;
  const callbacks = new Map();
  Date.now = () => now;
  globalThis.setTimeout = (fn, delay) => { const id = ++nextId; callbacks.set(id, { fn, at: now + delay }); return id; };
  globalThis.clearTimeout = id => callbacks.delete(id);
  let randomCalls = 0;
  Math.random = () => { randomCalls++; return (randomCalls % 11) / 11; };
  function advance(ms, delayed = false) {
    const target = now + ms;
    if (delayed) now = target;
    while (true) {
      const pending = [...callbacks].sort((a, b) => a[1].at - b[1].at)[0];
      if (!pending || pending[1].at > target) break;
      if (!delayed) now = pending[1].at;
      callbacks.delete(pending[0]);
      pending[1].fn();
    }
    now = target;
  }
  let state;
  const outcomes = [];
  const sounds = [];
  const game = createMemoryGame(gameConfig, value => { state = value; }, value => outcomes.push(value), value => sounds.push(value));
  const indices = id => state.cards.flatMap((card, i) => card.id === id ? [i] : []);
  const mismatch = () => { game.select(0); game.select(state.cards.findIndex(c => c.id !== state.cards[0].id)); };
  try {
    game.start();
    check({ game, get state() { return state; }, outcomes, sounds, advance, indices, mismatch, callbacks, randomCalls: () => randomCalls });
  } finally {
    game.stop();
    Date.now = original.now;
    globalThis.setTimeout = original.setTimeout;
    globalThis.clearTimeout = original.clearTimeout;
    Math.random = original.random;
  }
}

test('configured deck, Fisher–Yates, valid matches and ignored selections', () => roundCheck(r => {
  assert.equal(r.state.cards.length, 12);
  assert.equal(r.randomCalls(), 11);
  for (const pair of gameConfig.pairs) assert.equal(r.indices(pair.id).length, 2);
  const [a, b] = r.indices('nawras');
  r.game.select(-1); r.game.select(20); r.game.select(a); r.game.select(a);
  assert.equal(r.state.moves, 0);
  r.game.select(b);
  assert.equal(r.state.moves, 1);
  assert.equal(r.state.pairsFound, 1);
  assert.equal(r.state.cards[a].matched, true);
  r.game.select(a); r.game.select(b);
  assert.equal(r.state.moves, 1);
}));

test('mismatch lasts exactly 900ms and blocks all extra selections', () => roundCheck(r => {
  r.mismatch();
  for (let i = 0; i < 12; i++) r.game.select(i);
  assert.equal(r.state.moves, 1);
  assert.equal(r.state.cards.filter(c => c.revealed).length, 2);
  r.advance(899);
  assert.equal(r.state.locked, true);
  r.advance(1);
  assert.equal(r.state.locked, false);
  assert.equal(r.state.cards.filter(c => c.revealed).length, 0);
}));

test('win ends immediately, preserves card positions and cancels timers', () => roundCheck(r => {
  const positions = r.state.cards.map(c => c.key);
  r.advance(2500);
  for (const pair of gameConfig.pairs) r.indices(pair.id).forEach(r.game.select);
  assert.equal(r.outcomes.length, 1);
  assert.equal(r.outcomes[0].status, 'won');
  assert.equal(r.outcomes[0].elapsedSeconds, 2.5);
  assert.equal(r.outcomes[0].elapsedMs, 2500);
  const timeAtWin = r.state.remainingSeconds;
  assert.equal(r.outcomes[0].moves, 6);
  assert.deepEqual(r.state.cards.map(c => c.key), positions);
  assert.equal(r.callbacks.size, 0);
  r.game.select(0); r.advance(61000);
  r.game.refresh();
  assert.equal(r.state.remainingSeconds, timeAtWin);
  assert.equal(r.state.elapsedMs, 2500);
  assert.equal(r.outcomes.length, 1);
}));

test('expiry during mismatch disables play and cancels the flip callback', () => roundCheck(r => {
  r.advance(59500); r.mismatch(); r.advance(500);
  assert.equal(r.outcomes[0].status, 'expired');
  assert.equal(r.outcomes[0].elapsedSeconds, 60);
  assert.equal(r.state.remainingSeconds, 0);
  assert.equal(r.callbacks.size, 0);
  r.game.select(3); r.advance(900);
  assert.equal(r.state.moves, 1);
  assert.equal(r.state.cards.filter(c => c.revealed).length, 2);
}));

test('late timer delivery and deadline boundary cannot award a late match', () => roundCheck(r => {
  const [a, b] = r.indices('nawras');
  r.game.select(a);
  r.advance(60000, true);
  r.game.select(b);
  assert.equal(r.outcomes[0].status, 'expired');
  assert.equal(r.state.pairsFound, 0);
  assert.equal(r.state.moves, 0);
}));

test('restart and leaving cancel old timers and reset every round', () => roundCheck(r => {
  for (let round = 0; round < 4; round++) {
    r.mismatch(); r.advance(400); r.game.start();
    assert.equal(r.state.moves, 0);
    assert.equal(r.state.pairsFound, 0);
    assert.equal(r.state.remainingSeconds, 60);
    assert.equal(r.state.cards.filter(c => c.revealed).length, 0);
    assert.equal(r.callbacks.size, 1);
    r.advance(600);
    assert.equal(r.state.cards.filter(c => c.revealed).length, 0);
  }
  r.mismatch(); r.game.stop();
  assert.equal(r.callbacks.size, 0);
  r.advance(61000);
  assert.equal(r.outcomes.length, 0);
}));

test('entrance blocks selection and starts a full countdown at 660ms', () => roundCheck(r => {
  r.game.start({ entryDurationMs: gameConfig.entryDurationMs });
  r.advance(659); r.game.select(0);
  assert.equal(r.state.status, 'entering');
  assert.equal(r.state.remainingSeconds, 60);
  assert.equal(r.state.cards.filter(c => c.revealed).length, 0);
  assert.deepEqual(r.sounds, []);
  r.advance(1);
  assert.equal(r.state.status, 'playing');
  assert.equal(r.state.remainingSeconds, 60);
  r.advance(1000);
  assert.equal(r.state.remainingSeconds, 59);
}));

test('cancel preserves time and the exact remaining mismatch delay', () => roundCheck(r => {
  r.mismatch(); r.advance(350);
  assert.equal(r.game.pause(), true);
  const remaining = r.state.remainingSeconds;
  const deck = r.state.cards.map(c => c.key);
  const sounds = [...r.sounds];
  r.advance(10000); r.game.select(3); r.game.refresh();
  assert.equal(r.state.status, 'paused');
  assert.equal(r.state.remainingSeconds, remaining);
  assert.equal(r.callbacks.size, 0);
  assert.deepEqual(r.sounds, sounds);
  r.game.resume();
  assert.equal(r.state.remainingSeconds, remaining);
  assert.deepEqual(r.state.cards.map(c => c.key), deck);
  r.advance(549); assert.equal(r.state.locked, true);
  r.advance(1); assert.equal(r.state.locked, false);
  assert.equal(r.state.cards.filter(c => c.revealed).length, 0);
}));

test('elapsed result excludes paused time', () => roundCheck(r => {
  r.advance(2000); r.game.pause(); r.advance(120000); r.game.resume();
  for (const pair of gameConfig.pairs) r.indices(pair.id).forEach(r.game.select);
  assert.equal(r.outcomes[0].elapsedSeconds, 2);
  assert.equal(r.outcomes[0].status, 'won');
}));

test('reset while paused cancels old mismatch and entrance callbacks', () => roundCheck(r => {
  for (let round = 0; round < 5; round++) {
    r.mismatch(); r.advance(100);
    const staleCallbacks = [...r.callbacks.values()];
    r.game.pause();
    r.game.start({ entryDurationMs: 660 });
    staleCallbacks.forEach(callback => callback.fn());
    r.advance(200); r.game.pause(); r.advance(3000); r.game.resume();
    r.advance(459); assert.equal(r.state.status, 'entering');
    r.advance(1); assert.equal(r.state.status, 'playing');
    r.advance(900);
    assert.equal(r.state.moves, 0);
    assert.equal(r.state.pairsFound, 0);
    assert.equal(r.state.cards.filter(c => c.revealed).length, 0);
    assert.equal(r.callbacks.size, 1);
  }
}));

test('only valid selections emit sounds and outcomes have distinct cues', () => roundCheck(r => {
  const [a, b] = r.indices('nawras');
  r.game.select(a); r.game.select(a); r.game.select(-1);
  assert.deepEqual(r.sounds, ['flip']);
  r.game.select(b); r.game.select(a);
  assert.deepEqual(r.sounds, ['flip', 'match']);
  r.game.start(); r.mismatch();
  for (let i = 0; i < 12; i++) r.game.select(i);
  assert.deepEqual(r.sounds.slice(-2), ['flip', 'mismatch']);
  r.advance(60000);
  assert.equal(r.sounds.at(-1), 'expired');
  r.game.start();
  for (const pair of gameConfig.pairs) r.indices(pair.id).forEach(r.game.select);
  assert.equal(r.sounds.at(-1), 'won');
}));
