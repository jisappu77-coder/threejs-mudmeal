import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Original project-authored geometry and canvas badge; no manufacturer meshes, logos or photos.
export function buildAuto(){
 const root=new THREE.Group();root.name='Mud C3 · modern Kerala autorickshaw';
 const paint=new THREE.MeshPhysicalMaterial({color:'#d5a62c',metalness:.22,roughness:.42,clearcoat:.32,clearcoatRoughness:.3});
 const frame=new THREE.MeshStandardMaterial({color:'#272a28',metalness:.5,roughness:.44}),rubber=new THREE.MeshStandardMaterial({color:'#191b1a',roughness:.97}),chrome=new THREE.MeshStandardMaterial({color:'#9b9c93',metalness:.9,roughness:.3}),cloth=new THREE.MeshStandardMaterial({color:'#242521',roughness:.98,side:THREE.DoubleSide}),seat=new THREE.MeshStandardMaterial({color:'#322c25',roughness:.87});
 cloth.userData.surface='cloth';seat.userData.surface='cloth';paint.userData.surface='paint';
 const add=(geometry,material,p=[0,0,0],rotation=[0,0,0])=>{const o=new THREE.Mesh(geometry,material);o.position.set(...p);o.rotation.set(...rotation);o.castShadow=o.receiveShadow=true;root.add(o);return o;};
 const box=(w,h,d,r,m,p)=>add(new RoundedBoxGeometry(w,h,d,5,r),m,p);
 const tube=(points,r,m)=>add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),Math.max(12,points.length*8),r,12,false),m);
 const cylinder=(r,h,m,p,rotation=[0,0,0])=>add(new THREE.CylinderGeometry(r,r,h,48),m,p,rotation);
 function surface(rows,cols,point,material){const v=[],uv=[],idx=[];for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){v.push(...point(x/cols,y/rows));uv.push(x/cols,y/rows);if(x<cols&&y<rows){const k=y*(cols+1)+x;idx.push(k,k+cols+1,k+1,k+1,k+cols+1,k+cols+2);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return add(g,material);}
 box(1.0,.10,2.02,.025,frame,[0,.32,.22]);
 for(const side of[-1,1])tube([[side*.47,.33,-.70],[side*.45,.34,-1.17]],.020,frame);
 box(1.0,.065,1.94,.015,rubber,[0,.402,.24]);
 box(1.06,.19,.51,.025,frame,[0,.60,.985]);
 // Curved pressed nose: shoulders sweep back around the headlight recesses.
 const profiles=[[.39,.46,-1.17],[.49,.56,-1.27],[.73,.63,-1.27],[.945,.61,-1.16]];
 const profile=new THREE.CatmullRomCurve3(profiles.map(([y,w,z])=>new THREE.Vector3(w,y,z)));
 function nose(y,x=0){let low=0,high=1;for(let i=0;i<20;i++){const v=(low+high)/2;if(profile.getPoint(v).y<y)low=v;else high=v;}const v=(low+high)/2,p=profile.getPoint(v),t=x/p.x;return p.z+.205*t*t-.008*Math.exp(-t*t*35)*Math.sin(v*Math.PI);}
 surface(48,64,(u,v)=>{const p=profile.getPoint(v),t=u*2-1;return[t*p.x,p.y+.18*Math.exp(-t*t*14)*(1-v)**3,p.z+.205*t*t-.008*Math.exp(-t*t*35)*Math.sin(v*Math.PI)];},paint).material.side=THREE.DoubleSide;
 surface(10,64,(u,v)=>{const t=u*2-1;return[t*(.61-v*.03),.947+v*.105,-1.158+v*.126+.205*t*t];},paint).material.side=THREE.DoubleSide;
 tube([[-.59,1.053,-.96],[0,1.066,-1.03],[.59,1.053,-.96]],.012,frame);
 for(const side of[-1,1]){
  // Rounded side stampings and thin door sills surround a genuinely open entrance.
  // Formed rear quarter shell with an actual wheel opening, not a covered wheel.
  const quarter=surface(24,40,(u,v)=>{
   const z=.30+u*.99,dz=z-.97,arch=Math.abs(dz)<.30?.255+Math.sqrt(.30**2-dz**2):.425;
   const low=Math.max(.425,arch),high=.875+.018*Math.sin(u*Math.PI);
   return[side*(.625+.014*Math.sin(v*Math.PI)*Math.sin(u*Math.PI)),low+(high-low)*v,z];
  },paint);quarter.material.side=THREE.DoubleSide;quarter.name='Pressed rear quarter '+side;
  surface(40,20,(u,v)=>{const p=profile.getPoint(v);return[side*(p.x*(1-u)+.555*u),p.y,(p.z+.205)*(1-u)-.69*u+.012*Math.sin(u*Math.PI)*Math.sin(v*Math.PI)];},paint).material.side=THREE.DoubleSide;
  tube([[side*.634,.878,.30],[side*.636,.895,.79],[side*.627,.878,1.28]],.009,rubber);
  // Rear canvas wraps the passenger cabin, while the entry stays open.
  surface(16,18,(u,v)=>[side*(.617+.005*Math.sin(u*Math.PI)*Math.sin(v*Math.PI)),.89+v*.68,.91+u*.31],cloth);
  tube([[side*.623,.90,.91],[side*.623,1.25,.91],[side*.623,1.58,.91]],.003,cloth);
  box(.06,.035,1.12,.012,chrome,[side*.636,.434,.13]);
  tube([[side*.606,1.037,-.96],[side*.558,1.555,-.79],[side*.555,1.63,-.74]],.018,paint);
  tube([[side*.614,.66,1.15],[side*.618,1.34,1.13],[side*.610,1.61,1.09]],.014,frame);
  tube([[side*.613,.43,.19],[side*.613,1.59,.19]],.011,frame);
  tube([[side*.625,.89,.25],[side*.625,.89,1.05]],.012,chrome);
  tube([[side*.571,1.37,-.86],[side*.725,1.39,-.92],[side*.783,1.445,-.95]],.009,frame);
  const mirror=add(new THREE.SphereGeometry(1,40,28),frame,[side*.785,1.448,-.956]);mirror.scale.set(.053,.082,.019);
  const mirrorGlass=add(new THREE.SphereGeometry(1,40,28),chrome,[side*.785,1.448,-.934]);mirrorGlass.scale.set(.046,.075,.006);
  box(.087,.056,.025,.009,new THREE.MeshStandardMaterial({color:'#a86718',roughness:.25}),[side*.53,.97,-.979]);
  box(.087,.128,.027,.012,new THREE.MeshPhysicalMaterial({color:'#8d2820',roughness:.28,clearcoat:1}),[side*.51,.69,1.292]);
  // Original twin horizontal lamp assemblies, fitted to the compound nose curve.
  const x=side*.403,z=nose(.826,x),yaw=-side*.41;
  const housing=box(.238,.119,.022,.032,rubber,[x,.826,z-.004]);housing.rotation.y=yaw;housing.name='C3 headlight housing '+side;
  const reflector=box(.211,.091,.011,.025,chrome,[x,.826,z-.014]);reflector.rotation.y=yaw;
  const lens=box(.205,.085,.010,.024,new THREE.MeshPhysicalMaterial({color:'#d7dfd5',roughness:.15,metalness:.05,clearcoat:.7,transparent:true,opacity:.43,depthWrite:false}),[x,.826,z-.021]);lens.rotation.y=yaw;
  const drl=box(.185,.013,.008,.006,new THREE.MeshStandardMaterial({color:'#dce8ed',roughness:.22}),[x,.862,z-.029]);drl.rotation.y=yaw;
  for(let y=-.028;y<=.029;y+=.009)tube([[x-.083,.826+y,z-.030-side*.035],[x+.083,.826+y,z-.030+side*.035]],.0008,chrome);

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
 for(const end of[0,1])surface(8,64,(u,v)=>{const roof=roofPoint(u,end),t=u*2-1;return[roof[0],(1-v)*(1.585+.012*t*t)+v*roof[1],roof[2]+(end? .001:-.001)];},cloth);
 for(const v of[.01,.48,.98])tube(Array.from({length:25},(_,i)=>{const p=roofPoint(i/24,v);p[1]+=.001;return p;}),.002,new THREE.MeshStandardMaterial({color:'#515148',roughness:1}));
 // Curved rear engine cover closes the body below the canvas cabin.
 surface(18,40,(u,v)=>{const t=u*2-1;return[t*.628,.425+v*.485,1.278+.013*(1-t*t)*Math.sin(v*Math.PI)];},paint).material.side=THREE.DoubleSide;
 for(const side of[-1,1])tube([[side*.45,.56,1.294],[side*.45,.72,1.294]],.012,rubber);
 // Rear curtains are built around their opening, not layered over opaque panels.
 box(1.26,.30,.033,.016,cloth,[0,.988,1.225]);box(1.26,.18,.033,.016,cloth,[0,1.52,1.225]);
 for(const side of[-1,1])box(.325,.38,.033,.012,cloth,[side*.465,1.28,1.225]);
 box(.595,.37,.018,.018,glazing,[0,1.282,1.242]);
 box(1.05,.105,.47,.035,seat,[0,.758,.70]);box(1.05,.36,.075,.024,seat,[0,.969,.965]);
 for(let x=-.45;x<.46;x+=.15)tube([[x,.815,.505],[x,.815,.903]],.0018,new THREE.MeshStandardMaterial({color:'#675c4d',roughness:.95}));
 for(const side of[-1,1]){tube([[side*.14,.405,-.42],[side*.14,.675,-.42]],.017,frame);tube([[side*.40,.405,.72],[side*.40,.705,.72]],.018,frame);}
 box(.43,.11,.36,.026,seat,[0,.735,-.385]);box(.43,.27,.06,.025,seat,[0,.91,-.225]);
 box(.48,.10,.19,.022,frame,[0,1.055,-.72]);
 tube([[0,.37,-1.00],[0,1.027,-.751]],.015,chrome);
 tube([[-.24,1.07,-.74],[0,1.10,-.78],[.24,1.07,-.74]],.011,frame);
 for(const side of[-1,1])tube([[side*.22,1.07,-.74],[side*.28,1.07,-.71]],.020,rubber);
 function wheel(x,z){const axle=new THREE.Group();axle.position.set(x,.255,z);root.add(axle);axle.userData.wheelRadius=.245;
  const before=root.children.length;add(new THREE.TorusGeometry(.192,.053,24,64),rubber,[x,.255,z],[0,Math.PI/2,0]);cylinder(.144,.135,frame,[x,.255,z],[0,0,Math.PI/2]);
  for(const side of[-1,1]){cylinder(.129,.014,chrome,[x+side*.072,.255,z],[0,0,Math.PI/2]);cylinder(.043,.022,frame,[x+side*.083,.255,z],[0,0,Math.PI/2]);for(let i=0;i<6;i++){const a=i*Math.PI/3;cylinder(.011,.004,rubber,[x+side*.084,.255+Math.sin(a)*.091,z+Math.cos(a)*.091],[0,0,Math.PI/2]);}}
  for(let i=0;i<48;i++){const a=i*Math.PI/24,o=box(.092,.0025,.022,.0008,rubber,[x,.255+Math.cos(a)*.2455,z+Math.sin(a)*.2455]);o.rotation.x=a;}
  const parts=root.children.slice(before);for(const o of parts){axle.attach(o);}return axle;
 }
for(const side of[-1,1])tube([[side*.08,.26,-1.025],[side*.08,.58,-.98]],.012,chrome);
 wheel(0,-1.025);wheel(-.587,.97);wheel(.587,.97);
 const arch=(x,z,width,r,material)=>surface(48,8,(u,v)=>{const a=u*Math.PI;return[x+(v-.5)*width,.255+r*Math.sin(a),z+r*Math.cos(a)];},material);
 arch(0,-1.025,.265,.279,paint).material.side=THREE.DoubleSide;
 for(const side of[-1,1])arch(side*.592,.97,.155,.292,paint);
 box(.68,.043,.08,.013,frame,[0,.386,-1.29]);box(1.16,.072,.07,.018,frame,[0,.385,1.27]);
 // Open grille blades and a small original game badge, with no manufacturer marks.
 for(let y=.625;y<.73;y+=.024)box(.18,.008,.009,.002,frame,[0,y,nose(y)-.005]);
 for(let z=-.63;z<.43;z+=.095)box(.93,.003,.011,.001,frame,[0,.438,z]);
 for(const side of[-1,1]){
  cylinder(.016,.21,chrome,[side*.08,.395,-1.012]);
  tube(Array.from({length:65},(_,i)=>{const t=i/64,a=t*Math.PI*12;return[side*.08+.024*Math.cos(a),.37+t*.14,-1.012+.024*Math.sin(a)];}),.0035,frame);
 }
 const dial=cylinder(.039,.006,rubber,[0,1.112,-.696]);dial.rotation.x=.35;
 if(typeof document!=='undefined'){
  const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.clearRect(0,0,512,128);ctx.fillStyle='#534426';ctx.font='600 62px sans-serif';ctx.textAlign='center';ctx.fillText('MUD / C3',256,88);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
  const badge=add(new THREE.PlaneGeometry(.26,.065),new THREE.MeshStandardMaterial({map:texture,transparent:true,depthWrite:false,roughness:.8}),[0,.938,nose(.938)-.003],[0,Math.PI,0]);badge.name='Original Mud C3 badge';
 }

 const bodyBlack=paint.clone();bodyBlack.color.set('#262b29');root.traverse(o=>{if(!o.isMesh||o.material!==paint)return;o.geometry.computeBoundingBox();if(o.geometry.boundingBox.getCenter(new THREE.Vector3()).z+o.position.z>-.35)o.material=bodyBlack;});
 root.userData={assetType:'autorickshaw-prototype',reviewOnly:true,design:'Original Mud C3; generic three-wheeler construction, no manufacturer assets or badges',dimensions:{length:2.635,width:1.30,height:1.70},wheelCount:3};return root;
}
