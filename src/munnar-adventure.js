import * as THREE from 'three';
import {segmentDistance} from './real-map-data.js';

export const ridingSurfaces={
 asphalt:{name:'Asphalt',speedLimit:14,wet:false,damage:0},
 grass:{name:'Open ground',speedLimit:6,wet:true,damage:.08},
 dirt:{name:'Dirt trail',speedLimit:7,wet:true,damage:.12},
 gravel:{name:'Gravel climb',speedLimit:6,wet:true,damage:.18},
 mud:{name:'Mud',speedLimit:3.5,wet:true,damage:.25},
};
export function prepareAdventure(data,map){
 const sourceNearest=map.nearestRoad;
 const clear=p=>!map.buildings.some(b=>pointWithin(p,b.points,1.9))&&!map.areas.some(a=>a.kind==='water'&&pointWithin(p,a.points,1.9));
 const trails=data.trails.map(t=>{
  const curve=new THREE.CatmullRomCurve3(t.points.map(p=>new THREE.Vector3(p.x,0,p.z)),false,'centripetal');
  const smooth=curve.getSpacedPoints(Math.ceil(curve.getLength()/2)).map(p=>({x:p.x,z:p.z}));
  // ponytail: keep authored polylines if smoothing crosses a footprint; custom spline fitting only if needed.
  const points=smooth.every(clear)?smooth:t.points;
  const segments=points.slice(1).map((b,i)=>({a:points[i],b,width:t.width,name:t.name,fictional:true,surface:t.id==='tea'&&i>points.length*.40&&i<points.length*.49?'mud':t.surface,trailId:t.id}));
  return {...t,points,segments};
 });
 const segments=trails.flatMap(t=>t.segments);
 function nearestTrail(x,z){let distance=Infinity,segment=null;for(const s of segments){const d=segmentDistance(x,z,s.a,s.b);if(d<distance){distance=d;segment=s}}return {distance,segment}}
 map.nearestRoad=(x,z)=>{const road=sourceNearest(x,z),trail=nearestTrail(x,z);return trail.distance<road.distance?trail:road};
 function surfaceAt(x,z){const road=sourceNearest(x,z);if(road.distance<=road.segment.width/2)return ridingSurfaces.asphalt;const trail=nearestTrail(x,z);if(trail.distance<=trail.segment.width/2)return ridingSurfaces[trail.segment.surface];return ridingSurfaces.grass}
 const stops=trails.map(t=>({...t.points[Math.floor(t.points.length*.55)],street:t.id==='tea'?'Tea estate cottage':'Ridge lookout',offroad:true,trailId:t.id}));
 return {...data,trails,segments,stops,nearestTrail,surfaceAt,sourceNearest};
}
function pointWithin(p,poly,radius){
 let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];if(segmentDistance(p.x,p.z,a,b)<radius)return true;
  if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)inside=!inside;
 }return inside;
}
export function munnarHeight(x,z){return 35+24*Math.sin(x/320)*Math.cos(z/280)+8*Math.sin(z/155)+47*Math.exp(-((x+425)**2+(z+410)**2)/(280**2))+35*Math.exp(-((x+720)**2+(z+90)**2)/(320**2))}
