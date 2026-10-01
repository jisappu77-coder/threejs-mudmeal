import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('artifacts/prototypes',{recursive:true});const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{await page.goto((process.env.PREVIEW_URL||'http://localhost:4173/')+'review.html');await page.waitForFunction(()=>window.__ASSET_REVIEW__,null,{timeout:120000});await page.evaluate(()=>window.__ASSET_REVIEW__.renderer.setAnimationLoop(null));for(const view of['person','face','auto','side','pair']){await page.evaluate(view=>{const a=window.__ASSET_REVIEW__;a.setView(view);a.render()},view);await page.screenshot({path:'artifacts/prototypes/'+view+'.png'});}assert.deepEqual(errors,[]);console.log('Prototype Chromium renders passed; page errors:',JSON.stringify(errors));}finally{await browser.close();}
