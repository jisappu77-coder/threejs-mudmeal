import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareRealMap,projectGeo,realLocations} from '../src/real-map-data.js';
for(const id of Object.keys(realLocations)){
 const data=JSON.parse(await readFile(`public/maps/${id}.json`,'utf8')),map=prepareRealMap(data);
 assert.equal(data.id,id);assert.match(data.source,/api.openstreetmap.org/);assert.match(data.license,/ODbL/);
 assert.ok(data.roads.length>50&&data.buildings.length>100&&map.segments.length>100);
 const [west,south,east,north]=data.bounds;
 for(const feature of [...data.roads,...data.buildings,...data.areas]){
  assert.ok(feature.id>0&&feature.points.length>=2);
  for(const [lon,lat] of feature.points)assert.ok(Number.isFinite(lon)&&Number.isFinite(lat)&&lon>=west-1e-9&&lon<=east+1e-9&&lat>=south-1e-9&&lat<=north+1e-9);
 }
 assert.ok(map.bounds.maxX-map.bounds.minX>900&&map.bounds.maxZ-map.bounds.minZ>900);
 assert.deepEqual(map.roads[0].points[0],projectGeo(data.roads[0].points[0],data.origin));
 assert.ok(map.roads.some(r=>r.name));assert.ok(map.buildings.every(b=>b.height>0));
 for(const s of map.segments)assert.ok(map.nearestRoad(s.a.x,s.a.z).distance<1e-8);
 console.log(`${id}: real geographic roads, footprints, clipping and projection passed`);
}

// Adventure routes must reconnect to actual roads and leave the rideable corridor clear.
const {prepareAdventure,munnarHeight}=await import('../src/munnar-adventure.js');
const source=JSON.parse(await readFile('public/maps/munnar.json','utf8')),base=prepareRealMap(source),plan=JSON.parse(await readFile('public/maps/munnar-adventure.json','utf8'));
const originalNearest=base.nearestRoad,adventure=prepareAdventure(plan,base);
assert.equal(adventure.trails.length,2);assert.deepEqual(plan.mainCircuit[0],plan.mainCircuit.at(-1));
for(const trail of adventure.trails){
 for(const p of [trail.points[0],trail.points.at(-1)])assert.ok(originalNearest(p.x,p.z).distance<.01,'Trail entrance and exit must connect to OSM roads');
 assert.ok(trail.returnRoad.length>2);
 for(const s of trail.segments){
  const distance=Math.hypot(s.b.x-s.a.x,s.b.z-s.a.z),grade=Math.abs(munnarHeight(s.b.x,s.b.z)-munnarHeight(s.a.x,s.a.z))/distance;
  assert.ok(distance>0&&grade<.28,'Trail grades must be climbable with the existing bike');
  for(const p of [s.a,s.b])assert.ok(Number.isFinite(munnarHeight(p.x,p.z))&&base.nearestRoad(p.x,p.z).distance<.001);
 }
 console.log(`${trail.name}: connected entrances/exits, return roads and rideable grades passed`);
}
assert.ok(adventure.trails[0].segments.some(s=>s.surface==='mud'));
