import './style.css';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createSceneArt,batchAsset} from './scenes.js';
import {normalize,worldPoint,inside,canRide,stepBike,segmentDistance,calibrateWaterfront} from './layout.js';
import {createMotorcycle} from './prototypes/vehicles.js';
import {installCrowd} from './characters.js';
import {createFinish} from './finish.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {renderPoint,renderHeading} from './projection.js';

const $=id=>document.getElementById(id),asset=path=>new URL(path,document.baseURI).href;
async function read(path){const r=await fetch(asset(path));if(!r.ok)throw Error(`Could not load ${path} (${r.status})`);return r.json()}
async function start(){
 const manifest=await read('scenes/manifest.json'),viewSizes=await read('scenes/view-sizes.json'),specs=await Promise.all(manifest.map(async m=>normalize(calibrateWaterfront(await read(m.spec)),m.key)));
 const renderer=new THREE.WebGLRenderer({canvas:$('world'),antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.type=THREE.PCFShadowMap;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#a9d4ee');scene.fog=new THREE.Fog('#d0e5ec',260,650);
 const camera=new THREE.PerspectiveCamera(56,1,.1,1500),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.48;controls.minDistance=3;controls.maxDistance=500;controls.enabled=false;
 const skyTexture=await new THREE.TextureLoader().loadAsync(asset('textures/sky.webp'));skyTexture.colorSpace=THREE.SRGBColorSpace;skyTexture.mapping=THREE.EquirectangularReflectionMapping;scene.environment=skyTexture;scene.environmentIntensity=.55;const sky=new THREE.Mesh(new THREE.SphereGeometry(900,48,24),new THREE.MeshBasicMaterial({map:skyTexture,side:THREE.BackSide,depthWrite:false,fog:false}));scene.add(sky);
 const ambient=new THREE.HemisphereLight('#dceaff','#b09e6a',1.8);scene.add(ambient);
 const sun=new THREE.DirectionalLight('#fff0cf',2.8);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-50,right:50,top:50,bottom:-50,near:1,far:400});sun.shadow.radius=3;sun.shadow.bias=-.000025;sun.shadow.normalBias=.012;scene.add(sun,sun.target);
 const finish=createFinish(renderer,scene,camera,sky);
 const art=createSceneArt(renderer,skyTexture),worlds=new Map(),state={x:0,y:0,speed:0,heading:0},keys=new Set(),held=new Set();
 const gl=renderer.getContext();let gpuFence=null,renderedView=null,pendingView=null,shadowFrame=0;const shadowCenter=new THREE.Vector3(Infinity,Infinity,Infinity);
 let phase=1,current,world,mode='ride',paused=false,time=0,last=0,lastRender=0,fps=30,remaining=180,cash=1240,deliveryIndex=0,carrying=false,target,reference=false,npcs=[],toastTimer;
 const bike=batchAsset(createMotorcycle('city','#388483'));scene.add(bike);
 const cargo=new THREE.Mesh(new RoundedBoxGeometry(.58,.46,.48,2,.035),new THREE.MeshStandardMaterial({color:'#ff941f',emissive:'#ce620a',emissiveIntensity:.18,roughness:.7}));cargo.position.set(0,1.20,.67);cargo.castShadow=true;bike.add(cargo);
 const strapMaterial=new THREE.MeshStandardMaterial({color:'#33372d',roughness:.85});for(const x of[-.275,.275]){const strap=new THREE.Mesh(new THREE.BoxGeometry(.025,.45,.49),strapMaterial);strap.position.set(x,1.20,.67);bike.add(strap);}for(const y of[.97,1.43]){const strap=new THREE.Mesh(new THREE.BoxGeometry(.57,.023,.025),strapMaterial);strap.position.set(0,y,.918);bike.add(strap);const frontStrap=strap.clone();frontStrap.position.z=.422;bike.add(frontStrap);}
 // Label is authored text, independent of the reference images.
 const cc=document.createElement('canvas');cc.width=256;cc.height=256;const cx=cc.getContext('2d');cx.fillStyle='#fb8e17';cx.fillRect(0,0,256,256);cx.fillStyle='#111a15';cx.font='900 54px Arial';cx.textAlign='center';cx.lineCap='round';cx.lineWidth=7;cx.strokeStyle='#111a15';cx.beginPath();cx.moveTo(116,88);cx.bezierCurveTo(126,72,107,61,107,48);cx.moveTo(103,38);cx.lineTo(103,56);cx.moveTo(110,37);cx.lineTo(110,56);cx.moveTo(117,39);cx.lineTo(117,56);cx.stroke();cx.beginPath();cx.ellipse(145,47,10,17,.3,0,Math.PI*2);cx.fill();cx.beginPath();cx.moveTo(141,58);cx.bezierCurveTo(130,73,132,86,132,90);cx.stroke();cx.beginPath();cx.ellipse(103,88,9,5,.25,0,Math.PI*2);cx.ellipse(146,89,9,5,-.25,0,Math.PI*2);cx.fill();cx.lineWidth=1.6;cx.strokeText('MUD',128,147);cx.strokeText('MEALS',128,191);cx.fillText('MUD',128,147);cx.fillText('MEALS',128,191);const ct=new THREE.CanvasTexture(cc);ct.colorSpace=THREE.SRGBColorSpace;const label=new THREE.Mesh(new THREE.PlaneGeometry(.5,.42),new THREE.MeshStandardMaterial({map:ct,emissiveMap:ct,emissive:'#f07628',emissiveIntensity:.35}));label.position.set(0,1.20,.918);bike.add(label);
 const badgeCanvas=document.createElement('canvas');badgeCanvas.width=badgeCanvas.height=256;const badgeContext=badgeCanvas.getContext('2d'),badgeMap=new THREE.CanvasTexture(badgeCanvas);badgeMap.colorSpace=THREE.SRGBColorSpace;const badge=new THREE.Mesh(new THREE.PlaneGeometry(.25,.25),new THREE.MeshStandardMaterial({map:badgeMap,transparent:true,depthWrite:false}));badge.position.set(0,1.2,.922);bike.add(badge);
 const makeCharacter=await installCrowd([],[bike]);bike.rider.g.position.y-=.1;await art.ready;bike.rider.g.traverse(o=>{if(o.isMesh&&o.material.color?.getHex()===0xe9a13c){o.name='DeliveryHelmet';o.material.color.set('#25323b');o.geometry=new THREE.SphereGeometry(.165,28,18,0,Math.PI*2,0,Math.PI*.78);for(const azimuth of[Math.PI/2,Math.PI*1.5]){const band=new THREE.Mesh(new THREE.SphereGeometry(.167,5,20,azimuth-.13,.26,0,Math.PI*.78),new THREE.MeshStandardMaterial({color:'#ef941d',roughness:.4}));band.name="HelmetStripe";o.add(band);}}if(o.isMesh&&o.material.name?.startsWith('Fabric')&&o.name.startsWith('Top')){o.material.color.set('#349c94');o.material.emissive.set('#125b55');o.material.emissiveIntensity=.45}});
 const marker=new THREE.Mesh(new THREE.TorusGeometry(1.4,.06,8,48),new THREE.MeshBasicMaterial({color:'#f4b63d'}));marker.rotation.x=-Math.PI/2;scene.add(marker);
 function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3500)}
 function resize(){
  let w=innerWidth,h=innerHeight;const size=mode!=='ride'&&mode!=='orbit'&&viewSizes[current?.key]?.[mode];if(size){const aspect=size[0]/size[1];if(w/h>aspect)w=h*aspect;else h=w/aspect;}w=Math.round(w);h=Math.round(h);
  renderer.setSize(w,h,false);Object.assign(renderer.domElement.style,{width:w+'px',height:h+'px',left:(innerWidth-w)/2+'px',top:(innerHeight-h)/2+'px',right:'auto',bottom:'auto'});finish.resize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();lastRender=0;
 }
 addEventListener('resize',resize);resize();
 function getWorld(id){
  if(!worlds.has(id)){
   const layouts=specs.filter(s=>s.phase===id),built=art.build(layouts,id);built.layouts=layouts;built.npcs=[];
   for(const s of layouts)for(const [i,b]of s.buildings.entries()){
    const dir=b.direction,ew=dir==='east'||dir==='west',side=dir==='east'||dir==='north'?1:-1,p=b.entrance;
    const waterfrontWalker=id===1&&s.key==='p1-scene_01'&&b.id==='B_CAFE',netWalker=id===1&&s.key==='p1-scene_02'&&b.id==='B_SEAFOOD',x=waterfrontWalker?67.5:netWalker?68.19:p[0]+(ew?side*2.5:3),y=waterfrontWalker?29:netWalker?18.75:p[1]+(ew?3:side*2.5),start=renderPoint(worldPoint([x,y,0],s.origin),id);
    if(!canRide(x+s.origin[0],y+s.origin[1],layouts,built.obstacles,.3))continue;
    const person=makeCharacter(waterfrontWalker?2:netWalker?0:i*4+id,false,waterfrontWalker),group=new THREE.Group();group.add(person.g);if(netWalker)person.g.traverse(o=>{if(o.isMesh&&(o.name.startsWith('Trousers')||o.name.startsWith('Top'))){o.material.map=null;o.material.color.set(o.name.startsWith('Top')?'#eee9df':'#6d6652');o.material.needsUpdate=true;}});if(waterfrontWalker)person.g.scale.multiplyScalar(1.15);group.position.set(...start);group.rotation.y=waterfrontWalker||netWalker?Math.PI:ew?-Math.PI/2:0;built.root.add(group);built.npcs.push({person,group,start:new THREE.Vector3(...start),along:ew?'z':'x',phase:i*1.7,referenceWalking:waterfrontWalker||netWalker});
   }
   if(id===1){
    const walker=makeCharacter(3,false,true),group=new THREE.Group();
    walker.g.traverse(o=>{if(o.isMesh&&o.name.startsWith('Trousers'))o.visible=false;if(o.isMesh&&o.name.startsWith('Top')){o.material.map=null;o.material.color.set('#b85063');o.material.needsUpdate=true;}});
    const dressCanvas=document.createElement('canvas');dressCanvas.width=dressCanvas.height=256;const dressContext=dressCanvas.getContext('2d');dressContext.fillStyle='#b85063';dressContext.fillRect(0,0,256,256);dressContext.fillStyle='#efc4bc';for(let i=0;i<90;i++){dressContext.beginPath();dressContext.arc((i*73)%256,(i*97)%256,2.5,0,Math.PI*2);dressContext.fill();}const dressMap=new THREE.CanvasTexture(dressCanvas);dressMap.colorSpace=THREE.SRGBColorSpace;
    const skirt=new THREE.Mesh(new THREE.CylinderGeometry(.16,.29,.65,24),new THREE.MeshStandardMaterial({map:dressMap,roughness:.85}));skirt.position.y=.7;skirt.castShadow=true;walker.g.add(skirt);walker.g.updateMatrixWorld(true);walker.bones.pelvis.attach(skirt);
    const bagMaterial=new THREE.MeshStandardMaterial({color:'#303738',roughness:.75}),bag=new THREE.Mesh(new RoundedBoxGeometry(.19,.27,.1,3,.025),bagMaterial);bag.position.set(.3,.92,.1);bag.castShadow=true;walker.g.add(bag);const strap=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(.15,1.43,.1),new THREE.Vector3(.24,1.1,.1),new THREE.Vector3(.3,.94,.1)]),12,.012,6,false),bagMaterial);walker.g.add(strap);
    group.add(walker.g);group.rotation.y=Math.PI;const start=new THREE.Vector3(...renderPoint([75.6,.06,-116.3],id));group.position.copy(start);built.root.add(group);built.npcs.push({person:walker,group,start,along:'z',phase:1,referenceWalking:true});
    for(const [i,x]of[53,57,61].entries()){const person=makeCharacter(i*4+2,true);person.g.position.set(...renderPoint([x,person.g.position.y,-27.6],id));person.g.rotation.y=Math.PI;built.root.add(person.g);}for(const [i,y]of[31.3,33.8].entries()){const person=makeCharacter(i*4+2,true);person.g.position.set(...renderPoint([65.3,person.g.position.y,-(y+.85)],id));person.g.rotation.y=0;person.g.traverse(o=>{if(o.isMesh&&o.name.startsWith('Top'))o.material.color.set(i===0?'#43a2b0':'#eedcc3');});built.root.add(person.g);}for(const [x,y]of[[61,50.3]]){const person=makeCharacter(Math.floor(y)%12);person.g.position.set(...renderPoint([x,person.g.position.y,-y],id));built.root.add(person.g);}}
   for(const s of layouts)for(const b of s.buildings)if(b.id==='B_SEAFOOD'||b.id==='B_CAFE'&&s.key==='p1-scene_03'||/RESTAURANT/.test(b.id)){
    const [x0,y0,x1,y1]=b.rect,ew=b.direction==='east'||b.direction==='west',along=[-((ew?y1-y0:x1-x0)/2)+3,((ew?y1-y0:x1-x0)/2)-3];
    for(const [i,a]of along.entries()){const x=ew?(b.direction==='east'?x1+1.2:x0-1.8):(x0+x1)/2+a,y=ew?(y0+y1)/2+a+.75:(b.direction==='north'?y1+1.05:y0-1.05),person=makeCharacter(i*4+2,true);const p=worldPoint([x,y,0],s.origin);p[1]+=person.g.position.y;person.g.position.set(...renderPoint(p,id));person.g.rotation.y=ew?0:b.direction==='north'?Math.PI:0;person.g.traverse(o=>{if(o.isMesh&&o.name.startsWith('Top'))o.material.color.set(i?'#e6d8bf':'#3d9fba');});built.root.add(person.g);}
   }
   for(const actor of built.actors)if(actor.userData.assetType==='autorickshaw-prototype'){const driver=makeCharacter(2,true);driver.g.name='SceneDriver';driver.g.position.y+=.2;driver.g.position.z=-.385;driver.g.rotation.y=Math.PI;actor.add(driver.g);}
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
  marker.position.set(...renderPoint([target.x,.12,-target.y],phase));$('order-state').textContent=carrying?'DELIVER ORDER':'PICK UP ORDER';$('order-name').textContent=target.name;$('deliver').textContent=carrying?'Deliver meal':'Collect meal';
 }
 function interact(){
  if(mode!=='ride'||Math.hypot(state.x-target.x,state.y-target.y)>4.5||Math.abs(state.speed)>1)return;
  if(carrying){cash+=remaining>0?280:140;$('cash').textContent=cash.toLocaleString('en-IN');carrying=false;deliveryIndex++;remaining=180;toast('Delivered! Your next pickup is ready.');}
  else{carrying=true;remaining=180;toast('Meal collected. Ride to the customer.');}setTarget();
 }
 function populateCameras(){const options=[['ride','Follow rider'],...current.reference_views.map(v=>[v.file,v.file.replace('.png','').replace(/^\d+_/,'').replaceAll('_',' ')])];$('camera-select').replaceChildren(...options.map(([value,text])=>new Option(text,value)));}
 function selectPhase(id,sceneKey){
  keys.clear();held.clear();if(world)scene.remove(world.root);phase=id;bike.scale.setScalar(id===1?1:.85);bike.rider.g.traverse(o=>{if(o.name==='DeliveryHelmet')o.material.color.set(id===1?'#25323b':'#249eaf');if(o.name==='HelmetStripe')o.visible=id===1;if(o.isMesh&&o.material.name?.startsWith('Fabric')&&o.name.startsWith('Top'))o.material.color.set(id===1?'#349c94':'#555064');});label.visible=id===1;world=getWorld(id);scene.add(world.root);npcs=world.npcs;
  $('phase').value=String(id);$('scene-select').replaceChildren(...world.layouts.map(s=>new Option(s.scene.name,s.key)));selectScene(sceneKey||world.layouts[0].key);scene.fog.color.set(id===1?'#cee5eb':'#d6dfde');scene.background.set(id===1?'#a9d4ee':'#b7d1df');
 }
 function selectScene(key){
  current=world.layouts.find(s=>s.key===key)||world.layouts[0];$('scene-select').value=current.key;
  const p=current.props.find(p=>/rider|player/.test(p.type.toLowerCase())),pos=p?.position||current.roads[0].centerline[0];state.x=pos[0]+current.origin[0];state.y=pos[1]+current.origin[1];state.heading={north:0,east:Math.PI/2,south:Math.PI,west:-Math.PI/2}[p?.heading]||0;bike.scale.setScalar(phase===1||current.key==='p2-scene_03'||current.key==='p2-scene_04'?1:.85);bike.rider.g.traverse(o=>{if(o.isMesh&&o.name.startsWith('Top')&&o.material.name?.startsWith('Fabric')){const teal=phase===1||current.key==='p2-scene_03';o.material.color.set(teal?'#349c94':current.key==='p2-scene_04'?'#3c6f8a':'#555064');o.material.emissive.set(teal?'#125b55':'#201e2a');o.material.emissiveIntensity=teal?.45:.1;}});label.visible=phase===1&&current.key!=='p1-scene_03';bike.rider.g.traverse(o=>{if(o.name==='DeliveryHelmet')o.material.color.set(phase===1&&current.terrain.water_region_xy?'#25323b':'#249eaf');if(o.name==='HelmetStripe')o.visible=phase===1&&!!current.terrain.water_region_xy;});badge.visible=phase===2&&['p2-scene_02','p2-scene_04'].includes(current.key);badgeContext.clearRect(0,0,256,256);badgeContext.fillStyle=badgeContext.strokeStyle='#fff6df';if(current.key==='p2-scene_04'){badgeContext.beginPath();badgeContext.arc(128,128,65,0,Math.PI*2);badgeContext.fill();}else{badgeContext.lineWidth=9;badgeContext.beginPath();badgeContext.ellipse(115,130,70,22,0,0,Math.PI);badgeContext.moveTo(45,130);badgeContext.bezierCurveTo(52,210,170,210,185,130);badgeContext.moveTo(185,132);badgeContext.bezierCurveTo(245,117,230,193,181,173);badgeContext.moveTo(58,206);badgeContext.lineTo(194,206);badgeContext.moveTo(96,103);badgeContext.bezierCurveTo(128,78,80,58,110,28);badgeContext.moveTo(140,103);badgeContext.bezierCurveTo(169,72,121,64,145,35);badgeContext.stroke();}badgeMap.needsUpdate=true;state.speed=0;populateCameras();resetOrder();setCamera('ride');syncBike();cameraRide(true);updateURL();$('place').textContent=phase===1?'FORT KOCHI':'KOCHI URBAN';$('street').textContent=current.scene.name;
 }
 function updateURL(){const u=new URL(location.href);u.searchParams.set('phase',String(phase));u.searchParams.set('scene',current.key);history.replaceState(null,'',u);}
 function syncBike(){bike.position.set(...renderPoint([state.x,.07,-state.y],phase));bike.rotation.y=-renderHeading(state.heading,state.y,phase);}
 function cameraRide(immediate=false){
  const settings=phase===1?(current?.key==='p1-scene_01'?[6.2,4.2,5,1,1,-.4]:current?.key==='p1-scene_02'?[4.9,2.7,5,1.35,.4,.3]:current?.key==='p1-scene_04'?[4.35,2.45,5,1.33,1,-.4]:[4.9,2.45,5,1.85,1,-.4]):({ 'p2-scene_01':[8.5,4.4,6,1,.4,.35],'p2-scene_02':[6.3,3.8,6,1.1,.4,.35],'p2-scene_03':[7,2.6,6,.85,1.65,-1],'p2-scene_04':[5.2,2.2,6,1.65,1.2,.8]})[current.key];
  const [behind,height,ahead,aimHeight,lateral,aimLateral]=settings,direction=renderHeading(state.heading,state.y,phase),forward=new THREE.Vector3(Math.sin(direction),0,-Math.cos(direction)),right=new THREE.Vector3(Math.cos(direction),0,Math.sin(direction)),p=bike.position.clone(),eye=p.clone().addScaledVector(forward,-behind).addScaledVector(right,lateral),aim=p.clone().addScaledVector(forward,ahead).addScaledVector(right,aimLateral);eye.y=height;aim.y=aimHeight;if(immediate)camera.position.copy(eye);else camera.position.lerp(eye,.14);camera.lookAt(aim);return aim;
 }
 function setCamera(value){
  renderer.shadowMap.needsUpdate=true;
  renderedView=null;mode=value;controls.enabled=value==='orbit';$('camera-select').value=value==='orbit'?'01_MASTER_SPATIAL.png':value;state.speed=0;keys.clear();held.clear();
  if(value==='ride'){camera.fov=50;cameraRide(true);if(reference)toggleReference(false)}
  else{
   const v=current.reference_views.find(v=>v.file===(value==='orbit'?'01_MASTER_SPATIAL.png':value))||current.reference_views[0];camera.position.set(...renderPoint(worldPoint(v.camera_position_m,current.origin),phase));controls.target.set(...renderPoint(worldPoint(v.target_position_m,current.origin),phase));camera.lookAt(controls.target);camera.fov=value.startsWith('01')||value==='orbit'?48:56;setReferenceImage(v);
  }
  if(value==='02_PLAYER_GAMEPLAY.png'){controls.target.copy(cameraRide(true));camera.fov=50;}
  resize();camera.updateProjectionMatrix();$('ride-view').classList.toggle('active',value==='ride');$('overview').classList.toggle('active',value==='orbit');marker.visible=value==='ride';$('order').style.visibility=value==='ride'?'visible':'hidden';
  if(value!=='ride')for(const n of npcs){n.group.position.copy(n.start);n.person.animate(1.2,0,n.referenceWalking||false,0)}
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
  for(const s of world.layouts){const ox=s.origin[0],oy=s.origin[1],water=s.terrain.water_region_xy;if(water){const r=[Math.min(...water.map(p=>p[0])),0,120,s.scene.playable_size_m.north_south];map.fillStyle='#79cdd0';map.fillRect(px(r[0]+ox),py(r[3]+oy),(r[2]-r[0])*scale,(r[3]-r[1])*scale)}if(s.terrain.canal_rect){const r=s.terrain.canal_rect;map.fillStyle='#91b3ac';map.fillRect(px(r[0]+ox),py(r[3]+oy),(r[2]-r[0])*scale,(r[3]-r[1])*scale)}
   for(const r of s.roads){map.strokeStyle='#f6f0df';map.lineWidth=r.width_m*scale;map.beginPath();for(const [i,p]of r.centerline.entries()){const x=px(p[0]+ox),y=py(p[1]+oy);if(i)map.lineTo(x,y);else map.moveTo(x,y)}map.stroke()}
   for(const b of s.buildings){const r=b.rect;map.fillStyle='#c39065';map.fillRect(px(r[0]+ox),py(r[3]+oy),(r[2]-r[0])*scale,(r[3]-r[1])*scale)}
  }
  map.fillStyle='#eda544';map.beginPath();map.arc(px(target.x),py(target.y),5,0,Math.PI*2);map.fill();map.save();map.translate(120,120);map.rotate(state.heading);map.fillStyle='#245842';map.beginPath();map.moveTo(0,-8);map.lineTo(-5,6);map.lineTo(5,6);map.closePath();map.fill();map.restore();
 }
 function frame(ms){
  requestAnimationFrame(frame);if(document.hidden)return;const dt=last?Math.min((ms-last)/1000,.05):0;last=ms;
  if(!paused&&mode==='ride'){
   const active=k=>keys.has(k)||held.has(k),input={forward:active('forward'),brake:active('brake'),steer:Number(active('right'))-Number(active('left'))};
   stepBike(state,input,dt,(x,y)=>{const checks=[0,.6,-.65];return checks.every(d=>canRide(x+Math.sin(state.heading)*d,y+Math.cos(state.heading)*d,world.layouts,world.obstacles,.38))});syncBike();time+=dt;
   if(carrying)remaining=Math.max(0,remaining-dt);
   const inScene=world.layouts.find(s=>inside(state.x-s.origin[0],state.y-s.origin[1],[0,0,s.scene.playable_size_m.east_west,s.scene.playable_size_m.north_south]));
   if(inScene&&inScene!==current){current=inScene;$('scene-select').value=current.key;$('street').textContent=current.scene.name;populateCameras();updateURL();}
   for(const n of npcs){const distance=n.group.position.distanceToSquared(bike.position);if(distance<10000){const wave=Math.sin(time*.6+n.phase);n.group.position.copy(n.start);n.group.position[n.along]+=wave*.4;n.person.animate(time,Math.abs(Math.cos(time*.6+n.phase))*.15,false,0);}}
  }
  if(gpuFence){if(gl.clientWaitSync(gpuFence,0,0)===gl.TIMEOUT_EXPIRED)return;gl.deleteSync(gpuFence);gpuFence=null;if(pendingView===`${current.key}:${mode}`)renderedView=pendingView;pendingView=null;}
  if(ms-lastRender<1000/fps)return;
  if((paused||mode!=='ride')&&lastRender!==0&&!controls.enabled)return;
  lastRender=ms;if(mode==='ride')cameraRide();if(controls.enabled)controls.update();
  for(const n of npcs)n.group.visible=n.group.position.distanceToSquared(camera.position)<(mode==='ride'?4900:48400);for(const actor of world.actors)actor.visible=actor.position.distanceToSquared(camera.position)<(mode==='ride'?16900:90000);
  const center=mode==='ride'?bike.position:controls.target;if(center.distanceToSquared(shadowCenter)>1||++shadowFrame%8===0)renderer.shadowMap.needsUpdate=true;if(renderer.shadowMap.needsUpdate)shadowCenter.copy(center);sky.position.copy(camera.position);sun.target.position.copy(center);sun.position.copy(center).add(new THREE.Vector3(60,85,35));
  const dist=Math.hypot(state.x-target.x,state.y-target.y);$('distance').textContent=Math.round(dist);$('deliver').disabled=dist>4.5||Math.abs(state.speed)>1||mode!=='ride';$('speed').textContent=Math.round(Math.abs(state.speed)*3.6);$('timer').textContent=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(Math.floor(remaining%60)).padStart(2,'0')}`;marker.scale.setScalar(1+Math.sin(time*3)*.05);minimap();finish.render();pendingView=`${current.key}:${mode}`;gpuFence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();
 }
 const params=new URLSearchParams(location.search);selectPhase(params.get('phase')==='2'?2:1,params.get('scene'));if(current.reference_views.some(v=>v.file===params.get('camera')))setCamera(params.get('camera'));$('loading').hidden=true;requestAnimationFrame(frame);
 // Read-only runtime inspection for geometry audits and real browser captures.
 window.mudMeals={get calibration(){const helmet=bike.rider.g.getObjectByName('DeliveryHelmet');return{camera:camera.position.toArray(),target:controls.target.toArray(),fov:camera.fov,head:new THREE.Box3().setFromObject(helmet).getCenter(new THREE.Vector3()).toArray(),cargo:label.getWorldPosition(new THREE.Vector3()).toArray(),wheel:bike.localToWorld(new THREE.Vector3(0,.01,.661)).toArray()};},tuneLighting({toneMapping,exposure,hemisphere,sunIntensity,occlusion}){if(toneMapping)renderer.toneMapping=toneMapping==='aces'?THREE.ACESFilmicToneMapping:THREE.NeutralToneMapping;if(exposure!==undefined)renderer.toneMappingExposure=exposure;if(hemisphere!==undefined)ambient.intensity=hemisphere;if(sunIntensity!==undefined)sun.intensity=sunIntensity;if(occlusion!==undefined)finish.setAOIntensity(occlusion);lastRender=0;renderedView=null;},tuneCamera({position,target,fov}){camera.position.set(...position);controls.target.set(...target);camera.lookAt(controls.target);camera.fov=fov;camera.updateProjectionMatrix();lastRender=0;renderedView=null;},get renderedView(){return renderedView},get state(){return {...state}},get scene(){return current.key},get phase(){return phase},get mode(){return mode},get paused(){return paused},get carrying(){return carrying},get cash(){return cash},get target(){return {...target}},get audit(){return {scenes:world.layouts.map(s=>s.key),objects:world.objects,bays:world.bays,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles}},selectScene,setCamera,selectPhase};
}
start().catch(error=>{console.error(error);$('loading').hidden=false;$('loading').replaceChildren();const title=document.createElement('strong');title.textContent='Scene could not load';const message=document.createElement('p');message.textContent=error.message;const retry=document.createElement('button');retry.textContent='Reload';retry.onclick=()=>location.reload();$('loading').append(title,message,retry);});
