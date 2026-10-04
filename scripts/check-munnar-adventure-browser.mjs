import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>Object.defineProperty(window,'__REAL_MAP__',{configurable:true,set(a){a.renderer.setAnimationLoop=()=>{};Object.defineProperty(window,'__REAL_MAP__',{value:a,configurable:true})}}));
 await page.goto('http://localhost:4173/real-map.html?location=munnar');await page.waitForFunction(()=>window.__REAL_MAP__?.ready||window.__REAL_MAP_ERROR__,{},{timeout:240000});
 const corridors=await page.evaluate(()=>{
  const a=window.__REAL_MAP__;if(window.__REAL_MAP_ERROR__)throw Error(window.__REAL_MAP_ERROR__);const results=[];
  for(const t of a.adventure.trails){const blocked=t.segments.filter(s=>a.blocked(s.a.x,s.a.z,Math.atan2(s.a.x-s.b.x,s.a.z-s.b.z)));results.push({name:t.name,blocked:blocked.map(s=>s.a),samples:t.points.length})}return results;
 });
 console.log('Trail collision corridors',JSON.stringify(corridors));assert.ok(corridors.every(t=>t.blocked.length===0));
 // Exercise the connected controls on the trail, rather than only inspecting its mesh.
 for(const id of ['tea','ridge']){
  const driving=await page.evaluate(id=>{
   const a=window.__REAL_MAP__,t=a.adventure.trails.find(t=>t.id===id),p=t.points[Math.floor(t.points.length*.2)],q=t.points[Math.floor(t.points.length*.2)+1],heading=Math.atan2(p.x-q.x,p.z-q.z);a.reset();a.player.position.set(p.x,a.height(p.x,p.z)+.07,p.z);a.player.rotation.y=heading;a.driving.reset(heading);const start=a.player.position.clone();
   window.dispatchEvent(new KeyboardEvent('keydown',{key:'w'}));for(let i=0;i<150;i++)a.update(1/60);window.dispatchEvent(new KeyboardEvent('keyup',{key:'w'}));a.graphics.render();return {moved:a.player.position.distanceTo(start),speed:a.driving.state.speed,surface:document.querySelector('#surface').textContent};
  },id);
  console.log(id,driving);assert.ok(driving.moved>1&&driving.speed>0);assert.match(driving.surface,/Dirt|Gravel/);
  await page.screenshot({path:`artifacts/real-map/munnar-${id}-trail.png`,timeout:120000});
 }
 await page.evaluate(()=>{const a=window.__REAL_MAP__;a.reset();document.querySelector('#view').click()});await page.screenshot({path:'artifacts/real-map/munnar-adventure-layout.png',timeout:120000});await page.locator('#view').click();await page.setViewportSize({width:932,height:430});
 await page.evaluate(()=>{const a=window.__REAL_MAP__,t=a.adventure.trails[0],i=Math.floor(t.points.length*.2),p=t.points[i],q=t.points[i+1],heading=Math.atan2(p.x-q.x,p.z-q.z);a.reset();a.player.position.set(p.x,a.height(p.x,p.z)+.07,p.z);a.player.rotation.y=heading;a.driving.reset(heading)});
 const boxes=await Promise.all([page.locator('#go').boundingBox(),page.locator('[data-key="d"]').boundingBox()]),cdp=await page.context().newCDPSession(page);
 await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:boxes.map((b,i)=>({x:b.x+b.width/2,y:b.y+b.height/2,id:i+1}))});
 const touch=await page.evaluate(()=>{const a=window.__REAL_MAP__,start=a.player.position.clone(),heading=a.player.rotation.y;for(let i=0;i<100;i++)a.update(1/60);return {moved:a.player.position.distanceTo(start),turn:a.player.rotation.y-heading}});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();assert.ok(touch.moved>1&&touch.turn<-.1);console.log('Off-road two-finger mobile controls',touch);
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.__REAL_MAP__.graphics.render());await page.screenshot({path:'artifacts/real-map/munnar-trail-mobile.png',timeout:120000});
 assert.deepEqual(errors,[]);console.log('Munnar adventure corridors and connected trail driving passed.');
}finally{await browser.close()}
