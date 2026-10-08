import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildPerson } from './person.js';
import { buildAuto } from './auto.js';
import { buildVehiclePrototypes } from './vehicles.js';

async function startReview(){
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('#review'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color('#c8c9c4');const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;scene.environmentIntensity=.65;
scene.add(new THREE.HemisphereLight('#dce3e7','#62594d',.65));const sun=new THREE.DirectionalLight('#fff7ec',2.7);sun.position.set(-8,15,7);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-12,right:12,top:12,bottom:-12,near:.1,far:40});sun.shadow.normalBias=.04;sun.shadow.bias=.00015;scene.add(sun);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({color:'#a8ada5',roughness:.98}));ground.rotation.x=-Math.PI/2;ground.position.y=-.002;ground.receiveShadow=true;scene.add(ground);
const camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.02,80),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=.25;controls.maxDistance=40;controls.maxPolarAngle=Math.PI*.49;
const person=await buildPerson().catch(error=>{const label=document.querySelector('#loading');label.textContent='Human asset failed to load. Please reload to retry.';label.classList.add('error');throw error}),auto=buildAuto(),vehicles=buildVehiclePrototypes();
function grain(kind){const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#b9b9b9';ctx.fillRect(0,0,256,256);for(let i=0;i<7000;i++){const x=i*67%251,y=i*139%253;ctx.fillStyle=i%2?'#ffffff20':'#00000018';ctx.fillRect(x,y,1,kind==='cloth'?3:1);}if(kind==='cloth'){ctx.strokeStyle='#60606035';ctx.lineWidth=.5;for(let i=0;i<256;i+=4){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,256);ctx.moveTo(0,i);ctx.lineTo(256,i);ctx.stroke();}}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=renderer.capabilities.getMaxAnisotropy();return t;}
const clothGrain=grain('cloth'),skinGrain=grain('skin');
for(const model of[person,auto,...Object.values(vehicles)])model.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.userData.surface){m.bumpMap=m.userData.surface==='cloth'?clothGrain:skinGrain;m.bumpScale=m.userData.surface==='cloth'?.0006:.00012;m.needsUpdate=true;}});
scene.add(person,auto,...Object.values(vehicles));document.querySelector('#loading').remove();
let selectedVehicle='auto';
function setView(view){
 if(!['person','face','front','back','hands','feet','auto','side','auto-front','auto-rear','cabin','pair','fleet',...Object.keys(vehicles).flatMap(name=>[name,name+'-front',name+'-side',name+'-rear'])].includes(view))view='person';
 document.querySelector('#vehicle-angle').disabled=['person','face','front','back','hands','feet','pair','cabin','fleet'].includes(view);
 const parts=view.split('-'),kind=parts[0],angle=parts[1]||'three';
 for(const model of Object.values(vehicles)){model.visible=false;model.position.set(0,0,0);model.rotation.y=0;}
 if(vehicles[kind]||view==='fleet'){
  person.visible=view==='fleet';person.position.set(-7.2,0,-2.9);auto.visible=view==='fleet';auto.position.set(4.1,0,-2.08);
  let pos,target;
  if(view==='fleet'){
   selectedVehicle='fleet';
   const xs={car:-5.5,van:-2.65,bus:.5,bike:6.3};
   for(const [name,model]of Object.entries(vehicles)){model.visible=true;model.position.set(xs[name],0,model.userData.bodyDimensions.length/2-3.4);}
   pos=[12,6,-18];target=[0,1.3,.5];
  }else{
   const model=vehicles[kind];model.visible=true;selectedVehicle=kind;
   const {length:l,height:h}=model.userData.bodyDimensions;
   target=[0,h*.48,0];pos=angle==='front'?[0,h*.8,-l*1.6]:angle==='side'?[l*1.7,h*.75,0]:angle==='rear'?[l*.9,h*1.2,l*1.4]:[l*1.05,h*1.4,-l*1.35];
  }
  controls.enableDamping=false;camera.position.set(...pos);controls.target.set(...target);controls.update();controls.enableDamping=true;renderer.render(scene,camera);
  document.querySelector('header h1').textContent=view==='fleet'?'Original Mud fleet · Scale review':vehicles[kind].name;
  document.querySelector('header p').textContent='Original designs · Real metre scale · Drag to inspect · Pending visual approval';
  document.querySelector('#vehicle-select').value=view==='fleet'?'fleet':kind;
  document.querySelector('#vehicle-angle').value=angle;
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.remove('active'));return;
 }
 selectedVehicle='auto';document.querySelector('#vehicle-select').value='auto';document.querySelector('#vehicle-angle').value=({'auto-front':'front',side:'side','auto-rear':'rear'}[view]||'three');
 const humanViews=['person','face','front','back','hands','feet'];person.visible=humanViews.includes(view)||view==='pair';auto.visible=!humanViews.includes(view);person.position.set(view==='pair'?-1.2:0,0,view==='pair'?.35:0);auto.position.set(view==='pair'?.85:0,0,0);person.rotation.y=0;auto.rotation.y=0;
 const vehicleView=['auto','side','auto-front','auto-rear','cabin'].includes(view);document.querySelector('header h1').textContent=vehicleView?'Mud C3 · Vehicle review':view==='pair'?'Human / vehicle scale review':'Textured human · Visual review';document.querySelector('header p').textContent=vehicleView?'Original three-wheeler design · Real metre scale · Drag to inspect':view==='pair'?'1.75 m person beside the prototype · Review before world replacement':'1.75 m customer prototype · Drag to rotate · Pinch or scroll to zoom';
 const views={person:[[1.65,1.45,3.2],[0,.91,0]],face:[[.28,1.67,.83],[0,1.61,.11]],front:[[0,1.35,3.7],[0,.91,0]],back:[[-1.9,1.4,-3.25],[0,.91,0]],hands:[[.68,1.06,.64],[.24,.83,.045]],feet:[[.48,.36,.67],[0,.09,.06]],auto:[[3.4,2.1,-4.6],[0,.83,0]],side:[[4.6,1.5,0],[0,.83,0]],'auto-front':[[0,1.35,-4.3],[0,.85,-.25]],'auto-rear':[[2.8,1.8,4.0],[0,.85,.25]],cabin:[[1.85,1.29,.01],[0,.95,.38]],pair:[[4,2.7,-6.2],[0,.85,0]]};const [pos,target]=views[view]||views.person;controls.enableDamping=false;camera.position.set(...pos);controls.target.set(...target);if(innerHeight<650&&['person','front','back'].includes(view)){controls.target.y=1;camera.position.sub(controls.target).multiplyScalar(1.18).add(controls.target);}controls.update();controls.enableDamping=true;renderer.render(scene,camera);document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));}
document.querySelector('#vehicle-select').onchange=e=>{selectedVehicle=e.target.value;setView(selectedVehicle);};
document.querySelector('#vehicle-angle').onchange=e=>{const angle=e.target.value;setView(selectedVehicle==='auto'?({three:'auto',front:'auto-front',side:'side',rear:'auto-rear'}[angle]):selectedVehicle==='fleet'?'fleet':selectedVehicle+(angle==='three'?'':'-'+angle));};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{selectedVehicle='auto';setView(b.dataset.view)});setView(new URLSearchParams(location.search).get('view')||'person');
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.render(scene,camera)});renderer.setAnimationLoop(()=>{if(controls.update())renderer.render(scene,camera)});
window.__ASSET_REVIEW__={scene,camera,renderer,person,auto,vehicles,setView,render:()=>renderer.render(scene,camera)};
}

startReview().catch(error=>{
 const webglFailure=/WebGL context/i.test(error.message);
 const label=document.querySelector('#loading')||document.body.appendChild(document.createElement('section'));
 label.id='loading';label.classList.add('error');label.setAttribute('role','alert');label.replaceChildren();
 const title=document.createElement('strong');title.textContent=webglFailure?'3D review unavailable: WebGL is disabled or could not start.':'The review could not start.';label.append(title);
 const help=document.createElement('p');help.textContent=webglFailure?'In Chrome or Edge, enable “Use graphics acceleration when available” in Settings → System, then fully restart the browser. Check chrome://gpu (or edge://gpu): WebGL2 should be available. Close other game/review tabs and retry.':'Reload to retry loading the review asset. If it still fails, check the browser console and network requests.';label.append(help);
 const retry=document.createElement('button');retry.textContent='Reload review';retry.onclick=()=>location.reload();label.append(retry);
 const evidence=document.createElement('p');evidence.textContent='Saved Chromium screenshots from the Three.js review (not a live 3D fallback): ';label.append(evidence);
 for(const [view,text]of[['person','Full body'],['face','Face detail']]){const link=document.createElement('a');link.href=new URL(`review/renders/${view}.png`,document.baseURI).href;link.textContent=text;evidence.append(link,document.createTextNode(' '));}
 document.querySelectorAll('nav button,nav select').forEach(control=>control.disabled=true);
 window.__ASSET_REVIEW_ERROR__={kind:webglFailure?'webgl':'startup',message:error.message};
 console.error('Asset review startup failed:',error);
});
