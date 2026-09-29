import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { InputManager } from '../input/InputManager';
import { DeliveryManager } from '../missions/DeliveryManager';
import { MotorcycleController } from '../player/MotorcycleController';
import { FollowCamera } from '../rendering/FollowCamera';
import { createHighFidelityWorld } from '../world/HighFidelityWorld';

export class Game {
  private readonly scene = new THREE.Scene();
  private readonly renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance',
  });
  private readonly camera = new THREE.PerspectiveCamera(43, 1, 0.1, 350);
  private readonly composer = new EffectComposer(this.renderer);
  private readonly clock = new THREE.Clock();
  private readonly input = new InputManager();
  private readonly world = createHighFidelityWorld();
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
    this.scene.background = new THREE.Color(0x91bac6);
    this.scene.fog = new THREE.FogExp2(0xa9c4c7, 0.0068);

    const pixelRatio = Math.min(window.devicePixelRatio, 1.65);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.mount.appendChild(this.renderer.domElement);

    this.composer.setPixelRatio(pixelRatio);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new SMAAPass());
    this.composer.addPass(new OutputPass());

    this.scene.add(new THREE.HemisphereLight(0xeef8ff, 0x56623b, 1.45));

    const key = new THREE.DirectionalLight(0xffe1b2, 4.2);
    key.position.set(-28, 40, -20);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 120;
    key.shadow.camera.left = -52;
    key.shadow.camera.right = 52;
    key.shadow.camera.top = 52;
    key.shadow.camera.bottom = -52;
    key.shadow.bias = -0.00025;
    key.shadow.normalBias = 0.018;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x8fc8e0, 0.92);
    fill.position.set(35, 20, 28);
    this.scene.add(fill);

    this.scene.add(this.world.root, this.motorcycle.root, this.delivery.root);

    this.setupHud();
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

  private setupHud(): void {
    this.hud.className = 'game-ui';
    this.hud.innerHTML = `
      <section class="brand-card">
        <div class="brand-title">MUD <span>MEALS</span> 🌴</div>
        <div class="brand-location">📍 KOCHI OUTSKIRTS</div>
      </section>

      <section class="mission-card">
        <div class="mission-thumb">🍛</div>
        <div>
          <strong>Biryani delivery</strong>
          <div>◷ <span id="mission-time">02:45</span></div>
          <div>📦 Food 92%</div>
          <div>₹ Reward ₹280</div>
        </div>
      </section>

      <section class="wallet-bar">
        <div>💵 <span>Cash</span> <strong>₹1,240</strong></div>
        <div>▣ <span>Bank</span> <strong>₹8,500</strong></div>
      </section>

      <section class="minimap">
        <div class="minimap-n">N</div>
        <div class="mini-road r1"></div>
        <div class="mini-road r2"></div>
        <div class="mini-water"></div>
        <div class="mini-home">⌂</div>
        <div class="mini-pin">●</div>
        <div class="mini-player">▲</div>
      </section>

      <button class="pause-button" aria-label="Pause">Ⅱ</button>

      <section class="status-pill" id="status-pill">Biryani pickup</section>

      <section class="touch-controls steer-pad">
        <button data-code="KeyA" aria-label="Steer left">◀</button>
        <div class="steer-dot"></div>
        <button data-code="KeyD" aria-label="Steer right">▶</button>
      </section>

      <section class="touch-controls pedals">
        <button class="brake" data-code="KeyS">◉<span>Brake</span></button>
        <button class="accelerate" data-code="KeyW">⌃<span>Accelerate</span></button>
      </section>

      <section class="orders-pill">☷ Orders <b>2</b></section>
      <section class="speed-pill"><span id="speed-value">0</span> km/h</section>
    `;

    this.hud.querySelectorAll<HTMLButtonElement>('[data-code]').forEach((button) => {
      const code = button.dataset.code;
      if (!code) return;

      const press = (event: PointerEvent): void => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        this.input.setVirtual(code, true);
      };
      const release = (event: PointerEvent): void => {
        event.preventDefault();
        this.input.setVirtual(code, false);
      };

      button.addEventListener('pointerdown', press);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
    });
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

    const speed = this.hud.querySelector<HTMLElement>('#speed-value');
    if (speed) speed.textContent = String(Math.round(this.motorcycle.getSpeedKph()));

    const status = this.hud.querySelector<HTMLElement>('#status-pill');
    if (status) status.textContent = this.delivery.getHudText(this.motorcycle.root.position);

    const missionTime = this.hud.querySelector<HTMLElement>('#mission-time');
    if (missionTime && this.delivery.getStage() === 'complete') missionTime.textContent = 'DONE';

    this.composer.render(dt);
  };
}
