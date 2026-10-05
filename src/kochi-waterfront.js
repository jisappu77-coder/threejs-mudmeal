import * as THREE from 'three';
import {createKeralaRoof,createLeafGeometry} from './real-map-art.js';
import {pointInPolygon,segmentDistance,reachableRoads} from './real-map-data.js';

// The restaurant is original scenery on clear land, with an original shore and street layout.
export function planWaterfront(map){
 const inWater=map.waterAt;
 const inBuilding=(x,z,r)=>map.buildings.some(b=>pointInPolygon(x,z,b.points)||b.points.some((p,i)=>segmentDistance(x,z,p,b.points[(i+1)%b.points.length])<r));
 // Use a short frontage chord on each curve; individual samples are too short for a restaurant.
 const frontages=map.roads.filter(r=>r.name==='Waterfront Road').flatMap(r=>r.points.slice(0,-2).map((a,i)=>({a,b:r.points[i+2],width:r.width,name:r.name})));
 const preferred=map.landmarks.find(p=>p.kind==='restaurant')?.point||{x:0,z:0};
 const roads=frontages.sort((a,b)=>Math.hypot((a.a.x+a.b.x)/2-preferred.x,(a.a.z+a.b.z)/2-preferred.z)-Math.hypot((b.a.x+b.b.x)/2-preferred.x,(b.a.z+b.b.z)/2-preferred.z));
 for(const s of roads){
  const length=Math.hypot(s.b.x-s.a.x,s.b.z-s.a.z),tx=(s.b.x-s.a.x)/length,tz=(s.b.z-s.a.z)/length;
  for(let d=8;d<length-8;d+=3)for(const side of [-1,1]){
   const nx=tz*side,nz=-tx*side,offset=s.width/2+15,x=s.a.x+tx*d+nx*offset,z=s.a.z+tz*d+nz*offset;
   let clear=true;
   for(let u=-16;u<=16;u+=1.5)for(let v=-11;v<=11;v+=1.5){const px=x+tx*u+nx*v,pz=z+tz*u+nz*v,near=map.nearestRoad(px,pz);if(inWater(px,pz)||inBuilding(px,pz,1)||near.distance<near.segment.width/2+2)clear=false;}
   if(!clear)continue;
   const street={x:s.a.x+tx*d,z:s.a.z+tz*d};
   if(![40,60,80].some(f=>inWater(street.x-nx*f,street.z-nz*f)))continue;
   return {x,z,tx,tz,nx:-nx,nz:-nz,width:32,depth:34,angle:Math.atan2(-nx,-nz),street,segment:s,spawn:{x:street.x+tx*8-tz*s.width/4,z:street.z+tz*8+tx*s.width/4},heading:Math.atan2(tx,tz)};
  }
 }
 throw Error('No clear authored waterfront site for the restaurant');
}

export function createWaterfront({scene,map,art,site}){
 const batches=new Map(),solids=[],obstacles=[],vendors=[],boats=[],outdoorLots=[],stats={fishingNets:0,boats:0,palms:0,quayMetres:0,restaurant:1,marketStalls:0};
 const box=new THREE.BoxGeometry(1,1,1),cylinder=new THREE.CylinderGeometry(1,1,1,10),sphere=new THREE.SphereGeometry(1,12,8),dummy=new THREE.Object3D();
 const wood=art.mat('#5f3e28',art.textures.wood),stone=art.mat('#746d5e',art.textures.gravel),plaster=art.walls[0],white=art.walls[3],blue=art.mat('#56889b'),cloth=art.mat('#e8c773'),clay=art.mat('#b7653b'),brass=art.mat('#bc9655',null,.42),flower=art.mat('#cf417f'),warm=art.mat('#ffdd85');
 warm.emissive=new THREE.Color('#f0a33a');warm.emissiveIntensity=.65;
 const green=art.mat('#2b5144',art.textures.wood),black=art.metal;
 const local=(u,v,y=0)=>new THREE.Vector3(site.x+Math.cos(site.angle)*u*1.7+Math.sin(site.angle)*v*1.25,y*1.1,site.z-Math.sin(site.angle)*u*1.7+Math.cos(site.angle)*v*1.25);
 function put(g,m,p,s=[1,1,1],rot=[0,0,0],order='XYZ'){
  const key=g.uuid+m.uuid+Math.floor(p[0]/48)+','+Math.floor(p[2]/48);
  if(!batches.has(key))batches.set(key,{g,m,items:[]});dummy.position.set(...p);dummy.scale.set(...s);dummy.rotation.set(...rot,order);dummy.updateMatrix();batches.get(key).items.push(dummy.matrix.clone());
 }
 const cube=(m,p,s,angle=0)=>put(box,m,p,s,[0,angle,0]);
 function bar(m,a,b,r=.05){const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),e=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),vb.clone().sub(va).normalize()));put(cylinder,m,va.clone().add(vb).multiplyScalar(.5).toArray(),[r,va.distanceTo(vb),r],[e.x,e.y,e.z]);}
 function at(m,u,y,v,w,h,d){cube(m,local(u,v,y).toArray(),[w*1.7,h*1.1,d*1.25],site.angle);}
 function atBar(m,a,b,r){bar(m,local(a[0],a[2],a[1]).toArray(),local(b[0],b[2],b[1]).toArray(),r);}
 function solid(u,v,w,d){const p=local(u,v);solids.push({x:p.x,z:p.z,tx:Math.cos(site.angle),tz:-Math.sin(site.angle),nx:Math.sin(site.angle),nz:Math.cos(site.angle),width:w*1.7,depth:d*1.25});}
 // Reserve the public quay for promenade furniture, rather than residential infill.
 const quayRoad=map.roads.find(r=>r.name==='Waterfront Road'),quay=[...quayRoad.points.map(p=>({x:p.x+6.7,z:p.z})),...quayRoad.points.slice().reverse().map(p=>({x:p.x+17,z:p.z}))];
 const solidAt=(x,z,r=0)=>solids.some(s=>Math.abs((x-s.x)*s.tx+(z-s.z)*s.tz)<s.width/2+r&&Math.abs((x-s.x)*s.nx+(z-s.z)*s.nz)<s.depth/2+r);
 const reservedAt=(x,z,r=0)=>pointInPolygon(x,z,quay)||(Math.abs((x-site.x)*site.tx+(z-site.z)*site.tz)<site.width/2+r&&Math.abs((x-site.x)*site.nx+(z-site.z)*site.nz)<site.depth/2+r)||outdoorLots.some(p=>Math.abs((x-p.x)*p.tx+(z-p.z)*p.tz)<p.width/2+r&&Math.abs((x-p.x)*p.nx+(z-p.z)*p.nz)<p.depth/2+r);
 function sign(text,u,y,v,w,h,bg='#68442b'){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const c=canvas.getContext('2d');c.fillStyle=bg;c.fillRect(0,0,1024,256);c.strokeStyle='#eccf83';c.lineWidth=7;c.strokeRect(12,12,1000,232);c.textAlign='center';c.textBaseline='middle';c.fillStyle='#ffe6a1';const lines=text.split('\n');c.font=`bold ${lines.length>1?70:100}px Arial`;lines.forEach((line,i)=>c.fillText(line,512,128+(i-(lines.length-1)/2)*90,960));const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w*1.7,h*1.1),new THREE.MeshStandardMaterial({map:texture,roughness:.8}));mesh.position.copy(local(u,v,y));mesh.rotation.y=site.angle;scene.add(mesh);return mesh;
 }
 function roof(u,v,w,d,y){const p=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([x,z])=>({x:x+u,z:z+v})),r=createKeralaRoof(p,y);const mesh=new THREE.Mesh(r.geometry,art.tile);mesh.position.set(site.x,0,site.z);mesh.rotation.y=site.angle;mesh.scale.set(1.7,1.1,1.25);mesh.castShadow=mesh.receiveShadow=true;scene.add(mesh);for(const [i,a]of r.eaves.entries()){const b=r.eaves[(i+1)%4];atBar(wood,[a.x,a.y-.1,a.z],[b.x,b.y-.1,b.z],.08);const length=a.distanceTo(b);for(let t=.2;t<length;t+=.5){const q=a.clone().lerp(b,t/length);atBar(wood,[q.x,q.y-.16,q.z],[q.x*.96,q.y+.15,q.z*.96],.045);}}}
 // Open takeaway frontage, detailed upper shutters and a deep veranda.
 at(art.paving,0,.04,0,18,.08,16);at(stone,0,.18,-2,12.4,.36,8.4);solid(0,-2,12,8);
 at(plaster,0,3.4,-5.9,12,6.4,.28);for(const u of [-5.85,5.85])at(plaster,u,3.4,-2,.3,6.4,8);
 at(plaster,0,5.05,2,12,2.8,.24);at(white,0,3.6,-2,12,.22,8);at(white,0,6.5,-2,12.2,.22,8.2);
 roof(0,-2,12.2,8.2,6.7);roof(0,3.75,12.6,3.6,3.35);
 for(const u of [-5.8,-2.9,0,2.9,5.8]){at(wood,u,1.65,5.3,.15,3.1,.15);at(white,u,.28,5.3,.35,.45,.35);solid(u,5.3,.2,.2);}
 for(const u of [-4,-1.3,1.3,4]){
  at(wood,u,5.15,2.18,1.65,2,.13);at(art.glass,u,5.15,2.26,1.38,1.7,.04);at(wood,u,5.15,2.30,.065,1.75,.06);
  for(const side of [-1,1]){at(green,u+side*1.03,5.15,2.17,.45,1.98,.13);for(let j=0;j<8;j++)at(wood,u+side*1.03,4.35+j*.22,2.25,.4,.055,.04);}
  at(white,u,4.03,2.25,2.05,.14,.42);
 }
 at(wood,0,4,2.6,11.4,.10,1.0);for(let u=-5.5;u<=5.5;u+=.45){at(wood,u,4.45,3.04,.045,.9,.045);}at(wood,0,4.9,3.04,11.2,.07,.07);
 sign('MUD MEALS\nമഡ് മീൽസ്',0,3.55,5.85,6.2,1.35);
 at(wood,0,1,2.1,10.8,1.6,.22);at(cloth,0,1.85,2.18,10.8,.15,.65);
 for(const u of [-4,-1,2,4.6]){at(wood,u,2.5,2.18,.1,1.25,.1);at(wood,u,2.7,-3.4,2.4,.12,.6);for(let j=0;j<4;j++){put(sphere,brass,local(u-.7+j*.45,-3.35,2.9).toArray(),[.17,.21,.17]);}}
 for(const u of [-4.5,0,4.5]){atBar(black,[u,3.3,3.8],[u,2.75,3.8],.02);put(sphere,warm,local(u,3.8,2.65).toArray(),[.13,.19,.13]);put(cylinder,brass,local(u,3.8,2.85).toArray(),[.28,.08,.28]);}
 at(white,0,.09,6.0,11.5,.18,1.0);at(white,0,.04,6.6,11.8,.08,.4);
 sign('PICKUP · TAKEAWAY',3.4,1.15,6.9,2.7,.65,'#244d3c');sign('CHAYA\nSNACKS · MEALS',6.7,1.7,4.2,1.65,2.35,'#254438');
 for(let u=23;u<=28;u+=1)cube(white,[site.street.x+site.tx*u,.097,site.street.z+site.tz*u],[8.5,.015,.5],Math.atan2(site.tx,site.tz));
 for(const u of [7.4])for(const v of [-5.6,1,5.4]){put(cylinder,clay,local(u,v,.35).toArray(),[.42,.7,.42]);put(sphere,art.leaves[1],local(u,v,.98).toArray(),[.65,.45,.65]);solid(u,v,.65,.65);}
 for(const u of [-2.7,2.7]){const p=local(u,3.2);vendors.push({x:p.x,z:p.z,angle:site.angle});}
 // A traversable dirt service passage leads around the restaurant to the street.
 at(art.mat('#ffffff',art.textures.dirt),-7.6,.09,-.5,2.2,.05,13);const servicePath={a:local(-7.6,-7),b:local(-7.6,6),width:3.74};
 const palmSpine=createLeafGeometry(3.5,.018,1.15),palmLeaflet=createLeafGeometry(.78,.05,.15);
 function palm(x,z,h=8){
  if(map.buildings.some(b=>pointInPolygon(x,z,b.points)))return;const near=map.nearestRoad(x,z);if(near.distance<near.segment.width/2+.8)return;
  for(let i=0;i<10;i++)bar(wood,[x+.25*(i/10)**2,h*i/10,z],[x+.25*((i+1)/10)**2,h*(i+1)/10,z],.14-i*.004);
  for(let i=0;i<10;i++){const a=i*Math.PI/5;put(palmSpine,art.leaves[i%4],[x+.25,h,z],[1,1,1],[0,a,0]);for(let j=1;j<15;j++){const t=j/16,dist=t*3.5;for(const side of [-1,1])put(palmLeaflet,art.leaves[(j+i)%4],[x+.25+Math.sin(a)*dist,h+Math.sin(t*Math.PI)*.73-t*t*1.15,z+Math.cos(a)*dist],[1,1,Math.sin(t*Math.PI)*1.1],[.2,a+side*1.18,-side*.2]);}}
  obstacles.push({x,z,radius:.22,kind:'waterfront-palm'});stats.palms++;
 }
 for(const u of [-8,8]){const p=local(u===-8?-6:u,-7.3);palm(p.x,p.z,8.8);}
 const groundClear=(x,z,r=0)=>!map.waterAt(x,z)&&!map.buildings.some(b=>pointInPolygon(x,z,b.points)||b.points.some((p,i)=>segmentDistance(x,z,p,b.points[(i+1)%b.points.length])<r));
 for(const u of [-60,-45,-30,-15,0,15,30,45])for(const v of [-25,-28]){
  const p=local(u,v),near=map.nearestRoad(p.x,p.z);
  if(groundClear(p.x,p.z,2)&&!reservedAt(p.x,p.z,2)&&!solidAt(p.x,p.z,2)&&near.distance>near.segment.width/2+4)palm(p.x,p.z,8+Math.abs(u)%3);
 }
 // The latest street references put dining tables on the café-side pavement.
 const terrace=local(0,9);
 if(groundClear(terrace.x,terrace.z,.2)){
  at(art.paving,0,.06,9,18,.1,4);
  for(const u of [-5,5])for(const v of [8.2,9.8]){
   at(wood,u,.75,v,1.5,.12,1.5);at(black,u,.38,v,.15,.75,.15);solid(u,v,1.5,1.5);
   for(const side of [-1,1]){at(wood,u+side*1.3,.48,v,.55,.12,.65);at(wood,u+side*1.3,.8,v+.28,.55,.6,.08);solid(u+side*1.3,v,.6,.7);}
   atBar(black,[u,0,v],[u,3,v],.035);
   put(new THREE.ConeGeometry(2,.6,8),cloth,local(u,v,3).toArray(),[1,1,1]);
  }
  for(const u of [-9,9])for(const v of [7.4,10.4]){put(cylinder,clay,local(u,v,.35).toArray(),[.4,.7,.4]);put(sphere,art.leaves[1],local(u,v,1).toArray(),[.7,.6,.7]);solid(u,v,.8,.8);}
  outdoorLots.push({x:terrace.x,z:terrace.z,tx:Math.cos(site.angle),tz:-Math.sin(site.angle),nx:Math.sin(site.angle),nz:Math.cos(site.angle),width:34,depth:6});
  stats.terraces=1;
 }
 // A paved service courtyard connects the rear of the café to adjoining buildings.
 for(let u=-30;u<=30;u+=2.5)for(let v=-22;v>=-31;v-=2.5){
  const p=local(u,v),corners=[[-1.25,-1.25],[1.25,-1.25],[1.25,1.25],[-1.25,1.25]].map(([du,dv])=>local(u+du,v+dv));
  if(corners.every(q=>groundClear(q.x,q.z,.1)&&map.nearestRoad(q.x,q.z).distance>7))cube(art.paving,[p.x,.055,p.z],[4.26,.08,3.14],site.angle);
 }
 // Low canal decks keep the riding surface level; rails leave the full road corridor clear.
 stats.bridges=map.bridges.length;
 for(const bridge of map.bridges){
  const {x,z,width,length}=bridge,side=width/2+1.3;
  cube(stone,[x,.03,z],[side*2,.06,length]);
  for(const sign of [-1,1]){
   bar(white,[x+sign*side,.9,z-length/2],[x+sign*side,.9,z+length/2],.08);
   for(let d=-length/2;d<=length/2;d+=2){
    cube(white,[x+sign*side,.45,z+d],[.18,.9,.18]);
    obstacles.push({x:x+sign*side,z:z+d,radius:.12,kind:'bridge-rail'});
   }
  }
 }
 // A checked public plaza gives the open shore a purpose without inventing a new road.
 for(let u=-20;u<=24;u+=3)for(let v=7;v<=24;v+=3){const x=site.street.x+site.tx*u+site.nx*v,z=site.street.z+site.tz*u+site.nz*v,n=map.nearestRoad(x,z);if(n.distance>n.segment.width/2+3&&[-1,1].every(a=>[-1,1].every(b=>groundClear(x+site.tx*a*1.5+site.nx*b*1.5,z+site.tz*a*1.5+site.nz*b*1.5))))cube(art.paving,[x,.04,z],[3.02,.075,3.02],site.angle);}
 for(let i=0;i<40&&stats.marketStalls<4;i++){
  const targetZ=site.street.z+25+i*9,s=map.segments.find(s=>s.name==='Waterfront Road'&&s.a.z<=targetZ&&s.b.z>=targetZ);if(!s)continue;
  const length=Math.hypot(s.b.x-s.a.x,s.b.z-s.a.z),outX=(s.b.z-s.a.z)/length,outZ=-(s.b.x-s.a.x)/length,t=(targetZ-s.a.z)/(s.b.z-s.a.z),x=THREE.MathUtils.lerp(s.a.x,s.b.x,t)+outX*11,z=targetZ+outZ*11,n=map.nearestRoad(x,z),nx=-outX,nz=-outZ,angle=Math.atan2(nx,nz),tx=Math.cos(angle),tz=-Math.sin(angle),p=(u,y,v)=>[x+tx*u+nx*v,y,z+tz*u+nz*v];
  if(n.distance<n.segment.width/2+4||![-2.8,0,2.8].every(u=>[-2.3,0,2.3].every(v=>groundClear(x+tx*u+nx*v,z+tz*u+nz*v,.4))))continue;
  outdoorLots.push({x,z,tx,tz,nx,nz,width:5.6,depth:4.6});cube(wood,p(0,1.1,-1.5),[4.6,2.2,.12],angle);cube(wood,p(0,.6,1.3),[4.3,1.2,.65],angle);for(const [v,width,depth]of [[-1.5,4.6,.12],[1.3,4.3,.65]]){const q=p(0,0,v);solids.push({x:q[0],z:q[2],tx,tz,nx,nz,width,depth});}
  put(box,art.tile,p(0,2.8,0),[5.2,.16,4.1],[.16,angle,0],'YXZ');for(const side of [-1,1])for(const v of [-1.6,1.6]){bar(wood,p(side*2.3,0,v),p(side*2.3,2.8,v),.07);const q=p(side*2.3,0,v);obstacles.push({x:q[0],z:q[2],radius:.12,kind:'market-post'});}
  for(let stripe=0;stripe<12;stripe++)put(box,stripe%2?white:blue,p(-2.35+stripe*.42,2.4,2.0),[.42,.10,1.3],[.16,angle,0],'YXZ');
  for(let j=0;j<3;j++){cube(clay,p(-1.4+j*1.4,1.24,1.3),[1.15,.15,.65],angle);for(let k=0;k<8;k++)put(sphere,i%2?cloth:art.leaves[1],p(-1.7+j*1.4+(k%4)*.2,1.4,1.1+Math.floor(k/4)*.2),[.10,.11,.10]);}
  const q=p(0,.03,.1);vendors.push({x:q[0],z:q[2],angle});stats.marketStalls++;
 }
 const church=map.buildings.find(b=>b.landmark==='chapel');
 if(church){
  const center=church.points.reduce((p,q)=>({x:p.x+q.x/church.points.length,z:p.z+q.z/church.points.length}),{x:0,z:0});
  const face=church.points.map((a,i)=>{const b=church.points[(i+1)%church.points.length],x=(a.x+b.x)/2,z=(a.z+b.z)/2;return {a,b,x,z,d:map.nearestRoad(x,z).distance};}).sort((a,b)=>a.d-b.d)[0];
  let nx=face.b.z-face.a.z,nz=face.a.x-face.b.x;const length=Math.hypot(nx,nz);nx/=length;nz/=length;if(pointInPolygon(face.x+nx,face.z+nz,church.points)){nx=-nx;nz=-nz;}const angle=Math.atan2(nx,nz),pos=(u,y,v)=>[face.x+Math.cos(angle)*u+nx*v,y,face.z-Math.sin(angle)*u+nz*v];
  cube(white,pos(0,church.height/2,.13),[length,church.height,.22],angle);
  for(const u of [-length*.4,0,length*.4]){cube(white,pos(u,church.height/2,.28),[.5,church.height,.35],angle);cube(wood,pos(u,1.7,.4),[u?1.2:1.8,3.2,.12],angle);cube(white,pos(u,3.4,.4),[u?1.6:2.2,.24,.25],angle);}
  for(const u of [-length*.4,0,length*.4]){
   const radius=u?.6:.9,arch=new THREE.Shape();arch.moveTo(-radius,0);arch.lineTo(-radius,2.7);arch.absarc(0,2.7,radius,Math.PI,0,true);arch.lineTo(radius,0);arch.closePath();
   const mesh=new THREE.Mesh(new THREE.ShapeGeometry(arch),wood);mesh.position.set(...pos(u,.1,.48));mesh.rotation.y=angle;scene.add(mesh);
  }
  // Paired white bell towers and moulded domes match the reference silhouette.
  for(const side of [-1,1]){
   const tower=pos(side*length*.39,0,-1.8);
   cube(white,[tower[0],8.5,tower[2]],[3.8,17,4],angle);
   for(const y of [6,10.4,14,17])cube(white,[tower[0],y,tower[2]],[4.3,.28,4.4],angle);
   for(const y of [8,12.3,15.5]){
    const arch=new THREE.Shape();arch.moveTo(-.58,0);arch.lineTo(-.58,1.4);arch.absarc(0,1.4,.58,Math.PI,0,true);arch.lineTo(.58,0);
    const window=new THREE.Mesh(new THREE.ShapeGeometry(arch),wood);window.position.set(...pos(side*length*.39,y-1,-1.8+2.02));window.rotation.y=angle;scene.add(window);
   }
   const profile=[[1.7,0],[1.7,.2],[1.1,.4],[1.15,.8],[.9,1.4],[.55,1.9],[.2,2.4],[0,2.7]].map(p=>new THREE.Vector2(...p));
   put(new THREE.LatheGeometry(profile,16),white,[tower[0],17.15,tower[2]]);
   bar(black,[tower[0],19.5,tower[2]],[tower[0],20.8,tower[2]],.045);bar(black,[tower[0]-.35,20.4,tower[2]],[tower[0]+.35,20.4,tower[2]],.045);
  }
  const gable=new THREE.BufferGeometry();gable.setAttribute('position',new THREE.Float32BufferAttribute([ -length/2,church.height,0,length/2,church.height,0,0,church.height+2.8,0],3));gable.setIndex([0,1,2]);gable.computeVertexNormals();const gableMesh=new THREE.Mesh(gable,new THREE.MeshStandardMaterial({color:'#fff0d2',roughness:.9,side:THREE.DoubleSide}));gableMesh.position.set(face.x+nx*.3,0,face.z+nz*.3);gableMesh.rotation.y=angle;gableMesh.castShadow=true;scene.add(gableMesh);
  bar(black,pos(0,church.height+2.6,.4),pos(0,church.height+4,.4),.045);bar(black,pos(-.4,church.height+3.5,.4),pos(.4,church.height+3.5,.4),.045);
  cube(white,pos(0,.12,1.1),[3,.24,1.8],angle);stats.heritageLandmarks=1;stats.churchPosition=center;
 }
 // Follow the authored shoreline with paving, walls, rails and promenade furniture.
 const waterAt=map.waterAt;
 const shore=[];
 for(const line of map.coastlines)for(let i=1;i<line.points.length;i++){
  const a=line.points[i-1],b=line.points[i],length=Math.hypot(b.x-a.x,b.z-a.z);if(length<.1)continue;
  const tx=(b.x-a.x)/length,tz=(b.z-a.z)/length;let nx=tz,nz=-tx;if(!waterAt((a.x+b.x)/2+nx*2,(a.z+b.z)/2+nz*2)){nx=-nx;nz=-nz;}const angle=Math.atan2(tx,tz);
  for(let d=0;d<length;d+=2){const step=Math.min(2,length-d),x=a.x+tx*(d+step/2),z=a.z+tz*(d+step/2),near=map.nearestRoad(x,z);if(near.distance<near.segment.width/2+1||waterAt(x-nx*2,z-nz*2))continue;
   cube(stone,[x,.35,z],[.65,.8,step+.05],angle);for(const y of [.95,1.5])bar(black,[x-tx*step/2,y,z-tz*step/2],[x+tx*step/2,y,z+tz*step/2],.035);bar(black,[x,.65,z],[x,1.55,z],.045);obstacles.push({x,z,radius:.55,kind:'seawall'});stats.quayMetres+=step;
   const px=x-nx*6,pz=z-nz*6,pnear=map.nearestRoad(px,pz);if(pnear.distance>pnear.segment.width/2+.2&&!map.buildings.some(b=>pointInPolygon(px,pz,b.points)))cube(art.paving,[px,.09,pz],[10,.16,step+.1],angle);
   shore.push({x,z,nx,nz,tx,tz});
  }
 }
 // Masonry banks define the church-side waterway; the bridge road stays clear.
 for(const canal of map.areas.filter(a=>a.id===6||a.id===7)){
  const minX=Math.min(...canal.points.map(p=>p.x)),maxX=Math.max(...canal.points.map(p=>p.x));
  for(const z of [-224,-206])for(let x=minX+1;x<maxX;x+=2){
   const n=map.nearestRoad(x,z),outside=z===-224?z-2:z+2;
   if(n.distance<n.segment.width/2+2.5||waterAt(x,outside))continue;
   cube(stone,[x,.25,z],[2.02,.55,.45]);bar(black,[x-1,.9,z],[x+1,.9,z],.03);bar(black,[x,.55,z],[x,1.05,z],.035);obstacles.push({x,z,radius:.3,kind:'canal-bank'});
  }
 }
 const nearby=shore.filter(p=>Math.hypot(p.x-site.x,p.z-site.z)<210);
 for(let i=5;i<nearby.length;i+=6){const p=nearby[i],x=p.x-p.nx*3.5,z=p.z-p.nz*3.5,n=map.nearestRoad(x,z);if(n.distance<n.segment.width/2+1||map.buildings.some(b=>pointInPolygon(x,z,b.points)))continue;
  bar(black,[x,0,z],[x,3.8,z],.065);put(cylinder,black,[x,3.9,z],[.30,.12,.30]);put(cylinder,warm,[x,4.12,z],[.14,.4,.14]);put(new THREE.ConeGeometry(.32,.24,8),black,[x,4.46,z]);obstacles.push({x,z,radius:.18,kind:'promenade-lamp'});
  put(cylinder,black,[x,.2,z],[.18,.4,.18]);put(sphere,black,[x,3.68,z],[.14,.12,.14]);
  const planterX=x-p.nx*4,planterZ=z-p.nz*4;
  if(groundClear(planterX,planterZ,.65)&&map.nearestRoad(planterX,planterZ).distance>8){
   put(cylinder,clay,[planterX,.3,planterZ],[.5,.6,.5]);
   for(let j=0;j<18;j++){const a=j*2.4,px=planterX+Math.sin(a)*.42,pz=planterZ+Math.cos(a)*.42;put(sphere,j%3?art.leaves[0]:flower,[px,.8+(j%3)*.12,pz],[.15,.12,.15]);}
   obstacles.push({x:planterX,z:planterZ,radius:.6,kind:'promenade-planter'});
  }
  if(Math.floor(i/6)%2){palm(x-p.nx*3,z-p.nz*3,7+(i%3));}else{const yaw=Math.atan2(p.nx,p.nz);cube(wood,[x,.5,z],[1.8,.10,.5],yaw);cube(wood,[x-p.nx*.23,.9,z-p.nz*.23],[1.8,.7,.09],yaw);obstacles.push({x,z,radius:.9,kind:'bench'});}
 }
 // Net platforms are scenery at the authored fishing-net position, outside the driving road.
 const netLandmark=map.landmarks.find(p=>p.kind==='fishing-nets');
 const netShore=netLandmark?shore.slice().sort((a,b)=>Math.hypot(a.x-netLandmark.point.x,a.z-netLandmark.point.z)-Math.hypot(b.x-netLandmark.point.x,b.z-netLandmark.point.z))[0]:nearby[0];
 function fishingNet(p){
  const center=new THREE.Vector3(p.x+p.nx*5,0,p.z+p.nz*5),up=new THREE.Vector3(0,1,0),out=new THREE.Vector3(p.nx,0,p.nz),right=new THREE.Vector3(p.tx,0,p.tz),v=(u,y,d)=>center.clone().addScaledVector(right,u).addScaledVector(out,d).addScaledVector(up,y).toArray();
  cube(wood,v(0,.6,0),[6,.16,7],Math.atan2(p.tx,p.tz));for(const u of [-2.6,2.6])for(const d of [-2.8,2.8])bar(wood,v(u,-1.5,d),v(u,1,d),.12);
  for(const side of [-1,1]){bar(wood,v(side*2.3,.6,-1),v(0,7.8,0),.12);bar(wood,v(0,7.8,0),v(side*6.5,3.2,8),.065);bar(black,v(side*2.3,.6,-2),v(0,7.8,0),.018);}
  bar(wood,v(0,7.8,0),v(0,3.0,14),.07);bar(wood,v(0,7.8,0),v(0,3.4,-6),.07);
  // Individual fine ropes and a shallow, open mesh keep the fishing-net silhouette readable.
  const net=new THREE.BufferGeometry(),vertices=[];
  const point=(u,t)=>new THREE.Vector3(...v(u*(1-t*.48),3.2-Math.sin(t*Math.PI)*1.9,8+t*6));
  for(let row=0;row<=14;row++){const t=row/14;for(let col=0;col<18;col++){vertices.push(...point(-6.5+col*13/18,t).toArray(),...point(-6.5+(col+1)*13/18,t).toArray());}}
  for(let col=0;col<=18;col++)for(let row=0;row<14;row++)vertices.push(...point(-6.5+col*13/18,row/14).toArray(),...point(-6.5+col*13/18,(row+1)/14).toArray());
  net.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));const mesh=new THREE.LineSegments(net,new THREE.LineBasicMaterial({color:'#766f58',transparent:true,opacity:.55}));scene.add(mesh);
  const clothVertices=[],indices=[];
  for(let row=0;row<=14;row++)for(let col=0;col<=18;col++)clothVertices.push(...point(-6.5+col*13/18,row/14).toArray());
  for(let row=0;row<14;row++)for(let col=0;col<18;col++){const k=row*19+col;indices.push(k,k+1,k+19,k+1,k+20,k+19);}
  const clothGeometry=new THREE.BufferGeometry();clothGeometry.setAttribute('position',new THREE.Float32BufferAttribute(clothVertices,3));clothGeometry.setIndex(indices);clothGeometry.computeVertexNormals();
  scene.add(new THREE.Mesh(clothGeometry,new THREE.MeshStandardMaterial({color:'#8c9b92',transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide,roughness:1})));
  stats.fishingNets++;
 }
 if(netShore)for(let i=-1;i<=2;i++)fishingNet({...netShore,x:netShore.x+netShore.tx*i*22,z:netShore.z+netShore.tz*i*22});
 // Shore-side jetty; its service bay remains on land and boats never enter driveable ground.
 const ferry=map.landmarks.find(p=>p.kind==='jetty');
 const jettyShore=ferry?shore.slice().sort((a,b)=>Math.hypot(a.x-ferry.point.x,a.z-ferry.point.z)-Math.hypot(b.x-ferry.point.x,b.z-ferry.point.z))[0]:nearby.at(-1);
 if(jettyShore){const p=jettyShore;for(let d=0;d<24;d+=1){const x=p.x+p.nx*d,z=p.z+p.nz*d;cube(wood,[x,.6,z],[4.2,.16,1.04],Math.atan2(p.nx,p.nz));if(d%3===0)for(const side of [-1,1])bar(wood,[x+p.tx*side*1.8,-1,z+p.tz*side*1.8],[x+p.tx*side*1.8,1.4,z+p.tz*side*1.8],.09);}}
 function boat(x,z,angle,house=false,moving=false){
  if(!waterAt(x,z))return;const group=new THREE.Group();group.position.set(x,.10,z);group.rotation.y=angle;scene.add(group);
  function part(g,m,p,s){const mesh=new THREE.Mesh(g,m);mesh.position.set(...p);mesh.scale.set(...s);mesh.castShadow=false;mesh.receiveShadow=true;group.add(mesh);return mesh;}
  part(sphere,wood,[0,.08,0],[house?2:1.8,.55,house?7:5.5]);part(box,house?wood:white,[0,.45,0],[house?3.7:3.4,.18,house?12:9.4]);part(box,house?wood:white,[0,1.45,-.3],[3,1.9,house?8:6]);
  for(const side of [-1,1])for(let d=-3;d<=3;d+=1.3){part(box,art.glass,[side*1.51,1.7,d],[.025,.85,.88]);part(box,wood,[side*1.53,1.7,d-.48],[.04,1,.06]);}
  if(house){const canopy=new THREE.CylinderGeometry(2.1,2.1,9.8,20,1,true,0,Math.PI);canopy.rotateZ(Math.PI/2);canopy.rotateY(Math.PI/2);part(canopy,art.mat('#a38b54',art.textures.wood),[0,2.1,-.3],[1,1,1]);}else{part(box,blue,[0,2.6,-.3],[3.6,.16,7.3]);part(box,blue,[0,.7,0],[3.8,.24,10]);part(box,white,[0,3,-2],[2.4,.7,2.5]);part(box,art.glass,[0,3.1,-.7],[1.9,.45,.02]);}
  if(house){for(const side of [-1,1]){part(box,wood,[side*1.75,1.05,0],[.07,.07,10.8]);for(let d=-5;d<=5;d+=1.25)part(cylinder,wood,[side*1.75,.75,d],[.035,.65,.035]);}group.scale.set(1.5,1.2,1.8);}
  boats.push({group,x,z,angle,moving,phase:boats.length*1.8});stats.boats++;return group;
 }
 for(let i=0;i<3;i++){const p=nearby[Math.floor(nearby.length*(.2+i*.22))];if(p)boat(i===0?site.street.x+43:p.x+p.nx*(18+i*25),i===0?site.street.z+45:p.z+p.nz*(18+i*25),Math.atan2(p.tx,p.tz),i===0,i>0);}
 if(jettyShore)boat(jettyShore.x+jettyShore.nx*29,jettyShore.z+jettyShore.nz*29,Math.atan2(jettyShore.tx,jettyShore.tz));
 // Original distant harbour silhouettes, with no extra playable districts or brand assets.
 const port=site.street;for(let i=0;i<4;i++){const x=port.x-100+i*55,z=map.bounds.minZ-160;for(const side of [-1,1])bar(blue,[x+side*6,-.5,z],[x+side*2,29,z],.4);bar(blue,[x,28,z],[x+25,38,z-18],.4);bar(blue,[x+25,38,z-18],[x+25,10,z-18],.07);cube(blue,[x,24,z],[4,4,4]);}
 cube(art.ground,[port.x,.02,map.bounds.minZ-245],[820,.12,170]);
 for(let i=0;i<16;i++){
  const x=port.x-350+i*45,z=map.bounds.minZ-250,w=14+(i%3)*4,h=16+(i%4)*6;
  cube(i%3?white:blue,[x,h/2,z],[w,h,20]);
  for(let floor=0;floor<h/3-1;floor++)for(let col=0;col<4;col++)cube(art.glass,[x-w/2+(col+.5)*w/4,2+floor*3,z+10.04],[w/5,1.7,.06]);
 }
 for(const {g,m,items}of batches.values()){const mesh=new THREE.InstancedMesh(g,m,items.length);items.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.castShadow=mesh.receiveShadow=true;mesh.computeBoundingSphere();mesh.matrixAutoUpdate=false;scene.add(mesh);}
 function update(time){for(const b of boats){const t=b.moving?Math.sin(time*.016+b.phase)*20:0,dx=Math.sin(b.angle)*t,dz=Math.cos(b.angle)*t;if(waterAt(b.x+dx,b.z+dz)){b.group.position.x=b.x+dx;b.group.position.z=b.z+dz;}b.group.position.y=.1+Math.sin(time*.8+b.phase)*.035;}}
 function deliveryStops(blocked){const roads=reachableRoads(map,site.spawn),stops=[];
  for(const [name,street]of [['Market customer','Market Street'],['Heritage home','Heritage Lane'],['Jetty service bay','Jetty Road']]){
   const candidates=roads.filter(s=>s.name===street).sort((a,b)=>Math.hypot(a.a.x-site.x,a.a.z-site.z)-Math.hypot(b.a.x-site.x,b.a.z-site.z));
   outer:for(const s of candidates){const length=Math.hypot(s.b.x-s.a.x,s.b.z-s.a.z),tx=(s.b.x-s.a.x)/length,tz=(s.b.z-s.a.z)/length;for(const t of [.5,.3,.7,.2,.8])for(const side of [-1,1]){const x=THREE.MathUtils.lerp(s.a.x,s.b.x,t)+tz*side*(s.width/2+1.1),z=THREE.MathUtils.lerp(s.a.z,s.b.z,t)-tx*side*(s.width/2+1.1);if(!waterAt(x,z)&&[0,Math.PI/2,Math.PI,Math.PI*1.5].every(angle=>!blocked(x,z,angle))){stops.push({x,z,street:name,road:street});break outer;}}}
  }return stops;
 }
 return {site,stats,solids,obstacles,vendors,boats,shore,servicePath,solidAt,reservedAt,update,deliveryStops};
}
