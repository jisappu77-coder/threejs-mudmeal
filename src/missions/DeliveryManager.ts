import * as THREE from 'three';

type DeliveryStage = 'pickup' | 'dropoff' | 'complete';

export class DeliveryManager {
  readonly root = new THREE.Group();

  private readonly pickup = new THREE.Vector3(-2, 0, 8);
  private readonly dropoff = new THREE.Vector3(24, 0, 18);
  private readonly pickupMarker = this.createMarker(0xffb300);
  private readonly dropoffMarker = this.createMarker(0x43a047);

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

    if (this.stage === 'pickup' && playerPosition.distanceToSquared(this.pickup) <= 9) {
      this.stage = 'dropoff';
      this.syncMarkers();
      return;
    }

    if (this.stage === 'dropoff' && playerPosition.distanceToSquared(this.dropoff) <= 9) {
      this.stage = 'complete';
      this.reward += 120;
      this.syncMarkers();
    }
  }

  getHudText(playerPosition: THREE.Vector3): string {
    if (this.stage === 'complete') {
      return `Delivery complete • ₹${this.reward}\nDrive around or press R to reset bike`;
    }

    const target = this.stage === 'pickup' ? this.pickup : this.dropoff;
    const distance = playerPosition.distanceTo(target);
    const label = this.stage === 'pickup' ? 'Pickup: Local Restaurant' : 'Deliver to Customer';

    return `${label} • ${Math.round(distance)} m\nReward: ₹120`;
  }

  private syncMarkers(): void {
    this.pickupMarker.visible = this.stage === 'pickup';
    this.dropoffMarker.visible = this.stage === 'dropoff';
  }

  private createMarker(color: number): THREE.Group {
    const marker = new THREE.Group();

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.25, 0.12, 12, 32),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.35,
        roughness: 0.45,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.12;
    marker.add(ring);

    const beacon = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 1.4, 16),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.2,
        roughness: 0.5,
      }),
    );
    beacon.position.y = 2.2;
    beacon.rotation.x = Math.PI;
    marker.add(beacon);

    return marker;
  }
}
