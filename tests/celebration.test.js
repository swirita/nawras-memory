import test from 'node:test';
import assert from 'node:assert/strict';
import { createWinCelebration } from '../src/celebration.js';

function check(reduced, run) {
  let now = 0;
  let id = 0;
  const callbacks = new Map();
  const originals = [Date.now, globalThis.setTimeout, globalThis.clearTimeout, globalThis.document];
  Date.now = () => now;
  globalThis.setTimeout = (fn, delay) => { callbacks.set(++id, { fn, at: now + delay }); return id; };
  globalThis.clearTimeout = id => callbacks.delete(id);
  function node() {
    const classes = new Set();
    return { classList: { add: (...names) => names.forEach(n => classes.add(n)), remove: (...names) => names.forEach(n => classes.delete(n)), contains: name => classes.has(name) }, style: {}, setAttribute() {}, append() {}, remove() {} };
  }
  globalThis.document = { createElement: node };
  const board = node(), screen = node();
  const results = [], sounds = [];
  const sequence = createWinCelebration({ board, screen, durationMs: 1800, reducedMotion: { matches: reduced }, onSound: sound => sounds.push(sound), onResult: value => results.push(value) });
  function advance(ms) {
    const target = now + ms;
    while (true) {
      const pending = [...callbacks].sort((a, b) => a[1].at - b[1].at)[0];
      if (!pending || pending[1].at > target) break;
      now = pending[1].at; callbacks.delete(pending[0]); pending[1].fn();
    }
    now = target;
  }
  try { run({ sequence, board, screen, results, sounds, advance, callbacks }); }
  finally { sequence.cancel(); [Date.now, globalThis.setTimeout, globalThis.clearTimeout, globalThis.document] = originals; }
}

test('let the flip finish, celebrate stationary cards, then open results at 1.8s', () => check(false, r => {
  const result = { elapsedMs: 12345, moves: 7 };
  r.sequence.start(result, 220);
  r.advance(219); assert.deepEqual(r.sounds, []);
  r.advance(1); assert.deepEqual(r.sounds, ['won']);
  assert.equal(r.board.classList.contains('is-celebrating'), true);
  r.advance(1400); assert.equal(r.screen.classList.contains('is-leaving'), true);
  r.advance(179); assert.equal(r.results.length, 0);
  r.advance(1); assert.deepEqual(r.results, [result]);
  assert.equal(r.callbacks.size, 0);
}));

test('reset or leave invalidates even callbacks retained from an old win', () => check(false, r => {
  r.sequence.start({ moves: 7 }, 220);
  const stale = [...r.callbacks.values()];
  r.sequence.cancel();
  stale.forEach(callback => callback.fn()); r.advance(10000);
  assert.deepEqual(r.results, []); assert.deepEqual(r.sounds, []);
  assert.equal(r.board.classList.contains('is-celebrating'), false);
}));

test('reset confirmation pauses the celebration and cancel resumes it once', () => check(false, r => {
  r.sequence.start({ moves: 7 }, 220);
  r.advance(500); assert.equal(r.sequence.pause(), true);
  r.advance(60000); assert.equal(r.results.length, 0);
  r.sequence.resume(); r.advance(1299); assert.equal(r.results.length, 0);
  r.advance(1); assert.equal(r.results.length, 1);
  assert.deepEqual(r.sounds, ['won']);
}));

test('reduced motion uses a brief static highlight', () => check(true, r => {
  r.sequence.start({}, 0); r.advance(0);
  assert.equal(r.board.classList.contains('is-celebrating'), true);
  r.advance(399); assert.equal(r.results.length, 0);
  assert.equal(r.screen.classList.contains('is-leaving'), false);
  r.advance(1); assert.equal(r.results.length, 1);
}));
