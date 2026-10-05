export const realLocations={
 kochi:{name:'Fort Kochi',subtitle:'Heritage streets · waterfront deliveries',traffic:18,people:20,trees:100},
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
export function pointInArea(x,z,area){return pointInPolygon(x,z,area.points)&&!(area.holes||[]).some(h=>pointInPolygon(x,z,h));}
export function segmentDistance(x,z,a,b){
 const dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz,t=length?Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/length)):0;
 return Math.hypot(x-a.x-t*dx,z-a.z-t*dz);
}
export function prepareRealMap(data){
 const project=points=>points.map(p=>projectGeo(p,data.origin));
 const roads=data.roads.map(r=>({...r,points:project(r.points)}));
 const buildings=data.buildings.map(b=>({...b,points:project(b.points)}));
 const areas=data.areas.map(a=>({...a,points:project(a.points),holes:(a.holes||[]).map(project)}));
 const coastlines=(data.coastlines||[]).map(a=>({...a,points:project(a.points)}));
 const landmarks=(data.landmarks||[]).map(a=>({...a,point:projectGeo(a.point,data.origin)}));
 const southwest=projectGeo([data.bounds[0],data.bounds[1]],data.origin),northeast=projectGeo([data.bounds[2],data.bounds[3]],data.origin);
 const bounds={minX:southwest.x,maxX:northeast.x,minZ:northeast.z,maxZ:southwest.z};
 const segments=roads.flatMap(r=>r.points.slice(1).map((b,i)=>({a:r.points[i],b,width:r.width,name:r.name,id:r.id,oneway:r.oneway}))).filter(s=>Math.hypot(s.b.x-s.a.x,s.b.z-s.a.z)>.05);
 function nearestRoad(x,z){let nearest=null,distance=Infinity;for(const segment of segments){const d=segmentDistance(x,z,segment.a,segment.b);if(d<distance){distance=d;nearest=segment;}}return {segment:nearest,distance};}
 const water=areas.filter(a=>a.kind==='water'),waterAt=(x,z)=>water.some(a=>pointInArea(x,z,a));
 return {roads,buildings,areas,coastlines,landmarks,bounds,segments,nearestRoad,waterAt};
}

// Restrict delivery candidates to the actual road component containing the start.
export function reachableRoads(map,start){
 const key=p=>`${p.x.toFixed(3)},${p.z.toFixed(3)}`,links=new Map();
 for(const s of map.segments)for(const [a,b]of [[s.a,s.b],[s.b,s.a]]){const k=key(a);if(!links.has(k))links.set(k,[]);links.get(k).push(key(b));}
 const first=map.nearestRoad(start.x,start.z).segment,seen=new Set([key(first.a)]),queue=[key(first.a)];
 for(let i=0;i<queue.length;i++)for(const k of links.get(queue[i])||[])if(!seen.has(k)){seen.add(k);queue.push(k);}
 return map.segments.filter(s=>seen.has(key(s.a))&&seen.has(key(s.b)));
}

export function roadRoute(map,start,end){
 const key=p=>`${p.x.toFixed(3)},${p.z.toFixed(3)}`,nodes=new Map();
 const add=(p)=>{const k=key(p);if(!nodes.has(k))nodes.set(k,{point:p,edges:[]});return k;};
 const edge=(a,b)=>{nodes.get(add(a)).edges.push({to:add(b),cost:Math.hypot(b.x-a.x,b.z-a.z)});};
 for(const s of map.segments){edge(s.a,s.b);if(!s.oneway)edge(s.b,s.a);}
 const from='start',to='end',firstKey='start-road',lastKey='end-road';
 const first=map.nearestRoad(start.x,start.z).segment,last=map.nearestRoad(end.x,end.z).segment;
 const project=(p,s)=>{const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,t=Math.max(0,Math.min(1,((p.x-s.a.x)*dx+(p.z-s.a.z)*dz)/(dx*dx+dz*dz)));return {x:s.a.x+dx*t,z:s.a.z+dz*t,t};};
 const firstPoint=project(start,first),lastPoint=project(end,last);
 for(const [k,p]of [[from,start],[to,end],[firstKey,firstPoint],[lastKey,lastPoint]])nodes.set(k,{point:p,edges:[]});
 const link=(a,b)=>{const p=nodes.get(a).point,q=nodes.get(b).point;nodes.get(a).edges.push({to:b,cost:Math.hypot(q.x-p.x,q.z-p.z)});};
 link(from,firstKey);link(lastKey,to);
 for(const p of first.oneway?[first.b]:[first.a,first.b])link(firstKey,key(p));
 for(const p of last.oneway?[last.a]:[last.a,last.b])link(key(p),lastKey);
 if(first===last&&(!first.oneway||lastPoint.t>=firstPoint.t))link(firstKey,lastKey);
 const distance=new Map([[from,0]]),previous=new Map(),pending=new Set([from]);
 // ponytail: linear minimum selection suits the local snapshot; use a heap for city-scale routing.
 while(pending.size){const k=[...pending].reduce((a,b)=>distance.get(a)<distance.get(b)?a:b);pending.delete(k);if(k===to)break;for(const e of nodes.get(k).edges){const d=distance.get(k)+e.cost;if(d<(distance.get(e.to)??Infinity)){distance.set(e.to,d);previous.set(e.to,k);pending.add(e.to);}}}
 if(!previous.has(to))return [];const path=[];for(let k=to;k;k=previous.get(k))path.push(nodes.get(k).point);return path.reverse();
}
