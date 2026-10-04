export const realLocations={
 kochi:{name:'Busy Kochi',subtitle:'Ernakulam streets · dense city traffic',traffic:30,people:16,trees:100},
 munnar:{name:'Munnar',subtitle:'Town roads · tea-country scenery',traffic:10,people:8,trees:400},
 thekkady:{name:'Thekkady',subtitle:'Periyar approach · forest scenery',traffic:6,people:4,trees:1000},
};

// Local metre coordinates retain the real OSM road/footprint alignment; north is -Z.
export function projectGeo([lon,lat],[originLon,originLat]){
 return {x:(lon-originLon)*111320*Math.cos(originLat*Math.PI/180),z:-(lat-originLat)*111320};
}
export function pointInPolygon(x,z,points){
 let inside=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const a=points[i],b=points[j];
  if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside;
 }
 return inside;
}
export function segmentDistance(x,z,a,b){
 const dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz,t=length?Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/length)):0;
 return Math.hypot(x-a.x-t*dx,z-a.z-t*dz);
}
export function prepareRealMap(data){
 const project=points=>points.map(p=>projectGeo(p,data.origin));
 const roads=data.roads.map(r=>({...r,points:project(r.points)}));
 const buildings=data.buildings.map(b=>({...b,points:project(b.points)}));
 const areas=data.areas.map(a=>({...a,points:project(a.points)}));
 const southwest=projectGeo([data.bounds[0],data.bounds[1]],data.origin),northeast=projectGeo([data.bounds[2],data.bounds[3]],data.origin);
 const bounds={minX:southwest.x,maxX:northeast.x,minZ:northeast.z,maxZ:southwest.z};
 const segments=roads.flatMap(r=>r.points.slice(1).map((b,i)=>({a:r.points[i],b,width:r.width,name:r.name,id:r.id,oneway:r.oneway}))).filter(s=>Math.hypot(s.b.x-s.a.x,s.b.z-s.a.z)>.05);
 function nearestRoad(x,z){let nearest=null,distance=Infinity;for(const segment of segments){const d=segmentDistance(x,z,segment.a,segment.b);if(d<distance){distance=d;nearest=segment;}}return {segment:nearest,distance};}
 return {roads,buildings,areas,bounds,segments,nearestRoad};
}
