import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// A separate metre-scale body rebuild, not a recolour of the live world's model.
export function buildAuto(){
 const root=new THREE.Group();root.name='Formed-panel autorickshaw prototype';
 const paint=new THREE.MeshPhysicalMaterial({color:'#bc8b22',metalness:.16,roughness:.34,clearcoat:.55,clearcoatRoughness:.23});
 const metal=new THREE.MeshPhysicalMaterial({color:'#242722',metalness:.12,roughness:.44,clearcoat:.3});
 const frame=new THREE.MeshStandardMaterial({color:'#272a28',metalness:.5,roughness:.44}),rubber=new THREE.MeshStandardMaterial({color:'#191b1a',roughness:.97}),chrome=new THREE.MeshStandardMaterial({color:'#9b9c93',metalness:.9,roughness:.3}),cloth=new THREE.MeshStandardMaterial({color:'#242521',roughness:.98,side:THREE.DoubleSide}),seat=new THREE.MeshStandardMaterial({color:'#322c25',roughness:.87});
 cloth.userData.surface='cloth';
 const add=(geometry,material,p=[0,0,0],rotation=[0,0,0])=>{const o=new THREE.Mesh(geometry,material);o.position.set(...p);o.rotation.set(...rotation);o.castShadow=o.receiveShadow=true;root.add(o);return o;};
 const box=(w,h,d,r,m,p)=>add(new RoundedBoxGeometry(w,h,d,5,r),m,p);
 const tube=(points,r,m)=>add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),Math.max(12,points.length*8),r,12,false),m);
 const cylinder=(r,h,m,p,rotation=[0,0,0])=>add(new THREE.CylinderGeometry(r,r,h,48),m,p,rotation);
 function surface(rows,cols,point,material){const v=[],uv=[],idx=[];for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){v.push(...point(x/cols,y/rows));uv.push(x/cols,y/rows);if(x<cols&&y<rows){const k=y*(cols+1)+x;idx.push(k,k+cols+1,k+1,k+1,k+cols+1,k+cols+2);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return add(g,material);}
 box(1.24,.10,2.35,.025,frame,[0,.32,.02]);
 box(1.24,.065,1.94,.015,rubber,[0,.402,.24]);
 box(1.28,.29,.60,.035,metal,[0,.58,.985]);
 // Curved pressed nose: shoulders sweep back around the headlight recesses.
 const profiles=[[.39,.46,-1.17],[.49,.56,-1.27],[.73,.63,-1.27],[.94,.61,-1.16],[1.055,.58,-1.03]];
 const profile=new THREE.CatmullRomCurve3(profiles.map(([y,w,z])=>new THREE.Vector3(w,y,z)));
 surface(48,64,(u,v)=>{const p=profile.getPoint(v),t=u*2-1;return[t*p.x,p.y+.012*Math.cos(t*Math.PI),p.z+.205*t*t];},metal).material.side=THREE.DoubleSide;
 surface(10,64,(u,v)=>{const t=u*2-1;return[t*(.61-v*.03),.947+v*.105,-1.158+v*.126+.205*t*t];},paint).material.side=THREE.DoubleSide;
 tube([[-.59,1.053,-.96],[0,1.066,-1.03],[.59,1.053,-.96]],.012,frame);
 for(const side of[-1,1]){
  // Rounded side stampings and thin door sills surround a genuinely open entrance.
  box(.052,.29,.57,.015,metal,[side*.625,.61,.92]);
  box(.06,.035,1.12,.012,chrome,[side*.636,.434,.13]);
  tube([[side*.606,1.037,-.96],[side*.558,1.555,-.79],[side*.555,1.63,-.74]],.018,paint);
  tube([[side*.614,.66,1.15],[side*.618,1.34,1.13],[side*.610,1.61,1.09]],.014,frame);
  tube([[side*.613,.43,.19],[side*.613,1.59,.19]],.011,frame);
  tube([[side*.625,.89,.25],[side*.625,.89,1.05]],.012,chrome);
  tube([[side*.571,1.37,-.86],[side*.725,1.39,-.92],[side*.783,1.445,-.95]],.009,frame);
  const mirror=add(new THREE.SphereGeometry(1,40,28),frame,[side*.785,1.448,-.956]);mirror.scale.set(.053,.082,.019);
  const mirrorGlass=add(new THREE.SphereGeometry(1,40,28),chrome,[side*.785,1.448,-.934]);mirrorGlass.scale.set(.046,.075,.006);
  box(.087,.056,.025,.009,new THREE.MeshStandardMaterial({color:'#a86718',roughness:.25}),[side*.53,.97,-1.165]);
  box(.087,.128,.027,.012,new THREE.MeshPhysicalMaterial({color:'#8d2820',roughness:.28,clearcoat:1}),[side*.51,.69,1.292]);
  // Real reflector, recessed lamp glass and fine fluting replace solid white discs.
  const x=side*.418,z=-1.247+.205*(x/.63)**2;
  cylinder(.092,.042,rubber,[x,.769,z-.012],[Math.PI/2,0,0]);
  cylinder(.080,.024,chrome,[x,.769,z-.038],[Math.PI/2,0,0]);
  const lens=add(new THREE.SphereGeometry(1,48,32),new THREE.MeshPhysicalMaterial({color:'#ced4cc',roughness:.12,metalness:.08,clearcoat:1,transparent:true,opacity:.47}),[x,.769,z-.057]);lens.scale.set(.076,.076,.017);
  for(let y=-.052;y<.056;y+=.013){const half=Math.sqrt(.072**2-y*y);tube([[x-half,.769+y,z-.074],[x+half,.769+y,z-.074]],.0011,chrome);}
 }
 // Single curved windshield, thin rubber seal, and a blade that follows its rake.
 const glazing=new THREE.MeshPhysicalMaterial({color:'#aebcbb',roughness:.10,metalness:0,clearcoat:1,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide});
 surface(20,48,(u,v)=>{const t=u*2-1;return[t*(.555-v*.018),1.052+v*.545,-1.024+v*.194+.034*t*t];},glazing);
 for(const side of[-1,1])tube([[side*.555,1.052,-.990],[side*.538,1.595,-.796]],.010,rubber);
 tube([[-.555,1.052,-.99],[0,1.052,-1.024],[.555,1.052,-.99]],.010,rubber);
 tube([[-.538,1.595,-.796],[0,1.595,-.830],[.538,1.595,-.796]],.010,rubber);
 tube([[-.17,1.07,-1.053],[.18,1.35,-.955]],.005,frame);
 tube([[.03,1.25,-.999],[.31,1.46,-.924]],.004,rubber);
 // Flat-centred canvas canopy with rounded shoulders, cloth sag and sewn seams.
 const roofPoint=(u,v)=>{const t=u*2-1,z=-.84+v*2.06,y=1.567+.129*Math.pow(Math.max(0,1-t*t),.23)-.008*Math.sin(v*Math.PI)**2-.004*Math.sin(v*Math.PI*6)*(1-t*t);return[t*.65,y,z];};
 surface(48,64,roofPoint,cloth);
 for(const v of[.01,.48,.98])tube(Array.from({length:25},(_,i)=>{const p=roofPoint(i/24,v);p[1]+=.001;return p;}),.002,new THREE.MeshStandardMaterial({color:'#515148',roughness:1}));
 // Rear curtains are built around their opening, not layered over opaque panels.
 box(1.26,.30,.033,.016,cloth,[0,.988,1.225]);box(1.26,.18,.033,.016,cloth,[0,1.52,1.225]);
 for(const side of[-1,1])box(.325,.38,.033,.012,cloth,[side*.465,1.28,1.225]);
 box(.595,.37,.018,.018,glazing,[0,1.282,1.242]);
 box(1.05,.105,.47,.035,seat,[0,.758,.70]);box(1.05,.36,.075,.024,seat,[0,.969,.965]);
 for(let x=-.45;x<.46;x+=.15)tube([[x,.815,.505],[x,.815,.903]],.0018,new THREE.MeshStandardMaterial({color:'#675c4d',roughness:.95}));
 box(.43,.11,.36,.026,seat,[0,.735,-.385]);box(.43,.27,.06,.025,seat,[0,.91,-.225]);
 box(.48,.10,.19,.022,frame,[0,1.055,-.72]);
 tube([[0,.37,-1.00],[0,1.027,-.751]],.015,chrome);
 tube([[-.24,1.07,-.74],[0,1.10,-.78],[.24,1.07,-.74]],.011,frame);
 for(const side of[-1,1])tube([[side*.22,1.07,-.74],[side*.28,1.07,-.71]],.020,rubber);
 function wheel(x,z){const axle=new THREE.Group();axle.position.set(x,.255,z);root.add(axle);axle.userData.wheelRadius=.245;
  const before=root.children.length;add(new THREE.TorusGeometry(.192,.053,24,64),rubber,[x,.255,z],[0,Math.PI/2,0]);cylinder(.144,.135,frame,[x,.255,z],[0,0,Math.PI/2]);
  for(const side of[-1,1]){cylinder(.129,.014,chrome,[x+side*.072,.255,z],[0,0,Math.PI/2]);cylinder(.043,.022,frame,[x+side*.083,.255,z],[0,0,Math.PI/2]);for(let i=0;i<6;i++){const a=i*Math.PI/3;cylinder(.011,.004,rubber,[x+side*.084,.255+Math.sin(a)*.091,z+Math.cos(a)*.091],[0,0,Math.PI/2]);}}
  for(let i=0;i<48;i++){const a=i*Math.PI/24,o=box(.101,.008,.019,.002,rubber,[x,.255+Math.cos(a)*.242,z+Math.sin(a)*.242]);o.rotation.x=a;}
  const parts=root.children.slice(before);for(const o of parts){axle.attach(o);}return axle;
 }
 wheel(0,-1.025);wheel(-.587,.97);wheel(.587,.97);
 const arch=(x,z,width,r,material)=>surface(48,8,(u,v)=>{const a=u*Math.PI;return[x+(v-.5)*width,.255+r*Math.sin(a),z+r*Math.cos(a)];},material);
 arch(0,-1.025,.265,.279,metal).material.side=THREE.DoubleSide;
 for(const side of[-1,1])arch(side*.592,.97,.155,.281,metal);
 box(.68,.043,.08,.013,frame,[0,.386,-1.29]);box(1.16,.072,.07,.018,frame,[0,.385,1.27]);
 for(let y=.54;y<.65;y+=.023)box(.16,.007,.012,.001,frame,[0,y,-1.287]);
 root.userData={assetType:'autorickshaw-prototype',reviewOnly:true,dimensions:{length:2.635,width:1.30,height:1.70},wheelCount:3};return root;
}
