import * as THREE from 'three';
import type { InputManager } from '../input/InputManager';

export class MotorcycleController {
  readonly root = new THREE.Group();
  private speed = 0;
  private yaw = 0;
  private steerVisual = 0;

  private readonly maxForwardSpeed = 22;
  private readonly maxReverseSpeed = 5;
  private readonly acceleration = 13;
  private readonly braking = 22;
  private readonly rollingDrag = 4.5;

  constructor(private readonly input: InputManager) {
    this.root.add(this.createBikeVisual());
    this.reset();
  }

  update(dt: number): void {
    const throttle = this.input.isDown('KeyW', 'ArrowUp') ? 1 : 0;
    const brake = this.input.isDown('KeyS', 'ArrowDown') ? 1 : 0;
    const hardBrake = this.input.isDown('Space');
    const steer = Number(this.input.isDown('KeyA', 'ArrowLeft')) - Number(this.input.isDown('KeyD', 'ArrowRight'));

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

    this.root.rotation.y = this.yaw;
    this.root.position.x += Math.sin(this.yaw) * this.speed * dt;
    this.root.position.z += Math.cos(this.yaw) * this.speed * dt;

    this.steerVisual = THREE.MathUtils.damp(this.steerVisual, steer, 8, dt);
    this.root.rotation.z = -this.steerVisual * speedRatio * 0.28;

    if (this.input.isDown('KeyR')) this.reset();
  }

  getSpeedKph(): number {
    return Math.abs(this.speed) * 3.6;
  }

  reset(): void {
    this.root.position.set(0, 0.45, 0);
    this.root.rotation.set(0, 0, 0);
    this.speed = 0;
    this.yaw = 0;
  }

  private createBikeVisual(): THREE.Group {
    const bike = new THREE.Group();
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xd84315, roughness: 0.55 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x202020, roughness: 0.8 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 1.7), bodyMaterial);
    body.position.y = 0.45;
    bike.add(body);

    const wheelGeometry = new THREE.CylinderGeometry(0.34, 0.34, 0.16, 20);
    wheelGeometry.rotateZ(Math.PI / 2);
    for (const z of [-0.72, 0.72]) {
      const wheel = new THREE.Mesh(wheelGeometry, darkMaterial);
      wheel.position.set(0, 0.16, z);
      bike.add(wheel);
    }

    const rider = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.65, 4, 8), darkMaterial);
    rider.position.set(0, 1.15, -0.12);
    rider.rotation.x = -0.18;
    bike.add(rider);

    return bike;
  }
}
