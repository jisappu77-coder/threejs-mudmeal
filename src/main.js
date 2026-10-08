import './style.css';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createSceneArt,batchAsset} from './scenes.js';
import {normalize,worldPoint,inside,canRide,stepBike,segmentDistance} from './layout.js';
import {createMotorcycle} from './prototypes/vehicles.js';
import {installCrowd} from './characters.js';

const $=id=>document.getElementById(id),asset=path=>new URL(path,document.baseURI).href;
async function read(path){const r=await fetch(asset(path));if(!r.ok)throw Error(`Could not load ${path} (${r.status})`);return r.json()}
async function start(){
 const manifest=await read('scenes/manifest.json'),specs=await Promise.all(manifest.map(async m=>normalize(await read(m.spec),m.key)));
 const renderer=new THREE.WebGLRenderer({canvas:$('world'),antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#a9d4ee');scene.fog=new THREE.Fog('#d0e5ec',260,650);
 const camera=new THREE.PerspectiveCamera(56,1,.1,1500),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.48;controls.minDistance=3;controls.maxDistance=500;controls.enabled=false;
 const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(new RoomEnvironment(),.04);scene.environment=environment.texture;scene.environmentIntensity=.3;pmrem.dispose();
 const skyCanvas=document.createElement('canvas');skyCanvas.width=512;skyCanvas.height=256;const skyCtx=skyCanvas.getContext('2d'),skyGradient=skyCtx.createLinearGradient(0,0,0,256);skyGradient.addColorStop(0,'#5aa8df');skyGradient.addColorStop(.55,'#add8ef');skyGradient.addColorStop(1,'#e0eef1');skyCtx.fillStyle=skyGradient;skyCtx.fillRect(0,0,512,256);for(let i=0;i<23;i++){skyCtx.fillStyle='#ffffff24';for(let j=0;j<6;j++){skyCtx.beginPath();skyCtx.ellipse((i*127)%512+j*8,118+(i*37)%55,18+j*2,3+j%3*2,0,0,Math.PI*2);skyCtx.fill()}}const skyTexture=new THREE.CanvasTexture(skyCanvas);skyTexture.colorSpace=THREE.SRGBColorSpace;const sky=new THREE.Mesh(new THREE.SphereGeometry(900,24,12),new THREE.MeshBasicMaterial({map:skyTexture,side:THREE.BackSide,depthWrite:false,fog:false}));scene.add(sky);
 scene.add(new THREE.HemisphereLight('#e1f4ff','#6b7651',1.6));
 const sun=new THREE.DirectionalLight('#fff1d5',2.8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-100,right:100,top:100,bottom:-100,near:1,far:400});sun.shadow.bias=-.0001;sun.shadow.normalBias=.03;scene.add(sun,sun.target);
 const art=createSceneArt(renderer),worlds=new Map(),state={x:0,y:0,speed:0,heading:0},keys=new Set(),held=new Set();
 const gl=renderer.getContext();let gpuFence=null,renderedView=null;
 let phase=1,current,world,mode='ride',paused=false,time=0,last=0,lastRender=0,fps=30,remaining=180,cash=1240,deliveryIndex=0,carrying=false,target,reference=false,npcs=[],toastTimer;
 const bike=batchAsset(createMotorcycle('city','#388483'));scene.add(bike);
 const cargo=new THREE.Mesh(new THREE.BoxGeometry(.52,.46,.47),new THREE.MeshStandardMaterial({color:'#f39b36',roughness:.7}));cargo.position.set(0,1.12,.67);cargo.castShadow=true;bike.add(cargo);
 const border=new THREE.Mesh(new THREE.BoxGeometry(.53,.035,.48),new THREE.MeshStandardMaterial({color:'#263b34'}));border.position.set(0,1.35,.67);bike.add(border);
 // Label is authored text, independent of the reference images.
 const cc=document.createElement('canvas');cc.width=256;cc.height=256;const cx=cc.getContext('2d');cx.fillStyle='#f39b36';cx.fillRect(0,0,256,256);cx.fillStyle='#263b34';cx.font='bold 37px Arial';cx.textAlign='center';cx.fillText('MUD',128,95);cx.fillText('MEALS',128,139);cx.font='18px Arial';cx.fillText('KERALA DELIVERY',128,177);const ct=new THREE.CanvasTexture(cc);ct.colorSpace=THREE.SRGBColorSpace;const label=new THREE.Mesh(new THREE.PlaneGeometry(.4,.4),new THREE.MeshStandardMaterial({map:ct}));label.position.set(0,1.12,.91);bike.add(label);
 const makeCharacter=await installCrowd([],[bike]);bike.rider.g.traverse(o=>{if(o.isMesh&&o.material.name?.startsWith('Fabric'))o.material.color.set('#49877e')});
 const traffic=[];for(let i=0;i<3;i++){const car=(i===2?art.fleet.van:art.fleet.car).clone(true);scene.add(car);traffic.push({car,d:35+i*58,side:i%2?-1:1,stopped:false})}
 const marker=new THREE.Mesh(new THREE.TorusGeometry(1.4,.06,8,48),new THREE.MeshBasicMaterial({color:'#f4b63d'}));marker.rotation.x=-Math.PI/2;scene.add(marker);
 function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3500)}
 function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();lastRender=0}
 addEventListener('resize',resize);resize();
 function getWorld(id){
  if(!worlds.has(id)){
   const layouts=specs.filter(s=>s.phase===id),built=art.build(layouts,id);built.layouts=layouts;built.npcs=[];
   for(const s of layouts)for(const [i,b]of s.buildings.entries()){
    const dir=b.direction,ew=dir==='east'||dir==='west',side=dir==='east'||dir==='north'?1:-1,p=b.entrance;
    const x=p[0]+(ew?side*2.5:3),y=p[1]+(ew?3:side*2.5),start=worldPoint([x,y,0],s.origin);
    if(!canRide(start[0],-start[2],layouts,built.obstacles,.3))continue;
    const person=makeCharacter(i*4+id),group=new THREE.Group();group.add(person.g);group.position.set(...start);group.rotation.y=ew?-Math.PI/2:0;built.root.add(group);built.npcs.push({person,group,start:new THREE.Vector3(...start),along:ew?'z':'x',phase:i*1.7});
   }
   worlds.set(id,built);
  }
  return worlds.get(id);
 }
 function resetOrder(){remaining=180;deliveryIndex=0;carrying=false;setTarget()}
 function setTarget(){
  const bays=world.bays.filter(b=>b.scene===current.key),bay=bays[deliveryIndex%bays.length],r=bay.global;
  target={x:(r[0]+r[2])/2,y:(r[1]+r[3])/2,name:bay.id.replace(/^BAY_|^D_/,'').replaceAll('_',' '),bay};
  if(carrying){
   const home=current.buildings.find(b=>/HOME|HOUSE|APARTMENT|OFFICE|WORKSHOP|SHED/.test(b.id));
   if(home){const p=home.entrance,dir=home.direction;target={x:p[0]+current.origin[0]+(dir==='east'?2:dir==='west'?-2:0),y:p[1]+current.origin[1]+(dir==='north'?2:dir==='south'?-2:0),name:home.name||home.id.replace('B_','')};}
   else if(bays.length>1){const destination=bays[(deliveryIndex+1)%bays.length],r=destination.global;target={x:(r[0]+r[2])/2,y:(r[1]+r[3])/2,name:'Local customer',bay:destination};}
  }
  marker.position.set(target.x,.12,-target.y);$('order-state').textContent=carrying?'DELIVER ORDER':'PICK UP ORDER';$('order-name').textContent=target.name;$('deliver').textContent=carrying?'Deliver meal':'Collect meal';
 }
 function interact(){
  if(mode!=='ride'||Math.hypot(state.x-target.x,state.y-target.y)>4.5||Math.abs(state.speed)>1)return;
  if(carrying){cash+=remaining>0?280:140;$('cash').textContent=cash.toLocaleString('en-IN');carrying=false;deliveryIndex++;remaining=180;toast('Delivered! Your next pickup is ready.');}
  else{carrying=true;remaining=180;toast('Meal collected. Ride to the customer.');}setTarget();
 }
 function populateCameras(){const options=[['ride','Follow rider'],...current.reference_views.map(v=>[v.file,v.file.replace('.png','').replace(/^\d+_/,'').replaceAll('_',' ')])];$('camera-select').replaceChildren(...options.map(([value,text])=>new Option(text,value)));}
 function selectPhase(id,sceneKey){
  keys.clear();held.clear();if(world)scene.remove(world.root);phase=id;world=getWorld(id);scene.add(world.root);npcs=world.npcs;
  $('phase').value=String(id);$('scene-select').replaceChildren(...world.layouts.map(s=>new Option(s.scene.name,s.key)));selectScene(sceneKey||world.layouts[0].key);scene.fog.color.set(id===1?'#cee5eb':'#d6dfde');scene.background.set(id===1?'#a9d4ee':'#b7d1df');
 }
 function selectScene(key){
  current=world.layouts.find(s=>s.key===key)||world.layouts[0];$('scene-select').value=current.key;
  const p=current.props.find(p=>/rider|player/.test(p.type.toLowerCase())),pos=p?.position||current.roads[0].centerline[0];state.x=pos[0]+current.origin[0];state.y=pos[1]+current.origin[1];state.heading={north:0,east:Math.PI/2,south:Math.PI,west:-Math.PI/2}[p?.heading]||0;state.speed=0;populateCameras();resetOrder();setCamera('ride');syncBike();cameraRide(true);updateURL();$('place').textContent=phase===1?'FORT KOCHI':'KOCHI URBAN';$('street').textContent=current.scene.name;
 }
 function updateURL(){const u=new URL(location.href);u.searchParams.set('phase',String(phase));u.searchParams.set('scene',current.key);history.replaceState(null,'',u);}
 function syncBike(){bike.position.set(state.x,.07,-state.y);bike.rotation.y=-state.heading;}
 function cameraRide(immediate=false){const forward=new THREE.Vector3(Math.sin(state.heading),0,-Math.cos(state.heading)),p=bike.position.clone(),eye=p.clone().addScaledVector(forward,-7);eye.y+=3.0;const aim=p.clone().addScaledVector(forward,12);aim.y+=1.5;if(immediate)camera.position.copy(eye);else camera.position.lerp(eye,.14);camera.lookAt(aim);}
 function setCamera(value){
  renderedView=null;mode=value;controls.enabled=value==='orbit';$('camera-select').value=value==='orbit'?'01_MASTER_SPATIAL.png':value;state.speed=0;keys.clear();held.clear();
  if(value==='ride'){camera.fov=56;cameraRide(true);if(reference)toggleReference(false)}
  else{
   const v=current.reference_views.find(v=>v.file===(value==='orbit'?'01_MASTER_SPATIAL.png':value))||current.reference_views[0];camera.position.set(...worldPoint(v.camera_position_m,current.origin));controls.target.set(...worldPoint(v.target_position_m,current.origin));camera.lookAt(controls.target);camera.fov=value.startsWith('01')||value==='orbit'?48:56;setReferenceImage(v);
  }
  camera.updateProjectionMatrix();$('ride-view').classList.toggle('active',value==='ride');$('overview').classList.toggle('active',value==='orbit');marker.visible=value==='ride';$('order').style.visibility=value==='ride'?'visible':'hidden';
  for(const t of traffic)t.car.visible=value==='ride';
  if(value!=='ride')for(const n of npcs){n.group.position.copy(n.start);n.person.animate(0,0,false,0)}
  lastRender=0;
 }
 function setReferenceImage(v){$('reference-image').src=asset(`scenes/${current.key}/${v.file.replace('.png','.webp')}`);$('reference-image').alt=`Supplied ${v.file.replace('.png','')} reference for ${current.scene.name}`;}
 function toggleReference(show=!reference){if(show&&mode==='ride')setCamera('02_PLAYER_GAMEPLAY.png');reference=show;$('reference-panel').hidden=!show;$('reference-toggle').setAttribute('aria-pressed',String(show));if(show){const v=current.reference_views.find(v=>v.file===mode)||current.reference_views[0];setReferenceImage(v);toast('Supplied reference overlay · adjust opacity to compare.');}}
 function pause(){paused=!paused;$('pause').textContent=paused?'▶':'Ⅱ';$('pause').setAttribute('aria-pressed',String(paused));lastRender=0;}
 function hideHUD(){const hidden=$('hud').hidden;$('hud').hidden=!hidden;$('restore-hud').hidden=hidden;$('settings').hidden=true;}
 $('settings-toggle').onclick=()=>{$('settings').hidden=!$('settings').hidden;$('settings-toggle').setAttribute('aria-expanded',String(!$('settings').hidden))};$('settings-close').onclick=()=>{$('settings').hidden=true;$('settings-toggle').setAttribute('aria-expanded','false')};
 $('phase').onchange=e=>selectPhase(Number(e.target.value));$('scene-select').onchange=e=>selectScene(e.target.value);$('camera-select').onchange=e=>setCamera(e.target.value);$('reset').onclick=()=>selectScene(current.key);$('ride-view').onclick=()=>setCamera('ride');$('overview').onclick=()=>setCamera('orbit');$('reference-toggle').onclick=()=>toggleReference();$('reference-close').onclick=()=>toggleReference(false);$('reference-opacity').oninput=e=>$('reference-image').style.opacity=e.target.value;$('deliver').onclick=interact;$('pause').onclick=pause;$('hide-hud').onclick=hideHUD;$('restore-hud').onclick=hideHUD;$('fps').onchange=e=>fps=Number(e.target.value);$('fullscreen').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen().catch(()=>toast('Fullscreen is unavailable in this browser.'));};
 const keyMap={w:'forward',ArrowUp:'forward',s:'brake',ArrowDown:'brake',a:'left',ArrowLeft:'left',d:'right',ArrowRight:'right'};
 addEventListener('keydown',e=>{if(/SELECT|INPUT|BUTTON/.test(document.activeElement.tagName))return;if(keyMap[e.key]){e.preventDefault();if(mode!=='ride')setCamera('ride');keys.add(keyMap[e.key]);}else if(!e.repeat){if(e.code==='Space'){e.preventDefault();pause()}if(e.key.toLowerCase()==='e')interact();if(e.key.toLowerCase()==='h')hideHUD();if(e.key==='Escape'){$('settings').hidden=true;toggleReference(false)}}});
 addEventListener('keyup',e=>keys.delete(keyMap[e.key]));const release=()=>{keys.clear();held.clear()};addEventListener('blur',release);document.addEventListener('visibilitychange',()=>{release();last=0});
 for(const button of document.querySelectorAll('[data-control]')){button.onpointerdown=e=>{if(mode!=='ride')setCamera('ride');e.preventDefault();button.setPointerCapture(e.pointerId);held.add(button.dataset.control)};button.onpointerup=button.onpointercancel=button.onlostpointercapture=()=>held.delete(button.dataset.control);}
 const map=$('minimap').getContext('2d');
 function minimap(){
  const scale=1.3,offset=120,px=x=>offset+(x-state.x)*scale,py=y=>offset-(y-state.y)*scale;map.fillStyle=phase===1?'#bbcc9c':'#bfc4ad';map.fillRect(0,0,240,240);
  for(const s of world.layouts){const ox=s.origin[0],oy=s.origin[1],water=s.terrain.water_region_xy;if(water){const r=[90,0,120,s.scene.playable_size_m.north_south];map.fillStyle='#79cdd0';map.fillRect(px(r[0]+ox),py(r[3]+oy),(r[2]-r[0])*scale,(r[3]-r[1])*scale)}if(s.terrain.canal_rect){const r=s.terrain.canal_rect;map.fillStyle='#91b3ac';map.fillRect(px(r[0]+ox),py(r[3]+oy),(r[2]-r[0])*scale,(r[3]-r[1])*scale)}
   for(const r of s.roads){map.strokeStyle='#f6f0df';map.lineWidth=r.width_m*scale;map.beginPath();for(const [i,p]of r.centerline.entries()){const x=px(p[0]+ox),y=py(p[1]+oy);if(i)map.lineTo(x,y);else map.moveTo(x,y)}map.stroke()}
   for(const b of s.buildings){const r=b.rect;map.fillStyle='#c39065';map.fillRect(px(r[0]+ox),py(r[3]+oy),(r[2]-r[0])*scale,(r[3]-r[1])*scale)}
  }
  map.fillStyle='#eda544';map.beginPath();map.arc(px(target.x),py(target.y),5,0,Math.PI*2);map.fill();map.save();map.translate(120,120);map.rotate(state.heading);map.fillStyle='#245842';map.beginPath();map.moveTo(0,-8);map.lineTo(-5,6);map.lineTo(5,6);map.closePath();map.fill();map.restore();
 }
 function frame(ms){
  requestAnimationFrame(frame);if(document.hidden)return;const dt=last?Math.min((ms-last)/1000,.05):0;last=ms;
  if(!paused&&mode==='ride'){
   const active=k=>keys.has(k)||held.has(k),input={forward:active('forward'),brake:active('brake'),steer:Number(active('right'))-Number(active('left'))};
   stepBike(state,input,dt,(x,y)=>{if(traffic.some(t=>Math.abs(x-t.car.position.x)<1.15&&Math.abs(y+t.car.position.z)<2.3))return false;const checks=[0,.6,-.65];return checks.every(d=>canRide(x+Math.sin(state.heading)*d,y+Math.cos(state.heading)*d,world.layouts,world.obstacles,.38))});syncBike();time+=dt;
   for(const t of traffic){const length=phase===1?190:300,x=(phase===1?72:60)+t.side*2,y=t.side===1?t.d:length-t.d;t.stopped=Math.hypot(state.x-x,state.y-y)<7;if(!t.stopped)t.d=(t.d+5*dt)%length;t.car.position.set(x,.07,-(t.side===1?t.d:length-t.d));t.car.rotation.y=t.side===1?0:Math.PI;}
   if(carrying)remaining=Math.max(0,remaining-dt);
   const inScene=world.layouts.find(s=>inside(state.x-s.origin[0],state.y-s.origin[1],[0,0,s.scene.playable_size_m.east_west,s.scene.playable_size_m.north_south]));
   if(inScene&&inScene!==current){current=inScene;$('scene-select').value=current.key;$('street').textContent=current.scene.name;populateCameras();updateURL();}
   for(const n of npcs){const distance=n.group.position.distanceToSquared(bike.position);if(distance<10000){const wave=Math.sin(time*.6+n.phase);n.group.position.copy(n.start);n.group.position[n.along]+=wave*.4;n.person.animate(time,Math.abs(Math.cos(time*.6+n.phase))*.15,false,0);}}
  }
  if(ms-lastRender<1000/fps)return;
  if((paused||mode!=='ride')&&lastRender!==0&&!controls.enabled)return;
  if(gpuFence){if(gl.clientWaitSync(gpuFence,0,0)===gl.TIMEOUT_EXPIRED)return;gl.deleteSync(gpuFence);gpuFence=null;}
  lastRender=ms;if(mode==='ride')cameraRide();if(controls.enabled)controls.update();
  for(const n of npcs)n.group.visible=n.group.position.distanceToSquared(camera.position)<(mode==='ride'?4900:48400);for(const actor of world.actors)actor.visible=actor.position.distanceToSquared(camera.position)<(mode==='ride'?16900:90000);
  const center=mode==='ride'?bike.position:controls.target;sky.position.copy(camera.position);sun.target.position.copy(center);sun.position.copy(center).add(new THREE.Vector3(-65,100,45));
  const dist=Math.hypot(state.x-target.x,state.y-target.y);$('distance').textContent=Math.round(dist);$('deliver').disabled=dist>4.5||Math.abs(state.speed)>1||mode!=='ride';$('speed').textContent=Math.round(Math.abs(state.speed)*3.6);$('timer').textContent=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(Math.floor(remaining%60)).padStart(2,'0')}`;marker.scale.setScalar(1+Math.sin(time*3)*.05);minimap();renderer.render(scene,camera);renderedView=`${current.key}:${mode}`;gpuFence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();
 }
 const params=new URLSearchParams(location.search);selectPhase(params.get('phase')==='2'?2:1,params.get('scene'));if(current.reference_views.some(v=>v.file===params.get('camera')))setCamera(params.get('camera'));$('loading').hidden=true;requestAnimationFrame(frame);
 // Read-only runtime inspection for geometry audits and real browser captures.
 window.mudMeals={get renderedView(){return renderedView},get state(){return {...state}},get scene(){return current.key},get phase(){return phase},get mode(){return mode},get paused(){return paused},get carrying(){return carrying},get cash(){return cash},get target(){return {...target}},get audit(){return {scenes:world.layouts.map(s=>s.key),objects:world.objects,bays:world.bays,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles}},selectScene,setCamera,selectPhase};
}
start().catch(error=>{console.error(error);$('loading').hidden=false;$('loading').replaceChildren();const title=document.createElement('strong');title.textContent='Scene could not load';const message=document.createElement('p');message.textContent=error.message;const retry=document.createElement('button');retry.textContent='Reload';retry.onclick=()=>location.reload();$('loading').append(title,message,retry);});
