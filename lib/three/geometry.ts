import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Legend } from '../keys';

export { RoundedBoxGeometry };

/** canvas text uses whatever font the page resolved (next/font), set once at mount */
let FONT = 'Geist, system-ui, "Helvetica Neue", Arial, sans-serif';
export const setFont = (f: string) => { if (f) FONT = f; };
export const getFont = () => FONT;

/* layout: the 2D prototype's pixel grid → world units */
export const W = (x: number) => (x - 501.5) / 100;
export const Dz = (y: number) => (y - 297.5) / 100;

export function roundedRectShape(w: number, h: number, r: number, shape: THREE.Shape | THREE.Path = new THREE.Shape()) {
  const x = -w / 2, y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y); shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r); shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

/** rounded, bevelled slab lying flat; optional rounded hole */
export function slab(w: number, d: number, depth: number, r: number, bevel: number, holeW?: number, holeD?: number, holeR?: number) {
  const s = roundedRectShape(w, d, r) as THREE.Shape;
  if (holeW && holeD && holeR != null) {
    const h = new THREE.Path();
    roundedRectShape(holeW, holeD, holeR, h);
    s.holes.push(h);
  }
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 5, curveSegments: 10 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bevel, 0);
  return geo;
}

export const KEY_BOTTOM = 0.52, KEY_H = 0.42, TAPER = 0.12;
export function keyGeo(w: number, d: number) {
  const g = new RoundedBoxGeometry(w, KEY_H, d, 3, 0.09);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) + KEY_H / 2) / KEY_H;           // 0 bottom → 1 top
    p.setX(i, p.getX(i) * (1 - (TAPER * t) / w));
    p.setZ(i, p.getZ(i) * (1 - (TAPER * t) / d) - t * 0.035); // top leans slightly back
  }
  g.computeVertexNormals();
  return g;
}

/** smooth raised mound (lathe): flat top out to `flat`, easing to the panel at R */
export function bumpGeo(R: number, h: number, flat = 0) {
  const pts: THREE.Vector2[] = [], N = 22;
  for (let i = 0; i <= N; i++) {
    const r = (R * i) / N;
    const t = r <= flat ? 0 : (r - flat) / (R - flat);
    const s = t * t * (3 - 2 * t);
    pts.push(new THREE.Vector2(Math.max(r, 0.0001), h * (1 - s)));
  }
  pts.push(new THREE.Vector2(R, -0.01));
  return new THREE.LatheGeometry(pts.reverse(), 56);
}

/** toothed knob body */
export function gearGeo(R: number, depth: number, teeth = 42, toothDepth = 0.022) {
  const s = new THREE.Shape();
  const N = teeth * 4;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = i % 4 < 2 ? R : R - toothDepth;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.006, bevelSegments: 2, curveSegments: 4 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0.012, 0);
  return g;
}

/** draws a key legend into its canvas in the given colour */
export function drawLegend(canvas: HTMLCanvasElement, L: Legend, color: string) {
  const cw = canvas.width, ch = canvas.height;
  const g = canvas.getContext('2d')!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, cw, ch);
  g.translate(cw / 2, ch / 2);
  g.fillStyle = g.strokeStyle = color;
  g.lineCap = g.lineJoin = 'round';
  if (L.t) {
    g.font = `${L.w || 400} ${L.s || 40}px ${FONT}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(L.t, 0, L.home ? -6 : 2);
  }
  if (L.home) { g.fillStyle = 'rgba(0,0,0,.13)'; g.beginPath(); g.roundRect(-20, 24, 40, 6, 3); g.fill(); }
  if (L.ring) { g.lineWidth = 4.5; g.beginPath(); g.arc(0, 0, 21, 0, 7); g.stroke(); }
  if (L.dot) { g.beginPath(); g.arc(0, 0, 22, 0, 7); g.fill(); }
  if (L.enter) {
    g.lineWidth = 4; g.beginPath();
    g.moveTo(40, -18); g.lineTo(40, 10); g.lineTo(-40, 10); g.moveTo(-27, -3); g.lineTo(-40, 10); g.lineTo(-27, 23);
    g.stroke();
  }
  if (L.metro) {
    g.lineWidth = 3.5; g.beginPath(); g.arc(0, 0, 38, 0, 7); g.stroke();
    g.beginPath();
    const a = 8, b = 22;
    g.moveTo(-a, -b); g.lineTo(a, -b); g.lineTo(a, -a); g.lineTo(b, -a); g.lineTo(b, a); g.lineTo(a, a); g.lineTo(a, b);
    g.lineTo(-a, b); g.lineTo(-a, a); g.lineTo(-b, a); g.lineTo(-b, -a); g.lineTo(-a, -a); g.closePath(); g.stroke();
  }
}
