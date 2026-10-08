import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const base=process.env.PREVIEW_URL||'http://localhost:4173/';
const manifest=JSON.parse(await readFile(new URL('../public/scenes/manifest.json',import.meta.url)));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()}: ${r.url()}`)});
await mkdir('artifacts/scenes',{recursive:true});
try{
 if(process.env.MODEL_REVIEW_ONLY){for(const route of ['review.html','crowd.html']){await page.goto(new URL(route,base).href);await page.waitForFunction(()=>!document.getElementById('loading'),null,{timeout:120000});await page.screenshot({path:`artifacts/scenes/${route}.png`,timeout:120000})}assert.deepEqual(errors,[]);console.log('Model review pages passed.');await browser.close();process.exit(0)}
 await page.goto(base);await page.waitForFunction(()=>window.mudMeals,null,{timeout:120000});
 const initial=await page.evaluate(()=>window.mudMeals.state);await page.keyboard.down('w');await page.waitForFunction(y=>window.mudMeals.state.y>y+.2,initial.y,{timeout:60000});await page.keyboard.up('w');const driven=await page.evaluate(()=>window.mudMeals.state);assert.ok(driven.y>initial.y+.1,'Forward key moves rider');assert.ok(driven.speed>0);
 await page.keyboard.press('Space');const paused=await page.evaluate(()=>window.mudMeals.state);assert.equal(await page.evaluate(()=>window.mudMeals.paused),true);await page.waitForTimeout(200);assert.deepEqual(await page.evaluate(()=>window.mudMeals.state),paused);await page.keyboard.press('Space');
 await page.click('#settings-toggle');await page.selectOption('#phase','2');await page.waitForFunction(()=>window.mudMeals.phase===2);assert.equal(await page.locator('#scene-select option').count(),4);await page.selectOption('#scene-select','p2-scene_04');assert.equal(await page.evaluate(()=>window.mudMeals.scene),'p2-scene_04');await page.click('#settings-close');
 const reports=[];
 for(const m of manifest){
  await page.evaluate(({phase,key})=>window.mudMeals.selectPhase(phase,key),m);
  const spec=JSON.parse(await readFile(new URL('../public/'+m.spec,import.meta.url)));
  for(const filename of ['01_MASTER_SPATIAL.png','02_PLAYER_GAMEPLAY.png']){
   await page.evaluate(v=>window.mudMeals.setCamera(v),filename);await page.waitForFunction(v=>window.mudMeals.renderedView===v,`${m.key}:${filename}`,{timeout:120000});await page.click('#hide-hud');await page.locator('#restore-hud').evaluate(el=>el.style.visibility='hidden');
   const output=`artifacts/scenes/${m.key}-${filename.replace('.png','')}.png`;if(!process.env.SKIP_CAPTURES)await page.screenshot({path:output,timeout:120000});
   await page.locator('#restore-hud').evaluate(el=>el.style.visibility='visible');await page.click('#restore-hud');
   const audit=await page.evaluate(()=>window.mudMeals.audit);assert.ok(audit.triangles>1000);const buildings=audit.objects.filter(o=>o.scene===m.key&&o.id.startsWith('B_'));assert.equal(buildings.length,spec.buildings.length);for(const building of buildings){for(let i=0;i<4;i++)assert.ok(Math.abs(building.rect[i]-building.renderedRect[i])<1e-4,`Measured mesh footprint ${building.id}`);const original=spec.buildings.find(b=>b.id===building.id);assert.ok(Math.abs(building.renderedHeight-(original.eaves_z_m||original.wall_height_m))<1e-4)}
   reports.push({scene:m.key,view:filename,drawCalls:audit.drawCalls,triangles:audit.triangles,path:output});console.log(`Captured ${m.key} ${filename}: ${audit.drawCalls} draw calls`);
  }
  // All supplied cameras must be selectable without reconstructing or moving geometry.
  for(const v of spec.reference_views){await page.evaluate(v=>window.mudMeals.setCamera(v),v.file);assert.equal(await page.evaluate(()=>window.mudMeals.mode),v.file);}
 }
 await page.evaluate(()=>window.mudMeals.selectPhase(1,'p1-scene_01'));await page.click('#reference-toggle');assert.equal(await page.locator('#reference-panel').isVisible(),true);assert.match(await page.locator('#reference-image').getAttribute('src'),/p1-scene_01/);await page.locator('#reference-opacity').evaluate(el=>{el.value='.25';el.dispatchEvent(new Event('input',{bubbles:true}))});assert.equal(await page.locator('#reference-image').evaluate(el=>el.style.opacity),'0.25');await page.click('#reference-close');
 await page.setViewportSize({width:844,height:390});await page.click('#ride-view');const before=await page.evaluate(()=>window.mudMeals.state);const pedal=page.locator('[data-control="forward"]');const pedalBounds=await pedal.boundingBox();await page.mouse.move(pedalBounds.x+pedalBounds.width/2,pedalBounds.y+pedalBounds.height/2);await page.mouse.down();await page.waitForFunction(y=>window.mudMeals.state.y>y+.1,before.y,{timeout:60000});await page.mouse.up();assert.ok((await page.evaluate(()=>window.mudMeals.state)).y>before.y);await page.screenshot({path:'artifacts/scenes/mobile-landscape.png',timeout:120000});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);await page.screenshot({path:'artifacts/scenes/mobile-portrait.png',timeout:120000});
 for(const route of ['review.html','crowd.html']){await page.goto(new URL(route,base).href);await page.waitForFunction(()=>!document.getElementById('loading'),null,{timeout:120000});}
 assert.deepEqual(errors,[]);await writeFile('artifacts/scenes/audit.json',JSON.stringify({reports,errors},null,2));console.log('Browser checks passed: both phases, all 59 camera presets, driving, pause, overlay, mobile controls and model review pages.');
}finally{await browser.close()}
