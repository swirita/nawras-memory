import test from 'node:test';
import assert from 'node:assert/strict';
import { createExpoIdle } from '../src/idle.js';

function checkIdle(check) {
  const original = { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
  let now = 0, nextId = 0, home = false, expired = 0, dismissed = 0;
  const pending = new Map(), countdown = [], target = new EventTarget();
  globalThis.setTimeout = (fn, delay) => { const id = ++nextId; pending.set(id, { fn, at: now + delay }); return id; };
  globalThis.clearTimeout = id => pending.delete(id);
  function advance(ms, delayed = false) {
    const end = now + ms;
    if (delayed) now = end;
    while (true) {
      const entry = [...pending].sort((a, b) => a[1].at - b[1].at)[0];
      if (!entry || entry[1].at > end) break;
      pending.delete(entry[0]);
      if (!delayed) now = entry[1].at;
      entry[1].fn();
    }
    now = end;
    assert.ok(pending.size <= 1, 'only one idle/countdown callback');
  }
  const idle = createExpoIdle({ target, now: () => now, canShowCountdown: () => !home,
    isUserEvent: () => true,
    onCountdown: n => countdown.push(n), onDismiss: () => dismissed++,
    onExpire: () => { expired++; home = true; idle.navigate(); } });
  const event = type => { const e = new Event(type, { cancelable: true }); target.dispatchEvent(e); return e; };
  try { check({ idle, advance, countdown, event, target, pending, setHome: value => { home = value; }, get expired() { return expired; }, get dismissed() { return dismissed; } }); }
  finally { idle.dispose(); globalThis.setTimeout = original.setTimeout; globalThis.clearTimeout = original.clearTimeout; }
}

test('expo warns at 60 seconds, counts 10 through 1, and returns Home at 70', () => checkIdle(r => {
  r.advance(59999); assert.deepEqual(r.countdown, []);
  r.advance(1); assert.deepEqual(r.countdown, [10]);
  r.advance(9000); assert.deepEqual(r.countdown, [10,9,8,7,6,5,4,3,2,1]);
  assert.equal(r.expired, 0);
  r.advance(1000); assert.equal(r.expired, 1); assert.equal(r.idle.isWarning(), false);
}));

test('start menu suppresses the countdown but clears stale setup at the deadline', () => checkIdle(r => {
  r.setHome(true); r.idle.navigate(); r.advance(70000);
  assert.deepEqual(r.countdown, []); assert.equal(r.expired, 1);
}));

test('automatic navigation and late timer delivery do not reset inactivity', () => checkIdle(r => {
  r.advance(59000); r.idle.navigate(); r.advance(1000);
  assert.equal(r.idle.isWarning(), true);
  r.idle.navigate(); r.advance(10000);
  assert.equal(r.expired, 1);
}));

test('a suspended timer delivered past 70 seconds returns directly to Home', () => checkIdle(r => {
  r.advance(75000, true); assert.equal(r.expired, 1); assert.deepEqual(r.countdown, []);
}));

test('countdown dismissal consumes pointer/touch compatibility events without clicking underneath', () => checkIdle(r => {
  let clicks = 0;
  r.target.addEventListener('click', () => clicks++);
  r.advance(60000);
  for (const type of ['pointerdown', 'touchstart', 'pointerup', 'touchend', 'mousedown', 'mouseup', 'click']) assert.equal(r.event(type).defaultPrevented, true);
  assert.equal(clicks, 0); assert.equal(r.idle.isWarning(), false);
  r.advance(1000); r.event('pointerdown'); r.event('click'); assert.equal(clicks, 1);
  r.advance(59999); assert.equal(r.idle.isWarning(), false);
  r.advance(1); assert.equal(r.idle.isWarning(), true);
}));

test('keyboard dismissal consumes the full key gesture and restarts the deadline', () => checkIdle(r => {
  r.advance(60000);
  assert.equal(r.event('keydown').defaultPrevented, true);
  assert.equal(r.event('keyup').defaultPrevented, true);
  r.advance(59999); assert.equal(r.idle.isWarning(), false);
  r.advance(1); assert.equal(r.idle.isWarning(), true);
}));

test('throttled pointer movement retains the exact last activity time and guards an immediate click', () => checkIdle(r => {
  r.advance(60000); r.event('pointermove');
  assert.equal(r.idle.isWarning(), false);
  assert.equal(r.event('pointerdown').defaultPrevented, true);
  assert.equal(r.event('click').defaultPrevented, true);
  r.advance(1000); r.event('pointermove');
  r.advance(100); r.event('pointermove');
  r.advance(59999); assert.equal(r.idle.isWarning(), false);
  r.advance(1); assert.equal(r.idle.isWarning(), true);
}));

test('navigation and disposal invalidate old callbacks and remove activity listeners', () => checkIdle(r => {
  const old = [...r.pending.values()].map(value => value.fn);
  r.idle.activity(); old.forEach(fn => fn()); assert.deepEqual(r.countdown, []);
  r.idle.dispose(); r.event('click'); r.advance(100000);
  assert.equal(r.pending.size, 0); assert.equal(r.expired, 0);
}));
