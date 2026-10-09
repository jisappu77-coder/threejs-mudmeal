import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalize,worldPoint,roadWidth,canRide,stepBike,calibrateWaterfront} from '../src/layout.js';
import {renderPoint,renderHeading,waterfrontShift} from '../src/projection.js';
assert.deepEqual(renderPoint([-50,0,-198],1),[-50,0,-198]);
assert.equal(renderHeading(0,198,1,-50),0);
assert.ok(waterfrontShift(72,198)>0);
for(const x of[-15,0])assert.ok(Math.abs(waterfrontShift(x-.000001,144)-waterfrontShift(x+.000001,144))<.00001,'Coastal projection is continuous at both transition boundaries');
const manifest=JSON.parse(await readFile(new URL('../public/scenes/manifest.json',import.meta.url)));
const scenes=await Promise.all(manifest.map(async m=>normalize(JSON.parse(await readFile(new URL('../public/'+m.spec,import.meta.url))),m.key)));
assert.equal(scenes.length,8);assert.deepEqual(worldPoint([12,20,3],[5,100,0]),[17,3,-120]);
let seams=0;
for(const s of scenes){
 assert.equal(s.buildings.length,s.phase===1&&s.scene.id==='SCENE_03'?5:4);
 for(const b of s.buildings){assert.ok(b.height>0&&b.top>=b.height);assert.ok(b.rect[0]<b.rect[2]&&b.rect[1]<b.rect[3]);assert.ok(b.entrance);}
 for(const v of s.reference_views)await readFile(new URL(`../public/scenes/${s.key}/${v.file.replace('.png','.webp')}`,import.meta.url));
 for(const c of s.connections){
  if(!c.matches||!/^SCENE_\d+\./.test(c.matches))continue;
  const [id,connection]=c.matches.split('.'),other=scenes.find(x=>x.phase===s.phase&&x.scene.id===id),match=other?.connections.find(x=>x.id===connection);assert.ok(match,`${s.key}:${c.id} missing reciprocal connection`);
  assert.deepEqual(worldPoint(c.position,s.origin),worldPoint(match.position,other.origin));assert.equal(c.width_m,match.width_m);seams++;
 }
}
const p1=scenes.filter(s=>s.phase===1),p2=scenes.filter(s=>s.phase===2);
assert.equal(canRide(72,99.9,p1,[]),true);assert.equal(canRide(72,100.1,p1,[]),true);assert.equal(canRide(95,50,p1,[]),false);
assert.equal(canRide(60,250,p2,[]),true);assert.equal(canRide(40,250,p2,[]),false);assert.equal(canRide(60,201,p2,[]),true);assert.equal(canRide(60,199,p2,[]),true);
const taper=p1[3].roads[0];assert.equal(roadWidth(taper,0),4);assert.equal(roadWidth(taper,20),5);assert.equal(roadWidth(taper,30),6);
let state={x:0,y:0,heading:0,speed:0};for(let i=0;i<100;i++)stepBike(state,{forward:true,brake:false,steer:0},.02,()=>true);assert.ok(state.y>9&&state.speed>9);
const before=state.y;for(let i=0;i<10;i++)stepBike(state,{forward:true,brake:false,steer:0},.1,(_x,y)=>y<before+.4);assert.ok(state.y<before+.4);assert.equal(state.speed,0);
for(let i=0;i<20;i++)stepBike(state,{forward:false,brake:true,steer:0},.05,()=>true);assert.ok(state.speed<0);assert.ok(state.y<before);
console.log(`Verified 8 scenes, 33 exact building footprints, ${seams} reciprocal road/path seams, camera assets, tapered road, bridge/water collision, acceleration, reverse and wall stopping.`);

const calibrated=await Promise.all(manifest.map(async m=>normalize(calibrateWaterfront(JSON.parse(await readFile(new URL('../public/'+m.spec,import.meta.url)))),m.key)));
assert.equal(canRide(83,50,calibrated.filter(s=>s.phase===1),[]),false);assert.equal(canRide(119,50,calibrated.filter(s=>s.phase===1),[]),false);assert.equal(canRide(72,100.1,calibrated.filter(s=>s.phase===1),[]),true);
for(const s of calibrated)for(const c of s.connections){if(!c.matches||!/^SCENE_\d+\./.test(c.matches))continue;const [id,key]=c.matches.split('.'),other=calibrated.find(o=>o.phase===s.phase&&o.scene.id===id),mate=other.connections.find(o=>o.id===key);assert.deepEqual(worldPoint(c.position,s.origin),worldPoint(mate.position,other.origin));assert.equal(c.width_m,mate.width_m);}
console.log('Calibrated waterfront retains road/path seams and blocks the full sea region.');

for(const s of calibrated)for(const bay of s.bays){const [a,b,c,d]=bay.rect,x=(a+c)/2,y=(b+d)/2;assert.ok(a<c&&b<d,`${s.key}:${bay.id} has positive area`);assert.ok(s.buildings.every(building=>x<building.rect[0]||x>building.rect[2]||y<building.rect[1]||y>building.rect[3]),`${s.key}:${bay.id} is outside building collision footprints`);}
console.log('All calibrated pickup bay centers remain outside buildings.');

const urban=calibrated.filter(s=>s.phase===2);assert.equal(canRide(60,230,urban,[]),true);assert.equal(canRide(40,230,urban,[]),false);
