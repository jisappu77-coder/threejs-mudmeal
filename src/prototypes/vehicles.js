import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// Project-authored fictional vehicles. No manufacturer CAD, badges, liveries or photos.
function kit(name,color){
 const root=new THREE.Group();root.name=name;
 const paint=new THREE.MeshPhysicalMaterial({color,roughness:.38,metalness:.22,clearcoat:.35,side:THREE.DoubleSide});paint.userData.surface='paint';
 const trim=new THREE.MeshStandardMaterial({color:'#252c2c',roughness:.72,metalness:.15,side:THREE.DoubleSide});
 const rubber=new THREE.MeshStandardMaterial({color:'#202322',roughness:.94});
 const alloy=new THREE.MeshStandardMaterial({color:'#9ba29c',roughness:.28,metalness:.85});
 const glass=new THREE.MeshPhysicalMaterial({color:'#30474e',roughness:.10,metalness:0,transparent:true,opacity:.64,depthWrite:false,side:THREE.DoubleSide,envMapIntensity:1.3});
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
   if(r>.4)add(new THREE.CylinderGeometry(r*.62,r*.62,.012,40),alloy,[side*(width/2+.004),0,0],[0,0,Math.PI/2],axle);
   else{add(new THREE.TorusGeometry(r*.62,.009,8,40),alloy,[side*(width/2+.008),0,0],[0,Math.PI/2,0],axle);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;box(.022,r*.47,.027,.004,alloy,[side*(width/2+.010),Math.cos(a)*r*.36,Math.sin(a)*r*.36],[a,0,0],axle);}}
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
 const k=kit(bus?'Mud M9 · modern city bus':van?'Mud V4 · modern MPV':'Mud C4 · modern hatchback',bus?'#e5e9e6':van?'#b8c2c0':'#37799b');
 const {root,paint,trim,rubber,alloy,glass,seat,red,lamp,box,tube,surface,pane,wheel,cushion,badge}=k;
 const length=bus?9.70:van?4.45:3.85,width=bus?2.5:van?1.80:1.72,height=bus?3.1:van?1.72:1.54;
 const half=length/2,r=bus?.48:van?.33:.31,axles=bus?[-2.98,2.62]:van?[-1.35,1.35]:[-1.21,1.20],waist=bus?1.68:van?1.06:1.00,base=bus?.49:.265;
 const bodyWidth=z=>width/2*(bus?1-.035*(Math.abs(z)/half)**8:1-(z<0?.12:.06)*(Math.abs(z)/half)**6);
 const deckHeight=z=>bus?waist:z<-.85?waist-.15*((-.85-z)/(half-.85))**2:z>1.20?waist+.10*(z-1.20)/(half-1.20):waist;
 const busSkirt=new THREE.MeshPhysicalMaterial({color:'#277675',roughness:.5,metalness:.12,side:THREE.DoubleSide});
 function archLow(z){let low=base;for(const axle of axles){const d=z-axle,clearance=r+.045;if(Math.abs(d)<clearance)low=Math.max(low,r+.015+Math.sqrt(clearance**2-d*d));}return low;}
 for(const side of[-1,1]){
  const sidePoint=(u,v)=>{const z=-half+u*length,low=archLow(z);return[side*(bodyWidth(z)-.05*(1-v)+.014*Math.sin(v*Math.PI)),low+(deckHeight(z)-(!bus?.025:0)-low)*v,z-(bus?0:Math.sign(z)*.13*(Math.abs(z)/half)**8)];};
  const hasSide=u=>!(bus&&side===-1&&(-half+u*length)>-4.45&&(-half+u*length)<-3.65);
  surface(12,bus?240:120,sidePoint,paint,(u,v)=>hasSide(u)&&(!bus||v>=.4));
  if(bus)surface(12,240,sidePoint,busSkirt,(u,v)=>hasSide(u)&&v<.4);
  for(const z of axles){wheel(side*(width/2-.115),z,r,bus?.24:.18);const path=Array.from({length:29},(_,i)=>{const a=i/28*Math.PI;return[side*(bodyWidth(z)+.006),r+.015+(r+.045)*Math.sin(a),z+(r+.045)*Math.cos(a)];});tube(path,.010,bus?trim:paint);}
  tube([[side*(width/2-.04),base+.03,-half+.3],[side*(width/2-.04),base+.03,half-.3]],.023,trim);
 }
 // Formed bumper faces close only the lower body, leaving the windows genuinely open.
 for(const end of[-1,1]){
  const endPoint=(u,v)=>{const t=u*2-1;return[t*(bodyWidth(end*half)-.05*(1-v)+.014*Math.sin(v*Math.PI)),base+v*(deckHeight(end*half)-(!bus?.025*t*t:0)-base),end*(half-(bus?0:.13*t*t))];};
  surface(12,40,endPoint,paint,(_,v)=>!bus||v>=.4);
  if(bus)surface(12,40,endPoint,busSkirt,(_,v)=>v<.4);
  if(bus)box(width*.88,.085,.06,.025,trim,[0,base+.12,end*(half+.014)]);
 }
 box(width*.87,.05,length-.35,.012,trim,[0,base+.03,0]);
 if(!bus){
  // A shared rounded body construction for the hatchback and taller three-row MPV.
  const roofEdge=height-.10,roofHalf=width*.405,roofRear=van?1.38:1.13,quarterBottom=van?1.60:1.32;
  const darkRoof=new THREE.MeshPhysicalMaterial({color:'#202a30',roughness:.35,metalness:.25,clearcoat:.4,side:THREE.DoubleSide});
  const faceZ=(x,y,end)=>{const v=THREE.MathUtils.clamp((y-base)/(deckHeight(end*half)-base),0,1),w=bodyWidth(end*half)-.05*(1-v)+.014*Math.sin(v*Math.PI);return end*(half-.13*(x/w)**2);};
  const noseZ=(x,y=waist-.235)=>faceZ(x,y,-1);
  surface(20,40,(u,v)=>{const z=-half+v*(half-.85),t=u*2-1;return[t*bodyWidth(z),deckHeight(z)-.025*t*t+.035*t*t*(1-t*t)*Math.sin(v*Math.PI),z+ .13*t*t*(Math.abs(z)/half)**8];},paint);
  const roofPoint=(u,v)=>{const t=u*2-1;return[t*roofHalf,roofEdge+.10*(1-t*t)-.012*Math.sin(v*Math.PI),-.30+v*(roofRear+.30)];};
  surface(24,40,roofPoint,darkRoof);
  surface(20,40,(u,v)=>{const t=u*2-1;return[t*(bodyWidth(-.85)*(1-v)+roofHalf*v),waist+.01+v*(height-waist-.01-.10*t*t)-.025*(1-v)*t*t,-.85+v*.55];},glass);
  surface(22,40,(u,v)=>{const t=u*2-1;return[t*(roofHalf*(1-v)+bodyWidth(half)*v),roofEdge+.10*(1-t*t)-v*(roofEdge-deckHeight(half)+.10*(1-t*t)+.025*t*t),roofRear+v*(half-.13*t*t-roofRear)];},glass);
  for(const v of[0,1])tube(Array.from({length:25},(_,i)=>roofPoint(i/24,v)),.022,darkRoof);
  for(const side of[-1,1]){
   const lower=z=>[side*bodyWidth(z),deckHeight(z)-.023,z],upper=z=>[side*roofHalf,roofEdge-.002,z];
   pane([lower(-.83),lower(.27),upper(.27),upper(-.295)]);
   pane([lower(.35),lower(quarterBottom),upper(roofRear-.05),upper(.35)]);
   tube([lower(-.85),upper(-.30)],.040,paint);tube([lower(.31),upper(.31)],.030,trim);
   tube([upper(-.30),upper(roofRear)],.026,darkRoof);
   surface(20,8,(u,v)=>{const z=(1-v)*(roofRear-.05+.05*u)+v*(quarterBottom+(half-.13-quarterBottom)*u);return[side*(roofHalf*(1-v)+bodyWidth(z)*v),(roofEdge-.002)*(1-v)+(deckHeight(z)-.023)*v,z];},darkRoof);
   for(const z of[-.85,.31,quarterBottom+.02])tube([[side*(bodyWidth(z)+.001),deckHeight(z)-.025,z],[side*(bodyWidth(z)-.025),.32,z]],.0025,trim);
   for(const z of[.10,1.09])box( .015,.024,.13,.008,paint,[side*(bodyWidth(z)+.012),waist-.055,z]);
   tube([[side*.79,waist+.14,-.70],[side*.91,waist+.14,-.70]],.014,trim);box(.15,.095,.15,.032,paint,[side*.94,waist+.155,-.72]);box(.008,.066,.11,.020,alloy,[side*1.018,waist+.155,-.704]);
   for(const z of(van?[.10,.91,1.61]:[.10,.97])){cushion(side*.34,van?.72:.65,z,.43);box(.28,.12,.06,.025,seat,[side*.34,van?1.30:1.23,z+.21]);}
   tube([[side*(bodyWidth(-.90)+.003),waist-.12,-.90],[side*(bodyWidth(.3)+.003),waist-.10,.30],[side*(bodyWidth(quarterBottom)+.003),waist-.06,quarterBottom]],.0025,paint);
  }
  box(1.26,.14,.24,.035,trim,[0,waist+.035,-.66]);
  k.add(new THREE.TorusGeometry(.13,.015,8,40),trim,[.34,waist+.115,-.51],[.72,0,0]);
  for(const side of[-1,1]){
   const x=side*.56,z=noseZ(x);
   box(.33,.105,.028,.031,trim,[x,waist-.235,z-.012],[0,-side*.28,0]);
   tube([[x-side*.135,waist-.196,noseZ(x-side*.135)-.031],[x+side*.135,waist-.196,noseZ(x+side*.135)-.031]],.007,lamp);
   for(const dx of[-.07,.065])k.add(new THREE.CylinderGeometry(.027,.027,.010,24),lamp,[x+dx,waist-.237,noseZ(x+dx)-.032],[Math.PI/2,0,0]);
   box(.08,.12,.016,.027,trim,[side*.65,.44,noseZ(side*.65)-.015],[0,-side*.32,0]);
   const tailY=deckHeight(half)-.09,tailZ=faceZ(side*.58,tailY,1);
   box(.31,.14,.018,.032,trim,[side*.58,tailY,tailZ+.009],[0,side*.26,0]);
   box(.27,.049,.014,.018,red,[side*.58,tailY-.023,tailZ+.025],[0,side*.26,0]);
   tube([[side*.44,tailY+.04,faceZ(side*.44,tailY+.04,1)+.025],[side*.70,tailY+.04,faceZ(side*.70,tailY+.04,1)+.025]],.008,red);

  }
  surface(12,32,(u,v)=>{const x=(u*2-1)*(.48+.035*Math.sin(v*Math.PI));return[x,.36+v*.24,noseZ(x,.36+v*.24)-.014];},trim);
  for(let y=.40;y<.58;y+=.045)tube(Array.from({length:17},(_,i)=>{const x=(i/8-1)*.45;return[x,y,noseZ(x,y)-.022];}),.003,alloy);
  tube(Array.from({length:25},(_,i)=>{const x=(i/12-1)*.72;return[x,.31,noseZ(x,.31)-.014];}),.018,trim);
  box(.32,.075,.011,.009,lamp,[0,.655,-half-.012]);badge(van?'MUD / V4':'MUD / C4',.24,.058,[0,waist-.12,-half-.011]);
  surface(8,32,(u,v)=>{const x=(u*2-1)*width*.43,y=.32+v*.14;return[x,y,faceZ(x,y,1)+.012];},trim);
  box(.33,.085,.009,.010,lamp,[0,.72,half+.013]);
  tube([[-.14,.85,half+.014],[.14,.85,half+.014]],.009,trim);
  tube([[0,deckHeight(half)+.035,half+.004],[.24,deckHeight(half)+.19,half-.17]],.006,trim);
  box(roofHalf*1.85,.035,.12,.012,darkRoof,[0,roofEdge+.02,roofRear+.07]);
 }else{
  const top=bus?2.97:1.79,roofHalf=bus?1.17:.735,frontTop=bus?-half+.15:-1.53,frontBottom=bus?-half:-1.76;
  const roofPaint=trim;const windowTop=bus?2.72:1.64;
  surface(bus?60:32,40,(u,v)=>{const t=u*2-1,z=frontTop+v*(half-.06-frontTop);return[t*roofHalf,top+(height-top)*(1-t*t),z];},paint);
  surface(24,44,(u,v)=>{const t=u*2-1;return[t*((bodyWidth(frontBottom)-.006)*(1-v)+roofHalf*v),waist+v*(top-waist+(height-top)*(1-t*t)),frontBottom+v*(frontTop-frontBottom)+.015*t*t];},glass,(_,v)=>v<(bus?.82:.84));
  surface(24,44,(u,v)=>{const t=u*2-1;return[t*((bodyWidth(frontBottom)-.006)*(1-v)+roofHalf*v),waist+v*(top-waist+(height-top)*(1-t*t)),frontBottom+v*(frontTop-frontBottom)+.015*t*t];},roofPaint,(_,v)=>v>=(bus?.82:.84));
  surface(20,40,(u,v)=>{const t=u*2-1;return[t*((bodyWidth(half)-.006)*(1-v)+roofHalf*v),waist+v*(top-waist+(height-top)*(1-t*t)),half-.06];},glass);
  for(const side of[-1,1]){
   const lower=z=>[side*(bodyWidth(z)-.006),waist,z],upper=z=>[side*roofHalf,windowTop,z];
   tube([lower(frontBottom),[side*roofHalf,top,frontTop]],.028,roofPaint);tube([lower(half-.03),upper(half-.06)],.029,roofPaint);
   tube([upper(frontTop),upper(half-.06)],.030,roofPaint);tube([lower(frontBottom),lower(half-.03)],.030,roofPaint);
   surface(8,80,(u,v)=>[side*roofHalf,windowTop+v*(top-windowTop),frontTop+u*(half-.06-frontTop)],roofPaint);
   const count=bus?6:3,start=bus?frontTop:-1.51,end=half-.07,step=(end-start)/count;
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
   box(1.54,.20,.025,.018,trim,[0,1.24,-half-.014]);
   box(1.65,.16,1.56,.06,paint,[0,3.12,.7]);
   box(2.19,.08,8.68,.012,trim,[0,.89,.15]);
   for(let z=-2.72;z<4.12;z+=.79)for(const x of[-.82,-.33,.33,.82]){cushion(x,1.24,z,.43);tube([[x,1.0,z],[x,1.22,z]],.016,alloy);}
   // A glass passenger door replaces the side shell in its opening.
   const x=-width/2-.004;pane([[x,.61,-4.45],[x,.61,-3.65],[x,2.83,-3.65],[x,2.83,-4.45]]);tube([[x,.61,-4.05],[x,2.83,-4.05]],.018,trim);
   for(let i=0;i<3;i++)box(.53,.075,.63,.012,trim,[-1.00,.40+i*.18,-4.05]);
   for(const z of[-3.30,3.42])tube([[.08,.92,z],[.08,2.84,z]],.017,alloy);
   for(const side of[-1,1]){box(.36,.12,.032,.033,trim,[side*.80,1.19,-half-.022]);box(.29,.027,.014,.009,lamp,[side*.80,1.23,-half-.048]);box(.29,.047,.014,.012,lamp,[side*.80,1.16,-half-.048]);box(.19,.27,.028,.025,red,[side*.98,1.18,half+.01]);}
   box(1.46,.24,.03,.020,trim,[0,2.91,-half+.101]);badge('കൊച്ചി • ആലുവ',1.31,.15,[0,2.91,-half+.08],[0,Math.PI,0],'#192822');
   badge('MUD CITY',1.16,.18,[0,1.46,-half-.008]);
   for(const side of[-1,1])badge('മഡ് • സിറ്റി',2.05,.27,[side*(width/2+.02),1.38,.1],[0,side*Math.PI/2,0]);
   for(let i=0;i<9;i++)box(.70,.02,.012,.003,trim,[0,.93+i*.033,half+.028]);
  }
  box(van?1.35:2.13,.14,.24,.022,trim,[0,waist+.14,frontBottom+.28]);
  k.add(new THREE.TorusGeometry(bus?.20:.15,.018,8,40),trim,[bus?.66:.38,waist+.35,frontBottom+.49],[.74,0,0]);
  for(const side of[-1,1])tube([[side*.40,waist+.12,frontBottom-.018],[side*.22,waist+.61,frontBottom+(frontTop-frontBottom)*.32-.024]],.008,trim);
 }
 root.userData={assetType:type+'-prototype',reviewOnly:true,wheelCount:4,bodyDimensions:{length,width,height},design:'Original Mud fleet; generic vehicle construction without manufacturer assets'};
 return root;
}

function deliveryBike(){
 const k=kit('Mud D2 · modern delivery scooter','#536f83'),{root,paint,trim,alloy,rubber,seat,red,lamp,box,tube,surface,wheel,badge}=k;
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
 box(.34,.13,.14,.04,trim,[0,1.00,-.625]);box(.25,.035,.008,.012,lamp,[0,1.012,-.704]);box(.17,.033,.022,.012,red,[0,.65,.911]);
 surface(10,36,(u,v)=>{const a=u*Math.PI;return[(v-.5)*.17,.255+.273*Math.sin(a),-.71+.273*Math.cos(a)];},paint).material.side=THREE.DoubleSide;
 surface(10,36,(u,v)=>{const a=u*Math.PI;return[(v-.5)*.17,.255+.280*Math.sin(a),.63+.280*Math.cos(a)];},trim).material.side=THREE.DoubleSide;
 box(.16,.13,.42,.043,trim,[-.16,.29,.52]);box(.09,.10,.39,.025,alloy,[.20,.30,.59]);
 tube([[-.21,.71,.43],[-.22,.79,.86],[.22,.79,.86],[.21,.71,.43]],.014,alloy);
 const cargo=new THREE.MeshStandardMaterial({color:'#aa7938',roughness:.90});cargo.userData.surface='cloth';box(.46,.39,.43,.024,cargo,[0,.995,.71]);box(.47,.027,.44,.009,trim,[0,1.195,.71]);
 for(const side of[-1,1])box(.015,.36,.017,.003,trim,[side*.16,.995,.928]);badge('MUD MEALS',.35,.10,[0,1.01,.932],[0,0,0]);
 root.userData={assetType:'bike-prototype',reviewOnly:true,wheelCount:2,bodyDimensions:{length:2.00,width:.75,height:1.25},seatHeight:.76,design:'Original delivery scooter, no manufacturer assets'};return root;
}

export function buildVehiclePrototypes(){return {car:fourWheeler('car'),van:fourWheeler('van'),bus:fourWheeler('bus'),bike:deliveryBike()};}
