import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { gameConfig } from '../src/config.js';

// Check public images used by dynamically constructed cards, as well as Vite URLs.
const images = new Set([gameConfig.brandImagePath, gameConfig.cardBackImagePath,
  ...gameConfig.pairs.map(pair => pair.imagePath)]);
for (const path of images) {
  assert.ok((await stat(`dist/${path}`)).size > 0, `Missing built image: ${path}`);
  assert.deepEqual(await readFile(`dist/${path}`), await readFile(`public/${path}`), `Changed image: ${path}`);
}
const html = await readFile('dist/index.html', 'utf8');
assert.ok(html.includes('<title>Nawras Memory</title>'));
assert.ok(html.includes('href="/nawras-memory/assets/branding/nawras-small.png"'));
const references = [...html.matchAll(/(?:src|href)="(\/nawras-memory\/[^"?#]+)"/g)].map(match => match[1]);
assert.ok(references.some(path => path.endsWith('.js')), 'Missing built script');
assert.ok(references.some(path => path.endsWith('.css')), 'Missing built styles');
for (const path of references) await stat(`dist/${path.slice('/nawras-memory/'.length)}`);
assert.ok(!html.includes('/src/main.js'), 'Unbuilt entry point');
const assets = await readdir('dist/assets');
assert.ok(assets.some(name => name.endsWith('.js')));
console.log(`Production entry points and ${images.size} unchanged images verified under /nawras-memory/.`);
