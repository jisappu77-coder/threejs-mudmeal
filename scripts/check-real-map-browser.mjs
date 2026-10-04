import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('artifacts/real-map',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const id of ['kochi','munnar','thekkady']){
  const page=await browser.newPage({viewport:{width:932,height:430}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>Object.defineProperty(window,'__REAL_MAP__',{configurable:true,set(app){app.renderer.setAnimationLoop=()=>{};Object.defineProperty(window,'__REAL_MAP__',{value:app,configurable:true})}}));
  await page.goto(`http://localhost:4173/real-map.html?location=${id}`);
  await page.waitForFunction(()=>window.__REAL_MAP__?.ready||window.__REAL_MAP_ERROR__,{},{timeout:240000});
  const result=await page.evaluate(()=>{
   if(window.__REAL_MAP_ERROR__)throw Error(window.__REAL_MAP_ERROR__);
   const a=window.__REAL_MAP__,start=a.player.position.clone(),heading=a.player.rotation.y,spawnBlocked=a.blocked(start.x,start.z);
   window.dispatchEvent(new KeyboardEvent('keydown',{key:'w'}));for(let i=0;i<90;i++)a.update(1/60);window.dispatchEvent(new KeyboardEvent('keyup',{key:'w'}));
   const moved=a.player.position.distanceTo(start),rider=a.player.rider.g.uuid;
   for(const style of ['heritage','daily','metro','city']){a.setModel(style);if(a.player.rider.g.uuid!==rider)throw Error('Rider lost when switching model')}
   a.reset();a.graphics.render();
   return {id:a.id,stats:a.stats(),spawnBlocked,moved,rigged:a.player.userData.riggedRider,heading};
  });
  console.log(id,JSON.stringify(result));assert.equal(result.id,id);assert.equal(result.spawnBlocked,false);assert.ok(result.moved>1);assert.ok(result.rigged);
  const gameplay=await page.evaluate(()=>{
   const a=window.__REAL_MAP__,d=a.delivery,r=()=>d.state.cash;
   const cash=r(),destination={...d.state.destination};if(!destination.x&&!destination.z)throw Error('Missing delivery destination');
   if(d.deliver())throw Error('Delivery succeeded away from customer');
   d.update(2,2);const timer=d.state.remaining,expectedTimer=a.id==='munnar'?360:180;
   a.player.position.set(destination.x,a.height(destination.x,destination.z)+.07,destination.z);d.update(.01,0);
   if(!d.deliver())throw Error('Delivery failed at destination');const paid=r()-cash,completed=d.state.completed;
   if(!d.next())throw Error('Next delivery unavailable');
   d.update(1000,2);const expired=d.state.finished,expiredCash=r();
   d.deliver();if(r()!==expiredCash)throw Error('Expired delivery paid a reward');
   a.reset();a.graphics.render();
   return {paid,completed,timer,expectedTimer,expired,art:a.scenery.stats};
  });
  assert.ok(gameplay.paid>0&&gameplay.completed===1&&gameplay.timer<gameplay.expectedTimer&&gameplay.expired);
  assert.ok(gameplay.art.windows>100&&gameplay.art.plants>300&&gameplay.art.streetProps>0);
  if(id!=='kochi')assert.ok(gameplay.art.roofs>50);
  await page.locator('#quality').click();assert.equal(await page.locator('#quality').getAttribute('aria-pressed'),'false');await page.locator('#quality').click();
  console.log(id,'delivery and environmental detail',JSON.stringify(gameplay));
  assert.equal(await page.locator('footer a').first().getAttribute('href'),'https://www.openstreetmap.org/copyright');
  await page.screenshot({path:`artifacts/real-map/${id}-driving.png`,timeout:120000});
  await page.locator('#view').click({timeout:120000});await page.screenshot({path:`artifacts/real-map/${id}-map.png`,timeout:120000});await page.locator('#view').click({timeout:120000});
  // Find open ground to exercise steering independently of legitimate road obstructions.
  await page.evaluate(()=>{const a=window.__REAL_MAP__,b=a.map.bounds;for(let x=b.minX+40;x<b.maxX-40;x+=20)for(let z=b.minZ+40;z<b.maxZ-40;z+=20){let clear=true;for(let dx=-15;dx<=15;dx+=3)for(let dz=-20;dz<=10;dz+=3)if(a.blocked(x+dx,z+dz,0))clear=false;if(clear){a.player.position.set(x,a.height(x,z)+.07,z);a.player.rotation.y=0;a.driving.reset();return}}throw Error('No open driving test area')});
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
  const boxes=await Promise.all([page.locator('#go').boundingBox(),page.locator('[data-key="d"]').boundingBox()]);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:boxes.map((b,i)=>({x:b.x+b.width/2,y:b.y+b.height/2,id:i+1}))});
  const mobile=await page.evaluate(()=>{const a=window.__REAL_MAP__,p=a.player.position.clone();for(let i=0;i<120;i++)a.update(1/60);return {moved:a.player.position.distanceTo(p),heading:a.player.rotation.y,speed:a.driving.state.speed}});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
  console.log(id,'mobile',JSON.stringify(mobile));assert.ok(mobile.moved>1&&mobile.heading<-.1&&mobile.speed>0);assert.deepEqual(errors,[]);
  await page.evaluate(()=>{const a=window.__REAL_MAP__;a.reset();a.graphics.render()});await page.setViewportSize({width:390,height:844});await page.screenshot({path:`artifacts/real-map/${id}-mobile.png`,timeout:120000});
  await page.close();
 }
 console.log('All three real map locations, attribution, human riders, model selection and mobile steering passed.');
}finally{await browser.close()}
