import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { setupGraphics } from './graphics.js';
import { createExtendedWorld } from './world.js';

// All scenery is actual geometry. The supplied reference is only shown in its comparison overlay.
const canvas = document.querySelector('#world');
// Holding a game control must not open Chrome's copy/select context menu.
document.querySelector('#game-stage').addEventListener('contextmenu',event=>event.preventDefault());
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
// CSS owns the canvas display size; resizing must never leave viewport-sized inline styles.
renderer.setSize(innerWidth,innerHeight,false);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.02;
const scene=new THREE.Scene();
scene.background=new THREE.Color('#b5cc8b');
scene.fog=new THREE.Fog('#b5cc8b',95,180);
const aspect=innerWidth/innerHeight;
const camera=new THREE.PerspectiveCamera(55,aspect,.1,160);
const defaultZoom=1.12;camera.zoom=defaultZoom;
const originalPosition=new THREE.Vector3(23,49,48), originalTarget=new THREE.Vector3(0,0,0);
camera.position.copy(originalPosition);camera.lookAt(originalTarget);
const controls=new OrbitControls(camera,canvas);controls.target.copy(originalTarget);controls.enabled=false;controls.update();
controls.enableDamping=true;controls.minDistance=4;controls.maxDistance=180;controls.maxPolarAngle=Math.PI*.46;
scene.add(new THREE.HemisphereLight('#fff6d7','#617357',1.25));
const sun=new THREE.DirectionalLight('#fff2db',3.0);sun.position.set(-30,55,28);sun.castShadow=true;
sun.shadow.mapSize.set(innerWidth<800?2048:4096,innerWidth<800?2048:4096);Object.assign(sun.shadow.camera,{left:-48,right:48,top:48,bottom:-48,near:1,far:130});
sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=true;sun.shadow.normalBias=.025;sun.shadow.bias=-.00012;sun.shadow.radius=3;scene.add(sun);
let seed=9137;function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}const rand=(a,b)=>a+(b-a)*random();
const materials=new Map();
function mat(color,roughness=.83,metalness=0){const key=color+roughness+metalness;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness,metalness}));return materials.get(key)}
const M={grass:mat('#72934a'),soil:mat('#c58d48'),road:mat('#797578'),line:mat('#e8dac3'),curb:mat('#d2c4a6'),wood:mat('#785135'),darkWood:mat('#473924'),black:mat('#202528'),rubber:mat('#171c1c'),glass:mat('#45656b',.24,.3),cream:mat('#ffe4a0'),red:mat('#b9422f'),tile:mat('#cb4d32'),stone:mat('#797e70'),skin:mat('#8d572f'),green:mat('#469c29'),leaf:mat('#64ad2a'),leafLight:mat('#8bbd35'),chrome:mat('#c5c6bd',.28,.75),yellow:mat('#f7be29'),white:mat('#edece0')};
const geom={box:new THREE.BoxGeometry(1,1,1),sphere:new THREE.SphereGeometry(1,20,14),cylinder:new THREE.CylinderGeometry(1,1,1,20),cone:new THREE.ConeGeometry(1,1,24),torus:new THREE.TorusGeometry(1,.2,12,28)};
// Shared geometries are instanced after authoring, keeping thousands of detailed objects practical.
const batches=new Map(), dummy=new THREE.Object3D();let authoringOffset=[0,0],authoringHeight=0;
function put(g,m,p,s=[1,1,1],rot=[0,0,0],parent=null){
 if(parent){const o=new THREE.Mesh(g,m);o.position.set(...p);o.scale.set(...s);o.rotation.set(...rot);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
 p=[p[0]+authoringOffset[0],p[1]+authoringHeight,p[2]+authoringOffset[1]];
 const k=g.uuid+m.uuid;if(!batches.has(k))batches.set(k,{g,m,items:[]});batches.get(k).items.push({p,s,rot});
}
function box(m,x,y,z,w,h,d,parent=null,rot=0){return put(geom.box,m,[x,y,z],[w,h,d],[0,rot,0],parent)}
function ell(m,x,y,z,a,b,c,parent=null){return put(geom.sphere,m,[x,y,z],[a,b,c],[0,0,0],parent)}
function cyl(m,x,y,z,r,h,parent=null,rot=[0,0,0]){return put(geom.cylinder,m,[x,y,z],[r,h,r],rot,parent)}
function bar(m,a,b,r=.04,parent=null){const aa=new THREE.Vector3(...a),bb=new THREE.Vector3(...b),mid=aa.clone().add(bb).multiplyScalar(.5);const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),bb.clone().sub(aa).normalize());const e=new THREE.Euler().setFromQuaternion(q);put(geom.cylinder,m,mid.toArray(),[r,aa.distanceTo(bb),r],[e.x,e.y,e.z],parent)}
function mesh(g,m){const o=new THREE.Mesh(g,m);o.castShadow=true;o.receiveShadow=true;o.position.set(authoringOffset[0],authoringHeight,authoringOffset[1]);scene.add(o);return o}
function flush(){for(const {g,m,items}of batches.values()){const o=new THREE.InstancedMesh(g,m,items.length);items.forEach((it,i)=>{dummy.position.set(...it.p);dummy.scale.set(...it.s);dummy.rotation.set(...it.rot);dummy.updateMatrix();o.setMatrixAt(i,dummy.matrix)});o.castShadow=true;o.receiveShadow=true;scene.add(o)}batches.clear()}
function texCanvas(w,h,paint){const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy?.()||8;return t}
function sign(text,w,h,bg,fg='#fff2cb',size=52){const lines=text.split('\n');const t=texCanvas(1024,512,(c,W,H)=>{c.scale(2,2);W/=2;H/=2;c.fillStyle=bg;c.fillRect(0,0,W,H);c.strokeStyle='#ffffff24';c.lineWidth=7;c.strokeRect(8,8,W-16,H-16);c.fillStyle=fg;c.textAlign='center';c.textBaseline='middle';c.font=`bold ${size}px Arial`;lines.forEach((l,i)=>c.fillText(l,W/2,H/2+(i-(lines.length-1)/2)*size*1.15))});return new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,roughness:.85}))}
function addSign(text,x,y,z,w,h,bg,fg,size,rot=0,parent=scene){const s=sign(text,w,h,bg,fg,size);s.position.set(x+(parent===scene?authoringOffset[0]:0),y+(parent===scene?authoringHeight:0),z+(parent===scene?authoringOffset[1]:0));s.rotation.y=rot;parent.add(s);return s}
function textureNoise(base){return texCanvas(512,512,(c,w,h)=>{c.fillStyle=base;c.fillRect(0,0,w,h);for(let i=0;i<14000;i++){c.fillStyle=random()>.5?'#ffffff09':'#0000000b';c.fillRect(random()*w,random()*h,2,2)}})}
// Subtle roughness, grain, and height variation replace uniformly flat surfaces.
function detailTexture(kind){return texCanvas(512,512,(c,w,h)=>{
 c.fillStyle=kind==='leaf'?'#d3e5b0':'#858585';c.fillRect(0,0,w,h);
 for(let i=0;i<7000;i++){const q=Math.sin(i*78.233+kind.length)*43758.5453;const f=q-Math.floor(q);c.fillStyle=i%2?'#ffffff12':'#00000014';c.fillRect(f*w,((i*73)%257)/257*h,kind==='wood'?1:2,kind==='wood'?8:2)}
 if(kind==='leaf'){c.strokeStyle='#839f55';c.lineWidth=3;c.beginPath();c.moveTo(w/2,0);c.lineTo(w/2,h);c.stroke();c.lineWidth=.8;for(let y=8;y<h;y+=9){c.beginPath();c.moveTo(w/2,y);c.lineTo(0,y+25);c.moveTo(w/2,y);c.lineTo(w,y+25);c.stroke()}}
 if(kind==='wood'){c.strokeStyle='#5f5f5f';c.lineWidth=1;for(let x=3;x<w;x+=9){c.beginPath();c.moveTo(x,0);c.bezierCurveTo(x+8,85,x-8,170,x+2,h);c.stroke()}}
 if(kind==='tile'){c.fillStyle='#55555545';c.fillRect(0,h-8,w,8)}
});}
const reflectionFaces=Array.from({length:6},(_,face)=>texCanvas(256,256,(c,w,h)=>{const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,face===3?'#8c9b6f':'#86b8cf');sky.addColorStop(.6,'#d4e5df');sky.addColorStop(1,'#e9e2c5');c.fillStyle=sky;c.fillRect(0,0,w,h)}).image);
scene.environment=new THREE.CubeTexture(reflectionFaces);scene.environment.colorSpace=THREE.SRGBColorSpace;scene.environment.needsUpdate=true;scene.environmentIntensity=.35;
const stoneBump=detailTexture('stone'),plasterBump=detailTexture('plaster'),woodBump=detailTexture('wood'),tileBump=detailTexture('tile');
for(const t of[stoneBump,plasterBump,woodBump,tileBump]){t.colorSpace=THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping}
for(const m of[M.stone,M.curb]){m.bumpMap=stoneBump;m.bumpScale=.05;m.needsUpdate=true}
for(const m of[M.wood,M.darkWood]){m.bumpMap=woodBump;m.bumpScale=.04;m.needsUpdate=true}
M.road.color.set('#ffffff');M.road.map=textureNoise('#676369');M.road.map.wrapS=M.road.map.wrapT=THREE.RepeatWrapping;M.road.map.repeat.set(5,25);M.road.bumpMap=plasterBump;M.road.bumpScale=.022;M.road.needsUpdate=true;
M.soil.color.set('#ffffff');M.soil.map=textureNoise('#caa572');M.soil.bumpMap=stoneBump;M.soil.bumpScale=.035;M.soil.needsUpdate=true;
M.grass.map=textureNoise('#83a947');M.grass.color.set('#ffffff');M.grass.map.wrapS=M.grass.map.wrapT=THREE.RepeatWrapping;M.grass.map.repeat.set(30,30);M.grass.bumpMap=plasterBump;M.grass.bumpScale=.02;box(M.grass,0,-.5,0,110,1,110);
const roadX=z=>-18+24/(1+Math.exp(-(z-8)/2.5))+.5*Math.sin(z*.105);
function roadFrame(z,offset=0){const dx=(roadX(z+.05)-roadX(z-.05))/.1,angle=Math.atan2(dx,1);return {x:roadX(z)+Math.cos(angle)*offset,z:z-Math.sin(angle)*offset,angle}};
const canalX=z=>10+Math.sin(z*.10)*1.2+Math.max(z,0)*.4;
function ribbon(points,width,y,material){const verts=[],uv=[],indices=[];points.forEach((p,i)=>{const prev=points[Math.max(i-1,0)],next=points[Math.min(i+1,points.length-1)];const dx=next[0]-prev[0],dz=next[1]-prev[1],len=Math.hypot(dx,dz);const nx=dz/len,nz=-dx/len;verts.push(p[0]-nx*width/2,y,p[1]-nz*width/2,p[0]+nx*width/2,y,p[1]+nz*width/2);uv.push(0,i/5,1,i/5);if(i<points.length-1){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3)}});const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return mesh(g,material)}
const roadPoints=Array.from({length:141},(_,i)=>{const z=-52+i*.7;return[roadX(z),z]});
const paving=mat('#c2baa5');paving.bumpMap=stoneBump;paving.bumpScale=.04;
paving.map=texCanvas(256,256,(c,w,h)=>{c.fillStyle='#e4dcc7';c.fillRect(0,0,w,h);c.strokeStyle='#a49c88';c.lineWidth=2;for(let y=0;y<=h;y+=32){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();for(let x=(y%64?16:0);x<=w;x+=32){c.beginPath();c.moveTo(x,y);c.lineTo(x,y+32);c.stroke()}}});paving.map.wrapS=paving.map.wrapT=THREE.RepeatWrapping;paving.map.repeat.set(4,1);
ribbon(roadPoints,13.6,.018,paving);ribbon(roadPoints,10.2,.03,M.curb);ribbon(roadPoints,9.6,.045,M.road);
const canalPoints=Array.from({length:131},(_,i)=>{const z=-48+i*.75;return[canalX(z),z]});
ribbon(canalPoints,8.9,.03,mat('#739351'));
const waterTime={value:0},waterMaterial=new THREE.MeshPhysicalMaterial({color:'#16aeb7',roughness:.26,metalness:.16,clearcoat:.8,clearcoatRoughness:.20});
const waterBump=texCanvas(256,256,(c,w,h)=>{c.fillStyle='#808080';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=6){c.strokeStyle=y%12?'#bbbbbb':'#565656';c.lineWidth=2;c.beginPath();for(let x=0;x<=w;x+=4){const yy=y+Math.sin(x*.055+y*.14)*3;x?c.lineTo(x,yy):c.moveTo(x,yy)}c.stroke()}});
waterBump.colorSpace=THREE.NoColorSpace;waterBump.wrapS=waterBump.wrapT=THREE.RepeatWrapping;waterBump.repeat.set(4,10);waterMaterial.bumpMap=waterBump;waterMaterial.bumpScale=.045;
waterMaterial.onBeforeCompile=shader=>{shader.uniforms.uWaterTime=waterTime;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uWaterTime;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.y += sin(position.x * 4.0 + uWaterTime) * cos(position.z * 2.3 + uWaterTime * 0.6) * 0.012;')};
waterMaterial.customProgramCacheKey=()=> 'mud-water-wave-v1';
ribbon(canalPoints,7.4,.08,waterMaterial);
// Offset every roadside object along the road normal, not the world's X axis.
const roadDetails=[];
for(let z=-48;z<47;z+=1.1){const c=roadFrame(z);if(Math.round((z+48)/1.1)%2===0){box(M.line,c.x,.056,c.z,.13,.008,.82,null,c.angle);roadDetails.push({kind:'paint',x:c.x,z:c.z,angle:c.angle,sourceZ:z})}
 for(const side of[-1,1]){const p=roadFrame(z,side*4.97);box(Math.round((z+48)/1.1)%3?M.curb:mat('#b4ad9b'),p.x,.115,p.z,.27,.15,1.09*Math.hypot(1,(roadX(z+.05)-roadX(z-.05))/.1),null,p.angle);roadDetails.push({kind:'kerb',x:p.x,z:p.z,angle:p.angle,sourceZ:z,side})}}
// Junction bends away from the market and onto the canal bridge.
const branchCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(roadX(4),0,4),new THREE.Vector3(2,0,-1),new THREE.Vector3(6,0,-8),new THREE.Vector3(10,0,-10),new THREE.Vector3(21,0,-10)]);
const bp=branchCurve.getPoints(70).map(p=>[p.x,p.z]);ribbon(bp,4.2,.055,M.curb);ribbon(bp,3.55,.07,M.road);
// Sandy footpath and terraced paddy fields.
ribbon(canalPoints.map(([x,z])=>[x+6.4,z]),2,.045,M.soil);
for(let z=-40;z<39;z+=10){box(mat('#789442'),canalX(z)+15,.05,z,14,.24,8.8);box(M.soil,canalX(z+4.5)+15,.21,z+4.5,16,.26,.55);}
// Curved rice tufts contain several separate blades instead of scattered cones.
const riceVertices=[],riceIndices=[];
for(let blade=0;blade<3;blade++){const a=blade*Math.PI*2/3,start=riceVertices.length/3;for(let row=0;row<=5;row++){const t=row/5,bend=t*t*.16,w=Math.sin((t*.92+.04)*Math.PI)*.022;for(const side of[-1,1])riceVertices.push(Math.cos(a)*bend+Math.sin(a)*w*side,t,Math.sin(a)*bend-Math.cos(a)*w*side);if(row<5){const k=start+row*2;riceIndices.push(k,k+2,k+1,k+1,k+2,k+3)}}}
const riceGeometry=new THREE.BufferGeometry();riceGeometry.setAttribute('position',new THREE.Float32BufferAttribute(riceVertices,3));riceGeometry.setIndex(riceIndices);riceGeometry.computeVertexNormals();
const riceMaterials=['#88b833','#abc839','#659f2c'].map(c=>{const m=mat(c);m.side=THREE.DoubleSide;return m});
for(let i=0;i<19000;i++){const z=rand(-40,39),x=canalX(z)+rand(8,22);if(Math.abs((z+40)%10-4.5)<.65)continue;put(riceGeometry,riceMaterials[i%3],[x,.19,z],[rand(.8,1.2),rand(.55,.95),1],[0,random()*6.28,0])}
// Stone canal walls: varied individual blocks with coping stones.
for(let z=-47;z<46;z+=.95){for(const s of[-1,1]){const x=canalX(z)+s*4.1;for(let row=0;row<3;row++)box([M.stone,mat('#949484'),mat('#6b7267')][Math.floor(random()*3)],x, row*.36-.24,z+(row%2)*.25,.62,.35,.92,null,rand(-.04,.04));box(mat('#b6b298'),x,.72,z,.76,.19,.99);}}
const rippleMat=new THREE.MeshStandardMaterial({color:'#9de5c2',transparent:true,opacity:.3,roughness:.32});
const rippleGeometry=new THREE.RingGeometry(.8,1,32,1,0,Math.PI*1.5);
for(let i=0;i<155;i++){const z=rand(-47,44),x=canalX(z)+rand(-3.4,3.4);put(rippleGeometry,rippleMat,[x,.11,z],[rand(.10,.30),rand(.03,.12),1],[-Math.PI/2,0,rand(-.4,.4)])}
for(let i=0;i<76;i++){const z=rand(-38,38);put(new THREE.CylinderGeometry(1,1,.02,24),mat(i%3?'#94bd29':'#bed339'),[canalX(z)+rand(-2.7,2.7),.11,z],[rand(.10,.27),1,rand(.1,.23)]);}
// Footbridge with masonry piers, crossbeams, bollards and continuous rails.
box(M.stone,11.1,.66,-10,10.4,.66,3.3);box(mat('#bab6a3'),11.1,1.05,-10,10.8,.2,3.5);
for(const x of[7.5,13.6]){box(M.stone,x,-.08,-10,1.15,1.5,3.1);box(mat('#999b88'),x,-.6,-10,1.6,.4,3.5)}
for(let x=6;x<=16.2;x+=1.45){for(const z of[-11.65,-8.35]){box(mat('#c6c2aa'),x,1.62,z,.24,1.18,.28);box(M.white,x,2.22,z,.33,.13,.37)}}
for(const z of[-11.65,-8.35]){box(mat('#c7c5b6'),11.1,2.05,z,10.7,.15,.15);box(mat('#909a91'),11.1,1.55,z,10.7,.09,.12)}
// Weathered wood fencing on both banks and field boundaries.
function fence(points){points.forEach((p,i)=>{cyl(M.wood,p[0],1.12,p[1],.095,1.5);ell(M.wood,p[0],1.89,p[1],.13,.07,.13);if(i){for(const y of[1.05,1.6])bar(M.wood,[points[i-1][0],y,points[i-1][1]],[p[0],y,p[1]],.045)}})}
for(const s of[-1,1]){for(const range of[[-45,-13],[-6,42]]){const pts=[];for(let z=range[0];z<=range[1];z+=1.8)pts.push([canalX(z)+s*5,z]);fence(pts)}}
for(let z=-38;z<40;z+=10)fence([8,12,16,20,24].map(dx=>[canalX(z)+dx,z]));
// Hip roofs have actual rounded terracotta tiles along all four faces.
const tileGeo=new THREE.CylinderGeometry(.105,.105,1,12,1,false,0,Math.PI);
const roofMats=['#b95036','#c2563a','#c8593c','#bc5137','#ce5e40'].map(c=>{const m=mat(c);m.bumpMap=tileBump;m.bumpScale=.025;return m});
function roof(cx,cz,w,d,y,rise){
 const ridge=Math.max(0,(w-d)*.5),z=d*.5,x=w*.5;
 const faces=[[[cx-x,y,cz+z],[cx+x,y,cz+z],[cx+ridge,y+rise,cz],[cx-ridge,y+rise,cz]],[[cx+x,y,cz-z],[cx-x,y,cz-z],[cx-ridge,y+rise,cz],[cx+ridge,y+rise,cz]],[[cx-x,y,cz-z],[cx-x,y,cz+z],[cx-ridge,y+rise,cz],[cx-ridge,y+rise,cz]],[[cx+x,y,cz+z],[cx+x,y,cz-z],[cx+ridge,y+rise,cz],[cx+ridge,y+rise,cz]]];
 for(const [a,b,c,dv]of faces){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([...a,...b,...c,...dv],3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();mesh(g,new THREE.MeshStandardMaterial({color:'#bb472c',side:THREE.DoubleSide,roughness:.9}));
 const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),C=new THREE.Vector3(...c),D=new THREE.Vector3(...dv);const rows=Math.ceil(A.distanceTo(D)/.40);for(let row=0;row<rows;row++){const t0=row/rows,t1=(row+1)/rows;const left=A.clone().lerp(D,t0),right=B.clone().lerp(C,t0);const cols=Math.ceil(left.distanceTo(right)/.21);for(let col=0;col<cols;col++){const u=(col+.5)/cols;const p0=A.clone().lerp(B,u).lerp(D.clone().lerp(C,u),t0);const p1=A.clone().lerp(B,u).lerp(D.clone().lerp(C,u),t1);const delta=p1.clone().sub(p0),mid=p0.clone().add(p1).multiplyScalar(.5);mid.y+=.04;const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize());const e=new THREE.Euler().setFromQuaternion(q);put(tileGeo,roofMats[Math.floor(random()*roofMats.length)],mid.toArray(),[1,delta.length()+.025,1],[e.x,e.y,e.z])}}
 }
 bar(mat('#e8774d'),[cx-ridge,y+rise+.07,cz],[cx+ridge,y+rise+.07,cz],.13);
 for(const a of[[cx-w/2,y,cz-d/2],[cx+w/2,y,cz-d/2],[cx-w/2,y,cz+d/2],[cx+w/2,y,cz+d/2]])bar(M.tile,a,[cx+(a[0]<cx?-ridge:ridge),y+rise,cz],.08);
 box(M.darkWood,cx,y-.08,cz+d/2,w,.14,.1);box(M.darkWood,cx,y-.08,cz-d/2,w,.14,.1);
}
function windowAt(x,y,z,w=1,h=1.25){box(M.wood,x,y,z,w+.16,h+.17,.16);box(M.glass,x,y,z+.09,w,h,.025);box(M.wood,x,y,z+.13,.07,h,.045);box(M.wood,x,y,z+.13,w,.07,.045);box(M.cream,x,y-h/2-.11,z+.11,w+.3,.13,.26)}
function building(x,z,w,d,h,color,shop=false){const wall=mat(color);wall.bumpMap=plasterBump;wall.bumpScale=.025;box(wall,x,h/2+.2,z,w,h,d);box(mat('#c4ba92'),x,.23,z,w+.18,.42,d+.18);box(mat('#efe1b1'),x,h-.15,z+d/2+.04,w,.16,.10);roof(x,z,w+.85,d+.85,h+.18,Math.min(d*.4,2.3));
 if(!shop){windowAt(x-w*.28,h*.6,z+d/2+.03,.9,1.25);windowAt(x+w*.28,h*.6,z+d/2+.03,.9,1.25);box(M.wood,x,1.17,z+d/2+.055,.96,2,.12);box(M.black,x,1.17,z+d/2+.13,.78,1.85,.03);box(M.curb,x,.2,z+d/2+.45,1.6,.25,.65);ell(M.yellow,x+.26,1.1,z+d/2+.19,.04,.04,.04)}return{x,z,w,d,h}}
// The hotel and the tea stall are the primary visual anchors.
authoringOffset=[1.8,0];
building(-10.3,-9,9.2,6.6,4.5,'#e3c46a',true);
box(M.wood,-10.3,1.75,-5.79,8.35,2.7,.20);box(mat('#e6b346'),-10.3,1.5,-5.66,8.0,2.45,.04);
for(let x=-14.1;x<-6;x+=1.6){box(M.wood,x,1.75,-5.60,.12,2.7,.13);box(mat('#d4b55e',.45),x+.67,1.75,-5.62,1.2,2.3,.025)}
addSign('അച്ചായൻസ്\nHOTEL',-10.3,3.1,-5.43,8.7,1.65,'#a23729','#fff6ce',55);
box(M.cream,-10.3,.10,-4.6,8.4,.15,2.1);
for(let x=-13.6;x<=-7;x+=.55)for(let z=-5.5;z<=-3.65;z+=.55)box(mat('#bfb697'),x,.20,z,.515,.045,.515);
authoringOffset=[0,0];
building(-.3,-5.1,5.7,4.6,3.4,'#eac669',true);
box(mat('#9f692d'),-.3,1.1,-2.95,4.5,1.6,.12);box(mat('#f3cb63'),-.3,1.8,-2.84,4.25,.16,.6);
for(let x=-2.4;x<2;x+=.39){box(x%1>.4?mat('#e3e7dd'):mat('#648c9c'),x,2.65,-2.45,.38,.1,1.3,null,0);}
for(const x of[-2.4,1.8])cyl(M.wood,x,1.25,-1.93,.055,2.5);
box(mat('#334044'),-3.1,1.8,-2.35,2.5,4.5,.65);
addSign('CHAYA\nCHAYA\nSNACKS\nMEALS\n☕',-3.1,1.9,-1.99,2.25,4.2,'#354248','#f4efdf',39);
addSign('CHAYA',-.3,2.18,-2.77,3.3,.45,'#b75f1d','#ffedb0',65);
// Background canal-side homes and foreground spice merchant.
building(-10,-24,5.5,5,4.4,'#e0d7bd');building(-.5,-22,6.5,5.6,4.6,'#eee1bf');
building(17.5,-22,6.5,5.6,3.1,'#f6d17c');building(-21,-10,6,5,3.8,'#e8c871');
building(-19,10,7,6,3.8,'#e9bb54',true);building(-17,26,6.5,5.5,3.8,'#e7c579');
building(-28,-38,7,5.5,3.8,'#e8d9b2');building(1,-39,6,5,4,'#f4d998');building(24,30,6,5,3.3,'#efc978');
addSign('KERALA\nSPICES',-19,2.65,13.12,4.6,1.5,'#6e4e2d','#fff0c7',64);
box(M.wood,-19,1,13.1,6.5,1.6,.15);
for(let i=0;i<14;i++){box(i%2?M.cream:mat('#3d8292'),-22.2+i*.48,2.45,13.7,.48,.10,1.45)}
function billboard(x,z,text){box(mat('#d4ccb4'),x,2.5,z,2.6,4.9,.55);box(mat('#b2ac97'),x,5,z,2.9,.2,.75);addSign(text,x,3,z+.295,2.35,3.55,'#d0c9b6','#334339',52);box(M.stone,x,.22,z,3,.44,1);}
billboard(4.2,-11.6,'GOOD\nFOOD\nHAPPIER\nPEOPLE');billboard(15.7,10,'GOOD\nFOOD\nBRIGHTER');
// Traffic direction sign, stalls, baskets, tables and diners.
for(const x of[-17.1,-13.9])cyl(mat('#82877d'),x,1.8,1.1,.07,3.6);
addSign('Ernakulam  ↑\nKakkanad  →\nInfopark  →',-15.5,3.1,1.17,3.9,2.5,'#246b61','#e3f4df',43);
function pot(x,z,size=.38){put(new THREE.CylinderGeometry(.7,1,1,20),mat('#b96d38'),[x,size*.52,z],[size,size,size]);cyl(mat('#695139'),x,size*1.03,z,size*.65,.035);for(let i=0;i<8;i++){const a=i*Math.PI/4;ell([M.green,M.leaf][i%2],x+Math.cos(a)*size*.35,size*1.5+rand(0,.2),z+Math.sin(a)*size*.35,size*.32,size*.45,size*.15)}}
function crate(x,z,w=1){box(M.darkWood,x,.25,z,w,.48,.72);for(const s of[-1,1])for(let y=.12;y<.6;y+=.14)box(M.wood,x,y,z+s*.36,w,.09,.06);for(let i=0;i<14;i++)ell(i%3?M.yellow:mat('#e68524'),x+rand(-w*.4,w*.4),.52+rand(0,.18),z+rand(-.25,.25),.10,.1,.08)}
for(const [x,z]of[[-13,-.5],[-5.5,-.5],[-2.3,-1.5],[2,-2.4],[18.3,-19.3],[23.5,-18.8],[-22,14],[-16,14],[4,-5]])pot(x,z,.38);
for(const [x,z]of[[-5.3,-3.2],[2.8,-3.1],[-22,14],[-20.7,14],[-17,14.6]])crate(x,z);
function chair(x,z,rot=0){const g=new THREE.Group();g.position.set(x,authoringHeight,z);g.rotation.y=rot;scene.add(g);box(M.wood,0,.53,0,.50,.1,.5,g);for(const xx of[-.19,.19])for(const zz of[-.19,.19])box(M.darkWood,xx,.26,zz,.065,.53,.065,g);box(M.wood,0,.93,-.23,.48,.62,.055,g)}
function table(x,z){box(mat('#9c6128'),x,.92,z,1.4,.12,.8);for(const xx of[-.56,.56])for(const zz of[-.27,.27])box(M.darkWood,x+xx,.45,z+zz,.08,.9,.08);for(const xx of[-.38,.36]){cyl(M.white,x+xx,1.01,z,.16,.028);ell(M.yellow,x+xx,1.05,z,.10,.04,.08);cyl(mat('#e9d9a7'),x+xx+.21,1.12,z-.12,.05,.18)}}
for(const [x,z]of[[-8.7,-3.45],[-6.4,-3.45],[.4,-1.55]]){table(x,z);chair(x-.6,z+.6);chair(x+.6,z+.6)}
function person(x,z,shirt='#318ca1',seated=false,parent=scene){const g=new THREE.Group();g.position.set(x,parent===scene?authoringHeight:0,z);parent.add(g);const base=seated?.5:0;ell(mat(shirt),0,base+1.10,0,.23,.39,.15,g);ell(M.skin,0,base+1.65,.0,.17,.21,.17,g);ell(mat('#252622'),0,base+1.79,-.025,.17,.085,.16,g);for(const s of[-1,1]){bar(mat('#414648'),[s*.12,base+.75,0],[s*.12,seated?.36:.14,seated?.30:0],.075,g);ell(M.black,s*.12,.1,seated?.36:.045,.09,.06,.15,g);bar(mat(shirt),[s*.22,base+1.3,0],[s*.29,base+1.0,.10],.065,g);ell(M.skin,s*.29,base+.98,.12,.07,.09,.07,g)}return g}
person(-11.3,-4.1);person(-8.1,-2.9,'#d7ac43',true);person(-5.85,-2.9,'#6874ba',true);person(.05,-.95,'#e5b22c',true);person(1.2,-.95,'#e6e6db',true);person(18.3,-18.6,'#e4e9dc');person(-19.4,14.2,'#8baa40');
// Smooth bent tropical leaves, with a central vein and fine leaflets for the palms.
const leaves=[];
function leafGeometry(length,width,droop=0){const v=[],idx=[],uv=[];for(let i=0;i<=18;i++){const t=i/18,w=Math.sin(t*Math.PI)**.7*width;const y=Math.sin(t*Math.PI)*length*.21-t*t*droop;for(const s of[-1,0,1]){v.push(s*w,y+(s===0?.055:0),t*length);uv.push((s+1)/2,t)}if(i<18){const k=i*3;idx.push(k,k+3,k+1,k+1,k+3,k+4,k+1,k+4,k+2,k+2,k+4,k+5)}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g}
const leafMaterials=['#63951f','#79b425','#9abf2a','#4c8620'].map(c=>{const m=mat(c);m.side=THREE.DoubleSide;m.map=detailTexture('leaf');m.roughness=.68;m.needsUpdate=true;return m});
const palmLeaf=leafGeometry(3.5,.07,1.55),palmLeaflet=leafGeometry(1,.13,.22),bananaLeaf=leafGeometry(2.8,.50,1.05);
function palm(x,z,h=8){const sway=rand(-.6,.6);for(let i=0;i<16;i++){const t=i/16;cyl(mat(i%2?'#8d7750':'#9d8960'),x+sway*t*t,h*t+h/32,z,.17-.075*t,h/16+.015,null,[0,0,-sway/h*.8]);}
 const cx=x+sway;for(let i=0;i<11;i++){const a=i*Math.PI*2/11+rand(-.16,.16);put(palmLeaf,leafMaterials[i%4],[cx,h,z],[rand(.88,1.18),1,rand(.8,1.18)],[rand(-.08,.35),a,0]);
 // Individually modelled leaflets run down each curved frond.
 for(let j=1;j<20;j++){const t=j/21,dist=t*3.5,py=h+Math.sin(t*Math.PI)*.735-t*t*1.55;const pos=[cx+Math.sin(a)*dist,py,z+Math.cos(a)*dist];for(const s of[-1,1]){const len=Math.sin(t*Math.PI)*.58;const end=[pos[0]+Math.cos(a)*s*len+Math.sin(a)*.12,py-.13,pos[2]-Math.sin(a)*s*len+Math.cos(a)*.12];const delta=new THREE.Vector3(...end).sub(new THREE.Vector3(...pos));const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),delta.clone().normalize());const e=new THREE.Euler().setFromQuaternion(q);put(palmLeaflet,leafMaterials[(i+j)%4],pos,[delta.length(),delta.length(),delta.length()],[e.x,e.y,e.z])}}}
 for(let i=0;i<5;i++)ell(mat('#6d6530'),cx+rand(-.2,.2),h-.25,z+rand(-.2,.2),.14,.18,.14);
}
function banana(x,z,s=1){for(let i=0;i<3;i++)bar(mat('#739333'),[x+i*.07,0,z],[x+i*.04,2.7*s,z],.10*s);for(let i=0;i<7;i++)put(bananaLeaf,leafMaterials[i%4],[x,2.6*s+rand(-.25,.2),z],[s,s,s],[rand(-.15,.6),i*6.28/7,rand(-.1,.1)]);}
for(const [x,z,h]of[[-15,-15,9],[-3,-16,8.5],[6,-22,8],[15,-29,9],[16,-2,8],[8,10,7.7],[16,26,9],[-15,4,8],[-22,19,8],[25,-29,9],[-1,25,8],[-23,-28,8],[9,-38,9],[-6,-34,8]])palm(x,z,h);
for(const [x,z,s]of[[4,-8,1.2],[3,-15,1.3],[6,4,1.2],[15,12,1.25],[19,20,1.2],[-13,7,1.3],[-21,3,1.1],[-12,24,1.3],[21,-16,1],[23,-32,1.2],[5,23,1.4],[-2,-28,1],[17,-35,1.2]])banana(x,z,s);
const shrubLeaf=leafGeometry(.52,.13,.12),shrubCore=new THREE.SphereGeometry(1,12,8);
function shrub(x,z,s=.7){for(let i=0;i<22;i++){const a=i*2.4;put(shrubLeaf,leafMaterials[i%4],[x+Math.sin(a)*s*.38,.5+Math.cos(a*3)*s*.2,z+Math.cos(a)*s*.35],[s,s,s],[rand(-.6,.7),a,rand(-.4,.4)])}for(let i=0;i<3;i++)put(shrubCore,[mat('#77a829'),mat('#90b72d'),mat('#4e8a27')][i%3],[x+rand(-.2,.2)*s,.35+rand(0,.18)*s,z+rand(-.2,.2)*s],[s*.30,s*.30,s*.27])}
for(let i=0;i<250;i++){const z=rand(-45,44),x=canalX(z)+(random()>.5?1:-1)*rand(4.5,5.2);if(z>-13&&z<-7)continue;shrub(x,z,rand(.5,.9))}
for(let i=0;i<150;i++){const x=rand(-30,33),z=rand(-45,43);if(Math.abs(x-roadX(z))<6||Math.abs(x-canalX(z))<7||x>18)continue;if((x>-15&&x<3&&z>-14&&z<0)||(x>-24&&x<-14&&z>6&&z<15))continue;shrub(x,z,rand(.6,1.3))}
// Continuous planting beds along the pavements and the market lane.
const occupiedPlots=[[-9.3,-5,8.5,7.3],[-.3,-5.1,5.6,5],[-10,-24,6.4,6],[-.5,-22,7.4,6.6],[-21,-10,7,6],[-19,10,8,7],[-17,26,8,7]];
function clearForPlant(x,z){const dx=(roadX(z+.05)-roadX(z-.05))/.1;const distance=Math.abs(x-roadX(z))/Math.hypot(1,dx);if(distance<7||Math.abs(x-canalX(z))<4.4||x>canalX(z)+7)return false;if(occupiedPlots.some(([px,pz,w,d])=>Math.abs(x-px)<w/2+.8&&Math.abs(z-pz)<d/2+.8))return false;if(x>-16&&x<7&&z>-2&&z<6)return false;return true}
for(let i=0;i<780;i++){const x=rand(-29,19),z=rand(-43,35);if(clearForPlant(x,z))shrub(x,z,rand(.55,.95))}
for(let z=-40;z<35;z+=1.4)for(const side of[-1,1]){const p=roadFrame(z,side*7.2);if(clearForPlant(p.x,p.z))shrub(p.x,p.z,.62)}
for(const [x,z,h]of[[-13,19,8.5],[-25,0,7.5],[3,-13,8],[-4,-32,8.5],[5,18,7.5]])palm(x,z,h);
for(const [x,z,k]of[[-17,18,1.1],[-22,4,1],[-8,-15,1.1],[5,-18,1.2],[13,18,1],[-22,-21,1.1]])banana(x,z,k);
// Power lines and roadside lamps.
function wire(a,b){const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(...a),new THREE.Vector3((a[0]+b[0])/2,(a[1]+b[1])/2-.5,(a[2]+b[2])/2),new THREE.Vector3(...b)]);mesh(new THREE.TubeGeometry(curve,24,.022,6,false),mat('#484940'))}
for(let station=-32;station<33;station+=11){const p=roadFrame(station,6.3),next=roadFrame(station+11,6.3),x=p.x,z=p.z;cyl(mat('#656965'),x,3.5,z,.12,7);box(M.wood,x,6.3,z,1.3,.10,.15);for(const d of[-.5,.5]){cyl(M.white,x+d,6.47,z,.075,.22);if(z<22)wire([x+d,6.6,z],[next.x+d,6.6,next.z])}}
for(let station=-30;station<32;station+=12){const p=roadFrame(station,-6.3),x=p.x,z=p.z;cyl(M.black,x,2.5,z,.065,5);bar(M.black,[x,4.9,z],[x+.7,5.2,z],.04);box(M.black,x+.8,5.17,z,.4,.12,.22);box(mat('#ffffbc'),x+.8,5.1,z,.3,.02,.17)}
// Rounded vehicle bodies use bevelled extrusions rather than coarse polygons.
function roundBox(w,h,d,r=.1){const s=new THREE.Shape();s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);const g=new THREE.ExtrudeGeometry(s,{depth:d-2*r,steps:1,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:r,bevelThickness:r,curveSegments:6});g.translate(0,0,-d/2+r);return g}
const vehicles=[];
function wheel(g,x,z,r=.32){cyl(M.rubber,x,r+.12,z,r,.17,g,[0,0,Math.PI/2]);cyl(M.chrome,x*1.015,r+.12,z,r*.52,.19,g,[0,0,Math.PI/2]);cyl(M.black,x*1.025,r+.12,z,r*.18,.205,g,[0,0,Math.PI/2])}
function vehicle(type,x,z,rot=0,color='#d5e2df'){
 const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;scene.add(g);const body=mat(color,.4,.08);
 if(type==='auto'){
 put(roundBox(1.55,.78,2.2,.11),M.yellow,[0,.87,0],[1,1,1],[0,0,0],g);put(roundBox(1.5,1.15,1.65,.15),M.black,[0,1.57,.15],[1,1,1],[0,0,0],g);
 box(M.glass,0,1.64,-.70,1.26,.64,.035,g);box(M.black,0,1.8,-.75,.07,.7,.055,g);box(M.yellow,0,1.15,-.92,1.5,.14,.2,g);box(M.glass,0,1.66,1, .45,.40,.025,g);box(M.chrome,0,.72,1.12,1.18,.10,.10,g);box(M.black,0,1.12,1.115,1.42,.14,.07,g);
 for(const s of[-1,1]){box(M.black,s*.74,1.44,-.1,.04,.77,.92,g);box(M.wood,s*.73,1.06,-.05,.05,.12,.82,g);ell(M.white,s*.55,.99,-1.11,.10,.12,.03,g);box(mat('#db3b27'),s*.57,.83,1.135,.12,.20,.03,g);wheel(g,s*.76,.63,.31);bar(M.black,[s*.73,1.63,-.69],[s*.93,1.65,-.90],.025,g);ell(M.black,s*.94,1.67,-.92,.09,.08,.025,g)}wheel(g,0,-.76,.28);box(M.yellow,0,.57,1.145,.45,.11,.02,g);
 }else if(type==='bus'){
 put(roundBox(2.65,2.7,7.1,.12),M.red,[0,1.94,0],[1,1,1],[0,0,0],g);put(roundBox(2.68,.3,7.15,.08),M.cream,[0,3.32,0],[1,1,1],[0,0,0],g);box(M.cream,0,2.62,0,2.69,1.03,7.13,g);box(M.glass,0,2.70,3.585,2.33,.85,.035,g);box(M.wood,0,2.70,3.62,.06,.93,.07,g);box(M.glass,0,2.65,-3.59,2.25,.9,.04,g);
 for(const s of[-1,1]){for(let zz=-2.9;zz<=2.9;zz+=.83){box(M.glass,s*1.354,2.63,zz,.045,.77,.7,g);box(M.red,s*1.379,2.63,zz+.37,.045,.94,.06,g);box(M.chrome,s*1.4,2.37,zz,.03,.035,.7,g)}wheel(g,s*1.36,-2.2,.48);wheel(g,s*1.36,2.25,.48);box(M.chrome,s*1.37,1.18,0,.03,.08,6.8,g);box(M.white,s*.94,1.3,3.59,.17,.22,.03,g);box(mat('#ff4b34'),s*.94,1.02,3.595,.17,.23,.03,g)}box(M.chrome,0,.68,3.64,2.5,.18,.1,g);
 for(let zz=-3.15;zz<3.1;zz+=.74){box(mat('#6a6b63'),0,3.58,zz,2.12,.025,.66,g)}addSign('KSRTC',0,1.73,3.60,1.86,.45,'#b84232','#ffeed0',67,0,g);
 }else{
 const van=type==='van';put(roundBox(1.74,.84,3.20,.14),body,[0,.87,0],[1,1,1],[0,0,0],g);put(roundBox(1.49,van?1.14:.88,van?2.55:1.98,.17),body,[0,1.5,van?.16:.09],[1,1,1],[0,0,0],g);box(M.glass,0,1.55,-(van?1.13:.96),1.25,.61,.045,g);box(M.glass,0,1.57,van?1.45:1.08,1.22,.59,.04,g);
 for(const s of[-1,1]){box(M.glass,s*.751,1.57,-.43,.035,.54,.7,g);box(M.glass,s*.751,1.57,.41,.035,.54,.69,g);box(M.black,s*.78,1.3,0,.028,.035,1.85,g);box(M.black,s*.80,1.40,.35,.03,.035,.16,g);box(M.white,s*.6,.94,-1.615,.3,.20,.045,g);box(mat('#ea3f27'),s*.64,.92,1.615,.2,.3,.04,g);wheel(g,s*.88,-1.01);wheel(g,s*.88,1.02);ell(body,s*.95,1.43,-.6,.10,.07,.16,g)}box(M.black,0,.72,1.63,1.6,.1,.045,g);box(M.yellow,0,.86,1.63,.40,.12,.02,g);box(M.black,0,.80,-1.64,.69,.13,.02,g);
 }
 vehicles.push({g,type,z,x,rot});return g;
}
vehicle('bus',roadX(4)-2.1,4,.08);vehicle('auto',roadX(19)-2,19);vehicle('auto',roadX(5)+2.1,5);vehicle('car',roadX(-3)+2,-3,Math.PI,'#c6d8e3');vehicle('auto',roadX(-9)+2,-9);vehicle('auto',roadX(-15)+1.8,-15);vehicle('van',roadX(-18)-1.8,-18,Math.PI,'#e5e8de');vehicle('car',roadX(-12)-2,-12,Math.PI,'#a74535');vehicle('car',roadX(-29)-1.8,-29,Math.PI,'#ecebdd');vehicle('auto',roadX(-27)+2,-27);vehicle('auto',roadX(-36)+2,-36);
vehicle('auto',roadX(13)-2.1,13);vehicle('car',roadX(3)+2.1,3,Math.PI,'#dde4e4');vehicle('auto',roadX(-1)-2.1,-1);vehicle('auto',roadX(24)-2.1,24);
for(const v of vehicles){const p=roadFrame(v.z,v.x-roadX(v.z));v.g.position.set(p.x,0,p.z);v.g.rotation.y=p.angle+(v.rot>2?Math.PI:0)}
// Delivery motorbikes: wheels, fork, engine, lamps, mirrors, rider and cargo box.
const bikes=[];
function bike(x,z,color,label){const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);
 for(const zz of[-.7,.67]){put(new THREE.TorusGeometry(.29,.08,12,28),M.rubber,[0,.38,zz],[1,1,1],[0,Math.PI/2,0],g);cyl(M.chrome,0,.38,zz,.2,.06,g,[0,0,Math.PI/2]);for(let i=0;i<10;i++){const a=i*Math.PI/5;bar(M.chrome,[0,.38,zz],[0,.38+Math.cos(a)*.20,zz+Math.sin(a)*.20],.013,g)}}
 bar(M.chrome,[-.12,.4,-.7],[-.12,1.15,-.4],.04,g);bar(M.chrome,[.12,.4,-.7],[.12,1.15,-.4],.04,g);box(M.black,0,.7,.1,.39,.43,.6,g);ell(mat(color),0,1.05,-.25,.23,.17,.31,g);box(M.black,0,1.08,.23,.42,.11,.72,g);box(M.chrome,0,.75,.62,.5,.07,.64,g);ell(M.white,0,1.1,-.64,.14,.12,.06,g);box(mat('#ff3824'),0,.80,.92,.21,.10,.04,g);box(M.white,0,.68,.94,.25,.13,.04,g);bar(M.chrome,[-.30,1.18,-.48],[.30,1.18,-.48],.025,g);for(const s of[-1,1]){bar(M.chrome,[s*.28,1.2,-.48],[s*.34,1.47,-.53],.018,g);ell(M.glass,s*.35,1.5,-.54,.07,.07,.027,g);bar(mat('#29313b'),[s*.13,1.35,.10],[s*.26,.74,-.07],.083,g);ell(M.black,s*.25,.68,-.14,.075,.06,.15,g);bar(mat(color),[s*.18,1.67,-.09],[s*.27,1.23,-.46],.055,g);ell(M.skin,s*.28,1.22,-.47,.055,.06,.055,g)}
 ell(mat(color),0,1.5,.08,.22,.31,.18,g);ell(M.black,0,1.96,-.02,.19,.23,.20,g);ell(mat(color),0,2.03,0,.198,.18,.21,g);box(M.black,0,2.15,-.025,.065,.02,.25,g);ell(M.glass,0,1.95,-.16,.16,.10,.04,g);
 put(roundBox(.75,.68,.62,.055),mat(color),[0,1.44,.63],[1,1,1],[0,0,0],g);box(M.black,0,1.81,.63,.74,.03,.6,g);addSign(label,0,1.47,.956,.68,.48,color,label==='MUD\nMEALS'?'#17211c':'#fff7e5',label.includes('\n')?61:50,0,g);
 bikes.push(g);return g}
const player=bike(roadX(12)+2.0,12,'#f58c17','MUD\nMEALS');const rival1=bike(roadX(18)+.2,18,'#e83437','ZipEats');const rival2=bike(roadX(22)+2.2,22,'#723cae','QuickBite');
for(const [g,z,offset]of[[player,12,2],[rival1,18,-.4],[rival2,22,2.2]]){const p=roadFrame(z,offset);g.position.set(p.x,0,p.z);g.rotation.y=p.angle}
for(const g of bikes)g.scale.setScalar(1.3);
const playerStart=player.position.clone(),playerStartAngle=player.rotation.y;
// Keep district instance batches independent of the original market.
flush();scene.add(sun.target);
const extendedWorld=createExtendedWorld({scene,M,mat,box,cyl,ell,bar,put,mesh,flush,building,roof,palm,banana,shrub,person,pot,crate,table,chair,addSign,fence,rand,riceGeometry,riceMaterials,waterMaterial,roadFrame,sun,renderer,setHeight:h=>authoringHeight=h,spawnVehicle:(...args)=>{const g=vehicle(...args);vehicles.pop();return g}});
const routeCurve=extendedWorld.route;
const routeLength=routeCurve.getLength();let routeStart=0,routeStartDistance=Infinity;
for(let i=0;i<=1000;i++){const t=i/1000,p=routeCurve.getPointAt(t),distance=(p.x-playerStart.x)**2+(p.z-playerStart.z)**2;if(distance<routeStartDistance){routeStartDistance=distance;routeStart=t}}
const routeMaterial=new THREE.MeshBasicMaterial({color:'#0bd6d6',toneMapped:false});
const initialRouteStart=routeStart;
for(let t=0;t<1;t+=2.1/routeLength){const a=routeCurve.getPointAt(t),b=routeCurve.getPointAt(Math.min(1,t+1.3/routeLength));a.y=Math.max(.16,a.y);b.y=Math.max(.16,b.y);const dir=b.clone().sub(a),length=dir.length();if(length<.0001)continue;const rotation=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),dir.normalize()));put(geom.box,routeMaterial,a.clone().add(b).multiplyScalar(.5).toArray(),[.20,.025,length],[rotation.x,rotation.y,rotation.z])}
for(const t of[.18,.39,.64,.82]){const p=routeCurve.getPointAt(t),next=routeCurve.getPointAt((t+.001)%1),ang=Math.atan2(next.x-p.x,next.z-p.z);const g=new THREE.Group();g.position.copy(p);g.rotation.y=ang;scene.add(g);bar(routeMaterial,[-.3,.07,-.25],[0,.07,.2],.05,g);bar(routeMaterial,[.3,.07,-.25],[0,.07,.2],.05,g)}
function pin(x,z){const g=new THREE.Group();g.position.set(x,6,z);scene.add(g);ell(routeMaterial,0,.2,0,.46,.53,.24,g);put(geom.cone,routeMaterial,[0,-.45,0],[.31,.85,.18],[0,0,Math.PI],g);ell(mat('#083d39'),0,.28,.245,.16,.17,.025,g);const ring=new THREE.Mesh(new THREE.RingGeometry(.32,.59,40),routeMaterial);ring.rotation.x=-Math.PI/2;ring.position.set(x,4.54,z);scene.add(ring);return g}const destinationPin=pin(17.5,-22);
for(const g of[rival1,rival2]){put(geom.cone,mat('#fd294e'),[0,2.6,0],[.18,.4,.18],[0,0,Math.PI],g)}
// White egrets and the small wooden canoe add scale to the paddy-side canal.
function egret(x,z){ell(M.white,x,.85,z,.11,.19,.26);bar(M.white,[x,.9,z-.12],[x,1.28,z-.25],.045);ell(M.white,x,1.32,z-.25,.07,.09,.07);bar(M.yellow,[x,1.31,z-.30],[x,1.29,z-.49],.027);for(const s of[-1,1])bar(mat('#a69346'),[x+s*.04,.73,z],[x+s*.06,.24,z+.05],.012)}egret(canalX(1)+11,1);egret(canalX(12)+11,12);egret(canalX(-13)+17,-13);
const boat=new THREE.Group();boat.position.set(canalX(24),.23,24);boat.rotation.y=.38;scene.add(boat);
const hull=new THREE.Shape();hull.moveTo(0,-2.2);hull.bezierCurveTo(.75,-1.7,.75,1.7,0,2.2);hull.bezierCurveTo(-.75,1.7,-.75,-1.7,0,-2.2);const hullGeo=new THREE.ExtrudeGeometry(hull,{depth:.32,bevelEnabled:true,bevelSize:.10,bevelThickness:.1,bevelSegments:3,curveSegments:18});hullGeo.rotateX(-Math.PI/2);put(hullGeo,M.darkWood,[0,0,0],[1,1,1],[0,0,0],boat);for(let zz=-1.5;zz<1.7;zz+=.65)box(M.wood,0,.13,zz,1.05,.08,.17,boat);bar(M.wood,[-.45,.2,-1.9],[-.62,.55,1.95],.05,boat);
flush();
// UI and real scene controls.
let cameraMode='reference';
let paused=false,freeCamera=false,speed=0,steer=0,travel=0,delivered=false;const keys=new Set();
const toast=document.querySelector('#toast');let toastTimer;
function notify(message){toast.textContent=message;toast.style.opacity=1;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.style.opacity=0,2600)}
const cameraDefaults={zoom:defaultZoom,tilt:24,rotation:0,panX:0,panZ:12};
const cameraLimits={zoom:[.7,2.2],tilt:[10,65],rotation:[-75,75],panX:[-4,4],panZ:[6,24]};
const cameraSettings={...cameraDefaults};
try{const saved=JSON.parse(localStorage.getItem('mud-meals-follow-camera')||'null');if(saved&&typeof saved==='object')for(const key of Object.keys(cameraLimits)){const value=saved[key];if(typeof value==='number'&&Number.isFinite(value))cameraSettings[key]=THREE.MathUtils.clamp(value,...cameraLimits[key])}}catch{}
function saveCamera(){try{localStorage.setItem('mud-meals-follow-camera',JSON.stringify(cameraSettings))}catch{}}
const followPosition=new THREE.Vector3(),followLookAt=new THREE.Vector3(),followForward=new THREE.Vector3(),followRight=new THREE.Vector3();
function updateFollowCamera(dt,snap=false){
 if(freeCamera)return;
 if(cameraMode==='reference'){
  // Long lens retains an isometric composition without replacing the playable 3D scene.
  const anchor=new THREE.Vector3(1.8,0,-3.8).add(player.position.clone().sub(playerStart));
  const azimuth=THREE.MathUtils.degToRad(20+cameraSettings.rotation),elevation=THREE.MathUtils.degToRad(45+(cameraSettings.tilt-24)*.6),distance=140;
  followPosition.copy(anchor).add(new THREE.Vector3(Math.sin(azimuth)*Math.cos(elevation)*distance,Math.sin(elevation)*distance,Math.cos(azimuth)*Math.cos(elevation)*distance));
  followPosition.x+=cameraSettings.panX;followLookAt.copy(anchor);followLookAt.x+=cameraSettings.panX;
  const blend=snap?1:1-Math.exp(-5*Math.max(0,dt));camera.position.lerp(followPosition,blend);controls.target.lerp(followLookAt,blend);camera.lookAt(controls.target);return;
 }
 const heading=player.rotation.y,angle=heading+THREE.MathUtils.degToRad(cameraSettings.rotation),tilt=THREE.MathUtils.degToRad(cameraSettings.tilt),distance=cameraSettings.panZ+speed*.3;
 followForward.set(-Math.sin(heading),0,-Math.cos(heading));followRight.set(Math.cos(heading),0,-Math.sin(heading));
 followPosition.copy(player.position).addScaledVector(followRight,cameraSettings.panX);
 followPosition.x+=Math.sin(angle)*Math.cos(tilt)*distance;followPosition.z+=Math.cos(angle)*Math.cos(tilt)*distance;followPosition.y+=1.4+Math.sin(tilt)*distance;
 followLookAt.copy(player.position).addScaledVector(followForward,2+speed*.45).addScaledVector(followRight,cameraSettings.panX);followLookAt.y+=1.1;
 const blend=snap?1:1-Math.exp(-5*Math.max(0,dt));
 camera.position.lerp(followPosition,blend);controls.target.lerp(followLookAt,blend);camera.lookAt(controls.target);
}
function applyCameraSettings(){
 freeCamera=false;controls.enabled=false;document.querySelector('#view').textContent='Free camera';
 controls.enableDamping=false;controls.update();
 camera.fov=cameraMode==='reference'?16.5:55;camera.far=cameraMode==='reference'?360:160;scene.fog.near=cameraMode==='reference'?220:95;scene.fog.far=cameraMode==='reference'?360:180;camera.zoom=cameraSettings.zoom;camera.updateProjectionMatrix();document.querySelector('#camera-mode').value=cameraMode;document.querySelector('#drive-status').hidden=cameraMode==='reference';updateFollowCamera(0,true);controls.enableDamping=true;
 for(const key of Object.keys(cameraLimits)){const input=document.querySelector('#camera-'+key);input.value=cameraSettings[key];document.querySelector('#camera-'+key+'-value').textContent=key==='zoom'?cameraSettings[key].toFixed(2)+'×':key==='tilt'||key==='rotation'?Math.round(cameraSettings[key])+'°':cameraSettings[key].toFixed(1)+' m'}
}
function resetCameraSettings(){Object.assign(cameraSettings,cameraDefaults);applyCameraSettings();saveCamera()}
function setCameraMode(mode){cameraMode=mode==='driving'?'driving':'reference';applyCameraSettings()}
document.querySelector('#camera-mode').addEventListener('change',event=>setCameraMode(event.target.value));
for(const key of Object.keys(cameraLimits))document.querySelector('#camera-'+key).addEventListener('input',event=>{cameraSettings[key]=THREE.MathUtils.clamp(Number(event.target.value),...cameraLimits[key]);applyCameraSettings();saveCamera()});
document.querySelector('#camera-settings').onclick=()=>{document.querySelector('#camera-panel').hidden=false;document.querySelector('.tools').hidden=true;document.querySelector('#tools-toggle').setAttribute('aria-expanded','false')};
document.querySelector('#close-camera').onclick=()=>document.querySelector('#camera-panel').hidden=true;
document.querySelector('#reset-camera').onclick=()=>{resetCameraSettings();notify('Camera reset')};
applyCameraSettings();
function reset(){cameraMode='reference';player.position.copy(playerStart);player.rotation.set(0,playerStartAngle,0);speed=0;travel=0;routeStart=initialRouteStart;delivered=false;document.querySelector('#cash').textContent='₹1,240';resetCameraSettings()}
function hold(button,key){const el=document.querySelector(button);el.addEventListener('pointerdown',e=>{keys.add(key);el.setPointerCapture(e.pointerId)});for(const ev of['pointerup','pointercancel','lostpointercapture'])el.addEventListener(ev,()=>keys.delete(key))}
hold('#accelerate','ArrowUp');hold('#brake','ArrowDown');
for(const btn of document.querySelectorAll('[data-steer]')){const n=Number(btn.dataset.steer);btn.addEventListener('pointerdown',e=>{steer=n;btn.setPointerCapture(e.pointerId)});for(const ev of['pointerup','pointercancel','lostpointercapture'])btn.addEventListener(ev,()=>steer=0)}
document.querySelector('#pause').onclick=()=>{paused=!paused;document.querySelector('#pause').textContent=paused?'▶':'Ⅱ';document.querySelector('#pause').setAttribute('aria-label',paused?'Resume animation':'Pause animation')};
document.querySelector('#view').onclick=()=>{freeCamera=!freeCamera;controls.enabled=freeCamera;document.querySelector('#view').textContent=freeCamera?'Locked camera':'Free camera';notify(freeCamera?'Drag to orbit · Scroll to zoom':'Camera settings restored');if(!freeCamera)applyCameraSettings()};
document.querySelector('#reset').onclick=()=>{reset();notify('Scene reset')};
document.querySelector('#orders').onclick=()=>document.querySelector('#order-panel').hidden=false;
document.querySelector('#close-orders').onclick=()=>document.querySelector('#order-panel').hidden=true;
document.querySelector('#reference').onclick=()=>{document.querySelector('#reference-panel').hidden=false;document.querySelector('#reference-opacity').value='1';document.querySelector('#reference-panel img').style.opacity='1'};
document.querySelector('#reference-opacity').addEventListener('input',event=>document.querySelector('#reference-panel img').style.opacity=event.target.value);
document.querySelector('#reference-frame').onclick=()=>{reset();document.querySelector('#reference-opacity').value='.5';document.querySelector('#reference-panel img').style.opacity='.5'};
document.querySelector('#close-reference').onclick=()=>document.querySelector('#reference-panel').hidden=true;
let hudVisible=true;function toggleHUD(){hudVisible=!hudVisible;document.querySelector('#hud').style.visibility=hudVisible?'visible':'hidden';notify(hudVisible?'HUD visible':'Press H to restore the HUD')}
document.querySelector('#hide').onclick=toggleHUD;
function visitDistrict(id){const d=extendedWorld.districts.find(d=>d.id===id);if(!d)return;routeStart=d.routeT;travel=0;speed=0;document.querySelector('#speed').textContent='0';const p=routeCurve.getPointAt(routeStart),ahead=routeCurve.getPointAt((routeStart+.0007)%1);player.position.set(p.x,Math.max(0,p.y-.16),p.z);player.rotation.set(0,Math.atan2(-(ahead.x-p.x),-(ahead.z-p.z)),0);applyCameraSettings();extendedWorld.update(elapsed,player);sun.shadow.needsUpdate=true;document.querySelector('#location').textContent=d.name.toUpperCase();minimap()}
document.querySelector('#world-explore').onclick=()=>{document.querySelector('#world-panel').hidden=false;document.querySelector('.tools').hidden=true};
document.querySelector('#close-world').onclick=()=>document.querySelector('#world-panel').hidden=true;
document.querySelector('#travel-district').onclick=()=>{visitDistrict(document.querySelector('#district-select').value);document.querySelector('#world-panel').hidden=true;notify('Exploring '+extendedWorld.nearest(player.position).name)};
document.querySelector('#weather-select').addEventListener('change',event=>{extendedWorld.setWeather(event.target.value);sun.shadow.needsUpdate=true});
document.querySelector('#tools-toggle').onclick=()=>{const menu=document.querySelector('.tools');menu.hidden=!menu.hidden;document.querySelector('#tools-toggle').setAttribute('aria-expanded',String(!menu.hidden))};
async function enterLandscape(){
 try{if(!document.fullscreenElement&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();if(screen.orientation?.lock)await screen.orientation.lock('landscape')}catch{notify('Rotate your phone sideways for landscape')}
 resize();
}
document.querySelector('#enter-landscape').onclick=enterLandscape;
document.querySelector('#fullscreen').onclick=async()=>{if(document.fullscreenElement){try{await document.exitFullscreen();screen.orientation?.unlock?.()}catch{}}else await enterLandscape()};
document.addEventListener('fullscreenchange',resize);

window.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;if(e.target.tagName==='BUTTON'&&e.code==='Space')return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();keys.add(e.key);if(e.key.toLowerCase()==='h')toggleHUD();if(e.key.toLowerCase()==='r')reset();if(e.code==='Space')document.querySelector('#pause').click()});window.addEventListener('keyup',e=>keys.delete(e.key));window.addEventListener('blur',()=>{keys.clear();steer=0});
const mapCanvas=document.querySelector('#minimap'),ctx=mapCanvas.getContext('2d');
function minimap(){ctx.clearRect(0,0,300,300);ctx.fillStyle='#7f9952';ctx.fillRect(0,0,300,300);const project=(x,z)=>[150+(x-player.position.x)*3.3,155+(z-player.position.z)*3.3];
 for(let i=0;i<100;i++){const x=(Math.sin(i*12.7)*.5+.5)*300,y=(Math.cos(i*4.3)*.5+.5)*300;ctx.fillStyle=['#608c3e','#a2b563','#547b3b'][i%3];ctx.beginPath();ctx.arc(x,y,3+i%5,0,Math.PI*2);ctx.fill()}
 function path(points,color,w){ctx.strokeStyle=color;ctx.lineWidth=w;ctx.beginPath();points.forEach(([x,z],i)=>{const p=project(x,z);i?ctx.lineTo(...p):ctx.moveTo(...p)});ctx.stroke()}
 path(extendedWorld.roadPoints.map(p=>[p.x,p.z]),'#bec4ac',18);path(canalPoints,'#3ebac5',27);path(roadPoints,'#bec4ac',18);path(bp,'#bec4ac',13);path([[-25,-30],[22,-30]],'#b0b59c',11);path([[-25,10],[0,10]],'#b0b59c',10);
 for(const [x,z]of[[-10,-9],[-.3,-22],[21,-22],[-19,10]]){const p=project(x,z);ctx.fillStyle='#f4d089';ctx.fillRect(p[0]-6,p[1]-5,12,11);ctx.fillStyle='#b94e31';ctx.beginPath();ctx.moveTo(p[0]-9,p[1]-5);ctx.lineTo(p[0],p[1]-12);ctx.lineTo(p[0]+9,p[1]-5);ctx.fill()}
 ctx.setLineDash([5,5]);path(routeCurve.getSpacedPoints(650).map(p=>[p.x,p.z]),'#39f4e6',3);ctx.setLineDash([]);
 for(const b of[rival1,rival2]){const p=project(b.position.x,b.position.z);ctx.fillStyle='#fa4861';ctx.beginPath();ctx.arc(...p,6,0,6.28);ctx.fill();ctx.strokeStyle='#233e2d';ctx.lineWidth=2;ctx.stroke()}
 const p=project(player.position.x,player.position.z);ctx.save();ctx.translate(...p);ctx.rotate(-player.rotation.y);ctx.fillStyle='#ff952c';ctx.strokeStyle='#1b3b2c';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,-21);ctx.lineTo(13,15);ctx.lineTo(0,9);ctx.lineTo(-13,15);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
 const d=project(17.5,-22);ctx.fillStyle='#35f3e2';ctx.beginPath();ctx.arc(...d,9,0,6.28);ctx.fill();ctx.fillStyle='#13423b';ctx.beginPath();ctx.arc(...d,3,0,6.28);ctx.fill()}
const clock=new THREE.Clock();let elapsed=0,mapTime=0;
function update(dt){if(!paused){elapsed+=dt;if(speed>.02&&Math.floor(elapsed*12)!==Math.floor((elapsed-dt)*12))sun.shadow.needsUpdate=true;waterTime.value=elapsed;waterBump.offset.x=elapsed*.007;waterBump.offset.y=elapsed*.004;if(keys.has('ArrowUp')||keys.has('w'))speed=Math.min(speed+dt*2,9);else speed=Math.max(0,speed-dt*.7);if(keys.has('ArrowDown')||keys.has('s'))speed=Math.max(0,speed-dt*5);const turn=steer+(keys.has('ArrowLeft')||keys.has('a')?-1:0)+(keys.has('ArrowRight')||keys.has('d')?1:0);
 if(speed>.02){travel+=speed*dt;const t=(routeStart+travel/routeLength)%1;const p=routeCurve.getPointAt(t),ahead=routeCurve.getPointAt((t+.0007)%1);player.position.set(p.x+turn*.7,Math.max(0,p.y-.16),p.z);player.rotation.y=Math.atan2(-(ahead.x-p.x),-(ahead.z-p.z));player.rotation.z=-turn*speed*.025;if(travel>15&&Math.hypot(p.x-21,p.z+18.3)<3&&!delivered){delivered=true;document.querySelector('#cash').textContent='₹1,520';notify('Delivered! ₹280 added to cash')}}
 destinationPin.position.y=6+Math.sin(elapsed*2)*.13;
 for(const g of[rival1,rival2])g.position.y=Math.sin(elapsed*4+(g===rival1?0:2))*.025;
 const left=Math.max(0,165-Math.floor(elapsed));document.querySelector('#timer').textContent=`${String(Math.floor(left/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}`;
 }
 extendedWorld.update(elapsed,player);if(freeCamera)controls.update();else updateFollowCamera(dt);mapTime+=dt;if(mapTime>.10){minimap();document.querySelector('#location').textContent=extendedWorld.nearest(player.position).name.toUpperCase();document.querySelector('#speed').textContent=Math.round(speed*3.6);document.querySelector('#rival').hidden=Math.min(player.position.distanceTo(rival1.position),player.position.distanceTo(rival2.position))>18;mapTime=0}}
function resize(){const stage=document.querySelector('#game-stage').getBoundingClientRect();const w=Math.max(1,Math.round(stage.width)),h=Math.max(1,Math.round(stage.height));camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);graphics.resize(w,h)}
const graphics=setupGraphics(renderer,scene,camera);
let sharpGraphics=true;
try{sharpGraphics=localStorage.getItem('mud-meals-graphics')!=='balanced'}catch{}
function applyQuality(){graphics.setQuality(sharpGraphics);document.querySelector('#quality').textContent=sharpGraphics?'Graphics: Sharp':'Graphics: Balanced';resize()}
document.querySelector('#quality').onclick=()=>{sharpGraphics=!sharpGraphics;applyQuality();try{localStorage.setItem('mud-meals-graphics',sharpGraphics?'sharp':'balanced')}catch{};notify(sharpGraphics?'Sharp graphics enabled':'Balanced graphics enabled')};
applyQuality();
window.addEventListener('resize',resize);
new ResizeObserver(resize).observe(document.querySelector('#game-stage'));
resize();minimap();
renderer.setAnimationLoop(()=>{update(Math.min(clock.getDelta(),.05));graphics.render()});
window.__MUD_MEALS__={setCameraMode,get cameraMode(){return cameraMode},extendedWorld,visitDistrict,update,scene,camera,renderer,player,reset,cameraSettings,resetCameraSettings,updateFollowCamera,graphics,resize,roadFrame,roadDetails,vehicles,stats:()=>({triangles:renderer.info.render.triangles,calls:renderer.info.render.calls,geometries:renderer.info.memory.geometries,objects:scene.children.length})};
renderer.compileAsync(scene,camera).then(()=>{document.querySelector('#loading').style.opacity=0;setTimeout(()=>document.querySelector('#loading').remove(),450)}).catch(()=>document.querySelector('#loading').remove());
