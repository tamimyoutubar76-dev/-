import * as THREE from 'three';

export const PHOTO_GRAIN_VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const PHOTO_GRAIN_FRAGMENT_SHADER = `
uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uGrainStrength;
uniform vec2 uResolution;
varying vec2 vUv;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec4 base = texture2D(tDiffuse, vUv);
  vec2 px = vUv * uResolution;

  // Dual-frequency film grain weighted subtly toward midtones (authentic 35mm emulsion feel)
  float n1 = hash12(px + fract(uTime * 17.3) * 193.7);
  float n2 = hash12(px * 0.5 + fract(uTime * 11.1) * 97.1);
  float grain = ((n1 * 0.65 + n2 * 0.35) - 0.5) * 2.0;

  float luma = dot(base.rgb, vec3(0.299, 0.587, 0.114));
  float midtoneMask = 1.0 - smoothstep(0.55, 1.0, abs(luma - 0.45) * 1.4);
  vec3 grained = base.rgb + vec3(grain * uGrainStrength * (0.55 + 0.45 * midtoneMask));

  // Subtle photographic optical vignette & micro-contrast
  vec2 centered = vUv - 0.5;
  float dist = dot(centered, centered);
  float vignette = 1.0 - dist * 0.42;
  vec3 graded = clamp((grained - 0.5) * 1.04 + 0.5, 0.0, 1.0) * vignette;

  gl_FragColor = vec4(graded, base.a);
}
`;

export function computeHighResSnapshotSize(
  viewportW: number,
  viewportH: number,
  isSoftwareGl: boolean
): { width: number; height: number } {
  const safeW = Math.max(320, viewportW);
  const safeH = Math.max(240, viewportH);
  const aspect = safeW / safeH;

  // Target >= 1920px wide high-res capture on software-GL and up to 4K on GPU
  const minW = 1920;
  const maxW = isSoftwareGl ? 1920 : 3840;
  const desiredW = Math.min(maxW, Math.max(minW, Math.round(safeW * 2)));
  const desiredH = Math.round(desiredW / aspect);

  return { width: desiredW, height: Math.max(1080, desiredH) };
}

export class PhotoPostProcessor {
  private target: THREE.WebGLRenderTarget;
  private quadScene: THREE.Scene;
  private quadCam: THREE.OrthographicCamera;
  private quadMesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private geometry: THREE.PlaneGeometry;

  constructor(width: number, height: number) {
    this.target = new THREE.WebGLRenderTarget(Math.max(1, width), Math.max(1, height), {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      depthBuffer: true,
    });

    this.geometry = new THREE.PlaneGeometry(2, 2);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.target.texture },
        uTime: { value: 0 },
        uGrainStrength: { value: 0.055 },
        uResolution: { value: new THREE.Vector2(Math.max(1, width), Math.max(1, height)) },
      },
      vertexShader: PHOTO_GRAIN_VERTEX_SHADER,
      fragmentShader: PHOTO_GRAIN_FRAGMENT_SHADER,
      depthTest: false,
      depthWrite: false,
    });

    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadMesh = new THREE.Mesh(this.geometry, this.material);
    this.quadMesh.frustumCulled = false;
    this.quadScene.add(this.quadMesh);
  }

  public setSize(width: number, height: number) {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    this.target.setSize(w, h);
    (this.material.uniforms.uResolution.value as THREE.Vector2).set(w, h);
  }

  public renderWithGrain(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    elapsedSec: number,
    grainStrength = 0.055
  ) {
    this.material.uniforms.uTime.value = elapsedSec;
    this.material.uniforms.uGrainStrength.value = grainStrength;

    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(this.target);
    renderer.clear();
    renderer.render(scene, camera);

    renderer.setRenderTarget(prevTarget);
    renderer.render(this.quadScene, this.quadCam);
  }

  public dispose() {
    this.target.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
