import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {buildPerson} from '../src/prototypes/person.js';
import {buildAuto} from '../src/prototypes/auto.js';
const person=buildPerson(JSON.parse(fs.readFileSync('public/review/human-base.json'))),auto=buildAuto();
for(const model of[person,auto]){model.updateMatrixWorld(true);model.traverse(o=>{if(o.isMesh)for(const x of o.geometry.attributes.position.array)assert.ok(Number.isFinite(x));});const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());assert.ok(size.y>1.65&&size.y<1.82);console.log(model.name,JSON.stringify(size));}
assert.ok(new THREE.Box3().setFromObject(person).getSize(new THREE.Vector3()).x<.75,'Arms should rest beside the body');
assert.ok(person.children[0].geometry.attributes.position.count>13000);assert.equal(auto.userData.wheelCount,3);let wheels=0;auto.traverse(o=>{if(o.userData.wheelRadius)wheels++});assert.equal(wheels,3);
