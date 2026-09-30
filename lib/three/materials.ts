import * as THREE from 'three';

function noiseTex(size = 256, lo = 110, hi = 145) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d')!, img = g.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = lo + Math.random() * (hi - lo);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function stripeTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 8;
  const g = c.getContext('2d')!;
  for (let x = 0; x < 512; x += 12) { g.fillStyle = '#fff'; g.fillRect(x, 0, 8, 8); g.fillStyle = '#555'; g.fillRect(x + 8, 0, 4, 8); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** bead-blasted aluminium: one noise field drives colour mottling, roughness and micro-bump */
function makeAlu() {
  const N = 512;
  const fine = document.createElement('canvas'); fine.width = fine.height = N;
  const fg = fine.getContext('2d')!, img = fg.createImageData(N, N);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() + Math.random() + Math.random()) / 3;   // ≈ gaussian speckle
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v * 255; img.data[i + 3] = 255;
  }
  fg.putImageData(img, 0, 0);
  const coarse = document.createElement('canvas'); coarse.width = coarse.height = 32;
  const cg = coarse.getContext('2d')!, ci = cg.createImageData(32, 32);
  for (let i = 0; i < ci.data.length; i += 4) { const v = Math.random() * 255; ci.data[i] = ci.data[i + 1] = ci.data[i + 2] = v; ci.data[i + 3] = 255; }
  cg.putImageData(ci, 0, 0);
  const field = document.createElement('canvas'); field.width = field.height = N;
  const g = field.getContext('2d')!;
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.fillStyle = '#808080'; g.fillRect(0, 0, N, N);
  g.globalAlpha = 0.35; g.drawImage(coarse, 0, 0, N, N);   // faint mottling
  g.globalAlpha = 0.85; g.drawImage(fine, 0, 0);           // fine speckle
  const remap = (lo: number, hi: number) => {
    const c = document.createElement('canvas'); c.width = c.height = N;
    const x = c.getContext('2d')!; x.drawImage(field, 0, 0);
    const d = x.getImageData(0, 0, N, N);
    for (let i = 0; i < d.data.length; i += 4) { const v = lo + (d.data[i] / 255) * (hi - lo); d.data[i] = d.data[i + 1] = d.data[i + 2] = v; }
    x.putImageData(d, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1.1, 1.1); t.anisotropy = 8;
    return t;
  };
  const colorMap = remap(196, 255); colorMap.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshPhysicalMaterial({
    color: '#d0d0ce', metalness: 0.92, map: colorMap,
    roughness: 1, roughnessMap: remap(42, 92),          // ≈ .16 – .36
    bumpMap: remap(0, 255), bumpScale: 1.3,
    clearcoat: 0.6, clearcoatRoughness: 0.12, envMapIntensity: 1.5,
  });
}

export type Materials = ReturnType<typeof createMaterials>;

export function createMaterials() {
  const grain = noiseTex(); grain.repeat.set(2, 2);
  const grainFine = noiseTex();
  const key = (color: string, roughness: number) =>
    new THREE.MeshPhysicalMaterial({ color, roughness, clearcoat: 1, clearcoatRoughness: 0.06, specularIntensity: 0.8, envMapIntensity: 1.1 });
  const stripes = stripeTex();

  return {
    alu: makeAlu(),
    well: new THREE.MeshStandardMaterial({ color: '#0c0c0c', roughness: 0.85 }),
    // satin-coated moulding: the clear coat picks up the studio softboxes
    panel: new THREE.MeshPhysicalMaterial({ color: '#2c2c2c', roughness: 0.6, metalness: 0.06, bumpMap: grain, bumpScale: 0.6, clearcoat: 0.22, clearcoatRoughness: 0.38, envMapIntensity: 1 }),
    keyW: key('#dddcd6', 0.3),
    keyO: key('#c2461b', 0.3),
    keyD: new THREE.MeshPhysicalMaterial({ color: '#262626', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.2 }),
    knurl: new THREE.MeshStandardMaterial({ color: '#9a9a9a', metalness: 0.92, roughness: 0.26, envMapIntensity: 1.3 }),
    kcap: new THREE.MeshPhysicalMaterial({ color: '#7c7c7c', metalness: 0.85, roughness: 0.34, bumpMap: grainFine, bumpScale: 0.3, clearcoat: 0.4, clearcoatRoughness: 0.2, envMapIntensity: 1.3 }),
    mark: new THREE.MeshStandardMaterial({ color: '#e8e8e8', roughness: 0.4 }),
    tick: new THREE.MeshStandardMaterial({ color: '#8d8d8b', roughness: 0.6 }),
    black: new THREE.MeshPhysicalMaterial({ color: '#0e0e0e', roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.2 }),
    slot: new THREE.MeshStandardMaterial({ color: '#050505', roughness: 0.9 }),
    // spun metal: anisotropic highlight sweeps across the dish as the light moves
    jog: new THREE.MeshPhysicalMaterial({ color: '#c6c6c4', metalness: 0.9, roughness: 0.3, anisotropy: 0.85, bumpMap: grain, bumpScale: 0.15, clearcoat: 0.35, clearcoatRoughness: 0.15, envMapIntensity: 1.35 }),
    dimple: new THREE.MeshStandardMaterial({ color: '#8e8e8c', metalness: 0.4, roughness: 0.6 }),
    roller: new THREE.MeshPhysicalMaterial({ color: '#d8561f', roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25, map: stripes, bumpMap: stripes, bumpScale: 2 }),
    screw: new THREE.MeshStandardMaterial({ color: '#2a2a2a', metalness: 0.7, roughness: 0.45 }),
    tabO: new THREE.MeshStandardMaterial({ color: '#e0703c', roughness: 0.5 }),
    tabW: new THREE.MeshStandardMaterial({ color: '#d8cdb8', roughness: 0.6 }),
  };
}
