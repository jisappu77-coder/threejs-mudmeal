import * as THREE from 'three';
import {createTeaPlant,bakeTeaPlant} from './tea-plant.js';

export function routeDistance(points,x,z){
 let result={distance:Infinity,y:0,tangent:new THREE.Vector2(1,0),index:0,t:0};
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz;
  const t=THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/length,0,1),distance=Math.hypot(x-a.x-t*dx,z-a.z-t*dz);
  if(distance<result.distance)result={distance,y:THREE.MathUtils.lerp(a.y,b.y,t),tangent:new THREE.Vector2(dx,dz).normalize(),index:i,t};
 }
 return result;
}

export function buildTeaTerraces(scene,height,clearance,renderer,leafMap,barkMaterial,anchor,focusPoint=anchor){
 let seed=9137;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
 const plant=createTeaPlant(leafMap,barkMaterial),lod=bakeTeaPlant(renderer,plant,scene.environment),matrices=[],cells=new Map(),dummy=new THREE.Object3D();
 let focus=null,focusDistance=Infinity;
 const xmin=-440,zmin=-180,step=5,nx=113,nz=145,grid=[];
 for(let z=0;z<nz;z++)for(let x=0;x<nx;x++)grid.push(height(xmin+x*step,zmin+z*step));
 function segment(a,b){
  const dx=b.x-a.x,dz=b.y-a.y,length=Math.hypot(dx,dz);if(length<.12)return;
  const mid=a.clone().lerp(b,.5),close=mid.distanceTo(anchor)<65,spacing=close?1.1:1.9,count=Math.max(1,Math.ceil(length/spacing)),unit=length/count;
  for(let i=0;i<count;i++){
   const x=a.x+dx*(i+.5)/count,z=a.y+dz*(i+.5)/count;if(clearance(x,z)<1.35)continue;
   const y=height(x,z),distance=Math.hypot(x-anchor.x,z-anchor.y),angle=Math.atan2(-dz,dx),scale=.96+random()*.10;
   dummy.position.set(x,y,z);dummy.rotation.set(0,angle+(random()-.5)*.35,0);dummy.scale.set(Math.max(.65,unit/1.15)*scale,scale,scale);dummy.updateMatrix();const index=matrices.length;matrices.push(dummy.matrix.clone());const cell=`${Math.floor(x/10)},${Math.floor(z/10)}`;if(!cells.has(cell))cells.set(cell,[]);cells.get(cell).push(index);
   const focusRange=Math.hypot(x-focusPoint.x,z-focusPoint.y);if(distance<9&&focusRange<focusDistance){focusDistance=focusRange;focus=new THREE.Vector3(x,y+.45,z)}
  }
 }
 // Marching squares traces the hillside's height contours rather than a flat planting grid.
 for(let level=5;level<108;level+=.30)for(let z=0;z<nz-1;z++)for(let x=0;x<nx-1;x++){
  const values=[grid[z*nx+x],grid[z*nx+x+1],grid[(z+1)*nx+x+1],grid[(z+1)*nx+x]];
  if(level<Math.min(...values)||level>=Math.max(...values))continue;
  const positions=[new THREE.Vector2(xmin+x*step,zmin+z*step),new THREE.Vector2(xmin+(x+1)*step,zmin+z*step),new THREE.Vector2(xmin+(x+1)*step,zmin+(z+1)*step),new THREE.Vector2(xmin+x*step,zmin+(z+1)*step)];
  const hits=[];for(let edge=0;edge<4;edge++){const next=(edge+1)%4;if((values[edge]>=level)===(values[next]>=level))continue;hits.push(positions[edge].clone().lerp(positions[next],(level-values[edge])/(values[next]-values[edge])))}
  for(let i=0;i+1<hits.length;i+=2)segment(hits[i],hits[i+1]);
 }
 function instances(geometry,material,matrices,name,shadows){const mesh=new THREE.InstancedMesh(geometry,material,matrices.length);mesh.name=name;matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=shadows;mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);return mesh}
 const capacity=384,leafMesh=instances(plant.geometry,plant.leafMaterial,Array.from({length:capacity},()=>new THREE.Matrix4()),'Individual tea leaves and fresh shoots',true),woodMesh=instances(plant.woodGeometry,plant.woodMaterial,Array.from({length:capacity},()=>new THREE.Matrix4()),'Woody tea stems and pruning branches',true),farMesh=instances(lod.geometry,lod.materials,matrices,'Contour tea rows with leaf silhouette LOD',false);
 const result={bushes:matrices.length,detailedPlants:0,foliageSprays:0,spraysPerPlant:plant.sprays,contourSpacing:.30,focus,pruned:true,leafLength:plant.leafLength,woodyBranches:true,solidCanopies:false,updateNear};
 let previous=[],lastX=Infinity,lastZ=Infinity,lastBudget=0;
 leafMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);woodMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);farMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 function updateNear(x,z){
  const budget=innerWidth<1000?192:capacity;if(Math.hypot(x-lastX,z-lastZ)<1.5&&budget===lastBudget)return;
  lastX=x;lastZ=z;lastBudget=budget;const candidates=[],cx=Math.floor(x/10),cz=Math.floor(z/10);
  for(let ix=cx-2;ix<=cx+2;ix++)for(let iz=cz-2;iz<=cz+2;iz++)for(const index of cells.get(`${ix},${iz}`)||[]){const p=matrices[index].elements,distance=Math.hypot(p[12]-x,p[14]-z);if(distance<16)candidates.push({index,distance})}
  candidates.sort((a,b)=>a.distance-b.distance);const selected=candidates.slice(0,budget);
  for(const index of previous){farMesh.setMatrixAt(index,matrices[index]);farMesh.instanceMatrix.addUpdateRange(index*16,16)}
  selected.forEach(({index},i)=>{leafMesh.setMatrixAt(i,matrices[index]);woodMesh.setMatrixAt(i,matrices[index]);farMesh.setMatrixAt(index,matrices[index].clone().scale(new THREE.Vector3(.000001,.000001,.000001)));farMesh.instanceMatrix.addUpdateRange(index*16,16)});
  previous=selected.map(v=>v.index);leafMesh.count=woodMesh.count=selected.length;
  for(const mesh of [leafMesh,woodMesh]){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere()}farMesh.instanceMatrix.needsUpdate=true;
  result.detailedPlants=selected.length;result.foliageSprays=selected.length*plant.sprays;
 }
 updateNear(anchor.x,anchor.y);return result;
}

export function buildDistantHills(scene){
 const layers=[{offset:750,height:110,color:'#445f4d'},{offset:1450,height:230,color:'#5b7771'},{offset:2400,height:400,color:'#839b9d'}];
 for(const [index,layer]of layers.entries()){
  layer.sampleHeight=(x,z)=>{const ridge=Math.exp(-((z/400)**2)),shape=.48+.23*Math.sin(x/290+index*2)+.17*Math.cos(x/170+index)+.10*Math.sin(x/65+Math.cos(z/80)*1.3)+.05*Math.sin(x/31+z/58),grain=Math.sin(x*1.7+z*2.3)*Math.cos(z*.37+x*.29);return layer.height*ridge*shape+grain*1.1-35};
  const g=new THREE.PlaneGeometry(4000,1000,200,45);g.rotateX(-Math.PI/2);const p=g.attributes.position,colors=[];
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),z=p.getZ(i),grain=Math.sin(x*1.7+z*2.3)*Math.cos(z*.37+x*.29);
   p.setXYZ(i,z+layer.offset+500,layer.sampleHeight(x,z),x+130);const color=new THREE.Color(layer.color).multiplyScalar(.88+(grain+1)*.08);colors.push(color.r,color.g,color.b);
  }
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));mesh.name='Authored distant Munnar hill layer';scene.add(mesh);
 }
 return layers;
}

export function createTreeBillboard(renderer,tree,environment){
 const scene=new THREE.Scene();scene.environment=environment;scene.environmentIntensity=.4;const copy=tree.clone(true),bounds=new THREE.Box3().setFromObject(copy),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 copy.position.set(-center.x,-bounds.min.y,-center.z);scene.add(copy,new THREE.HemisphereLight('#e7ecd8','#5b553d',.55));
 const sun=new THREE.DirectionalLight('#fff0d3',3);sun.position.set(-5,9,-3.5);scene.add(sun);
 const h=Math.max(size.y*1.1,size.x*1.1/.75),w=h*.75,camera=new THREE.OrthographicCamera(-w/2,w/2,h/2,-h/2,.01,100);camera.position.set(0,size.y/2,30);camera.lookAt(0,size.y/2,0);
 const target=new THREE.WebGLRenderTarget(576,768,{type:THREE.HalfFloatType,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});target.texture.colorSpace=THREE.LinearSRGBColorSpace;
 const clearColor=renderer.getClearColor(new THREE.Color()),clearAlpha=renderer.getClearAlpha(),previous=renderer.getRenderTarget();
 renderer.setClearColor(0,0);renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,camera);renderer.setRenderTarget(previous);renderer.setClearColor(clearColor,clearAlpha);
 return {map:target.texture,ratio:.75};
}
