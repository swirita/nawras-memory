import test from 'node:test';
import assert from 'node:assert/strict';
import { createFullscreenShortcut } from '../src/fullscreen.js';

function fixture() {
  const doc = new EventTarget();
  doc.fullscreenElement = null;
  doc.fullscreenEnabled = true;
  doc.documentElement = {};
  let requests = 0, exits = 0;
  doc.documentElement.requestFullscreen = () => { requests++; return Promise.resolve(); };
  doc.exitFullscreen = () => { exits++; return Promise.resolve(); };
  const controller = createFullscreenShortcut(doc);
  function key(props = {}, path = []) {
    const event = new Event('keydown', { cancelable: true });
    Object.assign(event, { key: 'f', ...props });
    event.composedPath = () => path;
    doc.dispatchEvent(event);
    return event;
  }
  function change(element) {
    doc.fullscreenElement = element;
    doc.dispatchEvent(new Event('fullscreenchange'));
  }
  return { doc, controller, key, change, get requests() { return requests; }, get exits() { return exits; } };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('F toggles using browser-confirmed state, including external/Esc exits', async () => {
  const r = fixture();
  assert.equal(r.key().defaultPrevented, true);
  assert.equal(r.requests, 1);
  assert.equal(r.controller.isFullscreen(), false, 'request does not optimistically change state');
  r.change(r.doc.documentElement);
  await settle();
  assert.equal(r.controller.isFullscreen(), true);
  r.key({ key: 'F' });
  assert.equal(r.exits, 1);
  await settle();
  const esc = r.key({ key: 'Escape' });
  assert.equal(esc.defaultPrevented, false);
  r.change(null);
  assert.equal(r.controller.isFullscreen(), false);
  r.key();
  assert.equal(r.requests, 2);
  r.controller.dispose();
});

test('typing, modifiers, repeats, composition and consumed events are ignored', () => {
  const r = fixture();
  for (const props of [{ key: 'x' }, { ctrlKey: true }, { altKey: true }, { metaKey: true }, { repeat: true }, { isComposing: true }]) {
    assert.equal(r.key(props).defaultPrevented, false);
  }
  for (const node of [{ isContentEditable: true }, { matches: () => true }]) {
    assert.equal(r.key({}, [{}, node]).defaultPrevented, false);
    r.doc.activeElement = node;
    assert.equal(r.key().defaultPrevented, false);
  }
  r.doc.activeElement = null;
  r.doc.designMode = 'on';
  assert.equal(r.key().defaultPrevented, false);
  r.doc.designMode = 'off';
  // A separately pre-consumed event mirrors a handler earlier in the event path.
  const event = new Event('keydown', { cancelable: true });
  event.key = 'f';
  event.preventDefault();
  r.doc.dispatchEvent(event);
  assert.equal(r.requests, 0);
  r.controller.dispose();
});

test('toggle reads the native property even before fullscreenchange arrives', async () => {
  const r = fixture();
  r.doc.fullscreenElement = r.doc.documentElement;
  r.key();
  assert.equal(r.exits, 1);
  await settle();
  r.change(r.doc.documentElement);
  r.doc.fullscreenElement = null;
  r.key();
  assert.equal(r.requests, 1);
  r.controller.dispose();
});

test('unsupported or disabled fullscreen is a no-op', () => {
  const r = fixture();
  r.doc.fullscreenEnabled = false;
  assert.equal(r.key().defaultPrevented, false);
  r.doc.fullscreenEnabled = true;
  r.doc.documentElement.requestFullscreen = undefined;
  assert.equal(r.key().defaultPrevented, false);
  r.change(r.doc.documentElement);
  r.doc.exitFullscreen = undefined;
  assert.equal(r.key().defaultPrevented, false);
  assert.equal(r.requests + r.exits, 0);
  r.controller.dispose();
});

test('rejections and synchronous failures allow retry without changing state', async () => {
  const r = fixture();
  for (const fail of [() => Promise.reject(new Error('Denied')), () => { throw new Error('Unavailable'); }]) {
    r.doc.documentElement.requestFullscreen = fail;
    r.key();
    await settle();
    assert.equal(r.controller.isFullscreen(), false);
  }
  let calls = 0;
  r.doc.documentElement.requestFullscreen = () => { calls++; return Promise.resolve(); };
  r.key();
  assert.equal(calls, 1);
  await settle();
  r.change(r.doc.documentElement);
  r.doc.exitFullscreen = () => Promise.reject(new Error('Denied exit'));
  r.key();
  await settle();
  assert.equal(r.controller.isFullscreen(), true);
  r.controller.dispose();
});

test('pending requests are serialized and disposal removes both listeners', async () => {
  const r = fixture();
  let resolve, calls = 0;
  r.doc.documentElement.requestFullscreen = () => { calls++; return new Promise(done => { resolve = done; }); };
  r.key(); r.key();
  assert.equal(calls, 1);
  r.controller.dispose(); r.controller.dispose();
  resolve();
  await settle();
  r.change(r.doc.documentElement);
  assert.equal(r.controller.isFullscreen(), false, 'fullscreenchange listener removed');
  assert.equal(r.key().defaultPrevented, false);
  assert.equal(calls, 1);
});
