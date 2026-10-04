import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {setupGraphics} from '../graphics.js';
import {createMotorcycle} from './vehicles.js';
import {installCrowd} from '../characters.js';
import {createDriving} from '../driving.js';
import {buildTeaTerraces,buildDistantHills,routeDistance,createTreeBillboard} from './munnar-landscape.js';

async function start(){
 const root=new URL('realism/',document.baseURI),url=p=>new URL(p,root).href;
 const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('#world'),antialias:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
 const scene=new THREE.Scene();scene.fog=new THREE.FogExp2('#c4d7d6',.00075);
 const camera=new THREE.PerspectiveCamera(53,innerWidth/innerHeight,.15,5000),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxDistance=400;controls.maxPolarAngle=Math.PI*.49;
 const graphics=setupGraphics(renderer,scene,camera);graphics.setQuality(true);graphics.ao.enabled=false; // The normal override in SSAO ignores the foliage alpha masks.
 const sun=new THREE.DirectionalLight('#fff0d3',3);sun.position.set(-100,180,-70);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
 Object.assign(sun.shadow.camera,{left:-42,right:42,top:42,bottom:-42,near:1,far:350});sun.shadow.normalBias=.025;sun.shadow.bias=-.00008;
 scene.add(sun,sun.target,new THREE.HemisphereLight('#e7ecd8','#5b553d',.55));
 const loader=new GLTFLoader(),textures=new THREE.TextureLoader();
 const [elevation,hdr,sky,tree,ferns,grass,rocks,teaAtlas]=await Promise.all([
  fetch(url('elevation.json')).then(r=>r.json()),new RGBELoader().loadAsync(url('lighting.hdr')),new RGBELoader().loadAsync(url('sky.hdr')),
  loader.loadAsync(url('island_tree_01/tree.glb')),
  ...['fern_02','grass_medium_01','rock_moss_set_01'].map(name=>loader.loadAsync(url(`${name}/${name}.gltf`))),
  textures.loadAsync(url('tea-foliage-atlas.png')),
 ]);
 hdr.mapping=sky.mapping=THREE.EquirectangularReflectionMapping;const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromEquirectangular(hdr);scene.environment=environment.texture;scene.environmentIntensity=.4;scene.background=sky;scene.backgroundIntensity=.72;scene.backgroundRotation.y=.6;hdr.dispose();pmrem.dispose();
 const half=(elevation.size-1)/2,baseline=elevation.values[Math.floor(half)*elevation.size+Math.floor(half)];
 function rawHeight(x,z){
  const gx=THREE.MathUtils.clamp(x/elevation.step+half,0,elevation.size-1.001),gz=THREE.MathUtils.clamp(z/elevation.step+half,0,elevation.size-1.001),ix=Math.floor(gx),iz=Math.floor(gz),tx=gx-ix,tz=gz-iz,at=(dx,dz)=>elevation.values[(iz+dz)*elevation.size+ix+dx];
  const ease=t=>t*t*(3-2*t);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(at(0,0),at(1,0),ease(tx)),THREE.MathUtils.lerp(at(0,1),at(1,1),ease(tx)),ease(tz))-baseline;
 }
 function curve(points){const c=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z)),false,'centripetal');return c.getSpacedPoints(Math.ceil(c.getLength()/2)).map(p=>p.setY(rawHeight(p.x,p.z)))}
 // Scenic game routes match the approved composition; they are not surveyed OSM roads.
 const road=curve([[-245,65],[-200,78],[-170,102],[-148,146],[-125,190],[-85,235],[-25,280],[40,322],[100,360],[132,422],[115,470]]);
 const fork=road[74],join=road[142];
 const trail=curve([[fork.x,fork.z],[-127,146],[-100,161],[-78,197],[-60,216],[-70,244],[join.x,join.z]]);
 // Keep the estate track's grade rideable while anchoring both ends to the paved road.
 const trailLengths=[0];for(let i=1;i<trail.length;i++)trailLengths.push(trailLengths[i-1]+Math.hypot(trail[i].x-trail[i-1].x,trail[i].z-trail[i-1].z));
 const trailLength=trailLengths.at(-1),gradeLimit=Math.max(.18,Math.abs(join.y-fork.y)/trailLength+.005);
 for(let i=1;i<trail.length-1;i++){const d=trailLengths[i];trail[i].y=THREE.MathUtils.clamp(trail[i].y,Math.max(fork.y-d*gradeLimit,join.y-(trailLength-d)*gradeLimit),Math.min(fork.y+d*gradeLimit,join.y+(trailLength-d)*gradeLimit))}
 for(let pass=0;pass<2;pass++){for(let i=1;i<trail.length-1;i++){const span=(trailLengths[i]-trailLengths[i-1])*gradeLimit;trail[i].y=THREE.MathUtils.clamp(trail[i].y,trail[i-1].y-span,trail[i-1].y+span)}for(let i=trail.length-2;i>0;i--){const span=(trailLengths[i+1]-trailLengths[i])*gradeLimit;trail[i].y=THREE.MathUtils.clamp(trail[i].y,trail[i+1].y-span,trail[i+1].y+span)}}
 const roads=[{points:road,width:4.5,surface:'asphalt'},{points:trail,width:2.3,surface:'dirt'}];
 const shopPoint=road[92],shopTangent=road[93].clone().sub(road[91]).normalize(),shopX=shopPoint.x-shopTangent.z*7.7,shopZ=shopPoint.z+shopTangent.x*7.7,shopY=rawHeight(shopX,shopZ)+.25;
 function height(x,z){
  let original=rawHeight(x,z);
  const plot=Math.hypot(x-shopX,z-shopZ);original=THREE.MathUtils.lerp(shopY-.15,original,THREE.MathUtils.smoothstep(plot,5,10));
  for(const route of [...roads].reverse()){const near=routeDistance(route.points,x,z);const blend=1-THREE.MathUtils.smoothstep(near.distance,route.width/2,route.width/2+3);original=THREE.MathUtils.lerp(original,near.y-.035,blend)}
  return original;
 }
 async function pbr(name,metres){
  const [map,normalMap,arm]=await Promise.all(['diff','normal','arm'].map(k=>textures.loadAsync(url(`${name}/${k}.jpg`))));map.colorSpace=THREE.SRGBColorSpace;
  for(const t of [map,normalMap,arm]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1/metres,1/metres);t.anisotropy=8}
  return new THREE.MeshStandardMaterial({map,normalMap,roughnessMap:arm,roughness:1,normalScale:new THREE.Vector2(.65,.65)});
 }
 const [groundMaterial,roadMaterial,dirtMaterial,plasterMaterial,tileMaterial]=await Promise.all([pbr('grass_ground',4),pbr('asphalt_02',3),pbr('gravel_ground_01',2),pbr('plastered_wall_04',3),pbr('clay_roof_tiles_02',1.3)]);
 groundMaterial.color.set('#8ca273');roadMaterial.color.set('#4f5c57');roadMaterial.roughness=.78;dirtMaterial.color.set('#ac8062');
 const ground=new THREE.PlaneGeometry(1200,1200,600,600);ground.rotateX(-Math.PI/2);const gp=ground.attributes.position,guv=ground.attributes.uv;
 for(let i=0;i<gp.count;i++){const x=gp.getX(i),z=gp.getZ(i);gp.setY(i,height(x,z)-.10);guv.setXY(i,x,z)}ground.computeVertexNormals();const terrain=new THREE.Mesh(ground,groundMaterial);terrain.name='SRTM-based plantation terrain';terrain.receiveShadow=true;scene.add(terrain);
 const farGeometry=new THREE.PlaneGeometry(6000,6000,140,140);farGeometry.rotateX(-Math.PI/2);const fp=farGeometry.attributes.position,fu=farGeometry.attributes.uv,fi=farGeometry.index,farIndices=[];
 for(let i=0;i<fp.count;i++){const x=fp.getX(i),z=fp.getZ(i);fp.setY(i,rawHeight(x,z)-.1);fu.setXY(i,x,z)}
 for(let i=0;i<fi.count;i+=3){const a=fi.getX(i),b=fi.getX(i+1),c=fi.getX(i+2),x=(fp.getX(a)+fp.getX(b)+fp.getX(c))/3,z=(fp.getZ(a)+fp.getZ(b)+fp.getZ(c))/3;if(Math.abs(x)>565||Math.abs(z)>565)farIndices.push(a,b,c)}
 farGeometry.setIndex(farIndices);farGeometry.computeVertexNormals();const farTerrain=new THREE.Mesh(farGeometry,groundMaterial);scene.add(farTerrain);const farHills=buildDistantHills(scene);
 function ribbon(points,width,material,lift=.06,offset=0){
  const positions=[],uv=[],indices=[];let distance=0;
  for(let i=0;i<points.length;i++){
   const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz);if(i)distance+=p.distanceTo(points[i-1]);
   for(const side of [-1,1]){const x=p.x+(side*width/2+offset)*dz/l,z=p.z-(side*width/2+offset)*dx/l;positions.push(x,height(x,z)+lift,z);uv.push((side+1)*width/2,distance)}
   if(i<points.length-1){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3)}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();const mesh=new THREE.Mesh(g,material);mesh.receiveShadow=true;scene.add(mesh);return mesh;
 }
 const shoulder=dirtMaterial.clone();shoulder.color.set('#77715d');ribbon(road,5.7,shoulder,.025);ribbon(road,4.5,roadMaterial,.13);ribbon(trail,2.9,shoulder,.03);ribbon(trail,2.3,dirtMaterial,.075);
 const paint=new THREE.MeshStandardMaterial({color:'#b9b3a0',roughness:.96});
 for(let i=0;i<road.length-3;i+=5)ribbon(road.slice(i,i+2),.08,paint,.145);
 const edgePaint=new THREE.MeshStandardMaterial({color:'#c5c6b5',roughness:1});for(const side of[-1,1])ribbon(road,.075,edgePaint,.145,side*1.96);

 let seed=981;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
 const anchor=road[68],clearance=(x,z)=>Math.min(...roads.map(r=>routeDistance(r.points,x,z).distance-r.width/2-.45),Math.hypot(x-shopX,z-shopZ)-6.8);
 const teaSoil=dirtMaterial.clone();teaSoil.color.set('#976e4e');
 const plantationGround=ground.clone(),plantationVertices=plantationGround.attributes.position,plantationIndices=[];
 for(let i=0;i<plantationVertices.count;i++)plantationVertices.setY(i,plantationVertices.getY(i)+.018);
 for(let i=0;i<ground.index.count;i+=3){const a=ground.index.getX(i),b=ground.index.getX(i+1),c=ground.index.getX(i+2),x=(gp.getX(a)+gp.getX(b)+gp.getX(c))/3,z=(gp.getZ(a)+gp.getZ(b)+gp.getZ(c))/3;const y=(gp.getY(a)+gp.getY(b)+gp.getY(c))/3;if(x>-440&&x<125&&z>-180&&z<545&&y>5&&y<108)plantationIndices.push(a,b,c)}
 plantationGround.setIndex(plantationIndices);const pickingSoil=new THREE.Mesh(plantationGround,teaSoil);pickingSoil.name='Continuous plantation soil and picking lanes';pickingSoil.receiveShadow=true;scene.add(pickingSoil);
 const teaTangent=road[69].clone().sub(road[67]).normalize(),teaFocus=new THREE.Vector2(anchor.x-teaTangent.z*5,anchor.z+teaTangent.x*5);
 teaAtlas.colorSpace=THREE.SRGBColorSpace;teaAtlas.anisotropy=8;
 let teaBark;tree.scene.traverse(m=>{if(m.isMesh&&m.material.name==='island_tree_01')teaBark=m.material});
 const tea=buildTeaTerraces(scene,height,clearance,renderer,teaAtlas,teaBark,new THREE.Vector2(anchor.x,anchor.z),teaFocus);
 const groups=new Map(),dummy=new THREE.Object3D();
 function prototypes(asset){asset.scene.updateMatrixWorld(true);return asset.scene.children.map(node=>{
  const box=new THREE.Box3().setFromObject(node),size=new THREE.Vector3();box.getSize(size);const parts=[];
  node.traverse(m=>{if(!m.isMesh)return;const geometry=m.geometry.clone();geometry.applyMatrix4(m.matrixWorld);geometry.translate(-(box.min.x+box.max.x)/2,-box.min.y,-(box.min.z+box.max.z)/2);const material=m.material.clone();material.envMapIntensity=.9;material.roughness=Math.max(.7,material.roughness);parts.push({geometry,material})});return {parts,size};
 }).filter(v=>v.parts.length)}
 function plant(template,x,z,h,angle=0,cast=false){
  const scale=h/template.size.y;dummy.position.set(x,height(x,z),z);dummy.rotation.set(0,angle,0);dummy.scale.setScalar(scale);dummy.updateMatrix();
  for(const part of template.parts){const key=part.geometry.uuid;if(!groups.has(key))groups.set(key,{...part,matrices:[],cast});groups.get(key).matrices.push(dummy.matrix.clone())}
 }
 const fernVariants=prototypes(ferns),grassVariants=prototypes(grass),rockVariants=prototypes(rocks);
 const billboard=createTreeBillboard(renderer,tree.scene,environment.texture),forestMatrices=[];
 for(let i=0;i<18000;i++){
  const x=-540+random()*1440,z=-620+random()*1320;if(clearance(x,z)<10||Math.hypot(x-anchor.x,z-anchor.z)<65)continue;
  if(x<70&&x>-440&&z>-180&&z<540&&random()<.965)continue;
  const h=11+random()*10;dummy.position.set(x,height(x,z)+h*.48,z);dummy.rotation.set(0,Math.atan2(anchor.x-x,anchor.z-z),0);dummy.scale.set(h*billboard.ratio,h,1);dummy.updateMatrix();forestMatrices.push(dummy.matrix.clone());
 }
 for(const hill of farHills)for(let i=0;i<15000;i++){
  const hx=-2000+random()*4000,hz=-450+random()*900,x=hz+hill.offset+500,z=hx+130,y=hill.sampleHeight(hx,hz);if(y<rawHeight(x,z)+1)continue;
  const h=14+random()*10;dummy.position.set(x,y+h*.48,z);dummy.rotation.set(0,Math.atan2(anchor.x-x,anchor.z-z),0);dummy.scale.set(h*billboard.ratio,h,1);dummy.updateMatrix();forestMatrices.push(dummy.matrix.clone());
 }
 const forestMaterial=new THREE.MeshBasicMaterial({map:billboard.map,alphaTest:.3,side:THREE.DoubleSide,color:'#d1dbc4',alphaToCoverage:true});
 const forest=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),forestMaterial,forestMatrices.length);forestMatrices.forEach((m,i)=>forest.setMatrixAt(i,m));forest.computeBoundingSphere();forest.name='Forest trees with scanned canopy LOD';scene.add(forest);
 const closeTrees=[[-211,119],[-207,167],[-165,198],[-170,59],[-242,89],[-92,74]];tree.scene.updateMatrixWorld(true);const treeBox=new THREE.Box3().setFromObject(tree.scene),treeSize=treeBox.getSize(new THREE.Vector3()),treeCenter=treeBox.getCenter(new THREE.Vector3());
 for(const [x,z]of closeTrees){if(clearance(x,z)<7)continue;const g=tree.scene.clone(true),scale=(11+random()*3)/treeSize.y;g.scale.setScalar(scale);g.position.set(x-treeCenter.x*scale,height(x,z)-treeBox.min.y*scale,z-treeCenter.z*scale);g.rotation.y=random()*6.28;g.traverse(m=>{if(m.isMesh)m.castShadow=m.receiveShadow=true});scene.add(g)}
 for(let i=0;i<720;i++){
  const p=road[Math.floor(random()*135)],index=road.indexOf(p),q=road[Math.min(index+1,road.length-1)],t=q.clone().sub(p).normalize(),side=random()<.5?-1:1,offset=side*(3.1+random()*1.2),x=p.x+t.z*offset,z=p.z-t.x*offset;
  if(Math.hypot(x-shopX,z-shopZ)<7)continue;const variants=i%4===0?fernVariants:grassVariants,v=variants[i%variants.length];plant(v,x,z,i%4===0?.45+random()*.3:.15+random()*.3,random()*6.28);
 }
 for(let i=0;i<45;i++){const p=trail[Math.floor(random()*trail.length)],x=p.x+(random()-.5)*8,z=p.z+(random()-.5)*8;if(clearance(x,z)>1)plant(rockVariants[i%rockVariants.length],x,z,.25+random()*.45,random()*6.28)}
 for(const {geometry,material,matrices,cast}of groups.values()){const mesh=new THREE.InstancedMesh(geometry,material,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=cast;mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh)}

 const stoneGeometry=new RoundedBoxGeometry(.62,.28,.45,1,.055),stoneMaterial=rockVariants[0].parts[0].material.clone(),stoneMatrices=[],stoneColors=[];
 stoneMaterial.metalness=0;stoneMaterial.roughnessMap=null;stoneMaterial.roughness=.96;stoneMaterial.envMapIntensity=.18;stoneMaterial.normalScale.set(.28,.28);
 for(let i=0;i<105;i++){
  if(Math.abs(i-74)<8)continue;const p=road[i],q=road[i+1],t=q.clone().sub(p).normalize(),x=p.x+t.z*3.02,z=p.z-t.x*3.02;
  for(let layer=0;layer<3;layer++)for(let j=0;j<3;j++){
   dummy.position.set(x+t.x*(j*.64-.64)+(layer%2)*.18,height(x,z)+.04+layer*.255,z+t.z*(j*.64-.64));dummy.rotation.set((random()-.5)*.1,Math.atan2(-t.z,t.x),(random()-.5)*.08);dummy.scale.set(1+random()*.1,.9+random()*.15,1);dummy.updateMatrix();stoneMatrices.push(dummy.matrix.clone());stoneColors.push(new THREE.Color().setHSL(.16+random()*.06,.1+random()*.15,.65+random()*.3));
  }
 }
 const wall=new THREE.InstancedMesh(stoneGeometry,stoneMaterial,stoneMatrices.length);stoneMatrices.forEach((m,i)=>{wall.setMatrixAt(i,m);wall.setColorAt(i,stoneColors[i])});wall.castShadow=wall.receiveShadow=true;wall.computeBoundingSphere();wall.name='Weathered valley retaining wall';scene.add(wall);
 const drainMaterial=new THREE.MeshStandardMaterial({color:'#454b43',roughness:1});ribbon(road,.28,drainMaterial,.015,-2.58);
 const wetMaterial=new THREE.MeshPhysicalMaterial({color:'#424d4b',roughness:.16,metalness:.05,transparent:true,opacity:.32,depthWrite:false});
 for(let i=20;i<105;i+=13){const p=road[i],puddle=new THREE.Mesh(new THREE.CircleGeometry(1,24),wetMaterial);puddle.rotation.x=-Math.PI/2;puddle.scale.set(.3+random()*.7,1.2+random(),1);puddle.position.set(p.x+.5,height(p.x+.5,p.z)+.146,p.z);scene.add(puddle)}

 const cottage=new THREE.Group();cottage.name='Munnar tea stall';cottage.position.set(shopX,shopY,shopZ);cottage.rotation.y=Math.atan2(anchor.x-shopX,anchor.z-shopZ);scene.add(cottage);
 const timber=new THREE.MeshStandardMaterial({color:'#5c4b36',roughness:.86}),darkTimber=new THREE.MeshStandardMaterial({color:'#302d25',roughness:.92});
 function box(w,h,d,x,y,z,material=timber,parent=cottage,radius=.015){const g=new RoundedBoxGeometry(w,h,d,1,Math.min(radius,w/4,h/4,d/4));const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*w,uv.getY(i)*h);const mesh=new THREE.Mesh(g,material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh}
 box(7.4,.55,5.8,0,-.15,0,stoneMaterial);box(7,.13,5.4,0,.17,0,timber);box(7,2.8,.16,0,1.65,-2.45,plasterMaterial);for(const side of[-1,1]){box(.16,2.8,4.8,side*3.45,1.65,-.12,plasterMaterial);box(.18,3.0,.18,side*3.35,1.75,2.3,darkTimber)}
 box(7.1,.16,.2,0,3.17,2.3,darkTimber);box(6,.85,.7,0,.64,.8,timber);box(6.2,.1,.86,0,1.10,.85,darkTimber);
 for(let i=0;i<8;i++)box(.035,.74,.035,-2.8+i*.8,.64,1.17,darkTimber);
 const roofG=new THREE.BufferGeometry(),roofP=[-4,3.2,-3.1,4,3.2,-3.1,4,4.65,0,-4,3.2,-3.1,4,4.65,0,-4,4.65,0,4,3.2,3.4,-4,3.2,3.4,-4,4.65,0,4,3.2,3.4,-4,4.65,0,4,4.65,0],roofUV=[];
 for(let i=0;i<roofP.length;i+=3)roofUV.push(roofP[i],roofP[i+2]);roofG.setAttribute('position',new THREE.Float32BufferAttribute(roofP,3));roofG.setAttribute('uv',new THREE.Float32BufferAttribute(roofUV,2));roofG.computeVertexNormals();tileMaterial.side=THREE.DoubleSide;const roofMesh=new THREE.Mesh(roofG,tileMaterial);roofMesh.castShadow=roofMesh.receiveShadow=true;cottage.add(roofMesh);
 for(const x of[-3.6,-1.2,1.2,3.6])box(.1,.12,6.8,x,3.16,.15,darkTimber);
 const signCanvas=document.createElement('canvas');signCanvas.width=1024;signCanvas.height=192;const signCtx=signCanvas.getContext('2d');signCtx.fillStyle='#385b43';signCtx.fillRect(0,0,1024,192);signCtx.strokeStyle='#aeab73';signCtx.lineWidth=7;signCtx.strokeRect(12,12,1000,168);signCtx.fillStyle='#ece1ba';signCtx.font='600 66px serif';signCtx.textAlign='center';signCtx.fillText('MUNNAR  TEA & MEALS',512,122);const signMap=new THREE.CanvasTexture(signCanvas);signMap.colorSpace=THREE.SRGBColorSpace;const sign=new THREE.Mesh(new THREE.PlaneGeometry(4.5,.84),new THREE.MeshStandardMaterial({map:signMap,roughness:.8}));sign.position.set(0,2.66,2.40);cottage.add(sign);
 const potMaterial=new THREE.MeshStandardMaterial({color:'#715044',roughness:.94}),metal=new THREE.MeshStandardMaterial({color:'#afb2a7',metalness:.75,roughness:.3});
 for(const x of[-2.55,-1.7]){const kettle=new THREE.Mesh(new THREE.CylinderGeometry(.18,.20,.30,20),metal);kettle.position.set(x,1.32,.8);kettle.castShadow=true;cottage.add(kettle);box(.24,.035,.24,x,1.5,.8,metal)}
 for(const x of[-3.15,3.15]){const pot=new THREE.Mesh(new THREE.CylinderGeometry(.21,.16,.37,16),potMaterial);pot.position.set(x,.40,2.8);pot.castShadow=true;cottage.add(pot)}
 box(1.9,.13,1.1,-1.4,.9,2.65,timber);for(const x of[-2.15,-.65])box(.08,.7,.08,x,.5,2.65,darkTimber);box(2.1,.12,.42,-1.4,.52,3.4,timber);for(const x of[-2.15,-.65])box(.10,.42,.10,x,.26,3.4,darkTimber);
 const warm=new THREE.MeshStandardMaterial({color:'#ffe3a6',emissive:'#ffaf43',emissiveIntensity:.4,roughness:.4});for(const x of[-2.5,0,2.5]){box(.025,.38,.025,x,2.89,1.8,darkTimber);const bulb=new THREE.Mesh(new THREE.SphereGeometry(.065,12,8),warm);bulb.position.set(x,2.68,1.8);cottage.add(bulb)}

 const player=new THREE.Group();player.name='Delivery rider and original Heritage bike';player.add(createMotorcycle('heritage','#35423a'));scene.add(player);const makeCharacter=await installCrowd([],[player]);
 player.rider.g.traverse(o=>{if(o.isMesh&&o.geometry.type==='SphereGeometry'&&o.material?.color)o.material.color.set('#2a302d')});
 const shopkeeper=makeCharacter(4);shopkeeper.g.position.set(1.4,.23,-.7);shopkeeper.g.rotation.y=.2;cottage.add(shopkeeper.g);shopkeeper.animate(0,0,false,0);
 const workers=[],wickerCanvas=document.createElement('canvas');wickerCanvas.width=wickerCanvas.height=128;const weave=wickerCanvas.getContext('2d');weave.fillStyle='#a68753';weave.fillRect(0,0,128,128);
 for(let i=0;i<128;i+=8){weave.fillStyle='#5d492e';weave.fillRect(0,i,128,2);weave.fillStyle='#c8ac73';weave.fillRect(i,0,3,128)}
 const wickerMap=new THREE.CanvasTexture(wickerCanvas);wickerMap.colorSpace=THREE.SRGBColorSpace;wickerMap.wrapS=wickerMap.wrapT=THREE.RepeatWrapping;wickerMap.repeat.set(3,2);const wickerMaterial=new THREE.MeshStandardMaterial({map:wickerMap,bumpMap:wickerMap,bumpScale:.008,roughness:.96,side:THREE.DoubleSide});
 for(const [index,variant]of [[14,11],[36,19]]){
  const p=trail[index],q=trail[index+1],t=q.clone().sub(p).normalize(),x=p.x+t.z*3.4,z=p.z-t.x*3.4,worker=makeCharacter(variant);worker.g.name='Tea estate picker';worker.g.position.set(x,height(x,z)-.08,z);worker.g.rotation.y=Math.atan2(-t.x,-t.z);worker.animate(0,variant,false,.2);scene.add(worker.g);
  const basket=new THREE.Mesh(new THREE.CylinderGeometry(.23,.17,.48,16,1,true),wickerMaterial);basket.position.set(0,1.03,-.34);basket.castShadow=basket.receiveShadow=true;worker.g.add(basket);
  const strapCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-.19,1.13,-.34),new THREE.Vector3(-.18,1.65,-.10),new THREE.Vector3(0,1.78,.08),new THREE.Vector3(.18,1.65,-.10),new THREE.Vector3(.19,1.13,-.34)]),headStrap=new THREE.Mesh(new THREE.TubeGeometry(strapCurve,16,.014,5,false),new THREE.MeshStandardMaterial({color:'#ccc3a7',roughness:1}));worker.g.add(headStrap);workers.push(worker);
 }
 let workerTime=0;
 const fabric=new THREE.MeshStandardMaterial({color:'#526148',roughness:.98});
 const bag=box(.49,.35,.42,0,1.15,.64,fabric,player,.075);bag.name='Fitted insulated delivery bag';
 const strap=new THREE.MeshStandardMaterial({color:'#2b3228',roughness:.94});for(const x of[-.16,.16]){box(.035,.37,.018,x,1.15,.857,strap,player);box(.035,.018,.45,x,1.331,.64,strap,player);box(.035,.19,.018,x,.98,.86,strap,player)}
 box(.28,.08,.016,0,1.21,.864,new THREE.MeshStandardMaterial({color:'#b0a27d',roughness:.95}),player);
 const startIndex=68,p=road[startIndex],q=road[startIndex+1],heading=Math.atan2(p.x-q.x,p.z-q.z),driving=createDriving();
 player.position.set(p.x,height(p.x,p.z)+.115,p.z);const initialGrade=(height(p.x-Math.sin(heading)*.5,p.z-Math.cos(heading)*.5)-height(p.x+Math.sin(heading)*.5,p.z+Math.cos(heading)*.5));player.rotation.set(Math.atan(initialGrade),heading,0,'YXZ');driving.reset(heading);
 sun.target.position.copy(player.position);sun.position.add(player.position);
 const mini=document.querySelector('#minimap'),mapContext=mini.getContext('2d');let delivered=false,lastMapX=Infinity,lastMapZ=Infinity;
 const mapPoints=roads.flatMap(r=>r.points),centreX=(Math.min(...mapPoints.map(p=>p.x))+Math.max(...mapPoints.map(p=>p.x)))/2,centreZ=(Math.min(...mapPoints.map(p=>p.z))+Math.max(...mapPoints.map(p=>p.z)))/2,mapScale=142/Math.max(...mapPoints.map(p=>Math.hypot(p.x-centreX,p.z-centreZ)));
 const mapX=x=>164+(x-centreX)*mapScale,mapZ=z=>164-(z-centreZ)*mapScale;
 function drawMap(){
  const ctx=mapContext;ctx.clearRect(0,0,328,328);ctx.save();ctx.beginPath();ctx.arc(164,164,161,0,Math.PI*2);ctx.clip();ctx.fillStyle='#24432d';ctx.fillRect(0,0,328,328);
  ctx.strokeStyle='#49623c';ctx.lineWidth=1;for(let i=0;i<10;i++){ctx.beginPath();ctx.ellipse(120,145,35+i*23,20+i*18,-.55,0,Math.PI*2);ctx.stroke()}
  for(const route of roads){ctx.beginPath();route.points.forEach((p,i)=>{if(i)ctx.lineTo(mapX(p.x),mapZ(p.z));else ctx.moveTo(mapX(p.x),mapZ(p.z))});ctx.strokeStyle=route.surface==='dirt'?'#ba9562':'#e0dfc6';ctx.lineWidth=route.surface==='dirt'?5:7;ctx.setLineDash(route.surface==='dirt'?[6,6]:[]);ctx.stroke()}
  ctx.setLineDash([]);ctx.fillStyle=delivered?'#b3cf83':'#f5e7b2';ctx.fillRect(mapX(shopX)-6,mapZ(shopZ)-6,12,12);ctx.font='bold 21px system-ui';ctx.textAlign='center';ctx.fillText('N',164,30);
  ctx.translate(mapX(player.position.x),mapZ(player.position.z));ctx.rotate(player.rotation.y+Math.PI);ctx.fillStyle='#efcb75';ctx.strokeStyle='#172b20';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(9,9);ctx.lineTo(0,5);ctx.lineTo(-9,9);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
 }
 function updateDestination(){
  const distance=Math.hypot(player.position.x-shopX,player.position.z-shopZ);
  if(!delivered&&riding&&distance<11&&driving.state.speed<.65){delivered=true;document.querySelector('#task').textContent='✓ Delivered to Tea Stall';drawMap()}
  const label=delivered?'Delivery complete · Explore the estate':`${Math.round(distance)} m · Stop by the counter`;if(document.querySelector('#destination-distance').textContent!==label)document.querySelector('#destination-distance').textContent=label;
  if(Math.hypot(player.position.x-lastMapX,player.position.z-lastMapZ)>.4){lastMapX=player.position.x;lastMapZ=player.position.z;drawMap()}
 }
 const keys=new Set(),touch=new Map();let riding=false,detailed=true;
 function cameraView(view='rider'){
  riding=false;document.body.classList.remove('riding');controls.enabled=true;document.querySelector('#ride').textContent='Ride';
  if(view==='tea'){const toward=player.position.clone().sub(tea.focus);toward.y=0;toward.normalize();camera.position.copy(tea.focus).addScaledVector(toward,2.5);camera.position.y=height(camera.position.x,camera.position.z)+1.4;controls.target.copy(tea.focus).add(new THREE.Vector3(0,.2,0));controls.update();tea.updateNear(camera.position.x,camera.position.z);graphics.render();return}
  const forward=new THREE.Vector3(-Math.sin(player.rotation.y),0,-Math.cos(player.rotation.y)),valley=new THREE.Vector3(forward.z,0,-forward.x),cinematic=view==='landscape',side=view==='roadside';
  camera.position.copy(player.position).addScaledVector(forward,cinematic?-11:side?-2:-6).addScaledVector(valley,cinematic?-7:side?-6:0).add(new THREE.Vector3(0,cinematic?7.2:side?2.3:2.65,0));
  controls.target.copy(player.position).addScaledVector(forward,cinematic?25:side?2:18).addScaledVector(valley,cinematic?6:0).add(new THREE.Vector3(0,1.2,0));controls.update();tea.updateNear(camera.position.x,camera.position.z);graphics.render();
 }
 addEventListener('keydown',e=>{const key=e.key.toLowerCase();if(!e.ctrlKey&&!e.metaKey&&['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'].includes(key)){e.preventDefault();keys.add(key)}});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>{keys.clear();touch.clear()});
 for(const b of document.querySelectorAll('[data-key]')){b.onpointerdown=e=>{touch.set(e.pointerId,b.dataset.key);b.setPointerCapture(e.pointerId)};for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,e=>touch.delete(e.pointerId))}
 function update(dt){
  dt=Math.min(.05,dt);if(riding){
   const held=k=>keys.has(k)||[...touch.values()].includes(k),throttle=Number(held('w')||held('arrowup')),brake=Number(held('s')||held('arrowdown')),steering=Number(held('d')||held('arrowright'))-Number(held('a')||held('arrowleft')),fx=-Math.sin(player.rotation.y),fz=-Math.cos(player.rotation.y),grade=height(player.position.x+fx*.5,player.position.z+fz*.5)-height(player.position.x-fx*.5,player.position.z-fz*.5),surface=routeDistance(trail,player.position.x,player.position.z).distance<2?'Dirt trail':'Hill road';
   const d=driving.step(dt,{throttle,brake,steering,grade:THREE.MathUtils.clamp(grade,-.18,.18),wet:surface==='Dirt trail',speedLimit:10});const x=player.position.x-Math.sin(driving.state.heading)*d,z=player.position.z-Math.cos(driving.state.heading)*d;
   if(Math.abs(x)<540&&Math.abs(z)<540&&Math.hypot(x-shopX,z-shopZ)>5)player.position.set(x,height(x,z)+.115,z);else driving.state.speed=0;
   player.rotation.set(Math.atan(grade),driving.state.heading,driving.state.lean,'YXZ');player.traverse(o=>{if(o.userData.wheelRadius)o.rotation.x-=d/o.userData.wheelRadius});
   const forward=new THREE.Vector3(-Math.sin(player.rotation.y),0,-Math.cos(player.rotation.y));camera.position.lerp(player.position.clone().addScaledVector(forward,-6).add(new THREE.Vector3(0,2.65,0)),1-Math.exp(-5*dt));camera.lookAt(player.position.clone().addScaledVector(forward,18).add(new THREE.Vector3(0,1.2,0)));document.querySelector('#speed').textContent=Math.round(driving.state.speed*3.6);document.querySelector('#surface').textContent=surface;
   sun.target.position.copy(player.position);sun.position.copy(player.position).add(new THREE.Vector3(-100,180,-70));
  }else controls.update();
  workerTime+=dt;workers.forEach((worker,i)=>worker.animate(0,workerTime+i*2,false,.20+Math.sin(workerTime*.7+i)*.06));
  tea.updateNear(camera.position.x,camera.position.z);updateDestination();
 }
 document.querySelector('#rider-view').onclick=()=>cameraView();document.querySelector('#roadside-view').onclick=()=>cameraView('roadside');document.querySelector('#landscape-view').onclick=()=>cameraView('landscape');document.querySelector('#tea-view').onclick=()=>cameraView('tea');
 document.querySelector('#ride').onclick=()=>{riding=!riding;controls.enabled=!riding;document.body.classList.toggle('riding',riding);document.querySelector('#ride').textContent=riding?'Pause ride':'Ride';keys.clear();touch.clear()};
 document.querySelector('#quality').onclick=()=>{detailed=!detailed;graphics.setQuality(detailed);graphics.ao.enabled=false;document.querySelector('#quality').textContent=detailed?'Detail on':'Detail off';graphics.render()};
 addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();graphics.resize(innerWidth,innerHeight);tea.updateNear(camera.position.x,camera.position.z);graphics.render()});
 await renderer.compileAsync(scene,camera);cameraView('rider');riding=true;controls.enabled=false;document.body.classList.add('riding');document.querySelector('#ride').textContent='Pause ride';updateDestination();document.querySelector('#loading').remove();const clock=new THREE.Clock();
 window.__REALISM_REVIEW__={ready:true,scene,camera,renderer,graphics,player,driving,height,update,cameraView,elevation,trail,road,tea,roads,shop:cottage,updateDestination};renderer.setAnimationLoop(()=>{update(clock.getDelta());graphics.render()});
}
start().catch(error=>{console.error(error);window.__REALISM_REVIEW_ERROR__=error.message;document.querySelector('#loading').textContent='The sample could not load: '+error.message});
