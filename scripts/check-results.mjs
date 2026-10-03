import assert from 'node:assert/strict';
import { chromium, chromePath, releaseUrl } from './browser-runtime.mjs';

const browser = await chromium.launch({ executablePath: chromePath, headless: true });
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
    for (const multi of [false, true]) {
      const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.install();
      await page.goto(releaseUrl);
      assert.equal(await page.title(), 'Nawras Memory');
      const favicon = await page.locator('link[rel="icon"]').getAttribute('href');
      assert.ok(favicon.endsWith('/assets/branding/nawras-small.png'));
      assert.equal((await page.request.get(new URL(favicon, releaseUrl).href)).status(), 200);
      await page.evaluate(() => {
        for (const mode of ['solo', 'multiplayer']) {
          const key = mode === 'solo' ? 'nawras-memory.leaderboard.v1' : 'nawras-memory.multiplayer.leaderboard.v1';
          localStorage.setItem(key, JSON.stringify(Array.from({ length: 40 }, (_, i) => ({
            id: `entry-${i}`, name: i === 20 || i === 30 ? 'Duplicate name' : `Player ${i}`,
            ...(mode === 'solo' ? { elapsedMs: 1000 + i * 1000, moves: 6 } : { score: i < 10 ? 6 : i < 18 ? 5 : 4 }),
          }))));
        }
      });
      await page.reload();
      await page.clock.pauseAt(await page.evaluate(() => Date.now()));
      await page.screenshot({ path: `.checks/title-${viewport.width}.png` });
      if (multi) await page.locator('[data-mode="multiplayer"]').click();
      await page.locator('#player-name').fill('Duplicate name');
      if (multi) await page.locator('#player-two-name').fill('Duplicate name');
      await page.getByRole('button', { name: 'Start', exact: true }).click();
      const deck = await page.locator('.card-front').evaluateAll(nodes => nodes.map(node => node.dataset.image));
      const pairs = [...new Set(deck)];
      if (!multi) await page.clock.runFor(26000);
      for (let i = 0; i < pairs.length; i++) {
        if (multi && i === 4) {
          await page.locator('.memory-card').nth(deck.indexOf(pairs[4])).click();
          await page.locator('.memory-card').nth(deck.indexOf(pairs[5])).click();
          await page.clock.runFor(900);
        }
        for (const index of deck.flatMap((value, index) => value === pairs[i] ? [index] : [])) {
          await page.locator('.memory-card').nth(index).click();
        }
        await page.clock.runFor(220);
      }
      await page.clock.runFor(400);
      const list = page.locator('.result-screen .leaderboard-list');
      assert.equal(await list.locator('.leaderboard-row').count(), 40);
      assert.equal(await list.locator('.is-current').count(), 1);
      assert.equal(await list.locator('.is-current').getAttribute('data-entry-id'), 'entry-20');
      assert.equal(await list.locator('.is-current .leaderboard-rank').innerText(), multi ? '19' : '21');
      const position = await list.evaluate(list => {
        const box = list.getBoundingClientRect(), row = list.querySelector('.is-current').getBoundingClientRect();
        return { scroll: list.scrollTop, centerDelta: Math.abs(row.top + row.height / 2 - box.top - list.clientHeight / 2), pageY: scrollY };
      });
      assert.ok(position.scroll > 0);
      assert.ok(position.centerDelta < 2);
      assert.equal(position.pageY, 0);
      assert.equal(await list.locator('.is-top-five').count(), multi ? 10 : 5);
      await page.screenshot({ path: `.checks/results-full-${viewport.width}-${multi ? 'multi' : 'solo'}.png`, fullPage: true });
      for (const end of [false, true]) {
        await list.evaluate((list, end) => { list.scrollTop = end ? list.scrollHeight : 0; }, end);
        const row = end ? list.locator('.leaderboard-row').last() : list.locator('.leaderboard-row').first();
        const bounds = await row.boundingBox(), frame = await list.boundingBox();
        assert.ok(bounds.y >= frame.y - 1 && bounds.y + bounds.height <= frame.y + frame.height + 1);
        assert.equal(await page.evaluate(() => scrollY), 0);
      }
      assert.deepEqual(errors, []);
      console.log(`${viewport.width}px ${multi ? 'multiplayer' : 'solo'}: full rankings, duplicate-name ID highlight, below-fifth centered entry and container-only scrolling passed.`);
      await page.close();
    }
  }
} finally { await browser.close(); }
