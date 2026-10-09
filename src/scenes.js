import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {buildAuto} from './prototypes/auto.js';
import {buildVehiclePrototypes,createMotorcycle} from './prototypes/vehicles.js';
import {bounds,worldPoint,roadWidth,roadDistance,segmentDistance,inside} from './layout.js';
import {createWater} from './water.js';
import {createFoliage} from './foliage.js';
import {projectWaterfront} from './projection.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

export function batchAsset(actor){
 actor.updateMatrixWorld(true);const inverse=actor.matrixWorld.clone().invert(),groups=new Map();
 actor.traverse(o=>{if(!o.isMesh)return;const list=groups.get(o.material)||[],g=o.geometry.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld));if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));list.push(g);groups.set(o.material,list)});
 actor.clear();for(const [material,geometries]of groups){const mesh=new THREE.Mesh(mergeGeometries(geometries),material);mesh.castShadow=mesh.receiveShadow=true;actor.add(mesh);geometries.forEach(g=>g.dispose())}return actor;
}

export function createSceneArt(renderer,skyTexture) {
 const materials = new Map(), geometries = new Map(),foliage=createFoliage(renderer);
 const geometry = (key, make) => {if (!geometries.has(key)) geometries.set(key,make()); return geometries.get(key)};
 function texture(kind) {
  const c=document.createElement('canvas');c.width=c.height=kind==='paving'?1024:512;const ctx=c.getContext('2d');
  const colors={brick:'#ad8968',road:'#aaa6a0',plaster:'#fcf7e8',tile:'#c1663b',paving:'#d6cdc1',stone:'#a3a091',wood:'#ad926a',grass:'#a5b18c',water:'#81dfdc',metal:'#919ca4'};
  ctx.fillStyle=colors[kind];ctx.fillRect(0,0,512,512);
  let seed=127;const rand=()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296};
  for(let i=0;i<42000;i++){ctx.fillStyle=rand()>.5?(kind==='plaster'?'#ffffff04':'#ffffff12'):(kind==='plaster'?'#00000003':'#00000015');ctx.fillRect(rand()*512,rand()*512,.5+rand(),.5+rand())}
  if(kind==='plaster'){for(let i=0;i<45;i++){const x=rand()*512,y=rand()*512,r=12+rand()*56,g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'#9576490a');g.addColorStop(1,'#95764900');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}}
  if(kind==='tile'||kind==='stone'||kind==='paving'){
   const step=kind==='tile'?32:64;ctx.strokeStyle=kind==='tile'?'#56231865':'#785f4c55';ctx.lineWidth=kind==='tile'?2:1;
   for(let y=0;y<512;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();for(let x=(y/step%2)*step/2;x<512;x+=step){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+step);ctx.stroke();}}
   if(kind==='tile'){ctx.strokeStyle='#e99b6160';for(let x=3;x<512;x+=16){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,512);ctx.stroke();}}
  }
  if(kind==='paving'){ctx.fillStyle='#b1a38e';ctx.fillRect(0,0,1024,1024);for(let y=0;y<1024;y+=64)for(let x=-(y/64%2)*32;x<1024;x+=64){ctx.fillStyle=['#d5c3a8','#d9cbb6','#d2c1a7','#deccb1','#d7c8b1'][Math.floor(rand()*5)];ctx.fillRect(x+1,y+1,62,62);ctx.strokeStyle='#f0dfc430';ctx.strokeRect(x+2,y+2,59,59);}for(let i=0;i<18000;i++){ctx.fillStyle=i%2?'#ffffff09':'#59472f09';ctx.fillRect(rand()*1024,rand()*1024,1,1);}}
  if(kind==='brick'){for(let y=0;y<512;y+=32)for(let x=-(y/32%2)*64;x<512;x+=64){ctx.fillStyle=['#a78a70','#c39979','#b59277','#a88164'][Math.floor(rand()*4)];ctx.fillRect(x+2,y+2,61,29);ctx.strokeStyle='#544939';ctx.lineWidth=2;ctx.strokeRect(x,y,64,32);ctx.strokeStyle='#d0b19466';ctx.beginPath();ctx.moveTo(x+3,y+3);ctx.lineTo(x+60,y+3);ctx.stroke();}}
  if(kind==='metal'||kind==='wood'){ctx.strokeStyle='#34312c45';for(let x=0;x<512;x+=kind==='metal'?10:32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,512);ctx.stroke();}}
  if(kind==='water'){ctx.strokeStyle='#d4ffff4a';for(let i=0;i<300;i++){ctx.beginPath();const x=rand()*256,y=rand()*256;ctx.moveTo(x,y);ctx.lineTo(x+rand()*14+3,y);ctx.stroke();}}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;
 }
 const textures=Object.fromEntries(['road','plaster','tile','paving','stone','wood','grass','water','metal','brick'].map(k=>[k,texture(k)]));
 let plasterBump=textures.plaster;
 textures.brick.repeat.set(3,1);
 const interiors={};const interiorReady=Promise.all(['cafe','bakery','restaurant','grocery'].map(async name=>{const t=await new THREE.TextureLoader().loadAsync(new URL(`textures/${name}-interior.webp`,document.baseURI).href);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;interiors[name]=new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide});}));
 const plasterReady=new THREE.TextureLoader().loadAsync(new URL('textures/plaster.webp',document.baseURI).href).then(t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;plasterBump=t;for(const m of materials.values())if(m.userData.kind==='plaster'){m.bumpMap=t;m.bumpScale=.008;m.needsUpdate=true;}});
 const asphaltReady=new THREE.TextureLoader().loadAsync(new URL('textures/asphalt.webp',document.baseURI).href).then(t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;t.repeat.set(4,4);textures.road=t;for(const m of materials.values())if(m.userData.kind==='road'){m.map=m.bumpMap=t;m.bumpScale=.018;m.needsUpdate=true;}});
 const mat=(color,kind='',roughness=.85)=>{
  const key=color+kind+roughness;if(kind==='water'){if(!materials.has(key))materials.set(key,createWater(color,skyTexture));return materials.get(key)}if(!materials.has(key)){const material=new THREE.MeshStandardMaterial({color,map:textures[kind]||null,roughness,side:THREE.DoubleSide,bumpMap:kind==='plaster'?plasterBump:['road','paving','stone','wood','brick','water'].includes(kind)?textures[kind]:null,bumpScale:kind==='water'?.06:kind==='road'?.018:kind==='paving'?.018:.008});if(kind==='road')material.color.multiplyScalar(1.5);materials.set(key,material);}materials.get(key).userData.kind=kind;return materials.get(key);
 };
 const leaf=mat('#539529'),leafLight=mat('#76af32'),wood=mat('#ad8761','wood'),darkWood=mat('#b39a7b','wood'),concrete=mat('#f5ebd7','plaster'),rail=mat('#716653'),glass= new THREE.MeshPhysicalMaterial({color:'#655d51',metalness:0,roughness:.16,clearcoat:1,transparent:true,opacity:.12,side:THREE.DoubleSide});
 const foodTexture=new THREE.TextureLoader().load(new URL('food.png',document.baseURI).href);foodTexture.colorSpace=THREE.SRGBColorSpace;const foodMaterial=new THREE.MeshStandardMaterial({map:foodTexture,roughness:.8});
 const glow=new THREE.MeshStandardMaterial({color:'#ffe0a1',emissive:'#ffd17b',emissiveIntensity:3});
 const fleet=buildVehiclePrototypes(),auto=buildAuto({classicFace:true}),scooter=createMotorcycle('metro','#333936');
 const belt=new THREE.Mesh(new RoundedBoxGeometry(1.24,.17,.04,2,.012),mat('#eeb526','',.5));belt.position.set(0,.97,1.255);auto.add(belt);for(const side of[-1,1]){const strip=new THREE.Mesh(new THREE.BoxGeometry(.025,.17,1.4),belt.material);strip.position.set(side*.632,.97,.52);auto.add(strip);}for(const actor of [...Object.values(fleet),auto,scooter])batchAsset(actor);
 const palettes={cream:'#fff3d4',white:'#fffef0',ochre:'#edca6b',mustard:'#e7bf57',pink:'#f4b19f',mint:'#afe2bf',teal:'#61d5c6',blue:'#85bcde',yellow:'#f8dc85',laterite:'#d49672',lilac:'#c5a4d7',orange:'#e49568',red:'#ad4031',burgundy:'#732e39',brown:'#947250',grey:'#a5b0b1',green:'#619174'};
 function pigment(text){const t=(text||'cream').toLowerCase();return palettes[Object.keys(palettes).find(k=>t.includes(k))]||palettes.cream}
 return {build,mat,materials,fleet,auto,ready:Promise.all([foliage.ready,plasterReady,asphaltReady,interiorReady])};
 function build(layouts,phase) {
  const root=new THREE.Group(),obstacles=[],actors=[],objects=[],bays=[];
  const ground=mat(phase===1?'#b2bb83':'#a0ad83','grass'),paving=mat('#fff7ec','paving'),asphalt=mat('#fff0df','road'),tile=mat(phase===1?'#ef9e67':'#dda27c','tile');
  let current,origin;
  const vec=p=>new THREE.Vector3(...worldPoint(p,origin));
  function mesh(g,m,p=[0,0,0],rotation=[0,0,0],parent=root){const o=new THREE.Mesh(g,m);o.position.copy(vec(p));o.rotation.set(...rotation);o.castShadow=!m.transparent;o.receiveShadow=true;parent.add(o);return o;}
  function box(w,d,h,m,p,rotation=0){return mesh(geometry(`box:${w}:${d}:${h}`,()=>w<=2&&d<=2&&h<=2&&Math.min(w,d,h)>.07?new RoundedBoxGeometry(w,h,d,2,Math.min(.025,w*.05,h*.08,d*.05)):new THREE.BoxGeometry(w,h,d)),m,p,[0,rotation,0]);}
  function beam(a,b,r,m=wood){const aa=vec(a),bb=vec(b),delta=bb.clone().sub(aa);const o=new THREE.Mesh(geometry(`cyl:${r}:${delta.length().toFixed(3)}`,()=>new THREE.CylinderGeometry(r,r,delta.length(),7)),m);o.position.copy(aa.add(bb).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());o.castShadow=o.receiveShadow=true;root.add(o);return o;}
  function poly(points,m){const g=new THREE.BufferGeometry(),positions=points.map(p=>worldPoint(p,origin)).flat(),normal=new THREE.Vector3(...points[1]).sub(new THREE.Vector3(...points[0])).cross(new THREE.Vector3(...points[2]).sub(new THREE.Vector3(...points[0]))),vertical=Math.abs(normal.z)<Math.max(Math.abs(normal.x),Math.abs(normal.y)),uvScale=m.userData.kind==='paving'?6:3,uv=points.flatMap(p=>vertical?[p[Math.abs(normal.x)>Math.abs(normal.y)?1:0]/uvScale,p[2]/uvScale]:[p[0]/uvScale,p[1]/uvScale]);g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));const idx=[];for(let i=1;i<points.length-1;i++)idx.push(0,i,i+1);g.setIndex(idx);g.computeVertexNormals();const o=new THREE.Mesh(g,m);o.castShadow=!points.every(p=>p[2]===points[0][2]);o.receiveShadow=true;root.add(o);return o;}
  function rect(r,m,z=.01){if(phase===1&&r[3]-r[1]>12){let result;for(let y=r[1];y<r[3];y+=8)result=poly([[r[0],y,z],[r[2],y,z],[r[2],Math.min(y+8,r[3]),z],[r[0],Math.min(y+8,r[3]),z]],m);return result;}return poly([[r[0],r[1],z],[r[2],r[1],z],[r[2],r[3],z],[r[0],r[3],z]],m);}
  function collide(r,id){obstacles.push([r[0]+origin[0],r[1]+origin[1],r[2]+origin[0],r[3]+origin[1]]);objects.push({id,scene:current.key,rect:r,origin:[...origin]});}
  function wall(a,b,h=1.1,m=concrete,gap){
   const length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(!length)return;
   if(gap){const t=segmentDistance(gap.position[0],gap.position[1],a,b);if(t<.1){const d=Math.hypot(gap.position[0]-a[0],gap.position[1]-a[1]),half=gap.width/2,at=k=>[a[0]+(b[0]-a[0])*k/length,a[1]+(b[1]-a[1])*k/length];if(d>half)wall(a,at(d-half),h,m);if(d+half<length)wall(at(d+half),b,h,m);return;}}
   const angle=-Math.atan2(b[1]-a[1],b[0]-a[0]);box(length,.22,h,m,[(a[0]+b[0])/2,(a[1]+b[1])/2,h/2],angle);box(length+.1,.32,.1,concrete,[(a[0]+b[0])/2,(a[1]+b[1])/2,h+.02],angle);collide([Math.min(a[0],b[0])-.11,Math.min(a[1],b[1])-.11,Math.max(a[0],b[0])+.11,Math.max(a[1],b[1])+.11],'wall');
   for(let d=0;d<=length;d+=4){const x=a[0]+(b[0]-a[0])*d/length,y=a[1]+(b[1]-a[1])*d/length;box(.45,.45,h+.15,concrete,[x,y,(h+.15)/2]);}
  }
  function railing(a,b,h=1,m=darkWood,z=0){const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2.8);for(let i=0;i<=n;i++){const x=a[0]+(b[0]-a[0])*i/n,y=a[1]+(b[1]-a[1])*i/n;box(.15,.15,h,m,[x,y,z+h/2]);}for(const hh of [.38,.85])beam([a[0],a[1],z+hh*h],[b[0],b[1],z+hh*h],.045,m);}
  function put(group,p){group.position.copy(vec(p));group.updateMatrixWorld(true);group.traverse(o=>{if(!o.isMesh)return;const copy=new THREE.Mesh(o.geometry,o.material);copy.matrix.copy(o.matrixWorld);copy.matrixAutoUpdate=false;copy.castShadow=copy.receiveShadow=true;root.add(copy)});}
  function plant(x,y,size=1,pot=false){if(pot){mesh(geometry('pot',()=>new THREE.CylinderGeometry(.4,.27,.65,16)),mat('#d9ac7c'),[x,y,.325]);mesh(geometry('soil',()=>new THREE.CylinderGeometry(.35,.35,.025,16)),mat('#50452e'),[x,y,.65]);}put(foliage.plant(size,Math.floor(x+y)),[x,y,pot?.57:0]);}
  function shrub(x,y,size=.65,flower=false){put(foliage.shrub(size,flower,Math.floor(x+y)),[x,y,.03]);}
  function palm(x,y,h=10){put(foliage.palm(h,Math.floor(x+y)),[x,y,0]);}
  function tree(x,y,h=9,r=4){put(foliage.tree(h,r,Math.floor(x+y)),[x,y,0]);}
  function sign(text,p,width,angle=0,color='#426f56'){
   const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,512,128);ctx.strokeStyle='#f9eccb';ctx.lineWidth=6;ctx.strokeRect(8,8,496,112);ctx.fillStyle='#fff7df';ctx.font='bold 36px sans-serif';ctx.textAlign='center';ctx.fillText(text,256,76,470);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
   return mesh(new THREE.PlaneGeometry(width,width/4),new THREE.MeshStandardMaterial({map:t,roughness:.75,side:THREE.DoubleSide}),p,[0,angle,0]);
  }
  function tiledFace(points,m){
   poly(points,m);
   const world=points.map(vec),base=world[0],u=world[1].clone().sub(base).normalize(),normal=world[1].clone().sub(base).cross(world[2].clone().sub(base)).normalize();if(normal.y<0)normal.negate();if(normal.y<.15)return;
   const v=u.clone().cross(normal).normalize(),outline=world.map(p=>{const q=p.clone().sub(base);return[q.dot(u),q.dot(v)]}),r=bounds(outline),tiles=[];
   function contained(x,y){let found=false;for(let i=0,j=outline.length-1;i<outline.length;j=i++){const a=outline[i],b=outline[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])found=!found}return found;}
   for(let x=r[0]+.15;x<r[2]-.14;x+=.31)for(let y=r[1];y<r[3]-.21;y+=.43)if(contained(x-.13,y+.04)&&contained(x+.13,y+.43)&&contained(x+.13,y+.04)&&contained(x-.13,y+.43))tiles.push(base.clone().addScaledVector(u,x).addScaledVector(v,y).addScaledVector(normal,.014));
   const g=geometry('barrelTile',()=>{const g=new THREE.BufferGeometry(),p=[],uv=[],idx=[];for(let row=0;row<4;row++)for(let i=0;i<=8;i++){const t=i/8*Math.PI;p.push((i/8-.5)*.32,Math.sin(t)*.075+(row===3?.028:row===2?.008:0),[0,.22,.445,.465][row]);uv.push(i/8,row/3)}for(let row=0;row<3;row++)for(let i=0;i<8;i++){const j=row*9+i;idx.push(j,j+1,j+9,j+1,j+10,j+9)}g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;});
   const inst=new THREE.InstancedMesh(g,mat('#ffffff'),tiles.length),rotation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(u,normal,v)),matrix=new THREE.Matrix4();tiles.forEach((p,i)=>{matrix.compose(p,rotation,new THREE.Vector3(1,1,1));inst.setMatrixAt(i,matrix);inst.setColorAt(i,new THREE.Color().setHSL(.023+(i%7)*.0015,.84,.41+(i%11)*.004));});inst.castShadow=inst.receiveShadow=true;root.add(inst);
  }
  function cafeFurniture(x,y){
   box(.9,.72,.085,wood,[x,y,.78]);for(const dx of[-.36,.36])for(const dy of[-.26,.26])beam([x+dx,y+dy,.05],[x+dx,y+dy,.76],.033,wood);
   mesh(geometry('plate',()=>new THREE.CylinderGeometry(.12,.12,.015,18)),mat('#fff6df'),[x+.18,y,.834]);mesh(geometry('cup',()=>new THREE.CylinderGeometry(.047,.04,.09,14)),mat('#eae7dd'),[x-.18,y+.1,.88]);mesh(geometry('coffee',()=>new THREE.CylinderGeometry(.039,.039,.007,12)),mat('#513420'),[x-.18,y+.1,.929]);
   for(const side of[-1,1]){box(.44,.43,.07,wood,[x,y+side*.75,.43]);for(const dx of[-.19,.19])beam([x+dx,y+side*.96,0],[x+dx,y+side*.96,1.0],.026,wood);for(const h of[.59,.76,.94])box(.43,.06,.052,wood,[x,y+side*.96,h]);for(const dx of[-.18,.18])for(const dy of[-.18,.18])beam([x+dx,y+side*.75+dy,0],[x+dx,y+side*.75+dy,.44],.027,wood);}
  }
  function roof(b){
   const [x0,y0,x1,y1]=b.rect,e=b.height,top=b.top,m=/grey|sheet/.test(b.roof.material||'')?mat('#bbc8d0','metal'):b.roof.detail==='distant'?mat('#d8774a'):tile;
   const a=[x0-.5,y0-.5,e],bb=[x1+.5,y0-.5,e],c=[x1+.5,y1+.5,e],d=[x0-.5,y1+.5,e];
   if(b.roof.shape==='flat') {box(x1-x0+.3,y1-y0+.3,.2,concrete,[(x0+x1)/2,(y0+y1)/2,e]);for(const [p,q]of [[a,bb],[bb,c],[c,d],[d,a]])box(Math.hypot(q[0]-p[0],q[1]-p[1]),.22,.45,concrete,[(p[0]+q[0])/2,(p[1]+q[1])/2,e+.2],-Math.atan2(q[1]-p[1],q[0]-p[0]));const tx=b.id==='B_BAKERY'?x1-1.4:x0+2,ty=y1-1.5;mesh(geometry('tank',()=>new THREE.CylinderGeometry(.48,.48,1.25,20)),mat('#333e41'),[tx,ty,e+.625]);for(const z of[.15,.4,.65,.9,1.14])mesh(geometry('tankRing',()=>new THREE.TorusGeometry(.488,.012,5,20)),mat('#414c4d'),[tx,ty,e+z],[Math.PI/2,0,0]);if(b.id==='B_BAKERY'){box(1.1,.8,.85,concrete,[x0+1.4,y0+1,e+.5]);mesh(geometry('acFan',()=>new THREE.CircleGeometry(.3,24)),mat('#687578'),[x0+1.4,y0+.58,e+.5]);for(let i=0;i<7;i++)box(.65,.03,.012,mat('#a8aba6'),[x0+1.4,y0+.57,e+.25+i*.07]);}return;}
   if(b.roof.shape==='single_pitch'){poly([a,bb,[c[0],c[1],top],[d[0],d[1],top]],m);return;}
   const ns=b.roof.ridge_axis==='north-south'||(b.roof.shape==='hip'&&y1-y0>x1-x0),hip=b.roof.shape==='hip',cx=(x0+x1)/2,cy=(y0+y1)/2;
   const inset=hip?Math.min(x1-x0,y1-y0)*.35:0,r1=ns?[cx,y0+inset,top]:[x0+inset,cy,top],r2=ns?[cx,y1-inset,top]:[x1-inset,cy,top];
   const face=m===tile?tiledFace:poly;
   if(ns){face([a,bb,r1],hip?m:mat(pigment(b.walls),b.id==='B_WAREHOUSE'?'brick':/laterite|brick/.test(b.walls)?'stone':'plaster'));face([c,d,r2],hip?m:mat(pigment(b.walls),b.id==='B_WAREHOUSE'?'brick':/laterite|brick/.test(b.walls)?'stone':'plaster'));face([a,r1,r2,d],m);face([bb,c,r2,r1],m);}else{face([a,bb,r2,r1],m);face([d,r1,r2,c],m);face([a,r1,d],hip?m:mat(pigment(b.walls),b.id==='B_WAREHOUSE'?'brick':/laterite|brick/.test(b.walls)?'stone':'plaster'));face([bb,c,r2],hip?m:mat(pigment(b.walls),b.id==='B_WAREHOUSE'?'brick':/laterite|brick/.test(b.walls)?'stone':'plaster'));}
   beam(r1,r2,.15,mat('#d48758'));if(hip){for(const [p,q]of(ns?[[a,r1],[bb,r1],[c,r2],[d,r2]]:[[a,r1],[d,r1],[bb,r2],[c,r2]]))beam(p,q,.14,mat('#d48758'));}
   for(const [p,q]of [[a,bb],[bb,c],[c,d],[d,a]])beam(p,q,.07,darkWood);
  }
  function building(b){
   const [x0,y0,x1,y1]=b.rect,w=x1-x0,d=y1-y0,cx=(x0+x1)/2,cy=(y0+y1)/2,e=b.height,shopTop=current.key==='p1-scene_01'&&b.id==='B_BAKERY'?3.5:current.key==='p1-scene_01'&&b.id==='B_CAFE'?2.45:2.8;
   const view=current.reference_views.find(c=>c.file==='02_PLAYER_GAMEPLAY.png')||current.reference_views[0],dx=view.target_position_m[0]-view.camera_position_m[0],dy=view.target_position_m[1]-view.camera_position_m[1],nearFace=Math.abs(dx)>Math.abs(dy)?(dx>0?'west':'east'):(dy>0?'south':'north'),openDirs=b.loading_door_size_m?[b.direction]:[...new Set([b.direction,nearFace])];
   const facade=dir=>{const ew=dir==='east'||dir==='west',out=dir==='east'||dir==='north'?1:-1,fx=ew?(dir==='east'?x1:x0):cx,fy=ew?cy:(dir==='north'?y1:y0),angle=dir==='east'?Math.PI/2:dir==='west'?-Math.PI/2:dir==='north'?Math.PI:0;return{ew,length:ew?d:w,angle,place:(a,z,o)=>ew?[fx+out*o,fy+a,z]:[fx+a,fy+out*o,z]};};
   rect([x0-1,y0-1,x1+1,y1+1],paving,.15);const shell=box(w,d,e,mat(pigment(b.walls),b.id==='B_WAREHOUSE'?'brick':/laterite|brick/.test(b.walls)?'stone':'plaster'),[cx,cy,e/2]);collide(b.rect,b.id);shell.updateMatrixWorld(true);const measured=new THREE.Box3().setFromObject(shell);objects.at(-1).renderedRect=[measured.min.x-origin[0],-measured.max.z-origin[1],measured.max.x-origin[0],-measured.min.z-origin[1]];objects.at(-1).renderedHeight=measured.max.y-measured.min.y;
   if(b.awning){const f=facade(nearFace),lamp=new THREE.PointLight('#ffbc61',20,12,2);lamp.position.copy(vec(f.place(0,2.2,-1.1)));root.add(lamp);}
   if(b.awning||b.loading_door_size_m){
    root.remove(shell);const gh=Math.min(b.loading_door_size_m?.height||shopTop,e),paint=mat(pigment(b.walls),b.id==='B_WAREHOUSE'?'brick':/laterite|brick/.test(b.walls)?'stone':'plaster');if(e>gh)box(w,d,e-gh,paint,[cx,cy,gh+(e-gh)/2]);for(const dir of['east','west','north','south'])if(!openDirs.includes(dir)){const f=facade(dir);box(f.length,.24,gh,paint,f.place(0,gh/2,0),f.angle);}box(w,d,.12,wood,[cx,cy,.12]);box(w,d,.14,concrete,[cx,cy,gh]);
    for(const x of[x0,x1])for(const y of[y0,y1])box(.42,.42,gh,paint,[x,y,gh/2]);
    for(const dir of['east','west','north','south'])if(!openDirs.includes(dir)){const f=facade(dir);box(f.length-.5,.025,gh-.2,new THREE.MeshStandardMaterial({color:'#bf9860',emissive:'#573d1d',emissiveIntensity:.35,roughness:.9}),f.place(0,gh/2,-.15),f.angle);}
    const interior=/CAFE|BAKERY|RESTAURANT|SEAFOOD|SNACK|TAKEAWAY|TEA|GROCERY|PROVISION/.test(b.id)?(b.id==='B_CAFE'?'cafe':b.id==='B_BAKERY'?'bakery':/GROCERY|PROVISION/.test(b.id)?'grocery':'restaurant'):null;
    if(interior){const material=interiors[interior];for(const dir of openDirs){const f=facade(dir),count=Math.max(1,Math.round(f.length/7)),width=(f.length-.7)/count;for(let i=0;i<count;i++){const along=(i-(count-1)/2)*width;mesh(geometry(`interior:${width}:${gh}`,()=>new THREE.PlaneGeometry(width-.08,gh-.2)),material,f.place(along,gh/2,-1.5),[0,f.angle,0]);box(width-.1,.5,.65,wood,f.place(along,.4,-1.15),f.angle);}}}
    if(!b.loading_door_size_m&&!interior)for(const dir of openDirs){const f=facade(dir);for(let a=-f.length/2+1.5;a<f.length/2-1;a+=2.4){
     for(let z=.6;z<(b.id==='B_CAFE'?.7:2);z+=.45){box(1.9,1.2,.075,darkWood,f.place(a,z,-2),f.angle);for(let k=0;k<6;k++){const bread=mesh(geometry('bread',()=>new THREE.SphereGeometry(.11,8,6)),mat(/GROCERY|PROVISION/.test(b.id)?['#df9b27','#c8432a','#8daa32','#e5cb5b','#d77926','#829e37'][k]:k%2?'#bd8444':'#e4bf77'),f.place(a+(k%3)*.38-.4,z+.14,-1.8-(k%2)*.22));bread.scale.set(1.3,.7,1);}}
     const lamp=f.place(a,2.23,-.75);beam([lamp[0],lamp[1],gh],[lamp[0],lamp[1],2.25],.015,rail);mesh(geometry('pendant',()=>new THREE.ConeGeometry(.2,.16,12)),mat('#e8c88a'),lamp);mesh(geometry('bulb',()=>new THREE.SphereGeometry(.12,12,8)),glow,[lamp[0],lamp[1],2.14]);
    }}
   }
   if(/lilac/.test(b.walls))box(w+.01,d+.01,e/2,mat(palettes.teal,'plaster'),[cx,cy,e/4]);
   box(w+.15,d+.15,.18,concrete,[cx,cy,.09]);for(let i=1;i<=b.floors;i++)box(w+.25,d+.25,.12,concrete,[cx,cy,e*i/b.floors]);
   roof(b);if(b.id==='B_CAFE'){box(w+.25,d+.25,.16,concrete,[cx,cy,2.65]);box(w+.18,d+.18,.09,concrete,[cx,cy,2.85]);}
   const faces=[['east',x1,cy,d,-Math.PI/2],['west',x0,cy,d,Math.PI/2],['north',cx,y1,w,0],['south',cx,y0,w,Math.PI]];
   for(const [dir,fx,fy,length,angle]of faces){
    const eastWest=dir==='east'||dir==='west',out=dir==='east'||dir==='north'?1:-1;
    const place=(along,z,offset=.035)=>eastWest?[fx+out*offset,fy+along,z]:[fx+along,fy+out*offset,z];
    const count=b.id==='B_CAFE'?(eastWest?3:2):Math.max(2,Math.floor(length/4.8));
    for(let floor=0;floor<b.floors;floor++)for(let i=0;i<count;i++){
     const along=(i-(count-1)/2)*length/(count+.5),z=e/b.floors*(floor+.55),ww=Math.min(1.35,length/(count*2));
     if(floor===0&&b.awning&&openDirs.includes(dir))continue;
     if(floor===0&&dir===b.direction&&Math.abs(along)<2.5)continue;
     const trim=box(ww+.3,.15,1.75,concrete,place(along,z),angle);box(ww,.17,1.45,mat('#594532'),place(along,z,.12),angle);box(ww-.13,.02,1.31,glass,place(along,z,.22),angle);
     box(.07,.06,1.4,mat('#594532'),place(along,z,.24),angle);box(ww,.06,.06,mat('#594532'),place(along,z,.24),angle);
     if(phase===1)for(const side of [-1,1]){box(.36,.09,1.5,mat('#39765c'),place(along+side*(ww/2+.2),z,.12),angle);for(let slat=0;slat<18;slat++)box(.35,.1,.04,mat('#315e4d'),place(along+side*(ww/2+.2),z-.66+slat*.075,.15),angle);}
     box(ww+.4,.35,.12,concrete,place(along,z-.85,.14),angle);trim.name='Window surround';
    }
   }
   const dir=b.direction,ew=dir==='east'||dir==='west',out=dir==='east'||dir==='north'?1:-1,angle=dir==='east'?Math.PI/2:dir==='west'?-Math.PI/2:dir==='north'?Math.PI:0;
   const front=b.entrance||[cx,y0,0],fx=front[0],fy=front[1],width=b.loading_door_size_m?.width||b.entrances?.[0]?.width_m||1.6,doorHeight=b.loading_door_size_m?.height||(shopTop===3.5?3.2:2.5);
   const point=(along,z,offset)=>ew?[fx+out*offset,fy+along,z]:[fx+along,fy+out*offset,z];
   if(b.loading_door_size_m){
    box(width+.4,.25,.2,concrete,point(0,doorHeight+.1,.03),angle);for(const side of[-1,1]){box(.2,.25,doorHeight,concrete,point(side*(width/2+.1),doorHeight/2,.03),angle);box(1.7,.12,doorHeight,mat('#a7afb0','metal'),point(side*(width/2+.95),doorHeight/2,.55),angle+side*.3);}for(let i=0;i<7;i++)box(.8,.8,.6,wood,point((i%3-1)*1.0,.3+Math.floor(i/3)*.6,-2));
   }else{box(width+.35,.24,doorHeight+.2,concrete,point(0,(doorHeight+.2)/2,.03),angle);box(width,.28,doorHeight,darkWood,point(0,doorHeight/2,.12),angle);box(width-.25,.05,doorHeight*.67,glass,point(0,doorHeight*.58,.3),angle);box(.08,.1,doorHeight,darkWood,point(0,doorHeight/2,.34),angle);}
   if(b.secondary_door){const f=facade('south');box(5,.12,2.5,mat('#a5acad','metal'),f.place(-2,1.35,.12),f.angle);for(let z=.2;z<2.6;z+=.11)box(5,.025,.025,mat('#798789'),f.place(-2,z,.2),f.angle);}
   const name=b.name||b.id.replace('B_','').replaceAll('_',' ');if(!b.awning&&!['B_CAFE','B_BAKERY'].includes(b.id))sign(name.toUpperCase(),point(0,doorHeight+.8,.3),Math.min(6,ew?d-2:w-2),angle);

   const shopGlass=new THREE.MeshPhysicalMaterial({color:'#63726a',transparent:true,opacity:/RESTAURANT|CAFE|SEAFOOD|SNACK/.test(b.id)?.08:.22,roughness:.14,metalness:.05,side:THREE.DoubleSide,depthWrite:false});
   if(b.awning){
    for(const dir of openDirs){const f=facade(dir),ew=f.ew,L=f.length-1.4,ang=f.angle,p=f.place;

     for(let i=0;i<Math.ceil(L/2);i++){const a=(i+.5)*L/Math.ceil(L/2)-L/2;box(L/Math.ceil(L/2)-.12,.025,shopTop-.6,shopGlass,p(a,shopTop/2+.1,.14),ang);box(.08,.1,shopTop-.2,mat('#455849'),p(a-L/Math.ceil(L/2)/2,shopTop/2,.18),ang);}
     const projection=phase===1&&b.id==='B_BAKERY'&&ew?.55:1.7,stripes=b.id==='B_BAKERY'?16:24,awningText=typeof b.awning==='string'?b.awning:JSON.stringify(b.awning),striped=phase===1||/stripe/i.test(awningText),awningColor=phase===1&&b.id==='B_CAFE'?'#edbd58':phase===1&&b.id==='B_BAKERY'?'#7eb9d3':/red/i.test(awningText)?'#ad2925':/white/i.test(awningText)?'#fff6df':/blue/i.test(awningText)?'#739bac':/green/i.test(awningText)?'#548858':'#cfbc91';for(let i=0;i<stripes;i++){const width=L/stripes,a=(i+.5)*width-L/2,am=mat(striped&&i%2?'#fff5da':awningColor);const canopy=box(width,projection,.055,am,p(a,shopTop+.05,projection/2+.05),ang);canopy.rotateX(.18);const shape=new THREE.Shape();shape.moveTo(-width/2,0);shape.lineTo(width/2,0);shape.lineTo(width/2,-.18);shape.quadraticCurveTo(0,-.33,-width/2,-.18);shape.closePath();mesh(new THREE.ShapeGeometry(shape),am,p(a,shopTop-.1,projection+.05),[0,ang,0]);}box(L+.2,.16,.16,concrete,p(0,shopTop+.19,.07),ang);

    }
    if(b.id==='B_CAFE'||b.id==='B_SEAFOOD'||phase===1&&b.id==='B_RESTAURANT'){for(const dir of openDirs){const f=facade(dir),count=Math.max(2,Math.floor(f.length/4));for(let i=0;i<count;i++){const p=f.place((i-(count-1)/2)*4,0,f.ew?1.2:1.8);cafeFurniture(p[0],p[1]);}for(const a of[-f.length/2+.7,f.length/2-.7]){const p=f.place(a,0,1.5);plant(p[0],p[1],1.7,true);const board=f.place(a,.65,1.33);box(.65,.13,1.05,wood,board,f.angle);box(.55,.025,.88,mat('#263d30'),f.place(a,.65,1.41),f.angle);for(let row=0;row<5;row++)box(.32,.013,.012,mat('#ddd8b7'),f.place(a,.86-row*.1,1.428),f.angle);}}}
   }
   if(b.id==='B_MARKET'){const f=facade(b.direction);box(f.length-2,.85,.9,concrete,f.place(0,.55,1.25),f.angle);for(let a=-f.length/2+2;a<f.length/2-1;a+=1.5){box(.85,.7,.4,mat('#5b9dbb'),f.place(a,.22,2.1),f.angle);for(let k=0;k<5;k++){const fish=mesh(geometry('fish',()=>new THREE.SphereGeometry(.15,12,8)),mat('#a4b6b7', '',.45),f.place(a+(k%2)*.2,.99,1.0+(k%3)*.17));fish.scale.set(1,.2,.5);}}}
   if(phase===2&&/RESTAURANT|TAKEAWAY/.test(b.id)&&b.awning){const f=facade(b.direction);for(const a of[-f.length/2+1,f.length/2-1]){box(.85,.17,2.6,mat('#854d23'),f.place(a,1.4,.28),f.angle);for(const z of[.6,1.35,2.1]){mesh(geometry('foodPlate',()=>new THREE.CircleGeometry(.33,24)),foodMaterial,f.place(a,z,.38),[0,f.angle,0]);mesh(geometry('foodFrame',()=>new THREE.TorusGeometry(.35,.022,7,24)),mat('#e3ba5e'),f.place(a,z,.39),[0,f.angle,0]);}}for(const a of[-f.length/2+3,f.length/2-3]){const p=f.place(a,0,1.8);cafeFurniture(p[0],p[1]);}}
   if(b.balcony||b.balconies&&b.balconies!=='none'){
    const balconyRail=phase===1&&current.terrain.water_region_xy?rail:mat('#303d35'),directions=[b.direction];if(b.balcony?.secondary_edge?.includes('south'))directions.push('south');
    for(const dir of directions){const f=facade(dir),bl=f.length-1;for(let floor=1;floor<b.floors;floor++){const level=e*floor/b.floors,middle=f.place(0,level,1);box(bl,1.5,.18,concrete,middle,f.angle);
     const count=Math.ceil(bl/.3);for(let i=0;i<=count;i++)box(.055,.055,1,balconyRail,f.place((i/count-.5)*bl,level+.5,1.7));beam(f.place(-bl/2,level+1,1.7),f.place(bl/2,level+1,1.7),.045,balconyRail);
     for(let a=-bl/2+.8;a<bl/2;a+=2.5){const p=f.place(a,level+.12,1.4);mesh(geometry('balconyPot',()=>new THREE.CylinderGeometry(.22,.15,.4,12)),mat('#bd7954'),[p[0],p[1],level+.25]);put(foliage.shrub(.6,true,Math.floor(a)),[p[0],p[1],level+.4]);}
    }}
   }
   if(b.compound){const pts=b.compound.boundary_xy||b.compound.footprint_xy,gap={position:b.compound.gate_position,width:b.compound.gate_width_m};for(let i=0;i<pts.length;i++)wall(pts[i],pts[(i+1)%pts.length],b.compound.wall_height_m,concrete,gap);}
   for(const side of[-1,1])for(let i=0;i<9;i++){const px=cx+side*(w/2+2.6),py=y0+1+i*(d-2)/8;if(current.roads.every(r=>roadDistance(r,px,py)>r.width_m/2+1)&&Math.hypot(px-fx,py-fy)>4)shrub(px,py,.65,i%3===0);}
   for(const p of [[x0-3,y0-3],[x1+3,y1+3]])if(current.roads.every(r=>roadDistance(r,...p)>r.width_m/2+2.5)){plant(p[0],p[1],2.3);shrub(p[0]+1,p[1],1);}
   if(b.bell_tower){const p=b.bell_tower.position,h=b.bell_tower.height_m,white=mat('#fffdf4'),base=h-3;
    box(3,3,base,white,[p[0],p[1],base/2]);for(const z of[base-.2,base, h-.6])box(3.35,3.35,.18,white,[p[0],p[1],z]);
    for(const x of[-1.3,1.3])for(const y of[-1.3,1.3])box(.4,.4,2.4,white,[p[0]+x,p[1]+y,base+1.2]);
    for(const [dx,dy,angle]of[[1.51,0,Math.PI/2],[-1.51,0,Math.PI/2],[0,-1.51,0],[0,1.51,0]])mesh(geometry('bellArch',()=>new THREE.TorusGeometry(1.05,.18,8,24,Math.PI)),white,[p[0]+dx,p[1]+dy,base+1.3],[0,angle,0]);
    mesh(geometry('bell',()=>new THREE.ConeGeometry(.4,.65,16,1,true)),mat('#9e7d43','',.4),[p[0],p[1],base+1.1]);beam([p[0],p[1],base+1.5],[p[0],p[1],h-.5],.025,rail);
    mesh(geometry('chapelDome',()=>new THREE.SphereGeometry(1.2,24,12,0,Math.PI*2,0,Math.PI/2)),white,[p[0],p[1],h-.45]);beam([p[0],p[1],h+.65],[p[0],p[1],h+2],.07,white);beam([p[0]-.5,p[1],h+1.55],[p[0]+.5,p[1],h+1.55],.07,white);
   }
   // Small plants belong to the fixed building lots; no additional buildings are invented.
   for(let i=0;i<6;i++){const px=x0+1+i*(w-2)/5,py=y0-1.4;const clear=current.roads.every(r=>roadDistance(r,px,py)>r.width_m/2+1);if(clear)plant(px,py,.9,i%2===0);}
  }
  function road(r){
   if(r.centerline.length>2){for(let i=1;i<r.centerline.length;i++)road({...r,centerline:[r.centerline[i-1],r.centerline[i]],spurs:[]});return;}
   const size=current.scene.playable_size_m,[a0,b0]=[r.centerline[0],r.centerline.at(-1)],a=[Math.max(0,Math.min(size.east_west,a0[0])),Math.max(0,Math.min(size.north_south,a0[1]))],b=[Math.max(0,Math.min(size.east_west,b0[0])),Math.max(0,Math.min(size.north_south,b0[1]))],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len;
   const isAsphalt=/asphalt/.test(r.surface),steps=Math.ceil(len/3),other=current.roads.filter(rr=>rr.id!==r.id);
   for(let i=0;i<steps;i++){
    const t=i/steps,tt=(i+1)/steps,aa=[a[0]+dx*t,a[1]+dy*t],bb=[a[0]+dx*tt,a[1]+dy*tt],wa=roadWidth(r,aa[1])/2,wb=roadWidth(r,bb[1])/2;
    poly([[aa[0]+nx*wa,aa[1]+ny*wa,.06],[aa[0]-nx*wa,aa[1]-ny*wa,.06],[bb[0]-nx*wb,bb[1]-ny*wb,.06],[bb[0]+nx*wb,bb[1]+ny*wb,.06]],isAsphalt?asphalt:paving);
    if(!isAsphalt)continue;
    const mx=(aa[0]+bb[0])/2,my=(aa[1]+bb[1])/2,intersection=other.some(rr=>roadDistance(rr,mx,my)<rr.width_m/2+1);
    if(!intersection){
     if(phase===2&&['SCENE_01','SCENE_02'].includes(current.scene.id))for(const side of[-1,1])box(.25,len/steps,.015,mat('#cd9580','paving'),[mx+nx*side*(wa+.18),my+ny*side*(wa+.18),.12],-Math.atan2(dx,dy));
     if(i%3===0)box(.12,2,.012,mat('#eee8cd'),[mx,my,.075],-Math.atan2(dx,dy));
     for(const side of [-1,1]){const x=mx+nx*side*(wa+.7),y=my+ny*side*(wa+.7);box(1.4,len/steps+.01,.1,paving,[x,y,.06],-Math.atan2(dx,dy));box(.12,len/steps,.013,mat('#eee8d8'),[mx+nx*side*(wa-.18),my+ny*side*(wa-.18),.08],-Math.atan2(dx,dy));}
    }
   }
   for(const spur of r.spurs||[])road({...r,centerline:spur,spurs:[]});
  }
  function bench(p,angle=0){const at=(x,y,z)=>[p[0]+Math.cos(angle)*x-Math.sin(angle)*y,p[1]+Math.sin(angle)*x+Math.cos(angle)*y,z];for(let i=0;i<5;i++)box(2.4,.09,.065,wood,at(0,-.2+i*.1,.55),angle);for(let i=0;i<3;i++)box(2.4,.065,.13,wood,at(0,.25,.76+i*.18),angle);for(const x of[-.95,.95]){box(.25,.58,.52,concrete,at(x,0,.26),angle);beam(at(x,.25,.5),at(x,.25,1.15),.04,rail);}}
  function pier(l){const r=bounds(l.footprint_xy);rect(r,wood,.12);for(let x=r[0];x<=r[2];x+=2.5){for(const y of[r[1],r[3]])beam([x,y,-2],[x,y,.15],.13,darkWood);box(.06,r[3]-r[1],.02,darkWood,[x,(r[1]+r[3])/2,.14]);}railing([r[0],r[1]],[r[2],r[1]]);railing([r[0],r[3]],[r[2],r[3]]);if(l.canopy){const c=bounds(l.canopy.footprint_xy),h=l.canopy.eaves_z_m;for(const x of[c[0],c[2]])for(const y of[c[1],c[3]])beam([x,y,0],[x,y,h],.08,wood);roof({rect:c,height:h,top:h+1.05,roof:{shape:"hip",material:"red clay tiles"}});}}
  function net(l){
   rect(bounds(l.platform_footprint_xy),wood,.2);const p=l.pivot_position,x=p[0],y=p[1],h=p[2],end=x+l.boom_reach_east_m,span=l.mesh.approx_span_m;
   for(const dy of [-2,2]){beam([x-3,y+dy,0],[x,y,h],.17,darkWood);beam([x+1,y+dy,0],[x,y,h],.14,darkWood);}
   beam([x-5,y,3],[end,y,h-1],.12,wood);
   const corners=[[end-span/2,y-span/2,.8],[end+span/2,y-span/2,.8],[end+span/2,y+span/2,.8],[end-span/2,y+span/2,.8]];
   for(const c of corners)beam([end,y,h-1],c,.018,rail);
   const nm=new THREE.MeshStandardMaterial({color:'#364d48',transparent:true,opacity:.14,side:THREE.DoubleSide,depthWrite:false});poly(corners,nm);
   for(let i=0;i<=20;i++){const t=i/20;beam([end-span/2+span*t,y-span/2,.8],[end-span/2+span*t,y+span/2,.8],.007,rail);beam([end-span/2,y-span/2+span*t,.8],[end+span/2,y-span/2+span*t,.8],.007,rail);}
   const weight=l.counterweights_position||[x-5,y,2];for(let i=0;i<3;i++){beam([weight[0]+i*.42,y,3.8],[weight[0]+i*.42,y,2.6],.025,rail);mesh(geometry('netWeight',()=>new THREE.IcosahedronGeometry(.35,2)),mat('#969181','stone'),[weight[0]+i*.42,y,2.5]).scale.set(1,1.2,.8);}
  }
  function boat(p,angle=0){const z=p[2]??-1.2;const o=mesh(geometry('hull',()=>new THREE.SphereGeometry(1,20,9)),mat('#4d9abf'),[p[0],p[1],z+.08],[0,angle,0]);o.scale.set(.85,.36,2.8);box(1.4,4.3,.12,wood,[p[0],p[1],z+.3],angle);box(.8,1.15,.8,concrete,[p[0],p[1]-.2,z+.76],angle);box(.96,1.3,.11,concrete,[p[0],p[1]-.2,z+1.2],angle);for(const side of[-1,1])box(.03,.6,.36,glass,[p[0]+side*.415,p[1]-.2,z+.86],angle);beam([p[0],p[1]+.8,z+.3],[p[0],p[1]+.8,z+1.7],.035,concrete);}
  function vehicle(template,p,heading,id){const o=template.clone(true);o.position.copy(vec(p));o.rotation.y=heading;root.add(o);actors.push(o);const bb=new THREE.Box3().setFromObject(o);obstacles.push([bb.min.x,-bb.max.z,bb.max.x,-bb.min.z]);objects.push({id,scene:current.key,position:p});return o;}
  function pole(p,h=8){beam(p,[p[0],p[1],h],.1,concrete);beam([p[0]-1.2,p[1],h-.5],[p[0]+1.2,p[1],h-.5],.05,rail);beam([p[0],p[1],h-1],[p[0]+1.7,p[1],h-1],.04,rail);box(.6,.25,.1,concrete,[p[0]+1.7,p[1],h-1]);collide([p[0]-.12,p[1]-.12,p[0]+.12,p[1]+.12],'pole');}
  function heading(p){return {north:0,east:-Math.PI/2,south:Math.PI,west:Math.PI/2}[p.heading]??-(p.orientation_degrees||0)*Math.PI/180;}
  origin=[0,0,0];if(phase===1){rect([-500,-250,81.32,900],ground,-.035);rect([81.32,-250,1000,900],mat('#62afea','water',.2),-1.2);}else{rect([-500,-250,650,226],ground,-.035);rect([-500,242,650,900],ground,-.035);rect([-500,226,650,242],mat('#869887','water',.28),-1.2);}
  for(const s of layouts){
   current=s;origin=s.origin;const {east_west:w,north_south:d}=s.scene.playable_size_m;
   const water=s.terrain.water_region_xy?bounds(s.terrain.water_region_xy):s.terrain.canal_rect;
   if(water){if(s.terrain.canal_rect){rect([0,0,w,water[1]],ground,-.025);rect([0,water[3],w,d],ground,-.025);}else rect([0,0,water[0],d],ground,-.025);if(phase!==1)rect(water,mat(phase===1?'#94ffff':'#869887','water',.28),-1.2);}else rect([0,0,w,d],ground,-.025);
   for(const p of s.paths||[]){const r=p.footprint_xy?bounds(p.footprint_xy):[p.x[0],p.y[0],p.x[1],p.y[1]];rect(r,phase===1&&r[0]>76?mat('#efbfaf','paving'):paving,.012);}
   if(phase===2&&s.key!=='p2-scene_03'){const ranges=s.terrain.canal_rect?[[0,s.terrain.canal_rect[1]],[s.terrain.canal_rect[3],d]]:[[0,d]];for(const [lo,hi]of ranges){rect([52,lo,57.75,hi],paving,.045);rect([62.25,lo,68,hi],paving,.045);}}
   for(const r of s.roads)road(r);
   if(s.key==='p1-scene_01'){for(const [cy,sign]of[[39.8,1],[48.2,-1]]){const arc=[];for(let i=0;i<=16;i++){const a=i/16*Math.PI/2;arc.push([68.1+1.2*Math.cos(a),cy+sign*1.2*Math.sin(a),.13]);}const corner=[69.3,cy, .13],other=[69.3,cy+sign*1.2,.13];poly([corner,other,...arc.slice().reverse()],asphalt);for(let i=1;i<arc.length;i++)beam(arc[i-1],arc[i],.055,concrete);}
    for(let y=0;y<100;y+=6){box(.34,.38,1.05,concrete,[75.85,y,.525]);box(.43,.47,.12,concrete,[75.85,y,1.1]);if(y+6<100)beam([75.85,y,.82],[75.85,y+6,.82],.028,mat('#8b9897'));}collide([75.65,0,76.05,100],'promenade-road-rail');
   }

   for(const b of s.buildings)building(b);
   // Static ornamental landscaping fills the reference's planted yards, outside routes and bays.
   for(const b of s.buildings){const [x0,y0,x1,y1]=b.rect;for(let x=x0-5;x<=x1+5;x+=2.5)for(const y of[y0-4,y1+4]){if(x<2||y<2||x>w-2||y>d-2)continue;const clear=s.roads.every(r=>roadDistance(r,x,y)>r.width_m/2+2)&&s.buildings.every(bb=>!inside(x,y,bb.rect,1))&&s.bays.every(bb=>!inside(x,y,bb.rect,1));if(clear){shrub(x,y,1.1,(Math.floor(x+y)%3)===0);if(Math.floor(x)%5===0)plant(x,y,2.4);}}}
   for(const b of s.buildings){const [x0,y0,x1,y1]=b.rect,cx=(x0+x1)/2,cy=(y0+y1)/2,ew=b.direction==='east'||b.direction==='west';for(let i=0;i<3;i++){const x=ew?(b.direction==='east'?x0-2.5:x1+2.5):x0+(x1-x0)*(i+.5)/3,y=ew?y0+(y1-y0)*(i+.5)/3:(b.direction==='north'?y0-2.5:y1+2.5);if(s.roads.every(r=>roadDistance(r,x,y)>r.width_m/2+2)&&s.buildings.every(other=>other===b||!inside(x,y,other.rect,2))){palm(x,y,Math.min(15,b.height+5+i));if(i===1)tree(x+(ew?-3:0),y+(ew?0:3),Math.min(14,b.height+5),3.8);}}}
   if(s.key==='p2-scene_01')for(const x of[52,68]){rect([x-2,0,x+2,11],paving,.15);for(const y of[3,7]){box(2.8,2.4,.65,concrete,[x,y,.325]);box(2.5,2.1,.02,mat('#66573c'),[x,y,.66]);put(foliage.shrub(1.4,true,Math.floor(x+y)),[x,y,.6]);plant(x,y,2.1);}}
   if(s.key==='p2-scene_03')wall([8,55],[30,55],1.1,concrete,{position:[18,55],width:6});
   if(s.key==='p1-scene_04'){for(const x of[47.2,54.8]){rect([x-1.3,0,x+1.3,32],paving,.15);for(let y=8;y<32;y+=3.5){plant(x,y,1.45,true);shrub(x,y,1.1,true);}}vehicle(fleet.car,[50.5,68,.07],Math.PI,'REFERENCE_CAR');}
   if(s.key==='p1-scene_03'){palm(35,45,13);palm(56,48,13.5);tree(8,46,14,4.2);rect([0,38,100,42],paving,.045);for(const y of[29.5,42])for(let x=9;x<90;x+=3.8){rect([x-2,y-1.3,x+2,y+1.3],paving,.045);plant(x,y,1.1,true);shrub(x,y,.85,true);}}
   if(s.key==='p1-scene_02'){vehicle(auto,[70.0,28.76,.07],Math.PI,'REFERENCE_AUTO');const car=vehicle(fleet.car,[70.29,40.06,.07],Math.PI,'REFERENCE_CAR');car.traverse(o=>{if(o.isMesh&&o.material.userData.surface==='paint'){o.material=o.material.clone();o.material.color.set('#d8dcdb');}});for(const p of[[87,43,-1.2],[88,60,-1.2],[94,80,-1.2]])boat(p);for(let y=18;y<90;y+=8){box(1.35,1.35,.65,concrete,[78.2,y,.325]);plant(78.2,y,1.6);shrub(78.2,y,1.1,true);}}
   for(const b of s.bays){rect(b.rect,paving,.022);bays.push({...b,scene:s.key,global:b.rect.map((v,i)=>v+origin[i%2])});}
   if(s.seawall){for(const [a,b]of s.seawall.segments||[]){for(const z of[.42,.86])beam([a[0],a[1],z],[b[0],b[1],z],.045,concrete);collide([Math.min(a[0],b[0])-.15,Math.min(a[1],b[1])-.15,Math.max(a[0],b[0])+.15,Math.max(a[1],b[1])+.15],'seawall');for(let y=Math.min(a[1],b[1]);y<=Math.max(a[1],b[1]);y+=3){box(.3,.3,1.15,concrete,[a[0],y,.575]);box(.4,.4,.12,concrete,[a[0],y,1.17]);}}for(let y=0;y<d;y+=1.4){mesh(geometry('rock',()=>new THREE.IcosahedronGeometry(.65,0)),mat('#a8b1ac','stone'),[81.05,y,-.5]).scale.set(1,1.3,1.1);}}
   for(const l of s.landmarks||[]){if(l.id==='L_PIER')pier(l);if(l.id.startsWith('L_NET'))net(l);if(l.deck_rect){const r=l.deck_rect;box(r[2]-r[0],r[3]-r[1],l.deck_thickness_m,concrete,[(r[0]+r[2])/2,(r[1]+r[3])/2,-l.deck_thickness_m/2]);for(const x of[r[0]+.25,r[2]-.25]){for(let y=r[1];y<=r[3];y+=2){box(.32,.32,1.05,concrete,[x,y,.525]);box(.42,.42,.1,concrete,[x,y,1.1]);}for(const z of[.45,.9])beam([x,r[1],z],[x,r[3],z],.045,rail);collide([x-.2,r[1],x+.2,r[3]],'bridge-rail');}}}
   if(s.terrain.canal_rect){const r=s.terrain.canal_rect;for(const y of[r[1],r[3]])for(const x of[0,s.landmarks.find(l=>l.id==='L_BRIDGE').deck_rect[2]]){const a=[x,y],b=[x===0?s.landmarks.find(l=>l.id==='L_BRIDGE').deck_rect[0]:w,y];box(b[0]-a[0],.5,1.4,mat('#b9b6a3','stone'),[(a[0]+b[0])/2,y,-.7]);railing(a,b,.9,concrete);collide([a[0],y-.15,b[0],y+.15],'canal-rail');}}
   if(s.key==='p1-scene_01'){for(const y of[22,26]){box(.5,.55,1.6,concrete,[65,y,.8]);box(.6,.65,.16,concrete,[65,y,1.66]);}for(let y=22.3;y<26;y+=.17)beam([65,y,.1],[65,y,1.4],.015,mat('#3b4540'));for(const h of[.3,1.25])beam([65,22,h],[65,26,h],.025,mat('#3b4540'));wall([65,0],[65,22],1.12);wall([65,26],[65,28],1.12);plant(64.3,26,2.4,true);plant(63.6,23,2.4,true);for(const y of[22,24])shrub(64,y,1.35,true);tree(46,40,11,3.6);palm(48,42,13);tree(46,61,13,4.5);for(const [x,y,h]of[[45,51,14],[47,68,15],[56,73,13],[60,80,14],[47,91,12]]){tree(x,y,h,3.7);palm(x-1,y+3,h+2);}boat([100,50,-1.2]);boat([98,80,-1.2]);boat([135,130,-1.2]);vehicle(auto,[73.6,29,.07],0,'REFERENCE_AUTO').scale.setScalar(1.1);const silver=vehicle(fleet.car,[72.15,37.5,.07],0,'REFERENCE_CAR');silver.traverse(o=>{if(o.isMesh&&o.material.userData.surface==='paint'){o.material=o.material.clone();o.material.color.set('#d8dcdb');}});}
   if(phase===1&&s.terrain.water_region_xy){rect([64,0,69.3,d],paving,.045);rect([75.5,0,81.32,d],mat('#efbfaf','paving'),.045);for(let y=6;y<d;y+=16){if(s.key!=='p1-scene_01')palm(79.2,y,8.2+(y%3));const black=mat('#263b35'),lx=s.key==='p1-scene_01'?76.32:78.7,ly=y+(s.key==='p1-scene_01'?5.56:7),lh=s.key==='p1-scene_01'?5:4.05;beam([lx,ly,0],[lx,ly,lh],.075,black);for(const z of[.08,.2,.35])mesh(geometry('lampBase'+z,()=>new THREE.CylinderGeometry(.17-z*.15,.19-z*.15,.15,12)),black,[lx,ly,z]);const curve=new THREE.CatmullRomCurve3([[lx,ly,lh-.15],[lx,ly,lh+.25],[lx-.5,ly,lh+.4],[lx-1,ly,lh+.05]].map(vec));const neck=new THREE.Mesh(new THREE.TubeGeometry(curve,12,.045,6,false),black);neck.castShadow=true;root.add(neck);mesh(geometry('lampShade',()=>new THREE.ConeGeometry(.3,.18,16)),black,[lx-1,ly,lh+.01]);mesh(geometry('lampBulb',()=>new THREE.SphereGeometry(.085,10,6)),mat('#ffe9b2'),[lx-1,ly,lh-.1]);shrub(80,y+3,.65,true);}
    for(let y=3;y<d;y+=9)for(const x of[8,17,46]){if(s.buildings.every(b=>!inside(x,y,b.rect,3))&&s.roads.every(r=>roadDistance(r,x,y)>r.width_m/2+3)){tree(x,y,7+(y%4),3);if(x===46)palm(x-2,y+3,10);}}
   }
   for(const v of s.vegetation){if(/palm/.test(v.type||v.species)){palm(v.position[0],v.position[1],v.height_m||10);if(s.terrain.water_region_xy){const [x,y]=v.position;box(1.25,1.25,.55,concrete,[x,y,.275]);box(1.1,1.1,.025,mat('#514633'),[x,y,.56]);put(foliage.shrub(.95,true,Math.floor(x+y)),[x,y,.5]);}}else tree(v.position[0],v.position[1],v.height_m||9,v.canopy_radius_m||4);}
   const poles=(s.props||[]).filter(p=>/pole/.test(p.type));for(const p of s.infrastructure.utility_poles||[])poles.push({position:p,height_m:8});
   if(!(phase===1&&s.terrain.water_region_xy))for(const p of poles)pole(p.position,p.height_m||8);
   for(let i=1;i<(phase===1&&s.terrain.water_region_xy?0:poles.length);i++)for(const side of[-.6,.6]){const a=poles[i-1].position,b=poles[i].position;const curve=new THREE.CatmullRomCurve3([vec([a[0]+side,a[1],7.5]),vec([(a[0]+b[0])/2+side,(a[1]+b[1])/2,6.5]),vec([b[0]+side,b[1],7.5])]);const o=new THREE.Mesh(new THREE.TubeGeometry(curve,16,.015,3,false),rail);root.add(o);}
   for(const p of s.props||[]){const t=p.type.toLowerCase(),pos=p.position;if(!pos||/rider|player|pole/.test(t))continue;
    if(/auto/.test(t))vehicle(auto,pos,heading(p),p.id);
    else if(/scooter/.test(t))vehicle(scooter,pos,heading(p),p.id);
    else if(/car/.test(t)){const car=vehicle(fleet.car,pos,heading(p),p.id);if(/white|silver/.test(t))car.traverse(mesh=>{if(mesh.isMesh&&mesh.material.userData.surface==='paint'){mesh.material=mesh.material.clone();mesh.material.color.set('#d8dcdb');}});}
    else if(/bus/.test(t)){const o=vehicle(fleet.bus,pos,heading(p),p.id);o.traverse(mesh=>{if(mesh.isMesh&&mesh.material.userData.surface==='paint'){mesh.material=mesh.material.clone();mesh.material.color.set('#b9ce7c');}});const size=new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());const dims=p.dimensions_m||[2.5,9.5,3.2];o.scale.set(dims[0]/size.x,dims[2]/size.y,dims[1]/size.z);}
    else if(/truck/.test(t)){const truck=vehicle(fleet.van,pos,heading(p),p.id);truck.traverse(mesh=>{if(mesh.isMesh&&mesh.material.userData.surface==='paint'){mesh.material=mesh.material.clone();mesh.material.color.set('#dbd7c9');}});box(2.2,3.8,1.8,mat('#efeadb','metal'),[pos[0]+1,pos[1],1.85],Math.PI/2);collide([pos[0]-3,pos[1]-1.1,pos[0]+3,pos[1]+1.1],p.id);}
    else if(/boat|hull|skiff/.test(t))boat(pos,heading(p));
    else if(/bench/.test(t))bench(pos,heading(p));
    else if(/bin/.test(t)){mesh(geometry('bin',()=>new THREE.CylinderGeometry(.3,.28,.8,10)),mat('#418797'),[pos[0],pos[1],.4]);box(.65,.65,.1,rail,[pos[0],pos[1],.86]);}
    else if(/crates/.test(t)){for(let i=0;i<3;i++){box(.65,.5,.5,/blue/.test(t)?mat('#518cba'):wood,[pos[0]+(i%2)*.7,pos[1],.25+Math.floor(i/2)*.5]);for(let j=0;j<3;j++)box(.66,.51,.03,darkWood,[pos[0]+(i%2)*.7,pos[1],.13+Math.floor(i/2)*.5+j*.13]);}}
    else if(/rope/.test(t))for(let i=0;i<5;i++)mesh(geometry('rope',()=>new THREE.TorusGeometry(.35,.025,4,16)),wood,[pos[0],pos[1],.03+i*.045],[Math.PI/2,0,0]);
    else if(/stall|rack/.test(t)){for(const x of[-1,1])beam([pos[0]+x,pos[1],0],[pos[0]+x,pos[1],2.5],.055,wood);box(2.5,1.7,.1,mat('#82a48b'),[pos[0],pos[1],2.5]);box(2.2,.8,.7,wood,[pos[0],pos[1],.45]);}
   }
   if(s.bus_stop){const b=s.bus_stop,r=b.shelter_rect;rect(b.bay_rect,asphalt,.065);poly(b.asphalt_apron_polygon.map(p=>[p[0],p[1],.063]),asphalt);rect(b.sidewalk_rect,paving,.1);for(const x of[r[0],r[2]])for(const y of[r[1],r[3]])beam([x,y,0],[x,y,b.shelter_height_m],.055,rail);rect(r,mat('#719cb6','metal'),b.shelter_height_m);bench(b.bench_position);sign('BUS STOP',[(r[0]+r[2])/2,r[1]-.05,2.4],3,Math.PI,'#315a73');}
  }

  if(phase===1){origin=[0,0,0];
   function cottage(x,y,h,z=0){
    const color=['#f5e4c4','#8ac6b3','#e4bf75'][Math.abs(Math.floor(x+y))%3];box(6,5,h,mat(color,'plaster'),[x,y,z+h/2]);
    roof({rect:[x-3,y-2.5,x+3,y+2.5],height:z+h,top:z+h+1.8,roof:{shape:'hip',material:'clay',detail:'distant'}});
    for(const level of[h-1.3,h-4])if(level>1)for(const dx of[-1.5,1.5]){box(1.2,.13,1.4,concrete,[x+dx,y-2.56,z+level]);box(.98,.15,1.2,mat('#4e594e'),[x+dx,y-2.64,z+level]);for(const side of[-1,1])box(.24,.12,1.35,mat('#4e7859'),[x+dx+side*.7,y-2.65,z+level]);}
   }
   // The planted cape begins beyond both waterfront blocks' playable northern edge.
   const coast=y=>88+((y-350)/180)**2*6;
   const elevation=(u,y)=>1.2+Math.sin(Math.PI*u)*(4+10*Math.exp(-(((y-420)/100)**2)))*(.9+.1*Math.sin(y*.05+u*8));
   const land=mat('#82944f','grass');
   for(let y=350;y<580;y+=6){poly([[coast(y),y,-1.2],[coast(y+6),y+6,-1.2],[coast(y+6),y+6,1.2],[coast(y),y,1.2]],mat('#929084','stone'));mesh(geometry('capeRock',()=>new THREE.IcosahedronGeometry(1,1)),mat('#929084','stone'),[coast(y),y,.1]).scale.set(2.5,1.6,4);}
   for(let y=350;y<580;y+=6)for(let i=0;i<22;i++){const u=i/22,v=(i+1)/22;poly([[coast(y)+u*110,y,elevation(u,y)],[coast(y)+v*110,y,elevation(v,y)],[coast(y+6)+v*110,y+6,elevation(v,y+6)],[coast(y+6)+u*110,y+6,elevation(u,y+6)]],land);}
   for(let y=358;y<570;y+=12)for(let i=0;i<9;i++){const u=.025+i*.105,x=coast(y)+u*110+Math.sin(y+i)*2,z=elevation(u,y);put(foliage.tree(9+(i%4),4.8,Math.floor(y+i)),[x,y,z]);if(i%3===0)put(foliage.palm(9+i,Math.floor(y)),[x+4,y+5,elevation(u,y+5)]);}
   for(let y=375;y<560;y+=28)for(const u of[.2,.48,.73]){const x=coast(y)+u*110;cottage(x,y,4.5+(Math.floor(y)%3),elevation(u,y));}
   // Neighboring tropical shore is scenery outside the playable block.
   let waveSeed=701;const random=()=>{waveSeed=(waveSeed*16807)%2147483647;return waveSeed/2147483647};const foam=mat('#bcf2e7');for(let i=0;i<2200;i++){const x=83+random()*160,y=random()*360,len=.08+random()*.25;poly([[x,y,-1.175],[x+len,y,-1.175],[x+len,y+.012,-1.175],[x,y+.009,-1.175]],foam);}for(let i=0;i<70;i++){const x=83+random()*14,y=5+random()*100;mesh(geometry('seaLeaf',()=>new THREE.SphereGeometry(.25,9,4)),mat('#b4c263'),[x,y,-1.16]).scale.set(1,.025,.6);}
   for(let y=195;y<450;y+=12){const x=72;rect([x-4,y,x+4,y+12],asphalt,.055);for(const xx of[x-8,x+9]){palm(xx,y,8+(y%4));shrub(xx,y+3,1.2,true);}for(const xx of[x-18,x-30]){tree(xx,y,9,3.8);}}
   for(let y=175;y<310;y+=8){const x=83+Math.pow((y-175)/90,2)*6;mesh(geometry('shoreRock',()=>new THREE.IcosahedronGeometry(1,1)),mat('#929084','stone'),[x,y,-.2]).scale.set(3.8,1.6,6);}
   for(const [x,y,h]of[[16,56,9],[27,55,12],[35,56,14],[52,75,12],[35,94,13],[43,94,11],[51,91,10],[35,177,9]]){
    const s=layouts.find(s=>inside(x-s.origin[0],y-s.origin[1],[0,0,s.scene.playable_size_m.east_west,s.scene.playable_size_m.north_south]));if(!s)continue;
    const lx=x-s.origin[0],ly=y-s.origin[1];if(s.buildings.some(b=>inside(lx,ly,b.rect,4))||s.roads.some(r=>roadDistance(r,lx,ly)<r.width_m/2+4))continue;
    cottage(x,y,h);current=s;collide([x-3,y-2.5,x+3,y+2.5],'background-house');palm(x-4,y+5,h+4);tree(x-7,y-3,h+2,3.6);
   }
  }

  // Distant neighborhood continuation is outside the playable bounds.
  origin=[0,0,0];if(phase===1){for(let y=280;y<430;y+=18){rect([-53,y,-47,y+18],asphalt,.055);for(const x of[-58,-42]){palm(x,y,10+y%5);shrub(x,y+4,1.1,true);}for(const x of[-66,-34]){const h=4+y%3;box(7,7,h,mat('#f0d4ae','plaster'),[x,y+5,h/2]);roof({rect:[x-3.5,y+1.5,x+3.5,y+8.5],height:h,top:h+1.8,roof:{shape:'hip',material:'clay'}});tree(x+5,y+9,10,4);}}}
  if(phase===2){for(let y=300;y<570;y+=18){rect([56,y,64,y+18],asphalt,.055);for(const x of[49,71]){palm(x,y,11+(y%4));shrub(x,y+4,1.2,true);}for(const x of[38,82]){const h=6+(y%3);box(10,12,h,mat(y%36?'#ead7b3':'#91bcb1','plaster'),[x,y+6,h/2]);roof({rect:[x-5,y,x+5,y+12],height:h,top:h+1.8,roof:{shape:'hip',material:'clay'}});for(const dx of[-2,2])for(const z of[2,5])box(1.2,.12,1.5,glass,[x+dx,y-.07,z]);tree(x+(x<60?-5:5),y+8,12,4.3);}}}
  // Merge static geometry by material. Vehicles remain separate reusable project assets.
  root.updateMatrixWorld(true);const batches=new Map();
  for(const o of [...root.children])if(o.isMesh&&!o.isInstancedMesh&&!o.material.transparent){const g=o.geometry.clone().applyMatrix4(o.matrixWorld);if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));g.computeBoundingBox();const center=g.boundingBox.getCenter(new THREE.Vector3());const key=o.material.uuid+o.castShadow+':'+Math.floor(center.x/30)+':'+Math.floor(center.z/30);const batch=batches.get(key)||{material:o.material,castShadow:o.castShadow,geometries:[]};batch.geometries.push(g);batches.set(key,batch);root.remove(o);}
  for(const {material:m,geometries:gs,castShadow}of batches.values()){const merged=mergeGeometries(gs);if(!merged)throw Error('Static geometry batching failed');const o=new THREE.Mesh(merged,m);o.castShadow=castShadow;o.receiveShadow=true;root.add(o);gs.forEach(g=>g.dispose());}
  if(phase===1)projectWaterfront(root,objects);
  return {root,obstacles,actors,objects,bays};
 }
}
