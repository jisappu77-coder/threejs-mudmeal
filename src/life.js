import * as THREE from 'three';

// Traffic stays on authored roads; pedestrians use short, checked routes on solid ground.
export function createWorldLife(h){
 const {npcs,vehicles,bikes,player,plots,plantings,roadDistance,waterAt,plotBlocked,windTime,windStrength,sun}=h;
 const mod=(n,m)=>(n%m+m)%m;
 const roads=[h.extendedWorld.centerline];
 const lengths=roads.map(r=>r.getLength()),traffic=[];
 const forward=new THREE.Vector3(),playerLast=player.position.clone(),playerWheels=[];
 player.traverse(o=>{if(o.userData.wheelRadius)playerWheels.push(o)});
 function nearestS(g,road){let best=Infinity,s=0;for(let i=0;i<=1200;i++){const t=i/1200,p=roads[road].getPointAt(t),d=(p.x-g.position.x)**2+(p.z-g.position.z)**2;if(d<best){best=d;s=t*lengths[road];}}return s;}
 function addTraffic(g,type,road,s,direction){
  const {width,length}=g.userData.footprint;

  const wheels=[];g.traverse(o=>{if(o.userData.wheelRadius)wheels.push(o)});
  const v={g,type,road,s,direction,width,length,speed:0,cruise:({bus:7,auto:7.5,car:10,van:8.5,bike:10.5})[type],wheels};traffic.push(v);return v;
 }
 for(const v of vehicles)addTraffic(v.g,v.type,0,nearestS(v.g,0),v.x-h.roadPoints.reduce((p,q)=>Math.abs(q[1]-v.z)<Math.abs(p[1]-v.z)?q:p)[0]<0?-1:1);
 for(const g of bikes.filter(g=>g!==player))addTraffic(g,'bike',0,nearestS(g,0),-1);
 for(let i=0;i<18;i++){const type=['auto','car','van'][i%3],road=0,direction=i%2?1:-1,g=h.vehicle(type,0,0,0,['#bf5841','#d4dfd8','#e7cb94'][i%3]);addTraffic(g,type,road,(i+.5)/18*lengths[road],direction);}
 function pose(v){
  const t=THREE.MathUtils.clamp(v.s/lengths[v.road],0,1),p=roads[v.road].getPointAt(t),a=roads[v.road].getTangentAt(t),normal=new THREE.Vector3(a.z,0,-a.x).normalize();
  v.g.position.copy(p).addScaledVector(normal,v.direction*2.1);v.g.position.y=Math.max(.02,p.y-.14);
  v.g.rotation.set(Math.atan2(a.y*v.direction,Math.hypot(a.x,a.z)),Math.atan2(-a.x*v.direction,-a.z*v.direction),0,'YXZ');
 }
 function rectangleDistance(position,v){const dx=position.x-v.g.position.x,dz=position.z-v.g.position.z,c=Math.cos(v.g.rotation.y),s=Math.sin(v.g.rotation.y);return Math.hypot(Math.max(0,Math.abs(dx*c-dz*s)-v.width/2),Math.max(0,Math.abs(dx*s+dz*c)-v.length/2));}
 function overlaps(a,b,margin=0){
  if(Math.abs(a.g.position.y-b.g.position.y)>2)return false;
  const axes=v=>[new THREE.Vector2(Math.cos(v.g.rotation.y),-Math.sin(v.g.rotation.y)),new THREE.Vector2(Math.sin(v.g.rotation.y),Math.cos(v.g.rotation.y))],aa=axes(a),bb=axes(b),delta=new THREE.Vector2(b.g.position.x-a.g.position.x,b.g.position.z-a.g.position.z);
  return [...aa,...bb].every(axis=>Math.abs(delta.dot(axis))<(Math.abs(aa[0].dot(axis))*a.width+Math.abs(aa[1].dot(axis))*a.length+Math.abs(bb[0].dot(axis))*b.width+Math.abs(bb[1].dot(axis))*b.length)/2+margin);
 }
 function riderFootprint(position=player.position){return {g:{position,rotation:player.rotation},width:player.userData.footprint.width,length:player.userData.footprint.length};}
 function blocked(position,radius=.62,ignore=player){
  if(ignore===player){if(traffic.some(v=>overlaps(riderFootprint(position),v,.1)))return true;}
  else if(traffic.some(v=>v.g!==ignore&&Math.abs(v.g.position.y-position.y)<2&&rectangleDistance(position,v)<radius))return true;
  if(ignore!==player&&Math.abs(player.position.y-position.y)<2&&position.distanceTo(player.position)<radius+.65)return true;
  return false;
 }
 // Resolve crowded initial spawns instead of starting vehicles inside one another.
 for(const road of [0])for(const direction of [-1,1]){
  const lane=traffic.filter(v=>v.road===road&&v.direction===direction).sort((a,b)=>a.s-b.s);
  let previous=null;
  for(const v of lane){if(previous)v.s=Math.max(v.s,previous.s+(previous.length+v.length)/2+1.7);v.s=Math.min(v.s,lengths[road]-v.length/2-1);pose(v);previous=v;}
 }
 const initialized=[];
 for(const v of traffic){for(let attempt=0;attempt<100;attempt++){
  pose(v);const collision=initialized.some(other=>overlaps(v,other,.3))||overlaps(v,riderFootprint(),.25);
  if(!collision)break;v.s=mod(v.s+2,lengths[v.road]);
 }initialized.push(v);v.initialS=v.s;}
 const occupied=npcs;
 function walkable(p,ignoreHome){
  if(ignoreHome&&Math.abs(h.floorAt(p.x,p.z)-ignoreHome.home.y)>.3)return false;
  if(waterAt(p.x,p.z)||h.roadClearance(p.x,p.z)<.25||plotBlocked(p.x,p.z,.28)||plantings.some(t=>Math.hypot(p.x-t.x,p.z-t.z)<Math.min(.75,t.radius)+.25))return false;
  if(occupied.some(n=>n!==ignoreHome&&p.distanceTo(n.home)<.65))return false;
  return true;
 }
 function safeSegment(a,b,n){for(let i=0;i<=16;i++)if(!walkable(a.clone().lerp(b,i/16),n))return false;return true;}
 for(const n of npcs){
  n.exit=n.home.clone();if(n.sitting)n.exit.z+=.85;n.exit.y=h.floorAt(n.exit.x,n.exit.z);
  n.path=[n.exit.clone()];n.wait=n.variant*.63;n.state=n.sitting?'sitting':'idle';n.distance=0;n.wave=0;
  // A seated NPC exits behind their chair; their dining pose stays aligned to the table.
  for(let attempt=0;attempt<96;attempt++){
   const angle=attempt%32,distance=[2.6,1.6,.8][Math.floor(attempt/32)];
   const a=(angle+n.variant*3)*Math.PI/16,target=n.exit.clone().add(new THREE.Vector3(Math.cos(a)*distance,0,Math.sin(a)*distance));
   target.y=h.floorAt(target.x,target.z);if(safeSegment(n.exit,target,n)){n.path.push(target);break;}
  }
  n.pathLength=n.path.length>1?n.path[0].distanceTo(n.path[1]):0;

 }
 function animateRig(rig,stride,time,walking,wave,seatedBlend){
  if(rig.animate){rig.animate(stride,time,walking,wave,seatedBlend);return;}
  rig.torso.position.y=Math.sin(time*2.1)*.007+(walking?Math.sin(stride*2)*.015:0);
  rig.head.rotation.y=Math.sin(time*.55)*.12;
  for(let i=0;i<2;i++){
   const phase=stride+i*Math.PI;
   rig.legs[i].rotation.x=walking?Math.sin(phase)*.33:0;
   rig.knees[i].rotation.x=walking?Math.max(0,-Math.sin(phase))*.42:0;
   rig.arms[i].rotation.x=walking?-Math.sin(phase)*.22:Math.sin(time*1.3+i)*.025;
   rig.arms[i].rotation.z=i===1?-wave*.85:0;
   rig.elbows[i].rotation.x=i===1?-wave*2.1:0;
   rig.elbows[i].rotation.z=i===1?wave*(Math.sin(time*7)*.14):0;
  }
 }
 function updateNPC(n,dt,time){
  n.wait+=dt;
  const close=n.g.position.distanceTo(player.position)<9,walking=n.state==='walking';
  n.wave=THREE.MathUtils.damp(n.wave,close&&!walking&&Math.sin(time*.45+n.variant)>-.25?1:0,5,dt);
  if(n.state==='rising'){
   const t=Math.min(1,n.wait/.9);n.g.position.copy(n.home).lerp(n.exit,t);n.standing.g.position.y=n.standing.restY+(n.sitting.animate?n.sitting.restY:-.29)*(1-t);
   if(t===1){n.state='walking';n.wait=0;n.distance=0;}
  }else if(n.state==='walking'){
   const total=n.pathLength*2,advance=.62*dt,proposed=Math.min(total,n.distance+advance),outward=proposed<=n.pathLength;
   const p=n.path[0].clone().lerp(n.path[1],outward?proposed/n.pathLength:2-proposed/n.pathLength);p.y=h.floorAt(p.x,p.z);
   if(!npcs.some(other=>other!==n&&Math.abs(other.g.position.y-p.y)<1&&other.g.position.distanceTo(p)<.55)&&p.distanceTo(player.position)>1){
    n.distance=proposed;n.g.position.copy(p);const d=n.path[1].clone().sub(n.path[0]).multiplyScalar(outward?1:-1),angle=Math.atan2(d.x,d.z);
    n.g.rotation.y+=(THREE.MathUtils.euclideanModulo(angle-n.g.rotation.y+Math.PI,Math.PI*2)-Math.PI)*Math.min(1,dt*8);
   }
   if(n.distance>=total){n.state=n.sitting?'sitting-down':'idle';n.wait=0;}
  }else if(n.state==='sitting-down'){
   const t=Math.min(1,n.wait/.9);n.g.position.copy(n.exit).lerp(n.home,t);n.g.rotation.y=n.homeAngle;n.standing.g.position.y=n.standing.restY+(n.sitting.animate?n.sitting.restY:-.29)*t;
   if(t===1){n.state='sitting';n.wait=0;n.sitting.g.visible=true;n.standing.g.visible=false;}
  }else if(n.wait>12+n.variant%7&&n.pathLength){
   n.state=n.sitting?'rising':'walking';n.wait=0;n.distance=0;n.standing.g.visible=true;if(n.sitting)n.sitting.g.visible=false;
  }
  const rig=n.sitting&&n.state==='sitting'?n.sitting:n.standing;
  const seatedBlend=n.state==='sitting'?1:n.state==='rising'?1-Math.min(1,n.wait/.9):n.state==='sitting-down'?Math.min(1,n.wait/.9):0;
  animateRig(rig,n.distance*8,time+n.variant,n.state==='walking',n.wave,seatedBlend);
  if(n.sitting&&n.state==='sitting'&&!rig.animate)rig.elbows[0].rotation.x=Math.sin(time*1.1+n.variant)*.12;
  if(close&&n.state==='idle'){
   const angle=Math.atan2(player.position.x-n.g.position.x,player.position.z-n.g.position.z);n.g.rotation.y+=(mod(angle-n.g.rotation.y+Math.PI,Math.PI*2)-Math.PI)*Math.min(1,dt*4);
  }
  n.g.userData.activity=n.state;n.g.userData.waving=n.wave>.5;
 }
 let shadowTime=0;
 function update(dt,time){
  windTime.value=time;windStrength.value=h.extendedWorld.weather==='rain'?1.8:1;
  const playerStep=player.position.distanceTo(playerLast);if(playerStep<3)for(const wheel of playerWheels)wheel.rotation.x-=playerStep/(wheel.userData.rollingRadius||wheel.userData.wheelRadius);playerLast.copy(player.position);
  for(const n of npcs)updateNPC(n,dt,time);
  for(const v of traffic){
   const length=lengths[v.road];let gap=Infinity;
   for(const other of traffic)if(other!==v&&other.road===v.road&&other.direction===v.direction){const d=mod((other.s-v.s)*v.direction,length);gap=Math.min(gap,d-(v.length+other.length)/2-1.5);}
   forward.set(-Math.sin(v.g.rotation.y),0,-Math.cos(v.g.rotation.y));
   for(const obstacle of [player,...traffic.filter(o=>o!==v).map(o=>o.g)]){
    if(Math.abs(obstacle.position.y-v.g.position.y)>2)continue;
    const delta=obstacle.position.clone().sub(v.g.position),ahead=delta.dot(forward),side=Math.abs(delta.x*forward.z-delta.z*forward.x);
    const other=traffic.find(o=>o.g===obstacle),otherHalf=other?other.length/2:player.userData.footprint.length/2;
    if(ahead>0&&side<v.width/2+(other?other.width/2:.6)+.15)gap=Math.min(gap,ahead-v.length/2-otherHalf-1.1);
   }
   const wet=h.extendedWorld.weather==='rain',braking=wet?2.8:4.5,grip=(v.type==='bus'?1.7:v.type==='auto'?2.1:3)*(wet?.6:1);
   const road=roads[v.road],t=v.s/lengths[v.road],lookAhead=Math.max(4,v.speed*1.2),nextT=mod(t+v.direction*lookAhead/lengths[v.road],1),tangent=road.getTangentAt(t),future=road.getTangentAt(nextT);
   const angle=Math.atan2(tangent.x*future.z-tangent.z*future.x,tangent.x*future.x+tangent.z*future.z),curveLimit=Math.sqrt(grip/Math.max(.0001,Math.abs(angle)/lookAhead));
   const followLimit=Number.isFinite(gap)?Math.max(0,-braking*.8+Math.sqrt(braking*braking*.64+2*braking*Math.max(0,gap))):v.cruise;
   const desired=Math.min(v.cruise,curveLimit,followLimit),acceleration=v.type==='bus'?.85:v.type==='bike'?2.5:1.7;
   v.speed+=THREE.MathUtils.clamp(desired-v.speed,-braking*dt,Math.max(.25,acceleration-9.81*tangent.y*v.direction)*dt);
   let step=Math.min(v.speed*dt,Math.max(0,gap));const oldS=v.s,before=v.g.position.clone();
   // Closed roads wrap continuously at the same physical point.
   v.s=mod(v.s+step*v.direction,length);pose(v);
   if(traffic.some(other=>other!==v&&overlaps(v,other,.05))||overlaps(v,riderFootprint(),.1)){v.s=oldS;v.speed=0;step=0;pose(v);}
   for(const wheel of v.wheels)wheel.rotation.x-=step/(wheel.userData.rollingRadius||wheel.userData.wheelRadius);
   if(before.distanceTo(v.g.position)>20){v.speed=0;}
  }
  shadowTime+=dt;if(shadowTime>.1){sun.shadow.needsUpdate=true;shadowTime=0;}
 }
 function reset(){
  for(const v of traffic){v.s=v.initialS;v.speed=0;pose(v);for(const w of v.wheels)w.rotation.x=0;}
  for(const n of npcs){n.g.position.copy(n.home);n.g.rotation.y=n.homeAngle;n.wait=n.variant*.63;n.distance=0;n.wave=0;n.state=n.sitting?'sitting':'idle';n.standing.g.position.y=n.standing.restY;n.standing.g.visible=!n.sitting;if(n.sitting)n.sitting.g.visible=true;animateRig(n.standing,0,0,false,0);if(n.sitting)animateRig(n.sitting,0,0,false,0);}
  playerLast.copy(player.position);for(const wheel of playerWheels)wheel.rotation.x=0;windTime.value=0;sun.shadow.needsUpdate=true;
 }
 function aheadDistance(position,heading,maxDistance=30){
  const direction=new THREE.Vector3(-Math.sin(heading),0,-Math.cos(heading));let distance=maxDistance;
  for(const v of traffic){
   if(Math.abs(v.g.position.y-position.y)>2)continue;
   const delta=v.g.position.clone().sub(position),ahead=delta.dot(direction),side=Math.abs(delta.x*direction.z-delta.z*direction.x);
   if(ahead>0&&side<v.width/2+.55)distance=Math.min(distance,Math.max(0,ahead-v.length/2-player.userData.footprint.length/2));
  }
  return distance;
 }
 function audit(){return {plantsInRoad:plantings.filter(p=>h.roadClearance(p.x,p.z)<p.radius+.35),plantsInBuildings:plantings.filter(p=>plotBlocked(p.x,p.z,p.radius,true)),plantsInWater:plantings.filter(p=>waterAt(p.x,p.z)),pedestrians:npcs.length,walkingRoutes:npcs.filter(n=>n.pathLength>0).length,traffic:traffic.length};}
 return {update,reset,blocked,aheadDistance,traffic,npcs,audit,walkable,overlaps,riderFootprint,roads,pose};
}
