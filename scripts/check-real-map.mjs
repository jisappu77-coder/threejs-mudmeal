import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFile} from 'node:fs/promises';
import {prepareRealMap,projectGeo,realLocations,pointInPolygon,segmentDistance,roadRoute} from '../src/real-map-data.js';
import {createKeralaRoof,planKochiInfill} from '../src/real-map-art.js';
import {planWaterfront} from '../src/kochi-waterfront.js';
for(const id of Object.keys(realLocations)){
 const data=JSON.parse(await readFile(`public/maps/${id}.json`,'utf8')),map=prepareRealMap(data);
 assert.equal(data.id,id);assert.match(data.source,/api.openstreetmap.org/);assert.match(data.license,/ODbL/);
 assert.ok(data.roads.length>50&&data.buildings.length>100&&map.segments.length>100);
 const [west,south,east,north]=data.bounds;
 for(const feature of [...data.roads,...data.buildings,...data.areas]){
  assert.ok(feature.id>0&&feature.points.length>=2);
  for(const [lon,lat] of [feature.points,...(feature.holes||[])].flat())assert.ok(Number.isFinite(lon)&&Number.isFinite(lat)&&lon>=west-1e-9&&lon<=east+1e-9&&lat>=south-1e-9&&lat<=north+1e-9);
 }
 assert.ok(map.bounds.maxX-map.bounds.minX>900&&map.bounds.maxZ-map.bounds.minZ>900);
 assert.deepEqual(map.roads[0].points[0],projectGeo(data.roads[0].points[0],data.origin));
 assert.ok(map.roads.some(r=>r.name));assert.ok(map.buildings.every(b=>b.height>0));
 for(const s of map.segments)assert.ok(map.nearestRoad(s.a.x,s.a.z).distance<1e-8);
 let roofCount=0;
 for(const b of map.buildings){
  if(b.height>9)continue;const roof=createKeralaRoof(b.points,b.height+.1);if(!roof)continue;roofCount++;
  const p=roof.geometry.attributes.position;assert.ok(Array.from(p.array).every(Number.isFinite));
  assert.ok(roof.geometry.index&&Array.from(roof.geometry.attributes.uv.array).every(Number.isFinite),'Roof geometry must merge with flat roofs and have finite tile coordinates');
  let projectedArea=0;for(let i=0;i<p.count;i+=3)projectedArea+=Math.abs((p.getX(i+1)-p.getX(i))*(p.getZ(i+2)-p.getZ(i))-(p.getZ(i+1)-p.getZ(i))*(p.getX(i+2)-p.getX(i)))/2;
  const polygonArea=Math.abs(roof.eaves.reduce((area,a,i)=>{const c=roof.eaves[(i+1)%roof.eaves.length];return area+a.x*c.z-c.x*a.z},0))/2;
  assert.ok(Math.abs(projectedArea-polygonArea)<Math.max(.02,polygonArea*.001),'Sloping roof must cover its footprint without holes or overlapping faces');roof.geometry.dispose();
 }
 assert.ok(roofCount>100,'The mapped neighbourhood must contain Kerala-style roofs');
 const buildingBounds=map.buildings.map(b=>({...b,minX:Math.min(...b.points.map(p=>p.x)),maxX:Math.max(...b.points.map(p=>p.x)),minZ:Math.min(...b.points.map(p=>p.z)),maxZ:Math.max(...b.points.map(p=>p.z))}));
 const clear=(x,z,r)=>{const near=map.nearestRoad(x,z),bounds=map.bounds;return x-r>bounds.minX&&x+r<bounds.maxX&&z-r>bounds.minZ&&z+r<bounds.maxZ&&near.distance>near.segment.width/2+1.8+r&&!buildingBounds.some(b=>x>b.minX-r&&x<b.maxX+r&&z>b.minZ-r&&z<b.maxZ+r&&(pointInPolygon(x,z,b.points)||b.points.some((p,i)=>segmentDistance(x,z,p,b.points[(i+1)%b.points.length])<r)))&&!map.waterAt(x,z)&&!map.areas.filter(a=>a.kind==='water').some(a=>[a.points,...a.holes].some(ring=>ring.some((p,i)=>segmentDistance(x,z,p,ring[(i+1)%ring.length])<r)));};
 const infill=planKochiInfill(map,clear);assert.ok(infill.length>100,'Empty street surroundings should receive substantial infill');
 assert.deepEqual(infill,planKochiInfill(map,clear),'Illustrative scenery must keep a stable layout');
 for(const [i,p]of infill.entries()){assert.ok(p.cells.every(q=>clear(q.x,q.z,q.radius)));for(const q of infill.slice(i+1))assert.ok(Math.hypot(p.x-q.x,p.z-q.z)>=p.radius+q.radius+1-1e-8,'Neighbourhood lots must not overlap');}
 assert.deepEqual(planKochiInfill(map,()=>false),[],'Blocked land must stay empty');console.log(`${infill.length} illustrative lots: road, footprint, water and overlap clearance passed`);
 const site=planWaterfront(map);assert.ok(!map.waterAt(site.x,site.z)&&!map.waterAt(site.spawn.x,site.spawn.z));
 for(const [geo,expected]of [[[76.2409,9.9661],false],[[76.238,9.969],true]]){const p=projectGeo(geo,data.origin);assert.equal(map.waterAt(p.x,p.z),expected,'Coastline must keep the heritage district dry and the harbour wet');}
 assert.ok(map.coastlines.length&&map.landmarks.some(p=>/Chinese Fishing/i.test(p.name)));
 for(const area of map.areas.filter(a=>a.kind==='water')){
  const shape=ring=>{const path=new THREE.Shape();ring.forEach((p,i)=>i?path.lineTo(p.x,-p.z):path.moveTo(p.x,-p.z));path.closePath();return path;};
  const outer=shape(area.points);outer.holes=area.holes.map(shape);const geometry=new THREE.ShapeGeometry(outer),positions=geometry.attributes.position,indices=geometry.index;
  for(let i=0;i<indices.count;i+=3){let x=0,z=0;for(let j=0;j<3;j++){const k=indices.getX(i+j);x+=positions.getX(k)/3;z-=positions.getY(k)/3;}assert.ok(map.waterAt(x,z),'Rendered harbour triangles must not cover land holes');}geometry.dispose();
 }

 for(const road of ['Tower Road','Bastian Street','Bellar Road']){const s=map.segments.find(s=>s.name===road),p={x:(s.a.x+s.b.x)/2,z:(s.a.z+s.b.z)/2};assert.ok(roadRoute(map,site.spawn,p).length>1,`${road} must connect to pickup`);}
 console.log('Waterfront restaurant clearance, coastline land holes, landmarks and named delivery connections passed');
 assert.equal(createKeralaRoof([{x:0,z:0},{x:8,z:0},{x:8,z:3},{x:3,z:3},{x:3,z:8},{x:0,z:8}],6),null,'Concave footprints retain flat roofs');
 console.log(`${roofCount} pitched roofs: finite geometry and complete footprint coverage passed`);
 console.log(`${id}: real geographic roads, footprints, clipping and projection passed`);
}

const fixture=oneway=>prepareRealMap({origin:[0,0],bounds:[0,0,1,1],buildings:[],areas:[],roads:[{id:1,width:5,oneway,points:[[0,0],[.001,0]]}]});
const route=roadRoute(fixture(false),{x:10,z:2},{x:20,z:-2});
assert.deepEqual(route.map(p=>[p.x,p.z]),[[10,2],[10,0],[20,0],[20,-2]],'A same-segment route must use perpendicular road approaches and avoid detouring to endpoints');
assert.equal(roadRoute(fixture(true),{x:20,z:0},{x:10,z:0}).length,0,'Delivery routing must respect one-way streets');
console.log('Same-street navigation and one-way restrictions passed');
