import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// Project-authored fictional vehicles. No manufacturer CAD, badges, liveries or photos.
function kit(name,color){
 const root=new THREE.Group();root.name=name;
 const paint=new THREE.MeshPhysicalMaterial({color,roughness:.38,metalness:.22,clearcoat:.35,side:THREE.DoubleSide});paint.userData.surface='paint';
 const trim=new THREE.MeshStandardMaterial({color:'#252c2c',roughness:.72,metalness:.15});
 const rubber=new THREE.MeshStandardMaterial({color:'#202322',roughness:.94});
 const alloy=new THREE.MeshStandardMaterial({color:'#9ba29c',roughness:.28,metalness:.85});
 const glass=new THREE.MeshPhysicalMaterial({color:'#718982',roughness:.07,metalness:0,transparent:true,opacity:.43,depthWrite:false,side:THREE.DoubleSide,envMapIntensity:1.3});
 const seat=new THREE.MeshStandardMaterial({color:'#535750',roughness:.93});seat.userData.surface='cloth';
 const red=new THREE.MeshPhysicalMaterial({color:'#9b3028',roughness:.23,clearcoat:.6});
 const lamp=new THREE.MeshPhysicalMaterial({color:'#d3dacb',roughness:.18,metalness:.25,clearcoat:.6});
 const add=(geometry,material,p=[0,0,0],rotation=[0,0,0],parent=root)=>{const o=new THREE.Mesh(geometry,material);o.position.set(...p);o.rotation.set(...rotation);o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
 const box=(w,h,d,r,m,p,rotation=[0,0,0],parent=root)=>add(new RoundedBoxGeometry(w,h,d,r<.006?1:2,r),m,p,rotation,parent);
 function tube(points,r,m){
  if(points.length>5)return add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'catmullrom',0),Math.max(8,points.length*3),r,8,false),m);
  let last;for(let i=1;i<points.length;i++){const a=new THREE.Vector3(...points[i-1]),b=new THREE.Vector3(...points[i]),direction=b.clone().sub(a);last=add(new THREE.CylinderGeometry(r,r,direction.length(),8),m,a.clone().add(b).multiplyScalar(.5).toArray());last.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());}return last;
 }
 function surface(rows,cols,point,m,include=()=>true){const positions=[],uv=[],indices=[];for(let v=0;v<=rows;v++)for(let u=0;u<=cols;u++){positions.push(...point(u/cols,v/rows));uv.push(u/cols,v/rows);if(u<cols&&v<rows&&include((u+.5)/cols,(v+.5)/rows)){const i=v*(cols+1)+u;indices.push(i,i+1,i+cols+1,i+1,i+cols+2,i+cols+1);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return add(g,m);}
 function pane(points){const shape=new THREE.BufferGeometry(),v=points.flat(),indices=[];for(let i=1;i<points.length-1;i++)indices.push(0,i,i+1);shape.setAttribute('position',new THREE.Float32BufferAttribute(v,3));shape.setIndex(indices);shape.computeVertexNormals();const o=add(shape,glass);o.name='Open cabin glazing';tube([...points,points[0]],.006,trim);return o;}
 function wheel(x,z,r,width=.18){const axle=new THREE.Group();axle.position.set(x,r+.015,z);axle.userData.wheelRadius=r;root.add(axle);
  const tyre=new THREE.TorusGeometry(r*.79,r*.21,12,48);tyre.scale(1,1,width*1.2/(r*.42));
  add(tyre,rubber,[0,0,0],[0,Math.PI/2,0],axle);
  add(new THREE.CylinderGeometry(r*.68,r*.68,width,40),trim,[0,0,0],[0,0,Math.PI/2],axle);
  for(const side of[-1,1]){
   add(new THREE.CylinderGeometry(r*.62,r*.62,.012,40),alloy,[side*(width/2+.004),0,0],[0,0,Math.PI/2],axle);
   add(new THREE.TorusGeometry(r*.84,.006,6,48),rubber,[side*width*.48,0,0],[0,Math.PI/2,0],axle);
   for(let i=0;i<6;i++){const a=i*Math.PI/3;add(new THREE.CylinderGeometry(r*.07,r*.07,.015,12),trim,[side*(width/2+.013),Math.sin(a)*r*.43,Math.cos(a)*r*.43],[0,0,Math.PI/2],axle);}
   add(new THREE.CylinderGeometry(r*.18,r*.18,.02,24),alloy,[side*(width/2+.018),0,0],[0,0,Math.PI/2],axle);
  }
  return axle;
 }
 function cushion(x,y,z,w=.43){box(w,.12,.43,.035,seat,[x,y,z]);box(w,.48,.09,.035,seat,[x,y+.27,z+.17],[.10,0,0]);for(const dx of[-w*.25,w*.25])tube([[x+dx,y+.065,z-.16],[x+dx,y+.065,z+.16]],.0015,trim);}
 function badge(text,w,h,p,rotation=[0,Math.PI,0],background=null){if(typeof document==='undefined')return;const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');if(background){ctx.fillStyle=background;ctx.fillRect(0,0,1024,256);}ctx.fillStyle=background?'#f1e9d1':'#29332e';ctx.font='600 135px sans-serif';const fontSize=Math.min(135,135*900/ctx.measureText(text).width);ctx.font=`600 ${fontSize}px sans-serif`;ctx.textAlign='center';ctx.fillText(text,512,178);const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;const m=new THREE.MeshStandardMaterial({map,transparent:true,depthWrite:false,roughness:.8});add(new THREE.PlaneGeometry(w,h),m,p,rotation).name='Original game branding';}
 return {root,paint,trim,rubber,alloy,glass,seat,red,lamp,add,box,tube,surface,pane,wheel,cushion,badge};
}

function fourWheeler(type){
 const bus=type==='bus',van=type==='van';
 const k=kit(bus?'Mud M9 · local bus':van?'Mud V4 · Kerala passenger van':'Mud C4 · Kerala hatchback',bus?'#d8cfac':van?'#e4e2d6':'#b4c5cb');
 const {root,paint,trim,rubber,alloy,glass,seat,red,lamp,box,tube,surface,pane,wheel,cushion,badge}=k;
 const length=bus?9.70:van?3.78:3.65,width=bus?2.5:van?1.60:1.62,height=bus?3.1:van?1.87:1.54;
 const half=length/2,r=bus?.48:van?.31:.29,axles=bus?[-2.98,2.62]:van?[-1.12,1.12]:[-1.16,1.15],waist=bus?1.68:van?1.04:.91,base=bus?.49:.265;
 const bodyWidth=z=>width/2*(bus?1-.035*(Math.abs(z)/half)**8:van?1-.08*(Math.abs(z)/half)**8:1-(z<0?.12:.06)*(Math.abs(z)/half)**6);
 const deckHeight=z=>bus||van?waist:z<-.85?waist-.15*((-.85-z)/(half-.85))**2:z>1.20?waist+.10*(z-1.20)/(half-1.20):waist;
 const busSkirt=new THREE.MeshPhysicalMaterial({color:'#85382f',roughness:.5,metalness:.12,side:THREE.DoubleSide});
 function archLow(z){let low=base;for(const axle of axles){const d=z-axle,clearance=r+.045;if(Math.abs(d)<clearance)low=Math.max(low,r+.015+Math.sqrt(clearance**2-d*d));}return low;}
 for(const side of[-1,1]){
  const sidePoint=(u,v)=>{const z=-half+u*length,low=archLow(z);return[side*(bodyWidth(z)-.05*(1-v)+.014*Math.sin(v*Math.PI)),low+(deckHeight(z)-(!bus&&!van?.025:0)-low)*v,z];};
  const hasSide=u=>!(bus&&side===-1&&(-half+u*length)>-4.45&&(-half+u*length)<-3.65);
  surface(12,bus?240:120,sidePoint,paint,(u,v)=>hasSide(u)&&(!bus||v>=.4));
  if(bus)surface(12,240,sidePoint,busSkirt,(u,v)=>hasSide(u)&&v<.4);
  for(const z of axles){wheel(side*(width/2-.115),z,r,bus?.24:.18);const path=Array.from({length:29},(_,i)=>{const a=i/28*Math.PI;return[side*(bodyWidth(z)+.006),r+.015+(r+.045)*Math.sin(a),z+(r+.045)*Math.cos(a)];});tube(path,.010,bus?trim:paint);}
  tube([[side*(width/2-.04),base+.03,-half+.3],[side*(width/2-.04),base+.03,half-.3]],.023,trim);
 }
 // Formed bumper faces close only the lower body, leaving the windows genuinely open.
 for(const end of[-1,1]){
  const endPoint=(u,v)=>{const t=u*2-1;return[t*(bodyWidth(half)-.05*(1-v)+.014*Math.sin(v*Math.PI)),base+v*(deckHeight(end*half)-(!bus&&!van?.025*t*t:0)-base),end*half];};
  surface(12,40,endPoint,paint,(_,v)=>!bus||v>=.4);
  if(bus)surface(12,40,endPoint,busSkirt,(_,v)=>v<.4);
  box(width*.88,.085,.06,.025,trim,[0,base+.12,end*(half+.014)]);
 }
 box(width*.87,.05,length-.35,.012,trim,[0,base+.03,0]);
 if(!bus&&!van){
  // Short bonnet and an upright tailgate: a small Kerala-road hatchback, not a sedan.
  surface(20,40,(u,v)=>{const z=-half+v*(half-.85),t=u*2-1;return[t*bodyWidth(z),deckHeight(z)-.025*t*t,z];},paint);
  const roofPoint=(u,v)=>{const t=u*2-1;return[t*.665,1.44+.10*(1-t*t)-.012*Math.sin(v*Math.PI),-.30+v*1.43];};
  surface(24,40,roofPoint,paint);
  surface(20,40,(u,v)=>{const t=u*2-1;return[t*(bodyWidth(-.85)*(1-v)+.665*v),.92+v*(.62-.10*t*t)-.025*(1-v)*t*t,-.85+v*.55];},glass);
  surface(22,40,(u,v)=>{const t=u*2-1;return[t*(.665*(1-v)+bodyWidth(half)*v),1.44+.10*(1-t*t)-v*(.43+.10*(1-t*t)+.025*t*t),1.13+v*(half-1.13)];},glass);
  for(const v of[0,1])tube(Array.from({length:25},(_,i)=>roofPoint(i/24,v)),.022,paint);
  for(const side of[-1,1]){
   const lower=z=>[side*bodyWidth(z),deckHeight(z)-.023,z],upper=z=>[side*.665,1.438,z];
   pane([lower(-.83),lower(.27),upper(.27),upper(-.295)]);
   pane([lower(.35),lower(1.32),upper(1.08),upper(.35)]);
   tube([lower(-.85),upper(-.30)],.031,paint);tube([lower(.31),upper(.31)],.030,trim);
   tube([upper(-.30),upper(1.13)],.026,paint);
   surface(20,8,(u,v)=>{const z=(1-v)*(1.08+.05*u)+v*(1.32+(half-1.32)*u);return[side*(.665*(1-v)+bodyWidth(z)*v),1.438*(1-v)+(deckHeight(z)-.023)*v,z];},paint);
   for(const z of[-.85,.31,1.34])tube([[side*(bodyWidth(z)+.001),deckHeight(z)-.025,z],[side*(bodyWidth(z)-.025),.32,z]],.0025,trim);
   for(const z of[.10,1.09])box(.020,.029,.11,.009,trim,[side*(bodyWidth(z)+.012),.83,z]);
   tube([[side*.79,1.04,-.70],[side*.91,1.04,-.70]],.014,trim);box(.15,.095,.15,.032,paint,[side*.94,1.055,-.72]);box(.008,.066,.11,.020,alloy,[side*1.018,1.055,-.704]);
   for(const z of[.10,.97]){cushion(side*.32,.65,z,.43);box(.28,.12,.06,.025,seat,[side*.32,1.23,z+.21]);}
   tube([[side*(bodyWidth(-.90)+.005),.55,-.90],[side*(bodyWidth(.3)+.005),.55,.30],[side*(bodyWidth(1.47)+.005),.55,1.47]],.010,trim);
  }
  box(1.26,.14,.24,.035,trim,[0,.95,-.66]);
  k.add(new THREE.TorusGeometry(.13,.015,8,40),trim,[.34,1.035,-.51],[.72,0,0]);
  for(const side of[-1,1]){box(.30,.15,.035,.042,trim,[side*.53,.665,-half-.010],[0,-side*.15,0]);box(.24,.105,.017,.031,lamp,[side*.53,.674,-half-.029],[0,-side*.15,0]);box(.13,.32,.024,.029,red,[side*.69,.92,half+.008]);}
  box(.82,.12,.03,.026,trim,[0,.38,-half-.014]);for(const y of[.36,.40])box(.68,.007,.006,.001,alloy,[0,y,-half-.032]);
  box(.32,.075,.011,.009,lamp,[0,.55,-half-.018]);badge('MUD / C4',.24,.058,[0,.83,-half-.013]);
  tube([[0,1.03,half+.008],[.24,1.20,half-.17]],.006,trim);
 }else{
  const top=bus?2.97:1.79,roofHalf=bus?1.17:.735,frontTop=bus?-half+.15:-1.53,frontBottom=bus?-half:-1.76;
  const roofPaint=bus?busSkirt:paint;const windowTop=bus?2.72:1.64;
  surface(bus?60:32,40,(u,v)=>{const t=u*2-1,z=frontTop+v*(half-.06-frontTop);return[t*roofHalf,top+(height-top)*(1-t*t),z];},roofPaint);
  surface(24,44,(u,v)=>{const t=u*2-1;return[t*((bodyWidth(frontBottom)-.006)*(1-v)+roofHalf*v),waist+v*(top-waist+(height-top)*(1-t*t)),frontBottom+v*(frontTop-frontBottom)+.015*t*t];},glass,(_,v)=>v<(bus?.82:.84));
  surface(24,44,(u,v)=>{const t=u*2-1;return[t*((bodyWidth(frontBottom)-.006)*(1-v)+roofHalf*v),waist+v*(top-waist+(height-top)*(1-t*t)),frontBottom+v*(frontTop-frontBottom)+.015*t*t];},roofPaint,(_,v)=>v>=(bus?.82:.84));
  surface(20,40,(u,v)=>{const t=u*2-1;return[t*((bodyWidth(half)-.006)*(1-v)+roofHalf*v),waist+v*(top-waist+(height-top)*(1-t*t)),half-.06];},glass);
  for(const side of[-1,1]){
   const lower=z=>[side*(bodyWidth(z)-.006),waist,z],upper=z=>[side*roofHalf,windowTop,z];
   tube([lower(frontBottom),[side*roofHalf,top,frontTop]],.028,roofPaint);tube([lower(half-.03),upper(half-.06)],.029,roofPaint);
   tube([upper(frontTop),upper(half-.06)],.030,roofPaint);tube([lower(frontBottom),lower(half-.03)],.030,roofPaint);
   surface(8,80,(u,v)=>[side*roofHalf,windowTop+v*(top-windowTop),frontTop+u*(half-.06-frontTop)],roofPaint);
   const count=bus?10:3,start=bus?frontTop:-1.51,end=half-.07,step=(end-start)/count;
   for(let i=0;i<count;i++){const a=start+i*step+.03,b=start+(i+1)*step-.03;pane([lower(a),lower(b),upper(b),upper(a)]);if(i)tube([lower(a-.03),upper(a-.03)],.027,roofPaint);}
   for(const z of axles)tube([[side*(width/2+.007),waist-.09,z-.33],[side*(width/2+.007),waist-.09,z+.33]],.004,trim);
   // India-style right-hand driver position; mirror arms remain outside the glazing.
   tube([[side*(width/2-.04),top-.15,frontTop+.17],[side*(width/2+.18),top-.15,frontTop-.10]],.017,trim);
   box(.09,bus?.33:.22,.17,.025,trim,[side*(width/2+.20),top-.15,frontTop-.11]);
   box(.011,bus?.28:.17,.125,.016,alloy,[side*(width/2+.25),top-.15,frontTop-.10]);
   if(van){for(const z of[-.40,1.40])tube([[side*(bodyWidth(z)+.002),.36,z],[side*(bodyWidth(z)+.002),waist,z]],.003,trim);box(.018,.035,.14,.008,trim,[side*.81,.95,-.03]);tube([[side*.807,waist-.12,-.25],[side*.807,waist-.12,1.65]],.010,trim);cushion(side*.33,.79,-.88);cushion(side*.33,.78,.35);}
  }
  for(const end of[-1,1]){
   tube(Array.from({length:25},(_,i)=>{const t=i/12-1;return[t*roofHalf,top+(height-top)*(1-t*t),end===-1?frontTop:half-.06];}),.030,roofPaint);
   tube([[-bodyWidth(half)+.05,waist+.04,end*half],[bodyWidth(half)-.05,waist+.04,end*half]],.018,trim);
  }
  if(bus){
   box(2.19,.08,8.68,.012,trim,[0,.89,.15]);
   for(let z=-2.72;z<4.12;z+=.79)for(const x of[-.82,-.33,.33,.82]){cushion(x,1.24,z,.43);tube([[x,1.0,z],[x,1.22,z]],.016,alloy);}
   // A glass passenger door replaces the side shell in its opening.
   const x=-width/2-.004;pane([[x,.61,-4.45],[x,.61,-3.65],[x,2.83,-3.65],[x,2.83,-4.45]]);tube([[x,.61,-4.05],[x,2.83,-4.05]],.018,trim);
   for(let i=0;i<3;i++)box(.53,.075,.63,.012,trim,[-1.00,.40+i*.18,-4.05]);
   for(const z of[-3.30,3.42])tube([[.08,.92,z],[.08,2.84,z]],.017,alloy);
   for(const side of[-1,1]){box(.37,.21,.032,.025,trim,[side*.80,1.19,-half-.022]);for(const dx of[-.087,.087])box(.13,.09,.014,.014,lamp,[side*.80+dx,1.22,-half-.048]);box(.19,.27,.028,.025,red,[side*.98,1.18,half+.01]);}
   box(1.46,.24,.03,.020,trim,[0,2.91,-half+.101]);badge('കൊച്ചി • ആലുവ',1.31,.15,[0,2.91,-half+.08],[0,Math.PI,0],'#192822');
   badge('MUD LOCAL',1.16,.18,[0,1.46,-half-.008]);
   for(const side of[-1,1])badge('മഡ് • ലോക്കൽ',2.05,.27,[side*(width/2+.02),1.38,.1],[0,side*Math.PI/2,0]);
   for(let i=0;i<9;i++)box(.70,.02,.012,.003,trim,[0,.93+i*.033,half+.028]);
  }else{
   // Small bonnet, cargo floor and twin rear doors distinguish it from the compact car.
   surface(8,32,(u,v)=>{const z=-half+v*(half-1.76),t=u*2-1;return[t*bodyWidth(z),waist-.025*t*t,z];},paint);
   box(1.40,.065,3.10,.012,trim,[0,.59,.30]);box(.48,.31,.46,.025,trim,[.36,.77,1.38]);
   for(const side of[-1,1]){box(.22,.17,.023,.021,trim,[side*.52,.87,-half-.01]);box(.16,.10,.014,.020,lamp,[side*.52,.875,-half-.028]);box(.12,.35,.025,.024,red,[side*.64,.96,half+.008]);}
   tube([[0,.35,half+.012],[0,waist,half+.012]],.005,trim);box(.42,.08,.021,.012,trim,[0,.68,half+.022]);
   for(const y of[.56,.60,.64,.68])box(.58,.012,.023,.003,trim,[0,y,-half-.015]);
   badge('MUD / V4',.31,.066,[0,.81,-half-.016]);
  }
  box(van?1.35:2.13,.14,.24,.022,trim,[0,waist+.14,frontBottom+.28]);
  k.add(new THREE.TorusGeometry(bus?.20:.15,.018,8,40),trim,[bus?.66:.38,waist+.35,frontBottom+.49],[.74,0,0]);
  for(const side of[-1,1])tube([[side*.40,waist+.12,frontBottom-.018],[side*.22,waist+.61,frontBottom+(frontTop-frontBottom)*.32-.024]],.008,trim);
 }
 root.userData={assetType:type+'-prototype',reviewOnly:true,wheelCount:4,bodyDimensions:{length,width,height},design:'Original Mud fleet; generic vehicle construction without manufacturer assets'};
 return root;
}

function deliveryBike(){
 const k=kit('Mud D2 · Kerala commuter scooter','#697e85'),{root,paint,trim,alloy,rubber,seat,red,lamp,box,tube,surface,wheel,badge}=k;
 const r=.24;wheel(0,-.71,r,.11);wheel(0,.63,r,.13);
 for(const side of[-1,1]){
  tube([[side*.10,.27,-.70],[side*.11,.69,-.57],[side*.12,.94,-.61]],.021,alloy);
  tube([[side*.12,.30,-.36],[side*.17,.39,.16],[side*.18,.65,.56]],.023,trim);
  surface(18,48,(u,v)=>{const z=.03+u*.86+(1-u)*.10*(1-v)**2-u*.06*(1-v)**2,d=z-.63,low=Math.abs(d)<.29?Math.max(.37,.255+Math.sqrt(.29**2-d*d)):.37;return[side*(.19+.045*Math.sin(u*Math.PI)*Math.sin(v*Math.PI)),low+(.72-.08*u*u-.025*(1-u)**2-low)*v,z];},paint);
  tube([[side*.15,.37,.47],[side*.15,.68,.45]],.015,alloy);
  tube(Array.from({length:49},(_,i)=>{const t=i/48,a=t*Math.PI*10;return[side*.15+.025*Math.cos(a),.39+t*.23,.47+.025*Math.sin(a)];}),.004,trim);
 }
 surface(28,30,(u,v)=>{const t=u*2-1;return[t*(.12+.17*Math.sin(v*Math.PI*.8)),.34+v*.64,-.52-.12*v+.07*t*t];},paint);
 surface(28,30,(u,v)=>{const t=u*2-1;return[t*(.12+.17*Math.sin(v*Math.PI*.8)),.34+v*.64,-.43-.10*v+.03*t*t];},trim);
 for(const side of[-1,1])surface(28,4,(u,v)=>[side*(.12+.17*Math.sin(v*Math.PI*.8)),.34+v*.64,(-.52-.12*v+.07)*(1-u)+(-.43-.10*v+.03)*u],paint);
 surface(24,24,(u,v)=>[(u*2-1)*(.19+.025*Math.sin(v*Math.PI)),.72-.08*v*v-.025*(1-v)**2,.03+v*.86],paint);
 surface(12,20,(u,v)=>[(u*2-1)*.19,.37+v*.27,.89-.06*(1-v)**2],paint);
 box(.38,.065,.63,.022,trim,[0,.315,-.10]);for(let z=-.32;z<.16;z+=.048)box(.29,.004,.009,.001,rubber,[0,.345,z]);
 // Saddle and its under-seat shell have separate, anatomically useful seat height.
 box(.40,.12,.67,.05,seat,[0,.718,.215]);
 tube([[-.29,1.00,-.55],[0,1.05,-.60],[.29,1.00,-.55]],.019,trim);
 for(const side of[-1,1]){tube([[side*.26,1.0,-.56],[side*.34,.98,-.53]],.023,rubber);tube([[side*.24,1.025,-.57],[side*.34,1.19,-.62]],.008,alloy);box(.075,.09,.021,.024,trim,[side*.34,1.20,-.62]);box(.065,.075,.005,.020,alloy,[side*.34,1.20,-.603]);}
 box(.34,.13,.14,.04,paint,[0,1.00,-.625]);box(.24,.075,.008,.027,lamp,[0,1.012,-.704]);box(.11,.08,.022,.012,red,[0,.65,.911]);
 surface(10,36,(u,v)=>{const a=u*Math.PI;return[(v-.5)*.17,.255+.273*Math.sin(a),-.71+.273*Math.cos(a)];},paint).material.side=THREE.DoubleSide;
 surface(10,36,(u,v)=>{const a=u*Math.PI;return[(v-.5)*.17,.255+.280*Math.sin(a),.63+.280*Math.cos(a)];},trim).material.side=THREE.DoubleSide;
 box(.16,.13,.42,.043,trim,[-.16,.29,.52]);box(.09,.10,.39,.025,alloy,[.20,.30,.59]);
 tube([[-.21,.71,.43],[-.22,.79,.86],[.22,.79,.86],[.21,.71,.43]],.014,alloy);
 const cargo=new THREE.MeshStandardMaterial({color:'#aa7938',roughness:.90});cargo.userData.surface='cloth';box(.46,.39,.43,.024,cargo,[0,.995,.71]);box(.47,.027,.44,.009,trim,[0,1.195,.71]);
 for(const side of[-1,1])box(.015,.36,.017,.003,trim,[side*.16,.995,.928]);badge('MUD MEALS',.35,.10,[0,1.01,.932],[0,0,0]);
 root.userData={assetType:'bike-prototype',reviewOnly:true,wheelCount:2,bodyDimensions:{length:2.00,width:.75,height:1.25},seatHeight:.76,design:'Original delivery scooter, no manufacturer assets'};return root;
}

export function buildVehiclePrototypes(){return {car:fourWheeler('car'),van:fourWheeler('van'),bus:fourWheeler('bus'),bike:deliveryBike()};}
