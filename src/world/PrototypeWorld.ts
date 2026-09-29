import * as THREE from 'three';
import type { RideBounds } from '../player/MotorcycleController';

export type PrototypeWorld = {
  root: THREE.Group;
  bounds: RideBounds;
  obstacles: THREE.Box2[];
};

const asphalt = new THREE.MeshStandardMaterial({ color: 0x2f3235, roughness: 0.95 });
const concrete = new THREE.MeshStandardMaterial({ color: 0xc9c1ae, roughness: 0.88 });
const soil = new THREE.MeshStandardMaterial({ color: 0x8b6a43, roughness: 1 });
const grass = new THREE.MeshStandardMaterial({ color: 0x5f8d44, roughness: 1 });
const water = new THREE.MeshPhysicalMaterial({
  color: 0x168fa5,
  roughness: 0.18,
  metalness: 0.05,
  transmission: 0.04,
  transparent: true,
  opacity: 0.88,
});
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x76513a, roughness: 0.96 });
const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6b35, roughness: 0.88 });
const tileMat = new THREE.MeshStandardMaterial({ color: 0x9c4e35, roughness: 0.82 });

export function createPrototypeWorld(): PrototypeWorld {
  const root = new THREE.Group();
  const obstacles: THREE.Box2[] = [];

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), grass);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  addRoad(root, 0, -7, 12, 118);
  addRoad(root, 18, 17, 76, 10);
  addLaneMarks(root);
  addCanal(root, obstacles);
  addBridge(root);
  addRiceFields(root);
  addRestaurant(root, obstacles);
  addDestinationHouse(root, obstacles);
  addVillage(root, obstacles);
  addVegetation(root);
  addTraffic(root);
  addRoadFurniture(root);

  return {
    root,
    bounds: { minX: -66, maxX: 66, minZ: -66, maxZ: 66 },
    obstacles,
  };
}

function addRoad(root: THREE.Group, x: number, z: number, width: number, depth: number): void {
  const road = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, depth), asphalt);
  road.position.set(x, 0.04, z);
  road.receiveShadow = true;
  root.add(road);

  const curbWidth = 0.38;
  if (depth > width) {
    for (const side of [-1, 1]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(curbWidth, 0.22, depth), concrete);
      curb.position.set(x + side * (width / 2 + curbWidth / 2), 0.11, z);
      root.add(curb);
    }
  } else {
    for (const side of [-1, 1]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(width, 0.22, curbWidth), concrete);
      curb.position.set(x, 0.11, z + side * (depth / 2 + curbWidth / 2));
      root.add(curb);
    }
  }
}

function addLaneMarks(root: THREE.Group): void {
  const white = new THREE.MeshStandardMaterial({ color: 0xf6f2df, roughness: 0.7 });
  for (let z = -58; z < 50; z += 7) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.015, 3.2), white);
    dash.position.set(0, 0.09, z);
    root.add(dash);
  }
  for (let x = -12; x < 50; x += 7) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.015, 0.12), white);
    dash.position.set(x, 0.09, 17);
    root.add(dash);
  }
}

function addCanal(root: THREE.Group, obstacles: THREE.Box2[]): void {
  const canal = new THREE.Mesh(new THREE.BoxGeometry(15, 0.18, 120), water);
  canal.position.set(37, -0.18, 0);
  root.add(canal);

  for (const x of [28.8, 45.2]) {
    const bank = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 120), concrete);
    bank.position.set(x, 0.4, 0);
    bank.castShadow = true;
    bank.receiveShadow = true;
    root.add(bank);
  }

  obstacles.push(
    new THREE.Box2(new THREE.Vector2(29.5, -60), new THREE.Vector2(44.5, 11)),
    new THREE.Box2(new THREE.Vector2(29.5, 23), new THREE.Vector2(44.5, 60)),
  );
}

function addBridge(root: THREE.Group): void {
  const deck = new THREE.Mesh(new THREE.BoxGeometry(18, 0.5, 10), concrete);
  deck.position.set(37, 0.28, 17);
  deck.receiveShadow = true;
  deck.castShadow = true;
  root.add(deck);

  const road = new THREE.Mesh(new THREE.BoxGeometry(18, 0.1, 8.2), asphalt);
  road.position.set(37, 0.57, 17);
  root.add(road);

  for (const z of [12.7, 21.3]) {
    const rail = new THREE.Group();
    for (let x = 29; x <= 45; x += 2.4) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.1, 0.18), concrete);
      post.position.set(x, 1.05, z);
      rail.add(post);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(17.3, 0.16, 0.16), concrete);
    bar.position.set(37, 1.35, z);
    rail.add(bar);
    root.add(rail);
  }
}

function addRiceFields(root: THREE.Group): void {
  const riceMat = new THREE.MeshStandardMaterial({ color: 0x78a93f, roughness: 0.95 });
  for (let row = 0; row < 3; row++) {
    const patch = new THREE.Mesh(new THREE.BoxGeometry(18, 0.08, 16), riceMat);
    patch.position.set(56, 0.02, -30 + row * 19);
    root.add(patch);
    for (let i = 0; i < 40; i++) {
      const blade = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.04, 0.9, 5),
        new THREE.MeshStandardMaterial({ color: 0x87b848, roughness: 1 }),
      );
      blade.position.set(48 + (i % 8) * 2.1, 0.48, -37 + row * 19 + Math.floor(i / 8) * 2.5);
      root.add(blade);
    }
  }
}

function addRestaurant(root: THREE.Group, obstacles: THREE.Box2[]): void {
  const building = createHouse(8.5, 4.6, 7, 0xe4b56e);
  building.position.set(-10.5, 0, 8);
  root.add(building);
  addObstacle(obstacles, -10.5, 8, 8.5, 7, 0.7);

  const sign = createSignTexture('NAADAN HOTEL\nBIRIYANI • MEALS', '#8a2f24');
  const board = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.55), new THREE.MeshBasicMaterial({ map: sign }));
  board.position.set(-6.18, 2.65, 8);
  board.rotation.y = Math.PI / 2;
  root.add(board);

  for (let i = 0; i < 4; i++) {
    const planter = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.5, 10), soil);
    planter.position.set(-6.0, 0.25, 5.7 + i * 1.45);
    root.add(planter);
    const shrub = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), leafMat);
    shrub.position.set(-6.0, 0.8, 5.7 + i * 1.45);
    root.add(shrub);
  }
}

function addDestinationHouse(root: THREE.Group, obstacles: THREE.Box2[]): void {
  const house = createHouse(7.5, 4.2, 7, 0xf1d69a);
  house.position.set(24, 0, 25.5);
  root.add(house);
  addObstacle(obstacles, 24, 25.5, 7.5, 7, 0.8);

  const wall = new THREE.Mesh(new THREE.BoxGeometry(9.5, 1.05, 0.28), concrete);
  wall.position.set(24, 0.52, 21.9);
  root.add(wall);

  const gateGap = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.15, 0.32), asphalt);
  gateGap.position.set(24, 0.58, 21.88);
  root.add(gateGap);
}

function addVillage(root: THREE.Group, obstacles: THREE.Box2[]): void {
  const sites = [
    [-13, -38, 7.5, 6.5, 0xe6c48e],
    [12, -35, 7.0, 6.0, 0xdcb07e],
    [-13, -23, 8.0, 6.8, 0xe7d7aa],
    [13, -18, 7.4, 6.2, 0xcfd9b0],
    [-14, 27, 8.0, 7.0, 0xe0bc8c],
    [12, 34, 7.2, 6.4, 0xe8d5a4],
    [-17, 44, 8.4, 6.8, 0xd0d8c5],
  ] as const;

  sites.forEach(([x, z, w, d, color]) => {
    const house = createHouse(w, 3.8 + (Math.abs(z) % 3) * 0.35, d, color);
    house.position.set(x, 0, z);
    root.add(house);
    addObstacle(obstacles, x, z, w, d, 0.7);
  });
}

function createHouse(width: number, height: number, depth: number, color: number): THREE.Group {
  const group = new THREE.Group();
  const walls = new THREE.MeshStandardMaterial({ color, roughness: 0.82 });
  const shell = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), walls);
  shell.position.y = height / 2;
  shell.castShadow = true;
  shell.receiveShadow = true;
  group.add(shell);

  const roof = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.58, width * 0.58, 1.2, 4), tileMat);
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = depth / width;
  roof.position.y = height + 0.55;
  roof.castShadow = true;
  group.add(roof);

  const glass = new THREE.MeshPhysicalMaterial({ color: 0x7294a3, roughness: 0.12, transmission: 0.08 });
  for (const x of [-width * 0.23, width * 0.23]) {
    const window = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.1, 0.08), glass);
    window.position.set(x, 1.8, depth / 2 + 0.05);
    group.add(window);
  }

  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.72, 0.15, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x2f6c73, roughness: 0.74 }),
  );
  awning.position.set(0, 1.5, depth / 2 + 0.52);
  awning.rotation.x = -0.16;
  group.add(awning);
  return group;
}

function addVegetation(root: THREE.Group): void {
  const palms = [
    [-22,-47,1.1], [18,-44,1.0], [-23,-30,1.15], [21,-25,1.0], [-24,-8,1.1],
    [18,2,1.1], [-22,18,1.0], [20,28,1.15], [-24,41,1.0], [25,45,1.1],
    [49,-47,1.2], [52,-12,1.1], [50,26,1.2], [57,44,1.15],
  ] as const;
  palms.forEach(([x,z,s]) => {
    const palm = createPalm(s);
    palm.position.set(x,0,z);
    root.add(palm);
  });

  for (let i = 0; i < 22; i++) {
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.7 + (i % 3) * 0.18, 10, 8), leafMat);
    const side = i % 2 === 0 ? 1 : -1;
    bush.position.set(side * (7.4 + (i % 4) * 0.8), 0.55, -52 + i * 5);
    bush.scale.y = 0.8;
    bush.castShadow = true;
    root.add(bush);
  }
}

function createPalm(scale: number): THREE.Group {
  const palm = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 6.6, 12, 4), trunkMat);
  trunk.position.y = 3.3;
  trunk.castShadow = true;
  palm.add(trunk);

  for (let i = 0; i < 9; i++) {
    const leaf = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 2.6, 5, 10), leafMat);
    const a = (i / 9) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.25, 6.45, Math.sin(a) * 1.25);
    leaf.rotation.z = Math.PI / 2.65;
    leaf.rotation.y = -a;
    leaf.scale.set(0.72, 1, 0.2);
    leaf.castShadow = true;
    palm.add(leaf);
  }
  palm.scale.setScalar(scale);
  return palm;
}

function addTraffic(root: THREE.Group): void {
  const vehicles = [
    [2.4,-15,0xfff2df,1.0], [-2.3,-5,0x202020,0.9], [2.3,13,0xe9ecef,0.95],
    [-2.5,30,0x202020,0.9], [14,14.7,0x202020,0.9],
  ] as const;
  vehicles.forEach(([x,z,color,scale]) => {
    const auto = createAutoRickshaw(color);
    auto.position.set(x,0.05,z);
    auto.scale.setScalar(scale);
    root.add(auto);
  });

  const bus = createBus();
  bus.position.set(-2.6,0.05,-26);
  root.add(bus);
}

function createAutoRickshaw(color: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.1 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xe0a21b, roughness: 0.7 });
  const shell = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.65, 2.25), body);
  shell.position.y = 1.0;
  shell.castShadow = true;
  g.add(shell);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.16, 2.15), yellow);
  roof.position.y = 1.86;
  g.add(roof);
  return g;
}

function createBus(): THREE.Group {
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0xa63a32, roughness: 0.62, metalness: 0.08 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xe5d5b5, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.8, 6.8), red);
  body.position.y = 1.55;
  body.castShadow = true;
  g.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.64, 1.2, 6.84), cream);
  top.position.y = 2.35;
  g.add(top);
  return g;
}

function addRoadFurniture(root: THREE.Group): void {
  for (const [x,z] of [[-6.9,-35],[6.9,-20],[-6.9,-2],[6.9,33]] as const) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08,0.1,6.2,10),
      new THREE.MeshStandardMaterial({ color: 0x5e554b, roughness: 0.9 }),
    );
    pole.position.set(x,3.1,z);
    root.add(pole);
  }

  const signTex = createSignTexture('ALAPPUZHA ↑\nKAKKANAD →\nINFOPARK →', '#1b5d69');
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.5,3), new THREE.MeshBasicMaterial({ map: signTex }));
  sign.position.set(-8.3,2.7,-13);
  sign.rotation.y = Math.PI / 2;
  root.add(sign);
}

function createSignTexture(text: string, background: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);
  ctx.fillStyle = background;
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle = '#f1ead8';
  ctx.lineWidth = 8;
  ctx.strokeRect(8,8,496,240);
  ctx.fillStyle = '#fff8e8';
  ctx.font = '700 42px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = text.split('\n');
  lines.forEach((line, i) => ctx.fillText(line,256,72 + i * 62));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addObstacle(obstacles: THREE.Box2[], x: number, z: number, w: number, d: number, p: number): void {
  obstacles.push(new THREE.Box2(
    new THREE.Vector2(x - w / 2 - p, z - d / 2 - p),
    new THREE.Vector2(x + w / 2 + p, z + d / 2 + p),
  ));
}
