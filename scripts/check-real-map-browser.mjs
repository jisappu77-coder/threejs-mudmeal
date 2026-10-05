import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {realLocations} from '../src/real-map-data.js';
await mkdir('artifacts/real-map',{recursive:true});
const base=process.env.PREVIEW_URL||'http://localhost:4173/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const id of Object.keys(realLocations)){
  const page=await browser.newPage({viewport:{width:932,height:430}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>Object.defineProperty(window,'__REAL_MAP__',{configurable:true,set(app){app.renderer.setAnimationLoop=()=>{};Object.defineProperty(window,'__REAL_MAP__',{value:app,configurable:true})}}));
  await page.goto(new URL(`real-map.html?location=${id}`,base).href);
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
  const waterfront=await page.evaluate(()=>{
   const a=window.__REAL_MAP__,w=a.waterfront,hidden=a.traffic.map(v=>v.hidden),positions=a.people.map(p=>p.g.position.clone());
   // Remove moving actors only for this static full-bike collision audit.
   a.traffic.forEach(v=>v.hidden=1);a.people.forEach(p=>p.g.position.set(5000,0,5000));
   const path=w.servicePath,dx=path.b.x-path.a.x,dz=path.b.z-path.a.z,length=Math.hypot(dx,dz),heading=Math.atan2(-dx,-dz),passageErrors=[];
   for(let t=0;t<=length;t+=.5)for(const side of [-.35,0,.35]){const x=path.a.x+dx*t/length+dz/length*side,z=path.a.z+dz*t/length-dx/length*side;if(a.blocked(x,z,heading))passageErrors.push({x,z});}
   const stops=a.stops.map(p=>({...p,wet:a.map.waterAt(p.x,p.z),blocked:a.blocked(p.x,p.z)}));
   const solidsMissing=w.solids.filter(p=>!a.blocked(p.x,p.z,0)).length;
   const routeErrors=[];
   for(let stop=0;stop<a.stops.length;stop++){
    a.delivery.state.completed=stop;a.delivery.next();const route=a.delivery.route;
    for(let i=1;i<route.length;i++){const from=route[i-1],to=route[i],dx=to.x-from.x,dz=to.z-from.z,length=Math.hypot(dx,dz),heading=Math.atan2(-dx,-dz);for(let t=0;t<=length;t+=1){const x=from.x+dx*t/length,z=from.z+dz*t/length;if(a.blocked(x,z,heading))routeErrors.push({stop,x,z});}}
   }
   a.delivery.state.completed=0;a.delivery.next();

   a.traffic.forEach((v,i)=>v.hidden=hidden[i]);a.people.forEach((p,i)=>p.g.position.copy(positions[i]));
   return {stats:w.stats,passageErrors,stops,solidsMissing,routeErrors,route:a.delivery.route};
  });
  console.log('Waterfront clearance',JSON.stringify(waterfront));
  assert.ok(waterfront.stats.restaurant===1&&waterfront.stats.fishingNets===4&&waterfront.stats.boats>=3&&waterfront.stats.marketStalls>=3&&waterfront.stats.heritageLandmarks===1);
  assert.deepEqual(waterfront.passageErrors,[],'The dirt service passage must fit the whole bike across its usable width');
  assert.ok(waterfront.stops.length===3&&waterfront.stops.every(p=>!p.wet&&!p.blocked)&&waterfront.solidsMissing===0);
  assert.ok(waterfront.route.length>1);assert.deepEqual(waterfront.routeErrors,[],'All named road routes must fit the bike without static scenery obstruction');
  assert.equal(await page.locator('#fps').inputValue(),'30');await page.locator('#fps').selectOption('60');assert.equal(await page.evaluate(()=>window.__REAL_MAP__.frameLoop.gate.fps),60);await page.locator('#fps').selectOption('30');
  const gameplay=await page.evaluate(()=>{
   const a=window.__REAL_MAP__,d=a.delivery,r=()=>d.state.cash;
   const cash=r(),destination={...d.state.destination};if(!destination.x&&!destination.z)throw Error('Missing delivery destination');
   if(d.deliver())throw Error('Delivery succeeded away from customer');
   d.update(2,2);const timer=d.state.remaining,expectedTimer=180;
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
  assert.ok(gameplay.art.roofs>100&&gameplay.art.verandas>0&&gameplay.art.shutters>100,'Kerala architecture must appear in the rendered map');
  assert.ok(gameplay.art.rafters>1000&&gameplay.art.gutters>100&&gameplay.art.downpipes>10&&gameplay.art.courtyards>10&&gameplay.art.compoundWalls>0&&gameplay.art.entranceSteps>0&&gameplay.art.stairs>0&&gameplay.art.pots>0&&gameplay.art.shopDisplays>0&&gameplay.art.hangingLamps>0,'Photo references must inform roof construction, homes and shop objects');
  assert.ok(gameplay.art.infillHomes>30&&gameplay.art.teaStalls>5&&gameplay.art.gardenLots>10&&gameplay.art.streetTrees>40&&gameplay.art.bananaPlants>80,'Empty urban land must contain homes, stalls and layered planting');
  const vendorSafety=await page.evaluate(()=>{const a=window.__REAL_MAP__,vendors=a.people.filter(p=>p.g.userData.vendor);return {count:vendors.length,blocked:vendors.filter(p=>a.scenery.solidAt(p.g.position.x,p.g.position.z,.4)||a.waterfront.solidAt(p.g.position.x,p.g.position.z,.4)).length,rigged:vendors.every(p=>p.g.userData.rigged)};});assert.ok(vendorSafety.count>=8&&vendorSafety.blocked===0&&vendorSafety.rigged,'Occupied stalls need rigged vendors with clear standing space');
  const scenerySafety=await page.evaluate(()=>{
   const a=window.__REAL_MAP__,props=a.scenery.obstacles.filter(p=>p.kind),canopies={count:0,tiltErrors:0};
   a.scene.traverse(mesh=>{if(!mesh.isInstancedMesh||mesh.geometry.type!=='BoxGeometry'||!mesh.material.bumpMap)return;const m=mesh.matrix.clone();for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);canopies.count++;if(Math.abs(m.elements[1])>1e-6||m.elements[9]>=0)canopies.tiltErrors++;}});
   return {count:props.length,inRoad:props.filter(p=>{const r=a.map.nearestRoad(p.x,p.z);return r.distance<r.segment.width/2+1.8+p.radius-1e-6}),missingCollision:props.filter(p=>!a.blocked(p.x,p.z,0)),infill:a.scenery.infill.length,infillRoadErrors:a.scenery.infill.flatMap(p=>p.cells).filter(p=>{const r=a.map.nearestRoad(p.x,p.z);return r.distance<r.segment.width/2+1.8+p.radius-1e-6}).length,solidCollisionErrors:a.scenery.solids.filter(p=>!a.blocked(p.x,p.z,0)).length,shops:a.scenery.frontages.filter(f=>f.shop).length,homes:a.scenery.frontages.filter(f=>!f.shop).length,canopies};
  });
  assert.ok(scenerySafety.count>0&&scenerySafety.shops>0&&scenerySafety.homes>0);assert.ok(scenerySafety.canopies.count>100&&scenerySafety.canopies.tiltErrors===0,'Veranda eaves must stay level across the frontage and slope away from the wall');assert.deepEqual(scenerySafety.inRoad,[]);assert.deepEqual(scenerySafety.missingCollision,[]);console.log(id,'photo-reference props leave roads clear',JSON.stringify(scenerySafety));
  assert.ok(scenerySafety.infill>60&&scenerySafety.infillRoadErrors===0&&scenerySafety.solidCollisionErrors===0,'Added neighbourhoods must preserve driving clearance and block solid buildings');
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
  await page.setViewportSize({width:1280,height:720});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.evaluate(()=>{const a=window.__REAL_MAP__;a.reset();a.update(1/30);a.graphics.render()});await page.screenshot({path:`artifacts/real-map/${id}-waterfront-gameplay.png`,timeout:120000});
  await page.evaluate(()=>{const a=window.__REAL_MAP__,p=a.player.position,h=a.player.rotation.y,f={x:-Math.sin(h),z:-Math.cos(h)};a.camera.position.set(p.x-f.x*23+f.z*14,23,p.z-f.z*23-f.x*14);a.camera.lookAt(p.x+f.x*10,3,p.z+f.z*10);a.graphics.render()});
  await page.screenshot({path:`artifacts/real-map/${id}-photo-art.png`,timeout:120000});
  for(const [name,kind,shop]of [['house','outside-stair',false],['shop','shop-display',true]]){
   await page.evaluate(({kind,shop})=>{const a=window.__REAL_MAP__,p=a.scenery.obstacles.find(p=>p.kind===kind);if(!p)throw Error('Missing photo-reference detail');const f=a.scenery.frontages.filter(f=>f.shop===shop).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];a.camera.position.set(f.x+f.nx*15+f.nz*5,7,f.z+f.nz*15-f.nx*5);a.camera.lookAt(f.x,2.7,f.z);for(const light of a.scene.children)if(light.isDirectionalLight){light.position.set(f.x-40,90,f.z+35);light.target.position.set(f.x,0,f.z);}a.graphics.render()},{kind,shop});
   await page.screenshot({path:`artifacts/real-map/${id}-photo-${name}.png`,timeout:120000});
  }
  await page.close();
 }
 console.log('All available real map locations, attribution, human riders, model selection and mobile steering passed.');
}finally{await browser.close()}
