import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from 'three';
import {calibrateWaterfront,normalize,canRide} from '../src/layout.js';
import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const base=process.env.PREVIEW_URL||'http://localhost:4173/';
const manifest=JSON.parse(await readFile(new URL('../public/scenes/manifest.json',import.meta.url))).filter(m=>!process.env.PHASE||m.phase===Number(process.env.PHASE));
const viewSizes=JSON.parse(await readFile(new URL('../public/scenes/view-sizes.json',import.meta.url)));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:844,height:390}}),errors=[];page.setDefaultTimeout(240000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()}: ${r.url()}`)});
await mkdir('artifacts/scenes',{recursive:true});
try{
 if(process.env.MODEL_REVIEW_ONLY){for(const route of ['review.html','crowd.html']){await page.goto(new URL(route,base).href);await page.waitForFunction(()=>!document.getElementById('loading'),null,{timeout:240000});await page.screenshot({path:`artifacts/scenes/${route}.png`,timeout:240000})}assert.deepEqual(errors,[]);console.log('Model review pages passed.');await browser.close();process.exit(0)}
 await page.goto(base);await page.waitForFunction(()=>window.mudMeals?.renderedView,null,{timeout:240000});console.log('Initial WebGL frame ready');
 if(!process.env.CAPTURES_ONLY){
 const initial=await page.evaluate(()=>window.mudMeals.state);await page.keyboard.down('w');await page.waitForFunction(y=>window.mudMeals.state.y>y+.2,initial.y,{timeout:180000}).catch(async error=>{console.error('Driving timeout diagnostics:',await page.evaluate(()=>({state:window.mudMeals.state,mode:window.mudMeals.mode,paused:window.mudMeals.paused,activeElement:document.activeElement.tagName})));throw error});await page.keyboard.up('w');const driven=await page.evaluate(()=>window.mudMeals.state);assert.ok(driven.y>initial.y+.1,'Forward key moves rider');assert.ok(driven.speed>0);console.log('Driving controls passed');
 await page.keyboard.press('Space');const paused=await page.evaluate(()=>window.mudMeals.state);assert.equal(await page.evaluate(()=>window.mudMeals.paused),true);await page.waitForTimeout(200);assert.deepEqual(await page.evaluate(()=>window.mudMeals.state),paused);await page.keyboard.press('Space');
 await page.click('#settings-toggle');const settingsPhase=Number(process.env.PHASE)||2;await page.selectOption('#phase',String(settingsPhase));await page.waitForFunction(id=>window.mudMeals.phase===id,settingsPhase);assert.equal(await page.locator('#scene-select option').count(),4);await page.selectOption('#scene-select',`p${settingsPhase}-scene_04`);assert.equal(await page.evaluate(()=>window.mudMeals.scene),`p${settingsPhase}-scene_04`);await page.click('#settings-close');
 console.log('Phase and scene controls passed');
 }
 const reports=[];let cameraCount=0,routeReport;
 for(const m of manifest){
  await page.evaluate(({phase,key})=>window.mudMeals.selectPhase(phase,key),m);
  const spec=normalize(calibrateWaterfront(JSON.parse(await readFile(new URL('../public/'+m.spec,import.meta.url)))),m.key);
  for(const filename of ['01_MASTER_SPATIAL.png','02_PLAYER_GAMEPLAY.png']){
   const [sourceWidth,sourceHeight]=viewSizes[m.key][filename],scale=Math.min(1,Number(process.env.CAPTURE_WIDTH||(filename.startsWith('01_')?process.env.MASTER_CAPTURE_WIDTH:undefined)||sourceWidth)/sourceWidth),width=Math.round(sourceWidth*scale),height=Math.round(sourceHeight*scale);await page.setViewportSize({width,height});
   await page.evaluate(v=>window.mudMeals.setCamera(v),filename);await page.waitForFunction(v=>window.mudMeals.renderedView===v,`${m.key}:${filename}`,{timeout:240000});await page.locator('#hide-hud').evaluate(el=>el.click());await page.locator('#restore-hud').evaluate(el=>el.style.visibility='hidden');
   const output=`artifacts/scenes/${m.key}-${filename.replace('.png','')}.png`;if(!process.env.SKIP_CAPTURES)await page.screenshot({path:output,timeout:240000});
   await page.locator('#restore-hud').evaluate(el=>el.style.visibility='visible');await page.locator('#restore-hud').evaluate(el=>el.click());
   const audit=await page.evaluate(()=>window.mudMeals.audit);assert.ok(audit.triangles>1000);const buildings=audit.objects.filter(o=>o.scene===m.key&&o.id.startsWith('B_'));assert.equal(buildings.length,spec.buildings.length);for(const building of buildings){for(let i=0;i<4;i++)assert.ok(Math.abs(building.rect[i]-building.renderedRect[i])<1e-4,`Measured mesh footprint ${building.id}`);const original=spec.buildings.find(b=>b.id===building.id);assert.ok(Math.abs(building.renderedHeight-(original.eaves_z_m||original.wall_height_m))<1e-4)}
   if(filename==='02_PLAYER_GAMEPLAY.png'){
    const calibration=await page.evaluate(()=>window.mudMeals.calibration),camera=new PerspectiveCamera(calibration.fov,width/height,.1,1500);camera.position.fromArray(calibration.camera);camera.lookAt(new Vector3(...calibration.target));camera.updateMatrixWorld();
    for(const part of['head','cargo','wheel']){const point=new Vector3(...calibration[part]).project(camera);assert.ok(Math.abs(point.x)<.98&&Math.abs(point.y)<.98&&point.z<1,`${m.key}: rider ${part} stays in frame`);}
   }
   reports.push({scene:m.key,view:filename,drawCalls:audit.drawCalls,triangles:audit.triangles,path:output});console.log(`Captured ${m.key} ${filename}: ${audit.drawCalls} draw calls`);
  }
  // Render every Phase 1 preset; selecting a menu option alone cannot detect a bad camera.
  cameraCount+=2;
  for(const v of spec.reference_views.filter(v=>!process.env.CAPTURES_ONLY&&!['01_MASTER_SPATIAL.png','02_PLAYER_GAMEPLAY.png'].includes(v.file))){
   await page.evaluate(file=>window.mudMeals.setCamera(file),v.file);
   if(process.env.PHASE==='1')await page.waitForFunction(key=>window.mudMeals.renderedView===key,`${m.key}:${v.file}`);
   assert.equal(await page.evaluate(()=>window.mudMeals.mode),v.file);cameraCount++;
  }
  console.log(`Camera views checked: ${cameraCount}`);
  if(process.env.PHASE==='1'&&!routeReport){
   const layouts=await Promise.all(manifest.map(async m=>normalize(JSON.parse(await readFile(new URL('../public/'+m.spec,import.meta.url))),m.key)));
   routeReport=checkPhase1Routes(layouts,(await page.evaluate(()=>window.mudMeals.audit)).obstacles);
   console.log(`Connected road network passed: ${routeReport.pickups} pickups and ${routeReport.customers} customers reachable across all four scenes`);
  }
 }
 if(!process.env.CAPTURES_ONLY){
 await page.evaluate(()=>window.mudMeals.selectPhase(1,'p1-scene_01'));await page.click('#reference-toggle');assert.equal(await page.locator('#reference-panel').isVisible(),true);assert.match(await page.locator('#reference-image').getAttribute('src'),/p1-scene_01/);await page.locator('#reference-opacity').evaluate(el=>{el.value='.25';el.dispatchEvent(new Event('input',{bubbles:true}))});assert.equal(await page.locator('#reference-image').evaluate(el=>el.style.opacity),'0.25');await page.click('#reference-close');console.log('Reference overlay passed');
 await page.setViewportSize({width:844,height:390});await page.click('#ride-view');const before=await page.evaluate(()=>window.mudMeals.state);const pedal=page.locator('[data-control="forward"]');const pedalBounds=await pedal.boundingBox();await page.mouse.move(pedalBounds.x+pedalBounds.width/2,pedalBounds.y+pedalBounds.height/2);await page.mouse.down();await page.waitForFunction(y=>window.mudMeals.state.y>y+.1,before.y,{timeout:180000});await page.mouse.up();assert.ok((await page.evaluate(()=>window.mudMeals.state)).y>before.y);await page.screenshot({path:'artifacts/scenes/mobile-landscape.png',timeout:240000});console.log('Mobile controls passed');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);await page.screenshot({path:'artifacts/scenes/mobile-portrait.png',timeout:240000});console.log('Portrait layout passed');
 for(const route of ['review.html','crowd.html']){await page.goto(new URL(route,base).href);await page.waitForFunction(()=>!document.getElementById('loading'),null,{timeout:240000});console.log(`Review page passed: ${route}`);}
 }
 assert.deepEqual(errors,[]);await writeFile('artifacts/scenes/audit.json',JSON.stringify({phase:process.env.PHASE?Number(process.env.PHASE):null,cameraCount,routeReport,reports,errors},null,2));console.log(process.env.CAPTURES_ONLY?`Capture checks passed: ${manifest.length} scenes, ${cameraCount} rendered views, geometry and route access.`:`Browser checks passed: ${manifest.length} scenes, ${cameraCount} camera presets, driving, pause, overlay, mobile controls and model review pages.`);
}finally{await browser.close()}

function checkPhase1Routes(layouts,obstacles){
 const minX=Math.min(...layouts.map(s=>s.origin[0])),maxX=Math.max(...layouts.map(s=>s.origin[0]+s.scene.playable_size_m.east_west));
 const minY=Math.min(...layouts.map(s=>s.origin[1])),maxY=Math.max(...layouts.map(s=>s.origin[1]+s.scene.playable_size_m.north_south));
 const width=maxX-minX+1,height=maxY-minY+1,seen=new Uint8Array(width*height),queue=new Int32Array(width*height);
 const spawn=layouts[0].props.find(p=>/player|rider/.test(p.type.toLowerCase())).position;
 const index=(x,y)=>(y-minY)*width+x-minX,start=index(spawn[0]+layouts[0].origin[0],spawn[1]+layouts[0].origin[1]);let head=0,tail=1;queue[0]=start;seen[start]=1;
 while(head<tail){const cell=queue[head++],x=cell%width+minX,y=Math.floor(cell/width)+minY;
  for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<minX||nx>maxX||ny<minY||ny>maxY)continue;const next=index(nx,ny);if(seen[next]||!canRide(nx,ny,layouts,obstacles,.65))continue;seen[next]=1;queue[tail++]=next;}
 }
 const reachable=(x,y,radius=4.2)=>{for(let xx=Math.ceil(x-radius);xx<=x+radius;xx++)for(let yy=Math.ceil(y-radius);yy<=y+radius;yy++)if(xx>=minX&&xx<=maxX&&yy>=minY&&yy<=maxY&&Math.hypot(xx-x,yy-y)<=radius&&seen[index(xx,yy)])return true;return false;};
 let pickups=0,customers=0;
 for(const s of layouts){
  const p=s.props.find(p=>/player|rider/.test(p.type.toLowerCase())).position;assert.ok(canRide(p[0]+s.origin[0],p[1]+s.origin[1],layouts,obstacles,.65),`${s.key}: spawn clear`);assert.ok(reachable(p[0]+s.origin[0],p[1]+s.origin[1],1),`${s.key}: connected spawn`);
  for(const bay of s.bays){const r=bay.rect;assert.ok(reachable((r[0]+r[2])/2+s.origin[0],(r[1]+r[3])/2+s.origin[1]),`${s.key}:${bay.id}: pickup reachable`);pickups++;}
  const home=s.buildings.find(b=>/HOME|HOUSE|APARTMENT|OFFICE|WORKSHOP|SHED/.test(b.id));if(home){const p=home.entrance,dir=home.direction;assert.ok(reachable(p[0]+s.origin[0]+(dir==='east'?2:dir==='west'?-2:0),p[1]+s.origin[1]+(dir==='north'?2:dir==='south'?-2:0)),`${s.key}: customer reachable`);customers++;}
 }
 return{pickups,customers,reachableCells:tail};
}
