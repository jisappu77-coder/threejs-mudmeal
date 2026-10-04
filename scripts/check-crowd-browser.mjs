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
 const contacts=await page.evaluate(()=>{
  const a=window.__CROWD_REVIEW__,rig=a.people[0].rig,V=a.camera.position.constructor;
  rig.animate(0,0,false,0);const handRest=rig.bones.hand_r.getWorldPosition(new V()).z;
  const footAt=phase=>{rig.animate(phase*Math.PI*2,0,true,0);return rig.bones.foot_r.getWorldPosition(new V()).add(new V(0,0,phase*Math.PI*2/8));};
  const planted=footAt(.1),armBack=rig.bones.hand_r.getWorldPosition(new V()).z<handRest;
  footAt(.4);const armForward=rig.bones.hand_r.getWorldPosition(new V()).z>handRest;
  const later=footAt(.2),slip=planted.distanceTo(later);
  rig.animate(.8*Math.PI*2,0,true,0);const clearance=rig.bones.foot_r.getWorldPosition(new V()).y-planted.y;
  rig.ride();
  const errors=[];for(const [side,sign]of [['l',1],['r',-1]]){
   for(const [joint,target]of [['hand',new V(sign*.249,.8844,.5636)],['foot',new V(sign*.285,.368,.0155)]]){
    errors.push(gPosition(joint+'_'+side).distanceTo(target));
   }
  }
  function gPosition(name){return rig.g.worldToLocal(rig.bones[name].getWorldPosition(new V()));}
  a.setView('standing');return {slip,clearance,oppositeArmSwing:armBack&&armForward,riderContactErrors:errors};
 });
 assert.equal(contacts.oppositeArmSwing,true,'Arms must counter the legs');
 assert.ok(contacts.slip<.012,'Planted foot slides: '+contacts.slip);
 assert.ok(contacts.clearance>.06,'Swing foot does not clear the ground');
 assert.ok(contacts.riderContactErrors.every(error=>error<.025),'Rider misses grips or footrests: '+JSON.stringify(contacts));
 console.log('Foot planting and rider contact:',JSON.stringify(contacts));
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
