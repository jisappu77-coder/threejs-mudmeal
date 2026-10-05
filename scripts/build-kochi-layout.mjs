// Original game composition from the user's images, not geographic map data.
import {writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {prepareMap} from '../src/real-map-data.js';
// Shared junctions: the waterfront sweeps around a peninsula; inland streets branch into it.
const junctions={
 w0:[115,-395],w1:[145,-310],w2:[195,-215],w3:[180,-120],w4:[175,-20],w5:[205,85],w6:[230,185],w7:[235,280],w8:[190,395],
 h0:[-385,-345],h1:[-260,-300],h2:[-120,-335],h3:[20,-275],h4:[-355,-190],h5:[-210,-145],h6:[-65,-195],h7:[70,-125],
 m0:[-330,-40],m1:[-185,20],m2:[-50,-35],m3:[65,40],m4:[-385,100],m5:[-255,140],m6:[-110,115],m7:[20,155],
 b0:[-280,195],b1:[-280,255],b2:[-70,195],b3:[-70,260],
 s0:[-405,335],s1:[-245,365],s2:[-100,340],s3:[55,310],s4:[65,405]
};
const roads=[];
function street(name,width,keys,{straight=false,bridge=false}={}){
 const anchors=keys.map(k=>typeof k==='string'?junctions[k]:k),curve=new THREE.CatmullRomCurve3(anchors.map(([x,z])=>new THREE.Vector3(x,0,z))),points=[];
 for(let i=1;i<anchors.length;i++){
  const a=anchors[i-1],b=anchors[i],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/16);
  for(let j=0;j<steps;j++){
   if(j===0)points.push(a); // Identical coordinates connect every shared junction.
   else if(straight)points.push([a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps]);
   else {const p=curve.getPoint((i-1+j/steps)/(anchors.length-1));points.push([p.x,p.z]);}
  }
 }
 points.push(anchors.at(-1));roads.push({id:roads.length+1,name,width,points,...(bridge?{bridge:true}:{})});
}
street('Waterfront Road',10,['w0','w1','w2','w3','w4','w5','w6',[234,212],[234,236],'w7','w8']);
street('Heritage Lane',8,['h0','h1','h2','h3','w1']);
street('Chapel Street',8,['h4','h5','h6','h7','w3']);
street('Market Street',9,['m0','m1','m2','m3','w4']);
street('Jetty Road',9,['m4','m5','m6','m7','w5']);
street('West Palm Lane',7,['h0',[-430,-270],'h4',[-420,-100],'m0','m4']);
street('Courtyard Lane',7,['h1',[-290,-215],'h5',[-245,-65],'m1','m5']);
street('Spice Lane',7,['h2',[-145,-260],'h6',[-110,-110],'m2','m6']);
street('Takeaway Lane',8,['h3',[15,-205],'h7',[30,-60],'m3','m7','w6']);
street('Old Town Link',7,['h4',[-285,-245],'h1']);
street('Churchyard Link',7,['h5',[-135,-95],'m2']);
street('Market Crescent',7,['m0',[-280,25],[-225,65],'m6']);
street('Canal Approach West',8,['m5',[-285,170],'b0']);
street('Canal Approach East',8,['m6',[-85,150],'b2']);
street('West Canal Bridge',8,['b0','b1'],{straight:true,bridge:true});
street('East Canal Bridge',8,['b2','b3'],{straight:true,bridge:true});
street('Southbank Road',9,['s0',[-345,290],'b1',[-175,290],'b3','s3','w7']);
street('Garden Lane',7,['s0',[-330,390],'s1','s2','s3']);
street('Island Court',7,['b1',[-275,315],'s1']);
street('Ferry Approach',8,['b3',[-25,315],'s2']);
street('Harbour Link',8,['s3',[90,355],'s4','w8']);
street('Backwater Lane',7,['s2',[-40,395],'s4']);
// Split incidental crossings too, so navigation and traffic see the same junctions as the renderer.
const spans=roads.flatMap(road=>road.points.slice(1).map((b,i)=>({road,i,a:road.points[i],b,cuts:[]})));
for(let i=0;i<spans.length;i++)for(let j=i+1;j<spans.length;j++){
 const a=spans[i],b=spans[j];if(a.road===b.road)continue;
 const dx=a.b[0]-a.a[0],dz=a.b[1]-a.a[1],ex=b.b[0]-b.a[0],ez=b.b[1]-b.a[1],cross=dx*ez-dz*ex;
 if(Math.abs(cross)<1e-8)continue;
 const qx=b.a[0]-a.a[0],qz=b.a[1]-a.a[1],t=(qx*ez-qz*ex)/cross,u=(qx*dz-qz*dx)/cross;
 if(t>1e-6&&t<1-1e-6&&u>1e-6&&u<1-1e-6){const point=[a.a[0]+t*dx,a.a[1]+t*dz];a.cuts.push({t,point});b.cuts.push({t:u,point});}
}
for(const road of roads)road.points=[...spans.filter(s=>s.road===road).flatMap(s=>[s.a,...s.cuts.sort((a,b)=>a.t-b.t).map(c=>c.point)]),road.points.at(-1)];
// The quay is offset from the actual waterfront curve, with a narrow canal behind the southern district.
const waterfront=roads[0].points,shore=[[145,-450],...waterfront.map(([x,z])=>[x+32,z]),[222,450]];
const rect=(x,z,w,d)=>[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]];
const canals=[[-500,-287],[-273,-77],[-63,222],[246,280]].map(([a,b],i)=>({id:i+2,kind:'water',points:rect((a+b)/2,224,b-a,24),holes:[]}));
const data={id:'kochi',name:'Kochi Waterfront',units:'metres',bounds:[-500,-450,520,450],source:'project-authored',references:['72849.jpg','72861.jpg','72860.jpg','72859.jpg','72858.jpg','72857.jpg','72855.jpg','72854.jpg','72851.jpg','file_00000000f10c82088d9c16691b207b83.jpg'],roads,buildings:[],areas:[{id:1,kind:'water',points:[...shore,[520,450],[520,-450]],holes:[]},...canals],coastlines:[{id:1,points:shore}],landmarks:[{id:1,kind:'fishing-nets',name:'Fishing-net promenade',point:[212,-120]},{id:2,kind:'jetty',name:'Waterfront jetty',point:[237,85]},{id:3,kind:'restaurant',name:'Restaurant frontage',point:[176,-70]}],bridges:[{x:-280,z:224,width:10,length:30},{x:-70,z:224,width:10,length:30},{x:234,z:224,width:12,length:30}]};
const map=prepareMap(data);
// Keep the restaurant frontage and chapel plaza open while packing homes around irregular streets.
const reserved=[{x:155,z:-70,w:48,d:95},{x:195,z:-70,w:24,d:80},{x:135,z:65,w:44,d:50}];
function add(x,z,w,d,height,extra={}){
 const points=rect(x,z,w,d);
 if(points.some(([x,z])=>{const r=map.nearestRoad(x,z);return x<-480||x>480||z<-425||z>425||r.distance<r.segment.width/2+3.5||map.waterAt(x,z)}))return;
 if(data.buildings.some(b=>{const lo=b.points[0],hi=b.points[2];return x+w/2+1>lo[0]&&x-w/2-1<hi[0]&&z+d/2+1>lo[1]&&z-d/2-1<hi[1]}))return;
 data.buildings.push({id:data.buildings.length+1,height,points,...extra});
}
add(135,65,22,24,7,{name:'Waterfront Chapel',landmark:'chapel'});
for(const road of roads)for(let i=1;i<road.points.length;i++){
 if(i%5===0)continue;
 const a=road.points[i-1],b=road.points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
 for(const side of [-1,1])for(const setback of [17]){
  const id=data.buildings.length+1,w=9+id%5,d=9+(id*3)%5,x=(a[0]+b[0])/2+(b[1]-a[1])/length*setback*side,z=(a[1]+b[1])/2-(b[0]-a[0])/length*setback*side;
  if(reserved.some(r=>Math.abs(x-r.x)<(w+r.w)/2&&Math.abs(z-r.z)<(d+r.d)/2))continue;
  add(x,z,w,d,x<-300&&id%11===0?12:3.5+(id%3)*2.5);
 }
}
await writeFile('public/maps/kochi.json',JSON.stringify(data)+'\n');
console.log(`Image-composed Kochi: ${roads.length} branching roads, ${data.buildings.length} buildings, 3 canal crossings.`);
