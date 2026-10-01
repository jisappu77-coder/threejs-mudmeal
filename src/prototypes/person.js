import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// The CC0 anatomical topology replaces the former ellipsoid head and separate stick limbs.
export function buildPerson(data){
 const root=new THREE.Group();root.name='Anatomical customer prototype';
 const original=data.positions.map(p=>new THREE.Vector3(...p));
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(original.flatMap(p=>p.toArray()),3));
 const triangles=[];for(const f of data.faces)for(let i=1;i<f.length-1;i++)triangles.push(f[0],f[i],f[i+1]);geo.setIndex(triangles);geo.computeVertexNormals();
 const minY=Math.min(...data.positions.map(p=>p[1])),maxY=Math.max(...data.positions.map(p=>p[1]));
 const normals=geo.attributes.normal,scale=1.73/(maxY-minY),positions=[];
 const materialFor=p=>Math.abs(p.x)>2.7&&p.y<4.25?0:p.y< -7.25?3:p.y<.85?2:(p.y<5.65&&!(Math.abs(p.x)<.65&&p.y>5.12)&&(Math.abs(p.x)<2.1||p.y>4.25))?1:0;
 const faceKinds=data.faces.map(f=>materialFor(f.reduce((c,i)=>c.add(original[i]),new THREE.Vector3()).multiplyScalar(1/f.length)));
 const kinds=original.map(()=>new Set());data.faces.forEach((f,i)=>f.forEach(v=>kinds[v].add(faceKinds[i])));
 // Put garment boundaries onto smooth cut planes instead of painting whole jagged face rows.
 for(let i=0;i<original.length;i++){const p=original[i],k=kinds[i];if(k.has(1)&&k.has(2))p.y=.85;
  if(k.has(0)&&k.has(1)){if(Math.abs(p.x)<1.2&&p.y>4.6)p.y=5.12+Math.abs(p.x)*.43;else{const side=Math.sign(p.x),a=new THREE.Vector3(side*1.677,5.245,.146),axis=new THREE.Vector3(side*1.453,-1.752,-.015).normalize();p.addScaledVector(axis,1.00-p.clone().sub(a).dot(axis));}}
 }
 // Pose the anatomical A-pose down into a relaxed stance while preserving the original hands.
 for(let i=0;i<original.length;i++){
  const p=original[i].clone(),n=new THREE.Vector3().fromBufferAttribute(normals,i),kind=materialFor(p);
  if(kind===1||kind===2)p.addScaledVector(n,kind===1?.095:.13);
  if(kind===1&&Math.abs(p.x)<1.7&&p.z>.8)p.z=.8+(p.z-.8)*.55;
  const side=Math.sign(p.x),a=new THREE.Vector3(side*1.677,5.245,.146),b=new THREE.Vector3(side*3.13,3.493,.131),c=new THREE.Vector3(side*4.312,2.452,1.756);
  const targetB=new THREE.Vector3(side*2.22,3.03,.30),targetC=new THREE.Vector3(side*2.18,.61,.60);
  if(((Math.abs(p.x)>2.7&&p.y>-.7)||(Math.abs(p.x)>1.50&&p.y>2.5))&&p.y<5.8){
   const upper=b.clone().sub(a),lower=c.clone().sub(b),q1=new THREE.Quaternion().setFromUnitVectors(upper.clone().normalize(),targetB.clone().sub(a).normalize()),q2=new THREE.Quaternion().setFromUnitVectors(lower.clone().normalize(),targetC.clone().sub(targetB).normalize());
   const t=THREE.MathUtils.clamp(p.clone().sub(b).dot(lower)/lower.lengthSq()*4+.25,0,1),upperPose=p.clone().sub(a).applyQuaternion(q1).add(a),lowerPose=p.clone().sub(b).applyQuaternion(q2).add(targetB);
   const weight=THREE.MathUtils.smoothstep(Math.abs(p.x),1.5,2.0);p.lerp(upperPose.lerp(lowerPose,t),weight);
  }
  if(p.y<.85)p.x-=Math.sign(p.x)*THREE.MathUtils.smoothstep(.85-p.y,0,7)*.90;
  // Millimetre garment folds, not inflated limb joints.
  if(kind===1||kind===2){const fold=.018*Math.sin(p.y*6+p.x*4)*Math.sin(p.z*7+p.y*2);p.addScaledVector(n,fold);}
  p.multiplyScalar(scale);p.y-=minY*scale;positions.push(p.toArray());
 }
 const skin=new THREE.MeshPhysicalMaterial({color:'#986344',roughness:.60,clearcoat:.06,clearcoatRoughness:.55});
 const shirt=new THREE.MeshStandardMaterial({color:'#4e7475',roughness:.94}),pants=new THREE.MeshStandardMaterial({color:'#383b3e',roughness:.95}),shoe=new THREE.MeshStandardMaterial({color:'#352b25',roughness:.82});
 skin.userData.surface='skin';shirt.userData.surface='cloth';pants.userData.surface='cloth';
 const body=new THREE.BufferGeometry();body.setAttribute('position',new THREE.Float32BufferAttribute(positions.flat(),3));body.setAttribute('uv',new THREE.Float32BufferAttribute(positions.flatMap(p=>[p[0]*3,p[1]*3]),2));
 const indices=[];let groupStart=0,last=-1;for(let fi=0;fi<data.faces.length;fi++){const f=data.faces[fi],kind=faceKinds[fi];if(kind!==last){if(last>=0)body.addGroup(groupStart,indices.length-groupStart,last);groupStart=indices.length;last=kind;}for(let i=1;i<f.length-1;i++)indices.push(f[0],f[i],f[i+1]);}body.addGroup(groupStart,indices.length-groupStart,last);body.setIndex(indices);body.computeVertexNormals();
 const mesh=new THREE.Mesh(body,[skin,shirt,pants,shoe]);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
 const add=(g,m,p)=>{const o=new THREE.Mesh(g,m);o.position.set(...p);o.castShadow=true;root.add(o);return o;};
 const eyeWhite=new THREE.MeshPhysicalMaterial({color:'#c9c3b1',roughness:.24,clearcoat:.7}),iris=new THREE.MeshPhysicalMaterial({color:'#30251b',roughness:.32,clearcoat:.65}),pupil=new THREE.MeshStandardMaterial({color:'#080807',roughness:.20});
 for(const center of data.eyes){const [x,y,z]=[center[0]*scale,(center[1]-minY)*scale,center[2]*scale];add(new THREE.SphereGeometry(.145*scale,48,32),eyeWhite,[x,y,z]);add(new THREE.SphereGeometry(.057*scale,32,24),iris,[x,y,z+.137*scale]).scale.z=.14;add(new THREE.SphereGeometry(.024*scale,24,20),pupil,[x,y,z+.146*scale]).scale.z=.13;}
 // Scalp follows the actual skull topology, with a short textured hair silhouette.
 const hairIndices=[];for(const f of data.faces){const c=f.reduce((p,i)=>p.add(original[i]),new THREE.Vector3()).multiplyScalar(1/f.length);if(c.y>7.77||(c.y>7.10&&c.z<.70))for(let i=1;i<f.length-1;i++)hairIndices.push(f[0],f[i],f[i+1]);}
 const hairGeo=body.clone();hairGeo.clearGroups();hairGeo.setIndex(hairIndices);const hp=hairGeo.attributes.position;for(let i=0;i<hp.count;i++){const n=new THREE.Vector3().fromBufferAttribute(body.attributes.normal,i),p=new THREE.Vector3().fromBufferAttribute(hp,i);p.addScaledVector(n,.0025+.0015*Math.sin(i*1.73));hp.setXYZ(i,p.x,p.y,p.z);}hairGeo.computeVertexNormals();const boundary=new Map();for(let i=0;i<hairIndices.length;i+=3)for(let j=0;j<3;j++){const a=hairIndices[i+j],b=hairIndices[i+(j+1)%3],key=a<b?a+','+b:b+','+a;boundary.set(key,(boundary.get(key)||0)+1);}const neighbors=new Map();for(const [edge,count]of boundary)if(count===1){const [a,b]=edge.split(',').map(Number);(neighbors.get(a)||neighbors.set(a,[]).get(a)).push(b);(neighbors.get(b)||neighbors.set(b,[]).get(b)).push(a);}for(let iteration=0;iteration<4;iteration++){const updates=[];for(const [i,ns]of neighbors){const p=new THREE.Vector3().fromBufferAttribute(hp,i).multiplyScalar(.5);for(const j of ns)p.addScaledVector(new THREE.Vector3().fromBufferAttribute(hp,j),.5/ns.length);updates.push([i,p]);}for(const [i,p]of updates)hp.setXYZ(i,p.x,p.y,p.z);}hairGeo.computeVertexNormals();
 const hair=new THREE.Mesh(hairGeo,new THREE.MeshStandardMaterial({color:'#211c18',roughness:.85,side:THREE.DoubleSide}));hair.castShadow=true;root.add(hair);
 // Real-sized shirt closures and a thin stitched placket.
 for(let y=1.02;y<1.40;y+=.07){const front=positions.filter(p=>Math.abs(p[0])<.04&&Math.abs(p[1]-y)<.03);const z=front.length?Math.max(...front.map(p=>p[2]))+.002:.11;add(new THREE.SphereGeometry(.0032,20,12),new THREE.MeshStandardMaterial({color:'#b2b1a5',roughness:.8}),[0,y,z]);}
 // Closed shoes cover the anatomical toe mesh and have separate rubber soles.
 const leather=new THREE.MeshPhysicalMaterial({color:'#40362c',roughness:.58,clearcoat:.14}),sole=new THREE.MeshStandardMaterial({color:'#252723',roughness:.98});
 for(const side of[-1,1]){const foot=positions.filter((p,i)=>original[i].y<-7.25&&Math.sign(original[i].x)===side),b=new THREE.Box3().setFromPoints(foot.map(p=>new THREE.Vector3(...p))),size=b.getSize(new THREE.Vector3()),center=b.getCenter(new THREE.Vector3());const width=size.x+.014,length=size.z+.025;add(new RoundedBoxGeometry(width,.024,length,5,.010),sole,[center.x,.009,center.z]);const upper=add(new THREE.SphereGeometry(1,48,32),leather,[center.x,.055,center.z]);upper.scale.set(width*.51,.063,length*.51);for(let i=0;i<3;i++){const lace=add(new RoundedBoxGeometry(width*.58,.002,.003,2,.001),sole,[center.x,.111-i*.003,center.z+.024-i*.021]);lace.rotation.y=.10;}}
 root.userData={assetType:'customer-prototype',source:'MakeHuman CC0 anatomical base',reviewOnly:true};return root;
}
