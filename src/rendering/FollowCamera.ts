import * as THREE from 'three';

export class FollowCamera {
  private readonly desired = new THREE.Vector3();
  private readonly lookAt = new THREE.Vector3();

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    private readonly target: THREE.Object3D,
  ) {}

  update(dt: number): void {
    const backward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.target.quaternion);
    const forward = backward.clone().negate();

    this.desired.copy(this.target.position)
      .addScaledVector(backward, 6.5)
      .add(new THREE.Vector3(0, 3.3, 0));

    const t = 1 - Math.exp(-6 * dt);
    this.camera.position.lerp(this.desired, t);

    this.lookAt.copy(this.target.position)
      .add(new THREE.Vector3(0, 1.0, 0))
      .addScaledVector(forward, 3.0);
    this.camera.lookAt(this.lookAt);
  }
}
