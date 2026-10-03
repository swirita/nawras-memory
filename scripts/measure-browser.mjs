import { chromium, chromePath, releaseUrl } from './browser-runtime.mjs';
import { writeFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const label = process.argv[2] || 'after';
if (!/^[a-z0-9-]+$/i.test(label)) throw new Error('Measurement label must contain only letters, numbers or hyphens.');
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
await page.addInitScript(() => {
  window.audit = { circles: 0, mutations: 0, timerCalls: 0, activeTimers: new Set(), contexts: 0, oscillators: 0 };
  const create = document.createElementNS.bind(document);
  document.createElementNS = (...args) => { if (args[1] === 'circle') audit.circles++; return create(...args); };
  const nativeTimeout = window.setTimeout.bind(window), nativeClear = window.clearTimeout.bind(window);
  window.setTimeout = (fn, delay, ...args) => {
    const id = nativeTimeout(() => { audit.activeTimers.delete(id); audit.timerCalls++; fn(...args); }, delay);
    audit.activeTimers.add(id); return id;
  };
  window.clearTimeout = id => { audit.activeTimers.delete(id); nativeClear(id); };
  const Context = window.AudioContext;
  window.AudioContext = class extends Context {
    constructor(...args) { super(...args); audit.contexts++; }
    createOscillator() {
      const osc = super.createOscillator(); audit.oscillators++;
      osc.addEventListener('ended', () => audit.oscillators--); return osc;
    }
  };
  const observer = new MutationObserver(records => { audit.mutations += records.length; });
  document.addEventListener('DOMContentLoaded', () => observer.observe(document.body, { subtree: true, childList: true, attributes: true }));
});
const cdp = await page.context().newCDPSession(page);
await cdp.send('Performance.enable');
const metrics = async () => {
  await cdp.send('HeapProfiler.collectGarbage');
  const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  const a = await page.evaluate(() => ({ ...audit, activeTimers: audit.activeTimers.size, particles: document.querySelectorAll('.landing-particle').length }));
  return { ...a, nodes: m.Nodes, listeners: m.JSEventListeners, heapBytes: m.JSHeapUsedSize, layoutCount: m.LayoutCount, scriptSeconds: m.ScriptDuration };
};
const reset = async () => page.evaluate(() => { audit.circles = audit.mutations = audit.timerCalls = 0; });
try {
  await page.goto(releaseUrl);
  await page.waitForTimeout(500);
  await reset();
  const start = await metrics();
  for (let i = 0; i < 20; i++) await page.locator('[data-mode]').nth(i % 2).click();
  const switching = await metrics();
  await page.locator('[data-mode="solo"]').click();
  await page.locator('#player-name').fill('Release test');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.waitForTimeout(300);
  await reset();
  const gameStart = await metrics();
  await page.waitForTimeout(5100);
  const gameIdle = await metrics();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.waitForTimeout(300);
  const firstHome = await metrics();
  for (let i = 0; i < 30; i++) {
    await page.locator('#player-name').fill('Release test');
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.locator('.memory-card').first().click();
    await page.getByRole('button', { name: 'Home', exact: true }).click();
  }
  await page.waitForTimeout(500);
  const repeatedHome = await metrics();
  const bytes = async dir => (await Promise.all((await readdir(dir, { withFileTypes: true })).map(async e => e.isDirectory() ? bytes(join(dir, e.name)) : (await stat(join(dir, e.name))).size))).reduce((a,b) => a+b,0);
  const result = { label, start, switching, gameStart, gameIdle, firstHome, repeatedHome, distBytes: await bytes('dist') };
  console.log(JSON.stringify(result, null, 2));
  await writeFile(`.checks/performance-${label}.json`, JSON.stringify(result, null, 2));
} finally { await browser.close(); }
