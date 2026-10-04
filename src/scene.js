import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { setupGraphics } from './graphics.js';
import { createExtendedWorld, createExtensionRoad } from './world.js';
import { createWorldLife } from './life.js';
import {installCrowd} from './characters.js';
import {clone as cloneCharacter} from 'three/addons/utils/SkeletonUtils.js';
import {createDriving} from './driving.js';
import {createMotorcycle,motorcycleStyles} from './prototypes/vehicles.js';

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
scene.background=new THREE.Color('#bacbd0');
scene.fog=new THREE.Fog('#bacbd0',95,180);
const aspect=innerWidth/innerHeight;
const camera=new THREE.PerspectiveCamera(55,aspect,.1,160);
const defaultZoom=1.12;camera.zoom=defaultZoom;
const originalPosition=new THREE.Vector3(23,49,48), originalTarget=new THREE.Vector3(0,0,0);
camera.position.copy(originalPosition);camera.lookAt(originalTarget);
const controls=new OrbitControls(camera,canvas);controls.target.copy(originalTarget);controls.enabled=false;controls.update();
controls.enableDamping=true;controls.minDistance=4;controls.maxDistance=180;controls.maxPolarAngle=Math.PI*.46;
scene.add(new THREE.HemisphereLight('#e6edf0','#55584b',.95));
const sun=new THREE.DirectionalLight('#fff8ee',2.5);sun.position.set(-30,55,28);sun.castShadow=true;
sun.shadow.mapSize.set(innerHeight<650?2048:4096,innerHeight<650?2048:4096);Object.assign(sun.shadow.camera,{left:-48,right:48,top:48,bottom:-48,near:1,far:130});
sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=true;sun.shadow.normalBias=.025;sun.shadow.bias=-.00012;sun.shadow.radius=3;scene.add(sun);
let seed=9137;function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}const rand=(a,b)=>a+(b-a)*random();
const materials=new Map();
function mat(color,roughness=.83,metalness=0){const key=color+roughness+metalness;if(!materials.has(key)){const pigment=new THREE.Color(color),hsl={};pigment.getHSL(hsl);pigment.setHSL(hsl.h,hsl.s*.78,hsl.l);materials.set(key,new THREE.MeshStandardMaterial({color:pigment,roughness,metalness}));}return materials.get(key)}
const M={grass:mat('#72934a'),soil:mat('#c58d48'),road:mat('#797578'),line:mat('#e8dac3'),curb:mat('#d2c4a6'),wood:mat('#785135'),darkWood:mat('#473924'),black:mat('#202528'),rubber:mat('#171c1c'),glass:mat('#45656b',.24,.3),cream:mat('#ffe4a0'),red:mat('#b9422f'),tile:mat('#cb4d32'),stone:mat('#797e70'),skin:mat('#8d572f'),green:mat('#469c29'),leaf:mat('#64ad2a'),leafLight:mat('#8bbd35'),chrome:mat('#c5c6bd',.28,.75),yellow:mat('#f7be29'),white:mat('#edece0')};
const geom={box:new THREE.BoxGeometry(1,1,1),sphere:new THREE.SphereGeometry(1,20,14),cylinder:new THREE.CylinderGeometry(1,1,1,20),cone:new THREE.ConeGeometry(1,1,24),torus:new THREE.TorusGeometry(1,.2,12,28)};
// Shared geometries are instanced after authoring, keeping thousands of detailed objects practical.
const batches=new Map(), dummy=new THREE.Object3D();let authoringOffset=[0,0],authoringHeight=0;
const plots=[],plantings=[],npcs=[],extraRoads=[],waterAreas=[];
function reservePlot(kind,x,z,w,d){plots.push({kind,x:x+authoringOffset[0],z:z+authoringOffset[1],y:authoringHeight,w,d});}
function waterAt(x,z){return (z>-48&&z<50&&Math.abs(x-canalX(z))<5.15)||waterAreas.some(a=>a.ellipse?((x-a.x)/(a.w/2))**2+((z-a.z)/(a.d/2))**2<1:Math.abs(x-a.x)<a.w/2&&Math.abs(z-a.z)<a.d/2);}
function distanceToRoad(x,z,points){let nearest=Infinity;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,t=THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1);nearest=Math.min(nearest,Math.hypot(x-a.x-t*dx,z-a.z-t*dz));}return nearest;}
let originalRoadSamples;
function roadSamples(){return originalRoadSamples??= [roadPoints.map(p=>({x:p[0],z:p[1]})),bp.map(p=>({x:p[0],z:p[1]}))];}
function roadDistance(x,z){return Math.min(...[...roadSamples(),...extraRoads].map(points=>distanceToRoad(x,z,points)));}
function roadClearance(x,z){return Math.min(...[...roadSamples(),...extraRoads].map((points,i)=>distanceToRoad(x,z,points)-(i===0?4.8:i===1?1.78:4.2)));}
function plotBlocked(x,z,radius,ignoreFurniture=false){return plots.some(p=>(!ignoreFurniture||p.kind==='building'||p.kind==='cargo')&&Math.hypot(Math.max(0,Math.abs(x-p.x)-p.w/2),Math.max(0,Math.abs(z-p.z)-p.d/2))<radius);}
function plantAllowed(x,z,radius){return !waterAt(x,z)&&!plotBlocked(x,z,radius)&&roadClearance(x,z)>radius+.35;}
function recordPlant(kind,x,z,radius){plantings.push({kind,x:x+authoringOffset[0],z:z+authoringOffset[1],y:authoringHeight,radius});}
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
function flush(){
 // Spatial batches let the close driving camera cull distant instances individually.
 for(const {g,m,items}of batches.values()){
  const cells=new Map();for(const it of items){const key=Math.floor(it.p[0]/24)+','+Math.floor(it.p[2]/24);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(it);}
  for(const group of cells.values()){
   const o=new THREE.InstancedMesh(g,m,group.length);
   group.forEach((it,i)=>{dummy.position.set(...it.p);dummy.scale.set(...it.s);dummy.rotation.set(...it.rot);dummy.updateMatrix();o.setMatrixAt(i,dummy.matrix)});
   o.castShadow=true;o.receiveShadow=true;if(m.userData.windDepth)o.customDepthMaterial=m.userData.windDepth;scene.add(o);
  }
 }
 batches.clear();
}

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
scene.environment=new THREE.CubeTexture(reflectionFaces);scene.environment.colorSpace=THREE.SRGBColorSpace;scene.environment.needsUpdate=true;scene.environmentIntensity=.55;
const stoneBump=detailTexture('stone'),plasterBump=detailTexture('plaster'),woodBump=detailTexture('wood'),tileBump=detailTexture('tile');
for(const t of[stoneBump,plasterBump,woodBump,tileBump]){t.colorSpace=THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping}
for(const m of[M.stone,M.curb]){m.bumpMap=stoneBump;m.bumpScale=.05;m.needsUpdate=true}
for(const m of[M.wood,M.darkWood]){m.bumpMap=woodBump;m.bumpScale=.04;m.needsUpdate=true}
M.road.color.set('#ffffff');M.road.map=textureNoise('#676369');M.road.map.wrapS=M.road.map.wrapT=THREE.RepeatWrapping;M.road.map.repeat.set(5,25);M.road.bumpMap=plasterBump;M.road.bumpScale=.022;M.road.needsUpdate=true;
M.soil.color.set('#ffffff');M.soil.map=textureNoise('#caa572');M.soil.bumpMap=stoneBump;M.soil.bumpScale=.035;M.soil.needsUpdate=true;
// Deterministic texture variation must not move seeded world objects or walking routes.
function surfaceTexture(kind){return texCanvas(512,512,(c,w,h)=>{
 c.fillStyle='#ddddda';c.fillRect(0,0,w,h);
 for(let i=0;i<6500;i++){const q=Math.sin(i*91.73+kind.length*17)*43758.5453,f=q-Math.floor(q),x=f*w,y=(i*137%509)/509*h;c.fillStyle=i%2?'#fff9ef10':'#302b2310';c.fillRect(x,y,kind==='cloth'?1:2,kind==='cloth'?5:2);}
 if(kind==='cloth'){c.strokeStyle='#4e4a4017';c.lineWidth=.6;for(let i=0;i<w;i+=4){c.beginPath();c.moveTo(i,0);c.lineTo(i,h);c.moveTo(0,i);c.lineTo(w,i);c.stroke();}}
 if(kind==='plaster'){for(let i=0;i<45;i++){const x=(i*107%503),y=(i*181%509),s=20+(i%9)*7;c.fillStyle='#746b5910';c.fillRect(x,y,s,s*.65);}const damp=c.createLinearGradient(0,h*.72,0,h);damp.addColorStop(0,'#4f4a3d00');damp.addColorStop(1,'#4f4a3d55');c.fillStyle=damp;c.fillRect(0,h*.72,w,h*.28);}
 });}
const plasterAlbedo=surfaceTexture('plaster'),clothAlbedo=surfaceTexture('cloth'),skinAlbedo=surfaceTexture('skin');
const clothBump=detailTexture('cloth');clothBump.colorSpace=THREE.NoColorSpace;
M.glass=new THREE.MeshPhysicalMaterial({color:'#bbc5c5',roughness:.13,metalness:0,clearcoat:1,clearcoatRoughness:.08,envMapIntensity:1.2});
M.glass.map=texCanvas(512,512,(c,w,h)=>{const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#92a5ad');sky.addColorStop(.48,'#67777a');sky.addColorStop(.52,'#3a4744');sky.addColorStop(1,'#1d2424');c.fillStyle=sky;c.fillRect(0,0,w,h);c.fillStyle='#d2d9d018';c.beginPath();c.moveTo(w*.18,0);c.lineTo(w*.28,0);c.lineTo(w*.8,h);c.lineTo(w*.7,h);c.fill();});
M.rubber.roughness=.96;M.rubber.bumpMap=stoneBump;M.rubber.bumpScale=.002;
M.cream.color.set('#d9cfaf');M.yellow.color.set('#d5a52f');
M.red=new THREE.MeshPhysicalMaterial({color:'#8f3c32',roughness:.48,metalness:.08,clearcoat:.3,clearcoatRoughness:.27});
M.red.bumpMap=plasterBump;M.red.bumpScale=.0008;
M.grass.map=textureNoise('#697a4e');M.grass.color.set('#ffffff');M.grass.map.wrapS=M.grass.map.wrapT=THREE.RepeatWrapping;M.grass.map.repeat.set(30,30);M.grass.bumpMap=plasterBump;M.grass.bumpScale=.02;box(M.grass,0,-.5,0,110,1,110);
const roadX=z=>-18+24/(1+Math.exp(-(z-8)/2.5))+.5*Math.sin(z*.105);
function roadFrame(z,offset=0){const dx=(roadX(z+.05)-roadX(z-.05))/.1,angle=Math.atan2(dx,1);return {x:roadX(z)+Math.cos(angle)*offset,z:z-Math.sin(angle)*offset,angle}};
const canalX=z=>10+Math.sin(z*.10)*1.2+Math.max(z,0)*.4;
function ribbon(points,width,y,material){const verts=[],uv=[],indices=[];points.forEach((p,i)=>{const prev=points[Math.max(i-1,0)],next=points[Math.min(i+1,points.length-1)];const dx=next[0]-prev[0],dz=next[1]-prev[1],len=Math.hypot(dx,dz);const nx=dz/len,nz=-dx/len;verts.push(p[0]-nx*width/2,y,p[1]-nz*width/2,p[0]+nx*width/2,y,p[1]+nz*width/2);uv.push(0,i/5,1,i/5);if(i<points.length-1){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3)}});const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return mesh(g,material)}
const roadPoints=Array.from({length:197},(_,i)=>{const z=-52+i*.5;return[roadX(z),z]});
const paving=mat('#c2baa5');paving.bumpMap=stoneBump;paving.bumpScale=.04;
paving.map=texCanvas(256,256,(c,w,h)=>{c.fillStyle='#e4dcc7';c.fillRect(0,0,w,h);c.strokeStyle='#a49c88';c.lineWidth=2;for(let y=0;y<=h;y+=32){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();for(let x=(y%64?16:0);x<=w;x+=32){c.beginPath();c.moveTo(x,y);c.lineTo(x,y+32);c.stroke()}}});paving.map.wrapS=paving.map.wrapT=THREE.RepeatWrapping;paving.map.repeat.set(4,1);
ribbon(roadPoints,13.6,.018,paving);ribbon(roadPoints,10.2,.03,M.curb);ribbon(roadPoints,9.6,.045,M.road);
const canalPoints=Array.from({length:131},(_,i)=>{const z=-48+i*.75;return[canalX(z),z]});
ribbon(canalPoints,10.4,.03,mat('#739351'));
const waterTime={value:0},waterMaterial=new THREE.MeshPhysicalMaterial({color:'#456c63',roughness:.19,metalness:0,clearcoat:1,clearcoatRoughness:.14,envMapIntensity:1.35});
const waterBump=texCanvas(256,256,(c,w,h)=>{c.fillStyle='#808080';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=6){c.strokeStyle=y%12?'#bbbbbb':'#565656';c.lineWidth=2;c.beginPath();for(let x=0;x<=w;x+=4){const yy=y+Math.sin(x*.055+y*.14)*3;x?c.lineTo(x,yy):c.moveTo(x,yy)}c.stroke()}});
waterBump.colorSpace=THREE.NoColorSpace;waterBump.wrapS=waterBump.wrapT=THREE.RepeatWrapping;waterBump.repeat.set(4,10);waterMaterial.bumpMap=waterBump;waterMaterial.bumpScale=.045;
waterMaterial.onBeforeCompile=shader=>{shader.uniforms.uWaterTime=waterTime;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uWaterTime;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.y += sin(position.x * 4.0 + uWaterTime) * cos(position.z * 2.3 + uWaterTime * 0.6) * 0.012;')};
waterMaterial.customProgramCacheKey=()=> 'mud-water-wave-v1';
ribbon(canalPoints,9,.08,waterMaterial);
// Junction bends away from the market and onto the canal bridge.
const branchCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(roadX(4),0,4),new THREE.Vector3(3.4,0,2.3),new THREE.Vector3(6.2,0,-7),new THREE.Vector3(10,0,-10),new THREE.Vector3(16.2,0,-9.7),new THREE.Vector3(18.2,0,-14),new THREE.Vector3(26,0,-18.3),new THREE.Vector3(48,0,-23)]);
const bp=branchCurve.getPoints(240).map(p=>[p.x,p.z]);
const extensionLayout=createExtensionRoad(roadFrame);extraRoads.push(extensionLayout.points);
const branchDistance=(x,z)=>distanceToRoad(x,z,bp.map(([x,z])=>({x,z})));
// Trim the spur where it meets each carriageway: no layered asphalt or kerbs across a junction.
const townSamples=roadPoints.map(([x,z])=>({x,z}));
const edgePoint=(t,side)=>{const p=branchCurve.getPoint(t),v=branchCurve.getTangent(t),n=new THREE.Vector3(v.z,0,-v.x).normalize();return p.addScaledVector(n,side*1.775)};
const cuts=[-1,1].map(side=>{
 let start=0,end=1;
 // Clip each edge independently so angled junction corners do not double up asphalt.
 for(let i=1;i<=240;i++)if(distanceToRoad(edgePoint(i/240,side).x,edgePoint(i/240,side).z,townSamples)>=4.8){let lo=(i-1)/240,hi=i/240;for(let j=0;j<20;j++){const t=(lo+hi)/2,p=edgePoint(t,side);if(distanceToRoad(p.x,p.z,townSamples)<4.8)lo=t;else hi=t}start=hi;break;}
 for(let i=239;i>=0;i--){const p=edgePoint(i/240,side);if(distanceToRoad(p.x,p.z,extensionLayout.points)>=4.2){let lo=i/240,hi=(i+1)/240;for(let j=0;j<20;j++){const t=(lo+hi)/2,p=edgePoint(t,side);if(distanceToRoad(p.x,p.z,extensionLayout.points)<4.2)hi=t;else lo=t}end=lo;break;}}
 return {side,start,end};
});
const spurVertices=[],spurIndices=[],spurUV=[];
for(let i=0;i<=240;i++){for(const {side,start,end}of cuts){const p=edgePoint(THREE.MathUtils.lerp(start,end,i/240),side);spurVertices.push(p.x,.045,p.z);spurUV.push(side<0?0:1,i/24)}if(i<240){const j=i*2;spurIndices.push(j,j+2,j+1,j+1,j+2,j+3)}}
const spurGeometry=new THREE.BufferGeometry();spurGeometry.setAttribute('position',new THREE.Float32BufferAttribute(spurVertices,3));spurGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(spurUV,2));spurGeometry.setIndex(spurIndices);spurGeometry.computeVertexNormals();mesh(spurGeometry,M.road);
// Offset every roadside object along the road normal, not the world's X axis.
const roadDetails=[];
for(let z=-48;z<47;z+=1.1){const c=roadFrame(z);if(Math.round((z+48)/1.1)%2===0){box(M.line,c.x,.056,c.z,.13,.008,.82,null,c.angle);roadDetails.push({kind:'paint',x:c.x,z:c.z,angle:c.angle,sourceZ:z})}
 for(const side of[-1,1]){const p=roadFrame(z,side*4.97);if(branchDistance(p.x,p.z)<2.8)continue;box(Math.round((z+48)/1.1)%3?M.curb:mat('#b4ad9b'),p.x,.115,p.z,.27,.15,1.09*Math.hypot(1,(roadX(z+.05)-roadX(z-.05))/.1),null,p.angle);roadDetails.push({kind:'kerb',x:p.x,z:p.z,angle:p.angle,sourceZ:z,side})}}
// Sandy footpath and terraced paddy fields.
ribbon(canalPoints.map(([x,z])=>[x+7.3,z]),2,.045,M.soil);
for(let z=-40;z<39;z+=10){for(let dx=-7;dx<7;dx++)for(let dz=-4;dz<4;dz++){const x=canalX(z)+17+dx,zz=z+dz;if(roadClearance(x,zz)<.9)continue;box(mat('#789442'),x,.03,zz,1,.1,1)}for(let dx=-8;dx<8;dx++){const x=canalX(z+4.5)+17+dx;if(roadClearance(x,z+4.5)>1)box(M.soil,x,.14,z+4.5,1,.14,.55)}}
// Curved rice tufts contain several separate blades instead of scattered cones.
const riceVertices=[],riceIndices=[];
for(let blade=0;blade<3;blade++){const a=blade*Math.PI*2/3,start=riceVertices.length/3;for(let row=0;row<=5;row++){const t=row/5,bend=t*t*.16,w=Math.sin((t*.92+.04)*Math.PI)*.035;for(const side of[-1,1])riceVertices.push(Math.cos(a)*bend+Math.sin(a)*w*side,t,Math.sin(a)*bend-Math.cos(a)*w*side);if(row<5){const k=start+row*2;riceIndices.push(k,k+2,k+1,k+1,k+2,k+3)}}}
// Drooping grain panicles distinguish rice from lawn grass.
for(let stem=0;stem<2;stem++){
 const a=stem*2.1,x=Math.cos(a)*.07,z=Math.sin(a)*.07;
 for(let k=0;k<7;k++){
  const t=k/6,y=.76+t*.37-t*t*.12,px=x+t*.15,pz=z+t*.09;
  const start=riceVertices.length/3;
  riceVertices.push(px-.006,y-.035,pz,px+.006,y-.035,pz,px-.006,y+.035,pz,px+.006,y+.035,pz);
  riceIndices.push(start,start+2,start+1,start+1,start+2,start+3);
  for(const side of[-1,1]){const n=riceVertices.length/3;riceVertices.push(px,y,pz,px+side*.035,y+.018,pz+.012,px+side*.055,y-.015,pz+.012,px+side*.02,y-.03,pz);riceIndices.push(n,n+1,n+2,n,n+2,n+3);}
 }
}
const riceGeometry=new THREE.BufferGeometry();riceGeometry.setAttribute('position',new THREE.Float32BufferAttribute(riceVertices,3));riceGeometry.setIndex(riceIndices);riceGeometry.computeVertexNormals();
const riceMaterials=['#71844c','#8b9653','#596f3e'].map(c=>{const m=mat(c);m.side=THREE.DoubleSide;return m});
for(let row=0;row<188;row++)for(let col=0;col<36;col++){const z=-39.5+row*.42+rand(-.035,.035),x=canalX(z)+10.3+col*.38+(row%2)*.18+rand(-.04,.04);if(Math.abs((z+40)%10-4.5)<.65||Math.abs(z+6)<1.7||roadClearance(x,z)<.65)continue;put(riceGeometry,riceMaterials[(row+col)%3],[x,.19,z],[rand(.8,1.05),rand(.6,.9),1],[0,random()*6.28,0]);}
// Stone canal walls: varied individual blocks with coping stones.
for(let z=-47;z<46;z+=.95){for(const s of[-1,1]){const x=canalX(z)+s*5.0;for(let row=0;row<3;row++)box([M.stone,mat('#949484'),mat('#6b7267')][Math.floor(random()*3)],x, row*.36-.24,z+(row%2)*.25,.62,.35,.92,null,rand(-.04,.04));box(mat('#b6b298'),x,.72,z,.76,.19,.99);}}
const rippleMat=new THREE.MeshStandardMaterial({color:'#9de5c2',transparent:true,opacity:.3,roughness:.32});
const rippleGeometry=new THREE.RingGeometry(.8,1,32,1,0,Math.PI*1.5);
for(let i=0;i<155;i++){const z=rand(-47,44),x=canalX(z)+rand(-3.4,3.4);put(rippleGeometry,rippleMat,[x,.11,z],[rand(.10,.30),rand(.03,.12),1],[-Math.PI/2,0,rand(-.4,.4)])}
const waterLeaf=new THREE.CircleGeometry(1,32,.18,Math.PI*2-.36);waterLeaf.rotateX(-Math.PI/2);
for(let i=0;i<76;i++){const z=rand(-38,38);put(waterLeaf,mat(i%3?'#627d46':'#7f8e50'),[canalX(z)+rand(-2.7,2.7),.11,z],[rand(.10,.27),1,rand(.1,.23)]);}
// Footbridge with masonry piers, crossbeams, bollards and continuous rails.
box(M.stone,10.3,.66,-10,11.4,.66,3.3);box(mat('#bab6a3'),10.3,1.05,-10,11.8,.2,3.5);
for(const x of[7.5,13.6]){box(M.stone,x,-.08,-10,1.15,1.5,3.1);box(mat('#999b88'),x,-.6,-10,1.6,.4,3.5)}
for(let x=4.6;x<=16.1;x+=1.45){for(const z of[-11.65,-8.35]){box(mat('#c6c2aa'),x,1.62,z,.24,1.18,.28);box(M.white,x,2.22,z,.33,.13,.37)}}
for(const z of[-11.65,-8.35]){box(mat('#c7c5b6'),10.3,2.05,z,11.8,.15,.15);box(mat('#909a91'),10.3,1.55,z,11.8,.09,.12)}
for(const [a,b]of [[[2,.075,-4.5],[4.6,1.15,-9.7]],[[16.2,1.15,-9.7],[18.2,.075,-14]]]){
 const direction=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),normal=new THREE.Vector3(direction.z,0,-direction.x).normalize().multiplyScalar(1.55),vertices=[];
 for(const p of[a,b])for(const side of[-1,1])vertices.push(p[0]+normal.x*side,p[1],p[2]+normal.z*side);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex([0,2,1,1,2,3]);geometry.computeVertexNormals();mesh(geometry,M.curb);
}
// Exposed stone courses and deck joints replace featureless bridge faces.
for(const zz of[-11.667,-8.333])for(let row=0;row<2;row++)for(let i=0;i<13;i++)box(i%3?mat('#90978b'):M.stone,4.9+i*.86+(row%2)*.12,.47+row*.29,zz,.82,.26,.045);
for(const xx of[7.5,13.6])for(let row=0;row<4;row++)for(const zz of[-11.57,-8.43])box(row%2?mat('#8d9284'):M.stone,xx,-.57+row*.34,zz,1.11,.3,.08);
for(let xx=5.1;xx<16;xx+=2.4)box(mat('#8f958b'),xx,1.156,-10,.025,.01,3.32);
// Weathered wood fencing on both banks and field boundaries.
function fence(points){points.forEach((p,i)=>{if(roadClearance(p[0],p[1])<.6)return;cyl(M.wood,p[0],1.12,p[1],.095,1.5);ell(M.wood,p[0],1.89,p[1],.13,.07,.13);if(i&&roadClearance(points[i-1][0],points[i-1][1])>.6&&roadClearance((points[i-1][0]+p[0])/2,(points[i-1][1]+p[1])/2)>.6){for(const y of[1.05,1.6])bar(M.wood,[points[i-1][0],y,points[i-1][1]],[p[0],y,p[1]],.045)}})}
for(const s of[-1,1]){for(const range of[[-45,-13],[-6,42]]){const pts=[];for(let z=range[0];z<=range[1];z+=1.8)pts.push([canalX(z)+s*6,z]);fence(pts)}}
for(let z=-38;z<40;z+=10)fence([10,14,18,22,26].map(dx=>[canalX(z)+dx,z]));
// Hip roofs have actual rounded terracotta tiles along all four faces.
const tileGeo=new THREE.CylinderGeometry(.105,.105,1,12,1,false,0,Math.PI);
const roofMats=['#78503d','#8f5840','#9f6349','#80513e','#a36d51'].map(c=>{const m=mat(c);m.map=plasterAlbedo;m.bumpMap=tileBump;m.bumpScale=.012;return m});
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
function building(x,z,w,d,h,color,shop=false){reservePlot('building',x,z,w+.85,d+.85);const wall=mat(color);wall.map=plasterAlbedo;wall.bumpMap=plasterBump;wall.bumpScale=.025;box(wall,x,h/2+.2,z,w,h,d);box(mat('#c4ba92'),x,.23,z,w+.18,.42,d+.18);box(mat('#efe1b1'),x,h-.15,z+d/2+.04,w,.16,.10);roof(x,z,w+.85,d+.85,h+.18,Math.min(d*.4,2.3));
 if(!shop){windowAt(x-w*.28,h*.6,z+d/2+.03,.9,1.25);windowAt(x+w*.28,h*.6,z+d/2+.03,.9,1.25);box(M.wood,x,1.17,z+d/2+.055,.96,2,.12);box(M.black,x,1.17,z+d/2+.13,.78,1.85,.03);box(M.curb,x,.2,z+d/2+.45,1.6,.25,.65);ell(M.yellow,x+.26,1.1,z+d/2+.19,.04,.04,.04);
 for(const y of[.65,1.4])box(M.wood,x,y,z+d/2+.15,.64,.47,.025);
 }
 // Deep eaves, gutter joints and side windows remain readable from a driving camera.
 for(const side of[-1,1]){
  bar(mat('#5f6861'),[x-w/2,h-.05,z+side*(d/2+.46)],[x+w/2,h-.05,z+side*(d/2+.46)],.05);
  bar(mat('#5f6861'),[x+w/2-.18,.24,z+side*(d/2+.46)],[x+w/2-.18,h-.05,z+side*(d/2+.46)],.04);
 }
 box(M.wood,x+w/2+.06,h*.6,z, .12,1.46,1.3);
 box(M.glass,x+w/2+.13,h*.6,z, .026,1.27,1.1);
 box(M.wood,x+w/2+.16,h*.6,z, .035,1.28,.055);
 box(M.cream,x+w/2+.15,h*.6-.78,z,.28,.12,1.54);
 if(shop){
  box(M.darkWood,x,1.1,z+d/2+.18,w*.76,1.4,.13);
  for(let xx=-w*.32;xx<w*.33;xx+=.62)box(M.wood,x+xx,1.08,z+d/2+.265,.055,1.32,.035);
  box(M.wood,x,1.85,z+d/2+.4,w*.81,.13,.64);
  for(let i=0;i<5;i++){cyl(M.chrome,x-w*.25+i*.22,2.01,z+d/2+.43,.052,.18);}
  cyl(M.chrome,x+w*.22,2.12,z+d/2+.36,.16,.38);
  ell(M.chrome,x+w*.22,2.32,z+d/2+.36,.17,.035,.17);
 }
 return{x,z,w,d,h}}
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
building(17.5,-22,6.5,5.6,3.1,'#f6d17c');building(-26,-10,6,5,3.8,'#e8c871');
building(-19,10,7,6,3.8,'#e9bb54',true);building(-17,26,6.5,5.5,3.8,'#e7c579');
building(-28,-38,7,5.5,3.8,'#e8d9b2');building(1,-39,6,5,4,'#f4d998');building(24,30,6,5,3.3,'#efc978');
addSign('KERALA\nSPICES',-19,2.65,13.12,4.6,1.5,'#6e4e2d','#fff0c7',64);
box(M.wood,-19,1,13.1,6.5,1.6,.15);
for(let i=0;i<14;i++){box(i%2?M.cream:mat('#3d8292'),-22.2+i*.48,2.45,13.7,.48,.10,1.45)}
function billboard(x,z,text){reservePlot('sign',x,z,3,1);box(mat('#d4ccb4'),x,2.5,z,2.6,4.9,.55);box(mat('#b2ac97'),x,5,z,2.9,.2,.75);addSign(text,x,3,z+.295,2.35,3.55,'#d0c9b6','#334339',52);box(M.stone,x,.22,z,3,.44,1);}
billboard(2.6,-11.6,'GOOD\nFOOD\nHAPPIER\nPEOPLE');billboard(15.7,10,'GOOD\nFOOD\nBRIGHTER');
// Traffic direction sign, stalls, baskets, tables and diners.
for(const x of[-25.1,-21.9])cyl(mat('#82877d'),x,1.8,1.1,.07,3.6);
reservePlot('sign',-23.5,1.17,3.9,.5);
addSign('Ernakulam  ↑\nKakkanad  →\nInfopark  →',-23.5,3.1,1.17,3.9,2.5,'#246b61','#e3f4df',43);
function pot(x,z,size=.38){reservePlot('pot',x,z,size*1.5,size*1.5);put(new THREE.CylinderGeometry(.7,1,1,20),mat('#b96d38'),[x,size*.52,z],[size,size,size]);cyl(mat('#695139'),x,size*1.03,z,size*.65,.035);for(let i=0;i<8;i++){const a=i*Math.PI/4;ell([M.green,M.leaf][i%2],x+Math.cos(a)*size*.35,size*1.5+rand(0,.2),z+Math.sin(a)*size*.35,size*.32,size*.45,size*.15)}}
function crate(x,z,w=1){
 reservePlot('crate',x,z,w,.8);
 box(M.darkWood,x,.07,z,w,.1,.72);
 for(const side of[-1,1]){
  for(let y=.17;y<.6;y+=.145){box(M.wood,x,y,z+side*.36,w,.09,.055);box(M.wood,x+side*w*.5,y,z,.055,.09,.72);}
  for(const dx of[-w*.46,w*.46])box(M.darkWood,x+dx,.32,z+side*.31,.065,.6,.065);
 }
 for(let i=0;i<14;i++)ell(i%3?M.yellow:mat('#e68524'),x+rand(-w*.4,w*.4),.4+rand(0,.14),z+rand(-.25,.25),.1,.1,.08);
}
for(const [x,z]of[[-13,-.5],[-5.5,-.5],[-2.3,-1.5],[2,-2.4],[18.3,-19.3],[23.5,-18.8],[-23,14.8],[-16,14],[4,-5]])pot(x,z,.38);
for(const [x,z]of[[-5.3,-3.2],[2.8,-3.1],[-22,14],[-20.7,14],[-17,14.6]])crate(x,z);
function chair(x,z,rot=0){
 reservePlot('chair',x,z,.55,.6);
 const g=new THREE.Group();g.position.set(x,authoringHeight,z);g.rotation.y=rot;scene.add(g);
 for(let i=0;i<4;i++)box(M.wood,0,.53,-.18+i*.12,.5,.085,.1,g);
 for(const xx of[-.19,.19]){for(const zz of[-.19,.19])box(M.darkWood,xx,.26,zz,.055,.53,.055,g);box(M.wood,xx,.88,-.22,.055,.78,.055,g);bar(M.darkWood,[xx,.19,-.18],[xx,.19,.18],.018,g);}
 for(const xx of[-.12,0,.12])box(M.wood,xx,.95,-.22,.055,.44,.045,g);
 box(M.wood,0,1.2,-.22,.49,.065,.06,g);
}
function table(x,z){reservePlot('table',x,z,1.4,.8);box(mat('#9c6128'),x,.92,z,1.4,.12,.8);for(const xx of[-.56,.56])for(const zz of[-.27,.27])box(M.darkWood,x+xx,.45,z+zz,.08,.9,.08);for(const xx of[-.38,.36]){cyl(M.white,x+xx,1.01,z,.16,.028);ell(M.yellow,x+xx,1.05,z,.10,.04,.08);cyl(mat('#e9d9a7'),x+xx+.21,1.12,z-.12,.05,.18)}}
for(const [x,z]of[[-8.7,-3.45],[-6.4,-3.45],[.4,-1.55]]){table(x,z);chair(x-.6,z+.6);chair(x+.6,z+.6)}
// Anatomical surfaces share smooth geometry; joints bend without cylindrical stick limbs.
function bodySurface(rings){
 const vertices=[],indices=[],uv=[],segments=40;
 const profile=new THREE.CatmullRomCurve3(rings.map(([y,rx,rz])=>new THREE.Vector3(rx,y,rz)),false,'centripetal');
 rings=profile.getPoints(Math.max(32,rings.length*5)).map(p=>[p.y,p.x,p.z]);
 for(const [y,rx,rz,shift=0] of rings)for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2;vertices.push(Math.sin(a)*rx,y,Math.cos(a)*rz+shift);uv.push(i/segments,(y-rings[0][0])/(rings.at(-1)[0]-rings[0][0]));}
 for(let row=0;row<rings.length-1;row++)for(let i=0;i<segments;i++){const k=row*(segments+1)+i;indices.push(k,k+1,k+segments+1,k+1,k+segments+2,k+segments+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
const shirtGeometry=bodySurface([[0,.165,.115],[.07,.165,.12],[.19,.173,.13],[.33,.195,.135],[.44,.205,.115],[.49,.15,.1],[.53,.063,.07],[.54,.06,.065]]);
// Small fitted folds break up the smooth mannequin surface without changing anatomy.
for(let i=0;i<shirtGeometry.attributes.position.count;i++){const p=shirtGeometry.attributes.position,x=p.getX(i),y=p.getY(i),z=p.getZ(i),fold=.0018*Math.sin(y*67+x*31)*Math.sin(Math.PI*y/.54)**2;p.setXYZ(i,x+fold*Math.sign(x),y,z+fold*Math.sign(z));}shirtGeometry.computeVertexNormals();
const limbGeometry=bodySurface([[0,.58,.6],[.09,.75,.72],[.25,1, .86],[.48,.88,.82],[.7,.75,.73],[.9,.58,.6],[1,.54,.55]]);
const headGeometry=new THREE.SphereGeometry(1,48,40);
for(let i=0;i<headGeometry.attributes.position.count;i++){
 const v=headGeometry.attributes.position,x=v.getX(i),y=v.getY(i),z=v.getZ(i),jaw=y<-.15?1+(y+.15)*.32:1;
 const nose=z>0?.022*Math.exp(-x*x/ .026-(y+.13)**2/.09):0;
 const cheek=z>0?.008*Math.exp(-((Math.abs(x)-.48)**2)/.06-(y+.12)**2/.16):0;
 v.setXYZ(i,x*.096*jaw,y*.119,z*.103+nose+cheek);
}headGeometry.computeVertexNormals();
const hairGeometry=new THREE.BufferGeometry(),hairVertices=[],hairIndices=[];
for(let row=0;row<=24;row++)for(let col=0;col<=48;col++){
 const a=col/48*Math.PI*2,p=row/24*(1.5-.6*Math.cos(a)),wave=.027*Math.sin(a*5+p*9)*Math.sin(p);
 hairVertices.push(Math.sin(p)*Math.sin(a)*(1+wave),Math.cos(p)+wave,Math.sin(p)*Math.cos(a));
 if(row<24&&col<48){const j=row*49+col;hairIndices.push(j,j+49,j+1,j+1,j+49,j+50)}
}hairGeometry.setAttribute('position',new THREE.Float32BufferAttribute(hairVertices,3));hairGeometry.setIndex(hairIndices);hairGeometry.computeVertexNormals();
function limb(parent,material,a,b,radius){
 const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av);
 const e=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize()));
 return put(limbGeometry,material,a,[radius,delta.length(),radius],[e.x,e.y,e.z],parent);
}
function organicLimb(parent,material,points,radii){
 const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal');
 const g=new THREE.TubeGeometry(curve,24,1,24,false),position=g.attributes.position;
 for(let row=0;row<=24;row++){const t=row/24,center=curve.getPointAt(t),index=t*(radii.length-1),lo=Math.floor(index),radius=THREE.MathUtils.lerp(radii[lo],radii[Math.min(lo+1,radii.length-1)],index-lo);
  for(let col=0;col<=24;col++){const i=row*25+col;position.setXYZ(i,center.x+(position.getX(i)-center.x)*radius,center.y+(position.getY(i)-center.y)*radius,center.z+(position.getZ(i)-center.z)*radius);}
 }
 g.computeVertexNormals();return put(g,material,[0,0,0],[1,1,1],[0,0,0],parent);
}
const trouserHipGeometry=bodySurface([[-.1,.145,.11],[-.04,.16,.117],[.025,.163,.118],[.06,.16,.114]]);
function hand(parent,skin,p,grip=false){
 ell(skin,...p,.034,.053,.024,parent);
 for(let finger=0;finger<4;finger++){const xx=p[0]-.023+finger*.014,len=finger===0||finger===3?.036:.046;
 limb(parent,skin,[xx,p[1]-.029,p[2]],[xx,p[1]-.029-len,p[2]+(grip?.024:.008)],.009);
 }
 const thumbSide=p[0]<0?1:-1;limb(parent,skin,[p[0]+thumbSide*.032,p[1]+.012,p[2]],[p[0]+thumbSide*.047,p[1]-.022,p[2]+.022],.012);
}
function face(parent,skin,headY,variant){
 put(headGeometry,skin,[0,headY,0],[1,1,1],[0,0,0],parent);
 const hair=mat(variant%3?'#24201c':'#373029',.88);hair.bumpMap=woodBump;hair.bumpScale=.0014;
 put(hairGeometry,hair,[0,headY+.022,-.008],[.099,.108,.106],[0,0,.07],parent);
 for(let lock=0;lock<12;lock++){const a=lock/12*Math.PI*2,points=[];for(let row=0;row<6;row++){const p=.12+row*.17,az=a+row*.07;points.push([Math.sin(p)*Math.sin(az)*.10,headY+.022+Math.cos(p)*.109,-.008+Math.sin(p)*Math.cos(az)*.107]);}organicLimb(parent,hair,points,[.0014,.002,.0012]);}
 // Swept locks and sideburns follow the scalp, rather than forming a helmet.
 for(const side of[-1,1]){
  ell(skin,side*.095,headY-.008,-.006,.016,.031,.017,parent);
  ell(mat('#85543e'),side*.103,headY-.008,.006,.005,.015,.004,parent);
  ell(skin,side*.038,headY+.021,.094,.024,.012,.009,parent);
  ell(mat('#8b8372'),side*.038,headY+.022,.102,.012,.003,.002,parent);
  ell(mat('#352b23'),side*.038,headY+.022,.104,.004,.003,.0015,parent);
  bar(hair,[side*.023,headY+.04,.098],[side*.06,headY+.038,.089],.004,parent);
  bar(hair,[side*.089,headY+.049,.018],[side*.087,headY+.008,.02],.009,parent);
 }
 bar(mat('#754d40'),[-.022,headY-.06,.092],[.022,headY-.06,.092],.003,parent);
 if(variant%2===0)for(const side of[-1,1])bar(hair,[side*.003,headY-.043,.106],[side*.025,headY-.047,.098],.005,parent);
}
let personVariant=0;
function personPose(parent,shirt,seated,variant){
 const g=new THREE.Group();parent.add(g);
 const skin=mat(['#a57451','#946344','#b5825c'][variant%3],.73),cloth=mat(shirt,.94),pants=mat(['#34383c','#48443e','#304350'][variant%3],.96);skin.map=skinAlbedo;skin.bumpMap=plasterBump;skin.bumpScale=.00045;for(const fabric of[cloth,pants]){fabric.map=clothAlbedo;fabric.bumpMap=clothBump;fabric.bumpScale=.0012;}
 const hipY=seated?.62:.91,shoulderY=hipY+.47,headY=shoulderY+.25;
 const torso=new THREE.Group();g.add(torso);
 put(shirtGeometry,cloth,[0,hipY,0],[1,1,1],[0,0,0],torso);
 put(trouserHipGeometry,pants,[0,hipY-.025,0],[1,1,1],[0,0,0],torso);cyl(skin,0,shoulderY+.095,0,.052,.12,torso);
 const head=new THREE.Group();head.position.y=headY;torso.add(head);face(head,skin,0,variant);
 for(const side of[-1,1]){
  const collar=new THREE.BufferGeometry();collar.setAttribute('position',new THREE.Float32BufferAttribute([side*.027,hipY+.53,.072,side*.10,hipY+.49,.104,side*.052,hipY+.44,.143],3));collar.setIndex(side<0?[0,1,2]:[0,2,1]);collar.computeVertexNormals();const collarMat=cloth.clone();collarMat.color.multiplyScalar(1.10);collarMat.side=THREE.DoubleSide;put(collar,collarMat,[0,0,0],[1,1,1],[0,0,0],torso);
 }
 box(cloth,0,hipY+.25,.137,.033,.43,.012,torso);
 for(let y=hipY+.1;y<hipY+.46;y+=.085)ell(M.cream,0,y,.147,.007,.007,.004,torso);
 box(cloth,-.105,hipY+.355,.142,.08,.082,.009,torso);
 const legs=[],knees=[],arms=[],elbows=[];
 const local=(point,origin)=>point.map((v,i)=>v-origin[i]);
 function pivot(parent,point){const part=new THREE.Group();part.position.set(...point);parent.add(part);return part;}
 for(const side of[-1,1]){
  const hip=[side*.094,hipY-.02,0],knee=[side*.102,seated?.58:.48,seated?.3:0],ankle=[side*.104,.12,seated?.32:.025];
  const leg=pivot(g,hip),shin=pivot(leg,local(knee,hip));legs.push(leg);knees.push(shin);
  organicLimb(leg,pants,[[0,0,0],local(knee,hip)],[.084,.083,.065]);
  organicLimb(shin,pants,[[0,0,0],local(ankle,knee)],[.068,.06,.035]);ell(pants,0,0,0,.068,.066,.068,shin);
  const shoe=local(ankle,knee);ell(M.darkWood,shoe[0],shoe[1]-.06,shoe[2]+.05,.065,.018,.12,shin);
  ell(skin,shoe[0],shoe[1]-.032,shoe[2]+.06,.05,.026,.097,shin);
  bar(M.darkWood,[shoe[0]-.047,shoe[1]-.017,shoe[2]+.09],[shoe[0]+.047,shoe[1]-.017,shoe[2]+.045],.012,shin);
  const shoulder=[side*.177,shoulderY-.025,0],elbow=[side*.24,shoulderY-(seated?.22:.31),seated?.15:.025],palm=[side*.22,seated?.98:hipY-.16,seated?.38:.04];
  const arm=pivot(torso,shoulder),forearm=pivot(arm,local(elbow,shoulder));arms.push(arm);elbows.push(forearm);
  organicLimb(arm,skin,[[0,0,0],local(elbow,shoulder)],[.049,.049,.043]);
  organicLimb(forearm,skin,[[0,0,0],local(palm,elbow)],[.043,.038,.029]);ell(skin,0,0,0,.043,.042,.043,forearm);
  const sleeveEnd=new THREE.Vector3(...elbow).sub(new THREE.Vector3(...shoulder)).multiplyScalar(.6).toArray();
  ell(cloth,0,-.018,0,.072,.064,.075,arm);organicLimb(arm,cloth,[[0,0,0],sleeveEnd],[.071,.069,.060]);hand(forearm,skin,local(palm,elbow),seated);
 }
 const restY=seated?0:-.042;g.position.y=restY;return {g,torso,head,legs,knees,arms,elbows,restY};
}
function person(x,z,shirt='#318ca1',seated=false,parent=scene){
 const variant=personVariant++,g=new THREE.Group();g.position.set(x,parent===scene?authoringHeight:0,z);
 g.userData={assetType:'customer',designVersion:4,seated,pose:seated?'dining':'standing'};parent.add(g);
 if(seated)g.rotation.y=Math.PI;
 const standing=personPose(g,shirt,false,variant),sitting=seated?personPose(g,shirt,true,variant):null;
 standing.g.visible=!seated;
 if(parent===scene)npcs.push({g,standing,sitting,variant,home:g.position.clone(),homeAngle:g.rotation.y});
 return g;
}
person(-11.3,-4.1);person(-8.1,-2.9,'#d7ac43',true);person(-5.85,-2.9,'#6874ba',true);person(-.2,-.95,'#e5b22c',true);person(1,-.95,'#e6e6db',true);person(18.3,-17.8,'#e4e9dc');person(-19.4,14.2,'#8baa40');
// Power lines and roadside lamps.
function wire(a,b){const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(...a),new THREE.Vector3((a[0]+b[0])/2,(a[1]+b[1])/2-.5,(a[2]+b[2])/2),new THREE.Vector3(...b)]);mesh(new THREE.TubeGeometry(curve,24,.022,6,false),mat('#484940'))}
for(let station=-32;station<33;station+=11){const p=roadFrame(station,6.3),next=roadFrame(station+11,6.3),x=p.x,z=p.z;reservePlot('pole',x,z,.3,.3);cyl(mat('#656965'),x,3.5,z,.12,7);box(M.wood,x,6.3,z,1.3,.10,.15);for(const d of[-.5,.5]){cyl(M.black,x+d,6.45,z,.035,.4);for(const y of[6.36,6.44,6.52])cyl(M.white,x+d,y,z,.085,.045);if(z<22)wire([x+d,6.6,z],[next.x+d,6.6,next.z])}}
for(let station=-30;station<32;station+=12){const p=roadFrame(station,-6.3),x=p.x,z=p.z;reservePlot('pole',x,z,.2,.2);cyl(M.black,x,2.5,z,.065,5);bar(M.black,[x,4.9,z],[x+.7,5.2,z],.04);box(M.black,x+.8,5.17,z,.4,.12,.22);box(mat('#ffffbc'),x+.8,5.1,z,.3,.02,.17)}
// Smooth bent tropical leaves, with a central vein and fine leaflets for the palms.
const leaves=[];
function leafGeometry(length,width,droop=0,torn=false){const v=[],idx=[],uv=[];for(let i=0;i<=18;i++){const t=i/18,w=Math.sin(t*Math.PI)**.7*width;const y=Math.sin(t*Math.PI)*length*.21-t*t*droop;for(const s of[-1,0,1]){v.push(s*w*(torn&&s!==0&&i>3&&i%4===0?.64:1),y+(s===0?.055:0),t*length);uv.push((s+1)/2,t)}if(i<18){const k=i*3;idx.push(k,k+3,k+1,k+1,k+3,k+4,k+1,k+4,k+2,k+2,k+4,k+5)}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g}
const windTime={value:0},windStrength={value:1};
function windShader(shader,rice=false){
 shader.uniforms.uWindTime=windTime;shader.uniforms.uWindStrength=windStrength;
 shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uWindTime;\nuniform float uWindStrength;').replace('#include <begin_vertex>',`#include <begin_vertex>
 vec4 windWorld=vec4(position,1.0);
 #ifdef USE_INSTANCING
 windWorld=instanceMatrix*windWorld;
 #endif
 windWorld=modelMatrix*windWorld;
 float tip=${rice?'clamp(position.y,0.0,1.0)':'clamp(position.z*0.4,0.0,1.0)'};
 float gust=sin(uWindTime*1.8+windWorld.x*0.17+windWorld.z*0.12)+0.35*sin(uWindTime*3.1+windWorld.z*0.4);
 transformed.x+=gust*tip*tip*${rice?'0.075':'0.13'}*uWindStrength;
 transformed.z+=cos(uWindTime*1.4+windWorld.x*0.21)*tip*${rice?'0.035':'0.055'}*uWindStrength;`);
}
function addWind(m,rice=false){m.onBeforeCompile=shader=>windShader(shader,rice);m.customProgramCacheKey=()=>rice?'rice-wind-v1':'leaf-wind-v1';const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});depth.onBeforeCompile=shader=>windShader(shader,rice);depth.customProgramCacheKey=m.customProgramCacheKey;m.userData.windDepth=depth;}
for(const m of riceMaterials)addWind(m,true);
const leafMaterials=['#4d693a','#617c43','#7d8b4b','#405d36'].map(c=>{const m=mat(c);m.side=THREE.DoubleSide;m.map=detailTexture('leaf');m.roughness=.82;addWind(m);m.needsUpdate=true;return m});
const palmRing=new THREE.TorusGeometry(1,.065,8,16);
const palmLeaf=leafGeometry(4.3,.025,1.8),palmLeaflet=leafGeometry(1,.055,.28),bananaLeaf=leafGeometry(2.8,.50,1.05,true);
function treeClearance(x,z,radius=1.7){return plantAllowed(x,z,radius)}
function palm(x,z,h=8){
 if(!treeClearance(x,z,2.2))return;recordPlant('palm',x,z,2.2);
 const sway=rand(-.7,.7),trunk=mat('#8b7753');trunk.bumpMap=woodBump;trunk.bumpScale=.018;
 for(let i=0;i<24;i++){const t=i/24,next=(i+1)/24;bar(trunk,[x+sway*t*t,h*t,z],[x+sway*next*next,h*next,z],.19-.07*t);put(palmRing,mat('#67573f'),[x+sway*t*t,h*t,z],[.19-.07*t,.19-.07*t,.19-.07*t],[Math.PI/2,0,0]);}
 const cx=x+sway;
 for(let i=0;i<12;i++){
  const a=i*6.283/12+rand(-.11,.11),length=rand(3.4,4.5),lift=i<4?.38:.05;
  put(palmLeaf,leafMaterials[i%4],[cx,h,z],[1,1,length/4.3],[lift,a,0]);
  for(let j=1;j<24;j++){
   const t=j/25,dist=t*length,py=h+Math.sin(t*Math.PI)*.8-t*t*1.8;
   const pos=[cx+Math.sin(a)*dist,py,z+Math.cos(a)*dist];
   for(const side of[-1,1]){
    const len=Math.sin(t*Math.PI)**.6*.85;
    const delta=new THREE.Vector3(Math.cos(a)*side*len+Math.sin(a)*.22,-.12-len*.2,-Math.sin(a)*side*len+Math.cos(a)*.22);
    const e=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),delta.clone().normalize()));
    put(palmLeaflet,leafMaterials[(i+j)%4],pos,[1,1,delta.length()],[e.x,e.y,e.z]);
   }
  }
 }
 for(let i=0;i<7;i++){const a=i*2.4;ell(mat('#758335'),cx+Math.sin(a)*.25,h-.22-(i%2)*.1,z+Math.cos(a)*.25,.15,.19,.15);}
}
function banana(x,z,s=1){
 if(!treeClearance(x,z,1.7*s))return;recordPlant('banana',x,z,1.7*s);
 for(let i=0;i<3;i++){bar(mat(i%2?'#91aa45':'#6a873d'),[x+i*.06,0,z],[x+i*.035,2.5*s,z],.105*s);}
 for(let i=0;i<8;i++){const a=i*2.4,t=i/7,level=(2.1+t*.7)*s;put(bananaLeaf,leafMaterials[i%4],[x,level,z],[s*(.7+t*.25),s,s*(.68+t*.22)],[.32-t*.5,a,0]);bar(mat('#7b973c'),[x,level,z],[x+Math.sin(a)*.8*s,level+.12,z+Math.cos(a)*.8*s],.03*s);}
}
for(const [x,z,h]of[[-15,-15,9],[-3,-16,8.5],[6,-22,8],[15,-29,9],[16,-2,8],[8,10,7.7],[16,26,9],[-15,4,8],[-22,19,8],[25,-29,9],[-1,25,8],[-23,-28,8],[9,-38,9],[-6,-34,8]])palm(x,z,h);
for(const [x,z,s]of[[4,-8,1.2],[3,-15,1.3],[6,4,1.2],[15,12,1.25],[19,20,1.2],[-13,7,1.3],[-21,3,1.1],[-12,24,1.3],[21,-16,1],[23,-32,1.2],[5,23,1.4],[-2,-28,1],[17,-35,1.2]])banana(x,z,s);
const shrubLeaf=leafGeometry(.52,.13,.12),shrubCore=new THREE.SphereGeometry(1,12,8);
function shrub(x,z,s=.7){if(!plantAllowed(x,z,s*.55))return;recordPlant('shrub',x,z,s*.55);for(let i=0;i<22;i++){const a=i*2.4;put(shrubLeaf,leafMaterials[i%4],[x+Math.sin(a)*s*.38,.5+Math.cos(a*3)*s*.2,z+Math.cos(a)*s*.35],[s,s,s],[rand(-.6,.7),a,rand(-.4,.4)])}for(let i=0;i<3;i++)put(shrubCore,[mat('#77a829'),mat('#90b72d'),mat('#4e8a27')][i%3],[x+rand(-.2,.2)*s,.35+rand(0,.18)*s,z+rand(-.2,.2)*s],[s*.30,s*.30,s*.27])}
for(let i=0;i<250;i++){const z=rand(-45,44),x=canalX(z)+(random()>.5?1:-1)*rand(5.4,6.0);if(z>-13&&z<-7)continue;shrub(x,z,rand(.5,.9))}
for(let i=0;i<150;i++){const x=rand(-30,33),z=rand(-45,43);if(Math.abs(x-roadX(z))<6||Math.abs(x-canalX(z))<7||x>18)continue;if((x>-15&&x<3&&z>-14&&z<0)||(x>-24&&x<-14&&z>6&&z<15))continue;shrub(x,z,rand(.6,1.3))}
// Continuous planting beds along the pavements and the market lane.
const occupiedPlots=[[-8.5,-9,10.1,7.7],[-.3,-5.1,6.6,5.6],[-10,-24,6.4,6],[-.5,-22,7.4,6.6],[-26,-10,7,6],[-19,10,8,7],[-17,26,8,7]];
function clearForPlant(x,z){const dx=(roadX(z+.05)-roadX(z-.05))/.1;const distance=Math.abs(x-roadX(z))/Math.hypot(1,dx);if(distance<7||Math.abs(x-canalX(z))<5.2||x>canalX(z)+7)return false;if(occupiedPlots.some(([px,pz,w,d])=>Math.abs(x-px)<w/2+.8&&Math.abs(z-pz)<d/2+.8))return false;if(x>-16&&x<7&&z>-2&&z<6)return false;return true}
for(let i=0;i<780;i++){const x=rand(-29,19),z=rand(-43,35);if(clearForPlant(x,z))shrub(x,z,rand(.55,.95))}
for(let z=-40;z<35;z+=1.4)for(const side of[-1,1]){const p=roadFrame(z,side*7.2);if(clearForPlant(p.x,p.z))shrub(p.x,p.z,.62)}
for(const [x,z,h]of[[-13,19,8.5],[-25,0,7.5],[3,-13,8],[-4,-32,8.5],[5,18,7.5]])palm(x,z,h);
for(const [x,z,k]of[[-17,18,1.1],[-22,4,1],[-8,-15,1.1],[5,-18,1.2],[13,18,1],[-22,-21,1.1]])banana(x,z,k);
// Rounded vehicle bodies use bevelled extrusions rather than coarse polygons.
function roundBox(w,h,d,r=.1){const s=new THREE.Shape();s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);let g=new THREE.ExtrudeGeometry(s,{depth:d-2*r,steps:1,bevelEnabled:true,bevelSegments:8,steps:1,bevelSize:r,bevelThickness:r,curveSegments:16});g.translate(0,0,-d/2+r);g.computeBoundingBox();const size=new THREE.Vector3();g.boundingBox.getSize(size);g.scale(w/size.x,h/size.y,d/size.z);g.center();g.deleteAttribute('uv');g.deleteAttribute('normal');g=mergeVertices(g,1e-5);g.computeVertexNormals();return g}
const vehicles=[];
function wheel(g,x,z,r=.32){
 const axle=new THREE.Group();axle.position.set(x,r+.035,z);g.add(axle);g.userData.wheelCount=(g.userData.wheelCount||0)+1;axle.userData={wheelRadius:r};g=axle;x=0;z=0;
 const y=0,side=axle.position.x<0?-1:1;
 put(new THREE.TorusGeometry(r*.78,r*.22,16,40),M.rubber,[x,y,z],[1,1,1],[0,Math.PI/2,0],g);
 cyl(M.black,x,y,z,r*.68,.14,g,[0,0,Math.PI/2]);
 cyl(M.chrome,x+side*.095,y,z,r*.53,.025,g,[0,0,Math.PI/2]);
 for(let i=0;i<6;i++){const a=i*Math.PI/3;ell(M.black,x+side*.112,y+Math.sin(a)*r*.36,z+Math.cos(a)*r*.36,.018,r*.09,r*.07,g)}
 cyl(M.chrome,x+side*.12,y,z,r*.17,.03,g,[0,0,Math.PI/2]);
}
const vehicleDimensions={auto:{length:2.635,width:1.30,height:1.70,bodyWidth:1.31,bodyLength:2.695,bodyHeight:1.7605,tyreRadius:.245},car:{length:3.530,width:1.490,height:1.520,bodyWidth:1.74,bodyLength:3.32,bodyHeight:1.915,tyreRadius:.27},van:{length:3.675,width:1.475,height:1.825,bodyWidth:1.74,bodyLength:3.70,bodyHeight:2.065,tyreRadius:.27},bus:{length:10.934,width:2.600,height:3.250,bodyWidth:2.68,bodyLength:7.40,bodyHeight:3.3565,tyreRadius:.50}};
function calibrateVehicle(g,type){
 const d=vehicleDimensions[type],factor=new THREE.Vector3(d.width/d.bodyWidth,d.height/d.bodyHeight,d.length/d.bodyLength);
 g.scale.copy(factor);
 const axles=[];g.traverse(o=>{if(o.userData.wheelRadius)axles.push(o)});
 for(const axle of axles){const parent=axle.parent,wrapper=new THREE.Group();wrapper.position.copy(axle.position);wrapper.position.y=(d.tyreRadius+.025)/factor.y;wrapper.scale.set(1/factor.x,1/factor.y,1/factor.z);parent.add(wrapper);wrapper.add(axle);axle.position.set(0,0,0);axle.scale.setScalar(d.tyreRadius/axle.userData.wheelRadius);axle.userData.rollingRadius=d.tyreRadius;}

 g.userData.dimensions={length:d.length,width:d.width,height:d.height};
}
function vehicle(type,x,z,rot=0,color='#d5e2df'){
 const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;g.userData.assetType=type;g.userData.designVersion=2;scene.add(g);
 const body=new THREE.MeshPhysicalMaterial({color:mat(color).color,roughness:.32,metalness:.12,clearcoat:.65,clearcoatRoughness:.19}),lamp=mat('#d8d8c9',.17),tail=mat('#922a21',.26);
 const rounded=(w,h,d,r,m,p)=>put(roundBox(w,h,d,r),m,p,[1,1,1],[0,0,0],g);
 if(type==='auto'){
  g.userData.designVersion=4;
  const paint=mat('#c79525',.40,.12),canvasRoof=mat('#252723',.96),seat=mat('#302d28',.9);
  canvasRoof.bumpMap=clothBump;canvasRoof.bumpScale=.002;seat.bumpMap=clothBump;seat.bumpScale=.001;
  const autoGlass=new THREE.MeshPhysicalMaterial({color:'#a6c9c3',transparent:true,opacity:.28,roughness:.18,metalness:.08,depthWrite:false,side:THREE.DoubleSide});
  rounded(1.24,.15,2.35,.055,M.black,[0,.38,.02]);
  rounded(1.28,.37,.75,.09,paint,[0,.61,.89]);
  // Formed sheet-metal nose with a rounded tapered profile, not a box across the cabin.
  const vertices=[],indices=[],profiles=[[.4,.47,-1.11],[.55,.57,-1.25],[.83,.62,-1.23],[1.03,.60,-1.12]];
  for(let row=0;row<profiles.length;row++)for(let i=0;i<=32;i++){
   const [y,w,z]=profiles[row],t=i/16-1;vertices.push(t*w,y+(row===0?.12*Math.exp(-t*t*16):0),z+.14*t*t);
   if(row<profiles.length-1&&i<32){const j=row*33+i;indices.push(j,j+33,j+1,j+1,j+33,j+34)}
  }
  const nose=new THREE.BufferGeometry();nose.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));nose.setIndex(indices);nose.computeVertexNormals();const noseMat=paint.clone();noseMat.side=THREE.DoubleSide;put(nose,noseMat,[0,0,0],[1,1,1],[0,0,0],g);
  // One broad raked windshield; the side entrances remain open.
  const windscreen=rounded(1.10,.62,.035,.045,autoGlass,[0,1.32,-1.012]);windscreen.rotation.x=.32;
  for(const side of[-1,1]){
   bar(paint,[side*.60,1.02,-1.01],[side*.56,1.63,-.82],.039,g);
   bar(canvasRoof,[side*.62,.80,1.10],[side*.62,1.61,1.10],.04,g);
   bar(M.black,[side*.63,.83,.2],[side*.63,1.66,.2],.024,g);
   rounded(.075,.39,.73,.025,paint,[side*.62,.74,.84]);
   rounded(.12,.065,.99,.02,M.black,[side*.66,.42,.05]);
   bar(M.chrome,[side*.65,.88,.25],[side*.65,.88,1.12],.019,g);
   wheel(g,side*.62,.82,.24);
   put(new THREE.TorusGeometry(.28,.038,12,40,Math.PI),paint,[side*.64,.275,.82],[1,1,1],[0,Math.PI/2,0],g);
   rounded(.235,.255,.045,.06,M.black,[side*.41,.78,-1.23]);
   ell(M.chrome,side*.41,.78,-1.258,.093,.093,.016,g);ell(lamp,side*.41,.78,-1.271,.079,.079,.01,g);
   rounded(.10,.07,.04,.012,M.yellow,[side*.51,.945,-1.18]);
   box(tail,side*.48,.65,1.28,.115,.14,.035,g);
   box(M.yellow,side*.48,.78,1.28,.115,.07,.035,g);
   bar(M.black,[side*.58,1.35,-.91],[side*.79,1.40,-1.0],.018,g);
   rounded(.12,.19,.045,.035,M.black,[side*.8,1.43,-1.01]);
  }
  bar(paint,[-.6,1.03,-1.1],[.6,1.03,-1.1],.035,g);
  bar(M.black,[-.57,1.63,-.82],[.57,1.63,-.82],.035,g);
  bar(M.black,[-.35,1.06,-1.135],[.19,1.35,-1.035],.012,g);
  // Rounded rectangular canvas canopy, with visible transverse sewn seams.
  const roofVertices=[],roofIndices=[],roofUV=[];
  for(let row=0;row<=24;row++)for(let col=0;col<=32;col++){
   const z=-.88+row/24*2.10,t=col/32*Math.PI,x=-Math.cos(t)*.655,y=1.57+Math.sin(t)*.18-.025*(Math.abs(z)/1.2)**2-.008*Math.sin(row/24*Math.PI*4)*Math.sin(t)**2;
   roofVertices.push(x,y,z);roofUV.push(col/32,row/24);if(row<24&&col<32){const j=row*33+col;roofIndices.push(j,j+1,j+33,j+1,j+34,j+33)}
  }
  const roofGeo=new THREE.BufferGeometry();roofGeo.setAttribute('position',new THREE.Float32BufferAttribute(roofVertices,3));roofGeo.setAttribute('uv',new THREE.Float32BufferAttribute(roofUV,2));roofGeo.setIndex(roofIndices);roofGeo.computeVertexNormals();const roofMat=canvasRoof.clone();roofMat.side=THREE.DoubleSide;put(roofGeo,roofMat,[0,0,0],[1,1,1],[0,0,0],g);
  for(const z of[-.84,.17,1.18]){const pts=Array.from({length:25},(_,i)=>{const t=i/24*Math.PI;return [-Math.cos(t)*.657,1.57+Math.sin(t)*.18-.025*(Math.abs(z)/1.2)**2+.003,z]});for(let i=1;i<pts.length;i++)bar(mat('#514f44'),pts[i-1],pts[i],.008,g)}
  rounded(1.27,.31,.075,.04,canvasRoof,[0,.975,1.19]);
  rounded(1.27,.18,.075,.05,canvasRoof,[0,1.48,1.19]);
  for(const side of[-1,1]){rounded(.36,.53,.075,.04,canvasRoof,[side*.455,1.275,1.19]);bar(mat('#5a5a4e'),[side*.266,1.13,1.24],[side*.266,1.43,1.24],.014,g);}
  rounded(.51,.30,.02,.035,autoGlass,[0,1.28,1.242]);
  rounded(1.06,.12,.45,.055,seat,[0,.76,.66]);rounded(1.06,.36,.10,.045,seat,[0,.99,.95]);
  for(let x=-.42;x<.5;x+=.14)bar(mat('#5b5345'),[x,.83,.46],[x,.83,.85],.007,g);
  rounded(.43,.11,.4,.04,seat,[0,.75,-.33]);
  bar(M.chrome,[0,.35,-.92],[0,1.06,-.73],.024,g);bar(M.black,[-.22,1.06,-.73],[.22,1.06,-.73],.019,g);
  wheel(g,0,-.98,.245);
  put(new THREE.TorusGeometry(.29,.085,16,40,Math.PI),canvasRoof,[0,.29,-.98],[1,1,1],[0,Math.PI/2,0],g);
  rounded(1.17,.08,.10,.025,M.black,[0,.39,1.29]);
  addSign('KL 07\nAX 3186',0,.68,-1.268,.23,.17,'#edb22c','#17211c',43,Math.PI,g);
  addSign('KL 07',.23,.51,1.30,.30,.12,'#edb22c','#17211c',52,0,g);
  const driver=new THREE.Group();driver.position.set(0,.20,-.34);driver.rotation.y=Math.PI;driver.scale.setScalar(1);g.add(driver);const driverRig=personPose(driver,'#ad9364',true,1);for(const shin of driverRig.knees)shin.scale.y=.75;driver.userData.personRig=true;
 }else if(type==='bus'){
  rounded(2.65,1.51,7.1,.12,M.red,[0,1.34,0]);
  rounded(2.66,.94,7.08,.09,M.cream,[0,2.59,0]);
  rounded(2.68,.27,7.15,.1,M.cream,[0,3.19,0]);
  for(const side of[-1,1]){
   for(let zz=-2.93;zz<3.1;zz+=.84){
    box(M.black,side*1.341,2.61,zz,.035,.83,.75,g);
    box(M.glass,side*1.366,2.61,zz,.025,.72,.66,g);
    box(M.chrome,side*1.389,2.48,zz,.018,.026,.65,g);
    box(M.cream,side*1.388,2.99,zz,.025,.045,.72,g);
   }
   wheel(g,side*1.36,-2.075,.48);wheel(g,side*1.36,1.535,.48);
   box(M.chrome,side*1.345,1.14,0,.035,.07,6.82,g);
   box(M.black,side*1.35,.74,0,.045,.13,3.2,g);
   for(const zz of[-2.075,1.535])put(new THREE.TorusGeometry(.56,.045,10,36,Math.PI),M.red,[side*1.36,.6,zz],[1,1,1],[0,Math.PI/2,0],g);
   for(const y of[.99,1.18,1.37])box(y===1.18?M.yellow:tail,side*1.02,y,3.58,.16,.13,.04,g);
   ell(lamp,side*.98,1.06,-3.58,.15,.12,.035,g);
   box(M.yellow,side*1.02,.88,-3.58,.16,.09,.035,g);
  }
  box(M.black,0,2.59,3.553,2.34,.88,.055,g);
  box(M.glass,0,2.59,3.59,2.19,.74,.025,g);
  box(M.cream,0,2.59,3.62,.06,.81,.04,g);
  box(M.black,0,2.57,-3.553,2.32,.91,.055,g);
  box(M.glass,0,2.57,-3.59,2.19,.78,.025,g);
  for(const side of[-1,1])bar(M.black,[side*.6,2.25,-3.62],[side*.86,2.68,-3.62],.019,g);
  box(M.black,0,1.22,-3.57,.95,.32,.035,g);
  for(let y=1.11;y<1.4;y+=.06)box(M.chrome,0,y,-3.596,.83,.018,.018,g);
  rounded(2.5,.17,.14,.035,M.chrome,[0,.67,3.63]);
  rounded(2.5,.17,.14,.035,M.chrome,[0,.67,-3.63]);
  // Passenger entrance, steps, door seam and mirrors.
  box(M.black,-1.352,1.89,-2.72,.05,1.9,.71,g);
  box(M.glass,-1.389,2.22,-2.72,.026,1.03,.58,g);
  for(let y=.71;y<1.25;y+=.17)box(M.chrome,-1.39,y,-2.72,.13,.04,.61,g);
  for(const side of[-1,1]){bar(M.black,[side*1.28,2.87,-3.22],[side*1.49,2.91,-3.42],.035,g);rounded(.16,.4,.1,.04,M.black,[side*1.50,2.82,-3.43]);}
  for(let zz=-3;zz<3.1;zz+=.74)box(mat('#72746a'),0,3.344,zz,2.05,.025,.66,g);
  addSign('KSRTC',0,1.77,3.598,1.86,.43,'#b84232','#ffeed0',67,0,g);
  addSign('KL 15',0,.91,3.62,.46,.15,'#efb836','#17211c',52,0,g);
 }else{
  const van=type==='van',length=van?3.58:3.2,roofHeight=van?1.99:1.9,roofFront=van?-.85:-.6,roofBack=van?1.44:.9,baseFront=van?-1.02:-.8,baseBack=van?1.54:.98;
  // A pressed-metal side profile leaves real wheel openings in the body.
  const wheelZ=van?1.183:1.119,archR=.365,axleY=.355,bottom=.515;
  const archAngle=Math.asin((bottom-axleY)/archR),archSpan=Math.cos(archAngle)*archR;
  const profile=new THREE.Shape();profile.moveTo(-length/2,bottom);
  for(const center of[-wheelZ,wheelZ]){profile.lineTo(center-archSpan,bottom);profile.absarc(center,axleY,archR,Math.PI-archAngle,archAngle,true);}
  profile.lineTo(length/2,bottom);profile.lineTo(length/2,1.04);profile.lineTo(length/2-.22,1.115);profile.lineTo(-length/2+.17,1.115);profile.lineTo(-length/2,1.03);profile.closePath();
  const shellGeometry=new THREE.ExtrudeGeometry(profile,{depth:1.66,bevelEnabled:true,bevelSegments:3,bevelSize:.025,bevelThickness:.04,curveSegments:24,steps:1});shellGeometry.translate(0,0,-.83);shellGeometry.rotateY(Math.PI/2);
  const shell=put(shellGeometry,body,[0,0,0],[1,1,1],[0,0,0],g);shell.userData.wheelOpenings=2;
  // Windows follow the same loft as the cabin; they cannot disappear inside a rounded box.
  const cabZ=van?.24:.08,cabHalfD=(van?2.72:1.91)/2,cabHalfH=(van?1.15:.85)/2;
  const lowY=1.49-cabHalfH,highY=1.49+cabHalfH;
  const cabin=rounded(1.48,van?1.15:.85,van?2.72:1.91,.035,body,[0,1.49,cabZ]);
  const cabinPosition=cabin.geometry.attributes.position;
  for(let i=0;i<cabinPosition.count;i++){const y=cabinPosition.getY(i),z=cabinPosition.getZ(i),t=THREE.MathUtils.clamp((y+cabHalfH)/(2*cabHalfH),0,1),front=(cabHalfD-z)/(2*cabHalfD);cabinPosition.setXYZ(i,cabinPosition.getX(i)*(1-.15*t),y,z+t*(front*.34-(1-front)*.17));}
  cabin.geometry.computeVertexNormals();
  function pane(points,material){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));geo.setIndex([0,1,2,0,2,3]);geo.computeVertexNormals();material.side=THREE.DoubleSide;const panel=put(geo,material,[0,0,0],[1,1,1],[0,0,0],g);if(material===M.glass)panel.userData.cabinGlass=true;return panel;}
  const frontAt=(y,inset)=>cabZ-cabHalfD+.34*((y-1.49+cabHalfH)/(2*cabHalfH))-inset;
  const backAt=(y,inset)=>cabZ+cabHalfD-.17*((y-1.49+cabHalfH)/(2*cabHalfH))+inset;
  pane([[-.626,1.3,frontAt(1.3,.012)],[.626,1.3,frontAt(1.3,.012)],[.55,roofHeight-.11,frontAt(roofHeight-.11,.012)],[-.55,roofHeight-.11,frontAt(roofHeight-.11,.012)]],M.black);
  pane([[-.587,1.34,frontAt(1.34,.023)],[.587,1.34,frontAt(1.34,.023)],[.52,roofHeight-.15,frontAt(roofHeight-.15,.023)],[-.52,roofHeight-.15,frontAt(roofHeight-.15,.023)]],M.glass);
  pane([[-.62,1.33,backAt(1.33,.012)],[.62,1.33,backAt(1.33,.012)],[.55,roofHeight-.12,backAt(roofHeight-.12,.012)],[-.55,roofHeight-.12,backAt(roofHeight-.12,.012)]],M.black);
  pane([[-.58,1.37,backAt(1.37,.023)],[.58,1.37,backAt(1.37,.023)],[.52,roofHeight-.16,backAt(roofHeight-.16,.023)],[-.52,roofHeight-.16,backAt(roofHeight-.16,.023)]],M.glass);
  for(const side of[-1,1]){
   const sideAt=y=>side*(.74-.111*((y-lowY)/(highY-lowY))+.008);
   const lowX=sideAt(1.31),highX=sideAt(roofHeight-.13),windowLowX=sideAt(1.36),windowHighX=sideAt(roofHeight-.17);
   pane([[lowX,1.31,baseFront+.13],[lowX,1.31,baseBack-.12],[highX,roofHeight-.13,roofBack-.12],[highX,roofHeight-.13,roofFront+.09]],M.black);
   const split=van?[baseFront+.19,-.24,.57,baseBack-.18]:[baseFront+.19,.08,baseBack-.18];
   for(let i=0;i<split.length-1;i++){
    const z0=split[i]+.025,z1=split[i+1]-.035;
    const top0=z0+(z0<0?.2:-.11),top1=z1+(z1<0?.2:-.11);
    pane([[windowLowX+side*.004,1.36,z0],[windowLowX+side*.004,1.36,z1],[windowHighX+side*.004,roofHeight-.17,top1],[windowHighX+side*.004,roofHeight-.17,top0]],M.glass);
    box(M.black,side*.862,1.15,z1-.08,.026,.035,.13,g);
   }
   for(const zz of[van?-1.183:-1.119,van?1.183:1.119]){wheel(g,side*.75,zz,.32);put(new THREE.TorusGeometry(.367,.012,12,40,Math.PI),body,[side*.864,.355,zz],[1,1,1],[0,Math.PI/2,0],g);}
   rounded(.35,.165,.045,.018,lamp,[side*.6,.98,-length/2-.025]);
   box(tail,side*.66,1.02,length/2+.025,.16,.27,.04,g);
   ell(body,side*.94,1.44,-.64,.11,.072,.15,g);bar(M.black,[side*.75,1.41,-.62],[side*.9,1.43,-.64],.023,g);
   box(M.black,side*.873,.85,0,.023,.032,1.82,g);
   for(const zz of[-.75,.38])bar(mat(color,.6),[side*.87,1.12,zz],[side*.87,.7,zz],.006,g);
  }
  rounded(1.57,.13,.12,.04,M.black,[0,.62,length/2]);rounded(1.57,.13,.12,.04,M.black,[0,.62,-length/2]);
  box(M.black,0,.91,-length/2-.026,.57,.15,.021,g);
  for(let xx=-.24;xx<.3;xx+=.08)box(M.chrome,xx,.91,-length/2-.04,.02,.115,.018,g);
  addSign('KL 07',0,.87,length/2+.052,.42,.14,'#efefdf','#17211c',52,0,g);
  for(const side of[-1,1])bar(M.black,[side*.43,1.34,baseFront-.053],[side*.64,1.57,baseFront+.1],.014,g);

 }
 calibrateVehicle(g,type);
 const driver=g.children.find(o=>o.userData.personRig);if(driver)driver.scale.set(1/g.scale.x,1/g.scale.y,1/g.scale.z);
 const yaw=g.rotation.y;g.rotation.y=0;g.updateMatrixWorld(true);const size=new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());g.userData.footprint={width:size.x,length:size.z};g.rotation.y=yaw;
 vehicles.push({g,type,z,x,rot});return g;
}
vehicle('bus',roadX(4)-2.1,4,.08);vehicle('auto',roadX(19)-2,19);vehicle('auto',roadX(5)+2.1,5);vehicle('car',roadX(-3)+2,-3,Math.PI,'#c6d8e3');vehicle('auto',roadX(-9)+2,-9);vehicle('auto',roadX(-15)+1.8,-15);vehicle('van',roadX(-18)-1.8,-18,Math.PI,'#e5e8de');vehicle('car',roadX(-12)-2,-12,Math.PI,'#a74535');vehicle('car',roadX(-29)-1.8,-29,Math.PI,'#ecebdd');vehicle('auto',roadX(-27)+2,-27);vehicle('auto',roadX(-36)+2,-36);
vehicle('auto',roadX(13)-2.1,13);vehicle('car',roadX(3)+2.1,3,Math.PI,'#dde4e4');vehicle('auto',roadX(-1)-2.1,-1);vehicle('auto',roadX(24)-2.1,24);
for(const v of vehicles){const p=roadFrame(v.z,v.x-roadX(v.z));v.g.position.set(p.x,0,p.z);v.g.rotation.y=p.angle+(v.rot>2?Math.PI:0)}
// Delivery motorbikes: wheels, fork, engine, lamps, mirrors, rider and cargo box.
const bikes=[];
function bikeChassis(style,color,label){
 const chassis=createMotorcycle(style,color),paint=mat(color,.38,.15),cargo=new THREE.Group();
 cargo.scale.set(.89,.82,.945);chassis.add(cargo);
 put(roundBox(.75,.68,.62,.065),paint,[0,1.44,.65],[1,1,1],[0,0,0],cargo);
 box(M.black,0,1.802,.65,.74,.027,.6,cargo);
 for(const side of[-1,1]){box(M.black,side*.29,1.45,.976,.035,.63,.02,cargo);box(M.black,side*.387,1.44,.65,.025,.61,.037,cargo);}
 addSign(label,0,1.47,.979,.53,.47,color,label==='MUD\nMEALS'?'#17211c':'#fff7e5',label.includes('\n')?61:50,0,cargo);
 return chassis;
}
function bikeDimensions(chassis){
 const size=new THREE.Box3().setFromObject(chassis,true).getSize(new THREE.Vector3());
 return {footprint:{width:Math.max(.81,size.x),length:size.z},dimensions:{width:size.x,length:size.z,height:size.y,riderHeight:1.81}};
}
function bike(x,z,color,label,style='city'){
 const g=new THREE.Group();g.position.set(x,0,z);g.chassis=bikeChassis(style,color,label);
 g.userData={assetType:'delivery-bike',designVersion:6,style,...bikeDimensions(g.chassis)};g.add(g.chassis);scene.add(g);
 bikes.push(g);return g;
}
const player=bike(roadX(12)-2.0,12,'#f58c17','MUD\nMEALS');const rival1=bike(roadX(18)+.2,18,'#704936','ZipEats','heritage');const rival2=bike(roadX(22)+2.2,22,'#507f82','QuickBite','metro');
for(const [g,z,offset]of[[player,12,-2],[rival1,18,-2],[rival2,22,-2]]){const p=roadFrame(z,offset);g.position.set(p.x,0,p.z);g.rotation.y=p.angle}
const playerModels=new Map([['city',player.chassis]]);
function setBikeModel(style){
 if(!Object.hasOwn(motorcycleStyles,style))return false;
 if(!playerModels.has(style))playerModels.set(style,bikeChassis(style,motorcycleStyles[style].color,'MUD\nMEALS'));
 const chassis=playerModels.get(style);player.remove(player.chassis);Object.assign(player.userData,{style,...bikeDimensions(chassis)});
 player.chassis=chassis;player.add(chassis);life.refreshPlayerWheels();sun.shadow.needsUpdate=true;
 document.querySelector('#bike-model').value=style;return true;
}

const playerStart=player.position.clone(),playerStartAngle=player.rotation.y;
// Keep district instance batches independent of the original market.
flush();scene.add(sun.target);
const extendedWorld=createExtendedWorld({extensionLayout,branchDistance,scene,M,mat,box,cyl,ell,bar,put,mesh,flush,building,roof,palm,banana,shrub,person,pot,crate,table,chair,addSign,fence,rand,riceGeometry,riceMaterials,waterMaterial,roadFrame,sun,renderer,setHeight:h=>authoringHeight=h,reservePlot,plotBlocked,waterAt,getHeight:()=>authoringHeight,registerWater:area=>waterAreas.push(area),spawnVehicle:(...args)=>{const g=vehicle(...args);vehicles.pop();return g}});
const routeCurve=extendedWorld.route;
const routeLength=routeCurve.getLength();
const routeMaterial=new THREE.MeshBasicMaterial({color:'#0bd6d6',toneMapped:false});const tourRouteMaterial=routeMaterial.clone();
for(let t=0;t<1;t+=2.1/routeLength){const a=routeCurve.getPointAt(t),b=routeCurve.getPointAt(Math.min(1,t+1.3/routeLength));a.y=Math.max(.16,a.y);b.y=Math.max(.16,b.y);const dir=b.clone().sub(a),length=dir.length();if(length<.0001)continue;const rotation=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),dir.normalize()));put(geom.box,t>.90?tourRouteMaterial:routeMaterial,a.clone().add(b).multiplyScalar(.5).toArray(),[.20,.025,length],[rotation.x,rotation.y,rotation.z])}
for(const t of[.18,.39,.64,.82]){const p=routeCurve.getPointAt(t),next=routeCurve.getPointAt((t+.001)%1),ang=Math.atan2(next.x-p.x,next.z-p.z);const g=new THREE.Group();g.position.copy(p);g.rotation.y=ang;scene.add(g);bar(routeMaterial,[-.3,.07,-.25],[0,.07,.2],.05,g);bar(routeMaterial,[.3,.07,-.25],[0,.07,.2],.05,g)}
function pin(x,z){const g=new THREE.Group();g.position.set(x,6,z);scene.add(g);ell(routeMaterial,0,.2,0,.46,.53,.24,g);put(geom.cone,routeMaterial,[0,-.45,0],[.31,.85,.18],[0,0,Math.PI],g);ell(mat('#083d39'),0,.28,.245,.16,.17,.025,g);const ring=new THREE.Mesh(new THREE.RingGeometry(.32,.59,40),routeMaterial);ring.rotation.x=-Math.PI/2;ring.position.set(x,4.54,z);scene.add(ring);return g}const deliveryStop={x:-21,z:-10};const destinationPin=pin(-26,-10);
for(const g of[rival1,rival2]){put(geom.cone,mat('#fd294e'),[0,2.6,0],[.18,.4,.18],[0,0,Math.PI],g)}
// White egrets and the small wooden canoe add scale to the paddy-side canal.
function egret(x,z){ell(M.white,x,.85,z,.11,.19,.26);bar(M.white,[x,.9,z-.12],[x,1.28,z-.25],.045);ell(M.white,x,1.32,z-.25,.07,.09,.07);bar(M.yellow,[x,1.31,z-.30],[x,1.29,z-.49],.027);for(const s of[-1,1])bar(mat('#a69346'),[x+s*.04,.73,z],[x+s*.06,.24,z+.05],.012)}egret(canalX(1)+11,1);egret(canalX(12)+11,12);egret(canalX(-13)+17,-13);
// The reference's foreground canoe sits in a drainage channel beyond the rice plots.
ribbon([[canalX(-6),-6],[17,-6],[27,-6],[37,-6],[47,-6]],3.2,.22,waterMaterial);
for(const z of[-7.8,-4.2])box(M.soil,31,.25,z,32,.2,.5);
const boat=new THREE.Group();boat.position.set(38,.38,-6);boat.rotation.y=1.3;scene.add(boat);
// Open planked hull: a shell rather than a solid extruded block.
const canoeVertices=[],canoeIndices=[];
for(let row=0;row<=32;row++){
 const t=row/32,zz=-2.2+t*4.4,width=Math.sin(t*Math.PI)**.65*.64,rise=Math.abs(t-.5)**2*.8;
 for(let col=0;col<=12;col++){const u=-1+col/6;canoeVertices.push(u*width,rise+.33*Math.abs(u)**1.8,zz);}
 if(row<32)for(let col=0;col<12;col++){const k=row*13+col;canoeIndices.push(k,k+13,k+1,k+1,k+13,k+14);}
}
const hullGeo=new THREE.BufferGeometry();hullGeo.setAttribute('position',new THREE.Float32BufferAttribute(canoeVertices,3));hullGeo.setIndex(canoeIndices);hullGeo.computeVertexNormals();
const hullMat=mat('#61432b');hullMat.side=THREE.DoubleSide;hullMat.bumpMap=woodBump;hullMat.bumpScale=.035;
put(hullGeo,hullMat,[0,0,0],[1,1,1],[0,0,0],boat);
for(const side of[-1,1]){const points=[];for(let row=0;row<=32;row++){const t=row/32;points.push(new THREE.Vector3(side*Math.sin(t*Math.PI)**.65*.64,Math.abs(t-.5)**2*.8+.33,-2.2+t*4.4));}put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),48,.035,8,false),M.wood,[0,0,0],[1,1,1],[0,0,0],boat);}
for(let zz=-1.55;zz<1.6;zz+=.68){const width=Math.sin((zz+2.2)/4.4*Math.PI)**.65*.64;box(M.wood,0,.3,zz,width*1.85,.065,.19,boat);}
bar(M.wood,[-.48,.41,-1.9],[-.64,.43,1.8],.025,boat);ell(M.wood,-.64,.43,1.9,.11,.025,.3,boat);

flush();
function floorAt(x,z){
 if(x>-11.8&&x<-5.2&&z>-5.5&&z<-3.65)return .2225;
 if(x>-12.7&&x<-4.3&&z>-5.65&&z<-3.55)return .175;
 if(x>51.5&&x<64.5&&z>-63.5&&z<-60.5)return .2;
 if(x>-63&&x<-53&&z>-124.5&&z<-119.5)return 16;
 if(x>-1.5&&x<21.5&&z>-168.5&&z<-159.5)return 24.175;
 return z<-80&&x<50?Math.max(0,extendedWorld.groundHeight(x,z)):0;
}
// Road elevations affect wheel height, never the rider's horizontal position.
function ridingFloor(x,z){
 let height=floorAt(x,z),nearest=4.2**2;
 const points=extendedWorld.roadPoints;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz;
  if(!length)continue;
  const t=THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/length,0,1),distance=(x-a.x-t*dx)**2+(z-a.z-t*dz)**2;
  if(distance<nearest){nearest=distance;height=THREE.MathUtils.lerp(a.y,b.y,t)-.16;}
 }
 return Math.max(.025,height);
}
for(const n of npcs){n.home.y=floorAt(n.home.x,n.home.z);n.g.position.y=n.home.y;}
const life=createWorldLife({scene,THREE,npcs,vehicles,bikes,player,roadPoints,extendedWorld,vehicle,plots,plantings,roadDistance,roadClearance,floorAt,waterAt,plotBlocked,windTime,windStrength,sun});
// UI and real scene controls.
let cameraMode='driving';
let paused=false,freeCamera=false,speed=0,steer=0,travel=0,delivered=false;const keys=new Set(),touchKeys=new Map(),touchSteering=new Map();
const pressed=key=>keys.has(key)||[...touchKeys.values()].includes(key);
function clearControls(){keys.clear();touchKeys.clear();touchSteering.clear();steer=0;}
const driving=createDriving();
const toast=document.querySelector('#toast');let toastTimer;
function notify(message){toast.textContent=message;toast.style.opacity=1;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.style.opacity=0,2600)}
const cameraDefaults={zoom:defaultZoom,tilt:24,rotation:0,panX:0,panZ:8};
const cameraLimits={zoom:[.7,2.2],tilt:[10,65],rotation:[-75,75],panX:[-4,4],panZ:[6,24]};
const cameraSettings={...cameraDefaults};
const cameraStorageKey=()=>cameraMode==='reference'?'mud-meals-reference-camera':'mud-meals-follow-camera';
function loadCamera(){Object.assign(cameraSettings,cameraDefaults);try{const saved=JSON.parse(localStorage.getItem(cameraStorageKey())||'null');if(saved&&typeof saved==='object')for(const key of Object.keys(cameraLimits)){const value=saved[key];if(typeof value==='number'&&Number.isFinite(value))cameraSettings[key]=THREE.MathUtils.clamp(value,...cameraLimits[key])}}catch{}}
loadCamera();
function saveCamera(){try{localStorage.setItem(cameraStorageKey(),JSON.stringify(cameraSettings))}catch{}}
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
 camera.fov=cameraMode==='reference'?16.5:55;camera.near=cameraMode==='reference'?10:.5;camera.far=cameraMode==='reference'?360:160;scene.fog.near=cameraMode==='reference'?220:95;scene.fog.far=cameraMode==='reference'?360:180;camera.zoom=cameraSettings.zoom;camera.updateProjectionMatrix();document.querySelector('#camera-mode').value=cameraMode;document.querySelector('#drive-status').hidden=cameraMode==='reference';tourRouteMaterial.visible=cameraMode==='driving';updateFollowCamera(0,true);controls.enableDamping=true;
 for(const key of Object.keys(cameraLimits)){const input=document.querySelector('#camera-'+key);input.value=cameraSettings[key];document.querySelector('#camera-'+key+'-value').textContent=key==='zoom'?cameraSettings[key].toFixed(2)+'×':key==='tilt'||key==='rotation'?Math.round(cameraSettings[key])+'°':cameraSettings[key].toFixed(1)+' m'}
}
function resetCameraSettings(){Object.assign(cameraSettings,cameraDefaults);applyCameraSettings();saveCamera()}
function setCameraMode(mode){cameraMode=mode==='driving'?'driving':'reference';loadCamera();applyCameraSettings()}
document.querySelector('#camera-mode').addEventListener('change',event=>setCameraMode(event.target.value));
for(const key of Object.keys(cameraLimits))document.querySelector('#camera-'+key).addEventListener('input',event=>{cameraSettings[key]=THREE.MathUtils.clamp(Number(event.target.value),...cameraLimits[key]);applyCameraSettings();saveCamera()});
document.querySelector('#camera-settings').onclick=()=>{document.querySelector('#camera-panel').hidden=false;document.querySelector('.tools').hidden=true;document.querySelector('#tools-toggle').setAttribute('aria-expanded','false')};
document.querySelector('#close-camera').onclick=()=>document.querySelector('#camera-panel').hidden=true;
document.querySelector('#reset-camera').onclick=()=>{resetCameraSettings();notify('Camera reset')};
applyCameraSettings();
function reset(){clearControls();document.querySelector('#speed').textContent='0';elapsed=0;document.querySelector('#timer').textContent='02:45';cameraMode='driving';driving.reset(playerStartAngle);player.position.copy(playerStart);player.rotation.set(0,playerStartAngle,0);speed=0;travel=0;delivered=false;document.querySelector('#cash').textContent='₹1,240';life.reset();resetCameraSettings();minimap()}
function hold(button,key){const el=document.querySelector(button);el.addEventListener('pointerdown',e=>{touchKeys.set(e.pointerId,key);el.setPointerCapture(e.pointerId)});for(const ev of['pointerup','pointercancel','lostpointercapture'])el.addEventListener(ev,e=>touchKeys.delete(e.pointerId))}
hold('#accelerate','ArrowUp');hold('#brake','ArrowDown');hold('.joystick .up','ArrowUp');hold('.joystick .down','ArrowDown');
for(const btn of document.querySelectorAll('[data-steer]')){const n=Number(btn.dataset.steer);btn.addEventListener('pointerdown',e=>{touchSteering.set(e.pointerId,n);steer=n;btn.setPointerCapture(e.pointerId)});for(const ev of['pointerup','pointercancel','lostpointercapture'])btn.addEventListener(ev,e=>{touchSteering.delete(e.pointerId);steer=[...touchSteering.values()].at(-1)||0})}
document.querySelector('#pause').onclick=()=>{paused=!paused;if(paused)clearControls();document.querySelector('#pause').textContent=paused?'▶':'Ⅱ';document.querySelector('#pause').setAttribute('aria-label',paused?'Resume animation':'Pause animation')};
document.querySelector('#view').onclick=()=>{freeCamera=!freeCamera;controls.enabled=freeCamera;if(freeCamera){camera.near=.5;camera.updateProjectionMatrix()}document.querySelector('#view').textContent=freeCamera?'Locked camera':'Free camera';notify(freeCamera?'Drag to orbit · Scroll to zoom':'Camera settings restored');if(!freeCamera)applyCameraSettings()};
document.querySelector('#reset').onclick=()=>{reset();notify('Scene reset')};
document.querySelector('#orders').onclick=()=>document.querySelector('#order-panel').hidden=false;
document.querySelector('#close-orders').onclick=()=>document.querySelector('#order-panel').hidden=true;
document.querySelector('#reference').onclick=()=>{document.querySelector('#reference-panel').hidden=false;document.querySelector('#reference-opacity').value='1';document.querySelector('#reference-panel img').style.opacity='1'};
document.querySelector('#reference-opacity').addEventListener('input',event=>document.querySelector('#reference-panel img').style.opacity=event.target.value);
document.querySelector('#reference-frame').onclick=()=>{reset();setCameraMode('reference');document.querySelector('#reference-opacity').value='.5';document.querySelector('#reference-panel img').style.opacity='.5'};
document.querySelector('#close-reference').onclick=()=>document.querySelector('#reference-panel').hidden=true;
let hudVisible=true;function toggleHUD(){hudVisible=!hudVisible;document.querySelector('#hud').style.visibility=hudVisible?'visible':'hidden';notify(hudVisible?'HUD visible':'Press H to restore the HUD')}
document.querySelector('#hide').onclick=toggleHUD;
function visitDistrict(id){const d=extendedWorld.districts.find(d=>d.id===id);if(!d)return;clearControls();travel=0;speed=0;document.querySelector('#speed').textContent='0';const p=routeCurve.getPointAt(d.routeT),ahead=routeCurve.getPointAt((d.routeT+.0007)%1);player.position.set(p.x,Math.max(0,p.y-.16),p.z);player.rotation.set(0,Math.atan2(-(ahead.x-p.x),-(ahead.z-p.z)),0);driving.reset(player.rotation.y);applyCameraSettings();extendedWorld.update(elapsed,player);sun.shadow.needsUpdate=true;document.querySelector('#location').textContent=d.name.toUpperCase();minimap()}
document.querySelector('#world-explore').onclick=()=>{document.querySelector('#world-panel').hidden=false;document.querySelector('.tools').hidden=true};
document.querySelector('#close-world').onclick=()=>document.querySelector('#world-panel').hidden=true;
document.querySelector('#travel-district').onclick=()=>{visitDistrict(document.querySelector('#district-select').value);document.querySelector('#world-panel').hidden=true;notify('Exploring '+extendedWorld.nearest(player.position).name)};
document.querySelector('#bike-model').addEventListener('change',event=>setBikeModel(event.target.value));
document.querySelector('#weather-select').addEventListener('change',event=>{extendedWorld.setWeather(event.target.value);sun.shadow.needsUpdate=true});
document.querySelector('#tools-toggle').onclick=()=>{const menu=document.querySelector('.tools');menu.hidden=!menu.hidden;document.querySelector('#tools-toggle').setAttribute('aria-expanded',String(!menu.hidden))};
async function enterLandscape(){
 try{if(!document.fullscreenElement&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();if(screen.orientation?.lock)await screen.orientation.lock('landscape')}catch{notify('Rotate your phone sideways for landscape')}
 resize();
}
document.querySelector('#enter-landscape').onclick=enterLandscape;
document.querySelector('#fullscreen').onclick=async()=>{if(document.fullscreenElement){try{await document.exitFullscreen();screen.orientation?.unlock?.()}catch{}}else await enterLandscape()};
document.addEventListener('fullscreenchange',resize);

window.addEventListener('keydown',e=>{if(e.defaultPrevented||e.isComposing||e.ctrlKey||e.metaKey||e.altKey)return;if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;if(e.target.tagName==='BUTTON'&&e.code==='Space')return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();keys.add(e.key.length===1?e.key.toLowerCase():e.key);if(e.repeat)return;if(e.key.toLowerCase()==='h')toggleHUD();if(e.key.toLowerCase()==='r')reset();if(e.code==='Space')document.querySelector('#pause').click()});window.addEventListener('keyup',e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key));window.addEventListener('blur',clearControls);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearControls()});
const mapCanvas=document.querySelector('#minimap'),ctx=mapCanvas.getContext('2d');
function minimap(){ctx.clearRect(0,0,300,300);ctx.fillStyle='#7f9952';ctx.fillRect(0,0,300,300);const project=(x,z)=>[150+(x-player.position.x)*3.3,155+(z-player.position.z)*3.3];
 for(let i=0;i<100;i++){const x=(Math.sin(i*12.7)*.5+.5)*300,y=(Math.cos(i*4.3)*.5+.5)*300;ctx.fillStyle=['#608c3e','#a2b563','#547b3b'][i%3];ctx.beginPath();ctx.arc(x,y,3+i%5,0,Math.PI*2);ctx.fill()}
 function path(points,color,w){ctx.strokeStyle=color;ctx.lineWidth=w;ctx.beginPath();points.forEach(([x,z],i)=>{const p=project(x,z);i?ctx.lineTo(...p):ctx.moveTo(...p)});ctx.stroke()}
 path(extendedWorld.roadPoints.map(p=>[p.x,p.z]),'#bec4ac',18);path(canalPoints,'#3ebac5',27);path(roadPoints,'#bec4ac',18);path(bp,'#bec4ac',13);
 for(const [x,z]of[[-10,-9],[-.3,-22],[21,-22],[-19,10]]){const p=project(x,z);ctx.fillStyle='#f4d089';ctx.fillRect(p[0]-6,p[1]-5,12,11);ctx.fillStyle='#b94e31';ctx.beginPath();ctx.moveTo(p[0]-9,p[1]-5);ctx.lineTo(p[0],p[1]-12);ctx.lineTo(p[0]+9,p[1]-5);ctx.fill()}
 ctx.setLineDash([5,5]);path(routeCurve.getSpacedPoints(650).map(p=>[p.x,p.z]),'#39f4e6',3);ctx.setLineDash([]);
 for(const b of[rival1,rival2]){const p=project(b.position.x,b.position.z);ctx.fillStyle='#fa4861';ctx.beginPath();ctx.arc(...p,6,0,6.28);ctx.fill();ctx.strokeStyle='#233e2d';ctx.lineWidth=2;ctx.stroke()}
 const p=project(player.position.x,player.position.z);ctx.save();ctx.translate(...p);ctx.rotate(-player.rotation.y);ctx.fillStyle='#ff952c';ctx.strokeStyle='#1b3b2c';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,-21);ctx.lineTo(13,15);ctx.lineTo(0,9);ctx.lineTo(-13,15);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
 const d=project(destinationPin.position.x,destinationPin.position.z);ctx.fillStyle='#35f3e2';ctx.beginPath();ctx.arc(...d,9,0,6.28);ctx.fill();ctx.fillStyle='#13423b';ctx.beginPath();ctx.arc(...d,3,0,6.28);ctx.fill()}
const clock=new THREE.Clock();let elapsed=0,mapTime=0;
function update(dt){if(!paused){elapsed+=dt;waterTime.value=elapsed;waterBump.offset.x=elapsed*.007;waterBump.offset.y=elapsed*.004;
 const throttle=pressed('ArrowUp')||pressed('w')?1:0,brake=pressed('ArrowDown')||pressed('s')?1:0;
 const turn=THREE.MathUtils.clamp(steer+(keys.has('ArrowLeft')||keys.has('a')?-1:0)+(keys.has('ArrowRight')||keys.has('d')?1:0),-1,1);
 const oldHeading=player.rotation.y,oldSpeed=driving.state.speed;
 const forwardX=-Math.sin(oldHeading),forwardZ=-Math.cos(oldHeading);
 const grade=(ridingFloor(player.position.x+forwardX*.4,player.position.z+forwardZ*.4)-ridingFloor(player.position.x-forwardX*.4,player.position.z-forwardZ*.4))/.8;
 driving.state.heading=oldHeading;
 const distance=driving.step(dt,{throttle,brake,steering:turn,grade,wet:extendedWorld.weather==='rain'});
 speed=driving.state.speed;
 if(distance>.00001){
  const pieces=Math.max(1,Math.ceil(distance/.2)),nextHeading=driving.state.heading;
  for(let i=1;i<=pieces;i++){
   const heading=THREE.MathUtils.lerp(oldHeading,nextHeading,(i-.5)/pieces),next=player.position.clone();
   next.x-=Math.sin(heading)*distance/pieces;next.z-=Math.cos(heading)*distance/pieces;next.y=ridingFloor(next.x,next.z);
   const savedHeading=player.rotation.y;player.rotation.y=THREE.MathUtils.lerp(oldHeading,nextHeading,i/pieces);
   if(Math.abs(next.y-player.position.y)>.35||life.blocked(next,.45,player)){
    player.rotation.y=savedHeading;driving.state.heading=savedHeading;driving.state.speed=speed=0;driving.state.yawRate=0;
    if(oldSpeed>2)notify('Path blocked — brake and steer around');break;
   }
   player.position.copy(next);travel+=distance/pieces;
  }
 }
 player.rotation.z=driving.state.lean;
 if(travel>15&&Math.hypot(player.position.x-deliveryStop.x,player.position.z-deliveryStop.z)<3&&!delivered){delivered=true;document.querySelector('#cash').textContent='₹1,520';notify('Delivered! ₹280 added to cash')}

 destinationPin.position.y=6+Math.sin(elapsed*2)*.13;
 life.update(dt,elapsed);
 const left=Math.max(0,165-Math.floor(elapsed));document.querySelector('#timer').textContent=`${String(Math.floor(left/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}`;
 }
 extendedWorld.update(elapsed,player);if(freeCamera){controls.update();camera.near=Math.max(.5,Math.min(10,camera.position.distanceTo(controls.target)*.1));camera.updateProjectionMatrix()}else updateFollowCamera(dt);mapTime+=dt;if(mapTime>.10){minimap();document.querySelector('#location').textContent=extendedWorld.nearest(player.position).name.toUpperCase();document.querySelector('#speed').textContent=Math.round(speed*3.6);document.querySelector('#rival').hidden=Math.min(player.position.distanceTo(rival1.position),player.position.distanceTo(rival2.position))>18;mapTime=0}}
function resize(){const stage=document.querySelector('#game-stage').getBoundingClientRect();const w=Math.max(1,Math.round(stage.width)),h=Math.max(1,Math.round(stage.height));const size=renderer.getSize(new THREE.Vector2());if(size.x===w&&size.y===h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);graphics.resize(w,h)}
const graphics=setupGraphics(renderer,scene,camera);
let sharpGraphics=true;
try{sharpGraphics=localStorage.getItem('mud-meals-graphics')!=='balanced'}catch{}
function applyQuality(){graphics.setQuality(sharpGraphics);document.querySelector('#quality').textContent=sharpGraphics?'Graphics: Sharp':'Graphics: Balanced';resize()}
document.querySelector('#quality').onclick=()=>{sharpGraphics=!sharpGraphics;applyQuality();try{localStorage.setItem('mud-meals-graphics',sharpGraphics?'sharp':'balanced')}catch{};notify(sharpGraphics?'Sharp graphics enabled':'Balanced graphics enabled')};
applyQuality();
window.addEventListener('resize',resize);
new ResizeObserver(resize).observe(document.querySelector('#game-stage'));
resize();minimap();
let frameFence;
function animate(){
 update(Math.min(clock.getDelta(),.1));
 const gl=renderer.getContext();
 // Keep slow GPUs from queuing animation frames faster than they can render them.
 if(frameFence){
  if(gl.clientWaitSync(frameFence,0,0)===gl.TIMEOUT_EXPIRED)return;
  gl.deleteSync(frameFence);
 }
 graphics.render();
 frameFence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
 gl.flush();
}
// A common ground plane and orthographic camera make size ratios directly reviewable.
function renderScalePreview(){
 const preview=new THREE.Scene();preview.background=new THREE.Color('#e5dfd1');preview.environment=scene.environment;preview.environmentIntensity=scene.environmentIntensity;
 const lineup=[['customer',-13.8,'Person\n1.73 m tall'],['delivery-bike',-11,'Bike + rider\n2.09 m long'],['auto',-8,'Auto\n2.64 m long · 1.70 m tall'],['car',-4.6,'Car\n3.53 m long · 1.52 m tall'],['van',-.4,'Van\n3.68 m long · 1.83 m tall'],['bus',7.3,'Bus\n10.93 m long · 3.25 m tall']];
 for(const [type,x,label]of lineup){const original=scene.children.find(o=>o.userData.assetType===type&&!o.userData.seated),model=cloneCharacter(original);model.position.set(x,0,0);model.rotation.set(0,type==='customer'?0:Math.PI/2,0);preview.add(model);const caption=sign(label,type==='customer'?1.8:type==='bus'?7:3.3,.65,'#e5dfd1','#22382d',28);caption.position.set(x,-.55,17);preview.add(caption);}
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(32,8),mat('#c5c5b6'));ground.rotation.x=-Math.PI/2;ground.position.y=-.005;preview.add(ground);
 const grid=new THREE.GridHelper(32,32,'#a4ab9a','#b8bdac');grid.position.y=.001;preview.add(grid);
 preview.add(new THREE.HemisphereLight('#e6edf0','#55584b',.95));const light=new THREE.DirectionalLight('#fff8ee',2.5);light.position.set(-10,12,8);preview.add(light);
 const portrait=new THREE.OrthographicCamera(-15,15,4,-4,.1,60);portrait.position.set(0,2,25);portrait.lookAt(0,1.1,0);portrait.updateProjectionMatrix();
 const size=renderer.getSize(new THREE.Vector2()),ratio=renderer.getPixelRatio();renderer.setPixelRatio(1);renderer.setSize(2400,640,false);renderer.render(preview,portrait);const png=canvas.toDataURL('image/png');renderer.setPixelRatio(ratio);renderer.setSize(size.x,size.y,false);return png;
}
// Review the exact in-game character mesh under consistent studio lighting.
function renderPersonPreview(seated=false,assetType=null){
 const original=assetType?scene.children.find(o=>o.userData.assetType===assetType):scene.children.find(o=>o.userData.assetType==='customer'&&o.userData.seated===seated);
 const preview=new THREE.Scene();preview.background=new THREE.Color('#e5dfd1');preview.environment=scene.environment;preview.environmentIntensity=scene.environmentIntensity;
 const character=cloneCharacter(original);character.position.set(0,0,0);character.rotation.set(0,assetType?Math.PI:0,0);preview.add(character);
 if(seated){const before=scene.children.length;chair(0,0);const seat=scene.children[before];seat.position.set(0,0,0);preview.add(seat);const pendingBefore=new Set(batches.keys());table(0,.65);for(const [key,batch]of batches){if(pendingBefore.has(key))continue;for(const it of batch.items){const item=new THREE.Mesh(batch.g,batch.m);item.position.set(...it.p);item.scale.set(...it.s);item.rotation.set(...it.rot);item.castShadow=true;preview.add(item);}batches.delete(key);}}
 character.updateMatrixWorld(true);character.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();o.computeBoundingBox();}});
 const bounds=new THREE.Box3().setFromObject(character),size=bounds.getSize(new THREE.Vector3()),extent=Math.max(5,size.x+2,size.z+2);
 const ground=new THREE.Mesh(geom.box,mat('#c9c2b4'));ground.position.y=-.035;ground.scale.set(extent,.05,extent);ground.receiveShadow=true;preview.add(ground);
 preview.add(new THREE.HemisphereLight('#e6edf0','#55584b',.95));
 const light=new THREE.DirectionalLight('#fff8ee',2.5);light.position.set(-3,6,4);light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,near:.1,far:40});light.shadow.normalBias=.02;preview.add(light,light.target);
 const distance=assetType?Math.max(4.5,size.z*1.6,size.x*1.7,size.y*2.3):3.8;
 const portrait=camera.clone();portrait.near=.1;portrait.far=60;portrait.zoom=1;portrait.fov=34;portrait.position.set(distance*.55,size.y*.5+distance*.22,distance*.82);portrait.lookAt(0,size.y*.5,0);portrait.updateProjectionMatrix();
 renderer.render(preview,portrait);
 const png=canvas.toDataURL('image/png');light.shadow.dispose();
 return png;
}
window.__MUD_MEALS__={driving,ready:false,setBikeModel,motorcycleStyles,renderScalePreview,vehicleDimensions,deliveryStop,branchPoints:bp,renderPersonPreview,renderAssetPreview:type=>renderPersonPreview(false,type),setCameraMode,get cameraMode(){return cameraMode},extendedWorld,visitDistrict,update,scene,camera,renderer,player,life,plots,plantings,npcs,reset,cameraSettings,resetCameraSettings,updateFollowCamera,graphics,resize,roadFrame,roadDetails,vehicles,stats:()=>({triangles:renderer.info.render.triangles,calls:renderer.info.render.calls,geometries:renderer.info.memory.geometries,objects:scene.children.length})};
installCrowd(npcs,bikes).then(()=>{
 life.reset();return renderer.compileAsync(scene,camera);
}).then(()=>{
 window.__MUD_MEALS__.ready=true;clock.getDelta();
 renderer.setAnimationLoop(animate);
 document.querySelector('#loading')?.remove()}).catch(error=>{
 console.error('Game character loading failed:',error);
 document.querySelector('#loading').textContent='Could not load the game characters. Reload to retry.';
 window.__MUD_MEALS__.startupError=error.message;
});
