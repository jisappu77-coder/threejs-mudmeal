import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Use the official Three.js passes; no duplicate custom postprocessing pipeline.
export function setupGraphics(renderer,scene,camera){
 const target=new THREE.WebGLRenderTarget(innerWidth,innerHeight,{type:THREE.HalfFloatType,samples:Math.min(4,renderer.capabilities.maxSamples)});
 const composer=new EffectComposer(renderer,target);
 composer.setPixelRatio(Math.min(devicePixelRatio,innerHeight<600?1:1.4));
 const ao=new SSAOPass(scene,camera,innerWidth,innerHeight,innerHeight<600?12:24);
 // The reference camera is orthographic; the pass defaults to perspective depth.
 ao.ssaoMaterial.defines.PERSPECTIVE_CAMERA=0;
 ao.depthRenderMaterial.defines.PERSPECTIVE_CAMERA=0;
 ao.kernelRadius=.65;ao.minDistance=.00025;ao.maxDistance=.015;
 composer.addPass(new RenderPass(scene,camera));composer.addPass(ao);composer.addPass(new OutputPass());
 return {composer,render:()=>{ao.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);ao.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);composer.render()},resize:(w,h)=>composer.setSize(w,h),ao};
}
