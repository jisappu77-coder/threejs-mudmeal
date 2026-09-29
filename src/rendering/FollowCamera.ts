import * as THREE from 'three';

export class FollowCamera {
  private readonly desired = new THREE.Vector3();
  private readonly lookAt = new THREE.Vector3();
  private readonly backward = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly heightOffset = new THREE.Vector3();

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    private readonly target: THREE.Object3D,
  ) {}

  update(dt: number, speedRatio: number): void {
    this.backward.set(0, 0, -1).applyQuaternion(this.target.quaternion);
    this.forward.copy(this.backward).negate();

    const distance = THREE.MathUtils.lerp(17.5, 20.5, speedRatio);
    this.heightOffset.set(0, THREE.MathUtils.lerp(15.5, 18.5, speedRatio), 0);

    this.desired
      .copy(this.target.position)
      .addScaledVector(this.backward, distance)
      .add(this.heightOffset);

    const positionT = 1 - Math.exp(-4.8 * dt);
    this.camera.position.lerp(this.desired, positionT);

    this.lookAt
      .copy(this.target.position)
      .add(new THREE.Vector3(0, 0.35, 0))
      .addScaledVector(this.forward, THREE.MathUtils.lerp(6.0, 9.0, speedRatio));

    this.camera.lookAt(this.lookAt);

    const targetFov = THREE.MathUtils.lerp(43, 47, speedRatio);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 4, dt);
    this.camera.updateProjectionMatrix();
  }
}
