import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {pointInPolygon} from './real-map-data.js';

// The village game's plaster, tile, glass and tropical leaf treatments, batched for city-scale maps.
export function createMapArt(renderer,id){
 let seed=9137;
 const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 function texture(kind){
  const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');
  ctx.fillStyle={grass:'#718052',asphalt:'#656368',plaster:'#ddd8c7',tile:'#9c5940',paving:'#bcb79e',leaf:'#688143',wood:'#887153',dirt:'#a17951',gravel:'#a8997f'}[kind]||'#b6b9ad';ctx.fillRect(0,0,512,512);
  for(let i=0;i<14000;i++){ctx.fillStyle=i%2?'#f8efce15':'#26352618';ctx.fillRect(random()*512,random()*512,1+random()*3,kind==='wood'?12:2)}
  if(kind==='gravel')for(let i=0;i<1200;i++){ctx.fillStyle=i%2?'#d8cfb176':'#665f5166';ctx.beginPath();ctx.ellipse(random()*512,random()*512,1+random()*3,1+random()*2,random()*3,0,Math.PI*2);ctx.fill()}
  if(kind==='grass')for(let i=0;i<1800;i++){ctx.strokeStyle=i%2?'#a0a37138':'#344d3130';const x=random()*512,y=random()*512;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+2,y-3-random()*6);ctx.stroke()}
  if(kind==='tile'||kind==='paving'){const w=kind==='tile'?32:64,h=kind==='tile'?42:32;for(let row=0;row<512/h;row++)for(let col=-1;col<512/w;col++){const x=col*w+(row%2)*w/2,y=row*h;ctx.fillStyle=col%3?'#f1d0a51c':'#311e202a';ctx.fillRect(x+2,y+2,w-4,h-4);ctx.strokeStyle='#3e312756';ctx.strokeRect(x,y,w,h);if(kind==='tile'){ctx.fillStyle='#f6c5a729';ctx.fillRect(x+3,y+3,4,h-7)}}}
  if(kind==='plaster'){const damp=ctx.createLinearGradient(0,370,0,512);damp.addColorStop(0,'#625d4700');damp.addColorStop(1,'#625d4755');ctx.fillStyle=damp;ctx.fillRect(0,370,512,142)}
  if(kind==='leaf'){ctx.strokeStyle='#b0bb6b';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(256,0);ctx.lineTo(256,512);ctx.stroke();ctx.lineWidth=1;for(let y=0;y<512;y+=24){ctx.beginPath();ctx.moveTo(256,y);ctx.lineTo(0,y+70);ctx.moveTo(256,y);ctx.lineTo(512,y+70);ctx.stroke()}}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;
 }
 const textures=Object.fromEntries(['grass','asphalt','plaster','tile','paving','leaf','wood','dirt','gravel'].map(k=>[k,texture(k)]));
 const mat=(color,map,roughness=.85)=>new THREE.MeshStandardMaterial({color,map,roughness});
 const ground=mat(id==='thekkady'?'#819777':'#ffffff',textures.grass),road=mat('#ffffff',textures.asphalt),paving=mat('#ffffff',textures.paving);
 ground.map.repeat.set(180,180);road.map.repeat.set(.7,.7);paving.map.repeat.set(.6,.6);
 const walls=['#e9d49c','#d3ded5','#cfb299','#e5dcc6','#afc2ba','#dbcba0'].map(c=>mat(c,textures.plaster));
 const tile=mat('#ffffff',textures.tile),wood=mat('#8d7350',textures.wood),metal=mat('#3c4640'),cream=mat('#dfd3ae');
 const glass=new THREE.MeshPhysicalMaterial({color:'#566e70',roughness:.18,metalness:.25,clearcoat:.8});
 const leaves=['#405d36','#617c43','#7d8b4b','#4d693a'].map(c=>{const m=mat(c,textures.leaf);m.side=THREE.DoubleSide;return m});
 return {random,textures,ground,road,paving,walls,tile,wood,metal,cream,glass,leaves,mat};
}

export function dressRealMap({scene,map,id,height,buildingAt,waterAt,trees,art}){
 const {random,mat,wood,metal,cream,glass,tile,leaves}=art,groups=new Map(),obstacles=[],stats={windows:0,roofs:0,streetProps:0,plants:0};
 const box=new THREE.BoxGeometry(1,1,1),sphere=new THREE.SphereGeometry(1,10,7),cylinder=new THREE.CylinderGeometry(1,1,1,8),dummy=new THREE.Object3D();
 function put(geometry,material,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0){const key=geometry.uuid+material.uuid;if(!groups.has(key))groups.set(key,{geometry,material,matrices:[]});dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(rx,ry,rz);dummy.updateMatrix();groups.get(key).matrices.push(dummy.matrix.clone())}
 function bar(material,a,b,r=.05){const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),mid=va.clone().add(vb).multiplyScalar(.5),e=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),vb.clone().sub(va).normalize()));put(cylinder,material,...mid.toArray(),r,va.distanceTo(vb),r,e.x,e.y,e.z)}
 function sign(text,x,y,z,w,h,angle,bg='#244d3c'){
  const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,512,128);ctx.strokeStyle='#e5dbb8';ctx.lineWidth=4;ctx.strokeRect(7,7,498,114);ctx.fillStyle='#f5e9c9';ctx.font='bold 44px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,64,470);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,roughness:.9,side:THREE.DoubleSide}));mesh.position.set(x,y,z);mesh.rotation.y=angle;scene.add(mesh);stats.streetProps++;
 }
 const roofGeometries=[];
 for(const b of map.buildings){
  const p=b.points,center=p.reduce((a,q)=>({x:a.x+q.x/p.length,z:a.z+q.z/p.length}),{x:0,z:0}),base=height(center.x,center.z),close=Math.hypot(center.x,center.z)<650;
  // Hip roofs follow convex OSM footprints; irregular footprints retain their original flat roof.
  const turns=p.map((a,i)=>{const b=p[(i+1)%p.length],c=p[(i+2)%p.length];return (b.x-a.x)*(c.z-b.z)-(b.z-a.z)*(c.x-b.x)}),convex=turns.every(t=>t>=-.001)||turns.every(t=>t<=.001);
  if(id!=='kochi'&&b.height<10&&p.length<=8&&convex){const v=[],uv=[],rise=Math.min(2.7,Math.sqrt(Math.abs(p.reduce((a,q,i)=>a+q.x*p[(i+1)%p.length].z-p[(i+1)%p.length].x*q.z,0)))*.15);
   for(let i=0;i<p.length;i++){const a=p[i],q=p[(i+1)%p.length];v.push(a.x,base+b.height+.09,a.z,q.x,base+b.height+.09,q.z,center.x,base+b.height+rise,center.z);uv.push(a.x*.25,a.z*.25,q.x*.25,q.z*.25,center.x*.25,center.z*.25)}
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();roofGeometries.push(g);stats.roofs++;
  }
  if(!close)continue;
  for(let i=0;i<p.length;i++){
   const a=p[i],q=p[(i+1)%p.length],dx=q.x-a.x,dz=q.z-a.z,l=Math.hypot(dx,dz);if(l<2.4)continue;
   let nx=dz/l,nz=-dx/l;const mx=(a.x+q.x)/2,mz=(a.z+q.z)/2;if(pointInPolygon(mx+nx*.1,mz+nz*.1,p)){nx=-nx;nz=-nz}const angle=Math.atan2(nx,nz);
   put(box,cream,mx+nx*.06,base+.25,mz+nz*.06,l,.45,.16,0,angle);
   put(box,cream,mx+nx*.07,base+b.height-.2,mz+nz*.07,l,.17,.22,0,angle);
   const columns=Math.max(1,Math.floor(l/3.5)),floors=Math.min(10,Math.floor(b.height/3));
   for(let floor=0;floor<floors;floor++)for(let col=0;col<columns;col++){
    const t=(col+.5)/columns,x=a.x+dx*t+nx*.1,z=a.z+dz*t+nz*.1,y=base+1.7+floor*3,w=Math.min(1.3,l/columns*.55);
    put(box,wood,x,y,z,w+.16,1.45,.14,0,angle);put(box,glass,x+nx*.09,y,z+nz*.09,w,1.26,.03,0,angle);put(box,cream,x+nx*.16,y-.8,z+nz*.16,w+.3,.14,.30,0,angle);put(box,wood,x+nx*.13,y,z+nz*.13,.055,1.3,.04,0,angle);stats.windows++;
    if(floor>0&&id==='kochi'&&col%2===0){put(box,cream,x+nx*.43,y-.94,z+nz*.43,w+.55,.14,.8,0,angle);put(box,metal,x+nx*.8,y-.55,z+nz*.8,w+.5,.055,.05,0,angle);for(const side of [-1,1])put(box,metal,x+nx*.8+Math.cos(angle)*side*w/2,y-.72,z+nz*.8-Math.sin(angle)*side*w/2,.04,.43,.04)}
   }
   const near=map.nearestRoad(mx,mz);
   if(l>4&&l<35&&near.distance<near.segment.width/2+20&&Math.hypot(mx,mz)<550&&i===0){
    const x=mx+nx*.20,z=mz+nz*.20;put(box,wood,x,base+1.15,z,1.2,2.2,.15,0,angle);put(box,metal,x+nx*.09,base+1.15,z+nz*.09,1.03,2.0,.04,0,angle);
    const names=id==='kochi'?['KERALA STORES','CHAYA & SNACKS','FRESH MARKET']:id==='munnar'?['HILL VIEW CHAYA','TEA & SPICES','MOUNTAIN STORES']:['FOREST CHAYA','SPICE CORNER','TRAIL SUPPLIES'];
    sign(names[b.id%3],mx+nx*.28,base+3.05,mz+nz*.28,Math.min(l-.6,5),.75,angle,b.id%2?'#7b4030':'#2f5146');
    put(box,b.id%2?tile:cream,mx+nx*.85,base+2.65,mz+nz*.85,Math.min(l-.5,5),.14,1.5,.13,angle);
   }
  }
 }
 if(roofGeometries.length){const mesh=new THREE.Mesh(mergeGeometries(roofGeometries),tile);mesh.material.side=THREE.DoubleSide;mesh.castShadow=mesh.receiveShadow=true;scene.add(mesh);roofGeometries.forEach(g=>g.dispose())}

 const palmLeaf=createLeafGeometry(4.3,.035,1.8),leaflet=createLeafGeometry(1,.09,.25),broadLeaf=createLeafGeometry(2.8,.48,1.05),smallLeaf=createLeafGeometry(.65,.20,.12),bark=mat('#7c7156',art.textures.wood),rock=mat('#85877c'),soil=mat('#8f7c54');
 function palm(t){const h=8*t.scale,x=t.x,z=t.z,y=t.y;
  for(let j=0;j<12;j++){const a=j/12,b=(j+1)/12;bar(bark,[x+.5*a*a,y+h*a,z],[x+.5*b*b,y+h*b,z],.19-.06*a)}
  for(let i=0;i<10;i++){const angle=i*Math.PI/5;put(palmLeaf,leaves[i%4],x+.5,y+h,z,1,1,1,.1,angle);
   for(let j=1;j<15;j++){const f=j/16,length=Math.sin(f*Math.PI)**.6*.9,px=x+.5+Math.sin(angle)*f*4.3,pz=z+Math.cos(angle)*f*4.3,py=y+h+Math.sin(f*Math.PI)*.9-f*f*1.8;for(const side of [-1,1]){const delta=new THREE.Vector3(Math.cos(angle)*side*length+Math.sin(angle)*.2,-.2,-Math.sin(angle)*side*length+Math.cos(angle)*.2),e=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),delta.clone().normalize()));put(leaflet,leaves[(i+j)%4],px,py,pz,1,1,delta.length(),e.x,e.y,e.z)}}
  }
 }
 for(const [i,t]of trees.entries()){
  obstacles.push({x:t.x,z:t.z,radius:id==='kochi'||(id==='thekkady'&&i%9===0)?.55:.25});
  if(id==='kochi'||(id==='thekkady'&&i%9===0)){palm(t)}
  else{
   put(cylinder,bark,t.x,t.y+3.7*t.scale,t.z,.18*t.scale,7.4*t.scale,.18*t.scale);
   for(let j=0;j<5;j++){const a=j*2.4;bar(bark,[t.x,t.y+4.5*t.scale,t.z],[t.x+Math.sin(a)*2*t.scale,t.y+(6+j*.25)*t.scale,t.z+Math.cos(a)*2*t.scale],.08*t.scale)}
   for(let j=0;j<13;j++){const a=j*2.4,r=(j%3+1)*.8*t.scale;put(sphere,leaves[j%4],t.x+Math.sin(a)*r,t.y+(6.5+j%4*.6)*t.scale,t.z+Math.cos(a)*r,1.4*t.scale,1.1*t.scale,1.5*t.scale)}
  }stats.plants++;
 }
 const roadNear=map.segments.filter(s=>Math.hypot((s.a.x+s.b.x)/2,(s.a.z+s.b.z)/2)<650);
 let props=0;const planted=[];
 function clearPlot(x,z,r){const near=map.nearestRoad(x,z);return near.distance>near.segment.width/2+r+.25&&!buildingAt(x,z,r)&&!waterAt(x,z)&&!obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<r+o.radius)&&!planted.some(o=>Math.hypot(x-o.x,z-o.z)<r+o.radius)}
 for(const s of roadNear){const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,l=Math.hypot(dx,dz);if(l<10)continue;
  for(let d=4;d<l;d+=id==='kochi'?18:12)for(const side of [-1,1]){
   const t=d/l,nx=dz/l*side,nz=-dx/l*side,offset=s.width/2+(id==='kochi'?2:3),x=s.a.x+dx*t+nx*offset,z=s.a.z+dz*t+nz*offset,y=height(x,z);
   if(!clearPlot(x,z,.9))continue;
   if(id==='kochi'&&props<160){put(cylinder,metal,x,y+2.7,z,.07,5.4,.07);bar(metal,[x,y+5.3,z],[x-nx*.8,y+5.7,z-nz*.8],.05);put(box,cream,x-nx*.9,y+5.65,z-nz*.9,.4,.12,.3);obstacles.push({x,z,radius:.15});stats.streetProps++;props++;}
   else{const scale=.8+random()*.4;
    if(id==='thekkady'&&props%3===0){put(cylinder,leaves[0],x,y+1.25,z,.12,2.5,.12);for(let j=0;j<8;j++)put(broadLeaf,leaves[j%4],x,y+2.1+j*.06,z,scale,scale,scale,.2-j*.05,j*2.4)}
    else for(let j=0;j<18;j++){const a=j*2.4;put(smallLeaf,leaves[j%4],x+Math.sin(a)*.55,y+.35+(j%3)*.18,z+Math.cos(a)*.55,scale,scale,scale,.2,a)}
    if(id==='thekkady'&&props%7===0){put(sphere,rock,x+nx,y+.4,z+nz,1,.65,.8);obstacles.push({x:x+nx,z:z+nz,radius:.8})}
    planted.push({x,z,radius:.8});stats.plants++;props++;
   }
  }
 }
 // Ground-cover clusters break up empty terrain without putting scenery in mapped roads or footprints.
 for(let i=0;i<(id==='kochi'?180:1800);i++){const x=(random()-.5)*1100,z=(random()-.5)*1100;if(!clearPlot(x,z,.45))continue;const y=height(x,z);for(let j=0;j<7;j++)put(smallLeaf,leaves[j%4],x+Math.sin(j*2.4)*.24,y+.2,z+Math.cos(j*2.4)*.24,.7,.65,.7,0,j*2.4);stats.plants++}
 if(id!=='kochi'){
  // Illustrative distant Western Ghats scenery, outside the playable OSM snapshot.
  const hills=new THREE.SphereGeometry(1,32,20),hillMaterial=mat(id==='munnar'?'#899e89':'#718c79');hillMaterial.fog=false;const vertices=hills.attributes.position;for(let i=0;i<vertices.count;i++)if(vertices.getY(i)>0)vertices.setY(i,vertices.getY(i)*(1+.15*Math.sin(vertices.getX(i)*12)*Math.cos(vertices.getZ(i)*9)));hills.computeVertexNormals();
  for(let i=0;i<12;i++){const angle=i*Math.PI/6,r=1450+random()*350;put(hills,hillMaterial,Math.sin(angle)*r,-70,Math.cos(angle)*r,350+random()*300,180+random()*170,400+random()*220)}
 }
 for(const {geometry,material,matrices}of groups.values()){const mesh=new THREE.InstancedMesh(geometry,material,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=mesh.receiveShadow=true;mesh.userData.scenicBackdrop=material.fog===false;mesh.computeBoundingSphere();scene.add(mesh)}
 scene.userData.mapArt=stats;
 return {stats,obstacles,planted,sign};
}

export function createLeafGeometry(length,width,droop=0){const v=[],uv=[],indices=[];for(let i=0;i<=12;i++){const t=i/12,w=Math.sin(t*Math.PI)**.7*width;for(const s of [-1,0,1]){v.push(s*w,Math.sin(t*Math.PI)*length*.21-t*t*droop+(s===0?.035:0),t*length);uv.push((s+1)/2,t)}if(i<12){const k=i*3;indices.push(k,k+3,k+1,k+1,k+3,k+4,k+1,k+4,k+2,k+2,k+4,k+5)}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g}
