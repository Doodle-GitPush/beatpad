import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

/**
 * Glossy tabletop: a planar reflection that is softly blurred, fades out away from the device,
 * and gets stronger at grazing angles (Fresnel) — like a product shot on a lacquered surface.
 */
const GlossyFloorShader = {
  name: 'GlossyFloorShader',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    strength: { value: 0.62 },
    blur: { value: 0.0045 },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorld;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float strength;
    uniform float blur;
    varying vec4 vUv;
    varying vec3 vWorld;
    #include <logdepthbuf_pars_fragment>
    void main() {
      #include <logdepthbuf_fragment>
      vec2 uv = vUv.xy / vUv.w;
      // 12-tap golden-angle spiral → soft, glossy (not mirror-sharp) reflection
      vec3 acc = texture2D(tDiffuse, uv).rgb;
      float wsum = 1.0;
      for (int i = 1; i <= 12; i++) {
        float fi = float(i);
        float r = sqrt(fi / 12.0) * blur;
        float a = fi * 2.39996;
        float w = 1.0 - fi / 16.0;
        acc += texture2D(tDiffuse, uv + vec2(cos(a), sin(a)) * r).rgb * w;
        wsum += w;
      }
      vec3 col = acc / wsum;

      // fade with distance from the device footprint
      vec2 p = vWorld.xz * vec2(0.82, 1.2);
      float fade = 1.0 - smoothstep(4.8, 9.0, length(p));
      // Fresnel: shallow viewing angles reflect more
      vec3 V = normalize(cameraPosition - vWorld);
      float fres = mix(0.35, 1.0, pow(1.0 - clamp(V.y, 0.0, 1.0), 2.0));

      gl_FragColor = vec4(col, strength * fade * fres);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

export function createGlossyFloor(width: number, height: number) {
  // only as big as the area where the reflection is visible (it fades out ~9 units from the centre)
  const floor = new Reflector(new THREE.PlaneGeometry(22, 18), {
    shader: GlossyFloorShader,
    textureWidth: width,
    textureHeight: height,
    clipBias: 0.002,
    multisample: 0,              // blurred anyway, so MSAA would be wasted
  });
  const mat = floor.material as THREE.ShaderMaterial;
  mat.transparent = true;
  mat.depthWrite = false;
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.001;
  floor.renderOrder = -1;          // under the shadow catcher and contact shadow
  return Object.assign(floor, { setStrength: (v: number) => { mat.uniforms.strength.value = v; } });
}
