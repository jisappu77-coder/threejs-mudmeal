import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFile} from 'node:fs/promises';
import {prepareMap,locations,pointInPolygon,segmentDistance,roadRoute,reachableRoads} from '../src/real-map-data.js';
import {createKeralaRoof,planKochiInfill} from '../src/real-map-art.js';
import {planWaterfront} from '../src/kochi-waterfront.js';
for(const id of Object.keys(locations)){
 const data=JSON.parse(await readFile(`public/maps/${id}.json`,'utf8')),map=prepareMap(data);
 assert.equal(data.id,id);assert.equal(data.source,'project-authored');assert.equal(data.units,'metres');assert.ok(data.references.includes('72849.jpg')&&data.references.includes('73044.jpg'));assert.ok(data.buildings.filter(b=>b.frontage).length>=3);assert.equal('origin' in data,false);assert.doesNotMatch(JSON.stringify(data),/https?:|OpenStreetMap|sourceIds/);
 assert.ok(data.roads.length>=12&&data.buildings.length>100&&map.segments.length>100);
 const [minX,minZ,maxX,maxZ]=data.bounds;
 for(const feature of [...data.roads,...data.buildings,...data.areas]){
  assert.ok(feature.id>0&&feature.points.length>=2);
  for(const [x,z] of [feature.points,...(feature.holes||[])].flat())assert.ok(Number.isFinite(x)&&Number.isFinite(z)&&x>=minX-1e-9&&x<=maxX+1e-9&&z>=minZ-1e-9&&z<=maxZ+1e-9);
 }
 assert.ok(map.bounds.maxX-map.bounds.minX>900&&map.bounds.maxZ-map.bounds.minZ>=800);
 assert.deepEqual(map.roads[0].points[0],{x:data.roads[0].points[0][0],z:data.roads[0].points[0][1]});
 for(const road of map.roads.filter(r=>['Waterfront Road','Heritage Lane','Market Street','Jetty Road','Southbank Road'].includes(r.name))){const a=road.points[0],b=road.points.at(-1),length=Math.hypot(b.x-a.x,b.z-a.z),bow=Math.max(...road.points.map(p=>Math.abs((b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x))/length));assert.ok(bow>25,`${road.name} must have a visible bend rather than a straight avenue`);}
 assert.ok(map.roads.some(r=>r.name));assert.ok(map.buildings.every(b=>b.height>0));
 const links=new Map(),key=p=>`${p.x.toFixed(3)},${p.z.toFixed(3)}`;
 for(const s of map.segments)for(const [a,b]of [[s.a,s.b],[s.b,s.a]]){if(!links.has(key(a)))links.set(key(a),new Set());links.get(key(a)).add(key(b));}
 assert.ok([...links.values()].filter(edges=>edges.size===3).length>=8,'The image composition needs branching junctions');
 assert.equal(map.bridges.length,4);assert.ok(map.buildings.some(b=>b.landmark==='chapel'));
 for(const bridge of map.bridges)for(let d=-12;d<=12;d+=2){assert.ok(!map.waterAt(bridge.x,bridge.z+d),'Canal crossings must have a dry continuous riding surface');const near=map.nearestRoad(bridge.x,bridge.z+d);assert.ok(near.distance<near.segment.width/2-.9,'The full bike must fit inside the connected road across every bridge');}
 for(const b of map.buildings)for(const p of b.points){const near=map.nearestRoad(p.x,p.z);assert.ok(!map.waterAt(p.x,p.z)&&near.distance>near.segment.width/2+3,'Authored building footprints must leave roads and water clear');}
 for(let i=0;i<map.buildings.length;i++)for(const b of map.buildings.slice(i+1)){const a=map.buildings[i],lo=a.points[0],hi=a.points[2],blo=b.points[0],bhi=b.points[2];assert.ok(hi.x<=blo.x||lo.x>=bhi.x||hi.z<=blo.z||lo.z>=bhi.z,'Original building lots must not overlap');}

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
 assert.ok(roofCount>100,'The authored neighbourhood must contain Kerala-style roofs');
 const buildingBounds=map.buildings.map(b=>({...b,minX:Math.min(...b.points.map(p=>p.x)),maxX:Math.max(...b.points.map(p=>p.x)),minZ:Math.min(...b.points.map(p=>p.z)),maxZ:Math.max(...b.points.map(p=>p.z))}));
 const clear=(x,z,r)=>{const near=map.nearestRoad(x,z),bounds=map.bounds;return x-r>bounds.minX&&x+r<bounds.maxX&&z-r>bounds.minZ&&z+r<bounds.maxZ&&near.distance>near.segment.width/2+1.8+r&&!buildingBounds.some(b=>x>b.minX-r&&x<b.maxX+r&&z>b.minZ-r&&z<b.maxZ+r&&(pointInPolygon(x,z,b.points)||b.points.some((p,i)=>segmentDistance(x,z,p,b.points[(i+1)%b.points.length])<r)))&&!map.waterAt(x,z)&&!map.areas.filter(a=>a.kind==='water').some(a=>[a.points,...a.holes].some(ring=>ring.some((p,i)=>segmentDistance(x,z,p,ring[(i+1)%ring.length])<r)));};
 const infill=planKochiInfill(map,clear);assert.ok(infill.length>100,'Empty street surroundings should receive substantial infill');
 assert.deepEqual(infill,planKochiInfill(map,clear),'Illustrative scenery must keep a stable layout');
 for(const [i,p]of infill.entries()){assert.ok(p.cells.every(q=>clear(q.x,q.z,q.radius)));for(const q of infill.slice(i+1))assert.ok(Math.hypot(p.x-q.x,p.z-q.z)>=p.radius+q.radius+1-1e-8,'Neighbourhood lots must not overlap');}
 assert.deepEqual(planKochiInfill(map,()=>false),[],'Blocked land must stay empty');console.log(`${infill.length} illustrative lots: road, footprint, water and overlap clearance passed`);
 const site=planWaterfront(map);assert.equal(reachableRoads(map,site.spawn).length,map.segments.length,'Every curved street must connect to the delivery network');assert.ok(!map.waterAt(site.x,site.z)&&!map.waterAt(site.spawn.x,site.spawn.z));
 assert.ok(site.x<site.street.x&&map.waterAt(site.street.x+site.nx*40,site.street.z+site.nz*40),'The latest street references place cafés inland, opposite the promenade and harbour');
 const chapel=map.buildings.find(b=>b.landmark==='chapel');assert.ok(chapel.points.every(p=>p.z<site.z-80),'The chapel belongs farther along the quay behind the restaurant');
 for(const [p,expected]of [[{x:150,z:95},false],[{x:300,z:0},true]])assert.equal(map.waterAt(p.x,p.z),expected,'Authored shore must separate driveable land and harbour water');
 assert.ok(map.coastlines.length&&map.landmarks.some(p=>p.kind==='fishing-nets'));
 for(const area of map.areas.filter(a=>a.kind==='water')){
  const shape=ring=>{const path=new THREE.Shape();ring.forEach((p,i)=>i?path.lineTo(p.x,-p.z):path.moveTo(p.x,-p.z));path.closePath();return path;};
  const outer=shape(area.points);outer.holes=area.holes.map(shape);const geometry=new THREE.ShapeGeometry(outer),positions=geometry.attributes.position,indices=geometry.index;
  for(let i=0;i<indices.count;i+=3){let x=0,z=0;for(let j=0;j<3;j++){const k=indices.getX(i+j);x+=positions.getX(k)/3;z-=positions.getY(k)/3;}assert.ok(map.waterAt(x,z)||map.coastlines.some(line=>line.points.slice(1).some((b,i)=>segmentDistance(x,z,line.points[i],b)<1e-4)),'Rendered harbour triangles must not cover land holes');}geometry.dispose();
 }

 for(const road of ['Market Street','Heritage Lane','Jetty Road']){const s=map.segments.find(s=>s.name===road),p={x:(s.a.x+s.b.x)/2,z:(s.a.z+s.b.z)/2};assert.ok(roadRoute(map,site.spawn,p).length>1,`${road} must connect to pickup`);}
 console.log('Waterfront restaurant clearance, authored shoreline, scenery anchors and named delivery connections passed');
 assert.equal(createKeralaRoof([{x:0,z:0},{x:8,z:0},{x:8,z:3},{x:3,z:3},{x:3,z:8},{x:0,z:8}],6),null,'Concave footprints retain flat roofs');
 console.log(`${roofCount} pitched roofs: finite geometry and complete footprint coverage passed`);
 console.log(`${id}: original road layout, building footprints and local coordinates passed`);
}

const fixture=oneway=>prepareMap({bounds:[0,0,100,100],buildings:[],areas:[],roads:[{id:1,width:5,oneway,points:[[0,0],[100,0]]}]});
const route=roadRoute(fixture(false),{x:10,z:2},{x:20,z:-2});
assert.deepEqual(route.map(p=>[p.x,p.z]),[[10,2],[10,0],[20,0],[20,-2]],'A same-segment route must use perpendicular road approaches and avoid detouring to endpoints');
assert.equal(roadRoute(fixture(true),{x:20,z:0},{x:10,z:0}).length,0,'Delivery routing must respect one-way streets');
console.log('Same-street navigation and one-way restrictions passed');
