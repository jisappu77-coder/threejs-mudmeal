import * as THREE from 'three';

export function createPrototypeWorld(): THREE.Group {
  const world = new THREE.Group();

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ color: 0x6f8f58, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  world.add(ground);

  const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x3d3d3d, roughness: 0.95 });
  const roadA = new THREE.Mesh(new THREE.BoxGeometry(10, 0.05, 100), roadMaterial);
  roadA.position.y = 0.025;
  world.add(roadA);

  const roadB = new THREE.Mesh(new THREE.BoxGeometry(70, 0.05, 9), roadMaterial);
  roadB.position.set(18, 0.03, 17);
  world.add(roadB);

  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
  const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0xd8c9a5, roughness: 0.85 });
  const buildings = new THREE.InstancedMesh(buildingGeometry, buildingMaterial, 24);
  const matrix = new THREE.Matrix4();

  for (let i = 0; i < 24; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const z = -44 + Math.floor(i / 2) * 8;
    const height = 2.5 + (i % 4) * 0.55;
    matrix.compose(
      new THREE.Vector3(side * (8 + (i % 3) * 1.4), height / 2, z),
      new THREE.Quaternion(),
      new THREE.Vector3(5.5, height, 5.5),
    );
    buildings.setMatrixAt(i, matrix);
  }
  buildings.instanceMatrix.needsUpdate = true;
  world.add(buildings);

  return world;
}
