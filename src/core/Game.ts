import * as THREE from 'three';
import { InputManager } from '../input/InputManager';
import { MotorcycleController } from '../player/MotorcycleController';
import { FollowCamera } from '../rendering/FollowCamera';
import { createPrototypeWorld } from '../world/PrototypeWorld';

export class Game {
  private readonly scene = new THREE.Scene();
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  private readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
  private readonly clock = new THREE.Clock();
  private readonly input = new InputManager();
  private readonly motorcycle = new MotorcycleController(this.input);
  private readonly followCamera = new FollowCamera(this.camera, this.motorcycle.root);
  private readonly hud = document.createElement('div');
  private animationFrame = 0;

  constructor(private readonly mount: HTMLElement) {
    this.scene.background = new THREE.Color(0xa9d6e5);
    this.scene.fog = new THREE.Fog(0xa9d6e5, 55, 150);

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.mount.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x506040, 1.8));
    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.position.set(12, 20, -8);
    sun.castShadow = true;
    this.scene.add(sun);

    this.scene.add(createPrototypeWorld(), this.motorcycle.root);

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
    this.followCamera.update(dt);
    this.hud.textContent = `${Math.round(this.motorcycle.getSpeedKph())} km/h\nWASD / Arrows • Space brake • R reset`;
    this.hud.style.whiteSpace = 'pre-line';

    this.renderer.render(this.scene, this.camera);
  };
}
