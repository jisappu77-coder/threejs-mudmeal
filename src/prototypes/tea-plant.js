import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// The original alpha atlas supplies veins, leaf shape and fine gaps; geometry supplies volume.
export function createTeaPlant(map,barkMaterial){
 let seed=231;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
 const leafMaterial=new THREE.MeshStandardMaterial({map,vertexColors:true,side:THREE.DoubleSide,alphaTest:.4,alphaToCoverage:true,roughness:.7,envMapIntensity:.25});
 const woodMaterial=barkMaterial.clone();woodMaterial.roughness=.95;woodMaterial.metalness=0;woodMaterial.envMapIntensity=.2;
 const foliage=[],woodParts=[],dummy=new THREE.Object3D(),up=new THREE.Vector3(0,1,0),forward=new THREE.Vector3(0,0,1);
 function branch(a,b,radius){const axis=b.clone().sub(a),g=new THREE.CylinderGeometry(radius*.62,radius,axis.length(),7,2);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up,axis.normalize()));g.translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);woodParts.push(g)}
 const fork=new THREE.Vector3(.025,.20,-.018);branch(new THREE.Vector3(0,-.08,0),fork,.047);
 for(let i=0;i<5;i++){
  const angle=i*Math.PI*2/5+(random()-.5)*.9,r=.18+random()*.15,elbow=new THREE.Vector3(Math.cos(angle)*r,.31+random()*.10,Math.sin(angle)*r),tip=new THREE.Vector3(Math.cos(angle)*(.42+random()*.10),.49+random()*.08,Math.sin(angle)*(.40+random()*.10));branch(fork,elbow,.022+random()*.008);branch(elbow,tip,.011+random()*.005);
  for(let j=0;j<3;j++){const az=angle+(random()-.5)*1.5,end=new THREE.Vector3(Math.cos(az)*(.42+random()*.19),.63+random()*.09,Math.sin(az)*(.40+random()*.18));branch(tip.clone().lerp(elbow,.3),end,.004+random()*.002)}
 }
 const sprays=230;
 for(let i=0;i<sprays;i++){
  const az=random()*Math.PI*2,side=i<85,r=side?.80+random()*.20:Math.sqrt(random()),x=Math.cos(az)*r*.64,z=Math.sin(az)*r*.60;
  dummy.position.set(x,side?.34+random()*.18:.74-.07*r**4+(random()-.5)*.10,z);
  const normal=side?new THREE.Vector3(Math.cos(az),.30+random()*.4,Math.sin(az)).normalize():new THREE.Vector3((random()-.5)*.8,1,(random()-.5)*.8).normalize();
  dummy.quaternion.setFromUnitVectors(forward,normal);dummy.rotateZ(side?(random()-.5)*.6:random()*Math.PI*2);dummy.scale.setScalar(.88+random()*.22);dummy.updateMatrix();
  const g=new THREE.PlaneGeometry(.30,.30,2,2),vertices=g.attributes.position,uv=g.attributes.uv,tile=Math.floor(random()*4),shade=new THREE.Color().setHSL(.20,.10,.77+random()*.12,THREE.SRGBColorSpace),colors=[];
  for(let j=0;j<vertices.count;j++){vertices.setZ(j,.025*Math.sin((vertices.getY(j)+.15)/.30*Math.PI)+.008*Math.sin(vertices.getX(j)*18));uv.setXY(j,((tile%2)+uv.getX(j)*.96+.02)*.5,(Math.floor(tile/2)+uv.getY(j)*.96+.02)*.5);colors.push(shade.r,shade.g,shade.b)}
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();g.applyMatrix4(dummy.matrix);foliage.push(g);
 }
 const geometry=mergeGeometries(foliage),woodGeometry=mergeGeometries(woodParts);foliage.forEach(g=>g.dispose());woodParts.forEach(g=>g.dispose());
 const model=new THREE.Group();model.add(new THREE.Mesh(geometry,leafMaterial),new THREE.Mesh(woodGeometry,woodMaterial));model.updateMatrixWorld(true);
 return {model,geometry,woodGeometry,leafMaterial,woodMaterial,sprays,leaves:sprays*14,leafLength:.09};
}

export function bakeTeaPlant(renderer,plant,environment){
 const scene=new THREE.Scene();scene.environment=environment;scene.environmentIntensity=.4;scene.add(plant.model.clone(true),new THREE.HemisphereLight('#e7ecd8','#5b553d',.55));const light=new THREE.DirectionalLight('#fff0d3',3);light.position.set(-3,6,-2.5);light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-1.2,right:1.2,top:1.2,bottom:-1.2,near:1,far:12});light.shadow.normalBias=.001;light.shadow.bias=-.00002;scene.add(light);scene.traverse(m=>{if(m.isMesh)m.castShadow=m.receiveShadow=true});
 const previous=renderer.getRenderTarget(),clearColor=renderer.getClearColor(new THREE.Color()),clearAlpha=renderer.getClearAlpha(),toneMapping=renderer.toneMapping;
 // Keep the bake in linear lighting; the main scene applies its tone mapping once.
 renderer.toneMapping=THREE.NoToneMapping;renderer.setClearColor(0,0);
 function view(top){
  const size=512,camera=new THREE.OrthographicCamera(-.8,.8,.52,-.52,.01,10);camera.position.set(0,.47,4);camera.lookAt(0,.47,0);
  if(top){camera.left=camera.bottom=-.8;camera.right=camera.top=.8;camera.position.set(0,4,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);camera.updateProjectionMatrix()}
  const target=new THREE.WebGLRenderTarget(size,size,{type:THREE.HalfFloatType,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});target.texture.colorSpace=THREE.LinearSRGBColorSpace;target.texture.anisotropy=8;
  renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,camera);
  // Keep HDR radiance on the GPU so distant foliage is tone-mapped exactly once with the scene.
  return target.texture;
 }
 const sideMap=view(false),topMap=view(true);renderer.setRenderTarget(previous);renderer.setClearColor(clearColor,clearAlpha);renderer.toneMapping=toneMapping;light.shadow.map?.dispose();
 const sides=[];for(let i=0;i<3;i++){const g=new THREE.PlaneGeometry(1.6,1.04);g.rotateY(i*Math.PI/3);g.translate(0,.47,0);sides.push(g)}const sideGeometry=mergeGeometries(sides);const topGeometry=new THREE.PlaneGeometry(1.6,1.6);topGeometry.rotateX(-Math.PI/2);topGeometry.translate(0,.77,0);
 const geometry=mergeGeometries([sideGeometry,topGeometry],true);sides.forEach(g=>g.dispose());sideGeometry.dispose();topGeometry.dispose();
 const materials=[sideMap,topMap].map(map=>new THREE.MeshBasicMaterial({map,alphaTest:.45,side:THREE.DoubleSide,color:'#ffffff',alphaToCoverage:true}));
 return {geometry,materials};
}
