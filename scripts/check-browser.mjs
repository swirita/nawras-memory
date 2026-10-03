import { chromium, chromePath, releaseUrl } from './browser-runtime.mjs';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const url = releaseUrl;
const soloKey = 'nawras-memory.leaderboard.v1';
const multiKey = 'nawras-memory.multiplayer.leaderboard.v1';
const errors = [];
async function pageFor(reduced = true) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.addInitScript(() => {
    window.soundCheck = { contexts: 0, active: 0, notes: [], disconnected: 0, peak: 0 };
    const Context = window.AudioContext;
    window.AudioContext = class extends Context {
      constructor() {
        super(); soundCheck.contexts++;
        window.audioContext = this;
        window.analyser = this.createAnalyser();
        analyser.connect(this.destination);
      }
      createOscillator() {
        const oscillator = super.createOscillator();
        const start = oscillator.start.bind(oscillator);
        oscillator.start = at => { soundCheck.notes.push(oscillator.frequency.value); soundCheck.active++; start(at); };
        oscillator.addEventListener('ended', () => soundCheck.active--);
        const disconnect = oscillator.disconnect.bind(oscillator);
        oscillator.disconnect = () => { soundCheck.disconnected++; disconnect(); };
        return oscillator;
      }
      createGain() {
        const gain = super.createGain();
        const connect = gain.connect.bind(gain);
        gain.connect = destination => connect(destination === this.destination ? analyser : destination);
        return gain;
      }
    };
  });
  await page.clock.install();
  await page.goto(url);
  await page.clock.pauseAt(await page.evaluate(() => Date.now()));
  return page;
}
const stored = (p, key) => p.evaluate(key => JSON.parse(localStorage.getItem(key) || '[]'), key);
const deckOf = p => p.locator('.card-front').evaluateAll(nodes => nodes.map(node => node.dataset.image));
const active = p => p.locator('.player-score.is-active').getAttribute('data-player').then(Number);
const click = (p, index) => p.locator('.memory-card').nth(index).click();
async function start(p, multi = false, reduced = true) {
  const choice = p.locator(`[data-mode="${multi ? 'multiplayer' : 'solo'}"]`);
  if (await choice.getAttribute('aria-pressed') !== 'true') {
    await choice.click();
    if (!reduced) await p.clock.runFor(250);
  }
  await p.locator('#player-name').fill('  Release A  ');
  if (multi) await p.locator('#player-two-name').fill('Release B');
  await p.getByRole('button', { name: 'Start', exact: true }).click();
  if (!reduced) await p.clock.runFor(660);
}
async function match(p, deck, id) {
  for (const index of deck.flatMap((value, index) => value === id ? [index] : [])) await click(p, index);
  await p.clock.runFor(220);
}
async function miss(p, deck, ids) {
  await click(p, deck.indexOf(ids[0])); await click(p, deck.indexOf(ids[1]));
}
try {
  const p = await pageFor();
  await p.evaluate(({soloKey,multiKey}) => {
    localStorage.setItem(soloKey, JSON.stringify([
      { name: 'Tie A', elapsedMs: 1230, moves: 6 }, { name: 'Tie B', elapsedMs: 1230, moves: 6 },
      ...Array.from({length:6}, (_,i) => ({name:`Seed ${i}`, elapsedMs:2000+i*1000,moves:6})),
      { name:'Legacy', elapsedMs:10000 }, { name:'Invalid', elapsedMs:-1, moves:6 },
    ]));
    localStorage.setItem(multiKey, JSON.stringify([{ name:'Multi A',score:6 }, { name:'Multi B',score:6 }, { name:'Draw ineligible',score:3 }]));
  }, {soloKey,multiKey});
  await p.reload(); await p.clock.pauseAt(await p.evaluate(() => Date.now()));
  await start(p);
  let deck = await deckOf(p);
  await p.clock.runFor(1230);
  // All rapid valid matches freeze the score on the final selection.
  for (const id of new Set(deck)) for (const index of deck.flatMap((value,index)=>value===id?[index]:[])) await click(p,index);
  assert.equal((await stored(p, soloKey)).some(record=>record.name==='Release A'),false);
  await p.clock.runFor(400);
  assert.equal(await p.locator('#result-number').innerText(),'1.23');
  assert.equal(await p.locator('#result-moves').innerText(),'6');
  assert.equal(await p.locator('.result-screen .leaderboard-row').count(),10);
  assert.deepEqual((await p.locator('.result-screen .leaderboard-rank').allTextContents()).slice(0,5),['1','1','1','4','5']);
  const savedSolo = await stored(p,soloKey);
  assert.ok(savedSolo.some(record=>record.name==='Release A' && record.elapsedMs===1230 && record.moves===6));
  await p.reload(); await p.clock.pauseAt(await p.evaluate(() => Date.now()));
  await p.getByRole('button',{name:'Leaderboard',exact:true}).click();
  assert.equal(await p.locator('.menu-leaderboard-screen .leaderboard-row').count(),10);
  await p.getByRole('tab',{name:'2 Players',exact:true}).click();
  assert.equal(await p.locator('.menu-leaderboard-screen .leaderboard-row').count(),2);
  await p.getByRole('button',{name:'Back',exact:true}).click();
  await start(p,true);
  deck = await deckOf(p);
  let ids = [...new Set(deck)];
  const starter = await active(p);
  await miss(p,deck,ids);
  await p.locator('.memory-card').evaluateAll(nodes=>nodes.forEach(node=>node.click()));
  assert.equal(await p.locator('.is-revealed').count(),2);
  await p.clock.runFor(899); assert.equal(await active(p),starter);
  await p.clock.runFor(1); assert.equal(await active(p),1-starter);
  for (const id of ids) await match(p,deck,id);
  await p.clock.runFor(400);
  const winner = starter===0 ? 'Release B' : 'Release A';
  assert.equal(await p.locator('#result-title').innerText(),`${winner} wins!`);
  const savedMulti = await stored(p,multiKey);
  assert.ok(savedMulti.some(record=>record.name===winner && record.score===6));
  assert.deepEqual(await stored(p,soloKey),savedSolo);
  await p.getByRole('button',{name:'Rematch',exact:true}).click();
  assert.equal(await active(p),1-starter);
  deck=await deckOf(p); ids=[...new Set(deck)];
  for (const id of ids.slice(0,3)) await match(p,deck,id);
  await miss(p,deck,ids.slice(3)); await p.clock.runFor(900);
  for (const id of ids.slice(3)) await match(p,deck,id);
  await p.clock.runFor(400);
  assert.equal(await p.locator('#result-title').innerText(),'It’s a draw!');
  assert.deepEqual(await p.locator('.final-player strong').allTextContents(),['3','3']);
  assert.deepEqual(await stored(p,multiKey),savedMulti);
  await p.getByRole('button',{name:'Rematch',exact:true}).click();
  deck=await deckOf(p); ids=[...new Set(deck)];
  await miss(p,deck,ids); await p.clock.runFor(300);
  await p.getByRole('button',{name:'Reset Game',exact:true}).click();
  await p.clock.runFor(2000);
  await p.getByRole('button',{name:'Cancel',exact:true}).click();
  await p.clock.runFor(599); assert.equal(await p.locator('.is-revealed').count(),2);
  await p.clock.runFor(1); assert.equal(await p.locator('.is-revealed').count(),0);
  await p.getByRole('button',{name:'Reset Game',exact:true}).click();
  await p.getByRole('button',{name:'Reset',exact:true}).click();
  assert.deepEqual(await p.locator('.player-score-points').allTextContents(),['0','0']);
  deck=await deckOf(p);
  for (const id of new Set(deck)) await match(p,deck,id);
  await p.getByRole('button',{name:'Reset Game',exact:true}).click();
  await p.getByRole('button',{name:'Reset',exact:true}).click();
  await p.clock.runFor(1000);
  assert.deepEqual(await stored(p,multiKey),savedMulti);
  await p.getByRole('button',{name:'Home',exact:true}).click();
  await start(p);
  await p.clock.runFor(60000);
  assert.equal(await p.locator('#result-title').innerText(),'TIME’S UP!');
  assert.deepEqual(await stored(p,soloKey),savedSolo);
  await p.keyboard.press('Escape');
  await p.close();
  console.log('Solo precision, ties, legacy eligibility, top 5/full home lists, refresh persistence, multiplayer bonus turns, winner-only scores, draws, rematch starter, rapid clicks, reset pause/cancel, reset during celebration and abandoned-score exclusion passed.');

  const animated = await pageFor(false);
  await start(animated,false,false);
  deck=await deckOf(animated);
  const rectangles=await animated.locator('.memory-card').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect(); return [r.x,r.y,r.width,r.height];}));
  await click(animated,0);
  // AudioContext uses real time, independently of the controlled game clock.
  await animated.waitForTimeout(25);
  const peak=await animated.evaluate(()=>{const wave=new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(wave); return Math.max(...wave.map(Math.abs));});
  assert.ok(peak>0,'Audio produces a nonzero signal');
  await click(animated,deck.findIndex(id=>id!==deck[0]));
  await animated.clock.runFor(900);
  for(const id of new Set(deck)) for(const index of deck.flatMap((value,index)=>value===id?[index]:[])) await click(animated,index);
  assert.equal(await animated.locator('.win-confetti').count(),0);
  await animated.clock.runFor(219); assert.equal(await animated.locator('.win-confetti').count(),0);
  await animated.clock.runFor(1); assert.equal(await animated.locator('.win-confetti i').count(),24);
  assert.deepEqual(await animated.locator('.memory-card').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect(); return [r.x,r.y,r.width,r.height];})),rectangles);
  await animated.screenshot({path:'.checks/release-celebration.png'});
  await animated.clock.runFor(1580);
  assert.equal(await animated.locator('.result-screen').isVisible(),true);
  await animated.waitForTimeout(600);
  const sounds=await animated.evaluate(()=>soundCheck);
  assert.equal(sounds.contexts,1); assert.equal(sounds.active,0);
  assert.ok([660,392,330,659,880,523,784].every(note=>sounds.notes.includes(note)));
  assert.equal(sounds.disconnected,sounds.notes.length);
  await animated.screenshot({path:'.checks/release-result.png'});
  await animated.getByRole('button',{name:'PLAY AGAIN',exact:true}).click();
  await animated.clock.runFor(660);
  await animated.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  await animated.clock.runFor(10000);
  assert.equal(await animated.locator('.landing').isVisible(),true);
  assert.equal(await animated.locator('.memory-card').count(),0);
  await animated.close();
  const silent = await browser.newPage({reducedMotion:'reduce'});
  silent.on('pageerror',error=>errors.push(error.message));
  await silent.addInitScript(()=>{window.AudioContext=undefined;window.webkitAudioContext=undefined;});
  await silent.goto(url);
  await silent.locator('#player-name').fill('No audio support');
  await silent.getByRole('button',{name:'Start',exact:true}).click();
  await silent.locator('.memory-card').first().click();
  assert.equal(await silent.locator('.is-revealed').count(),1);
  await silent.close();
  assert.deepEqual(errors,[]);
  console.log('Real 220ms flips, 24-piece confetti, exact 1.8s transition, fixed card geometry, audible signal, distinct tones, single AudioContext and completed-node cleanup passed; no browser or HTTP errors.');
} finally { await browser.close(); }
