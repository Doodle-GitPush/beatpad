import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { N8AOPass } from 'n8ao';
import { clamp } from '../audio';
import type { Theme } from '../theme';
import { createGlossyFloor } from './floor';
import { TIERS, pixelRatioFor, type Tier } from './quality';

const VIEW_DIR = new THREE.Vector3(0, Math.cos(0.55), Math.sin(0.55)).normalize();
const TARGET = new THREE.Vector3(0, 0.4, 0.15);

/** virtual photo studio: softboxes + bounce card that metal and gloss reflect */
function studioEnv(renderer: THREE.WebGLRenderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), new THREE.MeshBasicMaterial({ color: 0x4a4946, side: THREE.BackSide })));
  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({ color: 0x8d8c88 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1; s.add(floor);
  const box = (w: number, h: number, power: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.985, 0.96).multiplyScalar(power), side: THREE.DoubleSide, toneMapped: false }),
    );
    m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m);
  };
  box(12, 8, 4.2, -2, 20, 5);     // overhead softbox (smaller → reads as a highlight, not a wash)
  box(3, 18, 6, -18, 7, 2);       // left strip → long highlights on frame edges
  box(3, 18, 4.5, 18, 8, -3);     // right strip
  box(24, 3, 1.6, 0, 6, -20);     // back kicker
  box(22, 5, 0.6, 0, 17, -11);    // mirror-angle panel → sheen on flat key tops
  box(20, 4, 1.0, 0, 3, 22);      // low front bounce
  const card = new THREE.Mesh(new THREE.PlaneGeometry(26, 7), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(2.6), side: THREE.DoubleSide, toneMapped: false }));
  card.position.set(0, -0.8, 10); card.rotation.x = -Math.PI / 2 + 0.5; s.add(card); // bright band in the frame's front face
  // fromScene() is fixed at 256 px per face, which makes every reflection soft; render a 1024 cube instead
  const cubeRT = new THREE.WebGLCubeRenderTarget(1024, { type: THREE.HalfFloatType, generateMipmaps: false });
  new THREE.CubeCamera(0.1, 100, cubeRT).update(renderer, s);
  const tex = pmrem.fromCubemap(cubeRT.texture).texture;
  cubeRT.dispose();
  pmrem.dispose();
  s.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose(); });
  return tex;
}

/** layer 1 = small details (legends, labels, LEDs, screws): drawn on screen but skipped by reflection + shadow passes */
export const DETAIL_LAYER = 1;

export function createStage(canvas: HTMLCanvasElement, initialTier: Tier) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: TIERS[initialTier].antialias, powerPreference: 'high-performance' });
  let tier = initialTier;
  let DPR = pixelRatioFor(TIERS[tier]);
  renderer.setPixelRatio(DPR);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;          // the light never moves: re-render shadows only when parts move
  renderer.shadowMap.needsUpdate = true;
  RectAreaLightUniformsLib.init();

  const scene = new THREE.Scene();
  // studio sweep behind the device, one per theme
  const backdrop = (stops: [number, string][]) => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 512;
    const g = c.getContext('2d')!, gr = g.createLinearGradient(0, 0, 0, 512);
    stops.forEach(([o, col]) => gr.addColorStop(o, col));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 512);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const BACKDROP = {
    light: backdrop([[0, '#d9d8d4'], [0.45, '#ecebe8'], [1, '#dedddA']]),
    dark: backdrop([[0, '#1f1f1d'], [0.45, '#3a3a37'], [1, '#262624']]),
  };
  const envTex = studioEnv(renderer);
  scene.environment = envTex;

  const camera = new THREE.PerspectiveCamera(17, 1, 0.1, 300);
  camera.layers.enable(DETAIL_LAYER);

  // key light (casts the shadows), an area softbox for glints, cool rim
  const hemi = new THREE.HemisphereLight(0xfffaf2, 0x8f8d88, 0.2);   // low fill → surfaces keep their shape
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff6ea, 2.55);
  sun.position.set(-2.5, 14, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(TIERS[tier].shadowMap, TIERS[tier].shadowMap);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 4, far: 30 });
  sun.shadow.radius = 5; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
  scene.add(sun);
  const softbox = new THREE.RectAreaLight(0xffffff, 2.6, 9, 6);
  softbox.position.set(-1.5, 9, 4.5); softbox.lookAt(0, 0, 0); scene.add(softbox);
  // the softbox drifts a little with the pointer so highlights slide across keys and metal
  const SOFTBOX_HOME = softbox.position.clone();
  const pointer = new THREE.Vector2(), pointerSmooth = new THREE.Vector2();
  const setPointer = (nx: number, ny: number) => pointer.set(nx, ny);
  /** returns true while the light is still gliding (i.e. a redraw is needed) */
  const stepLights = () => {
    if (pointerSmooth.distanceToSquared(pointer) < 1e-6) return false;
    pointerSmooth.lerp(pointer, 0.06);
    softbox.position.set(SOFTBOX_HOME.x + pointerSmooth.x * 3.2, SOFTBOX_HOME.y, SOFTBOX_HOME.z - pointerSmooth.y * 2.4);
    softbox.lookAt(0, 0, 0);
    return true;
  };
  const rim = new THREE.DirectionalLight(0xe9eef7, 1.0); rim.position.set(7, 4, -7); scene.add(rim);

  // glossy tabletop reflection (low resolution: it is blurred anyway)
  const reflSize = () => {
    const f = Math.max(TIERS[tier].reflection, 0.1);
    return [Math.round(window.innerWidth * DPR * f), Math.round(window.innerHeight * DPR * f)] as const;
  };
  const floor = createGlossyFloor(...reflSize());
  floor.visible = TIERS[tier].reflection > 0;
  scene.add(floor);

  // ground: shadow catcher + soft contact shadow
  const contactMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, depthWrite: false });
  const groundMat = new THREE.ShadowMaterial({ opacity: 0.22 });
  // just big enough for the device's shadow — a huge plane would shade millions of empty pixels
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(18, 14), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  {
    const c = document.createElement('canvas'); c.width = 512; c.height = 360;
    const g = c.getContext('2d')!; g.filter = 'blur(26px)'; g.fillStyle = '#000';
    g.beginPath(); g.roundRect(70, 70, 372, 220, 30); g.fill();
    contactMat.map = new THREE.CanvasTexture(c);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(13, 9.1), contactMat);
    m.rotation.x = -Math.PI / 2; m.position.set(0, 0.002, 0.25); scene.add(m);
  }

  /** light: bright studio sweep · dark: device lit on a near-black table, stronger reflection */
  function setTheme(t: Theme) {
    invalidate(); moveShadows();
    scene.background = BACKDROP[t];
    const dark = t === 'dark';
    groundMat.opacity = dark ? 0.55 : 0.22;
    contactMat.opacity = dark ? 0.85 : 0.5;
    hemi.intensity = dark ? 0.12 : 0.2;
    rim.intensity = dark ? 1.4 : 1.0;            // brighter edge light separates the dark panels from the dark backdrop
    floor.setStrength(dark ? 0.8 : 0.62);
    bloomScale = dark ? 0.55 : 1; bloom.strength = TIERS[tier].bloom * bloomScale;
  }

  // post: ambient occlusion → contact shadows between keys, knobs and panels
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(DPR);
  const ao = new N8AOPass(scene, camera, window.innerWidth, window.innerHeight);
  Object.assign(ao.configuration, { aoRadius: 0.45, distanceFalloff: 0.35, intensity: 3.2, color: new THREE.Color(0x0b0a09), gammaCorrection: false, screenSpaceRadius: false, halfRes: TIERS[tier].aoHalfRes });
  ao.setQualityMode(TIERS[tier].ao ?? 'Performance');
  // N8AO renders the scene itself; when AO is off a plain render pass takes over
  const plain = new RenderPass(scene, camera);
  const setAO = (on: boolean) => { ao.enabled = on; plain.enabled = !on; };
  setAO(!!TIERS[tier].ao);
  composer.addPass(plain);
  composer.addPass(ao);
  // bloom runs on the linear HDR image, so only real highlights (> ~1) glow
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), TIERS[tier].bloom, 0.4, 2.2);   // threshold well above lit white plastic
  bloom.enabled = TIERS[tier].bloom > 0;
  let bloomScale = 1;                      // glow reads stronger on a dark backdrop
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(TARGET);
  controls.enablePan = false;
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minPolarAngle = 0; controls.maxPolarAngle = 1.3;
  controls.minAzimuthAngle = -1.3; controls.maxAzimuthAngle = 1.3;
  controls.rotateSpeed = 0.6;

  function fitCamera() {
    const aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect; camera.updateProjectionMatrix();
    const vf = (camera.fov * Math.PI) / 360, hf = Math.atan(Math.tan(vf) * aspect);
    const dist = Math.max(6.4 / Math.tan(hf), 4.7 / Math.tan(vf));
    controls.minDistance = dist * 0.45; controls.maxDistance = dist * 1.8;
    return dist;
  }
  function resetView() {
    const d = fitCamera();
    camera.position.copy(TARGET).addScaledVector(VIEW_DIR, d);
    controls.update();
  }

  /* intro: glide in from a low angle; any interaction cancels it */
  let intro: { t0: number; dur: number; d: number; el1: number } | null = null;
  const startIntro = () => { intro = { t0: performance.now(), dur: 2800, d: fitCamera(), el1: Math.PI / 2 - 0.55 }; };
  const cancelIntro = () => { intro = null; };
  const stepIntro = (now: number) => {
    if (!intro) return;
    const { t0, dur, d, el1 } = intro;
    const p = clamp((now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    const az = -0.6 * (1 - e), el = 0.3 + (el1 - 0.3) * e, dist = d * (1.35 - 0.35 * e);
    camera.position.set(
      TARGET.x + Math.sin(az) * Math.cos(el) * dist,
      TARGET.y + Math.sin(el) * dist,
      TARGET.z + Math.cos(az) * Math.cos(el) * dist,
    );
    if (p >= 1) intro = null;
  };

  let viewSet = false;
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    DPR = pixelRatioFor(TIERS[tier]);
    renderer.setPixelRatio(DPR); composer.setPixelRatio(DPR);
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    floor.getRenderTarget().setSize(...reflSize());
    invalidate();
    const prev = camera.position.distanceTo(controls.target);
    fitCamera();
    if (!intro && (!viewSet || prev > controls.maxDistance || prev < controls.minDistance)) { resetView(); viewSet = true; }
  }

  function dispose() {
    controls.dispose();
    floor.dispose();
    composer.dispose();
    renderer.dispose();
    envTex.dispose();
    BACKDROP.light.dispose(); BACKDROP.dark.dispose();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
    });
  }

  /* ---------- render on demand ---------- */
  let dirtyFrames = 2;
  /** request redraws (n frames covers post-processing settling) */
  function invalidate(n = 2) { dirtyFrames = Math.max(dirtyFrames, n); }
  /** shadows are re-rendered only when something that casts them moves */
  function moveShadows() { renderer.shadowMap.needsUpdate = true; }
  function takeDirty() { const d = dirtyFrames > 0; if (d) dirtyFrames--; return d; }

  function setTier(t: Tier) {
    if (t === tier) return;
    tier = t;
    const spec = TIERS[t];
    setAO(!!spec.ao);
    if (spec.ao) ao.setQualityMode(spec.ao);
    ao.configuration.halfRes = spec.aoHalfRes;
    bloom.enabled = spec.bloom > 0; bloom.strength = spec.bloom * bloomScale;
    floor.visible = spec.reflection > 0;
    if (sun.shadow.mapSize.x !== spec.shadowMap) {
      sun.shadow.mapSize.set(spec.shadowMap, spec.shadowMap);
      sun.shadow.map?.dispose(); (sun.shadow as { map: THREE.WebGLRenderTarget | null }).map = null;
      moveShadows();
    }
    resize();
  }

  return {
    renderer, scene, camera, controls, composer, resize, resetView, startIntro, cancelIntro, stepIntro, hasIntro: () => !!intro,
    setPointer, stepLights, setTheme, dispose, invalidate, takeDirty, moveShadows, setTier, getTier: () => tier,
  };
}

export type Stage = ReturnType<typeof createStage>;
