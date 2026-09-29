import * as THREE from 'three';

export class FollowCamera {
  private readonly desired = new THREE.Vector3();
  private readonly lookAt = new THREE.Vector3();
  private readonly offset = new THREE.Vector3(-18, 22, -22);
  private readonly lookAhead = new THREE.Vector3(5.5, 0.5, 8.5);

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    private readonly target: THREE.Object3D,
  ) {}

  update(dt: number, speedRatio: number): void {
    const speedLift = THREE.MathUtils.lerp(0, 2.5, speedRatio);

    this.desired
      .copy(this.target.position)
      .add(this.offset)
      .add(new THREE.Vector3(0, speedLift, 0));

    const positionT = 1 - Math.exp(-3.8 * dt);
    this.camera.position.lerp(this.desired, positionT);

    this.lookAt
      .copy(this.target.position)
      .add(this.lookAhead);

    this.camera.lookAt(this.lookAt);

    const targetFov = THREE.MathUtils.lerp(41, 45, speedRatio);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 3.5, dt);
    this.camera.updateProjectionMatrix();
  }
}
