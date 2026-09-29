import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { InputManager } from '../input/InputManager';
import { DeliveryManager } from '../missions/DeliveryManager';
import { MotorcycleController } from '../player/MotorcycleController';
import { FollowCamera } from '../rendering/FollowCamera';
import { createReferenceHeroScene } from '../world/ReferenceHeroScene';

export class Game {
  private readonly isMobile =
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(max-width: 900px)').matches;

  private readonly scene = new THREE.Scene();
  private readonly renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: this.isMobile ? 'default' : 'high-performance',
  });
  private readonly camera = new THREE.PerspectiveCamera(this.isMobile ? 50 : 43, 1, 0.1, 350);
  private readonly composer = this.isMobile ? null : new EffectComposer(this.renderer);
  private readonly clock = new THREE.Clock();
  private readonly input = new InputManager();
  private readonly world = createReferenceHeroScene();
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
    this.scene.background = new THREE.Color(0x9fc8d2);
    this.scene.fog = new THREE.FogExp2(0xb9cfd0, this.isMobile ? 0.0048 : 0.0058);

    const sky = new Sky();
    sky.scale.setScalar(450000);
    const skyUniforms = sky.material.uniforms;
    skyUniforms.turbidity.value = 7.5;
    skyUniforms.rayleigh.value = 1.7;
    skyUniforms.mieCoefficient.value = 0.0045;
    skyUniforms.mieDirectionalG.value = 0.82;

    const sunDirection = new THREE.Vector3().setFromSphericalCoords(
      1,
      THREE.MathUtils.degToRad(58),
      THREE.MathUtils.degToRad(228),
    );
    skyUniforms.sunPosition.value.copy(sunDirection);
    this.scene.add(sky);

    const pixelRatio = Math.min(window.devicePixelRatio, this.isMobile ? 1.15 : 1.65);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = this.isMobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.isMobile ? 1.14 : 1.1;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const environment = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(environment, 0.04).texture;
    this.scene.environmentIntensity = this.isMobile ? 0.82 : 1.05;
    environment.dispose();
    pmrem.dispose();

    this.mount.appendChild(this.renderer.domElement);

    if (this.composer) {
      this.composer.setPixelRatio(pixelRatio);
      this.composer.addPass(new RenderPass(this.scene, this.camera));

      const ssao = new SSAOPass(this.scene, this.camera, 960, 540, 24);
      ssao.kernelRadius = 11;
      ssao.minDistance = 0.0025;
      ssao.maxDistance = 0.075;
      this.composer.addPass(ssao);

      this.composer.addPass(new SMAAPass());
      this.composer.addPass(new OutputPass());
    }

    this.scene.add(new THREE.HemisphereLight(0xfff2dc, 0x34452f, this.isMobile ? 1.3 : 1.05));

    const key = new THREE.DirectionalLight(0xffd59b, this.isMobile ? 4.2 : 4.8);
    key.position.set(-28, 40, -20);
    key.castShadow = true;
    const shadowSize = this.isMobile ? 1024 : 2048;
    key.shadow.mapSize.set(shadowSize, shadowSize);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 120;
    key.shadow.camera.left = -52;
    key.shadow.camera.right = 52;
    key.shadow.camera.top = 52;
    key.shadow.camera.bottom = -52;
    key.shadow.bias = -0.00025;
    key.shadow.normalBias = 0.018;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x92cfe4, this.isMobile ? 0.78 : 0.62);
    fill.position.set(35, 20, 28);
    this.scene.add(fill);

    this.scene.add(this.world.root, this.motorcycle.root, this.delivery.root);

    this.setupHud();
    this.mount.appendChild(this.hud);

    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', this.resize);
    this.resize();
  }

  start(): void {
    this.clock.start();
    this.tick();
  }

  dispose(): void {
    cancelAnimationFrame(this.animationFrame);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('orientationchange', this.resize);
    this.input.dispose();
    this.composer?.dispose();
    this.renderer.dispose();
  }

  private setupHud(): void {
    this.hud.className = this.isMobile ? 'game-ui mobile-ui' : 'game-ui';
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
          <div class="mission-secondary">📦 Food 92%</div>
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

      <section class="status-pill" id="status-pill">Biryani pickup</section>

      <section class="touch-controls steer-pad" aria-label="Steering controls">
        <button data-code="KeyA" aria-label="Steer left">◀</button>
        <div class="steer-dot"></div>
        <button data-code="KeyD" aria-label="Steer right">▶</button>
      </section>

      <section class="touch-controls pedals" aria-label="Driving controls">
        <button class="brake" data-code="KeyS">●<span>Brake</span></button>
        <button class="accelerate" data-code="KeyW">▲<span>Go</span></button>
      </section>

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
    const width = Math.max(1, this.mount.clientWidth);
    const height = Math.max(1, this.mount.clientHeight);
    this.camera.aspect = width / height;
    this.camera.fov = this.isMobile
      ? (height > width ? 58 : 50)
      : 43;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer?.setSize(width, height);
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

    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  };
}
