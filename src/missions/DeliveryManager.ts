import * as THREE from 'three';

type DeliveryStage = 'pickup' | 'dropoff' | 'complete';

export class DeliveryManager {
  readonly root = new THREE.Group();

  private readonly pickup = new THREE.Vector3(-2, 0, 8);
  private readonly dropoff = new THREE.Vector3(24, 0, 18);
  private readonly pickupMarker = this.createMarker(0xffa726);
  private readonly dropoffMarker = this.createMarker(0x00d8ff);

  private stage: DeliveryStage = 'pickup';
  private reward = 0;

  constructor() {
    this.pickupMarker.position.copy(this.pickup);
    this.dropoffMarker.position.copy(this.dropoff);
    this.root.add(this.pickupMarker, this.dropoffMarker);
    this.syncMarkers();
  }

  update(playerPosition: THREE.Vector3, dt: number): void {
    const active = this.stage === 'pickup' ? this.pickupMarker : this.dropoffMarker;
    active.rotation.y += dt * 1.8;
    active.position.y = 0.15 + Math.sin(performance.now() * 0.004) * 0.08;

    if (this.stage === 'pickup' && playerPosition.distanceToSquared(this.pickup) <= 9) {
      this.stage = 'dropoff';
      this.syncMarkers();
      return;
    }

    if (this.stage === 'dropoff' && playerPosition.distanceToSquared(this.dropoff) <= 9) {
      this.stage = 'complete';
      this.reward += 280;
      this.syncMarkers();
    }
  }

  getHudText(playerPosition: THREE.Vector3): string {
    if (this.stage === 'complete') return `Delivery complete • ₹${this.reward}`;

    const target = this.stage === 'pickup' ? this.pickup : this.dropoff;
    const distance = playerPosition.distanceTo(target);
    const label = this.stage === 'pickup' ? 'Biryani pickup' : 'Deliver to customer';
    return `${label} • ${Math.round(distance)} m`;
  }

  getStage(): DeliveryStage {
    return this.stage;
  }

  private syncMarkers(): void {
    this.pickupMarker.visible = this.stage === 'pickup';
    this.dropoffMarker.visible = this.stage === 'dropoff';
  }

  private createMarker(color: number): THREE.Group {
    const marker = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.1,
      roughness: 0.3,
    });

    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.12, 12, 40), material);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.1;
    marker.add(ring);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.2, 12), material);
    stem.position.y = 1.3;
    marker.add(stem);

    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 14), material);
    pin.position.y = 2.55;
    marker.add(pin);

    return marker;
  }
}
