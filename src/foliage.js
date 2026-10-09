import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Curved, alpha-cut foliage: silhouettes and veins belong to the model, not a solid canopy proxy.
export function createFoliage(renderer){
 const leafMap=(kind)=>{
  const c=document.createElement('canvas');c.width=kind==='frond'?256:512;c.height=kind==='frond'?1024:512;const ctx=c.getContext('2d');
  function blade(x,y,length,width,angle,color){ctx.save();ctx.translate(x,y);ctx.rotate(angle);const g=ctx.createLinearGradient(-width,0,width,0);g.addColorStop(0,'#24460f');g.addColorStop(.48,color);g.addColorStop(.55,'#91b438');g.addColorStop(1,'#385715');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(-width,-length*.2,-width*.72,-length*.65,0,-length);ctx.bezierCurveTo(width*.7,-length*.6,width,-length*.2,0,0);ctx.fill();ctx.strokeStyle='#a9b65099';ctx.lineWidth=kind==='frond'?1.5:2;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-length);ctx.stroke();for(let i=1;i<12;i++){const y=-length*i/12,w=Math.sin(i/12*Math.PI)*width*.78;ctx.strokeStyle='#224a173a';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-w,y+length*.07);ctx.lineTo(0,y);ctx.lineTo(w,y+length*.07);ctx.stroke()}ctx.restore()}
  if(kind==='frond'){
   ctx.strokeStyle='#76943b';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(128,1020);ctx.quadraticCurveTo(126,540,128,8);ctx.stroke();
   for(let i=1;i<37;i++){const t=i/38,y=1010-t*980,span=30+Math.sin(t*Math.PI)*101;for(const side of[-1,1])blade(128,y,span,18,side*(Math.PI*.36+t*.23),'#679b23')}
  }else if(kind==='banana')blade(256,504,497,205,.0,'#71a128');
  else{
   ctx.strokeStyle='#627132';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(256,505);ctx.lineTo(256,16);ctx.stroke();
   for(let i=0;i<8;i++)for(const side of[-1,1])blade(256,455-i*56,130+(i%3)*16,54,side*.85,'#588127');blade(256,115,107,31,0,'#79a02b');
  }
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;
 };
 const maps={frond:leafMap('frond'),banana:leafMap('banana'),branch:leafMap('branch')};
 const material=(map,color)=>new THREE.MeshStandardMaterial({map,color,alphaTest:.45,side:THREE.DoubleSide,roughness:.64});
 const frond=material(maps.frond,'#d7e5ad'),banana=material(maps.banana,'#c5e794'),leaves=[material(maps.branch,'#cee693'),material(maps.branch,'#9fc481'),material(maps.branch,'#e0d985')];
 const loader=new THREE.TextureLoader(),ready=Promise.all([loader.loadAsync(new URL('textures/frond.png',document.baseURI).href).then(t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());t.repeat.set(.5,1);t.offset.set(.25,0);banana.map=t;banana.color.set('#b7d7c8');banana.needsUpdate=true}),loader.loadAsync(new URL('textures/branch.png',document.baseURI).href).then(t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;for(const [i,m]of leaves.entries()){m.map=t;m.color.set(['#b1c7b8','#a3bdb0','#bed0ad'][i]);m.emissive.set('#25420b');m.emissiveIntensity=.04;m.needsUpdate=true}})]);
 const trunkCanvas=document.createElement('canvas');trunkCanvas.width=128;trunkCanvas.height=512;const ctx=trunkCanvas.getContext('2d');ctx.fillStyle='#b69868';ctx.fillRect(0,0,128,512);for(let y=0;y<512;y+=19){ctx.strokeStyle='#6e59388a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(128,y+4);ctx.stroke();ctx.strokeStyle='#d1b37d';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,y+5);ctx.lineTo(128,y+9);ctx.stroke()}const barkMap=new THREE.CanvasTexture(trunkCanvas);barkMap.colorSpace=THREE.SRGBColorSpace;barkMap.wrapS=barkMap.wrapT=THREE.RepeatWrapping;
 const bark=new THREE.MeshStandardMaterial({color:'#e8d7bd',map:barkMap,roughness:.95});
 const flowerMaterials=['#e96787','#f6c838','#fbf1d2'].map(color=>new THREE.MeshStandardMaterial({color,roughness:.8}));
 const branchGeometry=new THREE.PlaneGeometry(1,1,1,1),petalGeometry=new THREE.SphereGeometry(.035,6,4),coconutGeometry=new THREE.SphereGeometry(.17,9,6);
 function add(root,g,m){const mesh=new THREE.Mesh(g,m);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh}
 function tube(root,points,r){const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.max(5,points.length*4),r,12,false),uv=g.attributes.uv;for(let i=0;i<uv.count;i++){const u=uv.getX(i);uv.setXY(i,uv.getY(i),u)}return add(root,g,bark)}
 function surface(length,width,at,material,segments=16){
  const pos=[],uv=[],idx=[];for(let i=0;i<=segments;i++){const t=i/segments,c=at(t),w=width;for(const side of[-1,1]){pos.push(c.x+side*w/2,c.y-Math.abs(w)*.12,c.z);uv.push((side+1)/2,t)}if(i<segments){const j=i*2;idx.push(j,j+2,j+1,j+1,j+2,j+3)}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return new THREE.Mesh(g,material);
 }
 function finish(root){
  root.updateMatrixWorld(true);const groups=new Map();root.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone().applyMatrix4(o.matrixWorld);if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));const gs=groups.get(o.material)||[];gs.push(g);groups.set(o.material,gs)});root.clear();for(const [m,gs]of groups){add(root,mergeGeometries(gs),m);gs.forEach(g=>g.dispose())}return root;
 }
 function palm(height=10,seed=0){
  const root=new THREE.Group(),lean=.6+Math.sin(seed*2.1)*.7,top=new THREE.Vector3(lean,height,.35);
  tube(root,[new THREE.Vector3(),new THREE.Vector3(lean*.15,height*.35,.08),new THREE.Vector3(lean*.5,height*.7,.17),top],.29);
  for(let i=0;i<14;i++){
   const angle=i*Math.PI*2/14+seed*.31,length=3.9+(i%4)*.37,tilt=i<5?.7:i<10?.1:-.55;
   const leaf=surface(length,2.4,t=>new THREE.Vector3(0,Math.sin(t*Math.PI)*(.8+tilt)-t*t*(1.4-tilt),-length*t),frond);
   leaf.position.copy(top);leaf.rotation.y=angle;leaf.castShadow=leaf.receiveShadow=true;root.add(leaf);
  }
  for(let i=0;i<5;i++)add(root,coconutGeometry,bark).position.set(top.x+Math.cos(i*2.4)*.25,height-.15,top.z+Math.sin(i*2.4)*.25);
  return finish(root);
 }
 function plant(size=1,seed=0){
  const root=new THREE.Group();for(let i=0;i<8;i++){
   const a=i*2.4+seed*.3,reach=size*(.65+i%3*.12),h=size*(.65+i%2*.15);
   tube(root,[new THREE.Vector3(),new THREE.Vector3(Math.sin(a)*.14,h*.7,Math.cos(a)*.14)],.025*size);
   const blade=surface(reach,size*.65,t=>new THREE.Vector3(0,size*.25+Math.sin(t*Math.PI*.75)*size*(i<3?.8:.65)-t*t*size*.12,-reach*t*(i<3?.4:.85)),banana,12);blade.rotation.y=a;blade.castShadow=blade.receiveShadow=true;root.add(blade);
  }return finish(root);
 }
 function shrub(size=.65,flower=false,seed=0){
  const root=new THREE.Group();for(let i=0;i<14;i++){const a=i*2.399963,rr=Math.sqrt((i+.5)/14)*size*.75;const mesh=add(root,branchGeometry,leaves[i%3]);mesh.position.set(Math.cos(a)*rr,size*.3+(.5+.5*Math.sin(i*7+seed))*size*.65,Math.sin(a)*rr);mesh.rotation.set(Math.sin(i*3)*1.15,a,Math.sin(i)*1.4);mesh.scale.set(size*.85,size*.9,size)}
  if(flower)for(let i=0;i<20;i++){const a=i*2.4;for(let k=0;k<5;k++){const p=k*Math.PI*2/5;const f=add(root,petalGeometry,flowerMaterials[i%3]);f.position.set(Math.cos(a)*size*.65+Math.cos(p)*.035,size*(.75+.2*Math.sin(i))+Math.sin(p)*.035,Math.sin(a)*size*.65);f.scale.z=.45}}
  return finish(root);
 }
 function tree(height=9,radius=4,seed=0){
  const root=new THREE.Group();tube(root,[new THREE.Vector3(),new THREE.Vector3(.1,height*.55,.2),new THREE.Vector3(.25,height*.8,.1)],.23);
  for(let k=0;k<7;k++){const a=k*2.4;const end=new THREE.Vector3(Math.cos(a)*radius*.65,height*.75+Math.sin(k)*radius*.25,Math.sin(a)*radius*.65);tube(root,[new THREE.Vector3(0,height*.45,0),end],.065)}
  for(let i=0;i<160;i++){
   const a=i*2.399963,t=(i+.5)/160,z=1-2*t,rr=Math.sqrt(1-z*z),shell=.5+.5*((i*31)%97)/97;
   const mesh=add(root,branchGeometry,leaves[i%3]);mesh.position.set(Math.cos(a)*rr*radius*shell,height*.75+z*radius*.52,Math.sin(a)*rr*radius*shell);mesh.rotation.set(Math.sin(i*2)*1.4,a+seed,Math.sin(i)*1.3);mesh.scale.set(radius*.7,radius*.7,1);
  }return finish(root);
 }
 const cache=new Map();const cached=(key,make)=>{if(!cache.has(key))cache.set(key,make());return cache.get(key).clone(true)};
 return {ready,palm:(h,seed=0)=>cached(`palm:${h}:${seed%3}`,()=>palm(h,seed%3)),plant:(s,seed=0)=>cached(`plant:${s}:${seed%3}`,()=>plant(s,seed%3)),shrub:(s,f=false,seed=0)=>cached(`shrub:${s}:${f}:${seed%3}`,()=>shrub(s,f,seed%3)),tree:(h,r,seed=0)=>cached(`tree:${h}:${r}:${seed%3}`,()=>tree(h,r,seed%3))};
}
