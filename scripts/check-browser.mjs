import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.setDefaultTimeout(120000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') console.error('Browser:', message.text()); });
try {
  const url = process.env.PREVIEW_URL || 'http://localhost:4173';
  for (let attempt = 0; attempt < 30; attempt++) {
    try { await fetch(url); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 1000)); }
  }
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__MUD_MEALS__ && !document.querySelector('#loading'), null, { timeout: 120000 });
  assert.equal(await page.evaluate(() => window.__MUD_MEALS__.renderer.getContext().isContextLost()), false);
  // Capture an existing rendered frame without flooding the CI software GPU.
  await page.evaluate(() => window.__MUD_MEALS__.renderer.setAnimationLoop(null));
  const touchUI=await page.locator('#accelerate').evaluate(button=>{const menu=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});button.dispatchEvent(menu);return {menuBlocked:menu.defaultPrevented,selection:getComputedStyle(button).userSelect}});
  assert.equal(touchUI.menuBlocked,true);
  assert.equal(touchUI.selection,'none');
  await page.locator('#pause').click();
  await page.screenshot({ path: 'artifacts/landscape.png' });
  await page.locator('#orders').click();
  await page.locator('#order-panel').waitFor({ state: 'visible' });
  await page.locator('#close-orders').click();
  await page.locator('#tools-toggle').click();
  await page.locator('#quality').click();
  assert.equal(await page.evaluate(() => window.__MUD_MEALS__.renderer.getPixelRatio()),1);
  await page.locator('#quality').click();
  const density=await page.evaluate(() => ({renderer:window.__MUD_MEALS__.renderer.getPixelRatio(),composer:window.__MUD_MEALS__.graphics.composer._pixelRatio}));
  assert.ok(density.renderer>=1.25);
  assert.equal(density.renderer,density.composer);
  await page.locator('#reference').click();
  await page.locator('#reference-panel img').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#reference-panel img').evaluate(img => img.complete && img.naturalWidth > 0), true);
  await page.locator('#close-reference').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#landscape-prompt').waitFor({ state: 'visible' });
  await page.screenshot({ path: 'artifacts/portrait.png' });
  await page.setViewportSize({ width: 932, height: 430 });
  await page.locator('#landscape-prompt').waitFor({ state: 'hidden' });
  // Catch stale inline canvas dimensions after rotation, browser zoom, and wide displays.
  for (const viewport of [{width:1536,height:691},{width:932,height:430},{width:390,height:844},{width:960,height:540}]) {
    await page.setViewportSize(viewport);
    await page.waitForFunction(() => {
      const stage=document.querySelector('#game-stage').getBoundingClientRect();
      const canvas=document.querySelector('#world').getBoundingClientRect();
      return Math.abs(stage.width-canvas.width)<1 && Math.abs(stage.height-canvas.height)<1;
    });
    const bounds=await page.evaluate(() => {
      const stage=document.querySelector('#game-stage').getBoundingClientRect();
      const canvas=document.querySelector('#world');
      return {width:stage.width,height:stage.height,inlineWidth:canvas.style.width,inlineHeight:canvas.style.height};
    });
    assert.ok(Math.abs(bounds.width/bounds.height-16/9)<0.01);
    assert.equal(bounds.inlineWidth,'');
    assert.equal(bounds.inlineHeight,'');
  }
  await page.evaluate(() => window.__MUD_MEALS__.graphics.render());
  await page.screenshot({path:'artifacts/resized-landscape.png'});

  assert.deepEqual(errors, []);
  console.log('Browser checks passed: WebGL, orders, reference assets, and landscape layout.');
} finally {
  console.log('Page errors:', errors);
  await page.screenshot({ path: 'artifacts/final-state.png', timeout: 5000 }).catch(error => console.log('Screenshot:', error.message));
  await browser.close();
}
