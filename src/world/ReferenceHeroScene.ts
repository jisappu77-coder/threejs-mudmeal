import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { RideBounds } from '../player/MotorcycleController';
import { createHighFidelityWorld } from './HighFidelityWorld';

export type ReferenceHeroScene = {
  root: THREE.Group;
  bounds: RideBounds;
  obstacles: THREE.Box2[];
};

const loader = new GLTFLoader();
const cache = new Map<string, Promise<THREE.Group>>();

const ROAD_POINTS = [
  new THREE.Vector3(0, 0.18, -58),
  new THREE.Vector3(-1.5, 0.18, -46),
  new THREE.Vector3(-3.8, 0.18, -34),
  new THREE.Vector3(-4.8, 0.18, -21),
  new THREE.Vector3(-2.0, 0.18, -8),
  new THREE.Vector3(2.0, 0.18, 2),
  new THREE.Vector3(5.5, 0.18, 9),
  new THREE.Vector3(11, 0.18, 14),
  new THREE.Vector3(19, 0.18, 17),
  new THREE.Vector3(28, 0.18, 17),
  new THREE.Vector3(38, 0.74, 17),
  new THREE.Vector3(32, 0.2, 22),
  new THREE.Vector3(24, 0.2, 27),
];

export function createReferenceHeroScene(): ReferenceHeroScene {
  const base = createHighFidelityWorld();
  const root = new THREE.Group();
  root.add(base.root);

  addCurvedHeroRoad(root);
  addRoute(root);
  addRivalBikes(root);
  addHeroTraffic(root);
  addHeroVegetation(root);
  addRiceFieldFences(root);
  addCanalProps(root);
  addRestaurantLife(root);
  addDestinationLife(root);
  addBridgeFlowers(root);
  addFieldDetails(root);

  return {
    root,
    bounds: base.bounds,
    obstacles: base.obstacles,
  };
}

function addCurvedHeroRoad(root: THREE.Group): void {
  const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x3b3d3f, roughness: 0.92 });
  const curbMaterial = new THREE.MeshStandardMaterial({ color: 0xd7d0c1, roughness: 0.88 });
  const paintMaterial = new THREE.MeshStandardMaterial({ color: 0xf5f1df, roughness: 0.72 });

  const curve = new THREE.CatmullRomCurve3(ROAD_POINTS, false, 'centripetal');
  const samples = 92;
  const halfWidth = 5.6;

  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    const left = p.clone().addScaledVector(side, halfWidth);
    const right = p.clone().addScaledVector(side, -halfWidth);

    positions.push(left.x, p.y + 0.05, left.z, right.x, p.y + 0.05, right.z);

    if (i < samples) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const road = new THREE.Mesh(geometry, roadMaterial);
  road.receiveShadow = true;
  root.add(road);

  const curbGeo = new THREE.BoxGeometry(0.34, 0.25, 1.5);
  const dashGeo = new THREE.BoxGeometry(0.13, 0.035, 2.4);
  const curbCount = 48;
  const leftCurbs = new THREE.InstancedMesh(curbGeo, curbMaterial, curbCount);
  const rightCurbs = new THREE.InstancedMesh(curbGeo, curbMaterial, curbCount);
  const dashes = new THREE.InstancedMesh(dashGeo, paintMaterial, 24);
  const dummy = new THREE.Object3D();

  for (let i = 0; i < curbCount; i++) {
    const t = i / (curbCount - 1);
    const p = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const angle = Math.atan2(tangent.x, tangent.z);

    dummy.position.copy(p).addScaledVector(side, halfWidth + 0.2);
    dummy.position.y += 0.16;
    dummy.rotation.set(0, angle, 0);
    dummy.updateMatrix();
    leftCurbs.setMatrixAt(i, dummy.matrix);

    dummy.position.copy(p).addScaledVector(side, -(halfWidth + 0.2));
    dummy.position.y += 0.16;
    dummy.rotation.set(0, angle, 0);
    dummy.updateMatrix();
    rightCurbs.setMatrixAt(i, dummy.matrix);
  }

  for (let i = 0; i < 24; i++) {
    const t = 0.015 + i / 25;
    const p = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    dummy.position.copy(p);
    dummy.position.y += 0.11;
    dummy.rotation.set(0, Math.atan2(tangent.x, tangent.z), 0);
    dummy.updateMatrix();
    dashes.setMatrixAt(i, dummy.matrix);
  }

  leftCurbs.castShadow = rightCurbs.castShadow = true;
  root.add(leftCurbs, rightCurbs, dashes);
}

function addRoute(root: THREE.Group): void {
  const curve = new THREE.CatmullRomCurve3(ROAD_POINTS.slice(2), false, 'centripetal');
  const material = new THREE.MeshBasicMaterial({
    color: 0x10d9f4,
    transparent: true,
    opacity: 0.95,
  });

  for (let i = 0; i < 38; i++) {
    const t = i / 37;
    const p = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();

    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.72, 3), material);
    arrow.rotation.x = Math.PI / 2;
    arrow.rotation.z = Math.atan2(tangent.x, tangent.z);
    arrow.position.copy(p);
    arrow.position.y += 0.14;
    root.add(arrow);
  }
}

function addRivalBikes(root: THREE.Group): void {
  const rivals = [
    [new THREE.Vector3(-2.0, 0.45, -41.5), 0xd93025],
    [new THREE.Vector3(1.3, 0.45, -45.2), 0x7138c7],
  ] as const;

  for (const [position, color] of rivals) {
    spawn(root, 'delivery-bike.glb', position, 2.15, 0, (model) => tintModel(model, color));
    addMarker(root, position.clone().add(new THREE.Vector3(0, 3.0, 0)), color);
  }
}

function addHeroTraffic(root: THREE.Group): void {
  const autos = [
    [-2.9, -29, 0.02],
    [1.9, -20, -0.02],
    [-2.1, -8, 0.02],
    [2.7, 4, -0.02],
    [7.5, 12.5, Math.PI / 5],
  ] as const;

  for (const [x, z, r] of autos) {
    spawn(root, 'world/auto-rickshaw.glb', new THREE.Vector3(x, 0.05, z), 2.55, r);
  }

  spawn(root, 'world/ksrtc-bus.glb', new THREE.Vector3(-3.7, 0.06, -18), 7.7, 0.03);
}

function addHeroVegetation(root: THREE.Group): void {
  const palms = [
    [-24,-47,1.05], [-22,-31,1.12], [-20,-12,1.08], [-18,4,1.12], [-15,18,1.0],
    [16,-41,1.02], [18,-25,1.08], [20,-7,1.08], [22,4,1.1], [26,14,1.05],
    [31,29,1.08], [47,28,1.12], [51,12,1.05], [55,-8,1.1], [49,-26,1.06],
  ] as const;

  for (const [x, z, s] of palms) {
    spawn(root, 'world/coconut-palm.glb', new THREE.Vector3(x, 0, z), 8.2 * s, ((x + z) % 9) * 0.08);
  }
}

function addRestaurantLife(root: THREE.Group): void {
  const skin = new THREE.MeshStandardMaterial({ color: 0xa86d46, roughness: 0.95 });
  const clothes = [
    new THREE.MeshStandardMaterial({ color: 0x2777a8, roughness: 0.82 }),
    new THREE.MeshStandardMaterial({ color: 0xe2b34a, roughness: 0.82 }),
    new THREE.MeshStandardMaterial({ color: 0x8f3d2f, roughness: 0.82 }),
  ];

  const people = [
    [-5.5, 6.2, 0],
    [-5.3, 8.4, 1],
    [-5.7, 10.2, 2],
    [8.9, 7.1, 0],
    [9.0, 9.3, 1],
  ] as const;

  for (const [x, z, matIndex] of people) {
    const person = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.72, 5, 10), clothes[matIndex]);
    body.position.y = 1.05;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), skin);
    head.position.y = 1.58;
    person.add(body, head);
    person.position.set(x, 0, z);
    root.add(person);
  }

  const warm = new THREE.PointLight(0xffb45c, 12, 12, 2);
  warm.position.set(-7.4, 2.5, 8.2);
  root.add(warm);
}

function addDestinationLife(root: THREE.Group): void {
  const pinMat = new THREE.MeshStandardMaterial({
    color: 0x0bd3ef,
    emissive: 0x0793a7,
    emissiveIntensity: 1.1,
    roughness: 0.3,
  });

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 12), pinMat);
  stem.position.set(23.4, 5.1, 28.2);
  root.add(stem);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 20, 16), pinMat);
  head.position.set(23.4, 6.3, 28.2);
  root.add(head);

  const glow = new THREE.Mesh(
    new THREE.RingGeometry(0.8, 1.05, 32),
    new THREE.MeshBasicMaterial({ color: 0x27dff6, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(23.4, 0.18, 24.2);
  root.add(glow);
}

function addBridgeFlowers(root: THREE.Group): void {
  const potMat = new THREE.MeshStandardMaterial({ color: 0x9c6740, roughness: 0.88 });
  const flowerMat = new THREE.MeshStandardMaterial({ color: 0xe74b72, roughness: 0.76 });

  for (const z of [12.4, 21.6]) {
    for (let x = 30; x <= 46; x += 3.2) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 0.36, 10), potMat);
      pot.position.set(x, 1.0, z);
      root.add(pot);

      const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), flowerMat);
      bloom.position.set(x, 1.42, z);
      bloom.scale.y = 0.7;
      root.add(bloom);
    }
  }
}

function addRiceFieldFences(root: THREE.Group): void {
  const wood = new THREE.MeshStandardMaterial({ color: 0x66452f, roughness: 0.95 });
  const postGeo = new THREE.CylinderGeometry(0.07, 0.09, 1.3, 8);
  const railGeo = new THREE.CylinderGeometry(0.045, 0.045, 3.2, 8);

  for (let z = -40; z <= 42; z += 3.1) {
    const post = new THREE.Mesh(postGeo, wood);
    post.position.set(48.5, 0.65, z);
    root.add(post);
  }

  for (let z = -38.5; z <= 40; z += 3.1) {
    for (const y of [0.55, 1.0]) {
      const rail = new THREE.Mesh(railGeo, wood);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(48.5, y, z);
      root.add(rail);
    }
  }
}

function addFieldDetails(root: THREE.Group): void {
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x51a59b, roughness: 0.4 });
  for (let i = 0; i < 3; i++) {
    const trench = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 16), waterMat);
    trench.position.set(52 + i * 4.6, 0.08, -12);
    root.add(trench);
  }

  const birdMat = new THREE.MeshStandardMaterial({ color: 0xf5f2e8, roughness: 0.8 });
  for (const [x, z] of [[53, 8], [59, 20]] as const) {
    const bird = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), birdMat);
    body.scale.set(0.8, 1.1, 0.55);
    body.position.y = 0.65;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.75, 8), birdMat);
    neck.position.set(0, 1.0, 0);
    bird.add(body, neck);
    bird.position.set(x, 0, z);
    root.add(bird);
  }
}

function addCanalProps(root: THREE.Group): void {
  const stone = new THREE.MeshStandardMaterial({ color: 0xd8d0bb, roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x33423a, roughness: 0.85 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x70482d, roughness: 0.9 });

  for (const [x, z, s] of [[27.8, 4.5, 1], [47.2, -9, 0.92]] as const) {
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.2 * s, 3.0 * s, 0.45), stone);
    plinth.position.set(x, 1.5 * s, z);
    root.add(plinth);

    const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.45 * s, 24), dark);
    leaf.position.set(x, 0.75 * s, z + 0.24);
    root.add(leaf);
  }

  const boat = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 4.2, 8, 18), wood);
  boat.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  boat.scale.set(0.55, 1, 0.35);
  boat.position.set(39.5, 0.15, -28);
  root.add(boat);
}

function addMarker(root: THREE.Group, position: THREE.Vector3, color: number): void {
  const mat = new THREE.MeshBasicMaterial({ color });
  const marker = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 3), mat);
  marker.rotation.x = Math.PI;
  marker.position.copy(position);
  root.add(marker);
}

function tintModel(object: THREE.Object3D, color: number): void {
  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    node.material = materials.map((material) => {
      const cloned = material.clone();
      if ('color' in cloned && cloned.color instanceof THREE.Color) {
        cloned.color.lerp(new THREE.Color(color), 0.65);
      }
      return cloned;
    });
  });
}

function spawn(
  root: THREE.Group,
  relativePath: string,
  position: THREE.Vector3,
  targetSize: number,
  rotationY = 0,
  configure?: (model: THREE.Object3D) => void,
): void {
  const url = `${import.meta.env.BASE_URL}models/${relativePath}`;
  let pending = cache.get(url);
  if (!pending) {
    pending = loader.loadAsync(url).then(({ scene }) => scene);
    cache.set(url, pending);
  }

  pending
    .then((source) => {
      const model = source.clone(true);
      model.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        node.castShadow = true;
        node.receiveShadow = true;
      });

      fit(model, targetSize);
      configure?.(model);

      const container = new THREE.Group();
      container.position.copy(position);
      container.rotation.y = rotationY;
      container.add(model);
      root.add(container);
    })
    .catch((error: unknown) => {
      console.warn(`Reference hero asset failed: ${relativePath}`, error);
    });
}

function fit(object: THREE.Object3D, targetSize: number): void {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const max = Math.max(size.x, size.y, size.z);
  if (max > 0.0001) object.scale.setScalar(targetSize / max);

  object.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(object);
  const center = fitted.getCenter(new THREE.Vector3());

  object.position.x -= center.x;
  object.position.z -= center.z;
  object.position.y -= fitted.min.y;
}
