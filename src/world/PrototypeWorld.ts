import * as THREE from 'three';
import type { RideBounds } from '../player/MotorcycleController';

export type PrototypeWorld = {
  root: THREE.Group;
  bounds: RideBounds;
  obstacles: THREE.Box2[];
};

const wallPalette = [0xe3d2b4, 0xd9b38c, 0xc9d7c0, 0xd8c9a5, 0xc7d5df];
const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x7f4f3f, roughness: 0.92 });
const trimMaterial = new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 0.7 });
const glassMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x6f8793,
  roughness: 0.18,
  metalness: 0,
  transmission: 0.08,
  transparent: true,
  opacity: 0.82,
});
const asphaltMaterial = new THREE.MeshStandardMaterial({ color: 0x303235, roughness: 0.96 });
const curbMaterial = new THREE.MeshStandardMaterial({ color: 0xc9c5ba, roughness: 0.9 });
const lineMaterial = new THREE.MeshStandardMaterial({ color: 0xf1d76b, roughness: 0.75 });
const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x775239, roughness: 1 });
const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x315f3a, roughness: 0.9 });

export function createPrototypeWorld(): PrototypeWorld {
  const root = new THREE.Group();
  const obstacles: THREE.Box2[] = [];

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 140),
    new THREE.MeshStandardMaterial({ color: 0x64845a, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  addRoad(root, 0, 0, 10, 108);
  addRoad(root, 18, 17, 72, 9);
  addRoadDetails(root);

  for (let i = 0; i < 18; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const laneIndex = Math.floor(i / 2);
    const z = -42 + laneIndex * 10;
    const x = side * (10.5 + (laneIndex % 2) * 1.5);
    const width = 6 + (laneIndex % 3) * 0.6;
    const depth = 6.5;
    const height = 3.4 + (i % 4) * 0.7;

    const building = createBuilding(i, width, height, depth);
    building.position.set(x, 0, z);
    root.add(building);

    const padding = 0.8;
    obstacles.push(
      new THREE.Box2(
        new THREE.Vector2(x - width / 2 - padding, z - depth / 2 - padding),
        new THREE.Vector2(x + width / 2 + padding, z + depth / 2 + padding),
      ),
    );
  }

  for (const [x, z, scale] of [
    [-21, -34, 1.1], [20, -28, 1.0], [-24, -12, 0.9], [24, 1, 1.15],
    [-22, 25, 1.0], [29, 34, 1.1], [38, 14, 0.9], [45, 22, 1.0],
  ] as const) {
    const tree = createPalm(scale);
    tree.position.set(x, 0, z);
    root.add(tree);
  }

  const busStop = createBusStop();
  busStop.position.set(7.3, 0, -13);
  root.add(busStop);

  return {
    root,
    bounds: { minX: -64, maxX: 64, minZ: -64, maxZ: 64 },
    obstacles,
  };
}

function addRoad(root: THREE.Group, x: number, z: number, width: number, depth: number): void {
  const road = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, depth), asphaltMaterial);
  road.position.set(x, 0.04, z);
  road.receiveShadow = true;
  root.add(road);

  const curbThickness = 0.32;
  if (depth > width) {
    for (const side of [-1, 1]) {
      const curb = new THREE.Mesh(
        new THREE.BoxGeometry(curbThickness, 0.2, depth),
        curbMaterial,
      );
      curb.position.set(x + side * (width / 2 + curbThickness / 2), 0.1, z);
      curb.receiveShadow = true;
      root.add(curb);
    }
  } else {
    for (const side of [-1, 1]) {
      const curb = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.2, curbThickness),
        curbMaterial,
      );
      curb.position.set(x, 0.1, z + side * (depth / 2 + curbThickness / 2));
      curb.receiveShadow = true;
      root.add(curb);
    }
  }
}

function addRoadDetails(root: THREE.Group): void {
  for (let z = -48; z <= 48; z += 7) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.015, 3.2), lineMaterial);
    line.position.set(0, 0.09, z);
    root.add(line);
  }

  for (let x = -12; x <= 48; x += 7) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.015, 0.12), lineMaterial);
    line.position.set(x, 0.09, 17);
    root.add(line);
  }
}

function createBuilding(index: number, width: number, height: number, depth: number): THREE.Group {
  const building = new THREE.Group();
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: wallPalette[index % wallPalette.length],
    roughness: 0.82,
  });

  const shell = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMaterial);
  shell.position.y = height / 2;
  shell.castShadow = true;
  shell.receiveShadow = true;
  building.add(shell);

  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.35, 0.16, depth + 0.35),
    trimMaterial,
  );
  slab.position.y = height + 0.08;
  slab.castShadow = true;
  building.add(slab);

  const roofHeight = 1.15;
  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(width * 0.56, width * 0.56, roofHeight, 4),
    roofMaterial,
  );
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = depth / width;
  roof.position.y = height + roofHeight * 0.48;
  roof.castShadow = true;
  building.add(roof);

  const floors = Math.max(1, Math.floor(height / 2.6));
  for (let floor = 0; floor < floors; floor += 1) {
    const y = 1.25 + floor * 2.2;
    for (const side of [-1, 1]) {
      const windowMesh = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.05, 0.08), glassMaterial);
      windowMesh.position.set(side * width * 0.24, y, depth / 2 + 0.045);
      building.add(windowMesh);
    }
  }

  const shopFront = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.62, 1.35, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x4b5962, roughness: 0.45, metalness: 0.1 }),
  );
  shopFront.position.set(0, 0.8, depth / 2 + 0.065);
  building.add(shopFront);

  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.72, 0.12, 1.05),
    new THREE.MeshStandardMaterial({
      color: index % 2 === 0 ? 0xa63732 : 0x2b6a7b,
      roughness: 0.75,
    }),
  );
  awning.position.set(0, 1.75, depth / 2 + 0.45);
  awning.rotation.x = -0.15;
  awning.castShadow = true;
  building.add(awning);

  return building;
}

function createPalm(scale: number): THREE.Group {
  const palm = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.36, 5.8, 12, 4),
    trunkMaterial,
  );
  trunk.position.y = 2.9;
  trunk.rotation.z = 0.04;
  trunk.castShadow = true;
  palm.add(trunk);

  for (let i = 0; i < 8; i += 1) {
    const leaf = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.18, 2.4, 5, 10),
      leafMaterial,
    );
    const angle = (i / 8) * Math.PI * 2;
    leaf.position.set(Math.cos(angle) * 1.15, 5.75, Math.sin(angle) * 1.15);
    leaf.rotation.z = Math.PI / 2.8;
    leaf.rotation.y = -angle;
    leaf.scale.set(0.65, 1, 0.22);
    leaf.castShadow = true;
    palm.add(leaf);
  }

  palm.scale.setScalar(scale);
  return palm;
}

function createBusStop(): THREE.Group {
  const stop = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x59656b, roughness: 0.5, metalness: 0.35 });

  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 1.7), metal);
  roof.position.y = 2.5;
  roof.castShadow = true;
  stop.add(roof);

  for (const x of [-1.45, 1.45]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.5, 10), metal);
    post.position.set(x, 1.25, -0.62);
    stop.add(post);
  }

  const bench = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 0.15, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x7a513b, roughness: 0.85 }),
  );
  bench.position.set(0, 0.7, -0.25);
  bench.castShadow = true;
  stop.add(bench);

  return stop;
}
