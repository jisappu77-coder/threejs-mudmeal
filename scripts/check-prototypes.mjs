import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {buildAuto} from '../src/prototypes/auto.js';
const auto=buildAuto();
auto.updateMatrixWorld(true);auto.traverse(o=>{if(o.isMesh)for(const x of o.geometry.attributes.position.array)assert.ok(Number.isFinite(x));});
const size=new THREE.Box3().setFromObject(auto).getSize(new THREE.Vector3());assert.ok(size.y>1.65&&size.y<1.82);console.log(auto.name,JSON.stringify(size));
assert.equal(auto.userData.wheelCount,3);let wheels=0;auto.traverse(o=>{if(o.userData.wheelRadius)wheels++});assert.equal(wheels,3);
const glb=fs.readFileSync('public/review/customer.glb');
assert.equal(glb.readUInt32LE(0),0x46546c67);assert.equal(glb.readUInt32LE(4),2);
const asset=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
assert.equal(asset.meshes.length,7,'Separate body, shirt, jeans, footwear, hair, brows and eyes');
assert.ok(asset.images.length>=8,'Authored textures must be embedded');
for(const mesh of asset.meshes)for(const p of mesh.primitives){assert.ok(p.attributes.TEXCOORD_0!==undefined);const a=asset.accessors[p.attributes.POSITION];assert.ok(a.min.every(Number.isFinite)&&a.max.every(Number.isFinite));}
console.log('Textured human GLB:',glb.length,'bytes;',asset.meshes.length,'meshes;',asset.images.length,'textures');
