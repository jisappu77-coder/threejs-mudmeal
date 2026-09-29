import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { ASSET_BY_ID, type AssetId } from './AssetRegistry';

export class AssetManager {
  private readonly loader = new GLTFLoader();
  private readonly cache = new Map<AssetId, THREE.Object3D>();
  private readonly pending = new Map<AssetId, Promise<THREE.Object3D | null>>();

  constructor(private readonly basePath = import.meta.env.BASE_URL) {}

  async load(id: AssetId): Promise<THREE.Object3D | null> {
    const cached = this.cache.get(id);
    if (cached) return cached;

    const existing = this.pending.get(id);
    if (existing) return existing;

    const definition = ASSET_BY_ID.get(id);
    if (!definition) return null;

    const promise = this.loader
      .loadAsync(this.resolve(definition.url))
      .then((gltf) => {
        const root = gltf.scene;
        if (definition.scale) root.scale.setScalar(definition.scale);

        root.traverse((node) => {
          if (!(node instanceof THREE.Mesh)) return;
          node.castShadow = definition.castShadow ?? true;
          node.receiveShadow = definition.receiveShadow ?? false;

          const materials = Array.isArray(node.material) ? node.material : [node.material];
          for (const material of materials) {
            if ('map' in material && material.map instanceof THREE.Texture) {
              material.map.colorSpace = THREE.SRGBColorSpace;
            }
          }
        });

        this.cache.set(id, root);
        return root;
      })
      .catch((error: unknown) => {
        console.warn(`[AssetManager] Failed to load ${id}; keeping procedural fallback.`, error);
        return null;
      })
      .finally(() => this.pending.delete(id));

    this.pending.set(id, promise);
    return promise;
  }

  async instantiate(id: AssetId): Promise<THREE.Object3D | null> {
    const source = await this.load(id);
    return source ? clone(source) : null;
  }

  async replaceFallback(
    parent: THREE.Object3D,
    fallback: THREE.Object3D,
    id: AssetId,
    configure?: (instance: THREE.Object3D) => void,
  ): Promise<boolean> {
    const instance = await this.instantiate(id);
    if (!instance) return false;

    instance.position.copy(fallback.position);
    instance.quaternion.copy(fallback.quaternion);
    instance.scale.multiply(fallback.scale);
    configure?.(instance);

    parent.add(instance);
    parent.remove(fallback);
    return true;
  }

  has(id: AssetId): boolean {
    return this.cache.has(id);
  }

  private resolve(path: string): string {
    return `${this.basePath}${path}`;
  }
}
