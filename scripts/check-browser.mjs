import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.setDefaultTimeout(120000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') console.error('Browser:', message.text()); });
try {
  const url = process.env.PREVIEW_URL || 'http://localhost:4173';
  for (let attempt = 0; attempt < 30; attempt++) {
    try { await fetch(url); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 1000)); }
  }
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__MUD_MEALS__ && !document.querySelector('#loading'), null, { timeout: 120000 });
  assert.equal(await page.evaluate(() => window.__MUD_MEALS__.renderer.getContext().isContextLost()), false);
  assert.equal(await page.evaluate(()=>window.__MUD_MEALS__.camera.isPerspectiveCamera),true);
  // Capture an existing rendered frame without flooding the CI software GPU.
  await page.evaluate(() => window.__MUD_MEALS__.renderer.setAnimationLoop(null));
  const touchUI=await page.locator('#accelerate').evaluate(button=>{const menu=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});button.dispatchEvent(menu);return {menuBlocked:menu.defaultPrevented,selection:getComputedStyle(button).userSelect}});
  assert.equal(touchUI.menuBlocked,true);
  assert.equal(touchUI.selection,'none');
  await page.setViewportSize({width:1536,height:864});
  await page.evaluate(()=>{const a=window.__MUD_MEALS__;a.reset();a.resize();a.graphics.render()});
  // Catch depth-setting regressions and unstable rendering of an unchanged scene.
  const depth=await page.evaluate(()=>{const a=window.__MUD_MEALS__;a.graphics.render();return {near:a.camera.near,far:a.camera.far,aoNear:a.graphics.ao.ssaoMaterial.uniforms.cameraNear.value,aoFar:a.graphics.ao.ssaoMaterial.uniforms.cameraFar.value}});
  assert.equal(depth.near,10);assert.equal(depth.aoNear,depth.near);assert.equal(depth.aoFar,depth.far);
  const stable=await page.evaluate(()=>{const a=window.__MUD_MEALS__,canvas=a.renderer.domElement;a.graphics.render();const first=canvas.toDataURL();a.graphics.render();return first===canvas.toDataURL()});
  assert.equal(stable,true,'An unchanged scene must render identically on successive frames');
  await page.screenshot({path:'artifacts/reference-view.png'});
  await page.setViewportSize({width:960,height:540});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  for(const seated of [false,true]){
    const png=await page.evaluate(seated=>window.__MUD_MEALS__.renderPersonPreview(seated),seated);
    const bytes=Buffer.from(png.split(',')[1],'base64');assert.ok(bytes.length>15000,'Character preview must contain rendered geometry');
    await writeFile('artifacts/person-'+(seated?'seated':'standing')+'.png',bytes);
  }
  // Close-up renders expose silhouettes and construction details hidden in the world view.
  for(const type of ['delivery-bike','auto','bus','car','van']){
    const assetPNG=await page.evaluate(type=>{
      const a=window.__MUD_MEALS__;let model;
      a.scene.traverse(o=>{if(!model&&o.userData.assetType===type)model=o});
      if(!model)throw new Error('Missing model: '+type);
      a.camera.near=.5;a.camera.far=160;a.camera.fov=42;a.camera.zoom=1;
      const distance=type==='bus'?16:type==='delivery-bike'?5:6;
      a.camera.position.set(model.position.x+distance*.65,model.position.y+distance*.55,model.position.z+distance*.9);
      a.camera.lookAt(model.position.x,model.position.y+(type==='bus'?2:1.2),model.position.z);
      a.camera.updateProjectionMatrix();a.graphics.render();return a.renderer.domElement.toDataURL('image/png');
    },type);
    const assetBytes=Buffer.from(assetPNG.split(',')[1],'base64');assert.ok(assetBytes.length>15000,'Asset preview must contain rendered geometry');
    await writeFile('artifacts/asset-'+type+'.png',assetBytes);
  }
  await page.evaluate(()=>{const a=window.__MUD_MEALS__;a.reset();a.graphics.render()});

  // Advance the real simulation: every NPC has a safe route; cars cannot interpenetrate.
  const lifeChecks=await page.evaluate(()=>{
    const a=window.__MUD_MEALS__,life=a.life;a.reset();const starts=life.traffic.map(v=>v.g.position.clone()),greeter=life.npcs.find(n=>!n.sitting);a.player.position.copy(greeter.home);a.player.position.x+=2;
    let overlap=false,walked=false,waved=false;
    for(let i=0;i<900;i++){
      life.update(1/30,i/30);
      walked ||=life.npcs.some(n=>n.state==='walking');waved ||=life.npcs.some(n=>n.wave>.5);
      if(i%30===0)for(let j=0;j<life.traffic.length;j++)for(let k=j+1;k<life.traffic.length;k++)overlap ||=life.overlaps(life.traffic[j],life.traffic[k]);
    }
    const result={audit:life.audit(),overlap,walked,waved,moved:life.traffic.some((v,i)=>v.g.position.distanceTo(starts[i])>1)};
    a.reset();return result;
  });
  assert.equal(lifeChecks.audit.walkingRoutes,lifeChecks.audit.pedestrians);assert.equal(lifeChecks.audit.plantsInRoad.length,0);assert.equal(lifeChecks.audit.plantsInBuildings.length,0);assert.equal(lifeChecks.audit.plantsInWater.length,0);
  assert.equal(lifeChecks.overlap,false);assert.equal(lifeChecks.walked,true);assert.equal(lifeChecks.waved,true);assert.equal(lifeChecks.moved,true);
  for(const activity of ['walking','greeting']){
    const png=await page.evaluate(activity=>{
      const a=window.__MUD_MEALS__,n=a.life.npcs.find(n=>!n.sitting&&n.home.x>-12&&n.home.x<-10);a.reset();
      if(activity==='greeting'){const p=a.roadFrame(n.home.z);a.player.position.set(p.x,.025,p.z);}
      for(let i=0;i<(activity==='walking'?420:45);i++)a.life.update(1/30,i/30);
      a.camera.near=.5;a.camera.far=160;a.camera.fov=42;a.camera.zoom=1;
      a.camera.position.set(n.g.position.x+2.5,n.g.position.y+1.9,n.g.position.z+3.8);a.camera.lookAt(n.g.position.x,n.g.position.y+.85,n.g.position.z);a.camera.updateProjectionMatrix();a.graphics.render();
      return a.renderer.domElement.toDataURL('image/png');
    },activity);
    const bytes=Buffer.from(png.split(',')[1],'base64');assert.ok(bytes.length>15000);await writeFile('artifacts/life-'+activity+'.png',bytes);
  }
  await page.evaluate(()=>{const a=window.__MUD_MEALS__;a.reset();a.graphics.render()});

  await page.locator('#pause').click();
  await page.screenshot({ path: 'artifacts/landscape.png' });
  await page.locator('#orders').click();
  await page.locator('#order-panel').waitFor({ state: 'visible' });
  await page.locator('#close-orders').click();
  await page.locator('#tools-toggle').click();
  await page.locator('#quality').click();
  assert.equal(await page.evaluate(() => window.__MUD_MEALS__.renderer.getPixelRatio()),1);
  await page.locator('#quality').click();
  const density=await page.evaluate(() => ({renderer:window.__MUD_MEALS__.renderer.getPixelRatio(),composer:window.__MUD_MEALS__.graphics.composer._pixelRatio}));
  assert.ok(density.renderer>=1.25);
  assert.equal(density.renderer,density.composer);
  await page.locator('#camera-settings').click();
  await page.locator('#camera-panel').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>window.__MUD_MEALS__.cameraMode),'reference');
  await page.locator('#camera-mode').selectOption('driving');
  assert.equal(await page.evaluate(()=>window.__MUD_MEALS__.cameraMode),'driving');
  const followDepth=await page.evaluate(()=>{const a=window.__MUD_MEALS__;a.graphics.render();return [a.camera.near,a.graphics.ao.ssaoMaterial.uniforms.cameraNear.value,a.camera.far,a.graphics.ao.ssaoMaterial.uniforms.cameraFar.value]});
  assert.deepEqual(followDepth,[.5,.5,160,160]);
  const initialZoom=await page.evaluate(()=>window.__MUD_MEALS__.camera.zoom);
  await page.locator('#camera-zoom').press('ArrowRight');
  assert.ok(await page.evaluate(()=>window.__MUD_MEALS__.camera.zoom)>initialZoom);
  await page.locator('#camera-panX').press('ArrowRight');
  assert.equal(await page.evaluate(()=>window.__MUD_MEALS__.cameraSettings.panX),.5);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mud-meals-follow-camera')).panX),.5);
  await page.locator('#reset-camera').click();
  assert.equal(await page.evaluate(()=>window.__MUD_MEALS__.camera.zoom),initialZoom);
  assert.equal(await page.evaluate(()=>window.__MUD_MEALS__.cameraSettings.panX),0);
  await page.locator('#close-camera').click();
  await page.locator('#tools-toggle').click();
  await page.locator('#reference').click();
  await page.locator('#reference-panel img').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#reference-panel img').evaluate(img => img.complete && img.naturalWidth > 0), true);
  await page.locator('#reference-frame').click();
  assert.equal(await page.evaluate(()=>window.__MUD_MEALS__.cameraMode),'reference');
  assert.ok(await page.evaluate(()=>window.__MUD_MEALS__.camera.fov)<20);
  await page.locator('#reference-opacity').evaluate(input=>{input.value='0.5';input.dispatchEvent(new Event('input',{bubbles:true}))});
  assert.equal(await page.locator('#reference-panel img').evaluate(img=>img.style.opacity),'0.5');
  await page.locator('#reference-opacity').evaluate(input=>{input.value='1';input.dispatchEvent(new Event('input',{bubbles:true}))});
  await page.locator('#close-reference').click();
  await page.locator('#world-explore').click();
  await page.locator('#world-panel').waitFor({state:'visible'});
  await page.locator('#district-select').selectOption('fort-kochi');
  await page.locator('#travel-district').click();
  assert.equal(await page.locator('#location').textContent(),'FORT KOCHI MARKET');
  // Exercise real movement through a turn with the normal follow camera.
  await page.locator('#pause').click();
  await page.evaluate(()=>window.__MUD_MEALS__.setCameraMode('driving'));
  const start=await page.evaluate(()=>window.__MUD_MEALS__.player.position.toArray());
  await page.keyboard.down('ArrowUp');
  await page.evaluate(()=>{for(let i=0;i<180;i++)window.__MUD_MEALS__.update(1/60)});
  await page.keyboard.up('ArrowUp');
  const follow=await page.evaluate(()=>{const a=window.__MUD_MEALS__,p=a.player.position,c=a.camera.position;return {position:p.toArray(),behind:(c.x-p.x)*-Math.sin(a.player.rotation.y)+(c.z-p.z)*-Math.cos(a.player.rotation.y),height:c.y-p.y}});
  assert.ok(Math.hypot(follow.position[0]-start[0],follow.position[2]-start[2])>4);
  assert.ok(follow.behind<0);assert.ok(follow.height>2);
  await page.locator('#pause').click();
  for(const id of ['fort-kochi','backwaters','paddy','village','port','ferry','coast','hills','viewpoint']){
    await page.evaluate(id=>{const a=window.__MUD_MEALS__;a.visitDistrict(id);a.graphics.render()},id);
    await page.screenshot({path:'artifacts/'+id+'.png'});
  }
  await page.evaluate(()=>{const a=window.__MUD_MEALS__;a.visitDistrict('backwaters');a.camera.position.set(85,32,-30);a.camera.lookAt(73,1,-76);a.graphics.render()});
  await page.screenshot({path:'artifacts/backwater-overview.png'});
  for(const [id,position,target] of [['fort-kochi',[-70,35,-28],[-106,4,-62]],['port',[76,35,96],[57,5,139]],['coast',[-90,32,67],[-133,4,39]]]){
    await page.evaluate(({id,position,target})=>{const a=window.__MUD_MEALS__;a.visitDistrict(id);a.camera.position.set(...position);a.camera.lookAt(...target);a.graphics.render()},{id,position,target});
    await page.screenshot({path:'artifacts/'+id+'-overview.png'});
  }
  await page.locator('#tools-toggle').click();
  await page.locator('#world-explore').click();
  await page.locator('#weather-select').selectOption('sunset');
  assert.equal(await page.evaluate(()=>window.__MUD_MEALS__.extendedWorld.weather),'sunset');
  await page.locator('#weather-select').selectOption('rain');
  assert.equal(await page.evaluate(()=>window.__MUD_MEALS__.extendedWorld.weather),'rain');
  await page.locator('#close-world').click();
  await page.evaluate(()=>{const a=window.__MUD_MEALS__;a.visitDistrict('fort-kochi');a.graphics.render()});
  await page.screenshot({path:'artifacts/rainy-night.png'});
  await page.evaluate(()=>{const a=window.__MUD_MEALS__;a.extendedWorld.setWeather('day');a.reset();a.update(0)});
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#landscape-prompt').waitFor({ state: 'visible' });
  await page.screenshot({ path: 'artifacts/portrait.png' });
  await page.setViewportSize({ width: 932, height: 430 });
  await page.locator('#landscape-prompt').waitFor({ state: 'hidden' });
  // Catch stale inline canvas dimensions after rotation, browser zoom, and wide displays.
  for (const viewport of [{width:1536,height:691},{width:932,height:430},{width:390,height:844},{width:960,height:540}]) {
    await page.setViewportSize(viewport);
    await page.waitForFunction(() => {
      const stage=document.querySelector('#game-stage').getBoundingClientRect();
      const canvas=document.querySelector('#world').getBoundingClientRect();
      return Math.abs(stage.width-canvas.width)<1 && Math.abs(stage.height-canvas.height)<1;
    });
    const bounds=await page.evaluate(() => {
      const stage=document.querySelector('#game-stage').getBoundingClientRect();
      const canvas=document.querySelector('#world');
      return {width:stage.width,height:stage.height,inlineWidth:canvas.style.width,inlineHeight:canvas.style.height};
    });
    assert.ok(Math.abs(bounds.width/bounds.height-16/9)<0.01);
    assert.equal(bounds.inlineWidth,'');
    assert.equal(bounds.inlineHeight,'');
  }
  await page.evaluate(() => window.__MUD_MEALS__.graphics.render());
  await page.screenshot({path:'artifacts/resized-landscape.png'});

  assert.deepEqual(errors, []);
  console.log('Browser checks passed: stable repeated frames, synchronized camera depth, WebGL, all NPC walking routes, waving, traffic spacing, wind shaders, world travel, rider-follow driving, weather, orders, camera settings, and landscape layout.');
} finally {
  console.log('Page errors:', errors);
  await page.screenshot({ path: 'artifacts/final-state.png', timeout: 5000 }).catch(error => console.log('Screenshot:', error.message));
  await browser.close();
}

