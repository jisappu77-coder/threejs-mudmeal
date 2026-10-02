import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export async function checkGameUpdate(page){
 const result=await page.evaluate(()=>{
  const a=window.__MUD_MEALS__;if(a.startupError)throw Error(a.startupError);a.renderer.setAnimationLoop(null);a.reset();
  const people=a.npcs.map(n=>({style:n.g.userData.style,rigged:n.g.userData.rigged}));
  const start=a.player.position.clone();
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'w'}));
  // Verify connected game input and collision handling, not just the standalone model.
  for(let i=0;i<180;i++)a.update(1/60);
  const accelerating={speed:a.driving.state.speed,moved:a.player.position.distanceTo(start)};
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'d'}));
  for(let i=0;i<45;i++)a.update(1/60);
  const offset=a.driving.state.offset;
  window.dispatchEvent(new KeyboardEvent('keyup',{key:'d'}));window.dispatchEvent(new KeyboardEvent('keyup',{key:'w'}));
  for(let i=0;i<30;i++)a.update(1/60);
  const releasedOffset=a.driving.state.offset;
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'s'}));for(let i=0;i<180;i++)a.update(1/60);window.dispatchEvent(new KeyboardEvent('keyup',{key:'s'}));
  const stopped=a.driving.state.speed;
  console.log('Connected driving simulation complete',accelerating,offset,releasedOffset,stopped);
  a.reset();a.graphics.render();
  return {people,accelerating,offset,releasedOffset,stopped,camera:a.cameraMode};
 });
 assert.equal(result.people.length,27);assert.ok(result.people.every(p=>p.rigged));assert.equal(new Set(result.people.map(p=>p.style)).size,4);
 assert.ok(result.accelerating.moved>1&&result.accelerating.speed>1);assert.ok(result.offset>0);assert.ok(result.releasedOffset>result.offset*.8);assert.equal(result.stopped,0);assert.equal(result.camera,'driving');
 // Releasing one input source must leave the other source's pedal held.
 for(const keyboardFirst of[true,false]){
  await page.evaluate(()=>window.__MUD_MEALS__.reset());
  const box=await page.locator('#accelerate').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  if(keyboardFirst){await page.keyboard.down('ArrowUp');await page.mouse.down();await page.mouse.up();}
  else{await page.mouse.down();await page.keyboard.down('ArrowUp');await page.keyboard.up('ArrowUp');}
  const speed=await page.evaluate(()=>{const a=window.__MUD_MEALS__;for(let i=0;i<180;i++)a.update(1/60);return a.driving.state.speed});
  assert.ok(speed>1,'Releasing touch/keyboard must not cancel the other held accelerator');
  await page.keyboard.up('ArrowUp');await page.mouse.up();
 }
 const shortcuts=await page.evaluate(()=>{
  const a=window.__MUD_MEALS__,before=a.player.position.clone();window.dispatchEvent(new KeyboardEvent('keydown',{key:'r',ctrlKey:true}));const modifierPreserved=before.distanceTo(a.player.position)===0;
  a.reset();for(const repeat of[false,true])window.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space',repeat}));window.dispatchEvent(new KeyboardEvent('keyup',{key:' ',code:'Space'}));
  const pauseLabel=document.querySelector('#pause').getAttribute('aria-label');document.querySelector('#pause').click();
  for(const repeat of[false,true])window.dispatchEvent(new KeyboardEvent('keydown',{key:'h',repeat}));const hidden=document.querySelector('#hud').style.visibility==='hidden';window.dispatchEvent(new KeyboardEvent('keyup',{key:'h'}));window.dispatchEvent(new KeyboardEvent('keydown',{key:'h'}));window.dispatchEvent(new KeyboardEvent('keyup',{key:'h'}));
  a.reset();a.graphics.render();return {modifierPreserved,pauseLabel,hidden,resetSpeed:document.querySelector('#speed').textContent};
 });
 assert.deepEqual(shortcuts,{modifierPreserved:true,pauseLabel:'Resume animation',hidden:true,resetSpeed:'0'});
 await page.screenshot({path:'artifacts/game-update/driving.png',timeout:120000});
 await page.evaluate(()=>{const a=window.__MUD_MEALS__;document.querySelector('#hud').style.visibility='hidden';const n=a.npcs.find(n=>!n.sitting&&n.home.x>-12&&n.home.x<-10);a.camera.near=.1;a.camera.fov=42;a.camera.zoom=1;a.camera.position.set(n.g.position.x+2.5,n.g.position.y+1.9,n.g.position.z+3.8);a.camera.lookAt(n.g.position.x,n.g.position.y+.85,n.g.position.z);a.camera.updateProjectionMatrix();a.graphics.render()});
 await page.screenshot({path:'artifacts/game-update/npc-in-world.png',timeout:120000});
 await page.evaluate(()=>{const a=window.__MUD_MEALS__;document.querySelector('#hud').style.visibility='visible';a.reset();a.graphics.render()});
 console.log('Game update browser checks passed:',JSON.stringify({...result,people:result.people.length,styles:[...new Set(result.people.map(p=>p.style))]}));
}

if(import.meta.url===pathToFileURL(process.argv[1]).href){
await mkdir('artifacts/game-update',{recursive:true});
const browser=await chromium.launch(process.env.HARDWARE_GL==='1'?{channel:'chromium',args:['--use-angle=gl']}:{}),page=await browser.newPage({viewport:{width:900,height:500}});
page.setDefaultTimeout(240000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`)});
page.on('console',m=>{if(m.type()==='error'||m.text().startsWith('Connected driving'))console.log(m.text())});
await page.addInitScript(()=>localStorage.setItem('mud-meals-graphics','balanced'));
try{
 await page.goto((process.env.PREVIEW_URL||'http://localhost:4173/'));
 console.log('Game page loaded; waiting for characters and shaders');
 await page.waitForFunction(()=>{const a=window.__MUD_MEALS__;if(a?.ready){a.renderer.setAnimationLoop(null);return true}return a?.startupError},null,{timeout:240000,polling:50});
 console.log('Game ready; checking connected controls');
 await checkGameUpdate(page);
 assert.deepEqual(errors,[]);
}catch(error){console.error(error);throw error}finally{await browser.close()}

}
