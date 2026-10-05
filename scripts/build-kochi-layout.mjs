// Original game layout, composed from the user's image references. Units are metres.
import {writeFile} from 'node:fs/promises';
import {prepareMap} from '../src/real-map-data.js';
const xs=[-420,-340,-250,-160,-70,30,110,190],zs=[-380,-300,-215,-130,-40,50,140,235,325,390];
// Two smooth, invertible bends keep junctions connected while removing straight avenues.
const bend=z=>45*Math.sin(z/130)+14*Math.sin(z/52);
const node=(x,z)=>{const px=x+bend(z);return [px,z+30*Math.sin((px+150)/95)+12*Math.sin(px/45)]};
function street(points){const result=[];for(let i=1;i<points.length;i++){const [ax,az]=points[i-1],[bx,bz]=points[i],steps=Math.ceil(Math.hypot(bx-ax,bz-az)/16);for(let j=0;j<steps;j++)result.push(node(ax+(bx-ax)*j/steps,az+(bz-az)*j/steps));}result.push(node(...points.at(-1)));return result;}
const roads=[];
for(const [i,x]of xs.entries())roads.push({id:roads.length+1,name:x===190?'Waterfront Road':x===110?'Market Street':`Palm Lane ${i+1}`,width:x===190?10:8,points:street(zs.map(z=>[x,z]))});
for(const [i,z]of zs.entries())roads.push({id:roads.length+1,name:z===50?'Heritage Lane':z===140?'Jetty Road':`Neighbourhood Street ${i+1}`,width:i%3===0?9:8,points:street(xs.map(x=>[x,z]))});
// Follow the same bends with the harbour edge; solve endpoints against the playable bounds.
const shore=[];for(let worldZ=-450;worldZ<=450;worldZ+=6){let lo=-510,hi=510;for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(node(220,mid)[1]<worldZ)lo=mid;else hi=mid;}shore.push([node(220,(lo+hi)/2)[0],worldZ]);}
const rect=(x,z,w,d)=>[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]];
const data={id:'kochi',name:'Kochi Waterfront',units:'metres',bounds:[-500,-450,520,450],source:'project-authored',references:['72849.jpg','72861.jpg','72860.jpg','72859.jpg','72858.jpg','72857.jpg','72855.jpg','72854.jpg','72851.jpg','file_00000000f10c82088d9c16691b207b83.jpg'],roads,buildings:[],areas:[{id:1,kind:'water',points:[...shore,[520,450],[520,-450]],holes:[]}],coastlines:[{id:1,points:shore}],landmarks:[{id:1,kind:'fishing-nets',name:'Fishing-net promenade',point:node(220,-120)},{id:2,kind:'jetty',name:'Waterfront jetty',point:node(220,180)}]};
const map=prepareMap(data),reserved=[{x:170,z:-12,w:45,d:90},{x:150,z:95,w:38,d:42}];
function add(x,z,w,d,height,extra={}){
 const [px,pz]=node(x,z),points=rect(px,pz,w,d);
 if(points.some(([x,z])=>{const r=map.nearestRoad(x,z);return r.distance<r.segment.width/2+3.5||map.waterAt(x,z)}))return;
 if(data.buildings.some(b=>{const lo=b.points[0],hi=b.points[2];return px+w/2+1>lo[0]&&px-w/2-1<hi[0]&&pz+d/2+1>lo[1]&&pz-d/2-1<hi[1]}))return;
 data.buildings.push({id:data.buildings.length+1,height,points,...extra});
}
for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++){
 const x0=xs[i],x1=xs[i+1],z0=zs[j],z1=zs[j+1];
 const lots=[];for(const t of [.25,.5,.75])for(const z of [z0+16,z1-16])lots.push([x0+(x1-x0)*t,z]);for(const x of [x0+16,x1-16])lots.push([x,(z0+z1)/2]);
 for(const [x,z]of lots){const id=data.buildings.length+1,w=9+id%5,d=9+(id*3)%5;if(reserved.some(r=>Math.abs(x-r.x)<(w+r.w)/2&&Math.abs(z-r.z)<(d+r.d)/2))continue;add(x,z,w,d,i<2&&id%7===0?12:3.5+(id%3)*2.5);}
}
add(150,95,22,24,7,{name:'Waterfront Chapel',landmark:'chapel'});
await writeFile('public/maps/kochi.json',JSON.stringify(data)+'\n');
console.log(`Original Kochi layout: ${roads.length} roads, ${data.buildings.length} buildings; user images only.`);
