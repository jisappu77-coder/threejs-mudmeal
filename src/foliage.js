import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Modeled palm leaflets and shrubs, with curved alpha-cut banana leaves and tree branches.
export function createFoliage(renderer){
 const leafMap=(kind)=>{
  const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');
  function blade(x,y,length,width,angle,color){ctx.save();ctx.translate(x,y);ctx.rotate(angle);const g=ctx.createLinearGradient(-width,0,width,0);g.addColorStop(0,'#24460f');g.addColorStop(.48,color);g.addColorStop(.55,'#91b438');g.addColorStop(1,'#385715');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(-width,-length*.2,-width*.72,-length*.65,0,-length);ctx.bezierCurveTo(width*.7,-length*.6,width,-length*.2,0,0);ctx.fill();ctx.strokeStyle='#a9b65099';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-length);ctx.stroke();for(let i=1;i<12;i++){const y=-length*i/12,w=Math.sin(i/12*Math.PI)*width*.78;ctx.strokeStyle='#224a173a';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-w,y+length*.07);ctx.lineTo(0,y);ctx.lineTo(w,y+length*.07);ctx.stroke()}ctx.restore()}
  if(kind==='banana')blade(256,504,497,205,.0,'#71a128');
  else{
   ctx.strokeStyle='#627132';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(256,505);ctx.lineTo(256,16);ctx.stroke();
   for(let i=0;i<8;i++)for(const side of[-1,1])blade(256,455-i*56,130+(i%3)*16,54,side*.85,'#588127');blade(256,115,107,31,0,'#79a02b');
  }
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;
 };
 const maps={banana:leafMap('banana'),branch:leafMap('branch')};
 const material=(map,color)=>new THREE.MeshStandardMaterial({map,color,alphaTest:.45,side:THREE.DoubleSide,roughness:.86});
 const banana=material(maps.banana,'#c5e794'),leaves=[material(maps.branch,'#cee693'),material(maps.branch,'#9fc481'),material(maps.branch,'#e0d985')];
 const loader=new THREE.TextureLoader(),ready=Promise.all([loader.loadAsync(new URL('textures/frond.png',document.baseURI).href).then(t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());t.repeat.set(.5,1);t.offset.set(.25,0);banana.map=t;banana.color.set('#b7d7c8');banana.needsUpdate=true}),loader.loadAsync(new URL('textures/branch.png',document.baseURI).href).then(t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;for(const [i,m]of leaves.entries()){m.map=t;m.color.set(['#b1c7b8','#a3bdb0','#bed0ad'][i]);m.emissive.set('#25420b');m.emissiveIntensity=.04;m.needsUpdate=true}})]);
 const trunkCanvas=document.createElement('canvas');trunkCanvas.width=128;trunkCanvas.height=1024;const ctx=trunkCanvas.getContext('2d');ctx.fillStyle='#aa8867';ctx.fillRect(0,0,128,1024);
 for(let y=0,i=0;y<1024;y+=18+(i++%5)*3){ctx.strokeStyle='#61472f60';ctx.lineWidth=1.5;ctx.beginPath();for(let x=0;x<=128;x+=8)ctx.lineTo(x,y+Math.sin(x*.06+i)*2.5);ctx.stroke();ctx.strokeStyle='#e0c5a035';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,y+4);ctx.lineTo(128,y+6);ctx.stroke();}
 for(let i=0;i<2800;i++){ctx.fillStyle=i%3?'#503e2d0b':'#e9d4b719';ctx.fillRect((i*73)%128,(i*113)%1024,1,2+i%5);}
 const barkMap=new THREE.CanvasTexture(trunkCanvas);barkMap.colorSpace=THREE.SRGBColorSpace;barkMap.wrapS=barkMap.wrapT=THREE.RepeatWrapping;
 const bark=new THREE.MeshStandardMaterial({color:'#dab381',map:barkMap,bumpMap:barkMap,bumpScale:.025,roughness:.95});
 const flowerMaterials=['#e96787','#f6c838','#fbf1d2'].map(color=>new THREE.MeshStandardMaterial({color,roughness:.8}));
 const branchGeometry=new THREE.PlaneGeometry(1,1,1,1),petalGeometry=new THREE.SphereGeometry(.035,6,4),coconutGeometry=new THREE.SphereGeometry(.17,9,6);
 function add(root,g,m){const mesh=new THREE.Mesh(g,m);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh}
 function tube(root,points,r){const curve=new THREE.CatmullRomCurve3(points),g=new THREE.TubeGeometry(curve,Math.max(5,points.length*4),r,12,false),uv=g.attributes.uv,p=g.attributes.position;for(let i=0;i<uv.count;i++){const u=uv.getX(i),center=curve.getPointAt(u),scale=1-u*.32;p.setXYZ(i,center.x+(p.getX(i)-center.x)*scale,center.y+(p.getY(i)-center.y)*scale,center.z+(p.getZ(i)-center.z)*scale);uv.setXY(i,uv.getY(i),u)}g.computeVertexNormals();return add(root,g,bark)}
 function surface(length,width,at,material,segments=16){
  const pos=[],uv=[],idx=[];for(let i=0;i<=segments;i++){const t=i/segments,c=at(t),w=width;for(const side of[-1,1]){pos.push(c.x+side*w/2,c.y-Math.abs(w)*.12,c.z);uv.push((side+1)/2,t)}if(i<segments){const j=i*2;idx.push(j,j+2,j+1,j+1,j+2,j+3)}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return new THREE.Mesh(g,material);
 }
 function finish(root){
  root.updateMatrixWorld(true);const groups=new Map();root.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone().applyMatrix4(o.matrixWorld);if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));const gs=groups.get(o.material)||[];gs.push(g);groups.set(o.material,gs)});root.clear();for(const [m,gs]of groups){add(root,mergeGeometries(gs),m);gs.forEach(g=>g.dispose())}return root;
 }
 function palmBlade(length,width,tilt,tint){
  const positions=[],indices=[],uv=[];
  const point=(t,x)=>[x,Math.sin(t*Math.PI)*(1.1+tilt)-t*t*(2.2-tilt)-Math.abs(x)*.5,-length*t];
  function strip(at,halfWidth){const first=positions.length/3;for(let row=0;row<=6;row++){const t=row/6,p=at(t),w=halfWidth(t);for(const side of[-1,1]){positions.push(p[0],p[1]-Math.abs(w)*.14,p[2]+side*w);uv.push((side+1)/2,t);}if(row<6){const j=first+row*2;indices.push(j,j+2,j+1,j+1,j+2,j+3);}}}
  strip(t=>point(t,0),()=>.018);
  for(let row=0;row<24;row++)for(const side of[-1,1]){
   const t=.10+row*.035,span=width*.5*Math.pow(Math.sin(Math.PI*t),.65);
   strip(u=>point(t+u*.06,side*span*u),u=>.14*Math.pow(Math.sin(Math.PI*u),.65)+.001);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));const color=new THREE.Color(tint),colors=[];for(let i=0;i<positions.length;i+=3)colors.push(color.r,color.g,color.b);g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
 }
 const palmCanvas=document.createElement('canvas');palmCanvas.width=128;palmCanvas.height=512;const palmContext=palmCanvas.getContext('2d'),gradient=palmContext.createLinearGradient(0,0,128,0);for(const [stop,color]of [[0,'#567c25'],[.35,'#7ea134'],[.48,'#a5ba48'],[.5,'#c4ce66'],[.52,'#8da72f'],[1,'#567620']])gradient.addColorStop(stop,color);palmContext.fillStyle=gradient;palmContext.fillRect(0,0,128,512);const palmMap=new THREE.CanvasTexture(palmCanvas);palmMap.colorSpace=THREE.SRGBColorSpace;
 const palmMaterial=new THREE.MeshStandardMaterial({map:palmMap,vertexColors:true,side:THREE.DoubleSide,roughness:.78});
 function palm(height=10,seed=0){
  const root=new THREE.Group(),lean=.6+Math.sin(seed*2.1)*.7,top=new THREE.Vector3(lean,height,.35);
  tube(root,[new THREE.Vector3(),new THREE.Vector3(lean*.15,height*.35,.08),new THREE.Vector3(lean*.5,height*.7,.17),top],.29);
  for(let i=0;i<10;i++){
   const angle=i*2.399963+seed*.71,length=3.5+(i%5)*.25,tilt=(i<3?1.1:0)+.55*Math.sin(i*2.1+seed);
   const leaf=new THREE.Mesh(palmBlade(length,2.1+(i%3)*.2,tilt,['#fff9df','#e9efcf','#dce8c9'][i%3]),palmMaterial);
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
 const shrubLeafGeometry=(()=>{const p=[],uv=[],idx=[];for(let row=0;row<=6;row++){const t=row/6,w=Math.sin(t*Math.PI)*.32;for(const side of[-1,0,1]){p.push(side*w,Math.sin(t*Math.PI)*.12-Math.abs(side)*w*.2,-t);uv.push((side+1)/2,t);}if(row<6)for(let col=0;col<2;col++){const j=row*3+col;idx.push(j,j+3,j+1,j+1,j+3,j+4);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;})();
 const shrubLeafMaterials=['#81a839','#668f2d','#9db646'].map(color=>new THREE.MeshStandardMaterial({color,side:THREE.DoubleSide,roughness:.78}));
 function shrub(size=.65,flower=false,seed=0){
  const root=new THREE.Group();for(let i=0;i<60;i++){const a=i*2.399963,rr=Math.sqrt((i+.5)/60)*size*.55;const leaf=add(root,shrubLeafGeometry,shrubLeafMaterials[i%3]);leaf.position.set(Math.cos(a)*rr,size*(.25+.6*((i*19+seed)%61)/61),Math.sin(a)*rr);leaf.rotation.set(-.2+Math.sin(i*3)*.7,a,Math.sin(i)*.35);leaf.scale.setScalar(size*(.35+(i%4)*.055));}for(let i=0;i<5;i++){const a=i*2.4;tube(root,[new THREE.Vector3(),new THREE.Vector3(Math.cos(a)*size*.3,size*.6,Math.sin(a)*size*.3)],.012*size);}
  if(flower)for(let i=0;i<20;i++){const a=i*2.4;for(let k=0;k<5;k++){const p=k*Math.PI*2/5;const f=add(root,petalGeometry,flowerMaterials[(i+seed)%7<4?0:(i+seed)%7<6?1:2]);f.position.set(Math.cos(a)*size*.65+Math.cos(p)*.035,size*(.75+.2*Math.sin(i))+Math.sin(p)*.035,Math.sin(a)*size*.65);f.scale.z=.45}}
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
