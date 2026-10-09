import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

export function createFinish(renderer,scene,camera,sky){
 const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:4}),composer=new EffectComposer(renderer,target);composer.setPixelRatio(1);composer.addPass(new RenderPass(scene,camera));
 const ao=new GTAOPass(scene,camera,512,512,undefined,{radius:.55,thickness:.12,samples:12,distanceFallOff:.8},{samples:8,radius:4});ao.blendIntensity=.75;
 // Preserve leaf silhouettes in the depth/normal buffer. Solid card rectangles would
 // otherwise cast artificial contact shading around every transparent leaf sprite.
 const white=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);white.needsUpdate=true;
 const normalShader=THREE.ShaderLib.normal,uniforms=THREE.UniformsUtils.clone(normalShader.uniforms);Object.assign(uniforms,{leafMap:{value:white},leafCutoff:{value:0},leafTransform:{value:new THREE.Matrix3()}});
 ao.normalMaterial=new THREE.ShaderMaterial({uniforms,side:THREE.DoubleSide,blending:THREE.NoBlending,vertexShader:normalShader.vertexShader.replace('void main() {','varying vec2 leafUV;\nuniform mat3 leafTransform;\nvoid main() {\n leafUV=(leafTransform*vec3(uv,1.0)).xy;'),fragmentShader:normalShader.fragmentShader.replace('void main() {','varying vec2 leafUV;\nuniform sampler2D leafMap;\nuniform float leafCutoff;\nvoid main() {\n if(leafCutoff>0.0 && texture2D(leafMap,leafUV).a<leafCutoff)discard;')});
 const renderAO=ao.render.bind(ao);ao.render=(...args)=>{const hidden=[];scene.traverse(o=>{
  if(o.visible&&(o===sky||o.isSprite||o.isMesh&&o.material.transparent)){hidden.push(o);o.visible=false}
  if(o.isMesh&&!o.userData.normalHook){const before=o.onBeforeRender;o.onBeforeRender=function(...args){before.apply(this,args);if(args[4]!==ao.normalMaterial)return;const map=this.material.map;map?.updateMatrix();uniforms.leafMap.value=map||white;uniforms.leafCutoff.value=this.material.alphaTest||0;uniforms.leafTransform.value.copy(map?.matrix||new THREE.Matrix3());ao.normalMaterial.uniformsNeedUpdate=true;};o.userData.normalHook=true;}
 });try{renderAO(...args)}finally{hidden.forEach(o=>o.visible=true)}};
 composer.addPass(ao);composer.addPass(new OutputPass());renderer.info.autoReset=false;let width=0,height=0;
 return {resize(w,h){if(w===width&&h===height)return;width=w;height=h;composer.setSize(w,h);const scale=Math.min(1,1024/w);ao.setSize(Math.round(w*scale),Math.round(h*scale));ao.enabled=w>900;},setAOIntensity(v){ao.blendIntensity=v;},render(){renderer.info.reset();composer.render();}};
}
