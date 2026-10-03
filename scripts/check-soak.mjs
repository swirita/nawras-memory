import { chromium, chromePath, releaseUrl } from './browser-runtime.mjs';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ executablePath: chromePath, headless:true });
try {
  const page = await browser.newPage({reducedMotion:'reduce',viewport:{width:1440,height:900}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    window.resources={contexts:0,oscillators:0};
    const Context=window.AudioContext;
    window.AudioContext=class extends Context {
      constructor(){super(); resources.contexts++;}
      createOscillator(){ const node=super.createOscillator(); resources.oscillators++; node.addEventListener('ended',()=>resources.oscillators--); return node; }
    };
  });
  await page.clock.install();
  await page.goto(releaseUrl);
  await page.clock.pauseAt(await page.evaluate(()=>Date.now()));
  const cdp=await page.context().newCDPSession(page); await cdp.send('Performance.enable');
  const samples=[];
  for(let round=1;round<=100;round++){
    const multi=round%2===0;
    await page.locator(`[data-mode="${multi?'multiplayer':'solo'}"]`).click();
    await page.locator('#player-name').fill('Expo soak A');
    if(multi)await page.locator('#player-two-name').fill('Expo soak B');
    await page.getByRole('button',{name:'Start',exact:true}).click();
    const deck=await page.locator('.card-front').evaluateAll(nodes=>nodes.map(node=>node.dataset.image));
    for(const id of new Set(deck)){
      for(const index of deck.flatMap((value,index)=>value===id?[index]:[]))await page.locator('.memory-card').nth(index).click();
      await page.clock.runFor(220);
    }
    await page.clock.runFor(400);
    assert.equal(await page.locator('.result-screen').isVisible(),true);
    await page.getByRole('button',{name:multi?'Home':'NEW PLAYER',exact:true}).click();
    if([10,50,100].includes(round)){
      await page.waitForTimeout(600);
      await cdp.send('HeapProfiler.collectGarbage');
      const metrics=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
      samples.push({round,listeners:metrics.JSEventListeners,heapBytes:metrics.JSHeapUsedSize,
        ...await page.evaluate(()=>({...resources,domNodes:document.querySelectorAll('*').length,cards:document.querySelectorAll('.memory-card').length,confetti:document.querySelectorAll('.win-confetti').length,animations:document.getAnimations().length}))});
      console.log(JSON.stringify(samples.at(-1)));
    }
  }
  assert.deepEqual(errors,[]);
  assert.ok(samples.every(s=>s.contexts===1&&s.oscillators===0&&s.cards===0&&s.confetti===0));
  assert.ok(samples.every(s=>s.listeners===samples[0].listeners&&s.domNodes===samples[0].domNodes));
  console.log(JSON.stringify({browser:browser.version(),completedRounds:100,samples},null,2));
  await writeFile('.checks/release-soak.json',JSON.stringify({browser:browser.version(),completedRounds:100,samples},null,2));
}finally{await browser.close();}
