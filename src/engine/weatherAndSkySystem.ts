import * as THREE from 'three';
import type { WeatherEvaluation } from '../sim/weatherCycle';

// Pre-allocated scratch colors so zero GC happens inside the render loop
const _cSkyBase = new THREE.Color();
const _cSkyOvercast = new THREE.Color();
const _cSkyRain = new THREE.Color();
const _cHorBase = new THREE.Color();
const _cHorOvercast = new THREE.Color();
const _cHorRain = new THREE.Color();

export class WeatherAndSkySystem {
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private fog: THREE.FogExp2;
  private skyColor = new THREE.Color(0x98c2e3);
  private horizonColor = new THREE.Color(0xc8dce8);
  private rainMesh: THREE.InstancedMesh;
  private rainMat: THREE.MeshBasicMaterial;
  private rainCount = 450;
  private rainDrops: { x: number; y: number; z: number; speed: number }[] = [];
  private dummy = new THREE.Object3D();
  private disposables: { dispose: () => void }[] = [];

  constructor(scene: THREE.Scene, isSoftwareGl: boolean) {
    // Warm golden-tropical sunlight + cool blue sky / warm earth hemisphere fill
    this.hemiLight = new THREE.HemisphereLight(0xaad2f5, 0x5d5646, 0.85);
    this.hemiLight.position.set(0, 120, 0);
    scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff1d6, 1.85);
    this.sunLight.position.set(160, 210, 120);
    this.sunLight.castShadow = !isSoftwareGl;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 420;
    const d = 140;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.03;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    this.fog = new THREE.FogExp2(0xc8dce8, 0.00145);
    scene.fog = this.fog;
    scene.background = this.skyColor;

    // Pooled InstancedMesh rain streaks
    const rainGeo = new THREE.CylinderGeometry(0.018, 0.018, 1.35, 4);
    this.rainMat = new THREE.MeshBasicMaterial({
      color: 0xd4e7f7,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });
    this.disposables.push(rainGeo, this.rainMat);
    this.rainMesh = new THREE.InstancedMesh(rainGeo, this.rainMat, this.rainCount);
    this.rainMesh.visible = false;
    this.rainMesh.frustumCulled = false;

    for (let i = 0; i < this.rainCount; i++) {
      this.rainDrops.push({
        x: (Math.random() - 0.5) * 60,
        y: Math.random() * 28,
        z: (Math.random() - 0.5) * 60,
        speed: 22 + Math.random() * 8,
      });
    }
    scene.add(this.rainMesh);
  }

  public update(
    dt: number,
    timeOfDayHours: number,
    weatherEval: WeatherEvaluation,
    playerX: number,
    playerY: number,
    playerZ: number,
    roadMaterials: THREE.MeshStandardMaterial[]
  ) {
    // 1. Sun elevation from Chattogram clock (sunrise ~6:00, noon ~12:15, sunset ~18:00)
    const h = ((timeOfDayHours % 24) + 24) % 24;
    const dayArc = ((h - 6) / 12) * Math.PI;
    const isDay = h >= 5.7 && h <= 18.3;
    const sunElev = isDay ? Math.sin(Math.max(0.05, Math.min(Math.PI - 0.05, dayArc))) : -0.35;
    const sunAz = Math.cos(dayArc);

    this.sunLight.target.position.set(playerX, playerY, playerZ);
    this.sunLight.position.set(
      playerX + sunAz * 150,
      playerY + Math.max(24, sunElev * 190),
      playerZ + 95
    );

    const { cloudCover, rainIntensity, roadWetness } = weatherEval;
    const weatherDim = 1.0 - 0.22 * cloudCover - 0.2 * rainIntensity;

    // 2. Smooth Sky, Fog, and Light interpolation across Clear -> Overcast -> Monsoon Rain
    if (!isDay) {
      _cSkyBase.setHex(0x0c1421);
      _cSkyOvercast.setHex(0x141e2b);
      _cSkyRain.setHex(0x0b121c);
      _cHorBase.setHex(0x131d2d);
      _cHorOvercast.setHex(0x1b2634);
      _cHorRain.setHex(0x111a26);
      this.sunLight.color.setHex(0x6e8cb5);
      this.sunLight.intensity = 0.42 * weatherDim;
      this.hemiLight.color.setHex(0x283e5e);
      this.hemiLight.groundColor.setHex(0x1e2024);
      this.hemiLight.intensity = 0.52;
    } else if (sunElev < 0.32) {
      _cSkyBase.setHex(0xd88c63);
      _cSkyOvercast.setHex(0x9b8a84);
      _cSkyRain.setHex(0x636e7a);
      _cHorBase.setHex(0xe8ab7b);
      _cHorOvercast.setHex(0xa89b94);
      _cHorRain.setHex(0x6d7985);
      this.sunLight.color.setHex(0xffb578);
      this.sunLight.intensity = 1.25 * weatherDim;
      this.hemiLight.color.setHex(0xf0be9b);
      this.hemiLight.groundColor.setHex(0x4f4739);
      this.hemiLight.intensity = 0.72 * (1 - 0.18 * rainIntensity);
    } else {
      _cSkyBase.setHex(0x8fc0e6);
      _cSkyOvercast.setHex(0x8ea3b5);
      _cSkyRain.setHex(0x647485);
      _cHorBase.setHex(0xc2d8e8);
      _cHorOvercast.setHex(0xa3b3c2);
      _cHorRain.setHex(0x748392);
      this.sunLight.color.setHex(0xfff1d6);
      this.sunLight.intensity = 1.85 * weatherDim;
      this.hemiLight.color.setHex(0xaad2f5);
      this.hemiLight.groundColor.setHex(0x5d5646);
      this.hemiLight.intensity = 0.85 * weatherDim;
    }

    this.skyColor.copy(_cSkyBase).lerp(_cSkyOvercast, cloudCover).lerp(_cSkyRain, rainIntensity);
    this.horizonColor.copy(_cHorBase).lerp(_cHorOvercast, cloudCover).lerp(_cHorRain, rainIntensity);

    this.fog.color.copy(this.horizonColor);
    const targetFog = 0.00145 + 0.00068 * cloudCover + 0.0011 * rainIntensity;
    this.fog.density += (targetFog - this.fog.density) * Math.min(1, dt * 3.0);

    // 3. Wet road specular sheen based on continuous roadWetness (0..1)
    const targetRough = 0.86 - 0.62 * roadWetness;
    for (const m of roadMaterials) {
      m.roughness += (targetRough - m.roughness) * Math.min(1, dt * 2.5);
    }

    // 4. Rain particle ring scaled continuously by rainIntensity
    const activeDrops = rainIntensity > 0.02 ? Math.max(12, Math.floor(this.rainCount * rainIntensity)) : 0;
    this.rainMesh.visible = activeDrops > 0;
    if (activeDrops > 0) {
      this.rainMat.opacity = 0.14 + 0.36 * rainIntensity;
      for (let i = 0; i < this.rainCount; i++) {
        if (i >= activeDrops) {
          this.dummy.scale.set(0, 0, 0);
          this.dummy.updateMatrix();
          this.rainMesh.setMatrixAt(i, this.dummy.matrix);
          continue;
        }
        const drop = this.rainDrops[i];
        drop.y -= drop.speed * (0.75 + 0.35 * rainIntensity) * dt;
        if (drop.y < -2) {
          drop.y = 26 + Math.random() * 6;
          drop.x = (Math.random() - 0.5) * 56;
          drop.z = (Math.random() - 0.5) * 56;
        }
        this.dummy.position.set(playerX + drop.x, playerY + drop.y, playerZ + drop.z);
        this.dummy.rotation.set(0.08, 0, 0.04);
        this.dummy.scale.set(1, 0.7 + 0.4 * rainIntensity, 1);
        this.dummy.updateMatrix();
        this.rainMesh.setMatrixAt(i, this.dummy.matrix);
      }
      this.rainMesh.instanceMatrix.needsUpdate = true;
    }
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
