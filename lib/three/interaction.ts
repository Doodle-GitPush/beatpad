import * as THREE from 'three';
import { KITS, S, clamp, cutoff, tick } from '../audio';
import { KEY_BY_CODE } from '../keys';
import { clearSelection, ensureAudio, paramChanged, press, q, release, selectStep, setHit } from '../sequencer';
import { ui } from '../store';
import type { Device, KnobKey, Pickable } from './device';
import type { Stage } from './stage';

const FMT: Record<KnobKey, (v: number) => string> = {
  filter: (v) => { const f = cutoff(v); return 'filter ' + (f >= 1000 ? (f / 1000).toFixed(1) + 'k' : Math.round(f)) + 'hz'; },
  echo: (v) => 'echo ' + Math.round(v * 100) + '%',
  swing: (v) => 'swing ' + Math.round(v * 100) + '%',
  pitch: (v) => { const st = Math.round((v - 0.5) * 24); return 'pitch ' + (st > 0 ? '+' : '') + st + ' st'; },
};

type Drag =
  | { type: 'key'; k: import('../keys').Key }
  | { type: 'knob'; key: KnobKey; y0: number; v0: number }
  | { type: 'fader' }
  | { type: 'roller'; y: number; moved: boolean }
  | { type: 'jog'; a: number | null; v: number };

export function attachInteraction(stage: Stage, dev: Device) {
  const { camera } = stage;
  const canvas = stage.renderer.domElement;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), pickPoint = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  let jogRot = 0, rollAcc = 0, jogDown = false;
  const phys = { jogVel: 0 };

  /* ---------- HUD ---------- */
  const hud = (obj: THREE.Object3D, text: string, lift = 0.5) => {
    obj.getWorldPosition(tmp); tmp.y += lift; tmp.project(camera);
    ui.showHud((tmp.x * 0.5 + 0.5) * window.innerWidth, (-tmp.y * 0.5 + 0.5) * window.innerHeight - 8, text);
  };

  /* ---------- control setters ---------- */
  // pitch moves in semitone detents: click each time it crosses one
  const semis = () => Math.round((S.pitch - 0.5) * 24);
  let lastSemi = semis();
  const setKnob = (key: KnobKey, v: number) => {
    S[key] = clamp(v); dev.setKnobVisual(key); paramChanged(key); hud(dev.knobs[key].grp, FMT[key](S[key]));
    if (key === 'pitch' && semis() !== lastSemi) { lastSemi = semis(); tick(); }
  };
  const setVol = (v: number) => {
    v = clamp(v); if (Math.abs(v - 0.8) < 0.025) v = 0.8;          // detent
    S.vol = v; dev.setFaderVisual(); stage.invalidate(); stage.moveShadows(); paramChanged('vol'); hud(dev.faderCap, 'vol ' + Math.round(S.vol * 100) + '%');
  };
  const setKit = (k: number) => { S.kit = (k + KITS.length) % KITS.length; paramChanged('kit'); hud(dev.rollerMesh, 'kit ' + KITS[S.kit].name); };
  // the jog wheel ratchets: one click per whole BPM, i.e. every 4° of spin
  let lastBpm = Math.round(S.bpm);
  const turnJog = (deg: number) => {
    jogRot += deg; dev.jogGrp.rotation.y = (-jogRot * Math.PI) / 180; stage.invalidate();
    S.bpm = clamp(S.bpm + deg / 4, 60, 200); paramChanged('bpm');
    if (Math.round(S.bpm) !== lastBpm) { lastBpm = Math.round(S.bpm); tick('ratchet'); }
    hud(dev.jogGrp, 'tempo ' + Math.round(S.bpm) + ' bpm', 0.6);
  };
  const roll = (dy: number) => {
    dev.rollerMesh.rotation.x += dy * 0.012; stage.invalidate();
    rollAcc += dy;
    while (Math.abs(rollAcc) >= 28) { const dir = Math.sign(rollAcc); rollAcc -= dir * 28; setKit(S.kit - dir); }
  };

  /* ---------- picking ---------- */
  const setRay = (e: { clientX: number; clientY: number }) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  };
  const pick = (e: { clientX: number; clientY: number }): { obj: THREE.Object3D; data: Pickable } | null => {
    setRay(e);
    for (const h of ray.intersectObjects(dev.interactive, true)) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.type) o = o.parent;
      if (o) { pickPoint.copy(h.point); return { obj: o, data: o.userData as Pickable }; }
    }
    return null;
  };
  const planeHit = (y: number) => { const p = new THREE.Vector3(); return ray.ray.intersectPlane(new THREE.Plane(UP, -y), p) ? p : null; };
  const faderFromEvent = (e: PointerEvent) => {
    setRay(e); const p = planeHit(dev.FADER.y + 0.3);
    if (p) setVol(1 - (p.z - dev.FADER.z0) / (dev.FADER.z1 - dev.FADER.z0));
  };
  const jogAngle = (e: PointerEvent) => {
    setRay(e); const p = planeHit(dev.JOG.y + 0.3);
    return p ? (Math.atan2(p.z - dev.JOG.z, p.x - dev.JOG.x) * 180) / Math.PI : null;
  };

  /* ---------- pointer ---------- */
  const drags = new Map<number, Drag>();
  let hoverEvt: PointerEvent | null = null, hoverRaf = 0;

  // capture phase: runs before OrbitControls' own listener, so hitting a control never starts an orbit
  const onDown = (e: PointerEvent) => {
    const hit = pick(e);
    if (!hit) return;
    e.stopImmediatePropagation(); e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    ensureAudio();
    stage.cancelIntro();
    const { obj, data } = hit;
    if (data.type === 'key') {
      const view = dev.keys.find((v) => v.key === data.k)!;
      const lp = obj.worldToLocal(pickPoint.clone());               // tilt the cap toward where it was pressed
      data.k.tx = clamp(lp.z / (view.d / 2), -1, 1) * 0.075;
      data.k.tz = -clamp(lp.x / (view.w / 2), -1, 1) * 0.075;
      press(data.k); drags.set(e.pointerId, { type: 'key', k: data.k });
    } else if (data.type === 'step') {
      selectStep(data.i); hud(obj, q.selStep >= 0 ? 'step ' + (data.i + 1) + ' · press keys' : 'edit off', 0.3);
    } else if (data.type === 'knob') {
      drags.set(e.pointerId, { type: 'knob', key: data.key, y0: e.clientY, v0: S[data.key] });
      hud(obj, FMT[data.key](S[data.key]));
    } else if (data.type === 'fader') {
      drags.set(e.pointerId, { type: 'fader' }); faderFromEvent(e);
    } else if (data.type === 'roller') {
      drags.set(e.pointerId, { type: 'roller', y: e.clientY, moved: false }); hud(dev.rollerMesh, 'kit ' + KITS[S.kit].name);
    } else if (data.type === 'jog') {
      jogDown = true; phys.jogVel = 0;
      drags.set(e.pointerId, { type: 'jog', a: jogAngle(e), v: 0 });
      canvas.style.cursor = 'grabbing'; hud(dev.jogGrp, 'tempo ' + Math.round(S.bpm) + ' bpm', 0.6);
    }
  };
  const onMove = (e: PointerEvent) => {
    const d = drags.get(e.pointerId);
    if (!d) {
      if (e.buttons || e.pointerType === 'touch') return;
      // hover cursor: at most one raycast per frame
      hoverEvt = e;
      if (!hoverRaf) hoverRaf = requestAnimationFrame(() => {
        hoverRaf = 0;
        const t = hoverEvt && pick(hoverEvt)?.data.type;
        canvas.style.cursor = !t ? 'default' : t === 'key' || t === 'step' ? 'pointer' : t === 'jog' ? 'grab' : 'ns-resize';
      });
      return;
    }
    if (d.type === 'knob') setKnob(d.key, d.v0 + (d.y0 - e.clientY) / 180);
    if (d.type === 'fader') faderFromEvent(e);
    if (d.type === 'roller') { const dy = e.clientY - d.y; d.y = e.clientY; if (dy) d.moved = true; roll(dy); }
    if (d.type === 'jog') {
      const a = jogAngle(e);
      if (a == null || d.a == null) { d.a = a; return; }
      let da = a - d.a; d.a = a;
      if (da > 180) da -= 360;
      if (da < -180) da += 360;
      d.v = d.v * 0.5 + da * 0.5; turnJog(da);
    }
  };
  const onUp = (e: PointerEvent) => {
    const d = drags.get(e.pointerId);
    if (!d) return;
    drags.delete(e.pointerId);
    if (d.type === 'key') release(d.k);
    if (d.type === 'roller') { if (!d.moved) { dev.rollerMesh.rotation.x -= 0.3; stage.invalidate(); setKit(S.kit + 1); } rollAcc = 0; }
    if (d.type === 'jog') { canvas.style.cursor = 'grab'; jogDown = false; phys.jogVel = Math.abs(d.v) > 1.2 ? d.v : 0; }
  };
  const onWheel = (e: WheelEvent) => {
    const hit = pick(e);
    if (!hit || hit.data.type === 'key' || hit.data.type === 'step') return;
    e.stopImmediatePropagation(); e.preventDefault();
    const t = hit.data;
    if (t.type === 'knob') setKnob(t.key, S[t.key] - e.deltaY / 800);
    if (t.type === 'fader') setVol(S.vol - e.deltaY / 800);
    if (t.type === 'roller') roll(-e.deltaY / 4);
    if (t.type === 'jog') turnJog(-e.deltaY / 6);
  };
  const onDbl = (e: MouseEvent) => { if (!pick(e)) stage.resetView(); };

  canvas.addEventListener('pointerdown', onDown, { capture: true });
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false, capture: true });
  canvas.addEventListener('dblclick', onDbl);

  /* ---------- keyboard ---------- */
  const isField = (t: EventTarget | null) => t instanceof HTMLElement && !!t.closest('input, select, textarea, [contenteditable]');
  const onKeyDown = (e: KeyboardEvent) => {
    if (isField(e.target)) return;
    if (e.code === 'Escape' && q.selStep >= 0) { clearSelection(); return; }
    const k = KEY_BY_CODE[e.code];
    if (!k || e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    if (!e.repeat) press(k);
  };
  const onKeyUp = (e: KeyboardEvent) => { if (isField(e.target)) return; const k = KEY_BY_CODE[e.code]; if (k) release(k); };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return {
    /** jog wheel flywheel, called once per frame */
    /** returns true while the jog is coasting */
    stepPhysics() {
      if (!jogDown && Math.abs(phys.jogVel) > 0.15) { turnJog(phys.jogVel); phys.jogVel *= 0.94; return true; }
      if (!jogDown) phys.jogVel = 0;
      return false;
    },
    dispose() {
      cancelAnimationFrame(hoverRaf);
      canvas.removeEventListener('pointerdown', onDown, { capture: true });
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel, { capture: true });
      canvas.removeEventListener('dblclick', onDbl);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      setHit('—');
    },
  };
}
