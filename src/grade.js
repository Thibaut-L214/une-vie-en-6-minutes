import * as THREE from 'three';

// Étalonnage par chapitre, appliqué après OutputPass (valeurs sRGB affichées) :
// saturation, teinte qui préserve la luminance, vignettage.
export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    saturation: { value: 1 },
    tint: { value: new THREE.Color(1, 1, 1) },
    tintStrength: { value: 0 },
    vignette: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float saturation;
    uniform vec3 tint;
    uniform float tintStrength;
    uniform float vignette;
    varying vec2 vUv;

    const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float luma = dot(color.rgb, LUMA);
      vec3 graded = mix(vec3(luma), color.rgb, saturation);
      vec3 tintColor = tint / max(dot(tint, LUMA), 1e-3);
      graded = mix(graded, graded * tintColor, tintStrength);
      float edge = smoothstep(0.45, 1.0, length(vUv - 0.5) * 1.414);
      graded *= 1.0 - vignette * edge;
      gl_FragColor = vec4(graded, color.a);
    }
  `,
};
