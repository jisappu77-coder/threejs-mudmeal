import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
const page=await browser.newPage({viewport:{width:1280,height:720}});
page.on('pageerror',e=>console.log('ERROR',e.message));
await page.addInitScript(()=>{Object.defineProperty(window,'__REAL_MAP__',{configurable:true,set(app){app.renderer.setAnimationLoop=()=>{};Object.defineProperty(window,'__REAL_MAP__',{value:app,configurable:true});}})});
await page.goto('http://localhost:4173/real-map.html?location=kochi');
await page.waitForFunction(()=>window.__REAL_MAP__?.ready||window.__REAL_MAP_ERROR__,{},{timeout:240000});
console.log(await page.evaluate(()=>{const a=window.__REAL_MAP__;if(window.__REAL_MAP_ERROR__)throw Error(window.__REAL_MAP_ERROR__);a.reset();a.graphics.render();return {site:a.waterfront.site,stats:a.waterfront.stats,render:a.renderer.info.render,blocked:a.blocked(a.player.position.x,a.player.position.z,a.player.rotation.y)};}));
await mkdir('artifacts/real-map',{recursive:true});
await page.screenshot({path:'artifacts/real-map/refinement-street.png'});
await page.evaluate(()=>{document.querySelector('#camera-mode').value='elevated';document.querySelector('#camera-mode').dispatchEvent(new Event('change'));});
await page.screenshot({path:'artifacts/real-map/refinement-elevated.png'});
await page.evaluate(()=>{const a=window.__REAL_MAP__;const z=a.player.position.z-45,s=a.map.segments.find(s=>s.name==='Waterfront Road'&&s.a.z<=z&&s.b.z>=z),t=(z-s.a.z)/(s.b.z-s.a.z);a.player.position.set(s.a.x+(s.b.x-s.a.x)*t-2.5,.07,z);document.querySelector('#camera-mode').value='street';document.querySelector('#camera-mode').dispatchEvent(new Event('change'));});
await page.screenshot({path:'artifacts/real-map/refinement-church-street.png'});
const audit=await page.evaluate(()=>{const a=window.__REAL_MAP__;a.renderer.info.autoReset=false;a.renderer.info.reset();a.graphics.render();a.renderer.getContext().finish();return {render:a.renderer.info.render,promProps:a.waterfront.obstacles.filter(p=>p.kind==='bench'||p.kind==='promenade-planter').length,roadErrors:a.waterfront.obstacles.filter(p=>{const n=a.map.nearestRoad(p.x,p.z);return n.distance<n.segment.width/2+p.radius}).length,frontages:a.scenery.frontages.filter(f=>a.map.buildings.find(b=>b.id===f.buildingId)?.frontage)};});
assert.ok(audit.promProps>10&&audit.roadErrors===0);
console.log(audit);await writeFile('artifacts/real-map/refinement-audit.json',JSON.stringify(audit,null,2));
}finally{await browser.close();}
