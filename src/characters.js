import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';

export const crowdStyles=['collared','striped','casual','ponytail'];

export async function loadCrowd(){
 const {scene}=await new GLTFLoader().loadAsync(new URL('characters/crowd.glb',document.baseURI).href);
 const templates=crowdStyles.map(style=>scene.getObjectByName(style));
 if(templates.some(t=>!t))throw Error('Crowd asset is missing a clothing style');
 const palettes=['#ffffff','#dcc9b6','#98adb0','#cab098','#adb99b','#d6b6bb'];
 return function makeCharacter(variant=0,seated=false,shorts=false){
  const styleIndex=variant%templates.length,g=clone(templates[styleIndex]);
  const bones={},rest={},neutral={},axisX={},axisY={},axisZ={};
  g.updateMatrixWorld(true);
  const jointNames=['pelvis','spine','neck','head','thigh_l','shin_l','foot_l','arm_l','forearm_l','hand_l','thigh_r','shin_r','foot_r','arm_r','forearm_r','hand_r'];
  g.traverse(o=>{
   if(o.isBone){
    // Blender suffixes duplicated datablock names; strip the numeric suffix.
    const name=o.name.replace(/_\d+$/, '').replace(/\.\d+$/, '');
    if(!jointNames.includes(name))return;
    bones[name]=o;rest[name]=o.quaternion.clone();neutral[name]=g.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(o.getWorldQuaternion(new THREE.Quaternion()));
    const inverse=o.getWorldQuaternion(new THREE.Quaternion()).invert();
    axisX[name]=new THREE.Vector3(1,0,0).applyQuaternion(inverse);
    axisY[name]=new THREE.Vector3(0,1,0).applyQuaternion(inverse);
    axisZ[name]=new THREE.Vector3(0,0,1).applyQuaternion(inverse);
   }
   if(!o.isMesh)return;
   o.castShadow=o.receiveShadow=true;
   // Each person owns pigments; geometries and texture atlases stay shared.
   o.material=o.material.clone();const m=o.material;
   if(m.map)m.map.anisotropy=4;
   if(m.name.startsWith('Fabric')&&o.name.startsWith('Top'))m.color.set(palettes[Math.floor(variant/4)%palettes.length]);
   if(m.name.startsWith('Skin'))m.color.set(['#ffffff','#f4dec9','#bca496'][Math.floor(variant/3)%3]);
   if(m.name.startsWith('Short hair')||m.name.startsWith('Eyebrows')){
    if(m.name.startsWith('Short hair'))m.color.set(variant%11===8?'#b7b0aa':'#5b524b');
    m.side=THREE.DoubleSide;m.alphaTest=.2;m.alphaToCoverage=true;m.transparent=false;
    o.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:m.map,alphaTest:.2,side:THREE.DoubleSide});
   }
   if(m.name.startsWith('Brown eyes')){m.color.set('#eee9df');m.alphaTest=.35;m.transparent=false;m.side=THREE.FrontSide;}
  });
  for(const name of jointNames)if(!bones[name])throw Error('Missing customer joint: '+name);
  if(shorts){
   g.updateMatrixWorld(true);const point=new THREE.Vector3();g.traverse(o=>{if(!o.isSkinnedMesh||!o.name.startsWith('Trousers'))return;const geometry=o.geometry.clone(),indices=geometry.index.array,keep=[];for(let i=0;i<indices.length;i+=3){let height=0;for(let k=0;k<3;k++){point.fromBufferAttribute(geometry.attributes.position,indices[i+k]);o.applyBoneTransform(indices[i+k],point);height+=point.applyMatrix4(o.matrixWorld).y;}if(height/3>.62)keep.push(indices[i],indices[i+1],indices[i+2]);}geometry.setIndex(keep);geometry.computeBoundingBox();geometry.computeBoundingSphere();o.geometry=geometry;});
   const skin=new THREE.MeshStandardMaterial({color:'#b98b67',roughness:.9});for(const side of['l','r'])for(const [first,last,r0,r1]of[['thigh','shin',.07,.055],['shin','foot',.055,.038]]){const a=g.worldToLocal(bones[first+'_'+side].getWorldPosition(new THREE.Vector3())),b=g.worldToLocal(bones[last+'_'+side].getWorldPosition(new THREE.Vector3())),delta=b.clone().sub(a),leg=new THREE.Mesh(new THREE.CylinderGeometry(r1,r0,delta.length(),12),skin);leg.position.copy(a.add(b).multiplyScalar(.5));leg.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());leg.castShadow=leg.receiveShadow=true;g.add(leg);bones[first+'_'+side].attach(leg);}
  }
  const build=[1,.97,1.035][Math.floor(variant/4)%3];g.scale.x*=build;g.scale.z*=build;
  g.userData={...g.userData,variant,style:crowdStyles[styleIndex],seated,rigged:true};
  const q=new THREE.Quaternion();
  function turn(name,x=0,y=0,z=0){
   const bone=bones[name];bone.quaternion.copy(rest[name]);
   bone.quaternion.multiply(q.setFromAxisAngle(axisX[name],x));
   bone.quaternion.multiply(q.setFromAxisAngle(axisY[name],y));
   bone.quaternion.multiply(q.setFromAxisAngle(axisZ[name],z));
  }
  const pelvisRest=bones.pelvis.position.clone();
  const ankles=Object.fromEntries(['l','r'].map(side=>[side,g.worldToLocal(bones['foot_'+side].getWorldPosition(new THREE.Vector3()))]));
  // Solve the existing two-bone limbs against contact points, keeping their real lengths.
  function reach(first,middle,end,target,pole){
   g.updateMatrixWorld(true);
   const a=bones[first],b=bones[middle],c=bones[end];
   const start=a.getWorldPosition(new THREE.Vector3()),joint=b.getWorldPosition(new THREE.Vector3()),tip=c.getWorldPosition(new THREE.Vector3());
   const goal=g.localToWorld(target.clone()),direction=goal.clone().sub(start),upper=start.distanceTo(joint),lower=joint.distanceTo(tip);
   const distance=THREE.MathUtils.clamp(direction.length(),.001,upper+lower-.001);direction.normalize();
   const bend=g.localToWorld(pole.clone()).sub(start);bend.addScaledVector(direction,-bend.dot(direction)).normalize();
   const along=(upper*upper+distance*distance-lower*lower)/(2*distance);
   const elbow=start.clone().addScaledVector(direction,along).addScaledVector(bend,Math.sqrt(Math.max(0,upper*upper-along*along)));
   function aim(bone,child,point){
    const origin=bone.getWorldPosition(new THREE.Vector3()),inverse=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    const from=child.getWorldPosition(new THREE.Vector3()).sub(origin).normalize().applyQuaternion(inverse);
    const to=point.clone().sub(origin).normalize().applyQuaternion(inverse);
    bone.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(from,to));g.updateMatrixWorld(true);
   }
   aim(a,b,elbow);aim(b,c,goal);
  }
  function animate(stride,time,walking,wave,sit=seated?1:0){
   const walk=Number(walking)*(1-sit);
   bones.pelvis.position.copy(pelvisRest);bones.pelvis.position.y-=walk*(.045+.008*Math.cos(stride*2));
   turn('pelvis',0,walk*Math.sin(stride)*.025,walk*Math.cos(stride)*.018);
   turn('spine',sit*.05,0,walking?Math.sin(stride)*.012:Math.sin(time*.8)*.008);
   turn('head',0,Math.sin(time*.55+variant)*.1);
   for(const [i,side]of ['r','l'].entries()){
    const step=Math.sin(stride+i*Math.PI),bend=Math.max(0,-step);
    const phase=THREE.MathUtils.euclideanModulo(stride/(Math.PI*2)+i*.5,1),stance=phase<.6;
    const t=stance?phase/.6:(phase-.6)/.4,eased=t*t*(3-2*t);
    const footTravel=stance?.2356*(1-2*t):.2356*(2*eased-1);
    turn('thigh_'+side,-sit*Math.PI/2+(1-sit)*(walking?step*.3*walk:0));
    turn('shin_'+side,sit*Math.PI/2+(1-sit)*(walking?bend*.48*walk:0));
    turn('foot_'+side,(1-sit)*(walking?-bend*.2:0));
    turn('arm_'+side,-sit*.45+(1-sit)*(walking?footTravel/.2356*.23*walk:Math.sin(time*1.2+i)*.018),0,i===1?wave*.95:0);
    turn('forearm_'+side,-sit*.95+(1-sit)*(-.05-wave*(i===1?.2:0)),0,i===1?wave*(1.35+Math.sin(time*6)*.1):0);
    turn('hand_'+side,i===1?-wave*.6:0);
    if(walk>0){
     const foot=ankles[side].clone();foot.z+=walk*footTravel;
     foot.y+=walk*(stance?0:.09*Math.sin(Math.PI*t));
     reach('thigh_'+side,'shin_'+side,'foot_'+side,foot,new THREE.Vector3(foot.x,.5,1));
     // Keep shoes level while the swing foot lifts clear of the ground.
     const rotation=bones['foot_'+side].parent.getWorldQuaternion(new THREE.Quaternion()).invert();
     bones['foot_'+side].quaternion.copy(rotation.multiply(g.getWorldQuaternion(new THREE.Quaternion())).multiply(neutral['foot_'+side]));
    }
   }
   g.updateMatrixWorld(true);
  }
  animate(0,0,false,0);
  if(seated){
   // Feet on the ground determine chair height from the actual bent mesh.
   g.position.y=-.4;g.updateMatrixWorld(true);
   g.position.y-=new THREE.Box3().setFromObject(g).min.y;
  }
  function ride(){
   const widthScale=g.userData.riderWidthScale||1;
   animate(0,0,false,0);
   turn('pelvis',.32);turn('spine',.5);turn('neck',-.35);turn('head',-.35);
   for(const [side,sign]of [['l',1],['r',-1]]){
    reach('thigh_'+side,'shin_'+side,'foot_'+side,new THREE.Vector3(sign*.285/widthScale,.368,.0155),new THREE.Vector3(sign*.35,.8,.65));
    reach('arm_'+side,'forearm_'+side,'hand_'+side,new THREE.Vector3(sign*.249/widthScale,.8844,.5636),new THREE.Vector3(sign*.42,1.18,.3));
    bones['foot_'+side].quaternion.copy(bones['foot_'+side].parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(g.getWorldQuaternion(new THREE.Quaternion())).multiply(neutral['foot_'+side]));
   }
   g.updateMatrixWorld(true);
  }
  const restY=g.position.y;
  return {g,restY,animate,ride,bones,style:crowdStyles[styleIndex]};
 };
}

export async function installCrowd(npcs,bikes=[]){
 const makeCharacter=await loadCrowd();
 for(const n of npcs){
  n.g.remove(n.standing.g);if(n.sitting)n.g.remove(n.sitting.g);
  const seated=!!n.sitting;
  n.standing=makeCharacter(n.variant);n.g.add(n.standing.g);n.standing.g.visible=!seated;
  n.sitting=seated?makeCharacter(n.variant,true):null;if(n.sitting)n.g.add(n.sitting.g);
  Object.assign(n.g.userData,{designVersion:5,style:n.standing.style,rigged:true});
 }
 for(const [i,bike]of bikes.entries()){
  const old=bike.children.find(o=>o.userData.personRig);if(old)bike.remove(old);
  const rider=makeCharacter(i*4);rider.g.rotation.y=Math.PI;rider.g.position.set(0,.075,.11);bike.add(rider.g);
  rider.g.userData.personRig=true;bike.rider=rider;bike.userData.riggedRider=true;
  const helmet=new THREE.Mesh(new THREE.SphereGeometry(.125,24,16,0,Math.PI*2,0,Math.PI*.58),new THREE.MeshStandardMaterial({color:i?'#343a42':'#e9a13c',roughness:.38}));
  helmet.position.set(0,1.675,.038);helmet.scale.set(1,1,1.12);helmet.castShadow=true;rider.g.add(helmet);rider.g.updateMatrixWorld(true);rider.bones.head.attach(helmet);rider.ride();
 }
 return makeCharacter;
}
