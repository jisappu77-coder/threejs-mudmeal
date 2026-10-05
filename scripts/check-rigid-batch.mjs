import assert from 'node:assert/strict';
import * as THREE from 'three';
import {batchRigidMeshes} from '../src/rigid-batch.js';
import {buildVehiclePrototypes} from '../src/prototypes/vehicles.js';
import {buildAuto} from '../src/prototypes/auto.js';

const root=new THREE.Group(),material=new THREE.MeshStandardMaterial(),expected=[];
root.position.set(13,2,-8);root.rotation.y=.7;root.scale.set(1.3,.8,1.1);
for(let i=0;i<2;i++){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,2,3),material);mesh.position.set(i*3,i,0);mesh.rotation.z=i*.3;root.add(mesh);
 root.updateMatrixWorld(true);const geometry=mesh.geometry.toNonIndexed().applyMatrix4(mesh.matrixWorld);expected.push(...geometry.attributes.position.array);geometry.dispose();
}
const wheel=new THREE.Group();wheel.userData.wheelRadius=.3;wheel.add(new THREE.Mesh(new THREE.TorusGeometry(.3,.1),material));root.add(wheel);
batchRigidMeshes(root);root.updateMatrixWorld(true);
const batch=root.children.find(o=>o.isMesh&&o.userData.rigidBatched&&o.layers.mask);
assert.ok(batch);const world=batch.geometry.toNonIndexed().applyMatrix4(root.matrixWorld).attributes.position.array;
assert.equal(world.length,expected.length);world.forEach((n,i)=>assert.ok(Math.abs(n-expected[i])<1e-5,'Baking must preserve every world-space vertex'));
assert.equal(wheel.children[0].layers.mask,1,'Rolling wheels must remain independently drawable');
wheel.rotation.x=.8;root.updateMatrixWorld(true);assert.equal(wheel.children[0].layers.mask,1);
const count=root.children.length;batchRigidMeshes(root);assert.equal(root.children.length,count,'Batching twice must not duplicate geometry');

for(const [name,g]of Object.entries({...buildVehiclePrototypes(),auto:buildAuto()})){
 const before=new THREE.Box3().setFromObject(g),triangles=()=>{let total=0;g.traverse(o=>{if(o.isMesh&&o.layers.mask)total+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});return total;},originalTriangles=triangles();
 batchRigidMeshes(g);const after=new THREE.Box3().setFromObject(g);
 assert.ok(before.min.distanceTo(after.min)<1e-5&&before.max.distanceTo(after.max)<1e-5,`${name} dimensions must remain unchanged`);
 assert.equal(triangles(),originalTriangles,`${name} visible triangles must be preserved`);
 g.traverse(o=>{if(o.userData.wheelRadius)o.traverse(w=>{if(w.isMesh)assert.equal(w.layers.mask,1);});});
}
console.log('Rigid batching preserves transformed geometry, vehicle dimensions, triangle detail and independently rolling wheels');
