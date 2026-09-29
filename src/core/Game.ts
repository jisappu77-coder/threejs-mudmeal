import * as THREE from 'three';
import { InputManager } from '../input/InputManager';
import { DeliveryManager } from '../missions/DeliveryManager';
import { MotorcycleController } from '../player/MotorcycleController';
import { FollowCamera } from '../rendering/FollowCamera';
import { createPrototypeWorld } from '../world/PrototypeWorld';

export class Game {
  private readonly scene = new THREE.Scene();
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  private readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
  private readonly clock = new THREE.Clock();
  private readonly input = new InputManager();
  private readonly world = createPrototypeWorld();
  private readonly motorcycle = new MotorcycleController(
    this.input,
    this.world.bounds,
    this.world.obstacles,
  );
  private readonly delivery = new DeliveryManager();
  private readonly followCamera = new FollowCamera(this.camera, this.motorcycle.root);
  private readonly hud = document.createElement('div');
  private animationFrame = 0;

  constructor(private readonly mount: HTMLElement) {
    this.scene.background = new THREE.Color(0x9fc4cf);
    this.scene.fog = new THREE.FogExp2(0xa8c6cc, 0.008);

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.mount.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(0xd9f2ff, 0x45553d, 1.35));

    const sun = new THREE.DirectionalLight(0xfff0d5, 3.1);
    sun.position.set(-18, 28, -12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 90;
    sun.shadow.camera.left = -42;
    sun.shadow.camera.right = 42;
    sun.shadow.camera.top = 42;
    sun.shadow.camera.bottom = -42;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);

    this.scene.add(this.world.root, this.motorcycle.root, this.delivery.root);

    this.hud.className = 'hud';
    this.mount.appendChild(this.hud);

    window.addEventListener('resize', this.resize);
    this.resize();
  }

  start(): void {
    this.clock.start();
    this.tick();
  }

  dispose(): void {
    cancelAnimationFrame(this.animationFrame);
    window.removeEventListener('resize', this.resize);
    this.input.dispose();
    this.renderer.dispose();
  }

  private readonly resize = (): void => {
    const width = this.mount.clientWidth;
    const height = this.mount.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private readonly tick = (): void => {
    this.animationFrame = requestAnimationFrame(this.tick);
    const dt = Math.min(this.clock.getDelta(), 1 / 20);

    this.motorcycle.update(dt);
    this.delivery.update(this.motorcycle.root.position, dt);
    this.followCamera.update(dt, this.motorcycle.getSpeedRatio());

    this.hud.textContent =
      `${Math.round(this.motorcycle.getSpeedKph())} km/h\n` +
      `${this.delivery.getHudText(this.motorcycle.root.position)}\n` +
      'WASD / Arrows • Space brake • R reset';
    this.hud.style.whiteSpace = 'pre-line';

    this.renderer.render(this.scene, this.camera);
  };
}
