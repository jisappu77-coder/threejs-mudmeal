// Construct the complete real Three.js scene without a browser, then verify geometry and controls.
import fs from 'node:fs';
const {createExtendedWorld}=await import('../src/world.js');
const {setupGraphics}=await import('../src/graphics.js');
import assert from 'node:assert/strict';
import * as THREE from 'three';
const noop=()=>{};
const ctx=new Proxy({},{get:(_,key)=>key==='measureText'?()=>({width:100}):key==='createLinearGradient'?()=>({addColorStop:noop}):noop,set:()=>true});
const els=new Map();
function el(){return {style:{},hidden:true,tagName:'DIV',getContext:()=>ctx,getBoundingClientRect:()=>({width:Math.min(innerWidth,innerHeight*16/9),height:Math.min(innerHeight,innerWidth*9/16)}),addEventListener:noop,setAttribute:noop,setPointerCapture:noop,remove:noop,dataset:{steer:'0'}}}
globalThis.document={querySelector:s=>{if(!els.has(s))els.set(s,el());return els.get(s)},querySelectorAll:()=>[],createElement:()=>el(),addEventListener:noop};
globalThis.ResizeObserver=class {observe(){}};
globalThis.window={addEventListener:noop};globalThis.innerWidth=1536;globalThis.innerHeight=864;globalThis.devicePixelRatio=1;
let pixelRatio=1;
const fakeRenderer={getPixelRatio:()=>pixelRatio,capabilities:{maxSamples:4},setPixelRatio:r=>pixelRatio=r,setSize:noop,shadowMap:{},setAnimationLoop:noop,render:noop,compileAsync:()=>Promise.resolve(),info:{render:{triangles:0,calls:0},memory:{geometries:0}}};
const FakeControls=class {constructor(){this.target=new THREE.Vector3()}update(){}};
let source=fs.readFileSync('./src/scene.js','utf8').replace(/^import .*;\n/gm,'').replace(/const renderer = new THREE.WebGLRenderer\([^\n]*\);/,'const renderer = fakeRenderer;').replace('new OrbitControls(camera,canvas)','new FakeControls(camera,canvas)');
new Function('THREE','fakeRenderer','FakeControls','setupGraphics','createExtendedWorld',source)(THREE,fakeRenderer,FakeControls,setupGraphics,createExtendedWorld);
const app=window.__MUD_MEALS__;assert.ok(app.scene.children.length>100);assert.equal(app.camera.isPerspectiveCamera,true);assert.equal(app.graphics.ao.ssaoMaterial.defines.PERSPECTIVE_CAMERA,1);assert.equal(app.graphics.composer.passes.length,3);
let meshes=0,triangles=0,instances=0;
app.scene.traverse(o=>{if(!o.isMesh)return;meshes++;const p=o.geometry.attributes.position;assert.ok(p);for(const n of p.array)assert.ok(Number.isFinite(n));const mult=o.isInstancedMesh?o.count:1;instances+=mult;triangles+=(o.geometry.index?o.geometry.index.count:p.count)/3*mult;if(o.isInstancedMesh)for(const n of o.instanceMatrix.array)assert.ok(Number.isFinite(n))});
assert.ok(triangles>200000);assert.ok(instances>10000);assert.ok(app.player.children.length>30);
const initial=app.player.position.clone();app.player.position.x+=5;app.reset();assert.equal(app.player.position.x,initial.x);
for(const name of ['src/scene.js','src/graphics.js','src/main.js','src/style.css','public/food.png','public/reference.png'])assert.ok(fs.existsSync(name));
els.get('#orders').onclick();assert.equal(els.get('#order-panel').hidden,false);els.get('#close-orders').onclick();assert.equal(els.get('#order-panel').hidden,true);
els.get('#reference').onclick();assert.equal(els.get('#reference-panel').hidden,false);
els.get('#pause').onclick();assert.equal(els.get('#pause').textContent,'▶');els.get('#pause').onclick();assert.equal(els.get('#pause').textContent,'Ⅱ');
// Kerbs must sit at the road edges and paint must follow the tangent.
for(const d of app.roadDetails){const center=app.roadFrame(d.sourceZ);assert.ok(Math.abs(d.angle-center.angle)<1e-8);if(d.kind==='kerb')assert.ok(Math.abs(Math.hypot(d.x-center.x,d.z-center.z)-4.97)<1e-7)}
for(const v of app.vehicles){const offset=v.x-app.roadFrame(v.z).x,p=app.roadFrame(v.z,offset);assert.ok(Math.abs(v.g.position.x-p.x)<1e-8);assert.ok(Math.abs(v.g.position.z-p.z)<1e-8)}
// A wide display retains the original 16:9 scene without enlarging the HUD.
globalThis.innerWidth=932;globalThis.innerHeight=430;app.resize();assert.equal(app.graphics.ao.width,764*pixelRatio);assert.equal(app.graphics.ao.height,430*pixelRatio);assert.ok(Math.abs(app.camera.aspect-16/9)<.01);
globalThis.innerWidth=1536;globalThis.innerHeight=864;app.resize();
// A turning, moving rider is followed from behind, with interpolation rather than snapping.
assert.equal(app.cameraMode,'reference');assert.ok(app.camera.fov<20);
app.setCameraMode('driving');
const beforeFollow=app.camera.position.clone();
app.player.position.x+=8;app.player.rotation.y+=Math.PI/2;app.updateFollowCamera(1/60);
assert.ok(app.camera.position.distanceTo(beforeFollow)>0);
const firstFollow=app.camera.position.clone();for(let i=0;i<90;i++)app.updateFollowCamera(1/60);
assert.ok(app.camera.position.distanceTo(firstFollow)>1);
const forward=new THREE.Vector3(-Math.sin(app.player.rotation.y),0,-Math.cos(app.player.rotation.y));
assert.ok(app.camera.position.clone().sub(app.player.position).dot(forward)<0);
assert.ok(app.camera.position.y>app.player.position.y+2);
app.reset();assert.ok(app.player.position.distanceTo(initial)<1e-8);
globalThis.devicePixelRatio=2.5;app.graphics.setQuality(true);app.resize();assert.equal(pixelRatio,2);assert.equal(app.graphics.ao.width,1536*2);app.graphics.setQuality(false);app.resize();assert.equal(pixelRatio,1);assert.equal(app.graphics.ao.width,1536);
assert.equal(app.extendedWorld.districts.length,10);
assert.ok(app.extendedWorld.route.closed);
for(const p of app.extendedWorld.roadPoints)assert.ok(p.y>=.16);
for(const b of app.extendedWorld.footprints)for(const p of app.extendedWorld.roadPoints){const dx=Math.max(0,Math.abs(p.x-b.x)-b.w/2),dz=Math.max(0,Math.abs(p.z-b.z)-b.d/2);assert.ok(Math.hypot(dx,dz)>4.2,`Building at ${b.x},${b.z} overlaps the road`)}
for(const d of app.extendedWorld.districts){app.visitDistrict(d.id);assert.ok(app.player.position.distanceTo(new THREE.Vector3(d.x,d.y,d.z))<4);assert.ok(app.camera.position.y>app.player.position.y+2);}
app.extendedWorld.setWeather('rain');assert.equal(app.extendedWorld.weather,'rain');app.extendedWorld.setWeather('day');
app.visitDistrict('hills');const start=app.player.position.clone();app.update(1/60);assert.ok(app.player.position.distanceTo(start)<.001);app.reset();
console.log(JSON.stringify({ok:true,meshes,instances,triangles,sceneObjects:app.scene.children.length}));
