import './style.css';
import './real-map.css';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {setupGraphics,createActorCuller} from './graphics.js';
import {createDriving} from './driving.js';
import {createMotorcycle,buildVehiclePrototypes,motorcycleStyles} from './prototypes/vehicles.js';
import {buildAuto} from './prototypes/auto.js';
import {installCrowd} from './characters.js';
import {createMapDelivery} from './real-map-delivery.js';
import {createMapArt,dressRealMap,createKeralaRoof} from './real-map-art.js';
import {locations,prepareMap,pointInPolygon,segmentDistance} from './real-map-data.js';
import {planWaterfront,createWaterfront} from './kochi-waterfront.js';
import {startFrameLoop} from './frame-loop.js';
import {batchRigidMeshes} from './rigid-batch.js';

async function start(){
 const requested=new URLSearchParams(location.search).get('location'),id=Object.hasOwn(locations,requested)?requested:'kochi',place=locations[id];
 const response=await fetch(new URL(`maps/${id}.json`,document.baseURI),{cache:'no-cache'});if(!response.ok)throw Error('Kochi layout could not load');
 const source=await response.json(),map=prepareMap(source),bounds=map.bounds;
 const waterfrontSite=planWaterfront(map);
 document.querySelector('#place').textContent=place.name;document.querySelector('#description').textContent=place.subtitle;
 document.querySelector('#location').value=id;
 const stage=document.querySelector('#game-stage'),size=()=>stage.getBoundingClientRect(),initialSize=size();
 const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('#real-world'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(initialSize.width,initialSize.height,false);
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#bdd4dd');const fog=new THREE.Fog(scene.background,220,1100);scene.fog=fog;
 // A static sky dome costs one draw call; it follows the same daylight as the street.
 const skyCanvas=document.createElement('canvas');skyCanvas.width=1024;skyCanvas.height=512;const skyCtx=skyCanvas.getContext('2d'),skyGradient=skyCtx.createLinearGradient(0,0,0,512);
 skyGradient.addColorStop(0,'#3882bd');skyGradient.addColorStop(.48,'#89bee1');skyGradient.addColorStop(.72,'#d7e5e8');skyGradient.addColorStop(1,'#d7e5e8');skyCtx.fillStyle=skyGradient;skyCtx.fillRect(0,0,1024,512);
 for(let i=0;i<26;i++){const x=(i*157)%1024,y=150+(i*37)%115;skyCtx.fillStyle='#ffffff35';for(let j=0;j<5;j++){skyCtx.beginPath();skyCtx.ellipse(x+j*16,y-Math.sin(j)*7,35,10+j%2*5,0,0,Math.PI*2);skyCtx.fill();}}
 const skyTexture=new THREE.CanvasTexture(skyCanvas);skyTexture.colorSpace=THREE.SRGBColorSpace;
 const sky=new THREE.Mesh(new THREE.SphereGeometry(2800,24,12),new THREE.MeshBasicMaterial({map:skyTexture,side:THREE.BackSide,depthWrite:false,fog:false}));sky.userData.scenicBackdrop=true;scene.add(sky);
 scene.add(new THREE.HemisphereLight('#d8eafb','#626870',1.2));const sun=new THREE.DirectionalLight('#fff3df',2.8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-65,right:65,top:65,bottom:-65,near:1,far:250});sun.shadow.normalBias=.025;sun.shadow.bias=-.00012;scene.add(sun,sun.target);
 const camera=new THREE.PerspectiveCamera(58,initialSize.width/initialSize.height,.2,6000),graphics=setupGraphics(renderer,scene,camera);let detailed=devicePixelRatio<=1.5;graphics.setQuality(detailed);const quality=document.querySelector('#quality');quality.textContent=detailed?'Detail on':'Detail off';quality.setAttribute('aria-pressed',String(detailed));quality.onclick=()=>{detailed=!detailed;graphics.setQuality(detailed);quality.textContent=detailed?'Detail on':'Detail off';quality.setAttribute('aria-pressed',String(detailed));graphics.render()};
 // Heights and scenic planting are deliberately illustrative; the street layout is project-authored.
 const height=()=>0;
 const material=(color)=>new THREE.MeshStandardMaterial({color,roughness:.85});
 const art=createMapArt(renderer,id),groundMaterial=art.ground,roadMaterial=art.road,roofMaterials=[art.tile,art.cream,art.tile];
 const reflectionFaces=Array.from({length:6},()=>{const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),gradient=ctx.createLinearGradient(0,0,0,128);gradient.addColorStop(0,'#85aab8');gradient.addColorStop(.55,'#d6e0d8');gradient.addColorStop(1,'#244e70');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);return c});scene.environment=new THREE.CubeTexture(reflectionFaces);scene.environment.colorSpace=THREE.SRGBColorSpace;scene.environment.needsUpdate=true;scene.environmentIntensity=.5;
 function batch(geometries,mat){const cells=new Map();for(const g of geometries){g.computeBoundingBox();const p=g.boundingBox.getCenter(new THREE.Vector3()),key=Math.floor(p.x/64)+','+Math.floor(p.z/64);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(g);}for(const items of cells.values()){const merged=mergeGeometries(items);for(const g of items)g.dispose();const mesh=new THREE.Mesh(merged,mat);mesh.castShadow=mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;scene.add(mesh);}}
 const ground=new THREE.PlaneGeometry(bounds.maxX-bounds.minX,bounds.maxZ-bounds.minZ);ground.rotateX(-Math.PI/2);
 const position=ground.attributes.position;for(let i=0;i<position.count;i++)position.setY(i,height(position.getX(i),position.getZ(i)));ground.computeVertexNormals();const terrain=new THREE.Mesh(ground,groundMaterial);terrain.receiveShadow=true;scene.add(terrain);
 function ribbon(original,width,lift){
  const points=[];for(let i=1;i<original.length;i++){const a=original[i-1],b=original[i],n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/3));for(let j=0;j<n;j++)points.push({x:THREE.MathUtils.lerp(a.x,b.x,j/n),z:THREE.MathUtils.lerp(a.z,b.z,j/n)})}points.push(original.at(-1));
  const vertices=[],indices=[],uv=[];let distance=0;
  points.forEach((p,i)=>{if(i)distance+=Math.hypot(p.x-points[i-1].x,p.z-points[i-1].z);const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b.x-a.x,dz=b.z-a.z,l=Math.max(.001,Math.hypot(dx,dz));for(const side of [-1,1]){const x=p.x+side*dz/l*width/2,z=p.z-side*dx/l*width/2;vertices.push(x,height(x,z)+lift,z);uv.push((side+1)*width/2,distance)}if(i<points.length-1){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3);}});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
 }
 batch(map.roads.map(r=>ribbon(r.points,r.width+(id==='kochi'?3:1.8),.045)),art.paving);
 batch(map.roads.map(r=>ribbon(r.points,r.width+.35,.065)),art.cream);
 batch(map.roads.map(r=>ribbon(r.points,r.width,.085)),roadMaterial);
 const paint=[];for(const segment of map.segments.filter(s=>s.width>=6)){const length=Math.hypot(segment.b.x-segment.a.x,segment.b.z-segment.a.z);for(let d=2;d<length-2;d+=6){const a={x:THREE.MathUtils.lerp(segment.a.x,segment.b.x,d/length),z:THREE.MathUtils.lerp(segment.a.z,segment.b.z,d/length)},b={x:THREE.MathUtils.lerp(segment.a.x,segment.b.x,Math.min(d+2.6,length)/length),z:THREE.MathUtils.lerp(segment.a.z,segment.b.z,Math.min(d+2.6,length)/length)};paint.push(ribbon([a,b],.13,.11))}}batch(paint,material('#e4ddc7'));
 const curbs=[],darkCurbs=[],edges=[];
 for(const segment of map.segments.filter(s=>s.name==='Waterfront Road')){
  const dx=segment.b.x-segment.a.x,dz=segment.b.z-segment.a.z,l=Math.hypot(dx,dz),nx=dz/l,nz=-dx/l;
  for(const side of [-1,1]){
   const shift=(p,offset)=>({x:p.x+nx*side*offset,z:p.z+nz*side*offset});
   edges.push(ribbon([shift(segment.a,segment.width/2-.22),shift(segment.b,segment.width/2-.22)],.10,.115));
   for(let d=0;d<l;d+=1){const a=shift({x:segment.a.x+dx*d/l,z:segment.a.z+dz*d/l},segment.width/2+.13),b=shift({x:segment.a.x+dx*Math.min(l,d+1)/l,z:segment.a.z+dz*Math.min(l,d+1)/l},segment.width/2+.13);(Math.floor(d)%2?curbs:darkCurbs).push(ribbon([a,b],.27,.14));}
  }
 }
 batch(curbs,art.cream);batch(darkCurbs,art.metal);batch(edges,material('#cfb356'));
 function polygonShape(points){const s=new THREE.Shape();points.forEach((p,i)=>i?s.lineTo(p.x,-p.z):s.moveTo(p.x,-p.z));s.closePath();return s;}
 const buildingMeshes=roofMaterials.map(()=>[]),roofs=roofMaterials.map(()=>[]);
 for(const b of map.buildings){
  const center=b.points.reduce((p,q)=>({x:p.x+q.x/b.points.length,z:p.z+q.z/b.points.length}),{x:0,z:0}),y=height(center.x,center.z),shape=polygonShape(b.points);
  const walls=new THREE.ExtrudeGeometry(shape,{depth:b.height,bevelEnabled:false});walls.rotateX(-Math.PI/2);walls.translate(0,y,0);const wallUV=walls.attributes.uv,wp=walls.attributes.position;for(let i=0;i<wp.count;i++)wallUV.setXY(i,(wp.getX(i)+wp.getZ(i))*.18,1-(wp.getY(i)-y)/b.height);buildingMeshes[b.id%3].push(walls);
  b.keralaRoof=b.height<=9?createKeralaRoof(b.points,y+b.height+.10):null;
  if(b.keralaRoof)roofs[0].push(b.keralaRoof.geometry);else{const roof=new THREE.ShapeGeometry(shape);roof.rotateX(-Math.PI/2);roof.translate(0,y+b.height+.02,0);roofs[b.id%3].push(roof);}
  b.bounds={minX:Math.min(...b.points.map(p=>p.x)),maxX:Math.max(...b.points.map(p=>p.x)),minZ:Math.min(...b.points.map(p=>p.z)),maxZ:Math.max(...b.points.map(p=>p.z))};
 }
 buildingMeshes.forEach((g,i)=>batch(g,art.walls[i]));roofs.forEach((g,i)=>batch(g,roofMaterials[i]));
 const waveCanvas=document.createElement('canvas');waveCanvas.width=waveCanvas.height=128;const waveCtx=waveCanvas.getContext('2d');waveCtx.fillStyle='#808080';waveCtx.fillRect(0,0,128,128);for(let row=0;row<128;row+=6){waveCtx.strokeStyle=row%12?'#b1b1b1':'#626262';waveCtx.beginPath();for(let x=0;x<=128;x+=4){const y=row+Math.sin(x*.08+row)*2;x?waveCtx.lineTo(x,y):waveCtx.moveTo(x,y);}waveCtx.stroke();}const waterBump=new THREE.CanvasTexture(waveCanvas);waterBump.wrapS=waterBump.wrapT=THREE.RepeatWrapping;waterBump.repeat.set(6,6);const waterMaterial=new THREE.MeshPhysicalMaterial({color:'#246e8b',roughness:.28,metalness:.08,clearcoat:.8,clearcoatRoughness:.16,bumpMap:waterBump,bumpScale:.12,envMapIntensity:.8});
 for(const area of map.areas.filter(a=>a.kind==='water')){const shape=polygonShape(area.points);shape.holes=(area.holes||[]).map(polygonShape);const g=new THREE.ShapeGeometry(shape);g.rotateX(-Math.PI/2);const vertices=g.attributes.position,uv=g.attributes.uv;for(let i=0;i<vertices.count;i++){vertices.setY(i,height(vertices.getX(i),vertices.getZ(i))+.035);uv.setXY(i,vertices.getX(i)*.01,vertices.getZ(i)*.01);}g.computeVertexNormals();const mesh=new THREE.Mesh(g,waterMaterial);mesh.receiveShadow=true;scene.add(mesh);}
 const waterCanvas=document.createElement('canvas');waterCanvas.width=waterCanvas.height=512;const wc=waterCanvas.getContext('2d');wc.fillStyle='#397b94';wc.fillRect(0,0,512,512);
 for(let i=0;i<4500;i++){const x=(i*73.37)%512,y=(i*29.93)%512;wc.strokeStyle=['#b6d9dd38','#1b5e792b','#71afc738'][i%3];wc.lineWidth=.6+(i%3)*.4;wc.beginPath();wc.moveTo(x,y);wc.bezierCurveTo(x+3,y-1,x+7,y+1,x+11+i%7,y);wc.stroke();}
 const waterColour=new THREE.CanvasTexture(waterCanvas);waterColour.colorSpace=THREE.SRGBColorSpace;waterColour.wrapS=waterColour.wrapT=THREE.RepeatWrapping;waterColour.repeat.set(6,6);waterMaterial.map=waterColour;waterMaterial.color.set('#ffffff');
 const oceanGeometry=new THREE.PlaneGeometry(4000,4000),oceanUV=oceanGeometry.attributes.uv,oceanVertices=oceanGeometry.attributes.position;for(let i=0;i<oceanVertices.count;i++)oceanUV.setXY(i,oceanVertices.getX(i)*.01,-oceanVertices.getY(i)*.01);const ocean=new THREE.Mesh(oceanGeometry,waterMaterial);ocean.rotation.x=-Math.PI/2;ocean.position.y=-.08;scene.add(ocean);
 function buildingAt(x,z,radius=0){return map.buildings.some(b=>x>b.bounds.minX-radius&&x<b.bounds.maxX+radius&&z>b.bounds.minZ-radius&&z<b.bounds.maxZ+radius&&(pointInPolygon(x,z,b.points)||b.points.some((p,i)=>segmentDistance(x,z,p,b.points[(i+1)%b.points.length])<radius)));}
 const waterAt=map.waterAt,waterfront=createWaterfront({scene,map,art,site:waterfrontSite});
 let seed=97;function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
 const trees=[];for(let attempt=0;trees.length<place.trees&&attempt<place.trees*30;attempt++){
  let x=bounds.minX+random()*(bounds.maxX-bounds.minX),z=bounds.minZ+random()*(bounds.maxZ-bounds.minZ);
  const near=map.nearestRoad(x,z);
  if(near.distance<near.segment.width/2+5||buildingAt(x,z,4)||waterAt(x,z)||waterfront.reservedAt(x,z,3))continue;
  trees.push({x,z,y:height(x,z),scale:.8+random()*.7});
 }
 // Dense shade-tree groups fill the gardens visible in the shared waterfront image.
 for(let attempt=0,added=0;added<70&&attempt<5000;attempt++){
  const x=waterfrontSite.street.x-180+random()*240,z=waterfrontSite.street.z-170+random()*300,near=map.nearestRoad(x,z);
  if((near.segment.name==='Waterfront Road'&&near.distance<35)||near.distance<near.segment.width/2+6||buildingAt(x,z,4)||waterAt(x,z)||waterfront.reservedAt(x,z,3)||waterfront.solidAt(x,z,3)||trees.some(t=>Math.hypot(x-t.x,z-t.z)<7))continue;
  trees.push({x,z,y:height(x,z),scale:1,kind:'shade'});added++;
 }
 const spawnSegments=map.segments.filter(s=>s.width>=4),spawnPoint={...waterfrontSite.spawn},initialHeading=waterfrontSite.heading;
 const scenery=dressRealMap({scene,map,id,height,buildingAt,waterAt,trees,art,anchor:spawnPoint,reservedAt:(x,z,r)=>waterfront.reservedAt(x,z,r+3)});
 const player=new THREE.Group(),models=new Map();player.userData.footprint={width:.81,length:2.1};scene.add(player);
 function makeChassis(style){const g=createMotorcycle(style),cargo=new THREE.Mesh(new THREE.BoxGeometry(.60,.52,.55),material(motorcycleStyles[style].color));cargo.position.set(0,1.18,.60);cargo.castShadow=true;g.add(cargo);const labelCanvas=document.createElement('canvas');labelCanvas.width=256;labelCanvas.height=256;const ctx=labelCanvas.getContext('2d');ctx.fillStyle='#cc963f';ctx.fillRect(0,0,256,256);ctx.strokeStyle='#4d452b';ctx.lineWidth=12;ctx.strokeRect(10,10,236,236);ctx.fillStyle='#2f3826';ctx.textAlign='center';ctx.font='bold 42px Arial';ctx.fillText('MUD',128,115);ctx.fillText('MEALS',128,166);const texture=new THREE.CanvasTexture(labelCanvas);texture.colorSpace=THREE.SRGBColorSpace;const label=new THREE.Mesh(new THREE.PlaneGeometry(.48,.42),new THREE.MeshStandardMaterial({map:texture,roughness:.85}));label.position.set(0,1.18,.878);g.add(label);return g;}
 function setModel(style){if(!Object.hasOwn(motorcycleStyles,style))return false;if(!models.has(style))models.set(style,makeChassis(style));if(player.chassis)player.remove(player.chassis);player.chassis=models.get(style);player.add(player.chassis);player.userData.style=style;document.querySelector('#model').value=style;return true;}
 setModel('city');

 const driving=createDriving(),keys=new Set(),touch=new Map();let overview=false,elapsed=0,mapTime=0;
 function clear(){keys.clear();touch.clear();}
 const held=key=>keys.has(key)||[...touch.values()].includes(key);
 addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright','w','s','a','d'].includes(k)){e.preventDefault();keys.add(k)}});
 addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));addEventListener('blur',clear);document.addEventListener('visibilitychange',()=>{if(document.hidden)clear()});
 for(const button of document.querySelectorAll('[data-key]')){button.addEventListener('contextmenu',e=>e.preventDefault());button.addEventListener('pointerdown',e=>{touch.set(e.pointerId,button.dataset.key);button.setPointerCapture(e.pointerId)});for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,e=>touch.delete(e.pointerId));}
 const people=[];for(const segment of [...map.segments].sort((a,b)=>segmentDistance(spawnPoint.x,spawnPoint.z,a.a,a.b)-segmentDistance(spawnPoint.x,spawnPoint.z,b.a,b.b))){if(people.length>=place.people)break;if(Math.hypot(segment.b.x-segment.a.x,segment.b.z-segment.a.z)<12)continue;const vx=segment.b.x-segment.a.x,vz=segment.b.z-segment.a.z,length=Math.hypot(vx,vz),x=(segment.a.x+segment.b.x)/2+vz/length*(segment.width/2+1.2),z=(segment.a.z+segment.b.z)/2-vx/length*(segment.width/2+1.2);if(buildingAt(x,z,.4)||waterAt(x,z)||scenery.obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<o.radius+.6))continue;
  const g=new THREE.Group(),placeholder=new THREE.Group();g.position.set(x,height(x,z)+.03,z);g.rotation.y=Math.atan2(-vx,-vz);g.add(placeholder);scene.add(g);const canWalk=Array.from({length:7},(_,i)=>({x:x+vx/length*(i-3),z:z+vz/length*(i-3)})).every(p=>!buildingAt(p.x,p.z,.45)&&!waterAt(p.x,p.z)&&!scenery.obstacles.some(o=>Math.hypot(p.x-o.x,p.z-o.z)<o.radius+.55));people.push({g,standing:{g:placeholder},sitting:null,variant:people.length,home:{x,z},route:canWalk?{x:vx/length,z:vz/length}:null,progress:0,direction:1,wait:people.length*.3,distance:0,walk:0});
 }
 const stalls=scenery.infill.filter(p=>p.type==='stall').sort((a,b)=>Math.hypot(a.x-spawnPoint.x,a.z-spawnPoint.z)-Math.hypot(b.x-spawnPoint.x,b.z-spawnPoint.z)).slice(0,12);
 for(const p of stalls){const x=p.x+p.nx*.25,z=p.z+p.nz*.25,g=new THREE.Group(),placeholder=new THREE.Group();g.position.set(x,height(x,z)+.03,z);g.rotation.y=Math.atan2(-p.nx,-p.nz);g.add(placeholder);g.userData.vendor=true;scene.add(g);people.push({g,standing:{g:placeholder},sitting:null,variant:people.length,home:{x,z},route:null,progress:0,direction:1,wait:0,distance:0,walk:0});}
 scenery.stats.vendors=stalls.length;
 for(const p of waterfront.vendors){const g=new THREE.Group(),placeholder=new THREE.Group();g.position.set(p.x,.03,p.z);g.rotation.y=p.angle;g.add(placeholder);scene.add(g);g.userData.vendor=true;people.push({g,standing:{g:placeholder},sitting:null,variant:people.length,home:{x:p.x,z:p.z},route:null,progress:0,direction:1,wait:0,distance:0,walk:0});}
 await installCrowd(people,[player]);
 // Small directed graph keeps traffic on the authored streets and respects one-way tags.
 const graph=new Map(),key=p=>p.x.toFixed(3)+','+p.z.toFixed(3);
 for(const s of spawnSegments){for(const p of [s.a,s.b])if(!graph.has(key(p)))graph.set(key(p),{point:p,edges:[]});graph.get(key(s.a)).edges.push({to:key(s.b),width:s.width});if(!s.oneway)graph.get(key(s.b)).edges.push({to:key(s.a),width:s.width});}
 const allStarts=[...graph.keys()].filter(k=>graph.get(k).edges.length),nearStarts=allStarts.filter(k=>{const p=graph.get(k).point;return Math.hypot(p.x-spawnPoint.x,p.z-spawnPoint.z)<220}),starts=id==='kochi'&&nearStarts.length>10?nearStarts:allStarts,prototypes=buildVehiclePrototypes(),auto=buildAuto(),traffic=[];for(const prototype of [...Object.values(prototypes),auto])batchRigidMeshes(prototype);
 const waterfrontStarts=map.roads.find(r=>r.name==='Waterfront Road').points.map(key).filter(k=>graph.has(k)&&Math.hypot(graph.get(k).point.x-spawnPoint.x,graph.get(k).point.z-spawnPoint.z)<160);
 function resetTraffic(v,index){const pool=index<6?waterfrontStarts:starts;for(let attempt=0;attempt<30;attempt++){const from=pool[(index*83+Math.floor(random()*pool.length))%pool.length],node=graph.get(from);v.from=from;v.to=node.edges[0].to;v.width=node.edges[0].width;v.progress=.2+random()*.6;v.speed=0;v.hidden=0;poseTraffic(v,true);const p=v.g.position;if(Math.hypot(p.x-spawnPoint.x,p.z-spawnPoint.z)>v.halfLength+5&&!traffic.some(other=>other!==v&&!other.hidden&&carDistance(p.x,p.z,other)<v.halfLength+2))return;}v.hidden=4;v.g.visible=false;}
 function targetTraffic(v){const a=graph.get(v.from).point,b=graph.get(v.to).point,dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),offset=v.width/4;return {x:a.x+(b.x-a.x)*v.progress+dz/length*offset,z:a.z+(b.z-a.z)*v.progress-dx/length*offset,heading:Math.atan2(-dx,-dz),length};}
 function poseTraffic(v,snap=false,dt=1/60){const p=targetTraffic(v),target=new THREE.Vector3(p.x,height(p.x,p.z)+.07,p.z);if(snap)v.g.position.copy(target);else v.g.position.lerp(target,1-Math.exp(-12*dt));const turn=THREE.MathUtils.euclideanModulo(p.heading-v.g.rotation.y+Math.PI,Math.PI*2)-Math.PI;v.g.rotation.y+=turn*(snap?1:Math.min(1,dt*6));v.g.visible=!v.hidden;}
 for(let i=0;i<place.traffic;i++){const type=i%11===0&&id==='kochi'?'bus':i%3===0?'auto':i%7===0?'van':'car',g=(type==='auto'?auto:prototypes[type]).clone(true);scene.add(g);const paints=new Map(),palette=['#477c89','#d9d9ca','#a34434','#80885c','#d2b570'];g.traverse(o=>{if(o.material?.userData.surface==='paint'){if(!paints.has(o.material)) {const m=o.material.clone();m.color.set(palette[i%palette.length]);paints.set(o.material,m)}o.material=paints.get(o.material)}});const d=g.userData.bodyDimensions,v={g,type,halfWidth:(d?.width||1.6)/2,halfLength:(d?.length||2.65)/2,wheels:[]};g.traverse(o=>{if(o.userData.wheelRadius)v.wheels.push(o)});traffic.push(v);resetTraffic(v,i);}
 function carDistance(x,z,v){const dx=x-v.g.position.x,dz=z-v.g.position.z,c=Math.cos(v.g.rotation.y),s=Math.sin(v.g.rotation.y);return Math.hypot(Math.max(0,Math.abs(dx*c-dz*s)-v.halfWidth),Math.max(0,Math.abs(dx*s+dz*c)-v.halfLength));}
 function blocked(x,z,heading=player.rotation.y){
  if(x<bounds.minX+2||x>bounds.maxX-2||z<bounds.minZ+2||z>bounds.maxZ-2)return true;
  for(const offset of [-.6,0,.6]){const px=x-Math.sin(heading)*offset,pz=z-Math.cos(heading)*offset;if(buildingAt(px,pz,.45)||scenery.solidAt(px,pz,.45)||scenery.obstacles.some(o=>Math.hypot(px-o.x,pz-o.z)<o.radius+.45)||traffic.some(v=>!v.hidden&&carDistance(px,pz,v)<.45)||people.some(n=>Math.hypot(px-n.g.position.x,pz-n.g.position.z)<.65))return true;
   if(waterfront.solidAt(px,pz,.45)||waterfront.obstacles.some(o=>Math.hypot(px-o.x,pz-o.z)<o.radius+.45))return true;
   if(waterAt(px,pz))return true;
  }return false;
 }
 let delivery,paused=false;
 function updateTraffic(dt){for(const [i,v]of traffic.entries()){
  if(v.hidden){v.hidden-=dt;if(v.hidden<=0)resetTraffic(v,i);continue;}
  const p=targetTraffic(v),fx=-Math.sin(v.g.rotation.y),fz=-Math.cos(v.g.rotation.y);let gap=50;
  for(const other of [{position:player.position,halfLength:1},...traffic.filter(o=>o!==v&&!o.hidden).map(o=>({position:o.g.position,halfLength:o.halfLength}))]){const dx=other.position.x-v.g.position.x,dz=other.position.z-v.g.position.z,ahead=dx*fx+dz*fz,side=Math.abs(dx*fz-dz*fx);if(ahead>0&&side<v.halfWidth+.7)gap=Math.min(gap,ahead-v.halfLength-other.halfLength-1.5);}
  const target=gap<1?0:Math.min(id==='kochi'?6:8,Math.sqrt(Math.max(0,gap)*3));v.speed=THREE.MathUtils.damp(v.speed,target,target<v.speed?8:1.4,dt);const advance=Math.min(v.speed*dt,Math.max(0,gap));v.progress+=advance/p.length;
  if(v.progress>=1){const node=graph.get(v.to),choices=node.edges.filter(e=>e.to!==v.from);if(!choices.length){v.hidden=4;v.g.visible=false;continue;}const next=choices[Math.floor(random()*choices.length)];v.from=v.to;v.to=next.to;v.width=next.width;v.progress=0;}
  poseTraffic(v,false,dt);for(const wheel of v.wheels)wheel.rotation.x-=advance/wheel.userData.wheelRadius;
 }}
 const actors=[...people,...traffic],cullActors=createActorCuller(camera,player);graphics.setActors(actors,player);
 const mini=document.querySelector('#minimap'),ctx=mini.getContext('2d');function minimap(){ctx.fillStyle='#78936b';ctx.fillRect(0,0,mini.width,mini.height);const scale=(mini.width-20)/Math.max(bounds.maxX-bounds.minX,bounds.maxZ-bounds.minZ),project=p=>[mini.width/2+p.x*scale,mini.height/2+p.z*scale];for(const area of map.areas.filter(a=>a.kind==='water')){ctx.beginPath();for(const ring of [area.points,...area.holes]){ring.forEach((p,i)=>{const a=project(p);i?ctx.lineTo(...a):ctx.moveTo(...a)});ctx.closePath();}ctx.fillStyle='#299fae';ctx.fill('evenodd');}ctx.strokeStyle='#e2dfce';ctx.lineWidth=2;for(const road of map.roads){ctx.beginPath();road.points.forEach((p,i)=>{const a=project(p);i?ctx.lineTo(...a):ctx.moveTo(...a)});ctx.stroke();}if(delivery?.route.length&&!delivery.state.finished){ctx.strokeStyle='#41d9d1';ctx.lineWidth=2;ctx.beginPath();delivery.route.forEach((p,i)=>i?ctx.lineTo(...project(p)):ctx.moveTo(...project(p)));ctx.stroke();}if(delivery?.state.destination&&!delivery.state.finished){const d=project(delivery.state.destination);ctx.fillStyle='#ffd178';ctx.fillRect(d[0]-3,d[1]-3,6,6)}const p=project(player.position);ctx.fillStyle='#ff9e34';ctx.save();ctx.translate(...p);ctx.rotate(-player.rotation.y);ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(6,6);ctx.lineTo(0,3);ctx.lineTo(-6,6);ctx.closePath();ctx.fill();ctx.strokeStyle='#122d22';ctx.lineWidth=2;ctx.stroke();ctx.restore();}
 let cameraMode='street';
 function updateCamera(dt=1,snap=false){
  scene.fog=overview?null:fog;for(const child of scene.children)if(child.userData.scenicBackdrop)child.visible=!overview;
  if(overview){const h=Math.max(bounds.maxZ-bounds.minZ,(bounds.maxX-bounds.minX)/camera.aspect)*1.3;camera.position.set(0,h,.01);camera.lookAt(0,0,0);}
  else {
   const forward=new THREE.Vector3(-Math.sin(player.rotation.y),0,-Math.cos(player.rotation.y)),street=cameraMode==='street';
   const target=player.position.clone().addScaledVector(forward,street?-5.3:-38).add(new THREE.Vector3(street?0:forward.z*22,street?2.7:28,street?0:-forward.x*22));
   if(snap)camera.position.copy(target);else camera.position.lerp(target,1-Math.exp(-6*dt));
   camera.lookAt(player.position.clone().add(new THREE.Vector3(0,street?1.8:1.05,0)).addScaledVector(forward,street?13:16));
  }
  sun.position.set(player.position.x-40,player.position.y+50,player.position.z+35);sun.target.position.copy(player.position);
 }
 document.querySelector('#camera-mode').onchange=e=>{cameraMode=e.target.value;camera.fov=cameraMode==='street'?58:42;camera.updateProjectionMatrix();updateCamera(1,true);graphics.render()};

 function reset(){clear();player.position.set(spawnPoint.x,height(spawnPoint.x,spawnPoint.z)+.07,spawnPoint.z);player.rotation.set(0,initialHeading,0,'YXZ');driving.reset(initialHeading);elapsed=0;updateCamera(1,true);minimap();document.querySelector('#speed').textContent='0';document.querySelector('#street').textContent=waterfrontSite.segment.name;document.querySelector('#surface').textContent='Asphalt';}
 function update(dt){if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);elapsed+=dt;const throttle=held('w')||held('arrowup')?1:0,brake=held('s')||held('arrowdown')?1:0,steering=Number(held('d')||held('arrowright'))-Number(held('a')||held('arrowleft')),oldHeading=player.rotation.y,fx=-Math.sin(oldHeading),fz=-Math.cos(oldHeading),grade=(height(player.position.x+fx*.4,player.position.z+fz*.4)-height(player.position.x-fx*.4,player.position.z-fz*.4))/.8;
  const surface={name:'Asphalt',speedLimit:14,wet:false,damage:0};driving.state.heading=oldHeading;const distance=driving.step(dt,{throttle,brake,reverse:brake&&!throttle,steering,grade,wet:surface.wet,speedLimit:surface.speedLimit}),newHeading=driving.state.heading,pieces=Math.max(1,Math.ceil(Math.abs(distance)/.2));let moved=0;
  for(let i=1;distance!==0&&i<=pieces;i++){const heading=THREE.MathUtils.lerp(oldHeading,newHeading,(i-.5)/pieces),x=player.position.x-Math.sin(heading)*distance/pieces,z=player.position.z-Math.cos(heading)*distance/pieces;if(blocked(x,z,heading)){driving.state.speed=0;driving.state.yawRate=0;driving.state.heading=player.rotation.y;break;}player.position.set(x,height(x,z)+.07,z);player.rotation.y=THREE.MathUtils.lerp(oldHeading,newHeading,i/pieces);moved+=distance/pieces;}
  player.rotation.x=Math.atan(grade);player.rotation.z=driving.state.lean;player.chassis.traverse(o=>{if(o.userData.wheelRadius)o.rotation.x-=moved/o.userData.wheelRadius});
  for(const n of people){let moved=0;n.wait=Math.max(0,n.wait-dt);if(n.route){const angle=Math.atan2(n.route.x*n.direction,n.route.z*n.direction),turn=THREE.MathUtils.euclideanModulo(angle-n.g.rotation.y+Math.PI,Math.PI*2)-Math.PI;n.g.rotation.y+=turn*Math.min(1,dt*5);if(n.wait===0&&Math.abs(turn)<.2){const progress=n.progress+n.direction*dt*.85;if(Math.abs(progress)>3){n.direction*=-1;n.wait=1.1}else{const x=n.home.x+n.route.x*progress,z=n.home.z+n.route.z*progress;if(Math.hypot(x-player.position.x,z-player.position.z)>1.3&&!people.some(o=>o!==n&&Math.hypot(x-o.g.position.x,z-o.g.position.z)<.8)){moved=Math.abs(progress-n.progress);n.progress=progress;n.g.position.set(x,height(x,z)+.03,z)}}}}n.distance+=moved;n.walk=THREE.MathUtils.damp(n.walk,moved>0?1:0,8,dt);if(n.g.visible)n.standing.animate(n.distance*8,elapsed+n.variant,n.walk,n.route?0:n.g.position.distanceTo(player.position)<8?.35:0);}
  updateTraffic(dt);waterfront.update(elapsed);waterBump.offset.x=elapsed*.001;delivery.update(dt,Math.abs(driving.state.speed),surface);updateCamera(dt);cullActors(actors);mapTime+=dt;if(mapTime>.15){mapTime=0;minimap();document.querySelector('#speed').textContent=`${driving.state.speed<0?'R ':''}${Math.round(Math.abs(driving.state.speed)*3.6)}`;const near=map.nearestRoad(player.position.x,player.position.z);document.querySelector('#street').textContent=near.segment.name||'Local road';document.querySelector('#surface').textContent=surface.name;}
 }
 document.querySelector('#location').onchange=e=>location.assign(`./real-map.html?location=${encodeURIComponent(e.target.value)}`);document.querySelector('#model').onchange=e=>setModel(e.target.value);
 document.querySelector('#view').onclick=()=>{overview=!overview;camera.near=overview?10:.2;camera.updateProjectionMatrix();document.querySelector('#view').textContent=overview?'Follow bike':'Map view';updateCamera(1,true);graphics.render()};document.querySelector('#reset').onclick=()=>{reset();graphics.render()};
 function resize(){const {width,height}=size();camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);graphics.resize(width,height);updateCamera(1,true);graphics.render()}
 new ResizeObserver(resize).observe(stage);resize();
 const settings=document.querySelector('#settings'),toolsToggle=document.querySelector('#tools-toggle'),orders=document.querySelector('#orders'),orderPanel=document.querySelector('#order-panel');
 toolsToggle.onclick=()=>{clear();settings.hidden=!settings.hidden;toolsToggle.setAttribute('aria-expanded',String(!settings.hidden));orderPanel.hidden=true;orders.setAttribute('aria-expanded','false')};
 orders.onclick=()=>{clear();orderPanel.hidden=!orderPanel.hidden;orders.setAttribute('aria-expanded',String(!orderPanel.hidden));settings.hidden=true;toolsToggle.setAttribute('aria-expanded','false')};
 document.querySelector('#close-orders').onclick=()=>{orderPanel.hidden=true;orders.setAttribute('aria-expanded','false')};
 addEventListener('keydown',e=>{if(e.key==='Escape'){settings.hidden=orderPanel.hidden=true;toolsToggle.setAttribute('aria-expanded','false');orders.setAttribute('aria-expanded','false')}});
 reset();const stops=waterfront.deliveryStops(blocked);if(stops.length<3)throw Error('Waterfront delivery bays are unavailable');delivery=createMapDelivery({scene,map,player,spawnPoint,height,blocked,stops});cullActors(actors);await renderer.compileAsync(scene,camera);
 const app={ready:true,id,source,map,scene,camera,renderer,graphics,player,traffic,people,driving,height,blocked,update,reset,setModel,scenery,waterfront,delivery,stops,stats:()=>({roads:map.roads.length,buildings:map.buildings.length,traffic:traffic.length,people:people.length,trees:trees.length,art:scenery.stats})};window.__REAL_MAP__=app;
 document.querySelector('#loading').remove();const frameLoop=startFrameLoop(renderer,update,()=>graphics.render(),{paused:()=>paused,onSuspend:clear});app.frameLoop=frameLoop;document.querySelector('#fps').onchange=e=>frameLoop.setFPS(Number(e.target.value));document.querySelector('#pause').onclick=()=>{paused=!paused;if(paused)clear();document.querySelector('#pause').textContent=paused?'▶':'Ⅱ';document.querySelector('#pause').setAttribute('aria-label',paused?'Resume animation':'Pause animation');document.querySelector('#pause').setAttribute('aria-pressed',String(paused));frameLoop.invalidate();};
}
start().catch(error=>{console.error('Kochi startup failed:',error);window.__REAL_MAP_ERROR__=error.message;const loading=document.querySelector('#loading');loading.classList.add('error');loading.replaceChildren();const title=document.createElement('strong');title.textContent='This location could not load';const detail=document.createElement('p');detail.textContent=error.message;const retry=document.createElement('button');retry.textContent='Retry';retry.onclick=()=>location.reload();const back=document.createElement('a');back.href='./index.html';back.textContent='Return to the village game';loading.append(title,detail,retry,back);});
