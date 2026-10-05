import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Combine fixed vehicle parts with identical materials; wheels and glass stay independent.
// Retain the authoring hierarchy for model inspection and collision measurements.
export function batchRigidMeshes(root){
 root.updateMatrixWorld(true);
 const inverse=root.matrixWorld.clone().invert(),groups=new Map();
 root.traverse(mesh=>{
  if(!mesh.isMesh||mesh.isSkinnedMesh||Array.isArray(mesh.material)||mesh.material.transparent||mesh.userData.rigidBatched)return;
  for(let p=mesh;p&&p!==root;p=p.parent)if(p.userData.wheelRadius||p.isBone)return;
  if(Object.keys(mesh.geometry.morphAttributes).length||Object.keys(mesh.geometry.attributes).some(k=>!['position','normal','uv'].includes(k)))return;
  const matrix=inverse.clone().multiply(mesh.matrixWorld);if(matrix.determinant()<=0)return;
  const key=[mesh.material.uuid,mesh.castShadow,mesh.receiveShadow,mesh.layers.mask].join(',');
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push({mesh,matrix});
 });
 for(const items of groups.values()){
  if(items.length<2)continue;
  const geometries=items.map(({mesh,matrix})=>{
   const g=mesh.geometry.clone();
   if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));
   if(!g.attributes.normal)g.computeVertexNormals();
   if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
   return g.applyMatrix4(matrix);
  });
  const source=items[0].mesh,batch=new THREE.Mesh(mergeGeometries(geometries),source.material);
  geometries.forEach(g=>g.dispose());batch.castShadow=source.castShadow;batch.receiveShadow=source.receiveShadow;batch.layers.mask=source.layers.mask;batch.userData.rigidBatched=true;batch.matrixAutoUpdate=false;root.add(batch);
  for(const {mesh}of items){mesh.layers.disableAll();mesh.updateMatrix();mesh.matrixAutoUpdate=false;mesh.userData.rigidBatched=true;}
 }
 return root;
}
