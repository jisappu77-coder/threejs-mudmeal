import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Isolated review asset. World NPC adoption is gated on visual approval.
export async function buildPerson() {
  const url = new URL('review/customer.glb', document.baseURI);
  const { scene } = await new GLTFLoader().loadAsync(url.href);
  scene.name = 'Textured customer prototype';
  scene.userData = { assetType: 'customer-prototype', reviewOnly: true,
    source: 'Authored MakeHuman CC0 body, clothing, hair, eyes and footwear' };
  scene.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = object.receiveShadow = true;
    const material = object.material;
    if (material.map) material.map.anisotropy = 8;
    if (material.name.startsWith('Short hair')) material.color.set('#5b524b');
    if (material.name.startsWith('Short hair') || material.name.startsWith('Eyebrows')) {
      material.side = THREE.DoubleSide;
      material.alphaTest = .2;
      material.alphaToCoverage = true;
      material.transparent = false;
      // Do not let thin alpha cards produce solid rectangular shadows.
      object.customDepthMaterial = new THREE.MeshDepthMaterial({
        depthPacking: THREE.RGBADepthPacking, map: material.map,
        alphaTest: .2, side: THREE.DoubleSide,
      });
    }
    if (material.name.startsWith('Brown eyes')) {
      material.color.set('#eee9df');
      material.roughness = .35;
      material.side = THREE.FrontSide;
      material.alphaTest = .35;
      material.transparent = false;
    }
  });
  return scene;
}
