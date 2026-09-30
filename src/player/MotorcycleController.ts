import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { InputManager } from '../input/InputManager';

export type RideBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export class MotorcycleController {
  readonly root = new THREE.Group();

  private speed = 0;
  private yaw = 0;
  private steerVisual = 0;
  private readonly previousPosition = new THREE.Vector3();

  private readonly maxForwardSpeed = 22;
  private readonly maxReverseSpeed = 5;
  private readonly acceleration = 13;
  private readonly braking = 22;
  private readonly rollingDrag = 4.5;

  constructor(
    private readonly input: InputManager,
    private readonly bounds: RideBounds,
    private readonly obstacles: readonly THREE.Box2[],
  ) {
    this.loadBikeModel();
    this.reset();
  }

  update(dt: number): void {
    const throttle = this.input.isDown('KeyW', 'ArrowUp') ? 1 : 0;
    const brake = this.input.isDown('KeyS', 'ArrowDown') ? 1 : 0;
    const hardBrake = this.input.isDown('Space');
    const steer =
      Number(this.input.isDown('KeyA', 'ArrowLeft')) -
      Number(this.input.isDown('KeyD', 'ArrowRight'));

    if (throttle) this.speed += this.acceleration * dt;
    if (brake) this.speed -= (this.speed > 0 ? this.braking : this.acceleration * 0.45) * dt;
    if (hardBrake) this.speed = THREE.MathUtils.damp(this.speed, 0, 10, dt);
    if (!throttle && !brake) this.speed = THREE.MathUtils.damp(this.speed, 0, this.rollingDrag, dt);

    this.speed = THREE.MathUtils.clamp(this.speed, -this.maxReverseSpeed, this.maxForwardSpeed);

    const speedRatio = Math.min(Math.abs(this.speed) / this.maxForwardSpeed, 1);
    const steeringAuthority = THREE.MathUtils.lerp(1.8, 0.75, speedRatio);
    if (Math.abs(this.speed) > 0.15) {
      this.yaw += steer * steeringAuthority * Math.sign(this.speed) * dt;
    }

    this.previousPosition.copy(this.root.position);
    this.root.rotation.y = this.yaw;
    this.root.position.x += Math.sin(this.yaw) * this.speed * dt;
    this.root.position.z += Math.cos(this.yaw) * this.speed * dt;

    if (this.isBlocked()) {
      this.root.position.copy(this.previousPosition);
      this.speed *= -0.18;
    }

    this.steerVisual = THREE.MathUtils.damp(this.steerVisual, steer, 8, dt);
    this.root.rotation.z = -this.steerVisual * speedRatio * 0.28;

    if (this.input.isDown('KeyR')) this.reset();
  }

  getSpeedKph(): number {
    return Math.abs(this.speed) * 3.6;
  }

  getSpeedRatio(): number {
    return Math.min(Math.abs(this.speed) / this.maxForwardSpeed, 1);
  }

  reset(): void {
    this.root.position.set(0, 0.45, -35);
    this.root.rotation.set(0, 0, 0);
    this.speed = 0;
    this.yaw = 0;
  }

  private loadBikeModel(): void {
    const loader = new GLTFLoader();
    loader.load(
      `${import.meta.env.BASE_URL}models/delivery-bike.glb`,
      (gltf) => {
        const model = gltf.scene;
        model.name = 'delivery-bike-glb';

        model.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.castShadow = true;
          object.receiveShadow = true;

          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            if (material instanceof THREE.MeshStandardMaterial) {
              material.envMapIntensity = 1.25;
            }
          }
        });

        this.fitModel(model, 2.45);
        this.root.add(model);
      },
      undefined,
      (error) => {
        console.error('Delivery bike GLB failed to load.', error);
      },
    );
  }

  private fitModel(model: THREE.Object3D, targetMaxDimension: number): void {
    model.updateMatrixWorld(true);
    const initialBox = new THREE.Box3().setFromObject(model);
    const size = initialBox.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z);

    if (Number.isFinite(maxDimension) && maxDimension > 0.0001) {
      model.scale.setScalar(targetMaxDimension / maxDimension);
    }

    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box.min.y;
  }

  private isBlocked(): boolean {
    const { x, z } = this.root.position;
    if (
      x < this.bounds.minX ||
      x > this.bounds.maxX ||
      z < this.bounds.minZ ||
      z > this.bounds.maxZ
    ) {
      return true;
    }

    const point = new THREE.Vector2(x, z);
    return this.obstacles.some((obstacle) => obstacle.containsPoint(point));
  }

}
