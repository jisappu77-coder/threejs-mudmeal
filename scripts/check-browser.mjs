import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1536, height: 864 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  const url = process.env.PREVIEW_URL || 'http://localhost:4173';
  for (let attempt = 0; attempt < 30; attempt++) {
    try { await fetch(url); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 1000)); }
  }
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__MUD_MEALS__ && !document.querySelector('#loading'), { timeout: 120000 });
  assert.equal(await page.evaluate(() => window.__MUD_MEALS__.renderer.getContext().isContextLost()), false);
  await page.locator('#pause').click();
  await page.screenshot({ path: 'artifacts/landscape.png' });
  await page.locator('#orders').click();
  await page.locator('#order-panel').waitFor({ state: 'visible' });
  await page.locator('#close-orders').click();
  await page.locator('#tools-toggle').click();
  await page.locator('#reference').click();
  await page.locator('#reference-panel img').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#reference-panel img').evaluate(img => img.complete && img.naturalWidth > 0), true);
  await page.locator('#close-reference').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#landscape-prompt').waitFor({ state: 'visible' });
  await page.screenshot({ path: 'artifacts/portrait.png' });
  await page.setViewportSize({ width: 932, height: 430 });
  await page.locator('#landscape-prompt').waitFor({ state: 'hidden' });
  const stage = await page.locator('#game-stage').boundingBox();
  assert.ok(Math.abs(stage.width / stage.height - 16 / 9) < 0.01);
  assert.deepEqual(errors, []);
  console.log('Browser checks passed: WebGL, orders, reference assets, and landscape layout.');
} finally {
  await page.screenshot({ path: 'artifacts/final-state.png' }).catch(() => {});
  await browser.close();
}
