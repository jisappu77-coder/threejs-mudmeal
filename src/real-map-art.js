import * as THREE from 'three';
import {pointInPolygon,segmentDistance} from './real-map-data.js';

// Original hip roofs follow convex authored footprints; irregular buildings keep their flat roof.
export function createKeralaRoof(points,y){
 const turns=points.map((a,i)=>{const b=points[(i+1)%points.length],c=points[(i+2)%points.length];return (b.x-a.x)*(c.z-b.z)-(b.z-a.z)*(c.x-b.x)});
 if(points.length<3||!(turns.every(t=>t>=-.001)||turns.every(t=>t<=.001)))return null;
 const center=points.reduce((a,p)=>a.add(new THREE.Vector2(p.x,p.z)),new THREE.Vector2()).multiplyScalar(1/points.length);
 const edges=points.map((a,i)=>new THREE.Vector2(points[(i+1)%points.length].x-a.x,points[(i+1)%points.length].z-a.z)),axis=edges.reduce((a,b)=>a.lengthSq()>b.lengthSq()?a:b).clone().normalize(),normal=new THREE.Vector2(-axis.y,axis.x);
 const u=points.map(p=>new THREE.Vector2(p.x,p.z).sub(center).dot(axis)),v=points.map(p=>new THREE.Vector2(p.x,p.z).sub(center).dot(normal)),length=Math.max(...u)-Math.min(...u),width=Math.max(...v)-Math.min(...v);
 if(width<1||length<1)return null;
 const rectangular=points.length===4&&Math.abs(edges[0].clone().normalize().dot(edges[1].clone().normalize()))<.2&&edges.every((e,i)=>{const opposite=edges[(i+2)%4];return Math.abs(e.clone().normalize().dot(opposite.clone().normalize()))>.95&&e.length()/opposite.length()>.8&&e.length()/opposite.length()<1.25});
 const rise=THREE.MathUtils.clamp(width*.36,1.1,2.8),ridgeLength=rectangular?Math.max(0,(length-width)/2):0;
 const ridge=[-1,1].map(side=>{const p=center.clone().addScaledVector(axis,side*ridgeLength);while(!pointInPolygon(p.x,p.y,points)&&p.distanceTo(center)>.01)p.lerp(center,.5);return new THREE.Vector3(p.x,y+rise,p.y)});
 const eaves=points.map(p=>{const q=new THREE.Vector2(p.x,p.z),out=q.clone().sub(center).normalize();q.addScaledVector(out,.85);return new THREE.Vector3(q.x,y,q.y)}),vertices=[],uv=[];
 function triangle(a,b,c,along,up){if(new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)).lengthSq()<1e-8)return;for(const p of [a,b,c]){vertices.push(p.x,p.y,p.z);uv.push(p.dot(along)*.22,p.dot(up)*.22)}}
 for(let i=0;i<eaves.length;i++){
  const a=eaves[i],b=eaves[(i+1)%eaves.length],edge=new THREE.Vector2(b.x-a.x,b.z-a.z).normalize();
  const along=new THREE.Vector3().subVectors(b,a).normalize(),peak=ridge[(u[i]+u[(i+1)%u.length])/2<0?0:1],up=peak.clone().sub(a);up.addScaledVector(along,-up.dot(along)).normalize();
  if(Math.abs(edge.dot(axis))>.7){const ra=ridge[u[i]<0?0:1],rb=ridge[u[(i+1)%u.length]<0?0:1];triangle(a,b,rb,along,up);triangle(a,rb,ra,along,up)}
  else triangle(a,b,peak,along,up);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(Array.from({length:vertices.length/3},(_,i)=>i));geometry.computeVertexNormals();
 return {geometry,eaves,ridge};
}

// Original lots dress open parts of the authored neighbourhood.
export function planKochiInfill(map,clear,anchor={x:0,z:0}){
 const plots=[];
 const segments=map.segments.filter(s=>Math.hypot((s.a.x+s.b.x)/2,(s.a.z+s.b.z)/2)<650).sort((a,b)=>Math.hypot((a.a.x+a.b.x)/2-anchor.x,(a.a.z+a.b.z)/2-anchor.z)-Math.hypot((b.a.x+b.b.x)/2-anchor.x,(b.a.z+b.b.z)/2-anchor.z));
 for(const s of segments){
  const length=Math.hypot(s.b.x-s.a.x,s.b.z-s.a.z),tx=(s.b.x-s.a.x)/length,tz=(s.b.z-s.a.z)/length;
  for(let d=6;d<length-5;d+=12)for(const side of [-1,1]){
   if(plots.length>=240)return plots;
   for(const type of [plots.length%5===0?'stall':'home','garden']){
    const width=type==='home'?10:7,depth=type==='home'?12:8,nx=tz*side,nz=-tx*side,offset=s.width/2+3+depth/2,x=s.a.x+tx*d+nx*offset,z=s.a.z+tz*d+nz*offset,radius=Math.hypot(width,depth)/2;
    if(plots.some(p=>Math.hypot(x-p.x,z-p.z)<radius+p.radius+1))continue;
    const cells=[],cols=Math.ceil(width/2),rows=Math.ceil(depth/2),r=Math.hypot(width/cols,depth/rows)/2;
    for(let col=0;col<cols;col++)for(let row=0;row<rows;row++){const u=-width/2+(col+.5)*width/cols,v=-depth/2+(row+.5)*depth/rows;cells.push({x:x+tx*u+nx*v,z:z+tz*u+nz*v,radius:r});}
    if(!cells.every(p=>clear(p.x,p.z,p.radius)))continue;
    plots.push({x,z,tx,tz,nx,nz,width,depth,radius,type,cells});break;
   }
  }
 }
 return plots;
}

// The village game's plaster, tile, glass and tropical leaf treatments, batched for city-scale maps.
export function createMapArt(renderer,id){
 let seed=9137;
 const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 function texture(kind){
  const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');
  ctx.fillStyle={grass:'#587645',asphalt:'#656368',plaster:'#fff4db',tile:'#a45a3c',paving:'#d0c2a0',leaf:'#b9d47c',wood:'#887153',dirt:'#d99b55',gravel:'#baa180'}[kind]||'#b6b9ad';ctx.fillRect(0,0,512,512);
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
 const ground=mat('#ffffff',textures.grass),road=mat('#ffffff',textures.asphalt),paving=mat('#ffffff',textures.paving);
 ground.map.repeat.set(180,180);road.map.repeat.set(.7,.7);paving.map.repeat.set(.6,.6);
 const walls=['#efdfc6','#dce2d2','#dfc1a7','#f2e9d8','#c7d5c9','#e4d4b4'].map(c=>mat(c,textures.plaster));
 const tile=mat('#ffffff',textures.tile),wood=mat('#8d7350',textures.wood),metal=mat('#3c4640'),cream=mat('#dfd3ae');tile.side=THREE.DoubleSide;
 const tileRelief=textures.tile.clone();tileRelief.colorSpace=THREE.NoColorSpace;tile.bumpMap=tileRelief;tile.bumpScale=.045;
 const glass=new THREE.MeshPhysicalMaterial({color:'#566e70',roughness:.18,metalness:.25,clearcoat:.8});
 const leaves=['#4d8228','#79ab32','#b4ce48','#619630'].map(c=>{const m=mat(c,textures.leaf);m.side=THREE.DoubleSide;return m});
 return {random,textures,ground,road,paving,walls,tile,wood,metal,cream,glass,leaves,mat};
}

export function dressRealMap({scene,map,id,height,buildingAt,waterAt,trees,art,anchor,reservedAt=()=>false}){
 const {random,mat,wood,metal,cream,glass,tile,leaves}=art,groups=new Map(),obstacles=[],solids=[],frontages=[],stats={windows:0,roofs:0,verandas:0,shutters:0,streetProps:0,plants:0,rafters:0,gutters:0,downpipes:0,courtyards:0,compoundWalls:0,entranceSteps:0,stairs:0,shopDisplays:0,hangingLamps:0,pots:0,infillHomes:0,teaStalls:0,gardenLots:0,streetTrees:0,bananaPlants:0};
 const darkWood=mat('#663e27',art.textures.wood),pipe=mat('#bcc4b2'),clay=mat('#a95c39'),soil=mat('#443a28'),yard=mat('#ffffff',art.textures.gravel),brass=mat('#c3933d',null,.38);brass.metalness=.65;
 const box=new THREE.BoxGeometry(1,1,1),sphere=new THREE.SphereGeometry(1,10,7),cylinder=new THREE.CylinderGeometry(1,1,1,8),dummy=new THREE.Object3D();
 const smallLeaf=createLeafGeometry(.65,.20,.12),pot=new THREE.LatheGeometry([[.14,0],[.19,.04],[.28,.38],[.30,.43],[.30,.49],[.25,.49],[.24,.43]].map(p=>new THREE.Vector2(...p)),12),vessel=new THREE.LatheGeometry([[.09,0],[.16,.04],[.22,.15],[.19,.24],[.11,.29],[.11,.34],[.14,.35],[.14,.38],[.10,.38]].map(p=>new THREE.Vector2(...p)),12);
 const lampDish=new THREE.LatheGeometry([[.02,0],[.12,.015],[.21,.075],[.20,.10],[.17,.085],[.02,.02]].map(p=>new THREE.Vector2(...p)),12);
 function put(geometry,material,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0,order='XYZ'){const key=geometry.uuid+material.uuid;if(!groups.has(key))groups.set(key,{geometry,material,matrices:[]});dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(rx,ry,rz,order);dummy.updateMatrix();groups.get(key).matrices.push(dummy.matrix.clone())}
 function bar(material,a,b,r=.05){const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),mid=va.clone().add(vb).multiplyScalar(.5),e=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),vb.clone().sub(va).normalize()));put(cylinder,material,...mid.toArray(),r,va.distanceTo(vb),r,e.x,e.y,e.z)}
 function solidAt(x,z,r=0){return solids.some(s=>Math.abs((x-s.x)*s.tx+(z-s.z)*s.tz)<s.width/2+r&&Math.abs((x-s.x)*s.nx+(z-s.z)*s.nz)<s.depth/2+r);}
 const water=map.areas.filter(a=>a.kind==='water');
 function waterNear(x,z,r){return map.waterAt(x,z)||water.some(a=>[a.points,...(a.holes||[])].some(ring=>ring.some((p,i)=>segmentDistance(x,z,p,ring[(i+1)%ring.length])<r)));}
 function clearGround(x,z,r=.1,ignoreObstacles=false){const near=map.nearestRoad(x,z),b=map.bounds;return x-r>b.minX&&x+r<b.maxX&&z-r>b.minZ&&z+r<b.maxZ&&near.distance>near.segment.width/2+1.8+r&&!reservedAt(x,z,r)&&!buildingAt(x,z,r)&&!solidAt(x,z,r)&&!trees.some(t=>Math.hypot(x-t.x,z-t.z)<r+.65)&&(ignoreObstacles||!obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<r+o.radius))&&!waterNear(x,z,r);}
 function sign(text,x,y,z,w,h,angle,bg='#244d3c'){
  const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,512,128);ctx.strokeStyle='#e5dbb8';ctx.lineWidth=4;ctx.strokeRect(7,7,498,114);ctx.fillStyle='#f5e9c9';ctx.font='bold 44px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,64,470);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,roughness:.9,side:THREE.DoubleSide}));mesh.position.set(x,y,z);mesh.rotation.y=angle;scene.add(mesh);stats.streetProps++;
 }
 for(const b of map.buildings){
  const p=b.points,center=p.reduce((a,q)=>({x:a.x+q.x/p.length,z:a.z+q.z/p.length}),{x:0,z:0}),base=height(center.x,center.z),close=Math.hypot(center.x,center.z)<650;
  if(b.keralaRoof){stats.roofs++;if(close){for(let i=0;i<b.keralaRoof.eaves.length;i++){
   const a=b.keralaRoof.eaves[i],q=b.keralaRoof.eaves[(i+1)%b.keralaRoof.eaves.length],length=a.distanceTo(q);bar(darkWood,[a.x,a.y-.1,a.z],[q.x,q.y-.1,q.z],.075);bar(pipe,a.toArray(),q.toArray(),.055);stats.gutters++;
   for(let d=.35;d<length;d+=.9){const t=d/length,x=THREE.MathUtils.lerp(a.x,q.x,t),z=THREE.MathUtils.lerp(a.z,q.z,t),wall={x:THREE.MathUtils.lerp(p[i].x,p[(i+1)%p.length].x,t),z:THREE.MathUtils.lerp(p[i].z,p[(i+1)%p.length].z,t)};bar(darkWood,[x,a.y-.18,z],[wall.x,base+b.height+.03,wall.z],.045);stats.rafters++;}
  }if(b.keralaRoof.ridge[0].distanceTo(b.keralaRoof.ridge[1])>.01)bar(tile,b.keralaRoof.ridge[0].toArray(),b.keralaRoof.ridge[1].toArray(),.09)}}
  if(!close)continue;
  const front=p.reduce((best,a,i)=>{const q=p[(i+1)%p.length],distance=map.nearestRoad((a.x+q.x)/2,(a.z+q.z)/2).distance;return distance<best.distance?{index:i,distance}:best},{index:0,distance:Infinity});
  for(let i=0;i<p.length;i++){
   const a=p[i],q=p[(i+1)%p.length],dx=q.x-a.x,dz=q.z-a.z,l=Math.hypot(dx,dz);if(l<2.4)continue;
   let nx=dz/l,nz=-dx/l;const mx=(a.x+q.x)/2,mz=(a.z+q.z)/2;if(pointInPolygon(mx+nx*.1,mz+nz*.1,p)){nx=-nx;nz=-nz}const angle=Math.atan2(nx,nz);
   const near=map.nearestRoad(mx,mz),streetFacing=i===front.index&&near.distance<near.segment.width/2+12,shop=b.id%3===0;
   const local=(u,d)=>({x:mx+dx/l*u+nx*d,z:mz+dz/l*u+nz*d});
   put(box,cream,mx+nx*.06,base+.25,mz+nz*.06,l,.45,.16,0,angle);
   put(box,cream,mx+nx*.07,base+b.height-.2,mz+nz*.07,l,.17,.22,0,angle);
   const columns=Math.max(1,Math.floor(l/3.5)),floors=Math.min(10,Math.floor(b.height/3));
   for(let floor=0;floor<floors;floor++)for(let col=0;col<columns;col++){
    if(streetFacing&&floor===0&&Math.abs((col+.5)/columns*l-l/2)<1.1)continue;
    const t=(col+.5)/columns,x=a.x+dx*t+nx*.1,z=a.z+dz*t+nz*.1,y=base+1.7+floor*3,w=Math.min(1.3,l/columns*.55);
    put(box,wood,x,y,z,w+.16,1.45,.14,0,angle);put(box,glass,x+nx*.09,y,z+nz*.09,w,1.26,.03,0,angle);put(box,cream,x+nx*.16,y-.8,z+nz*.16,w+.3,.14,.30,0,angle);put(box,wood,x+nx*.13,y,z+nz*.13,.055,1.3,.04,0,angle);stats.windows++;
    if(streetFacing&&b.height<=9){for(const side of [-1,1]){const sx=x+dx/l*side*(w/2+.16)+nx*.08,sz=z+dz/l*side*(w/2+.16)+nz*.08;put(box,darkWood,sx,y,sz,.24,1.36,.09,0,angle);for(let slat=0;slat<5;slat++)put(box,wood,sx+nx*.055,y-.48+slat*.23,sz+nz*.055,.22,.045,.045,0,angle)}stats.shutters+=2;}
    if(streetFacing&&!shop){put(box,cream,x+nx*.39,y+.82,z+nz*.39,w+.35,.1,.65,0,angle);for(const side of [-1,1])put(box,cream,x+dx/l*side*(w/2+.06)+nx*.28,y+.63,z+dz/l*side*(w/2+.06)+nz*.28,.09,.32,.45,0,angle);}
    if(floor>0&&id==='kochi'&&col%2===0){put(box,cream,x+nx*.43,y-.94,z+nz*.43,w+.55,.14,.8,0,angle);put(box,metal,x+nx*.8,y-.55,z+nz*.8,w+.5,.055,.05,0,angle);for(const side of [-1,1])put(box,metal,x+nx*.8+Math.cos(angle)*side*w/2,y-.72,z+nz*.8-Math.sin(angle)*side*w/2,.04,.43,.04)}
   }
   if(l>4&&l<35&&streetFacing&&Math.hypot(mx,mz)<550){
    const x=mx+nx*.20,z=mz+nz*.20;put(box,cream,x,base+1.22,z,1.38,2.44,.16,0,angle);put(box,darkWood,x+nx*.09,base+1.18,z+nz*.09,1.15,2.32,.07,0,angle);for(const side of [-1,1]){const panel=local(side*.28,.31);put(box,wood,panel.x,base+1.23,panel.z,.44,1.75,.045,0,angle)}put(sphere,brass,x+nx*.16+dx/l*.38,base+1.16,z+nz*.16+dz/l*.38,.045,.045,.045);
    const cable=local(-l/2+.4,.15),drain=local(l/2-.3,.16),top=b.keralaRoof?.eaves[(i+1)%p.length];
    if(top){bar(pipe,top.toArray(),[drain.x,base+b.height-.15,drain.z],.055);bar(pipe,[drain.x,base+b.height-.15,drain.z],[drain.x,base+.18,drain.z],.055);for(let h=.7;h<b.height;h+=1.5)put(box,metal,drain.x,base+h,drain.z,.14,.06,.08,0,angle);stats.downpipes++;}
    bar(metal,[cable.x,base+.8,cable.z],[cable.x,base+2.4,cable.z],.018);put(box,cream,cable.x,base+1.6,cable.z,.26,.34,.09,0,angle);
    if(shop){
    const names=['കേരള സ്റ്റോർ · KERALA STORES','ചായ · CHAYA & SNACKS','പലചരക്ക് · LOCAL MARKET'];
    const low=b.height<4,offset=low?1.8:.28;sign(names[Math.floor(b.id/3)%3],mx+nx*offset,base+(low?2.2:3.45),mz+nz*offset,Math.min(l-.6,5),.58,angle,b.id%2?'#7b4030':'#2f5146');}
    put(box,tile,mx+nx*.7,base+2.65,mz+nz*.7,Math.min(l-.5,shop?5:2.8),.14,1.3,.24,angle,0,'YXZ');
    const depth=Math.min(1.5,near.distance-near.segment.width/2-1.75),width=Math.min(l-.8,6.5);
    const posts=[-1,1].map(side=>({x:mx+dx/l*side*(width/2-.12)+nx*depth,z:mz+dz/l*side*(width/2-.12)+nz*depth}));
    if(b.height<=9&&depth>.65&&posts.every(p=>{const r=map.nearestRoad(p.x,p.z);return r.distance>r.segment.width/2+1&&!buildingAt(p.x,p.z,.12)&&!waterAt(p.x,p.z)})){
     put(box,cream,mx+nx*depth/2,base+.12,mz+nz*depth/2,width,.24,depth,0,angle);
     put(box,tile,mx+nx*depth/2,base+2.8,mz+nz*depth/2,width+.25,.14,depth+.3,.22,angle,0,'YXZ');
     for(const p of posts){put(box,darkWood,p.x,base+1.4,p.z,.12,2.6,.12,0,angle);put(box,cream,p.x,base+.24,p.z,.24,.35,.24,0,angle);obstacles.push({x:p.x,z:p.z,radius:.15})}
     stats.verandas++;
    }
    const yardDepth=Math.min(6,near.distance-near.segment.width/2-2.3),yardWidth=Math.min(l-.8,15),samples=[];
    const cols=Math.ceil(yardWidth/.5),rows=Math.max(1,Math.ceil((yardDepth-.2)/.5));for(let col=0;col<=cols;col++)for(let row=0;row<=rows;row++)samples.push(local(-yardWidth/2+col*yardWidth/cols,.2+row*(yardDepth-.2)/rows));
    if(yardDepth>.8&&samples.every(p=>clearGround(p.x,p.z,.12,true))){const floor=local(0,(yardDepth+.2)/2);put(box,shop?art.paving:yard,floor.x,base+.035,floor.z,yardWidth,.05,yardDepth-.2,0,angle);stats.courtyards++;}
    const entrance=[.5,.8].map(d=>Array.from({length:5},(_,j)=>local(-.6+j*.3,d)));if(entrance.flat().every(p=>clearGround(p.x,p.z,.22)))for(const [step,points]of entrance.entries()){const p=local(0,.5+step*.3);put(box,cream,p.x,base+.06*(2-step),p.z,1.5,.12*(2-step),.3,0,angle);for(const p of points)obstacles.push({...p,radius:.22,kind:'entrance-step'});stats.entranceSteps++;}
    if(!shop&&yardDepth>2.5&&yardWidth>6){
     const span=yardWidth/2-1.35,count=Math.ceil(span/.4),points=[];for(const side of [-1,1])for(let j=0;j<=count;j++)points.push(local(side*(1.35+j*span/count),yardDepth-.25));
     if(points.length&&points.every(p=>clearGround(p.x,p.z,.3))){for(const side of [-1,1]){const mid=local(side*(yardWidth/4+.675),yardDepth-.25);put(box,art.walls[b.id%art.walls.length],mid.x,base+.42,mid.z,span,.84,.23,0,angle);put(box,cream,mid.x,base+.9,mid.z,span+.04,.14,.32,0,angle);for(const u of [side*1.35,side*yardWidth/2]){const p=local(u,yardDepth-.25);put(box,cream,p.x,base+.65,p.z,.36,1.3,.36,0,angle)}}for(const p of points)obstacles.push({...p,radius:.3,kind:'compound-wall'});stats.compoundWalls++;}
    }
    if(!shop&&b.height>=6&&stats.stairs<12&&yardDepth>2.6&&yardWidth>10){
     const start=yardWidth/2-3.5,steps=Array.from({length:12},(_,j)=>local(start+j*.27,.9));
     if(steps.every(p=>clearGround(p.x,p.z,.63))){for(const [j,p]of steps.entries()){put(box,cream,p.x,base+(j+1)*.125,p.z,.29,(j+1)*.25,1.12,0,angle);obstacles.push({...p,radius:.63,kind:'outside-stair'});}const a=local(start,1.5),q=local(start+2.97,1.5);bar(metal,[a.x,base+1.05,a.z],[q.x,base+3.8,q.z],.025);for(let j=0;j<12;j+=3){const p=local(start+j*.27,1.5);bar(metal,[p.x,base+(j+1)*.25,p.z],[p.x,base+(j+1)*.25+.8,p.z],.022);}const landing=local(start+2.97,.7),door=local(start+2.97,.16);put(box,cream,landing.x,base+2.95,landing.z,.9,.1,1.4,0,angle);put(box,darkWood,door.x,base+4.05,door.z,.9,2.1,.1,0,angle);stats.stairs++;}
    }
    if(shop){
     const u=-Math.min(2.1,l/2-1),shelf=local(u,.62),points=Array.from({length:4},(_,j)=>local(u-.525+j*.35,.62));
     if(points.every(p=>clearGround(p.x,p.z,.28))){for(const h of [.65,1.3]){put(box,darkWood,shelf.x,base+h,shelf.z,1.4,.08,.42,0,angle);for(const offset of [-.42,0,.42]){const p=local(u+offset,.62);put(vessel,brass,p.x,base+h+.04,p.z,.7,.7,.7);}}for(const offset of [-.64,.64]){const p=local(u+offset,.62);put(box,wood,p.x,base+.72,p.z,.07,1.5,.4,0,angle);}for(const p of points)obstacles.push({...p,radius:.28,kind:'shop-display'});stats.shopDisplays++;const lamp=local(u,.7);bar(metal,[lamp.x,base+2.62,lamp.z],[lamp.x,base+2.27,lamp.z],.012);put(lampDish,brass,lamp.x,base+2.18,lamp.z);put(sphere,brass,lamp.x,base+2.24,lamp.z,.04,.09,.04);stats.hangingLamps++;}
    }
    for(const side of [-1,1]){const p=local(side*Math.min(l/2-1.2,3.8),shop?1.25:1.6);if(!clearGround(p.x,p.z,.4))continue;put(pot,clay,p.x,base,p.z);put(cylinder,soil,p.x,base+.43,p.z,.24,.025,.24);for(let j=0;j<9;j++){const a=j*2.4;put(smallLeaf,leaves[j%4],p.x+Math.sin(a)*.12,base+.48+(j%3)*.12,p.z+Math.cos(a)*.12,.6,.8,.6,.35,a)}obstacles.push({...p,radius:.4,kind:'garden-pot'});stats.pots++;}
    frontages.push({buildingId:b.id,x:mx,z:mz,nx,nz,width:yardWidth,depth:yardDepth,shop});
   }
  }
 }


 const palmLeaf=createLeafGeometry(4.3,.035,1.8),leaflet=createLeafGeometry(1,.09,.25),bark=mat('#7c7156',art.textures.wood);
 function palm(t){const h=8*t.scale,x=t.x,z=t.z,y=t.y;
  for(let j=0;j<12;j++){const a=j/12,b=(j+1)/12;bar(bark,[x+.5*a*a,y+h*a,z],[x+.5*b*b,y+h*b,z],.19-.06*a)}
  for(let i=0;i<10;i++){const angle=i*Math.PI/5;put(palmLeaf,leaves[i%4],x+.5,y+h,z,1,1,1,.1,angle);
   for(let j=1;j<15;j++){const f=j/16,length=Math.sin(f*Math.PI)**.6*.9,px=x+.5+Math.sin(angle)*f*4.3,pz=z+Math.cos(angle)*f*4.3,py=y+h+Math.sin(f*Math.PI)*.9-f*f*1.8;for(const side of [-1,1]){const delta=new THREE.Vector3(Math.cos(angle)*side*length+Math.sin(angle)*.2,-.2,-Math.sin(angle)*side*length+Math.cos(angle)*.2),e=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),delta.clone().normalize()));put(leaflet,leaves[(i+j)%4],px,py,pz,1,1,delta.length(),e.x,e.y,e.z)}}
  }
 }
 for(const t of trees){obstacles.push({x:t.x,z:t.z,radius:t.kind==='shade'?.35:.55});if(t.kind!=='shade'){palm(t);stats.plants++;}}
 const infill=planKochiInfill(map,(x,z,r)=>clearGround(x,z,r)&&!frontages.some(f=>{const u=(x-f.x)*f.nz-(z-f.z)*f.nx,v=(x-f.x)*f.nx+(z-f.z)*f.nz;return Math.abs(u)<f.width/2+r&&v>-r&&v<f.depth+r;}),anchor);
 const homeRoof=createKeralaRoof([{x:-3.3,z:-3.25},{x:3.3,z:-3.25},{x:3.3,z:3.25},{x:-3.3,z:3.25}],0).geometry,bananaLeaf=createLeafGeometry(2.1,.38,.35),crown=new THREE.IcosahedronGeometry(1,1),fruit=mat('#f3b449'),bananaStem=mat('#8b9c48');
 function banana(x,z,y){put(cylinder,bananaStem,x,y+.8,z,.08,1.6,.08);for(let j=0;j<7;j++)put(bananaLeaf,leaves[j%4],x,y+1.55,z,1,1,1,.15,j*Math.PI*2/7);obstacles.push({x,z,radius:.18,kind:'banana-stem'});stats.bananaPlants++;stats.plants++;}
 const canopyLeaf=createLeafGeometry(.8,.23,.10),canopyCore=mat('#42672e'),canopyLeaves=['#416b30','#70973b','#97b550','#568034'].map(c=>{const m=mat(c,art.textures.leaf);m.side=THREE.DoubleSide;return m;});
 function shadeTree(x,z,y,register=true,size=1){
  put(cylinder,wood,x,y+2.4*size,z,.19*size,4.8*size,.19*size);
  for(let j=0;j<7;j++){
   const a=j*2.4,dx=Math.sin(a)*1.1*size,dz=Math.cos(a)*1.1*size,cy=y+(5.1+(j%3)*.3)*size;
   bar(wood,[x,y+3.5*size,z],[x+dx,cy,z+dz],.07*size);
   put(crown,canopyCore,x+dx,cy,z+dz,.8*size,.75*size,.9*size,.1,a);
   for(let k=0;k<24;k++){
    const angle=k*2.4+j,layer=(k%5)/4;
    put(canopyLeaf,canopyLeaves[(j+k)%4],x+dx+Math.sin(angle)*(.5+layer*.6)*size,cy+(-.45+layer*.9)*size,z+dz+Math.cos(angle)*(.5+layer*.6)*size,size,size,size,-.5+layer,angle,(k%3-.8)*.3);
   }
  }
  if(register)obstacles.push({x,z,radius:.3*size,kind:'shade-tree'});stats.streetTrees++;stats.plants++;
 }
 for(const t of trees.filter(t=>t.kind==='shade'))shadeTree(t.x,t.z,t.y,false,1.7);
 for(const [index,p]of infill.entries()){
  const local=(u,v)=>({x:p.x+p.tx*u+p.nx*v,z:p.z+p.tz*u+p.nz*v}),angle=Math.atan2(-p.nx,-p.nz),base=height(p.x,p.z);
  if(p.type==='garden'){
   put(box,yard,p.x,base+.02,p.z,p.width,.035,p.depth,0,angle);shadeTree(p.x,p.z,base);for(const side of [-1,1]){const q=local(side*2.3,2);banana(q.x,q.z,base);}stats.gardenLots++;continue;
  }
  put(box,index%2?yard:art.paving,p.x,base+.025,p.z,p.width,.045,p.depth,0,angle);
  if(p.type==='home'){
   const body=local(0,1.15);put(box,art.walls[index%art.walls.length],body.x,base+1.55,body.z,6.6,3.1,6.5,0,angle);put(homeRoof,tile,body.x,base+3.18,body.z,1,1,1,0,angle);solids.push({...body,tx:p.tx,tz:p.tz,nx:p.nx,nz:p.nz,width:6.6,depth:6.5,kind:'infill-home'});
   const door=local(0,-2.14);put(box,darkWood,door.x,base+1.15,door.z,1.15,2.3,.1,0,angle);
   for(const side of [-1,1]){const q=local(side*2,-2.2);put(box,wood,q.x,base+1.65,q.z,1.35,1.5,.12,0,angle);put(box,glass,q.x-p.nx*.08,base+1.65,q.z-p.nz*.08,1.15,1.3,.04,0,angle);put(box,cream,q.x-p.nx*.3,base+2.48,q.z-p.nz*.3,1.6,.1,.65,0,angle);}
   const porch=local(0,-2.85);put(box,tile,porch.x,base+2.75,porch.z,5.1,.13,1.7,.22,angle,0,'YXZ');put(box,cream,porch.x,base+.12,porch.z,5,.24,1.8,0,angle);
   for(const side of [-1,1]){const q=local(side*2.35,-3.65);put(box,darkWood,q.x,base+1.25,q.z,.12,2.5,.12,0,angle);obstacles.push({...q,radius:.18,kind:'infill-veranda'});}
   for(const side of [-1,1]){const q=local(side*3.1,-5.65);put(box,art.walls[index%art.walls.length],q.x,base+.4,q.z,3.8,.8,.22,0,angle);put(box,cream,q.x,base+.85,q.z,3.8,.1,.3,0,angle);for(let u=1.2;u<=5;u+=.35){const q=local(side*u,-5.65);obstacles.push({...q,radius:.3,kind:'infill-wall'});}}
   for(const side of [-1,1]){const q=local(side*3.7,-3.9);banana(q.x,q.z,base);}stats.infillHomes++;
  }else{
   put(box,tile,p.x,base+2.75,p.z,5.6,.14,4.3,.16,angle,0,'YXZ');const back=local(0,1.85);put(box,wood,back.x,base+1.2,back.z,5.2,2.4,.1,0,angle);solids.push({...back,tx:p.tx,tz:p.tz,nx:p.nx,nz:p.nz,width:5.2,depth:.1,kind:'stall-wall'});
   for(const u of [-2.45,2.45])for(const v of [-1.85,1.85]){const q=local(u,v);put(box,darkWood,q.x,base+1.25,q.z,.12,2.5,.12,0,angle);obstacles.push({...q,radius:.15,kind:'stall-post'});}
   const counter=local(0,-1.15);put(box,wood,counter.x,base+.5,counter.z,4.5,1,.7,0,angle);solids.push({...counter,tx:p.tx,tz:p.tz,nx:p.nx,nz:p.nz,width:4.5,depth:.7,kind:'stall-counter'});
   for(const u of [-1.4,0,1.4]){const q=local(u,-1.15);put(box,darkWood,q.x,base+1.1,q.z,1.15,.16,.6,0,angle);for(let j=0;j<8;j++){const f=local(u+(j%4-.5)*.2-.2,-1.3+Math.floor(j/4)*.2);put(sphere,fruit,f.x,base+1.24,f.z,.09,.09,.09);}}
   const label=local(0,-2.3);sign(index%2?'ചായ · CHAYA':'പഴങ്ങൾ · FRESH FRUIT',label.x,base+2.27,label.z,4.6,.45,angle);stats.teaStalls++;
  }
 }
 // Street trees occupy remaining verges, away from courtyard entrances and lot footprints.
 const entranceNear=(x,z,r)=>frontages.some(f=>{const u=(x-f.x)*f.nz-(z-f.z)*f.nx,v=(x-f.x)*f.nx+(z-f.z)*f.nz;return Math.abs(u)<1.4+r&&v>-r&&v<f.depth+r;});
 const livelyRoads=[...map.segments].sort((a,b)=>Math.hypot((a.a.x+a.b.x)/2-anchor.x,(a.a.z+a.b.z)/2-anchor.z)-Math.hypot((b.a.x+b.b.x)/2-anchor.x,(b.a.z+b.b.z)/2-anchor.z));
 for(const s of livelyRoads){const length=Math.hypot(s.b.x-s.a.x,s.b.z-s.a.z);for(let d=4;d<length;d+=10)for(const side of [-1,1]){
  const tx=(s.b.x-s.a.x)/length,tz=(s.b.z-s.a.z)/length,x=s.a.x+tx*d+tz*side*(s.width/2+4.5),z=s.a.z+tz*d-tx*side*(s.width/2+4.5);
  if(Math.hypot(x,z)>650)continue;
  if(stats.streetTrees<260&&clearGround(x,z,1.4)&&!infill.some(p=>Math.hypot(x-p.x,z-p.z)<p.radius+2)&&!entranceNear(x,z,1.4)){put(box,yard,x,height(x,z)+.025,z,2.8,.04,2.8);shadeTree(x,z,height(x,z));}
  const bx=s.a.x+tx*d+tz*side*(s.width/2+2.7),bz=s.a.z+tz*d-tx*side*(s.width/2+2.7);
  if(stats.bananaPlants<600&&clearGround(bx,bz,.4)&&!infill.some(p=>Math.hypot(bx-p.x,bz-p.z)<p.radius+1)&&!entranceNear(bx,bz,.4)){put(box,yard,bx,height(bx,bz)+.025,bz,1,.04,1);banana(bx,bz,height(bx,bz));}
 }}
 const roadNear=map.segments.filter(s=>Math.hypot((s.a.x+s.b.x)/2,(s.a.z+s.b.z)/2)<650);
 let props=0;const planted=[];
 function clearPlot(x,z,r){const near=map.nearestRoad(x,z);return near.distance>near.segment.width/2+r+.25&&!reservedAt(x,z,r)&&!buildingAt(x,z,r)&&!solidAt(x,z,r)&&!waterAt(x,z)&&!infill.some(p=>Math.hypot(x-p.x,z-p.z)<p.radius+r)&&!obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<r+o.radius)&&!planted.some(o=>Math.hypot(x-o.x,z-o.z)<r+o.radius)}
 for(const s of roadNear){const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,l=Math.hypot(dx,dz);if(l<10)continue;
  for(let d=4;d<l;d+=18)for(const side of [-1,1]){
   const t=d/l,nx=dz/l*side,nz=-dx/l*side,offset=s.width/2+2,x=s.a.x+dx*t+nx*offset,z=s.a.z+dz*t+nz*offset,y=height(x,z);
   if(!clearPlot(x,z,.9))continue;
   if(props<160){put(cylinder,metal,x,y+2.7,z,.07,5.4,.07);bar(metal,[x,y+5.3,z],[x-nx*.8,y+5.7,z-nz*.8],.05);put(box,cream,x-nx*.9,y+5.65,z-nz*.9,.4,.12,.3);obstacles.push({x,z,radius:.15});stats.streetProps++;props++;}
   else{const scale=.8+random()*.4;
    for(let j=0;j<18;j++){const a=j*2.4;put(smallLeaf,leaves[j%4],x+Math.sin(a)*.55,y+.35+(j%3)*.18,z+Math.cos(a)*.55,scale,scale,scale,.2,a)}
    planted.push({x,z,radius:.8});stats.plants++;props++;
   }
  }
 }
 // Ground-cover clusters break up empty terrain without putting scenery in roads or building footprints.
 for(let i=0;i<180;i++){const x=(random()-.5)*1100,z=(random()-.5)*1100;if(!clearPlot(x,z,.45))continue;const y=height(x,z);for(let j=0;j<7;j++)put(smallLeaf,leaves[j%4],x+Math.sin(j*2.4)*.24,y+.2,z+Math.cos(j*2.4)*.24,.7,.65,.7,0,j*2.4);stats.plants++}
 for(const {geometry,material,matrices}of groups.values()){
  const cells=new Map();for(const m of matrices){const key=Math.floor(m.elements[12]/64)+','+Math.floor(m.elements[14]/64);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(m);}
  for(const items of cells.values()){const mesh=new THREE.InstancedMesh(geometry,material,items.length);items.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=mesh.receiveShadow=true;mesh.userData.scenicBackdrop=material.fog===false;mesh.computeBoundingSphere();mesh.matrixAutoUpdate=false;scene.add(mesh);}
 }
 scene.userData.mapArt=stats;
 return {stats,obstacles,solids,solidAt,infill,frontages,planted,sign};
}

export function createLeafGeometry(length,width,droop=0){const v=[],uv=[],indices=[];for(let i=0;i<=12;i++){const t=i/12,w=Math.sin(t*Math.PI)**.7*width;for(const s of [-1,0,1]){v.push(s*w,Math.sin(t*Math.PI)*length*.21-t*t*droop+(s===0?.035:0),t*length);uv.push((s+1)/2,t)}if(i<12){const k=i*3;indices.push(k,k+3,k+1,k+1,k+3,k+4,k+1,k+4,k+2,k+2,k+4,k+5)}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g}
