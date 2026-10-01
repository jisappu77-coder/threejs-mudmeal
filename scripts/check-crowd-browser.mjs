import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('artifacts/crowd',{recursive:true});
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1440,height:900}});
page.setDefaultTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto((process.env.PREVIEW_URL||'http://localhost:4173/')+'crowd.html');
 console.log('Crowd page loaded');
 await page.waitForFunction(()=>window.__CROWD_REVIEW__);
 console.log('Crowd ready');
 const data=await page.evaluate(()=>{
  const a=window.__CROWD_REVIEW__;a.renderer.setAnimationLoop(null);
  return a.people.slice(0,4).map(({rig})=>{let triangles=0,skinned=0;rig.g.traverse(o=>{if(o.isSkinnedMesh){skinned++;triangles+=o.geometry.index.count/3;if(o.name.startsWith('Body')){const index=o.geometry.index,positions=[];for(let i=0;i<o.geometry.attributes.position.count;i++)positions.push(o.getVertexPosition(i,new a.camera.position.constructor()));let edge=0;for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];for(let j=0;j<3;j++)edge=Math.max(edge,positions[ids[j]].distanceTo(positions[ids[(j+1)%3]]));}if(edge>.18)throw Error('Stretched body triangle: '+edge);}
for(let i=0;i<o.geometry.attributes.skinWeight.count;i++){let sum=0;for(let c=0;c<4;c++)sum+=o.geometry.attributes.skinWeight.getComponent(i,c);if(Math.abs(sum-1)>.001)throw Error('Invalid skin weights')}}});return {style:rig.style,triangles,skinned};});
 });
 assert.equal(new Set(data.map(d=>d.style)).size,4);assert.ok(data.every(d=>d.skinned===7&&d.triangles<65000));
 for(const view of ['standing','walking','greeting','seated']){
  console.log('Rendering crowd:',view);
  await page.evaluate(view=>{const a=window.__CROWD_REVIEW__;a.setView(view);a.renderer.setAnimationLoop(null);a.renderer.render(a.scene,a.camera)},view);
  await page.screenshot({path:`artifacts/crowd/${view}.png`});
 }
 for(let i=0;i<4;i++){
  await page.evaluate(i=>{const a=window.__CROWD_REVIEW__;a.setView('standing');a.people.forEach(({rig,sitting},j)=>{rig.g.visible=j===i;sitting.g.visible=false});const rig=a.people[i].rig;rig.g.position.x=0;a.camera.position.set(.85,1.3,3.5);a.camera.lookAt(0,.95,0);a.renderer.render(a.scene,a.camera)},i);
  await page.screenshot({path:`artifacts/crowd/style-${i}.png`});
 }
 assert.deepEqual(errors,[]);console.log('Crowd checks passed:',JSON.stringify(data));
}finally{await browser.close()}
