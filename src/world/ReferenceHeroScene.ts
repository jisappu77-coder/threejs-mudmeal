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

const anchors = {
  playerStart: new THREE.Vector3(0, 0, -35),
  restaurant: new THREE.Vector3(-11.1, 0, 8.3),
  snackShop: new THREE.Vector3(12.5, 0, 7.4),
  bridge: new THREE.Vector3(38, 0, 17),
  destination: new THREE.Vector3(23.4, 0, 28.2),
  rivalRed: new THREE.Vector3(-1.6, 0.45, -40.5),
  rivalPurple: new THREE.Vector3(1.7, 0.45, -44.5),
} as const;

export function createReferenceHeroScene(): ReferenceHeroScene {
  const base = createHighFidelityWorld();
  const root = new THREE.Group();
  root.add(base.root);

  addRoute(root);
  addRivalBikes(root);
  addHeroTraffic(root);
  addHeroVegetation(root);
  addRiceFieldFences(root);
  addCanalProps(root);

  return {
    root,
    bounds: base.bounds,
    obstacles: base.obstacles,
  };
}

function addRoute(root: THREE.Group): void {
  const points = [
    new THREE.Vector3(0, 0.16, -34),
    new THREE.Vector3(0.3, 0.16, -21),
    new THREE.Vector3(1.5, 0.16, -8),
    new THREE.Vector3(3.5, 0.16, 5),
    new THREE.Vector3(11, 0.16, 14.5),
    new THREE.Vector3(22, 0.16, 17),
    new THREE.Vector3(32, 0.72, 17),
    new THREE.Vector3(39, 0.72, 17),
    new THREE.Vector3(31, 0.16, 23),
    new THREE.Vector3(24, 0.16, 27.2),
  ];

  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const material = new THREE.MeshBasicMaterial({
    color: 0x11daf3,
    transparent: true,
    opacity: 0.9,
  });

  const steps = 34;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const p = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();

    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.8, 3), material);
    arrow.rotation.x = Math.PI / 2;
    arrow.rotation.z = Math.atan2(tangent.x, tangent.z);
    arrow.position.copy(p);
    arrow.scale.set(0.9, 1.2, 0.9);
    root.add(arrow);
  }
}

function addRivalBikes(root: THREE.Group): void {
  spawn(
    root,
    'delivery-bike.glb',
    anchors.rivalRed,
    2.2,
    0,
    (model) => tintModel(model, 0xd93025),
  );
  spawn(
    root,
    'delivery-bike.glb',
    anchors.rivalPurple,
    2.2,
    0,
    (model) => tintModel(model, 0x6d39c5),
  );

  addMarker(root, anchors.rivalRed.clone().add(new THREE.Vector3(0, 3.0, 0)), 0xff3347);
  addMarker(root, anchors.rivalPurple.clone().add(new THREE.Vector3(0, 3.0, 0)), 0x9d4edd);
}

function addHeroTraffic(root: THREE.Group): void {
  const autos = [
    new THREE.Vector3(-2.8, 0.05, -25),
    new THREE.Vector3(2.8, 0.05, -13),
    new THREE.Vector3(-2.7, 0.05, 0),
    new THREE.Vector3(2.6, 0.05, 11),
  ];
  autos.forEach((p, i) => spawn(root, 'world/auto-rickshaw.glb', p, 2.6, i % 2 ? 0.02 : -0.03));

  spawn(root, 'world/ksrtc-bus.glb', new THREE.Vector3(-3.1, 0.06, -17.5), 7.6, 0.01);
}

function addHeroVegetation(root: THREE.Group): void {
  const palms = [
    [-21,-8,1.05], [-18,4,1.12], [-15,17,1.0],
    [18,-7,1.08], [22,4,1.1], [26,14,1.05],
    [31,29,1.08], [47,28,1.12], [51,12,1.05],
    [55,-8,1.1], [48,-25,1.05],
  ] as const;

  for (const [x, z, s] of palms) {
    spawn(root, 'world/coconut-palm.glb', new THREE.Vector3(x, 0, z), 8.2 * s, ((x + z) % 9) * 0.08);
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

function addCanalProps(root: THREE.Group): void {
  const stone = new THREE.MeshStandardMaterial({ color: 0xd8d0bb, roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x33423a, roughness: 0.85 });

  for (const [x, z, textScale] of [[27.8, 4.5, 1], [47.2, -9, 0.92]] as const) {
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.2 * textScale, 3.0 * textScale, 0.45), stone);
    plinth.position.set(x, 1.5 * textScale, z);
    root.add(plinth);

    const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.45 * textScale, 24), dark);
    leaf.position.set(x, 0.75 * textScale, z + 0.24);
    root.add(leaf);
  }
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
