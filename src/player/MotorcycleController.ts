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
          if (object.material instanceof THREE.MeshStandardMaterial) {
            object.material.envMapIntensity = 1.05;
          }
        });
        this.root.add(model);
      },
      undefined,
      (error) => {
        console.error('Failed to load delivery bike GLB; using fallback geometry.', error);
        this.root.add(this.createBikeVisual());
      },
    );
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

  private createBikeVisual(): THREE.Group {
    const bike = new THREE.Group();
    const paint = new THREE.MeshPhysicalMaterial({
      color: 0x9f1818,
      roughness: 0.28,
      metalness: 0.22,
      clearcoat: 0.9,
      clearcoatRoughness: 0.16,
    });
    const black = new THREE.MeshStandardMaterial({ color: 0x111315, roughness: 0.68, metalness: 0.08 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x8e9699, roughness: 0.3, metalness: 0.82 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.94 });
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x17191b, roughness: 0.82 });
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0xfff3d6,
      emissive: 0xffd59a,
      emissiveIntensity: 1.8,
      roughness: 0.24,
    });

    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 1.5), black);
    frame.position.set(0, 0.52, 0);
    frame.castShadow = true;
    bike.add(frame);

    const tank = new THREE.Mesh(new THREE.SphereGeometry(0.46, 24, 18), paint);
    tank.scale.set(0.82, 0.62, 1.18);
    tank.position.set(0, 0.82, 0.1);
    tank.castShadow = true;
    bike.add(tank);

    const fairing = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.65, 8, 16), paint);
    fairing.rotation.x = Math.PI / 2;
    fairing.scale.set(1.0, 1.0, 0.8);
    fairing.position.set(0, 0.63, 0.55);
    fairing.castShadow = true;
    bike.add(fairing);

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.78), seatMat);
    seat.position.set(0, 0.88, -0.5);
    seat.rotation.x = -0.06;
    seat.castShadow = true;
    bike.add(seat);

    const wheelGeometry = new THREE.TorusGeometry(0.36, 0.085, 12, 28);
    const rimGeometry = new THREE.TorusGeometry(0.25, 0.025, 8, 24);
    for (const z of [-0.78, 0.82]) {
      const wheel = new THREE.Mesh(wheelGeometry, rubber);
      wheel.rotation.y = Math.PI / 2;
      wheel.position.set(0, 0.28, z);
      wheel.castShadow = true;
      bike.add(wheel);

      const rim = new THREE.Mesh(rimGeometry, metal);
      rim.rotation.y = Math.PI / 2;
      rim.position.copy(wheel.position);
      bike.add(rim);

      for (let i = 0; i < 8; i += 1) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.48), metal);
        spoke.rotation.x = (i / 8) * Math.PI;
        spoke.rotation.y = Math.PI / 2;
        spoke.position.copy(wheel.position);
        bike.add(spoke);
      }
    }

    for (const x of [-0.18, 0.18]) {
      const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.72, 10), metal);
      fork.position.set(x, 0.64, 0.68);
      fork.rotation.x = -0.17;
      bike.add(fork);
    }

    const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.72, 10), metal);
    handlebar.rotation.z = Math.PI / 2;
    handlebar.position.set(0, 1.05, 0.55);
    bike.add(handlebar);

    const headlight = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 20), lightMat);
    headlight.rotation.x = Math.PI / 2;
    headlight.position.set(0, 0.93, 0.86);
    bike.add(headlight);

    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.95, 12), metal);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(-0.27, 0.4, -0.5);
    bike.add(exhaust);

    const riderJacket = new THREE.MeshPhysicalMaterial({
      color: 0x202a31,
      roughness: 0.58,
      sheen: 0.28,
      sheenRoughness: 0.65,
    });
    const rider = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.66, 8, 14), riderJacket);
    rider.position.set(0, 1.44, -0.16);
    rider.rotation.x = -0.2;
    rider.castShadow = true;
    bike.add(rider);

    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 24, 18),
      new THREE.MeshPhysicalMaterial({
        color: 0x161a1e,
        roughness: 0.2,
        metalness: 0.25,
        clearcoat: 1,
        clearcoatRoughness: 0.12,
      }),
    );
    helmet.position.set(0, 1.95, 0.04);
    helmet.scale.set(1, 1.05, 1.08);
    helmet.castShadow = true;
    bike.add(helmet);

    const visor = new THREE.Mesh(
      new THREE.SphereGeometry(0.205, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshPhysicalMaterial({
        color: 0x26333a,
        roughness: 0.08,
        metalness: 0.1,
        transmission: 0.18,
        transparent: true,
        opacity: 0.7,
      }),
    );
    visor.rotation.x = Math.PI / 2;
    visor.position.set(0, 1.96, 0.17);
    bike.add(visor);

    return bike;
  }
}
