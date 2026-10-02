import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';

const output=process.env.CAPTURE_PUBLIC==='1'?'public/review/renders':'artifacts/prototypes';
await mkdir(output,{recursive:true});
const browser=await chromium.launch(process.env.HARDWARE_GL==='1'?{channel:'chromium',args:['--use-angle=gl']}:{});
const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
page.setDefaultTimeout(120000);
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
try {
  await page.goto((process.env.PREVIEW_URL||'http://localhost:4173/')+'review.html');
  await page.waitForFunction(()=>window.__ASSET_REVIEW__,null,{timeout:120000});
  const human=await page.evaluate(()=>{
    const a=window.__ASSET_REVIEW__;a.renderer.setAnimationLoop(null);
    const meshes=[];a.person.traverse(o=>{if(o.isMesh)meshes.push({name:o.name,textured:!!o.material.map,vertices:o.geometry.attributes.position.count})});
    // World-space bounds, including the baked metre conversion in the GLB.
    let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    a.person.updateMatrixWorld(true);
    a.person.traverse(o=>{if(!o.isMesh)return;o.geometry.computeBoundingBox();const b=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);for(let i=0;i<3;i++){const axis=['x','y','z'][i];min[i]=Math.min(min[i],b.min[axis]);max[i]=Math.max(max[i],b.max[axis])}});
    return {meshes,size:max.map((v,i)=>v-min[i]),triangles:a.renderer.info.render.triangles};
  });
  assert.equal(human.meshes.length,7);
  assert.ok(human.meshes.every(m=>m.textured));
  assert.ok(Math.abs(human.size[1]-1.75)<.01,'Human must be 1.75 metres tall');
  assert.ok(human.size[0]<.75,'Relaxed arms must remain beside torso');
  for(const view of ['person','face','front','back','hands','feet','auto','auto-front','side','auto-rear','cabin','pair','fleet',...['car','van','bus','bike'].flatMap(v=>[v,v+'-front',v+'-side',v+'-rear'])]) {
    await page.evaluate(view=>{const a=window.__ASSET_REVIEW__;a.setView(view)},view);
    await page.screenshot({path:`${output}/${view}.png`});
  }
  await page.locator('#vehicle-select').selectOption('van');
  await page.locator('#vehicle-angle').selectOption('side');
  assert.deepEqual(await page.evaluate(()=>{const a=window.__ASSET_REVIEW__;return Object.entries(a.vehicles).filter(([,m])=>m.visible).map(([name])=>name)}),['van']);
  assert.ok(await page.evaluate(()=>Math.abs(window.__ASSET_REVIEW__.camera.position.z)<.01),'Side control must change camera');
  await page.locator('#vehicle-select').selectOption('fleet');
  assert.ok(await page.evaluate(()=>Object.values(window.__ASSET_REVIEW__.vehicles).every(m=>m.visible)));
  await page.setViewportSize({width:900,height:500});
  await page.evaluate(()=>{const a=window.__ASSET_REVIEW__;a.setView('person')});
  assert.ok(await page.locator('nav').evaluate(n=>n.getBoundingClientRect().width<=innerWidth));
  assert.equal(await page.locator('[data-view="person"]').evaluate(b=>getComputedStyle(b).userSelect),'none');
  await page.screenshot({path:`${output}/mobile-landscape.png`});
  await page.evaluate(()=>window.__ASSET_REVIEW__.setView('auto'));
  await page.screenshot({path:`${output}/auto-mobile.png`});
  await page.evaluate(()=>window.__ASSET_REVIEW__.setView('bus'));
  await page.screenshot({path:`${output}/bus-mobile.png`});
  await page.evaluate(()=>window.__ASSET_REVIEW__.setView('fleet'));
  await page.screenshot({path:`${output}/fleet-mobile.png`});
  assert.deepEqual(errors,[]);
  console.log('Prototype Chromium checks passed:',JSON.stringify(human));
} finally {
  await browser.close();
}
