import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';

export const crowdStyles=['collared','striped','casual','ponytail'];

export async function loadCrowd(){
 const {scene}=await new GLTFLoader().loadAsync(new URL('characters/crowd.glb',document.baseURI).href);
 const templates=crowdStyles.map(style=>scene.getObjectByName(style));
 if(templates.some(t=>!t))throw Error('Crowd asset is missing a clothing style');
 const palettes=['#ffffff','#dcc9b6','#98adb0','#cab098','#adb99b','#d6b6bb'];
 return function makeCharacter(variant=0,seated=false){
  const styleIndex=variant%templates.length,g=clone(templates[styleIndex]);
  const bones={},rest={},axisX={},axisY={},axisZ={};
  g.updateMatrixWorld(true);
  const jointNames=['pelvis','spine','neck','head','thigh_l','shin_l','foot_l','arm_l','forearm_l','hand_l','thigh_r','shin_r','foot_r','arm_r','forearm_r','hand_r'];
  g.traverse(o=>{
   if(o.isBone){
    // Blender suffixes duplicated datablock names; strip the numeric suffix.
    const name=o.name.replace(/_\d+$/, '').replace(/\.\d+$/, '');
    if(!jointNames.includes(name))return;
    bones[name]=o;rest[name]=o.quaternion.clone();
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
  const build=[1,.97,1.035][Math.floor(variant/4)%3];g.scale.x*=build;g.scale.z*=build;
  g.userData={...g.userData,variant,style:crowdStyles[styleIndex],seated,rigged:true};
  const q=new THREE.Quaternion();
  function turn(name,x=0,y=0,z=0){
   const bone=bones[name];bone.quaternion.copy(rest[name]);
   bone.quaternion.multiply(q.setFromAxisAngle(axisX[name],x));
   bone.quaternion.multiply(q.setFromAxisAngle(axisY[name],y));
   bone.quaternion.multiply(q.setFromAxisAngle(axisZ[name],z));
  }
  function animate(stride,time,walking,wave,sit=seated?1:0){
   turn('spine',sit*.05,0,walking?Math.sin(stride)*.012:Math.sin(time*.8)*.008);
   turn('head',0,Math.sin(time*.55+variant)*.1);
   for(const [i,side]of ['r','l'].entries()){
    const step=Math.sin(stride+i*Math.PI),bend=Math.max(0,-step);
    turn('thigh_'+side,-sit*Math.PI/2+(1-sit)*(walking?step*.3:0));
    turn('shin_'+side,sit*Math.PI/2+(1-sit)*(walking?bend*.48:0));
    turn('foot_'+side,(1-sit)*(walking?-bend*.2:0));
    turn('arm_'+side,-sit*.45+(1-sit)*(walking?-step*.23:Math.sin(time*1.2+i)*.018),0,i===1?wave*.95:0);
    turn('forearm_'+side,-sit*.95+(1-sit)*(-.05-wave*(i===1?.2:0)),0,i===1?wave*(1.35+Math.sin(time*6)*.1):0);
    turn('hand_'+side,i===1?-wave*.6:0);
   }
   g.updateMatrixWorld(true);
  }
  animate(0,0,false,0);
  if(seated){
   // Feet on the ground determine chair height from the actual bent mesh.
   g.position.y=-.4;g.updateMatrixWorld(true);
   g.position.y-=new THREE.Box3().setFromObject(g).min.y;
  }
  const restY=g.position.y;
  return {g,restY,animate,bones,style:crowdStyles[styleIndex]};
 };
}

export async function installCrowd(npcs){
 const makeCharacter=await loadCrowd();
 for(const n of npcs){
  n.g.remove(n.standing.g);if(n.sitting)n.g.remove(n.sitting.g);
  const seated=!!n.sitting;
  n.standing=makeCharacter(n.variant);n.g.add(n.standing.g);n.standing.g.visible=!seated;
  n.sitting=seated?makeCharacter(n.variant,true):null;if(n.sitting)n.g.add(n.sitting.g);
  Object.assign(n.g.userData,{designVersion:5,style:n.standing.style,rigged:true});
 }
 return makeCharacter;
}
