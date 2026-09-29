import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { InputManager } from '../input/InputManager';
import { DeliveryManager } from '../missions/DeliveryManager';
import { MotorcycleController } from '../player/MotorcycleController';
import { FollowCamera } from '../rendering/FollowCamera';
import { createPrototypeWorld } from '../world/PrototypeWorld';

export class Game {
  private readonly scene = new THREE.Scene();
  private readonly renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance',
  });
  private readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
  private readonly composer = new EffectComposer(this.renderer);
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
    this.scene.background = new THREE.Color(0x93b7c2);
    this.scene.fog = new THREE.FogExp2(0xa7c1c4, 0.0075);

    const pixelRatio = Math.min(window.devicePixelRatio, 1.75);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.mount.appendChild(this.renderer.domElement);

    this.composer.setPixelRatio(pixelRatio);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new SMAAPass());
    this.composer.addPass(new OutputPass());

    this.scene.add(new THREE.HemisphereLight(0xdcefff, 0x3f4f38, 1.15));

    const key = new THREE.DirectionalLight(0xffedcf, 3.4);
    key.position.set(-24, 34, -18);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 100;
    key.shadow.camera.left = -46;
    key.shadow.camera.right = 46;
    key.shadow.camera.top = 46;
    key.shadow.camera.bottom = -46;
    key.shadow.bias = -0.00025;
    key.shadow.normalBias = 0.018;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x8fb9d6, 0.7);
    fill.position.set(30, 16, 24);
    this.scene.add(fill);

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
    this.composer.dispose();
    this.renderer.dispose();
  }

  private readonly resize = (): void => {
    const width = this.mount.clientWidth;
    const height = this.mount.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
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

    this.composer.render(dt);
  };
}
