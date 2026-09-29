import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { RideBounds } from '../player/MotorcycleController';

export type HighFidelityWorld = {
  root: THREE.Group;
  bounds: RideBounds;
  obstacles: THREE.Box2[];
};

const MAX_ANISO = 8;
const gltfLoader = new GLTFLoader();
const modelCache = new Map<string, Promise<THREE.Group>>();

function spawnModel(
  root: THREE.Group,
  relativePath: string,
  position: THREE.Vector3,
  scale = 1,
  rotationY = 0,
  fallback?: () => THREE.Object3D,
): void {
  const url = `${import.meta.env.BASE_URL}models/${relativePath}`;
  let pending = modelCache.get(url);
  if (!pending) {
    pending = gltfLoader.loadAsync(url).then(({ scene }) => scene);
    modelCache.set(url, pending);
  }

  pending
    .then((source) => {
      const model = source.clone(true);
      const container = new THREE.Group();

      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.castShadow = true;
        object.receiveShadow = true;

        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (material instanceof THREE.MeshStandardMaterial) {
            material.envMapIntensity = 1.2;
            material.roughness = THREE.MathUtils.clamp(material.roughness, 0.28, 0.88);
            material.metalness = THREE.MathUtils.clamp(material.metalness, 0, 0.45);
          }
        }
      });

      fitToGameplaySize(model, targetSizeFor(relativePath) * scale);
      container.position.copy(position);
      container.rotation.y = rotationY;
      container.add(model);
      root.add(container);
    })
    .catch((error: unknown) => {
      console.warn(`Failed to load GLB: ${relativePath}; using fallback.`, error);
      if (!fallback) return;
      const object = fallback();
      object.position.copy(position);
      object.rotation.y = rotationY;
      object.scale.multiplyScalar(scale);
      root.add(object);
    });
}

function targetSizeFor(relativePath: string): number {
  if (relativePath.includes('ksrtc-bus')) return 7.6;
  if (relativePath.includes('auto-rickshaw')) return 2.6;
  if (relativePath.includes('coconut-palm')) return 8.2;
  if (relativePath.includes('utility-pole')) return 7.4;
  if (relativePath.includes('kerala-shop')) return 8.2;
  if (relativePath.includes('kerala-house')) return 8.4;
  return 5;
}

function fitToGameplaySize(object: THREE.Object3D, targetMaxDimension: number): void {
  object.updateMatrixWorld(true);
  const initialBox = new THREE.Box3().setFromObject(object);
  const size = initialBox.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);

  if (Number.isFinite(maxDimension) && maxDimension > 0.0001) {
    object.scale.setScalar(targetMaxDimension / maxDimension);
  }

  object.updateMatrixWorld(true);
  const fittedBox = new THREE.Box3().setFromObject(object);
  const center = fittedBox.getCenter(new THREE.Vector3());

  object.position.x -= center.x;
  object.position.z -= center.z;
  object.position.y -= fittedBox.min.y;
}

export function createHighFidelityWorld(): HighFidelityWorld {
  const root = new THREE.Group();
  const obstacles: THREE.Box2[] = [];

  const textures = createTextures();
  const mat = createMaterials(textures);

  addTerrain(root, mat);
  addRoadNetwork(root, mat);
  addCanal(root, mat, obstacles);
  addBridge(root, mat);
  addRiceFields(root, mat);
  addRestaurant(root, mat, obstacles);
  addDestination(root, mat, obstacles);
  addVillage(root, mat, obstacles);
  addVegetation(root, mat);
  addTraffic(root, mat);
  addStreetDetails(root, mat);

  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.castShadow = obj.castShadow || false;
    obj.receiveShadow = true;
  });

  return {
    root,
    bounds: { minX: -66, maxX: 66, minZ: -66, maxZ: 66 },
    obstacles,
  };
}

type Materials = ReturnType<typeof createMaterials>;

function createTextures() {
  const asphalt = noiseTexture(1024, '#45484b', 30, 0.22);
  asphalt.repeat.set(12, 48);

  const plaster = noiseTexture(512, '#d9bf88', 24, 0.12);
  plaster.repeat.set(3, 3);

  const concrete = noiseTexture(512, '#b9b2a6', 22, 0.12);
  concrete.repeat.set(4, 10);

  const roof = tileTexture();
  roof.repeat.set(4, 4);

  const water = waterTexture();
  water.repeat.set(4, 18);

  const soil = noiseTexture(512, '#7d6040', 36, 0.18);
  soil.repeat.set(5, 5);

  return { asphalt, plaster, concrete, roof, water, soil };
}

function createMaterials(t: ReturnType<typeof createTextures>) {
  const asphalt = new THREE.MeshStandardMaterial({
    color: 0x5a5a58,
    map: t.asphalt,
    bumpMap: t.asphalt,
    bumpScale: 0.06,
    roughness: 0.92,
  });

  const concrete = new THREE.MeshStandardMaterial({
    color: 0xcac0ae,
    map: t.concrete,
    bumpMap: t.concrete,
    bumpScale: 0.045,
    roughness: 0.88,
  });

  const soil = new THREE.MeshStandardMaterial({
    color: 0x8f704b,
    map: t.soil,
    roughness: 1,
  });

  const grass = new THREE.MeshStandardMaterial({
    color: 0x5d913f,
    roughness: 0.96,
  });

  const leaf = new THREE.MeshPhysicalMaterial({
    color: 0x2f7434,
    roughness: 0.62,
    sheen: 0.2,
    sheenColor: new THREE.Color(0x8fbd73),
    sheenRoughness: 0.75,
  });

  const leafBright = new THREE.MeshPhysicalMaterial({
    color: 0x72ad43,
    roughness: 0.6,
    sheen: 0.24,
    sheenColor: new THREE.Color(0xb4d47a),
    sheenRoughness: 0.72,
  });

  const trunk = new THREE.MeshStandardMaterial({
    color: 0x72503a,
    roughness: 0.94,
  });

  const roof = new THREE.MeshStandardMaterial({
    color: 0xa84f34,
    map: t.roof,
    bumpMap: t.roof,
    bumpScale: 0.12,
    roughness: 0.73,
  });

  const water = new THREE.MeshPhysicalMaterial({
    color: 0x1d9fb7,
    map: t.water,
    bumpMap: t.water,
    bumpScale: 0.19,
    roughness: 0.08,
    metalness: 0,
    transmission: 0.16,
    thickness: 0.85,
    transparent: true,
    opacity: 0.9,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.35,
  });

  const roadPaint = new THREE.MeshStandardMaterial({
    color: 0xf6f2df,
    roughness: 0.68,
  });

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x89b6c3,
    roughness: 0.05,
    metalness: 0.05,
    transmission: 0.18,
    transparent: true,
    opacity: 0.78,
    clearcoat: 1,
  });

  const dark = new THREE.MeshStandardMaterial({
    color: 0x171b1b,
    roughness: 0.58,
    metalness: 0.12,
  });

  const metal = new THREE.MeshStandardMaterial({
    color: 0x697173,
    roughness: 0.34,
    metalness: 0.72,
  });

  return {
    asphalt, concrete, soil, grass, leaf, leafBright, trunk, roof, water,
    roadPaint, glass, dark, metal,
  };
}

function addTerrain(root: THREE.Group, m: Materials): void {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(150, 150, 8, 8), m.grass);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  for (const [x, z, w, d] of [
    [-32, -16, 38, 125],
    [58, 0, 20, 125],
  ] as const) {
    const patch = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), m.soil);
    patch.position.set(x, -0.03, z);
    root.add(patch);
  }
}

function addRoadNetwork(root: THREE.Group, m: Materials): void {
  addRoad(root, m, 0, -8, 13.5, 122, true);
  addRoad(root, m, 19, 17, 79, 11.5, false);

  for (let z = -62; z <= 48; z += 7.2) {
    laneDash(root, m, 0, z, 0.16, 3.7);
  }
  for (let x = -14; x <= 49; x += 7.2) {
    laneDash(root, m, x, 17, 3.7, 0.16);
  }

  for (const x of [-6.7, 6.7]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 119), m.roadPaint);
    edge.position.set(x, 0.125, -8);
    root.add(edge);
  }
}

function addRoad(
  root: THREE.Group,
  m: Materials,
  x: number,
  z: number,
  width: number,
  depth: number,
  vertical: boolean,
): void {
  const road = new THREE.Mesh(new THREE.BoxGeometry(width, 0.11, depth), m.asphalt);
  road.position.set(x, 0.055, z);
  road.receiveShadow = true;
  root.add(road);

  const curbMat = m.concrete;
  if (vertical) {
    for (const side of [-1, 1]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, depth), curbMat);
      curb.position.set(x + side * (width / 2 + 0.27), 0.14, z);
      curb.castShadow = true;
      root.add(curb);

      const walk = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.16, depth), curbMat);
      walk.position.set(x + side * (width / 2 + 1.6), 0.08, z);
      root.add(walk);
    }
  } else {
    for (const side of [-1, 1]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(width, 0.28, 0.55), curbMat);
      curb.position.set(x, 0.14, z + side * (depth / 2 + 0.27));
      curb.castShadow = true;
      root.add(curb);
    }
  }
}

function laneDash(root: THREE.Group, m: Materials, x: number, z: number, w: number, d: number): void {
  const dash = new THREE.Mesh(new THREE.BoxGeometry(w, 0.025, d), m.roadPaint);
  dash.position.set(x, 0.125, z);
  root.add(dash);
}

function addCanal(root: THREE.Group, m: Materials, obstacles: THREE.Box2[]): void {
  const channel = new THREE.Mesh(new THREE.BoxGeometry(18, 0.45, 124), m.water);
  channel.position.set(38, -0.28, 0);
  root.add(channel);

  for (const x of [28.6, 47.4]) {
    const bank = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.3, 124), m.concrete);
    bank.position.set(x, 0.35, 0);
    bank.castShadow = true;
    root.add(bank);
  }

  const lilyMat = new THREE.MeshStandardMaterial({ color: 0x4e8c42, roughness: 0.76 });
  for (let i = 0; i < 20; i++) {
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.42 + (i % 3) * 0.11, 28), lilyMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(32 + (i % 5) * 2.4, 0.01, -46 + Math.floor(i / 5) * 27);
    root.add(pad);
  }

  obstacles.push(
    new THREE.Box2(new THREE.Vector2(29.3, -62), new THREE.Vector2(46.7, 11.2)),
    new THREE.Box2(new THREE.Vector2(29.3, 22.8), new THREE.Vector2(46.7, 62)),
  );
}

function addBridge(root: THREE.Group, m: Materials): void {
  const deck = new THREE.Mesh(new THREE.BoxGeometry(20, 0.75, 11.7), m.concrete);
  deck.position.set(38, 0.3, 17);
  deck.castShadow = true;
  root.add(deck);

  const road = new THREE.Mesh(new THREE.BoxGeometry(20, 0.14, 9.4), m.asphalt);
  road.position.set(38, 0.71, 17);
  root.add(road);

  for (const z of [11.55, 22.45]) {
    for (let x = 29.5; x <= 46.5; x += 2.1) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.35, 0.34), m.concrete);
      post.position.set(x, 1.38, z);
      post.castShadow = true;
      root.add(post);
    }
    for (const y of [1.25, 1.78]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(18.2, 0.16, 0.18), m.concrete);
      rail.position.set(38, y, z);
      root.add(rail);
    }
  }
}

function addRiceFields(root: THREE.Group, m: Materials): void {
  for (let row = 0; row < 3; row++) {
    const field = new THREE.Mesh(
      new THREE.BoxGeometry(17.5, 0.13, 16.3),
      new THREE.MeshStandardMaterial({ color: row % 2 ? 0x79a943 : 0x89b64a, roughness: 0.94 }),
    );
    field.position.set(58, 0.02, -31 + row * 19);
    root.add(field);

    const geom = new THREE.CylinderGeometry(0.018, 0.04, 0.95, 8);
    const rice = new THREE.InstancedMesh(geom, m.leafBright, 72);
    const dummy = new THREE.Object3D();
    let n = 0;
    for (let rz = 0; rz < 8; rz++) {
      for (let rx = 0; rx < 9; rx++) {
        dummy.position.set(50.8 + rx * 1.75, 0.53, -37.6 + row * 19 + rz * 1.85);
        dummy.rotation.y = ((rx * 13 + rz * 7) % 17) * 0.04;
        dummy.scale.setScalar(0.82 + ((rx + rz) % 4) * 0.07);
        dummy.updateMatrix();
        rice.setMatrixAt(n++, dummy.matrix);
      }
    }
    rice.castShadow = true;
    root.add(rice);
  }
}

function addRestaurant(root: THREE.Group, m: Materials, obstacles: THREE.Box2[]): void {
  spawnModel(
    root,
    'world/kerala-shop.glb',
    new THREE.Vector3(-11.1, 0, 8.3),
    1.35,
    0.02,
    () => createBuilding(m, 7.0, 3.5, 5.8, 0xe8bf78, true),
  );
  addObstacle(obstacles, -11.1, 8.3, 9.7, 8.2, 0.65);

  const sign = signMesh('അച്ചായൻസ്\nHOTEL', '#963a2b', 6.6, 1.65);
  sign.position.set(-6.17, 3.12, 8.3);
  sign.rotation.y = Math.PI / 2;
  root.add(sign);

  const awning = stripedAwning(4.4, 1.55);
  awning.position.set(-5.86, 1.95, 9.2);
  awning.rotation.y = Math.PI / 2;
  root.add(awning);

  for (let i = 0; i < 4; i++) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.5, 24), m.soil);
    pot.position.set(-5.95, 0.35, 5.55 + i * 1.7);
    root.add(pot);
    const shrub = new THREE.Mesh(new THREE.SphereGeometry(0.43, 20, 14), i % 2 ? m.leafBright : m.leaf);
    shrub.position.set(-5.95, 0.9, 5.55 + i * 1.7);
    shrub.castShadow = true;
    root.add(shrub);
  }

  for (let i = 0; i < 3; i++) {
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 24), woodMaterial());
    table.position.set(-5.55, 0.84, 5.7 + i * 1.55);
    root.add(table);
  }
}

function addDestination(root: THREE.Group, m: Materials, obstacles: THREE.Box2[]): void {
  spawnModel(
    root,
    'world/kerala-house.glb',
    new THREE.Vector3(23.4, 0, 28.2),
    1.06,
    0,
    () => createBuilding(m, 8.2, 4.2, 7.1, 0xf2d797, false),
  );
  addObstacle(obstacles, 23.4, 28.2, 8.4, 7.8, 0.75);

  for (const z of [23.8, 32.3]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(11.2, 1.1, 0.34), m.concrete);
    wall.position.set(23.4, 0.55, z);
    root.add(wall);
  }

  const pin = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 32, 20),
    new THREE.MeshPhysicalMaterial({ color: 0x11c8e8, emissive: 0x0f95a8, emissiveIntensity: 0.5, clearcoat: 1 }),
  );
  pin.position.set(23.4, 7.2, 28.2);
  pin.castShadow = true;
  root.add(pin);
}

function addVillage(root: THREE.Group, m: Materials, obstacles: THREE.Box2[]): void {
  const sites = [
    [-16,-45,8.4,7.2,0xe9c58d], [14,-43,7.7,6.5,0xe5ba80],
    [-17,-28,8.7,7.5,0xf0d7a6], [15,-23,8.1,6.8,0xd7dfb9],
    [-17,31,8.8,7.2,0xe6bd86], [13,39,7.9,6.8,0xead5a4],
    [-18,50,8.8,7.4,0xd8ddcd],
  ] as const;

  for (const [x, z, w, d, c] of sites) {
    const scale = w / 8.2;
    spawnModel(
      root,
      'world/kerala-house.glb',
      new THREE.Vector3(x, 0, z),
      scale,
      ((x + z) % 7) * 0.015,
      () => createBuilding(m, 8.2, 4.2, 7.1, c, false),
    );
    addObstacle(obstacles, x, z, w, d, 0.7);
  }

  spawnModel(
    root,
    'world/kerala-shop.glb',
    new THREE.Vector3(12.5, 0, 7.4),
    0.92,
    0,
    () => createBuilding(m, 7.0, 3.5, 5.8, 0xe6b66d, true),
  );
  addObstacle(obstacles, 12.5, 7.4, 6.4, 5.2, 0.6);

  const snackSign = signMesh('CHAYA CHAYA\nSNACKS • MEALS', '#263235', 3.6, 2.3);
  snackSign.position.set(9.25, 2.2, 7.5);
  snackSign.rotation.y = Math.PI / 2;
  root.add(snackSign);
}

function createBuilding(
  m: Materials,
  width: number,
  height: number,
  depth: number,
  color: number,
  shopfront: boolean,
): THREE.Group {
  const g = new THREE.Group();
  const wallMat = mConcreteTint(m, color);
  const shell = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth, 2, 2, 2), wallMat);
  shell.position.y = height / 2;
  shell.castShadow = true;
  g.add(shell);

  const roof = new THREE.Group();
  const roofPlane = new THREE.Mesh(new THREE.BoxGeometry(width * 1.12, 0.28, depth * 0.68), m.roof);
  roofPlane.rotation.x = 0.42;
  roofPlane.position.set(0, height + 0.62, depth * 0.22);
  roofPlane.castShadow = true;
  roof.add(roofPlane);
  const roofPlane2 = roofPlane.clone();
  roofPlane2.rotation.x = -0.42;
  roofPlane2.position.z = -depth * 0.22;
  roof.add(roofPlane2);
  g.add(roof);

  const trim = new THREE.Mesh(new THREE.BoxGeometry(width * 0.96, 0.18, 0.16), m.concrete);
  trim.position.set(0, height - 0.35, depth / 2 + 0.08);
  g.add(trim);

  for (const x of [-width * 0.27, width * 0.27]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.38, 1.48, 0.14), m.dark);
    frame.position.set(x, height * 0.48, depth / 2 + 0.075);
    g.add(frame);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.25), m.glass);
    glass.position.set(x, height * 0.48, depth / 2 + 0.16);
    g.add(glass);
  }

  const door = new THREE.Mesh(new THREE.BoxGeometry(1.25, 2.1, 0.16), m.dark);
  door.position.set(0, 1.05, depth / 2 + 0.08);
  g.add(door);

  if (shopfront) {
    const awning = stripedAwning(width * 0.78, 1.15);
    awning.position.set(0, height * 0.42, depth / 2 + 0.58);
    g.add(awning);
  }

  return g;
}

function addVegetation(root: THREE.Group, m: Materials): void {
  const palmSites = [
    [-26,-50,1.12], [20,-48,1.0], [-25,-34,1.15], [22,-28,1.02],
    [-25,-10,1.08], [20,1,1.1], [-25,17,1.04], [22,31,1.16],
    [-26,45,1.04], [25,49,1.1], [51,-48,1.2], [52,-12,1.1],
    [51,28,1.18], [60,46,1.15],
  ] as const;

  for (const [x, z, scale] of palmSites) {
    const rotation = ((x * 13 + z * 7) % 360) * Math.PI / 180;
    spawnModel(
      root,
      'world/coconut-palm.glb',
      new THREE.Vector3(x, 0, z),
      scale,
      rotation,
      () => createPalm(m, 1),
    );
  }

  for (let i = 0; i < 34; i++) {
    const bush = new THREE.Mesh(
      new THREE.SphereGeometry(0.72 + (i % 4) * 0.13, 20, 14),
      i % 3 ? m.leaf : m.leafBright,
    );
    const side = i % 2 === 0 ? 1 : -1;
    bush.position.set(side * (8.4 + (i % 5) * 0.62), 0.62, -56 + i * 3.45);
    bush.scale.y = 0.78;
    bush.castShadow = true;
    root.add(bush);
  }
}

function createPalm(m: Materials, scale: number): THREE.Group {
  const g = new THREE.Group();

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.38, 7.3, 24, 8), m.trunk);
  trunk.position.y = 3.65;
  trunk.rotation.z = 0.035;
  trunk.castShadow = true;
  g.add(trunk);

  const crown = new THREE.Group();
  crown.position.y = 7.1;
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    const frond = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 2.7, 8, 18), i % 2 ? m.leaf : m.leafBright);
    frond.position.set(Math.cos(a) * 1.2, -0.15, Math.sin(a) * 1.2);
    frond.rotation.set(Math.PI / 2.7, -a, Math.PI / 2);
    frond.scale.set(0.72, 1.06, 0.22);
    frond.castShadow = true;
    crown.add(frond);
  }
  g.add(crown);
  g.scale.setScalar(scale);
  return g;
}

function addTraffic(root: THREE.Group, m: Materials): void {
  const autos = [
    [2.55,-12,0.05], [-2.6,-1,0.02], [2.55,13,-0.02], [-2.6,31,0.03],
    [13.5,14.6,Math.PI / 2],
  ] as const;
  for (const [x, z, rotation] of autos) {
    spawnModel(
      root,
      'world/auto-rickshaw.glb',
      new THREE.Vector3(x, 0.12, z),
      1,
      rotation,
      () => createRickshaw(m),
    );
  }

  spawnModel(
    root,
    'world/ksrtc-bus.glb',
    new THREE.Vector3(-2.9, 0.12, -27),
    1,
    0,
    () => createBus(m),
  );

  const car = createCar(m, 0xdde7ec);
  car.position.set(2.5, 0.12, -41);
  root.add(car);
}

function createRickshaw(m: Materials): THREE.Group {
  const g = new THREE.Group();
  const yellow = new THREE.MeshPhysicalMaterial({ color: 0xe7a51b, roughness: 0.42, metalness: 0.15, clearcoat: 0.7 });
  const black = new THREE.MeshStandardMaterial({ color: 0x181a19, roughness: 0.7 });

  const lower = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.78, 2.42), yellow);
  lower.position.y = 0.76;
  lower.castShadow = true;
  g.add(lower);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.52, 1.2, 1.8), black);
  cabin.position.set(0, 1.55, -0.1);
  cabin.castShadow = true;
  g.add(cabin);

  const wind = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.74), m.glass);
  wind.position.set(0, 1.72, 0.82);
  wind.rotation.x = -0.04;
  g.add(wind);

  addVehicleWheels(g, 0.36, 0.13, 0.78, 0.88);
  return g;
}

function createBus(m: Materials): THREE.Group {
  const g = new THREE.Group();
  const red = new THREE.MeshPhysicalMaterial({ color: 0xb33a32, roughness: 0.4, metalness: 0.12, clearcoat: 0.55 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xe9dcc1, roughness: 0.68 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.9, 2.8, 7.6), red);
  body.position.y = 1.65;
  body.castShadow = true;
  g.add(body);

  const upper = new THREE.Mesh(new THREE.BoxGeometry(2.94, 1.2, 7.64), cream);
  upper.position.y = 2.45;
  g.add(upper);

  for (const z of [-2.7, -1.45, -0.2, 1.05, 2.3]) {
    for (const x of [-1.48, 1.48]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.78), m.glass);
      w.position.set(x, 2.48, z);
      w.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(w);
    }
  }

  const label = signMesh('KSRTC', '#b33a32', 2.0, 0.52);
  label.position.set(0, 1.35, 3.82);
  g.add(label);

  addVehicleWheels(g, 0.48, 0.17, 1.3, 2.45);
  return g;
}

function createCar(m: Materials, color: number): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, metalness: 0.18, clearcoat: 1, clearcoatRoughness: 0.12 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.68, 3.1), bodyMat);
  body.position.y = 0.72;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.78, 1.65), m.glass);
  cabin.position.set(0, 1.36, -0.12);
  g.add(cabin);
  addVehicleWheels(g, 0.34, 0.12, 0.79, 1.0);
  return g;
}

function addVehicleWheels(g: THREE.Group, radius: number, tube: number, x: number, z: number): void {
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0d0e0e, roughness: 0.96 });
  const wheelGeo = new THREE.TorusGeometry(radius, tube, 14, 28);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const wheel = new THREE.Mesh(wheelGeo, rubber);
      wheel.rotation.y = Math.PI / 2;
      wheel.position.set(sx * x, radius + 0.1, sz * z);
      wheel.castShadow = true;
      g.add(wheel);
    }
  }
}

function addStreetDetails(root: THREE.Group, m: Materials): void {
  const poleSites = [[-8.2,-38],[8.2,-22],[-8.2,-3],[8.2,34],[27,4],[49,6]] as const;
  const poles: THREE.Vector3[] = [];

  for (const [x, z] of poleSites) {
    spawnModel(
      root,
      'world/utility-pole.glb',
      new THREE.Vector3(x, 0, z),
      1,
      0,
      () => {
        const group = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 7.4, 18), m.metal);
        pole.position.y = 3.7;
        pole.castShadow = true;
        group.add(pole);
        return group;
      },
    );
    poles.push(new THREE.Vector3(x, 6.6, z));
  }

  for (let i = 0; i < poles.length - 1; i++) {
    addWire(root, poles[i], poles[i + 1]);
  }

  const roadSign = signMesh('Ernakulam ↑\nKakkanad →\nInfopark →', '#226878', 4.6, 3.15);
  roadSign.position.set(-8.75, 3.0, -14.5);
  roadSign.rotation.y = Math.PI / 2;
  root.add(roadSign);

  const poster = signMesh('GOOD\nFOOD\nHAPPIER\nPEOPLE', '#e5dfcf', 2.3, 3.4, '#24302c');
  poster.position.set(27.8, 2.3, 4.5);
  poster.rotation.y = -Math.PI / 2;
  root.add(poster);

  for (const [x, z] of [[-7.8,5.4],[-7.8,11.6],[29.5,29.3],[47,34]] as const) {
    const planter = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.55, 24), m.soil);
    planter.position.set(x, 0.33, z);
    root.add(planter);
    const plant = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 14), m.leafBright);
    plant.position.set(x, 0.92, z);
    plant.scale.y = 0.8;
    plant.castShadow = true;
    root.add(plant);
  }
}

function addWire(root: THREE.Group, a: THREE.Vector3, b: THREE.Vector3): void {
  const mid = a.clone().lerp(b, 0.5);
  mid.y -= 0.65;
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  const geo = new THREE.TubeGeometry(curve, 18, 0.025, 6, false);
  const wire = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x262827, roughness: 0.8 }));
  root.add(wire);
}

function stripedAwning(width: number, depth: number): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const c = canvas.getContext('2d');
  if (c) {
    for (let i = 0; i < 10; i++) {
      c.fillStyle = i % 2 ? '#f3e9ce' : '#2d7d87';
      c.fillRect(i * 52, 0, 54, 128);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = MAX_ANISO;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.12, depth),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.76 }),
  );
  mesh.rotation.x = -0.17;
  mesh.castShadow = true;
  return mesh;
}

function signMesh(
  text: string,
  background: string,
  width: number,
  height: number,
  foreground = '#fff7e7',
): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const c = canvas.getContext('2d');
  if (c) {
    c.fillStyle = background;
    c.fillRect(0, 0, 1024, 512);
    c.strokeStyle = 'rgba(255,255,255,.35)';
    c.lineWidth = 12;
    c.strokeRect(14, 14, 996, 484);
    const lines = text.split('\n');
    c.fillStyle = foreground;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `800 ${Math.max(64, 155 - lines.length * 15)}px system-ui, sans-serif`;
    lines.forEach((line, i) => c.fillText(line, 512, 256 + (i - (lines.length - 1) / 2) * 115));
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = MAX_ANISO;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: tex, transparent: false }),
  );
}

function mConcreteTint(m: Materials, color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    map: m.concrete.map,
    bumpMap: m.concrete.bumpMap,
    bumpScale: 0.035,
    roughness: 0.82,
  });
}

function woodMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0x744b2f, roughness: 0.78 });
}

function noiseTexture(size: number, base: string, variance: number, alpha: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const c = canvas.getContext('2d');
  if (c) {
    c.fillStyle = base;
    c.fillRect(0, 0, size, size);
    for (let i = 0; i < size * 2.2; i++) {
      const v = 128 + (((i * 47) % 101) - 50) * variance / 50;
      c.fillStyle = `rgba(${v},${v},${v},${alpha})`;
      const r = 0.7 + ((i * 31) % 8) * 0.25;
      c.fillRect((i * 97) % size, (i * 193) % size, r, r);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = MAX_ANISO;
  return tex;
}

function tileTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const c = canvas.getContext('2d');
  if (c) {
    c.fillStyle = '#a44d34';
    c.fillRect(0, 0, 512, 512);
    c.strokeStyle = 'rgba(72,28,18,.42)';
    c.lineWidth = 5;
    for (let y = 0; y < 512; y += 64) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(512, y);
      c.stroke();
      const offset = (y / 64) % 2 ? 32 : 0;
      for (let x = offset; x < 512; x += 64) {
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x, y + 64);
        c.stroke();
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = MAX_ANISO;
  return tex;
}

function waterTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const c = canvas.getContext('2d');
  if (c) {
    const g = c.createLinearGradient(0, 0, 512, 512);
    g.addColorStop(0, '#1b9db2');
    g.addColorStop(0.5, '#35b9c6');
    g.addColorStop(1, '#16889f');
    c.fillStyle = g;
    c.fillRect(0, 0, 512, 512);
    c.strokeStyle = 'rgba(255,255,255,.13)';
    c.lineWidth = 3;
    for (let i = 0; i < 36; i++) {
      c.beginPath();
      const y = (i * 41) % 512;
      c.moveTo(0, y);
      c.bezierCurveTo(150, y + 16, 330, y - 14, 512, y + 5);
      c.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = MAX_ANISO;
  return tex;
}

function addObstacle(
  obstacles: THREE.Box2[],
  x: number,
  z: number,
  w: number,
  d: number,
  padding: number,
): void {
  obstacles.push(new THREE.Box2(
    new THREE.Vector2(x - w / 2 - padding, z - d / 2 - padding),
    new THREE.Vector2(x + w / 2 + padding, z + d / 2 + padding),
  ));
}
