import assert from 'node:assert/strict';
import { chromium, chromePath, releaseUrl } from './browser-runtime.mjs';

const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
page.on('pageerror', error => errors.push(error.message));
const state = () => page.evaluate(() => ({
  fullscreen: document.fullscreenElement === document.documentElement,
  deck: [...document.querySelectorAll('.card-front')].map(card => card.dataset.image),
  revealed: [...document.querySelectorAll('.memory-card')].map(card => card.className),
  moves: document.querySelector('#moves').textContent,
  time: document.querySelector('#time-left').textContent,
  scores: [...document.querySelectorAll('.player-score-points')].map(node => node.textContent),
}));
async function geometry() {
  const layout = await page.evaluate(() => {
    const main = document.querySelector('main').getBoundingClientRect();
    const visible = document.querySelector('.game-screen:not([hidden]), .result-screen:not([hidden]), .menu-leaderboard-screen:not([hidden]), .landing:not([hidden])');
    const screen = visible.getBoundingClientRect();
    return {
      width: innerWidth, height: innerHeight, mainWidth: main.width, mainHeight: main.height,
      screen: { left: screen.left, right: screen.right, top: screen.top, bottom: screen.bottom },
      cards: visible.matches('.game-screen') ? [...document.querySelectorAll('.memory-card')].map(card => {
        const box = card.getBoundingClientRect();
        return { width: box.width, height: box.height, left: box.left, right: box.right, top: box.top, bottom: box.bottom };
      }) : [],
    };
  });
  assert.ok(Math.abs(layout.mainWidth - layout.width) < 1);
  assert.ok(layout.mainHeight >= layout.height - 1);
  assert.ok(layout.screen.left >= 0 && layout.screen.right <= layout.width + 1);
  assert.ok(layout.screen.top >= 0 && layout.screen.bottom <= layout.height + 1);
  for (const card of layout.cards) {
    assert.ok(Math.abs(card.width / card.height - 0.9) < 0.001, 'card aspect ratio preserved');
    assert.ok(card.left >= 0 && card.right <= layout.width + 1 && card.top >= 0 && card.bottom <= layout.height + 1);
  }
  return layout;
}
async function toggle(screen) {
  const before = await state();
  const beforeLayout = await geometry();
  await page.keyboard.press('f');
  await page.waitForFunction(() => document.fullscreenElement === document.documentElement);
  assert.deepEqual(await state(), { ...before, fullscreen: true }, `${screen}: gameplay unchanged on entry`);
  await geometry();
  await page.keyboard.press('f');
  await page.waitForFunction(() => !document.fullscreenElement);
  assert.deepEqual(await state(), before, `${screen}: gameplay unchanged on exit`);
  assert.deepEqual(await geometry(), beforeLayout, `${screen}: layout restored`);
  console.log(`PASS: ${screen} fullscreen entry/exit, state and layout`);
}
try {
  await page.clock.install();
  await page.goto(releaseUrl);
  await page.clock.pauseAt(await page.evaluate(() => Date.now()));
  await page.locator('#player-name').fill('Fullscreen tester');
  await page.keyboard.press('f');
  assert.equal(await page.locator('#player-name').inputValue(), 'Fullscreen testerf');
  assert.equal((await state()).fullscreen, false);
  await page.locator('#player-name').fill('Fullscreen tester');
  await page.locator('.start-button').first().focus();
  for (const key of ['Control+f', 'Alt+f', 'Meta+f']) {
    await page.keyboard.press(key);
    assert.equal((await state()).fullscreen, false);
  }
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', repeat: true, bubbles: true })));
  assert.equal((await state()).fullscreen, false);
  await toggle('Start menu');
  await page.locator('.landing .start-button').click();
  await page.locator('.memory-card').first().click();
  await toggle('Solo gameplay with revealed card');
  await page.clock.runFor(59000);
  await page.keyboard.press('ArrowRight'); // Keep the expo idle dialog out of this screen check.
  await page.clock.runFor(1000);
  await page.locator('.result-screen').waitFor({ state: 'visible' });
  await toggle('Results');
  await page.locator('#new-player').click();
  await page.locator('#open-leaderboard').click();
  await toggle('Leaderboard');
  await page.locator('#leaderboard-back').click();
  await page.locator('[data-mode="multiplayer"]').click();
  await page.locator('#player-name').fill('One');
  await page.locator('#player-two-name').fill('Two');
  await page.keyboard.press('f');
  assert.equal((await state()).fullscreen, false);
  await page.locator('.landing .start-button').click();
  await toggle('Multiplayer gameplay');
  await page.setViewportSize({ width: 600, height: 900 });
  await toggle('Portrait multiplayer gameplay');
  await page.locator('#round-home').click();
  await toggle('Portrait start menu');
  // Exit through the browser API as an external exit, then verify the next F enters.
  await page.keyboard.press('f');
  await page.waitForFunction(() => !!document.fullscreenElement);
  await page.evaluate(() => document.exitFullscreen());
  await page.waitForFunction(() => !document.fullscreenElement);
  await toggle('After external fullscreen exit');
  await page.keyboard.press('f');
  await page.waitForFunction(() => !!document.fullscreenElement);
  await page.keyboard.press('Escape');
  await page.clock.runFor(100);
  if ((await state()).fullscreen) {
    console.log('NOTE: Headless Chrome does not perform the native Esc fullscreen exit; Esc is unhandled by the shortcut.');
    await page.evaluate(() => document.exitFullscreen());
  } else {
    console.log('PASS: Native Esc fullscreen exit');
    await toggle('After native Esc exit');
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
