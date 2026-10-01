import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

await mkdir('artifacts/prototypes',{recursive:true});
const url=(process.env.PREVIEW_URL||'http://localhost:4173/')+'review.html';
// Reproduce the reported browser-level failure, before any model is requested.
const browser=await chromium.launch({args:['--disable-webgl']});
try {
  const page=await browser.newPage({viewport:{width:900,height:500}});
  const uncaught=[],assetRequests=[];
  page.on('pageerror',e=>uncaught.push(e.message));
  page.on('request',r=>{if(r.url().endsWith('customer.glb'))assetRequests.push(r.url())});
  await page.goto(url);
  await page.waitForFunction(()=>window.__ASSET_REVIEW_ERROR__);
  assert.equal(await page.evaluate(()=>window.__ASSET_REVIEW_ERROR__.kind),'webgl');
  assert.equal(await page.locator('#loading').getAttribute('role'),'alert');
  assert.match(await page.locator('#loading').innerText(),/graphics acceleration/);
  assert.equal(await page.locator('nav button:enabled').count(),0);
  assert.equal(await page.locator('#loading a').count(),2);
  assert.deepEqual(uncaught,[]);
  assert.deepEqual(assetRequests,[]);
  for(const link of await page.locator('#loading a').all()) {
    const response=await page.request.get(await link.getAttribute('href'));
    assert.equal(response.status(),200,'Saved render links must work without WebGL');
  }
  await page.screenshot({path:'artifacts/prototypes/webgl-disabled.png'});
  console.log('WebGL-disabled startup handled: clear recovery UI, working render links, no uncaught error.');
} finally {await browser.close()}
