import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildPerson } from './person.js';
import { buildAuto } from './auto.js';

const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('#review'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color('#c8c9c4');const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;scene.environmentIntensity=.65;
scene.add(new THREE.HemisphereLight('#dce3e7','#62594d',.65));const sun=new THREE.DirectionalLight('#fff7ec',2.7);sun.position.set(-3,6,4);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:20});sun.shadow.normalBias=.01;sun.shadow.bias=-.00005;scene.add(sun);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({color:'#a8ada5',roughness:.98}));ground.rotation.x=-Math.PI/2;ground.position.y=-.012;ground.receiveShadow=true;scene.add(ground);
const camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.02,80),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=.25;controls.maxDistance=12;controls.maxPolarAngle=Math.PI*.49;
const data=await fetch(new URL('review/human-base.json',document.baseURI)).then(r=>{if(!r.ok)throw Error('Anatomical asset missing');return r.json()});
const person=buildPerson(data),auto=buildAuto();
function grain(kind){const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#b9b9b9';ctx.fillRect(0,0,256,256);for(let i=0;i<7000;i++){const x=i*67%251,y=i*139%253;ctx.fillStyle=i%2?'#ffffff20':'#00000018';ctx.fillRect(x,y,1,kind==='cloth'?3:1);}if(kind==='cloth'){ctx.strokeStyle='#60606035';ctx.lineWidth=.5;for(let i=0;i<256;i+=4){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,256);ctx.moveTo(0,i);ctx.lineTo(256,i);ctx.stroke();}}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=renderer.capabilities.getMaxAnisotropy();return t;}
const clothGrain=grain('cloth'),skinGrain=grain('skin');
for(const model of[person,auto])model.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.userData.surface){m.bumpMap=m.userData.surface==='cloth'?clothGrain:skinGrain;m.bumpScale=m.userData.surface==='cloth'?.00025:.00012;m.needsUpdate=true;}});
scene.add(person,auto);document.querySelector('#loading').remove();
function setView(view){person.visible=view==='person'||view==='face'||view==='pair';auto.visible=!['person','face'].includes(view);person.position.set(view==='pair'?-1.2:0,0,view==='pair'?.35:0);auto.position.set(view==='pair'?.85:0,0,0);person.rotation.y=0;auto.rotation.y=0;
 const views={person:[[2.15,1.6,3.1],[0,.91,0]],face:[[.33,1.66,.85],[0,1.61,.11]],auto:[[3.4,2.1,-4.6],[0,.83,0]],side:[[4.6,1.5,0],[0,.83,0]],pair:[[4,2.7,-6.2],[0,.85,0]]};const [pos,target]=views[view]||views.person;camera.position.set(...pos);controls.target.set(...target);controls.update();renderer.render(scene,camera);document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));setView('person');
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera)});
window.__ASSET_REVIEW__={scene,camera,renderer,person,auto,setView,render:()=>renderer.render(scene,camera)};
