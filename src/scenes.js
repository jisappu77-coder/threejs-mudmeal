import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {buildAuto} from './prototypes/auto.js';
import {buildVehiclePrototypes,createMotorcycle} from './prototypes/vehicles.js';
import {bounds,worldPoint,roadWidth,segmentDistance,inside} from './layout.js';

export function batchAsset(actor){
 actor.updateMatrixWorld(true);const inverse=actor.matrixWorld.clone().invert(),groups=new Map();
 actor.traverse(o=>{if(!o.isMesh)return;const list=groups.get(o.material)||[],g=o.geometry.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld));if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));list.push(g);groups.set(o.material,list)});
 actor.clear();for(const [material,geometries]of groups){const mesh=new THREE.Mesh(mergeGeometries(geometries),material);mesh.castShadow=mesh.receiveShadow=true;actor.add(mesh);geometries.forEach(g=>g.dispose())}return actor;
}

export function createSceneArt(renderer) {
 const materials = new Map(), geometries = new Map();
 const geometry = (key, make) => {if (!geometries.has(key)) geometries.set(key,make()); return geometries.get(key)};
 function texture(kind) {
  const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');
  const colors={road:'#6a6d70',plaster:'#e7e1d6',tile:'#a54a2c',paving:'#beb1a0',stone:'#8b8a7f',wood:'#6c4e32',grass:'#6c8b47',water:'#39adb3',metal:'#919ca4'};
  ctx.fillStyle=colors[kind];ctx.fillRect(0,0,256,256);
  let seed=127;const rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
  for(let i=0;i<8500;i++){ctx.fillStyle=rand()>.5?'#ffffff09':'#00000009';ctx.fillRect(rand()*256,rand()*256,rand()*2+.5,rand()*2+.5)}
  if(kind==='tile'||kind==='stone'||kind==='paving'){
   const step=kind==='tile'?16:32;ctx.strokeStyle=kind==='tile'?'#56231865':'#403a3535';ctx.lineWidth=kind==='tile'?2:1;
   for(let y=0;y<256;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(256,y);ctx.stroke();for(let x=(y/step%2)*step/2;x<256;x+=step){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+step);ctx.stroke();}}
   if(kind==='tile'){ctx.strokeStyle='#e99b6160';for(let x=3;x<256;x+=16){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,256);ctx.stroke();}}
  }
  if(kind==='metal'||kind==='wood'){ctx.strokeStyle='#34312c45';for(let x=0;x<256;x+=kind==='metal'?10:32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,256);ctx.stroke();}}
  if(kind==='water'){ctx.strokeStyle='#d4ffff4a';for(let i=0;i<300;i++){ctx.beginPath();const x=rand()*256,y=rand()*256;ctx.moveTo(x,y);ctx.lineTo(x+rand()*14+3,y);ctx.stroke();}}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;
 }
 const textures=Object.fromEntries(['road','plaster','tile','paving','stone','wood','grass','water','metal'].map(k=>[k,texture(k)]));
 const mat=(color,kind='',roughness=.85)=>{
  const key=color+kind+roughness;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,map:textures[kind]||null,roughness,side:THREE.DoubleSide}));return materials.get(key);
 };
 const leaf=mat('#539529'),leafLight=mat('#76af32'),wood=mat('#ad8761','wood'),darkWood=mat('#b39a7b','wood'),concrete=mat('#e6e4d7','plaster'),rail=mat('#716653'),glass= new THREE.MeshPhysicalMaterial({color:'#416873',metalness:.15,roughness:.2,transparent:true,opacity:.78,side:THREE.DoubleSide});
 const fleet=buildVehiclePrototypes(),auto=buildAuto(),scooter=createMotorcycle('metro');for(const actor of [...Object.values(fleet),auto,scooter])batchAsset(actor);
 const palettes={cream:'#fff3d4',white:'#fffef0',ochre:'#edca6b',mustard:'#e7bf57',pink:'#f4b19f',mint:'#afe2bf',teal:'#61d5c6',blue:'#85bcde',yellow:'#f8dc85',laterite:'#d49672',lilac:'#c5a4d7',orange:'#e49568'};
 function pigment(text){const t=(text||'cream').toLowerCase();return palettes[Object.keys(palettes).find(k=>t.includes(k))]||palettes.cream}
 return {build,mat,materials,fleet};
 function build(layouts,phase) {
  const root=new THREE.Group(),obstacles=[],actors=[],objects=[],bays=[];
  const ground=mat(phase===1?'#b2c982':'#a0ad83','grass'),paving=mat(phase===1?'#fff2d5':'#ece7da','paving'),asphalt=mat(phase===1?'#969498':'#82858b','road'),tile=mat(phase===1?'#f5a77a':'#dfa487','tile');
  let current,origin;
  const vec=p=>new THREE.Vector3(...worldPoint(p,origin));
  function mesh(g,m,p=[0,0,0],rotation=[0,0,0],parent=root){const o=new THREE.Mesh(g,m);o.position.copy(vec(p));o.rotation.set(...rotation);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
  function box(w,d,h,m,p,rotation=0){return mesh(geometry(`box:${w}:${d}:${h}`,()=>new THREE.BoxGeometry(w,h,d)),m,p,[0,rotation,0]);}
  function beam(a,b,r,m=wood){const aa=vec(a),bb=vec(b),delta=bb.clone().sub(aa);const o=new THREE.Mesh(geometry(`cyl:${r}:${delta.length().toFixed(3)}`,()=>new THREE.CylinderGeometry(r,r,delta.length(),7)),m);o.position.copy(aa.add(bb).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());o.castShadow=o.receiveShadow=true;root.add(o);return o;}
  function poly(points,m){const g=new THREE.BufferGeometry(),positions=points.map(p=>worldPoint(p,origin)).flat(),uv=points.flatMap(p=>[p[0]/3,p[1]/3]);g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));const idx=[];for(let i=1;i<points.length-1;i++)idx.push(0,i,i+1);g.setIndex(idx);g.computeVertexNormals();const o=new THREE.Mesh(g,m);o.castShadow=o.receiveShadow=true;root.add(o);return o;}
  function rect(r,m,z=.01){return poly([[r[0],r[1],z],[r[2],r[1],z],[r[2],r[3],z],[r[0],r[3],z]],m);}
  function collide(r,id){obstacles.push([r[0]+origin[0],r[1]+origin[1],r[2]+origin[0],r[3]+origin[1]]);objects.push({id,scene:current.key,rect:r});}
  function wall(a,b,h=1.1,m=concrete,gap){
   const length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(!length)return;
   if(gap){const t=segmentDistance(gap.position[0],gap.position[1],a,b);if(t<.1){const d=Math.hypot(gap.position[0]-a[0],gap.position[1]-a[1]),half=gap.width/2,at=k=>[a[0]+(b[0]-a[0])*k/length,a[1]+(b[1]-a[1])*k/length];if(d>half)wall(a,at(d-half),h,m);if(d+half<length)wall(at(d+half),b,h,m);return;}}
   const angle=-Math.atan2(b[1]-a[1],b[0]-a[0]);box(length,.22,h,m,[(a[0]+b[0])/2,(a[1]+b[1])/2,h/2],angle);box(length+.1,.32,.1,concrete,[(a[0]+b[0])/2,(a[1]+b[1])/2,h+.02],angle);collide([Math.min(a[0],b[0])-.11,Math.min(a[1],b[1])-.11,Math.max(a[0],b[0])+.11,Math.max(a[1],b[1])+.11],'wall');
   for(let d=0;d<=length;d+=4){const x=a[0]+(b[0]-a[0])*d/length,y=a[1]+(b[1]-a[1])*d/length;box(.45,.45,h+.15,concrete,[x,y,(h+.15)/2]);}
  }
  function railing(a,b,h=1,m=darkWood,z=0){const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2.8);for(let i=0;i<=n;i++){const x=a[0]+(b[0]-a[0])*i/n,y=a[1]+(b[1]-a[1])*i/n;box(.15,.15,h,m,[x,y,z+h/2]);}for(const hh of [.38,.85])beam([a[0],a[1],z+hh*h],[b[0],b[1],z+hh*h],.045,m);}
  function plant(x,y,size=1,pot=false){
   const z=pot?.5:0;if(pot)mesh(geometry('pot',()=>new THREE.CylinderGeometry(.35,.24,.55,10)),mat('#edcba4'),[x,y,.28]);
   for(let i=0;i<7;i++){const a=i*2.4,dx=Math.cos(a),dy=Math.sin(a);const points=[[x,y,z],[x+dx*size*.4,y+dy*size*.4,z+size],[x+dx*size,y+dy*size,z+size*.65]];
    const center=points[1],tip=points[2],sideX=-dy*size*.16,sideY=dx*size*.16;poly([points[0],[center[0]+sideX,center[1]+sideY,center[2]],tip,[center[0]-sideX,center[1]-sideY,center[2]]],i%2?leaf:leafLight);}
  }
  function shrub(x,y,size=.65,flower=false){for(let k=0;k<5;k++){const a=k*2.4;mesh(geometry('bush',()=>new THREE.IcosahedronGeometry(1,1)),k%2?leaf:leafLight,[x+Math.cos(a)*size*.3,y+Math.sin(a)*size*.3,.45+size*.3]).scale.set(size,size*.7,size);if(flower)for(let j=0;j<3;j++)mesh(geometry('flower',()=>new THREE.SphereGeometry(.1,5,4)),mat(j%2?'#e55d87':'#f3c051'),[x+Math.cos(a+j)*size*.5,y+Math.sin(a+j)*size*.5,.9+size*.2]);}}
  function palm(x,y,h=10){
   const crown=[x+.7,y,h];beam([x,y,0],[x+.4,y,h*.55],.2,wood);beam([x+.4,y,h*.55],crown,.16,wood);
   for(let k=0;k<18;k++){const t=k/18;mesh(geometry('ring',()=>new THREE.TorusGeometry(.18,.02,3,8)),darkWood,[x+.7*t,y,h*t],[Math.PI/2,0,0]);}
   for(let i=0;i<11;i++){
    const a=i*Math.PI*2/11,dx=Math.cos(a),dy=Math.sin(a),len=4+(i%3)*.35;
    const at=t=>[crown[0]+dx*len*t,y+dy*len*t,h+Math.sin(t*Math.PI)*1.15-t*t*2.5];
    beam(crown,at(.45),.045,leaf);beam(at(.45),at(1),.025,leaf);
    for(let j=1;j<=15;j++){const t=j/16,c=at(t),span=Math.sin(t*Math.PI)*.78+.1;
     for(const side of [-1,1])poly([c,[c[0]-dy*span*side-dx*.25,c[1]+dx*span*side-dy*.25,c[2]-.1],[c[0]+dx*.28,c[1]+dy*.28,c[2]-.13]],i%3?leaf:leafLight);
    }
   }
   for(let i=0;i<3;i++)mesh(geometry('coconut',()=>new THREE.SphereGeometry(.18,6,4)),mat('#887141'),[crown[0]+.2*Math.cos(i*2),y+.2*Math.sin(i*2),h-.25]);
  }
  function tree(x,y,h=9,r=4){beam([x,y,0],[x,y,h*.7],.25,wood);for(let i=0;i<11;i++){const a=i*2.4,rr=i%3===0?0:r*.6,px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr,z=h*.7+Math.sin(i*3)*r*.25;beam([x,y,h*.5],[px,py,z],.1,wood);mesh(geometry('tree',()=>new THREE.IcosahedronGeometry(1,2)),i%2?leaf:leafLight,[px,py,z]).scale.set(r*.55,r*.4,r*.55);}}
  function sign(text,p,width,angle=0,color='#426f56'){
   const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,512,128);ctx.strokeStyle='#f9eccb';ctx.lineWidth=6;ctx.strokeRect(8,8,496,112);ctx.fillStyle='#fff7df';ctx.font='bold 36px sans-serif';ctx.textAlign='center';ctx.fillText(text,256,76,470);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
   return mesh(new THREE.PlaneGeometry(width,width/4),new THREE.MeshStandardMaterial({map:t,roughness:.75,side:THREE.DoubleSide}),p,[0,angle,0]);
  }
  function roof(b){
   const [x0,y0,x1,y1]=b.rect,e=b.height,top=b.top,m=/grey|sheet/.test(b.roof.material)?mat('#bbc8d0','metal'):tile;
   const a=[x0-.5,y0-.5,e],bb=[x1+.5,y0-.5,e],c=[x1+.5,y1+.5,e],d=[x0-.5,y1+.5,e];
   if(b.roof.shape==='flat') {box(x1-x0+.3,y1-y0+.3,.2,concrete,[(x0+x1)/2,(y0+y1)/2,e]);for(const [p,q]of [[a,bb],[bb,c],[c,d],[d,a]])box(Math.hypot(q[0]-p[0],q[1]-p[1]),.22,.45,concrete,[(p[0]+q[0])/2,(p[1]+q[1])/2,e+.2],-Math.atan2(q[1]-p[1],q[0]-p[0]));box(1.3,1.3,1.6,mat('#333e41'),[x0+2,y1-2,e+.8]);return;}
   if(b.roof.shape==='single_pitch'){poly([a,bb,[c[0],c[1],top],[d[0],d[1],top]],m);return;}
   const ns=b.roof.ridge_axis==='north-south'||(b.roof.shape==='hip'&&y1-y0>x1-x0),hip=b.roof.shape==='hip',cx=(x0+x1)/2,cy=(y0+y1)/2;
   const inset=hip?Math.min(x1-x0,y1-y0)*.35:0,r1=ns?[cx,y0+inset,top]:[x0+inset,cy,top],r2=ns?[cx,y1-inset,top]:[x1-inset,cy,top];
   if(ns){poly([a,bb,r1],hip?m:mat(pigment(b.walls),'plaster'));poly([c,d,r2],hip?m:mat(pigment(b.walls),'plaster'));poly([a,r1,r2,d],m);poly([bb,c,r2,r1],m);}else{poly([a,bb,r2,r1],m);poly([d,r1,r2,c],m);poly([a,r1,d],hip?m:mat(pigment(b.walls),'plaster'));poly([bb,c,r2],hip?m:mat(pigment(b.walls),'plaster'));}
   beam(r1,r2,.095,m);
   for(const [p,q]of [[a,bb],[bb,c],[c,d],[d,a]])beam(p,q,.07,darkWood);
  }
  function building(b){
   const [x0,y0,x1,y1]=b.rect,w=x1-x0,d=y1-y0,cx=(x0+x1)/2,cy=(y0+y1)/2,e=b.height;
   rect([x0-1,y0-1,x1+1,y1+1],paving,.025);const shell=box(w,d,e,mat(pigment(b.walls),'plaster'),[cx,cy,e/2]);collide(b.rect,b.id);shell.updateMatrixWorld(true);const measured=new THREE.Box3().setFromObject(shell);objects.at(-1).renderedRect=[measured.min.x-origin[0],-measured.max.z-origin[1],measured.max.x-origin[0],-measured.min.z-origin[1]];objects.at(-1).renderedHeight=measured.max.y-measured.min.y;
   if(/lilac/.test(b.walls))box(w+.01,d+.01,e/2,mat(palettes.teal,'plaster'),[cx,cy,e/4]);
   box(w+.15,d+.15,.18,concrete,[cx,cy,.09]);for(let i=1;i<=b.floors;i++)box(w+.25,d+.25,.12,concrete,[cx,cy,e*i/b.floors]);
   roof(b);
   const faces=[['east',x1,cy,d,-Math.PI/2],['west',x0,cy,d,Math.PI/2],['north',cx,y1,w,0],['south',cx,y0,w,Math.PI]];
   for(const [dir,fx,fy,length,angle]of faces){
    const eastWest=dir==='east'||dir==='west',out=dir==='east'||dir==='north'?1:-1;
    const place=(along,z,offset=.035)=>eastWest?[fx+out*offset,fy+along,z]:[fx+along,fy+out*offset,z];
    const count=Math.max(2,Math.floor(length/4.8));
    for(let floor=0;floor<b.floors;floor++)for(let i=0;i<count;i++){
     const along=(i-(count-1)/2)*length/(count+.5),z=e/b.floors*(floor+.55),ww=Math.min(1.35,length/(count*2));
     if(floor===0&&dir===b.direction&&Math.abs(along)<2.5)continue;
     const trim=box(ww+.3,.15,1.75,concrete,place(along,z),angle);box(ww,.17,1.45,darkWood,place(along,z,.12),angle);box(ww-.13,.02,1.31,glass,place(along,z,.22),angle);
     box(.07,.06,1.4,darkWood,place(along,z,.24),angle);box(ww,.06,.06,darkWood,place(along,z,.24),angle);
     for(const side of [-1,1]){box(.36,.09,1.5,mat('#39765c'),place(along+side*(ww/2+.2),z,.12),angle);for(let slat=0;slat<6;slat++)box(.35,.1,.045,darkWood,place(along+side*(ww/2+.2),z-.55+slat*.22,.15),angle);}
     box(ww+.4,.35,.12,concrete,place(along,z-.85,.14),angle);trim.name='Window surround';
    }
   }
   const dir=b.direction,ew=dir==='east'||dir==='west',out=dir==='east'||dir==='north'?1:-1,angle=dir==='east'?Math.PI/2:dir==='west'?-Math.PI/2:dir==='north'?Math.PI:0;
   const front=b.entrance||[cx,y0,0],fx=front[0],fy=front[1],width=b.loading_door_size_m?.width||2.2,doorHeight=b.loading_door_size_m?.height||2.5;
   const point=(along,z,offset)=>ew?[fx+out*offset,fy+along,z]:[fx+along,fy+out*offset,z];
   box(width+.35,.24,doorHeight+.2,concrete,point(0,(doorHeight+.2)/2,.03),angle);box(width,.28,doorHeight,darkWood,point(0,doorHeight/2,.12),angle);box(width-.25,.05,doorHeight*.67,glass,point(0,doorHeight*.58,.3),angle);box(.08,.1,doorHeight,darkWood,point(0,doorHeight/2,.34),angle);
   const name=b.name||b.id.replace('B_','').replaceAll('_',' ');sign(name.toUpperCase(),point(0,doorHeight+.8,.3),Math.min(6,ew?d-2:w-2),angle);
   const aw=b.awning,color=typeof aw==='string'?aw.split(' ')[0]:aw?.color,projection=typeof aw==='object'?aw.projection_m||1.5:1.7;
   if(aw){
    const awWidth=Math.min(ew?d:w,8),base=3.0,am=mat(pigment(color));
    for(let i=0;i<12;i++){const along=(i-5.5)*awWidth/12;const o=box(awWidth/12,projection,.07,i%2?concrete:am,point(along,base,projection/2+.1),angle);o.rotateX(-.12);box(awWidth/12,.06,.3,i%2?concrete:am,point(along,base-.2,projection),angle);}
    for(const side of[-1,1]){const p=point(side*(awWidth/2-.2),0,projection);beam(p,[p[0],p[1],base-.1],.055,darkWood);plant(...point(side*(awWidth/2+.6),0,projection).slice(0,2),.8,true);}
    for(const side of[-1,1]){const p=point(side*2,0,.6);box(1.2,.5,.7,wood,[p[0],p[1],.4],angle);for(let j=0;j<4;j++)mesh(geometry('fruit',()=>new THREE.SphereGeometry(.12,6,4)),mat(j%2?'#dd713c':'#ecc649'),point(side*2+(j-1.5)*.22,.84,.6));}
   }
   if(b.balcony||b.balconies&&b.balconies!=='none'){
    const level=e/b.floors,bl=Math.min(ew?d:w,8),middle=point(0,level,1);box(bl,1.5,.18,concrete,middle,angle);
    for(let i=0;i<13;i++){const p=point((i/12-.5)*bl,level+.5,1.7);box(.055,.055,1,rail,p);}const a=point(-bl/2,level+1,1.7),bb=point(bl/2,level+1,1.7);beam(a,bb,.045,rail);
   }
   if(b.compound){const pts=b.compound.boundary_xy||b.compound.footprint_xy,gap={position:b.compound.gate_position,width:b.compound.gate_width_m};for(let i=0;i<pts.length;i++)wall(pts[i],pts[(i+1)%pts.length],b.compound.wall_height_m,concrete,gap);}
   for(const side of[-1,1])for(let i=0;i<9;i++){const px=cx+side*(w/2+2.6),py=y0+1+i*(d-2)/8;if(current.roads.every(r=>segmentDistance(px,py,r.centerline[0],r.centerline.at(-1))>r.width_m/2+1)&&Math.hypot(px-fx,py-fy)>4)shrub(px,py,.65,i%3===0);}
   for(const p of [[x0-3,y0-3],[x1+3,y1+3]])if(current.roads.every(r=>segmentDistance(...p,r.centerline[0],r.centerline.at(-1))>r.width_m/2+2.5)){plant(p[0],p[1],2.3);shrub(p[0]+1,p[1],1);}
   if(b.bell_tower){const p=b.bell_tower.position,h=b.bell_tower.height_m;box(3,3,h,concrete,[p[0],p[1],h/2]);box(1.1,.2,2.2,darkWood,[p[0],p[1]-1.55,h-2]);beam([p[0],p[1],h],[p[0],p[1],h+1.7],.07,concrete);beam([p[0]-.55,p[1],h+1.1],[p[0]+.55,p[1],h+1.1],.07,concrete);}
   // Small plants belong to the fixed building lots; no additional buildings are invented.
   for(let i=0;i<6;i++){const px=x0+1+i*(w-2)/5,py=y0-1.4;const clear=current.roads.every(r=>segmentDistance(px,py,r.centerline[0],r.centerline.at(-1))>r.width_m/2+1);if(clear)plant(px,py,.9,i%2===0);}
  }
  function road(r){
   const size=current.scene.playable_size_m,[a0,b0]=[r.centerline[0],r.centerline.at(-1)],a=[Math.max(0,Math.min(size.east_west,a0[0])),Math.max(0,Math.min(size.north_south,a0[1]))],b=[Math.max(0,Math.min(size.east_west,b0[0])),Math.max(0,Math.min(size.north_south,b0[1]))],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len;
   const isAsphalt=/asphalt/.test(r.surface),steps=Math.ceil(len/3),other=current.roads.filter(rr=>rr!==r);
   for(let i=0;i<steps;i++){
    const t=i/steps,tt=(i+1)/steps,aa=[a[0]+dx*t,a[1]+dy*t],bb=[a[0]+dx*tt,a[1]+dy*tt],wa=roadWidth(r,aa[1])/2,wb=roadWidth(r,bb[1])/2;
    poly([[aa[0]+nx*wa,aa[1]+ny*wa,.06],[aa[0]-nx*wa,aa[1]-ny*wa,.06],[bb[0]-nx*wb,bb[1]-ny*wb,.06],[bb[0]+nx*wb,bb[1]+ny*wb,.06]],isAsphalt?asphalt:paving);
    if(!isAsphalt)continue;
    const mx=(aa[0]+bb[0])/2,my=(aa[1]+bb[1])/2,intersection=other.some(rr=>segmentDistance(mx,my,rr.centerline[0],rr.centerline.at(-1))<rr.width_m/2+1);
    if(!intersection){
     if(i%3===0)box(.12,2,.012,mat('#eee8cd'),[mx,my,.075],-Math.atan2(dx,dy));
     for(const side of [-1,1]){const x=mx+nx*side*(wa+.7),y=my+ny*side*(wa+.7);box(1.4,len/steps+.01,.1,paving,[x,y,.06],-Math.atan2(dx,dy));box(.12,len/steps,.013,mat('#dcc982'),[mx+nx*side*(wa-.18),my+ny*side*(wa-.18),.08],-Math.atan2(dx,dy));}
    }
   }
   for(const spur of r.spurs||[])road({...r,centerline:spur,spurs:[]});
  }
  function bench(p){box(1.8,.5,.12,wood,[p[0],p[1],.5]);box(1.8,.12,.65,wood,[p[0],p[1]+.25,.85]);for(const x of[-.65,.65])box(.12,.5,.5,rail,[p[0]+x,p[1],.25]);}
  function pier(l){const r=bounds(l.footprint_xy);rect(r,wood,.12);for(let x=r[0];x<=r[2];x+=2.5){for(const y of[r[1],r[3]])beam([x,y,-2],[x,y,.15],.13,darkWood);box(.06,r[3]-r[1],.02,darkWood,[x,(r[1]+r[3])/2,.14]);}railing([r[0],r[1]],[r[2],r[1]]);railing([r[0],r[3]],[r[2],r[3]]);if(l.canopy){const c=bounds(l.canopy.footprint_xy),h=l.canopy.eaves_z_m;for(const x of[c[0],c[2]])for(const y of[c[1],c[3]])beam([x,y,0],[x,y,h],.08,wood);rect(c,concrete,h);}}
  function net(l){
   rect(bounds(l.platform_footprint_xy),wood,.2);const p=l.pivot_position,x=p[0],y=p[1],h=p[2],end=x+l.boom_reach_east_m,span=l.mesh.approx_span_m;
   for(const dy of [-2,2]){beam([x-3,y+dy,0],[x,y,h],.17,darkWood);beam([x+1,y+dy,0],[x,y,h],.14,darkWood);}
   beam([x-5,y,3],[end,y,h-1],.12,wood);
   const corners=[[end-span/2,y-span/2,.8],[end+span/2,y-span/2,.8],[end+span/2,y+span/2,.8],[end-span/2,y+span/2,.8]];
   for(const c of corners)beam([end,y,h-1],c,.018,rail);
   const nm=new THREE.MeshStandardMaterial({color:'#364d48',transparent:true,opacity:.14,side:THREE.DoubleSide,depthWrite:false});poly(corners,nm);
   for(let i=0;i<=20;i++){const t=i/20;beam([end-span/2+span*t,y-span/2,.8],[end-span/2+span*t,y+span/2,.8],.007,rail);beam([end-span/2,y-span/2+span*t,.8],[end+span/2,y-span/2+span*t,.8],.007,rail);}
   beam([x-5,y,3],[x-5,y,1.2],.025,rail);for(let i=0;i<3;i++)box(.35,.35,.4,mat('#969181','stone'),[x-5,y,1.3+i*.42]);
  }
  function boat(p,angle=0){const o=mesh(geometry('hull',()=>new THREE.SphereGeometry(1,12,6)),mat('#59a7c6'),[p[0],p[1],(p[2]||0)+.12],[0,angle,0]);o.scale.set(.8,.4,2.8);box(.6,4,.1,wood,[p[0],p[1],(p[2]||0)+.3],angle);}
  function vehicle(template,p,heading,id){const o=template.clone(true);o.position.copy(vec(p));o.rotation.y=heading;root.add(o);actors.push(o);const bb=new THREE.Box3().setFromObject(o);obstacles.push([bb.min.x,-bb.max.z,bb.max.x,-bb.min.z]);objects.push({id,scene:current.key,position:p});return o;}
  function pole(p,h=8){beam(p,[p[0],p[1],h],.1,concrete);beam([p[0]-1.2,p[1],h-.5],[p[0]+1.2,p[1],h-.5],.05,rail);beam([p[0],p[1],h-1],[p[0]+1.7,p[1],h-1],.04,rail);box(.6,.25,.1,concrete,[p[0]+1.7,p[1],h-1]);collide([p[0]-.12,p[1]-.12,p[0]+.12,p[1]+.12],'pole');}
  function heading(p){return {north:0,east:-Math.PI/2,south:Math.PI,west:Math.PI/2}[p.heading]??-(p.orientation_degrees||0)*Math.PI/180;}
  origin=[0,0,0];if(phase===1){rect([-500,-250,90,900],ground,-.035);rect([90,-250,1000,900],mat('#a4ffff','water',.28),-1.2);}else{rect([-500,-250,650,245],ground,-.035);rect([-500,265,650,900],ground,-.035);rect([-500,245,650,265],mat('#869887','water',.28),-1.2);}
  for(const s of layouts){
   current=s;origin=s.origin;const {east_west:w,north_south:d}=s.scene.playable_size_m;
   const water=s.terrain.water_region_xy?bounds(s.terrain.water_region_xy):s.terrain.canal_rect;
   if(water){if(s.terrain.canal_rect){rect([0,0,w,water[1]],ground,-.025);rect([0,water[3],w,d],ground,-.025);}else rect([0,0,water[0],d],ground,-.025);rect(water,mat(phase===1?'#94ffff':'#869887','water',.28),-1.2);}else rect([0,0,w,d],ground,-.025);
   for(const p of s.paths||[]){const r=p.footprint_xy?bounds(p.footprint_xy):[p.x[0],p.y[0],p.x[1],p.y[1]];rect(r,paving,.012);}
   for(const r of s.roads)road(r);
   for(const b of s.buildings)building(b);
   // Static ornamental landscaping fills the reference's planted yards, outside routes and bays.
   for(const b of s.buildings){const [x0,y0,x1,y1]=b.rect;for(let x=x0-5;x<=x1+5;x+=2.5)for(const y of[y0-4,y1+4]){if(x<2||y<2||x>w-2||y>d-2)continue;const clear=s.roads.every(r=>segmentDistance(x,y,r.centerline[0],r.centerline.at(-1))>r.width_m/2+2)&&s.buildings.every(bb=>!inside(x,y,bb.rect,1))&&s.bays.every(bb=>!inside(x,y,bb.rect,1));if(clear){shrub(x,y,1.1,(Math.floor(x+y)%3)===0);if(Math.floor(x)%5===0)plant(x,y,2.4);}}}
   for(const b of s.bays){rect(b.rect,paving,.022);bays.push({...b,scene:s.key,global:b.rect.map((v,i)=>v+origin[i%2])});}
   if(s.seawall){for(const [a,b]of s.seawall.segments||[]){wall(a,b,.7,concrete);railing(a,b,.7,concrete,.65);}for(let y=0;y<d;y+=1.4){mesh(geometry('rock',()=>new THREE.IcosahedronGeometry(.65,0)),mat('#a8b1ac','stone'),[89,y,-.5]).scale.set(1,1.3,1.1);}}
   for(const l of s.landmarks||[]){if(l.id==='L_PIER')pier(l);if(l.id.startsWith('L_NET'))net(l);if(l.deck_rect){const r=l.deck_rect;box(r[2]-r[0],r[3]-r[1],l.deck_thickness_m,concrete,[(r[0]+r[2])/2,(r[1]+r[3])/2,-l.deck_thickness_m/2]);for(const x of[r[0]+.25,r[2]-.25])wall([x,r[1]],[x,r[3]],l.parapet_height_m,concrete);}}
   if(s.terrain.canal_rect){const r=s.terrain.canal_rect;for(const y of[r[1],r[3]])for(const x of[0,66]){const a=[x,y],b=[x===0?54:w,y];box(b[0]-a[0],.5,1.4,mat('#b9b6a3','stone'),[(a[0]+b[0])/2,y,-.7]);railing(a,b,.9,concrete);collide([a[0],y-.15,b[0],y+.15],'canal-rail');}}
   for(const v of s.vegetation){if(/palm/.test(v.type||v.species))palm(v.position[0],v.position[1],v.height_m||10);else tree(v.position[0],v.position[1],v.height_m||9,v.canopy_radius_m||4);}
   const poles=(s.props||[]).filter(p=>/pole/.test(p.type));for(const p of s.infrastructure.utility_poles||[])poles.push({position:p,height_m:8});
   for(const p of poles)pole(p.position,p.height_m||8);
   for(let i=1;i<poles.length;i++)for(const side of[-.6,.6]){const a=poles[i-1].position,b=poles[i].position;const curve=new THREE.CatmullRomCurve3([vec([a[0]+side,a[1],7.5]),vec([(a[0]+b[0])/2+side,(a[1]+b[1])/2,6.5]),vec([b[0]+side,b[1],7.5])]);const o=new THREE.Mesh(new THREE.TubeGeometry(curve,16,.015,3,false),rail);root.add(o);}
   for(const p of s.props||[]){const t=p.type.toLowerCase(),pos=p.position;if(!pos||/rider|player|pole/.test(t))continue;
    if(/auto/.test(t))vehicle(auto,pos,heading(p),p.id);
    else if(/scooter/.test(t))vehicle(scooter,pos,heading(p),p.id);
    else if(/car/.test(t))vehicle(fleet.car,pos,heading(p),p.id);
    else if(/bus/.test(t)){const o=vehicle(fleet.bus,pos,heading(p),p.id);const size=new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());const dims=p.dimensions_m||[2.5,9.5,3.2];o.scale.set(dims[0]/size.x,dims[2]/size.y,dims[1]/size.z);}
    else if(/truck/.test(t)){vehicle(fleet.van,pos,heading(p),p.id);box(2.2,3.8,1.8,concrete,[pos[0]+1,pos[1],1.1],Math.PI/2);collide([pos[0]-3,pos[1]-1.1,pos[0]+3,pos[1]+1.1],p.id);}
    else if(/boat|hull|skiff/.test(t))boat(pos,heading(p));
    else if(/bench/.test(t))bench(pos);
    else if(/bin/.test(t)){mesh(geometry('bin',()=>new THREE.CylinderGeometry(.3,.28,.8,10)),mat('#418797'),[pos[0],pos[1],.4]);box(.65,.65,.1,rail,[pos[0],pos[1],.86]);}
    else if(/crates/.test(t)){for(let i=0;i<3;i++){box(.65,.5,.5,/blue/.test(t)?mat('#518cba'):wood,[pos[0]+(i%2)*.7,pos[1],.25+Math.floor(i/2)*.5]);for(let j=0;j<3;j++)box(.66,.51,.03,darkWood,[pos[0]+(i%2)*.7,pos[1],.13+Math.floor(i/2)*.5+j*.13]);}}
    else if(/rope/.test(t))for(let i=0;i<5;i++)mesh(geometry('rope',()=>new THREE.TorusGeometry(.35,.025,4,16)),wood,[pos[0],pos[1],.03+i*.045],[Math.PI/2,0,0]);
    else if(/stall|rack/.test(t)){for(const x of[-1,1])beam([pos[0]+x,pos[1],0],[pos[0]+x,pos[1],2.5],.055,wood);box(2.5,1.7,.1,mat('#82a48b'),[pos[0],pos[1],2.5]);box(2.2,.8,.7,wood,[pos[0],pos[1],.45]);}
   }
   if(s.bus_stop){const b=s.bus_stop,r=b.shelter_rect;rect(b.bay_rect,asphalt,.065);poly(b.asphalt_apron_polygon.map(p=>[p[0],p[1],.063]),asphalt);rect(b.sidewalk_rect,paving,.1);for(const x of[r[0],r[2]])for(const y of[r[1],r[3]])beam([x,y,0],[x,y,b.shelter_height_m],.055,rail);rect(r,mat('#719cb6','metal'),b.shelter_height_m);bench(b.bench_position);sign('BUS STOP',[(r[0]+r[2])/2,r[1]-.05,2.4],3,Math.PI,'#315a73');}
  }

  // Merge static geometry by material. Vehicles remain separate reusable project assets.
  root.updateMatrixWorld(true);const batches=new Map();
  for(const o of [...root.children])if(o.isMesh&&!o.material.transparent){const g=o.geometry.clone().applyMatrix4(o.matrixWorld);if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));const list=batches.get(o.material)||[];list.push(g);batches.set(o.material,list);root.remove(o);}
  for(const [m,gs]of batches){const merged=mergeGeometries(gs);if(!merged)throw Error('Static geometry batching failed');const o=new THREE.Mesh(merged,m);o.castShadow=o.receiveShadow=true;root.add(o);gs.forEach(g=>g.dispose());}
  return {root,obstacles,actors,objects,bays};
 }
}
