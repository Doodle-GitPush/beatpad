import * as THREE from 'three';
import { S } from '../audio';
import { KEYS, type Key } from '../keys';
import type { Materials } from './materials';
import {
  Dz, W, KEY_BOTTOM, KEY_H, RoundedBoxGeometry, bumpGeo, drawLegend, gearGeo, getFont, keyGeo, slab,
} from './geometry';

export type KnobKey = 'filter' | 'echo' | 'pitch' | 'swing';

export interface KeyView {
  key: Key; grp: THREE.Group; canvas: HTMLCanvasElement; tex: THREE.CanvasTexture;
  y0: number; off: number; rx: number; rz: number; w: number; d: number; baseColor: string; curColor: string;
}
export interface KnobView { grp: THREE.Group; spin: THREE.Group; target: number; cur: number }
export interface Led { m: THREE.MeshStandardMaterial; gm: THREE.MeshBasicMaterial }

export type Pickable =
  | { type: 'key'; k: Key }
  | { type: 'knob'; key: KnobKey }
  | { type: 'fader' }
  | { type: 'roller' }
  | { type: 'jog' }
  | { type: 'step'; i: number };

export const PANEL_TOP = 0.66;

export function buildDevice(scene: THREE.Scene, MAT: Materials) {
  const interactive: THREE.Object3D[] = [];
  const add = <T extends THREE.Object3D>(mesh: T, parent: THREE.Object3D = scene, cast = true, receive = true) => {
    mesh.castShadow = cast; mesh.receiveShadow = receive; parent.add(mesh);
    return mesh;
  };
  const pickable = (o: THREE.Object3D, data: Pickable) => { o.userData = data; interactive.push(o); };

  /* ---------- numpad frame ---------- */
  {
    const frame = add(new THREE.Mesh(slab(4.12 - 0.16, 5.95 - 0.16, 0.52, 0.16, 0.08, 3.94, 5.77, 0.12), MAT.alu));
    frame.position.set(W(206), 0, Dz(297.5));
    const floor = add(new THREE.Mesh(new RoundedBoxGeometry(3.94, 0.5, 5.77, 3, 0.06), MAT.well), scene, false, true);
    floor.position.set(W(206), 0.25, Dz(297.5));
  }

  /* ---------- keycaps ---------- */
  const CELL_W = 91.25, CELL_D = 89.67, GAP = 5;
  const keys: KeyView[] = KEYS.map((key) => {
    const [c, r, cs = 1, rs = 1] = key.g;
    const wpx = cs * CELL_W + (cs - 1) * GAP, dpx = rs * CELL_D + (rs - 1) * GAP;
    const x = 16 + c * (CELL_W + GAP) + wpx / 2, y = 16 + r * (CELL_D + GAP) + dpx / 2;
    const w = wpx / 100 - 0.03, d = dpx / 100 - 0.03;
    const grp = new THREE.Group();
    grp.position.set(W(x), KEY_BOTTOM + KEY_H / 2, Dz(y));
    const mat = key.style === 'orange' ? MAT.keyO : key.style === 'dark' ? MAT.keyD : MAT.keyW;
    add(new THREE.Mesh(keyGeo(w, d), mat), grp);

    // legend decal on the top face
    const tw = w - 0.26, td = d - 0.26;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(tw * 256); canvas.height = Math.round(td * 256);
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const baseColor = key.style === 'orange' ? '#fde6d9' : key.style === 'dark' ? '#d6d6d6' : '#6a6964';
    drawLegend(canvas, key.L, baseColor); tex.needsUpdate = true;
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(tw, td),
      new THREE.MeshPhysicalMaterial({ map: tex, transparent: true, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }),
    );
    decal.rotation.x = -Math.PI / 2; decal.position.set(0, KEY_H / 2 + 0.003, -0.035);
    grp.add(decal);

    scene.add(grp);
    pickable(grp, { type: 'key', k: key });
    return { key, grp, canvas, tex, y0: grp.position.y, off: 0, rx: 0, rz: 0, w, d, baseColor, curColor: baseColor };
  });

  /* ---------- panels ---------- */
  const screws = (cx: number, cz: number, w: number, d: number) => {
    const g1 = new THREE.CylinderGeometry(0.065, 0.065, 0.012, 28), g2 = new THREE.CylinderGeometry(0.03, 0.03, 0.014, 20);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const x = cx + sx * (w / 2 - 0.19), z = cz + sz * (d / 2 - 0.19);
      add(new THREE.Mesh(g1, MAT.screw)).position.set(x, PANEL_TOP, z);
      add(new THREE.Mesh(g2, MAT.slot)).position.set(x, PANEL_TOP + 0.001, z);
    });
  };
  const label = (text: string, x: number, z: number, lift = 0.004, size = 0.1) => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 48;
    const g = c.getContext('2d')!;
    g.font = `500 26px ${getFont()}`;
    if ('letterSpacing' in g) (g as unknown as { letterSpacing: string }).letterSpacing = '6px';
    g.fillStyle = 'rgba(255,255,255,.7)'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text.toUpperCase(), 128, 26);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry((size * 256) / 48, size), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, PANEL_TOP + lift, z); scene.add(m);
  };
  const panel = (x0: number, w: number) => {
    const cx = W(x0 + w / 2), cz = Dz(297.5);
    add(new THREE.Mesh(slab(w / 100 - 0.16, 5.95 - 0.16, 0.5, 0.14, 0.08), MAT.panel)).position.set(cx, 0, cz);
    screws(cx, cz, w / 100, 5.95);
    return { px: (v: number) => W(x0 + v) };
  };
  const mound = (x: number, z: number, R: number, h: number, flat = 0, sz = 1) => {
    const geo = bumpGeo(R, h, flat);
    if (sz !== 1) { geo.scale(1, 1, sz); geo.computeVertexNormals(); }
    add(new THREE.Mesh(geo, MAT.panel)).position.set(x, PANEL_TOP - 0.002, z);
  };

  /* ---------- knobs ---------- */
  const knobs = {} as Record<KnobKey, KnobView>;
  const knob = (key: KnobKey, x: number, z: number, R: number) => {
    const grp = new THREE.Group(); grp.position.set(x, PANEL_TOP, z);
    const spin = new THREE.Group(); grp.add(spin);
    add(new THREE.Mesh(gearGeo(R, 0.3), MAT.knurl), spin);
    add(new THREE.Mesh(new THREE.CylinderGeometry(R * 0.8, R * 0.82, 0.04, 64), MAT.kcap), spin).position.y = 0.334;
    add(new THREE.Mesh(new RoundedBoxGeometry(0.028, 0.012, R * 0.42, 2, 0.005), MAT.mark), spin).position.set(0, 0.356, -R * 0.5);
    scene.add(grp); pickable(grp, { type: 'knob', key });
    knobs[key] = { grp, spin, target: 0, cur: 0 };
    setKnobVisual(key, true);
  };
  const setKnobVisual = (key: KnobKey, snap = false) => {
    const kn = knobs[key];
    kn.target = (-(-135 + S[key] * 270) * Math.PI) / 180;
    if (snap) { kn.cur = kn.target; kn.spin.rotation.y = kn.cur; }
  };

  const mid = panel(420, 165);
  const right = panel(593, 410);

  mound(mid.px(82), Dz(88), 0.66, 0.07, 0.18);
  mound(mid.px(82), Dz(205), 0.66, 0.07, 0.18);
  mound(mid.px(82), Dz(420), 0.42, 0.05, 0.12, 3.3);
  knob('filter', mid.px(82), Dz(88), 0.31);
  knob('echo', mid.px(82), Dz(205), 0.31);
  label('filter', mid.px(82), Dz(136), 0.035);
  label('echo', mid.px(82), Dz(253), 0.035);
  label('vol', mid.px(82), Dz(566));

  mound(right.px(97), Dz(112), 0.78, 0.075, 0.22);
  mound(right.px(305), Dz(112), 0.72, 0.06, 0.3);
  mound(right.px(232), Dz(350), 1.72, 0.085, 1.42);
  mound(right.px(201), Dz(112), 0.5, 0.055, 0.14);
  knob('pitch', right.px(97), Dz(112), 0.36);
  knob('swing', right.px(201), Dz(112), 0.24);
  label('pitch', right.px(97), Dz(166), 0.03);
  label('swing', right.px(201), Dz(160), 0.03);
  label('kit', right.px(305), Dz(166), 0.03);
  label('tempo', right.px(232), Dz(566));

  /* ---------- fader ---------- */
  const FADER = { x: mid.px(82), z0: Dz(300), z1: Dz(540), y: PANEL_TOP + 0.05 };
  const faderCap = new THREE.Group();
  {
    add(new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.03, 2.52, 2, 0.012), MAT.slot), scene, false, true)
      .position.set(FADER.x, FADER.y + 0.002, (FADER.z0 + FADER.z1) / 2);
    add(new THREE.Mesh(new RoundedBoxGeometry(0.64, 0.3, 0.46, 5, 0.11), MAT.black), faderCap).position.y = 0.22;
    add(new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.006, 0.016), MAT.mark), faderCap).position.y = 0.373;
    faderCap.position.set(FADER.x, FADER.y, 0);
    scene.add(faderCap); pickable(faderCap, { type: 'fader' });
    // generous hit area along the slot; raycast-only (never added to the scene)
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 2.8), new THREE.MeshBasicMaterial());
    hit.position.set(FADER.x, FADER.y + 0.15, (FADER.z0 + FADER.z1) / 2);
    hit.updateMatrixWorld(true); pickable(hit, { type: 'fader' });
    // printed scale; the orange tick is the 80 % detent
    for (let i = 0; i <= 10; i++) {
      const z = FADER.z0 + (i / 10) * (FADER.z1 - FADER.z0), len = i % 5 === 0 ? 0.16 : 0.09;
      [-1, 1].forEach((sx) => {
        add(new THREE.Mesh(new THREE.BoxGeometry(len, 0.006, 0.012), i === 2 ? MAT.tabO : MAT.tick), scene, false, false)
          .position.set(FADER.x + sx * (0.42 + len / 2), PANEL_TOP + 0.004, z);
      });
    }
  }
  const setFaderVisual = () => { faderCap.position.z = FADER.z0 + (1 - S.vol) * (FADER.z1 - FADER.z0); };
  setFaderVisual();

  /* ---------- roller ---------- */
  const rollerX = right.px(305), rollerZ = Dz(112);
  add(new THREE.Mesh(slab(0.9, 0.78, 0.05, 0.1, 0.03, 0.76, 0.64, 0.06), MAT.black)).position.set(rollerX, PANEL_TOP + 0.02, rollerZ);
  add(new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.2, 0.66, 3, 0.05), MAT.slot), scene, false, true).position.set(rollerX, PANEL_TOP - 0.05, rollerZ);
  const rollerGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.72, 96, 1); rollerGeo.rotateZ(Math.PI / 2);
  const rollerMesh = add(new THREE.Mesh(rollerGeo, MAT.roller));
  rollerMesh.position.set(rollerX, PANEL_TOP - 0.12, rollerZ);
  pickable(rollerMesh, { type: 'roller' });

  /* ---------- jog wheel ---------- */
  const JOG = { x: right.px(232), z: Dz(350), y: PANEL_TOP + 0.085 };
  const jogPts = [[0.0001, 0], [1.37, 0], [1.395, 0.02], [1.395, 0.3], [1.39, 0.35], [1.36, 0.37], [1.3, 0.375], [1.2, 0.36], [1.17, 0.33], [1.14, 0.318], [1.0, 0.31], [0.5, 0.302], [0.0001, 0.3]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const jogGrp = new THREE.Group(); jogGrp.position.set(JOG.x, JOG.y, JOG.z);
  add(new THREE.Mesh(new THREE.LatheGeometry(jogPts, 128), MAT.jog), jogGrp);
  const dimple = add(new THREE.Mesh(new THREE.CircleGeometry(0.08, 32), MAT.dimple), jogGrp, false, true);
  dimple.rotation.x = -Math.PI / 2; dimple.position.set(0, 0.316, -0.98);
  scene.add(jogGrp); pickable(jogGrp, { type: 'jog' });

  /* ---------- small parts ---------- */
  ([[W(61), 0.18, MAT.tabW], [W(332), 0.12, MAT.tabO], [W(918), 0.12, MAT.tabO]] as const).forEach(([x, w, m]) => {
    add(new THREE.Mesh(new RoundedBoxGeometry(w, 0.1, 0.06, 2, 0.02), m)).position.set(x, 0.42, Dz(0) - 0.02);
  });

  /* ---------- 16 step lights ---------- */
  const leds: Led[] = [];
  {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d')!, gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,200,150,1)'); gr.addColorStop(0.35, 'rgba(255,120,60,.45)'); gr.addColorStop(1, 'rgba(255,90,30,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.SRGBColorSpace;
    const bez = new RoundedBoxGeometry(0.1, 0.03, 0.06, 2, 0.012), lens = new RoundedBoxGeometry(0.075, 0.03, 0.038, 2, 0.01), hitG = new THREE.BoxGeometry(0.13, 0.2, 0.12);
    for (let i = 0; i < 16; i++) {
      const x = right.px(122 + i * 13 + Math.floor(i / 4) * 8), z = Dz(548);
      add(new THREE.Mesh(bez, MAT.slot), scene, false, true).position.set(x, PANEL_TOP + 0.006, z);
      const m = new THREE.MeshStandardMaterial({ color: '#3a2a24', roughness: 0.35, emissive: new THREE.Color('#ff6a2a'), emissiveIntensity: 0 });
      add(new THREE.Mesh(lens, m), scene, false, false).position.set(x, PANEL_TOP + 0.012, z);
      const gm = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), gm);
      gl.rotation.x = -Math.PI / 2; gl.position.set(x, PANEL_TOP + 0.03, z); scene.add(gl);
      const hit = new THREE.Mesh(hitG, new THREE.MeshBasicMaterial());
      hit.position.set(x, PANEL_TOP + 0.05, z); hit.updateMatrixWorld(true);
      pickable(hit, { type: 'step', i });
      leds.push({ m, gm });
    }
  }

  return { interactive, keys, knobs, setKnobVisual, FADER, faderCap, setFaderVisual, rollerMesh, JOG, jogGrp, leds };
}

export type Device = ReturnType<typeof buildDevice>;
