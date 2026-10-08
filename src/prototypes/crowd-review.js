import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {loadCrowd} from '../characters.js';

async function start(){
 const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('#review'),antialias:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#c8c9c4');
 scene.environment=new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(),.04).texture;scene.environmentIntensity=.65;
 scene.add(new THREE.HemisphereLight('#dce3e7','#62594d',.65));
 const sun=new THREE.DirectionalLight('#fff7ec',2.7);sun.position.set(-3,6,4);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:.1,far:20});sun.shadow.normalBias=.003;scene.add(sun);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(25,25),new THREE.MeshStandardMaterial({color:'#a8ada5',roughness:.98}));ground.rotation.x=-Math.PI/2;ground.position.y=-.002;ground.receiveShadow=true;scene.add(ground);
 const camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.05,60),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.49;
 const makeCharacter=await loadCrowd(),people=[];
 for(let i=0;i<4;i++){const rig=makeCharacter(i),sitting=makeCharacter(i,true);rig.g.position.x=sitting.g.position.x=(i-1.5)*1.05;scene.add(rig.g,sitting.g);sitting.g.visible=false;people.push({rig,sitting});}
 let view='standing',time=0;
 function setView(value){view=value;time=0;
  for(const {rig,sitting}of people){rig.g.visible=view!=='seated';sitting.g.visible=view==='seated';rig.animate(.5,0,view==='walking',view==='greeting'?1:0);sitting.animate(0,0,false,0);}
  controls.enableDamping=false;camera.position.set(.6,1.8,6.3);controls.target.set(0,.9,0);controls.update();controls.enableDamping=true;
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));renderer.render(scene,camera);
 }
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
 const clock=new THREE.Clock();function frame(){const dt=Math.min(clock.getDelta(),.05);time+=dt;
  if(view==='walking'||view==='greeting')for(const {rig}of people)rig.animate(time*4.96,time,view==='walking',view==='greeting'?1:0);
  if(controls.update()||view==='walking'||view==='greeting')renderer.render(scene,camera);
 }
 document.querySelector('#loading').remove();setView('standing');renderer.setAnimationLoop(frame);
 addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.render(scene,camera)});
 window.__CROWD_REVIEW__={scene,camera,renderer,people,setView,makeCharacter};
}
start().catch(error=>{document.querySelector('#loading').textContent=error.message;console.error(error)});
