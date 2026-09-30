import * as THREE from 'three';
import { KEYS } from '../keys';
import { disposeSequencer, drawSteps, flush, hooks, importFromHash, load, pat, q, setCur, syncState, uiQ, updatePatUI } from '../sequencer';
import { anchors } from '../anchors';
import { S, closeAudio, hasAudio, audioTime } from '../audio';
import { ui } from '../store';
import { applyTheme, hasSavedTheme, readTheme } from '../theme';
import { buildDevice, type KnobKey, type KeyView } from './device';
import { drawLegend, setFont } from './geometry';
import { attachInteraction } from './interaction';
import { createMaterials } from './materials';
import { createStage } from './stage';

const C_HOT = new THREE.Color('#ff6a2a'), C_WHITE = new THREE.Color('#ffffff');

function legendColor(v: KeyView, t: number) {
  const { key, baseColor } = v;
  const on = t < key.flashUntil || key.held;
  if (ui.get().panel === 'keys' && ui.get().editKey === key.id) return Math.floor(t / 400) % 2 ? '#ff6a2a' : baseColor;   // being edited
  if (key.id === 'play') return S.playing ? '#d9582a' : baseColor;
  if (key.id === 'rec') return S.rec ? (Math.floor(t / 500) % 2 ? '#8c3a1c' : '#ff5a1f') : q.recHeld ? '#d9582a' : baseColor;
  if (key.id === 'metro') return S.metro ? '#ff8a4f' : baseColor;
  return on ? (key.style === 'orange' ? '#ffffff' : '#e8531f') : baseColor;
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
export type Progress = (p: number, label: string) => void;

/**
 * Builds the whole instrument on a canvas, reporting progress for the preloader.
 * Resolves with a cleanup function once the first frame has been drawn.
 */
export async function startBeatPad(canvas: HTMLCanvasElement, fontFamily: string, progress: Progress, cancelled: () => boolean) {
  setFont(fontFamily);
  progress(0.55, 'setting up the studio'); await nextFrame();
  if (cancelled()) return () => {};
  const stage = createStage(canvas);
  progress(0.66, 'machining the parts'); await nextFrame();
  const dev = buildDevice(stage.scene, createMaterials());

  const syncControls = () => {
    (Object.keys(dev.knobs) as KnobKey[]).forEach((k) => dev.setKnobVisual(k));
    dev.setFaderVisual();
  };
  hooks.syncControls = syncControls;
  hooks.applyLook = dev.applyLook;
  load();
  dev.applyLook();
  importFromHash();
  (Object.keys(dev.knobs) as KnobKey[]).forEach((k) => dev.setKnobVisual(k, true));
  dev.setFaderVisual();

  // screen positions for the guide
  const tmp = new THREE.Vector3();
  const toScreen = (v: THREE.Vector3) => {
    tmp.copy(v).project(stage.camera);
    if (tmp.z > 1) return null;
    return { x: (tmp.x * 0.5 + 0.5) * window.innerWidth, y: (-tmp.y * 0.5 + 0.5) * window.innerHeight };
  };
  const keyTop = (id: string) => () => {
    const g = dev.keys.find((v) => v.key.id === id)!.grp;
    return toScreen(g.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.25, 0)));
  };
  anchors.keys = keyTop('k5');
  anchors.play = keyTop('play');
  anchors.steps = () => toScreen(dev.leds[7].pos.clone().lerp(dev.leds[8].pos, 0.5));
  updatePatUI(); syncState();
  const onHash = () => { if (importFromHash()) syncControls(); };   // share link pasted into an open tab
  window.addEventListener('hashchange', onHash);

  const inter = attachInteraction(stage, dev);
  const onResize = () => stage.resize();
  window.addEventListener('resize', onResize);
  const onPointer = (e: PointerEvent) => stage.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  window.addEventListener('pointermove', onPointer);
  stage.resize();

  // theme: the inline <head> script already set data-theme; mirror it into the scene and follow later changes
  let theme = readTheme();
  stage.setTheme(theme);
  ui.set({ theme });
  const unsubTheme = ui.subscribe(() => {
    const t = ui.get().theme;
    if (t !== theme) { theme = t; stage.setTheme(t); }
  });
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onSystem = (e: MediaQueryListEvent) => {
    if (hasSavedTheme()) return;
    const t = e.matches ? 'dark' : 'light';
    applyTheme(t, false); ui.set({ theme: t });
  };
  mq.addEventListener('change', onSystem);

  // warm up every shader now, so the first interaction doesn't stutter
  progress(0.8, 'polishing the metal'); await nextFrame();
  try { await stage.renderer.compileAsync(stage.scene, stage.camera); } catch { /* compile lazily instead */ }
  progress(0.94, 'first light');

  let raf = 0, pulse = 0;
  const frame = () => {
    const t = performance.now();

    // events queued by the audio scheduler, released when their moment arrives
    if (hasAudio()) {
      const now = audioTime();
      while (uiQ.length && uiQ[0].t <= now) {
        const ev = uiQ.shift()!;
        if (ev.step != null) setCur(ev.step);
        else if (ev.id) {
          const k = KEYS.find((x) => x.id === ev.id);
          if (k) k.flashUntil = t + 90;
          if (ev.id === 'k1' || ev.id === 'k0') q.pulse = 1;
        }
      }
    }

    dev.keys.forEach((v) => {
      const k = v.key;
      const target = k.held || t < k.flashUntil ? -0.085 : 0;
      v.off += (target - v.off) * (target < v.off ? 0.6 : 0.3);
      v.rx += (k.tx - v.rx) * 0.4; v.rz += (k.tz - v.rz) * 0.4;
      v.grp.position.y = v.y0 + v.off; v.grp.rotation.set(v.rx, 0, v.rz);
      const col = legendColor(v, t);
      if (col !== v.curColor) { v.curColor = col; drawLegend(v.canvas, k.L, col); v.tex.needsUpdate = true; }
    });

    for (const key in dev.knobs) { const kn = dev.knobs[key as KnobKey]; kn.cur += (kn.target - kn.cur) * 0.35; kn.spin.rotation.y = kn.cur; }

    inter.stepPhysics();
    pulse = Math.max(pulse * 0.86, q.pulse); q.pulse = 0;                   // kick pulse (sequencer sets it, we decay it)
    dev.jogGrp.position.y = dev.JOG.y - 0.014 * pulse;

    // step lights
    const set = pat();
    dev.leds.forEach((L, i) => {
      const isCur = i === q.cur, isSel = i === q.selStep;
      let ei = 0, gi = 0;
      if (isCur) { ei = 3.2; gi = 0.9; }
      else if (isSel) { const b = 0.5 + 0.5 * Math.sin(t / 140); ei = 1.2 + 1.6 * b; gi = 0.35 + 0.4 * b; }
      else if (set[i].size) { ei = 0.55; gi = 0.12; }
      L.m.emissiveIntensity += (ei - L.m.emissiveIntensity) * 0.5;
      L.gm.opacity += (gi - L.gm.opacity) * 0.5;
      L.m.emissive.copy(isSel && !isCur ? C_WHITE : C_HOT);
    });

    stage.stepLights();
    stage.stepIntro(t);
    stage.controls.update();
    stage.composer.render();
    raf = requestAnimationFrame(frame);
  };
  stage.composer.render();                 // first frame (also compiles the post-processing passes)
  await nextFrame();
  raf = requestAnimationFrame(frame);
  stage.startIntro();
  progress(1, 'ready');
  ui.set({ ready: true });

  const stop = () => {
    hooks.syncControls = () => {}; hooks.applyLook = () => {};
    Object.keys(anchors).forEach((k) => delete anchors[k]);
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', onPointer);
    window.removeEventListener('hashchange', onHash);
    unsubTheme();
    mq.removeEventListener('change', onSystem);
    inter.dispose();
    KEYS.forEach((k) => { k.held = false; k.tx = k.tz = 0; k.flashUntil = 0; });
    disposeSequencer();
    closeAudio();
    flush();
    stage.dispose();
    drawSteps(); setCur(-1);
    ui.set({ ready: false, hint: 'tap any key to start audio' });
  };
  if (cancelled()) { stop(); return () => {}; }
  return stop;
}
