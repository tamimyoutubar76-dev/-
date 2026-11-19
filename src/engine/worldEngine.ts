import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { getZoneAt, metricToLatLon, metricToUtm46N } from '../gis/projection';
import {
  LandmarkRecord,
  ShopItem,
  VERIFIED_BUS_STOPS,
  VERIFIED_LANDMARKS,
} from '../gis/landmarks';
import { buildRoadGraph, findNearestRoadName } from '../sim/roadGraph';
import {
  getTerrainHeight,
  resolveSupportSurfaceHeight,
  sampleElevationASL,
} from '../sim/terrain';
import { WorldCollisionGrid } from '../sim/collision';
import {
  ApartmentSaveState,
  CrowdDensity,
  DEFAULT_SPAWN,
  InventoryItemRecord,
  PlayerSaveData,
  WeatherMode,
  getNextPrayer,
} from '../sim/worldState';
import { saveWorldProgressSyncMirror } from '../sim/saveSystem';
import {
  WeatherEvaluation,
  evaluateManualWeather,
  evaluateWeatherAtClock,
} from '../sim/weatherCycle';
import { createProceduralTexturePack } from './textures';
import { buildTerrainAndVegetation } from './terrainSystem';
import { TrafficLightBulbHandle, buildRoadAndFlyoverSystem } from './roadAndFlyoverSystem';
import { buildBuildingSystem, EnterableLandmarkInstance } from './buildingSystem';
import { VehicleAndTrafficSystem, WorldVehicle } from './vehicleAndTrafficSystem';
import { NpcLifeSystem } from './npcSystem';
import type { NpcGreetingEvent, ScreenSpeechBubble } from '../sim/npcGreetings';
import { GroundSurface, detectGroundSurface } from '../sim/groundSurface';
import {
  TrafficIntersection,
  buildTrafficIntersections,
  evaluateIntersectionSignal,
  resolveVehiclePairCollision,
} from '../sim/trafficRules';
import {
  NEW_MARKET_GATE_POS,
  ROADSIDE_AND_NEW_MARKET_SHOPS,
  VendorVoiceCandidate,
} from '../sim/newMarketAndShops';
import {
  AMEEN_BED_COORDS,
  AMEEN_CENTER_SPEC,
  ApartmentSpot,
  ApartmentSpotKind,
  ameenLocalToWorld,
  findNearestAmeenGroundShop,
  findNearestApartmentSpot,
  resolveAmeenStairRamp,
  worldToAmeenLocal,
} from '../sim/ameenCenter';
import {
  SleepPhase,
  SleepSequenceState,
  createIdleSleepState,
  startSleepSequence,
  stepSleepSequence,
} from '../sim/sleepSystem';
import {
  VehicleGear,
  computeVehicleHudReadout,
  stepVehicleDrivePhysics,
} from '../sim/vehicleControls';
import {
  COMPANION_DIALOGUE_LINES,
  getVehiclePassengerSeatOffset,
  transformSeatToWorld,
} from '../sim/companionState';
import {
  CompanionRig,
  createCompanionMesh,
  updateCompanionAnimation,
} from './companionSystem';
import { PhotoPostProcessor, computeHighResSnapshotSize } from './photoPostProcess';
import { WeatherAndSkySystem } from './weatherAndSkySystem';
import { WorldAudioEngine } from './audioSystem';
import {
  ProtagonistRig,
  createProtagonistMesh,
  updateProtagonistAnimation,
} from './playerCharacter';

export type GameModeState = 'title' | 'playing' | 'paused';

export interface ActivePrompt {
  kind: 'door' | 'vehicle' | 'bus_stop' | 'elevator' | 'mosque' | 'shop' | 'rooftop_stairs' | 'apartment';
  title: string;
  bengaliTitle: string;
  actionLabel: string;
  landmarkId?: string;
  vehicleId?: string;
  busStopId?: string;
  apartmentSpotId?: ApartmentSpotKind;
}

export interface HudSnapshot {
  x: number;
  y: number;
  z: number;
  yaw: number;
  lat: number;
  lon: number;
  utmEasting: number;
  utmNorthing: number;
  elevationASL: number;
  zoneName: string;
  zoneBengali: string;
  insideLalkhanBazar: boolean;
  streetName: string;
  onFlyover: boolean;
  timeOfDay: number;
  prayerCurrent: string;
  prayerNext: string;
  prayerNextTime: string;
  isAdhanWindow: boolean;
  weather: WeatherMode;
  weatherAuto: boolean;
  clockSpeed: 1 | 10 | 60;
  weatherLabel: string;
  weatherTransitioning: boolean;
  rainIntensity: number;
  walletBdt: number;
  energy: number;
  speedKmh: number;
  gear: VehicleGear;
  isReversing: boolean;
  isDriving: boolean;
  vehicleLabel: string;
  insideLandmark: LandmarkRecord | null;
  currentFloor: number;
  shoesRemoved: boolean;
  wuduPerformed: boolean;
  prayersCompleted: number;
  visitedCount: number;
  prompt: ActivePrompt | null;
  npcGreeting: NpcGreetingEvent | null;
  nearbyTalkNpc: { id: string; roleLabel: string; distanceM: number } | null;
  speechBubbles: ScreenSpeechBubble[];
  vendorVoice: VendorVoiceCandidate | null;
  nearbyShop: { shopId: string; name: string; bengaliName: string; items: ShopItem[] } | null;
  apartmentSpot: ApartmentSpot | null;
  apartmentState: ApartmentSaveState;
  sleepOverlay: {
    active: boolean;
    fadeOpacity: number;
    progress: number;
    phase: SleepPhase;
    hours: number;
  };
  companionInfo: {
    name: string;
    bengaliName: string;
    state: 'following' | 'home' | 'sleeping' | 'in_vehicle';
    nearbyDialogue: string | null;
  };
  sleepCount: number;
  inventory: InventoryItemRecord[];
  groundSurface: GroundSurface;
  photoMode: boolean;
  cameraMode: 'third' | 'first';
  toastMessage: string | null;
}

export interface MobileControlInput {
  moveX: number; // -1..1
  moveY: number; // -1..1 (forward positive)
  run: boolean;
  jump: boolean;
  accelerate: boolean;
  brake: boolean;
  steer: number;
}

// Module-level scratch vectors to guarantee ZERO GC allocations in the render loop
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _projVec = new THREE.Vector3();

function detectSoftwareGl(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}


export class LalkhanWorldEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;

  private audio = new WorldAudioEngine();
  private collision = new WorldCollisionGrid();
  private roadGraph = buildRoadGraph();
  private skyWeather: WeatherAndSkySystem;
  private traffic: VehicleAndTrafficSystem;
  private npcs: NpcLifeSystem;
  private enterables: EnterableLandmarkInstance[] = [];
  private solidMeshes: THREE.Object3D[] = [];
  private groundRoadMeshes: THREE.Object3D[] = [];
  private raycaster = new THREE.Raycaster();
  private roadMaterials: THREE.MeshStandardMaterial[] = [];
  private trafficLightBulbs: TrafficLightBulbHandle[] = [];
  private intersections: TrafficIntersection[] = [];
  private photoPost: PhotoPostProcessor | null = null;
  private photoMode = false;

  private playerMesh: ProtagonistRig;
  private companionRig: CompanionRig;
  private disposables: { dispose: () => void }[] = [];

  // Simulation state
  private mode: GameModeState = 'title';
  private px = DEFAULT_SPAWN.x;
  private py = getTerrainHeight(DEFAULT_SPAWN.x, DEFAULT_SPAWN.z);
  private pz = DEFAULT_SPAWN.z;
  private vy = 0;
  private grounded = true;
  private playerYaw = DEFAULT_SPAWN.yaw;
  private playerYawRate = 0;
  private camYaw = DEFAULT_SPAWN.yaw;
  private camPitch = 0.04;
  private camMode: 'third' | 'first' = 'third';
  private walkPhase = 0;
  private stepAccum = 0;
  private squashScaleY = 1;
  private lieAmount = 0;
  private onFlyover = false;
  private currentSurface: GroundSurface = 'concrete';
  private ameenStairMode: 'none' | 'up' | 'down' = 'none';

  // Friend Companion ("Tariq") state
  private compX = DEFAULT_SPAWN.x + 1.5;
  private compY = getTerrainHeight(DEFAULT_SPAWN.x + 1.5, DEFAULT_SPAWN.z - 1.5);
  private compZ = DEFAULT_SPAWN.z - 1.5;
  private compYaw = DEFAULT_SPAWN.yaw;
  private compWalkPhase = 0;
  private compFloor = 0;
  private compInsideId: string | null = null;
  private compState: 'following' | 'home' | 'sleeping' | 'in_vehicle' = 'following';
  private compDialogueIdx = 0;
  private compDialogueActive: { bengaliText: string; romanized: string; englishMeaning: string; timer: number } | null = null;

  private saveState: PlayerSaveData;
  private activeVehicle: WorldVehicle | null = null;
  private currentGear: VehicleGear = 'P';
  private currentIsReversing = false;
  private insideLandmark: EnterableLandmarkInstance | null = null;
  private currentFloor = 0;
  private currentPrompt: ActivePrompt | null = null;
  private activeNpcGreeting: NpcGreetingEvent | null = null;
  private nearbyTalkNpc: HudSnapshot['nearbyTalkNpc'] = null;
  private greetingTimer = 0;
  private activeVendorVoice: VendorVoiceCandidate | null = null;
  private vendorVoiceTimer = 0;
  private nearbyShop: { shopId: string; name: string; bengaliName: string; items: ShopItem[] } | null = null;
  private nearbyApartmentSpot: ApartmentSpot | null = null;
  private sleepState: SleepSequenceState = createIdleSleepState();
  private lastPcRewardSleepCount = -1;
  private toastMessage: string | null = null;
  private toastTimer = 0;

  // Input state
  private keysHeld = new Set<string>();
  private draggingLook = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  public mobileInput: MobileControlInput = {
    moveX: 0,
    moveY: 0,
    run: false,
    jump: false,
    accelerate: false,
    brake: false,
    steer: 0,
  };

  // Loop & callbacks
  private frameId = 0;
  private disposed = false;
  private lastTickTime = performance.now();
  private elapsed = 0;
  private hudEmitAccum = 0;
  private onHudUpdate: (snap: HudSnapshot) => void;
  private onSaveTrigger: (data: PlayerSaveData) => void;
  private saveAccum = 0;

  constructor(
    container: HTMLElement,
    initialSave: PlayerSaveData,
    onHudUpdate: (snap: HudSnapshot) => void,
    onSaveTrigger: (data: PlayerSaveData) => void
  ) {
    this.container = container;
    this.saveState = { ...initialSave };
    this.onHudUpdate = onHudUpdate;
    this.onSaveTrigger = onSaveTrigger;

    this.px = initialSave.x;
    this.pz = initialSave.z;
    this.py = getTerrainHeight(this.px, this.pz);
    this.playerYaw = initialSave.yaw;
    this.camYaw = initialSave.yaw - Math.PI;

    this.isSoftwareGl = detectSoftwareGl();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: this.isSoftwareGl,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const aspect = (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight || 1);
    this.camera = new THREE.PerspectiveCamera(62, aspect, 0.25, 1100);

    // Studio/outdoor PBR reflections via RoomEnvironment
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    const envTex = pmrem.fromScene(roomEnv, 0.04).texture;
    this.scene.environment = envTex;
    this.scene.environmentIntensity = 0.55;
    roomEnv.dispose();
    pmrem.dispose();
    this.disposables.push(envTex);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const texPack = createProceduralTexturePack(maxAniso);
    this.disposables.push(texPack);

    // Build all real GIS 3D systems
    this.skyWeather = new WeatherAndSkySystem(this.scene, this.isSoftwareGl);
    this.disposables.push(this.skyWeather);

    const terrainSys = buildTerrainAndVegetation(this.scene);
    this.disposables.push(terrainSys);

    const roadSys = buildRoadAndFlyoverSystem(this.scene, texPack, this.collision, maxAniso);
    this.roadMaterials = roadSys.roadMaterials;
    this.trafficLightBulbs = roadSys.trafficLightBulbs;
    this.groundRoadMeshes = roadSys.groundSurfaceMeshes;
    this.disposables.push(roadSys);

    const bldgSys = buildBuildingSystem(this.scene, texPack, maxAniso);
    this.enterables = bldgSys.enterables;
    this.solidMeshes = bldgSys.solidMeshes;
    this.disposables.push(bldgSys);

    this.intersections = buildTrafficIntersections(this.roadGraph);
    this.traffic = new VehicleAndTrafficSystem(
      this.scene,
      this.roadGraph.driveableLanes,
      texPack,
      this.intersections
    );
    this.disposables.push(this.traffic);

    this.npcs = new NpcLifeSystem(this.scene, this.saveState.crowdDensity);
    this.disposables.push(this.npcs);

    this.py = this.sampleRenderedGroundY(this.px, this.pz, this.py);
    this.playerMesh = createProtagonistMesh(texPack.contactShadowTex, maxAniso, this.disposables);
    this.playerMesh.group.position.set(this.px, this.py, this.pz);
    this.scene.add(this.playerMesh.group);

    // Restore interior floor/building if player saved inside Ameen Center Apartment or another landmark
    if (initialSave.insideLandmarkId) {
      const savedEnt = this.enterables.find((e) => e.landmark.id === initialSave.insideLandmarkId);
      if (savedEnt) {
        this.insideLandmark = savedEnt;
        this.currentFloor = Math.max(0, Math.min(savedEnt.landmark.floors, initialSave.currentFloor || 0));
        this.py = savedEnt.baseY + this.currentFloor * savedEnt.floorHeight + 0.14;
        savedEnt.targetDoorOpen = true;
        savedEnt.doorOpenProgress = -Math.PI * 0.48;
        savedEnt.elevatorFloor = this.currentFloor;
        savedEnt.targetFloor = this.currentFloor;
        this.playerMesh.group.position.set(this.px, this.py, this.pz);
      }
    }

    // Restore Companion Tariq with permanent fixed identity & position
    this.companionRig = createCompanionMesh(texPack.contactShadowTex, maxAniso, this.disposables);
    const savedComp = initialSave.companion;
    this.compX = savedComp ? savedComp.x : this.px + 1.5;
    this.compZ = savedComp ? savedComp.z : this.pz - 1.5;
    this.compYaw = savedComp ? savedComp.yaw : this.playerYaw;
    this.compFloor = savedComp ? savedComp.currentFloor : this.currentFloor;
    this.compInsideId = savedComp ? savedComp.insideBuildingId : (this.insideLandmark?.landmark.id ?? null);
    this.compState = savedComp?.state === 'sleeping' ? 'following' : (savedComp?.state ?? 'following');
    if (this.compInsideId) {
      const compEnt = this.enterables.find((e) => e.landmark.id === this.compInsideId);
      this.compY = compEnt ? compEnt.baseY + this.compFloor * compEnt.floorHeight + 0.14 : this.py;
    } else {
      this.compY = getTerrainHeight(this.compX, this.compZ);
    }
    this.companionRig.group.position.set(this.compX, this.compY, this.compZ);
    this.companionRig.group.rotation.y = this.compYaw;
    this.scene.add(this.companionRig.group);

    // Restore saved player vehicle location if present
    if (initialSave.savedVehicle) {
      const sv = initialSave.savedVehicle;
      const veh = this.traffic.vehicles.find((v) => v.id === sv.id);
      if (veh) {
        veh.x = sv.x;
        veh.y = sv.y;
        veh.z = sv.z;
        veh.yaw = sv.yaw;
        veh.isParkedStart = true;
        veh.speed = 0;
        veh.group.position.set(sv.x, sv.y, sv.z);
        veh.group.rotation.y = sv.yaw;
      }
    }

    if (initialSave.settings?.cameraMode) {
      this.camMode = initialSave.settings.cameraMode;
    }
    if (initialSave.settings?.soundMuted) {
      this.audio.toggleMute();
    }

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.emitHud();
    this.tick();
  }

  private onPageHide = () => {
    this.flushSaveSync();
  };

  private bindEvents() {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('pagehide', this.onPageHide);
    window.addEventListener('beforeunload', this.onPageHide);

    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('contextmenu', this.onContextMenu);
  }

  private onContextMenu = (e: MouseEvent) => e.preventDefault();

  private onResize = () => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    const dpr = this.renderer.getPixelRatio();
    this.photoPost?.setSize(w * dpr, h * dpr);
  };

  private onBlur = () => {
    this.keysHeld.clear();
    this.draggingLook = false;
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.mode !== 'playing') return;
    this.audio.unlock();
    this.draggingLook = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.draggingLook || this.mode !== 'playing') return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.camYaw -= dx * 0.0055;
    this.camPitch = Math.max(-0.45, Math.min(1.05, this.camPitch + dy * 0.0045));
  };

  private onPointerUp = () => {
    this.draggingLook = false;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.mode !== 'playing') return;
    this.audio.unlock();
    const code = e.code;
    const firstPress = !this.keysHeld.has(code);
    this.keysHeld.add(code);

    if (this.sleepState.phase !== 'idle') return;

    if (firstPress) {
      if (code === 'KeyE') {
        this.triggerPrimaryInteract();
      } else if ((code === 'KeyG' || code === 'KeyT') && !this.activeVehicle) {
        this.triggerTalkWithNearbyNpc();
      } else if (code === 'KeyV') {
        this.toggleCameraMode();
      } else if (code === 'KeyF') {
        this.togglePhotoMode();
      } else if (code === 'KeyH' && this.activeVehicle) {
        this.audio.playInteractChime('horn');
      } else if (code === 'Space' && !this.activeVehicle && this.grounded) {
        this.vy = 6.2;
        this.grounded = false;
        this.squashScaleY = 1.18;
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keysHeld.delete(e.code);
  };

  public setMode(nextMode: GameModeState) {
    this.mode = nextMode;
    this.keysHeld.clear();
    this.draggingLook = false;
    if (nextMode !== 'playing' && this.photoMode) {
      this.photoMode = false;
      document.body.dataset.photomode = 'false';
    }
    if (nextMode === 'playing') {
      this.audio.unlock();
      if (!this.insideLandmark && !this.activeVehicle) {
        this.py = this.sampleRenderedGroundY(this.px, this.pz, getTerrainHeight(this.px, this.pz));
      }
      // Align & snap camera smoothly behind player when entering play so it faces Ameen Center / direction of travel
      this.camYaw = this.playerYaw - Math.PI;
      this.camPitch = 0.04;
      this.camera.position.set(
        this.px + Math.sin(this.camYaw) * 5.6,
        this.py + 2.25,
        this.pz + Math.cos(this.camYaw) * 5.6
      );
      this.camera.lookAt(this.px, this.py + 1.85, this.pz);
    }
  }

  public toggleCameraMode(): 'third' | 'first' {
    this.camMode = this.camMode === 'third' ? 'first' : 'third';
    this.playerMesh.group.visible =
      this.camMode === 'third' && (!this.activeVehicle || this.activeVehicle.type === 'motorbike');
    this.emitHud();
    return this.camMode;
  }

  private ensurePhotoPost(): PhotoPostProcessor {
    if (!this.photoPost) {
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight || 1;
      const dpr = this.renderer.getPixelRatio();
      this.photoPost = new PhotoPostProcessor(w * dpr, h * dpr);
    }
    return this.photoPost;
  }

  public setPhotoMode(enabled: boolean): boolean {
    this.photoMode = enabled;
    document.body.dataset.photomode = enabled ? 'true' : 'false';
    if (enabled) {
      const post = this.ensurePhotoPost();
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight || 1;
      const dpr = this.renderer.getPixelRatio();
      post.setSize(w * dpr, h * dpr);
    }
    this.renderActiveFrame();
    this.emitHud();
    return this.photoMode;
  }

  public togglePhotoMode(): boolean {
    return this.setPhotoMode(!this.photoMode);
  }

  public capturePhotoSnapshot(): { dataUrl: string; width: number; height: number } {
    const viewW = this.container.clientWidth || window.innerWidth;
    const viewH = this.container.clientHeight || window.innerHeight || 1;
    const prevDpr = this.renderer.getPixelRatio();
    const snap = computeHighResSnapshotSize(viewW, viewH, this.isSoftwareGl);

    const post = this.ensurePhotoPost();
    // Temporarily render at high resolution through the film-grain shader pass
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(snap.width, snap.height, false);
    this.camera.aspect = snap.width / snap.height;
    this.camera.updateProjectionMatrix();
    post.setSize(snap.width, snap.height);
    post.renderWithGrain(this.renderer, this.scene, this.camera, this.elapsed, 0.055);

    const dataUrl = this.renderer.domElement.toDataURL('image/png');

    // Restore live viewport size cleanly
    this.renderer.setPixelRatio(prevDpr);
    this.renderer.setSize(viewW, viewH, false);
    this.camera.aspect = viewW / viewH;
    this.camera.updateProjectionMatrix();
    post.setSize(viewW * prevDpr, viewH * prevDpr);
    this.renderActiveFrame();

    this.audio.playInteractChime('purchase');
    return { dataUrl, width: snap.width, height: snap.height };
  }

  private renderActiveFrame() {
    if (this.photoMode && this.mode === 'playing') {
      this.ensurePhotoPost().renderWithGrain(
        this.renderer,
        this.scene,
        this.camera,
        this.elapsed,
        0.055
      );
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  public toggleMute(): boolean {
    this.audio.unlock();
    return this.audio.toggleMute();
  }

  private evaluateCurrentWeather(): WeatherEvaluation {
    return this.saveState.weatherAuto
      ? evaluateWeatherAtClock(this.saveState.timeOfDay)
      : evaluateManualWeather(this.saveState.weather);
  }

  public setTimeOfDay(hours: number) {
    this.saveState.timeOfDay = ((hours % 24) + 24) % 24;
    const wEval = this.evaluateCurrentWeather();
    if (this.saveState.weatherAuto) {
      this.saveState.weather = wEval.state;
    }
    this.skyWeather.update(0.05, this.saveState.timeOfDay, wEval, this.px, this.py, this.pz, this.roadMaterials);
    this.renderer.render(this.scene, this.camera);
    this.emitHud();
  }

  public setWeather(w: WeatherMode) {
    this.saveState.weatherAuto = false;
    this.saveState.weather = w;
    const wEval = this.evaluateCurrentWeather();
    this.skyWeather.update(0.05, this.saveState.timeOfDay, wEval, this.px, this.py, this.pz, this.roadMaterials);
    this.renderer.render(this.scene, this.camera);
    this.emitHud();
  }

  public setWeatherAuto(auto: boolean) {
    this.saveState.weatherAuto = auto;
    const wEval = this.evaluateCurrentWeather();
    if (auto) {
      this.saveState.weather = wEval.state;
    }
    this.skyWeather.update(0.05, this.saveState.timeOfDay, wEval, this.px, this.py, this.pz, this.roadMaterials);
    this.renderer.render(this.scene, this.camera);
    this.emitHud();
  }

  public setClockSpeed(speed: 1 | 10 | 60) {
    this.saveState.clockSpeed = speed;
    this.emitHud();
  }

  public setCrowdDensity(d: CrowdDensity) {
    this.saveState.crowdDensity = d;
    this.npcs.setDensity(d);
    this.emitHud();
  }

  public rotateCameraBy(dyaw: number, dpitch: number) {
    this.camYaw += dyaw;
    this.camPitch = Math.max(-0.45, Math.min(1.05, this.camPitch + dpitch));
  }

  public showToast(msg: string) {
    this.toastMessage = msg;
    this.toastTimer = 3.2;
    this.emitHud();
  }

  public fastTravelTo(x: number, z: number, label: string, targetYaw?: number) {
    if (this.activeVehicle) {
      this.exitVehicle();
    }
    this.insideLandmark = null;
    this.currentFloor = 0;
    this.px = x;
    this.pz = z;
    this.py = getTerrainHeight(x, z);
    this.vy = 0;
    this.grounded = true;
    this.onFlyover = false;
    if (targetYaw !== undefined) {
      this.playerYaw = targetYaw;
      this.camYaw = targetYaw - Math.PI;
      this.camPitch = 0.04;
      this.camera.position.set(
        this.px + Math.sin(this.camYaw) * 5.6,
        this.py + 2.25,
        this.pz + Math.cos(this.camYaw) * 5.6
      );
      this.camera.lookAt(this.px, this.py + 1.85, this.pz);
    }
    this.showToast(`Arrived at ${label}`);
    this.emitHud();
  }

  public setElevatorFloor(floorIdx: number) {
    if (!this.insideLandmark || !this.insideLandmark.landmark.hasElevator) return;
    const clamped = Math.max(0, Math.min(this.insideLandmark.landmark.floors, floorIdx));
    this.insideLandmark.targetFloor = clamped;
    this.currentFloor = clamped;
    this.py = this.insideLandmark.baseY + clamped * this.insideLandmark.floorHeight + 0.14;
    this.audio.playInteractChime('elevator');
    const floorLabel =
      clamped === 0 ? 'Ground Floor' : clamped === this.insideLandmark.landmark.floors ? 'Rooftop Terrace' : `Floor ${clamped}`;
    this.showToast(`Elevator arrived at ${floorLabel}`);
    this.emitHud();
  }

  public climbStairsFloor(delta: number) {
    if (!this.insideLandmark) return;
    const clamped = Math.max(0, Math.min(this.insideLandmark.landmark.floors, this.currentFloor + delta));
    if (clamped === this.currentFloor) return;
    this.currentFloor = clamped;
    this.py = this.insideLandmark.baseY + clamped * this.insideLandmark.floorHeight + 0.14;
    this.audio.playStep('concrete', false, 0);
    const label =
      clamped === 0 ? 'Ground Floor' : clamped === this.insideLandmark.landmark.floors ? 'Rooftop Terrace' : `Floor ${clamped}`;
    this.showToast(`Walked to ${label}`);
    this.emitHud();
  }

  public buyShopItem(item: ShopItem) {
    if (this.saveState.walletBdt < item.priceBdt) {
      this.showToast(`Not enough BDT (Need ৳${item.priceBdt})`);
      return;
    }
    this.saveState.walletBdt -= item.priceBdt;
    this.saveState.energy = Math.min(100, this.saveState.energy + item.energyGain);
    const existing = this.saveState.inventory.find((inv) => inv.id === item.id);
    if (existing) {
      existing.count += 1;
    } else {
      this.saveState.inventory.push({
        id: item.id,
        name: item.name,
        bengaliName: item.bengaliName,
        count: 1,
        kind: item.kind,
      });
    }
    this.audio.playInteractChime('purchase');
    this.showToast(`Bought ${item.name} (-৳${item.priceBdt}, +${item.energyGain}% Energy)`);
    this.persistNow();
    this.emitHud();
  }

  public performMosqueAction(action: 'shoes' | 'wudu' | 'pray') {
    if (action === 'shoes') {
      this.saveState.shoesRemoved = !this.saveState.shoesRemoved;
      this.showToast(this.saveState.shoesRemoved ? 'Shoes placed neatly on mosque shoe rack.' : 'Shoes worn again.');
    } else if (action === 'wudu') {
      this.saveState.wuduPerformed = true;
      this.audio.playInteractChime('door');
      this.showToast('Ablution (Wudu) performed at the mosque fountain.');
    } else if (action === 'pray') {
      if (!this.saveState.shoesRemoved) {
        this.showToast('Please remove shoes at the rack before entering the prayer hall.');
        return;
      }
      if (!this.saveState.wuduPerformed) {
        this.showToast('Perform Wudu (ablution) at the courtyard fountain first.');
        return;
      }
      this.saveState.prayersCompleted += 1;
      this.saveState.energy = Math.min(100, this.saveState.energy + 25);
      this.audio.playInteractChime('prayer');
      this.showToast('Prayer offered peacefully inside the Mosque.');
    }
    this.persistNow();
    this.emitHud();
  }

  public boardBusRide(destName: string, destX: number, destZ: number) {
    if (this.saveState.walletBdt < 15) {
      this.showToast('Need ৳15 bus fare.');
      return;
    }
    this.saveState.walletBdt -= 15;
    this.fastTravelTo(destX, destZ, `City Bus → ${destName} (-৳15)`);
    this.persistNow();
  }

  public triggerTalkWithNearbyNpc(): boolean {
    if (this.activeVehicle || this.sleepState.phase !== 'idle') return false;
    const manualGreet = this.npcs.triggerManualGreeting(this.px, this.pz);
    if (manualGreet) {
      this.activeNpcGreeting = manualGreet;
      this.greetingTimer = 4.6;
      this.audio.playInteractChime('greet');
      this.emitHud();
      return true;
    }
    // If no outdoor street NPC is nearby (e.g. inside Ameen Center home apartment), talk to Friend Companion Tariq!
    if (Math.hypot(this.compX - this.px, this.compZ - this.pz) < 9.0) {
      const line = COMPANION_DIALOGUE_LINES[this.compDialogueIdx % COMPANION_DIALOGUE_LINES.length];
      this.compDialogueIdx += 1;
      this.compDialogueActive = {
        bengaliText: line.bengaliText,
        romanized: line.romanized,
        englishMeaning: line.englishMeaning,
        timer: 4.6,
      };
      this.audio.playInteractChime('greet');
      this.emitHud();
      return true;
    }
    return false;
  }

  public triggerSleep(hours = 7.5): boolean {
    if (this.activeVehicle || this.sleepState.phase !== 'idle') return false;
    const ameen = this.enterables.find((e) => e.landmark.id === AMEEN_CENTER_SPEC.id);
    if (!ameen) return false;
    if (this.insideLandmark?.landmark.id !== AMEEN_CENTER_SPEC.id || this.currentFloor !== 2) {
      this.showToast('Visit your Floor 2 Apartment inside Ameen Center to sleep.');
      return false;
    }
    const sideW = ameenLocalToWorld(AMEEN_BED_COORDS.standSideLocal.lx, AMEEN_BED_COORDS.standSideLocal.lz);
    const matW = ameenLocalToWorld(AMEEN_BED_COORDS.mattressCenterLocal.lx, AMEEN_BED_COORDS.mattressCenterLocal.lz);
    const floorStandingY = ameen.baseY + 2 * ameen.floorHeight + AMEEN_CENTER_SPEC.slabOffsetY;
    const bedSurfaceY = floorStandingY + AMEEN_BED_COORDS.mattressCenterLocal.bedSurfaceHeightRelFloor;

    this.sleepState = startSleepSequence({
      startX: this.px,
      startZ: this.pz,
      bedSideX: sideW.x,
      bedSideZ: sideW.z,
      mattressX: matW.x,
      mattressZ: matW.z,
      bedSurfaceY,
      floorStandingY,
      sleepDurationHours: hours,
    });
    this.emitHud();
    return true;
  }

  public interactApartmentSpot(spotId: ApartmentSpotKind) {
    if (this.sleepState.phase !== 'idle') return;
    if (spotId === 'bed') {
      this.triggerSleep(7.5);
      return;
    }
    if (spotId === 'sofa_tv') {
      this.saveState.apartmentState.tvOn = !this.saveState.apartmentState.tvOn || this.saveState.apartmentState.tvChannel < 5;
      this.saveState.apartmentState.tvChannel = (this.saveState.apartmentState.tvChannel % 5) + 1;
      this.audio.playInteractChime('door');
      this.showToast(`Apartment TV: Channel ${this.saveState.apartmentState.tvChannel} (${this.saveState.apartmentState.tvOn ? 'On' : 'Standby'})`);
    } else if (spotId === 'kitchen') {
      this.saveState.energy = Math.min(100, this.saveState.energy + 35);
      this.audio.playInteractChime('purchase');
      this.showToast('Made hot Dudh Cha & Snacks in Apartment Kitchen (+35% Energy)');
    } else if (spotId === 'bathroom') {
      this.saveState.energy = Math.min(100, this.saveState.energy + 25);
      this.audio.playInteractChime('door');
      this.showToast('Freshened up in Apartment Bathroom (+25% Energy)');
    } else if (spotId === 'wardrobe') {
      this.audio.playInteractChime('door');
      this.showToast('Wardrobe: AC Milan Black & Red Kit ready & organized!');
    } else if (spotId === 'computer') {
      this.saveState.apartmentState.pcActive = true;
      if (this.lastPcRewardSleepCount !== this.saveState.sleepCount) {
        this.lastPcRewardSleepCount = this.saveState.sleepCount;
        this.saveState.walletBdt += 150;
        this.audio.playInteractChime('purchase');
        this.showToast('Checked Chattogram Desk PC & Remote Work (+৳150)');
      } else {
        this.audio.playInteractChime('door');
        this.showToast('Checked Lalkhan Bazar local feed on Desk Computer');
      }
    } else if (spotId === 'storage') {
      if (!this.saveState.apartmentState.storedItems.includes('Ameen Center Gym Bag')) {
        this.saveState.apartmentState.storedItems.push('Ameen Center Gym Bag');
      }
      this.audio.playInteractChime('door');
      this.showToast(`Personal Storage: ${this.saveState.apartmentState.storedItems.length} saved items inside locker`);
    } else if (spotId === 'companion_bed') {
      this.audio.playInteractChime('greet');
      this.showToast("Tariq's bed & corner inside your Floor 2 Ameen Center Home");
    }
    this.persistNow();
    this.emitHud();
  }

  public triggerPrimaryInteract() {
    if (this.sleepState.phase !== 'idle') return;
    if (this.activeVehicle) {
      this.exitVehicle();
      return;
    }
    if (!this.currentPrompt) return;

    if (this.currentPrompt.kind === 'apartment' && this.currentPrompt.apartmentSpotId) {
      this.interactApartmentSpot(this.currentPrompt.apartmentSpotId);
    } else if (this.currentPrompt.kind === 'door' && this.currentPrompt.landmarkId) {
      const ent = this.enterables.find((e) => e.landmark.id === this.currentPrompt!.landmarkId);
      if (ent) {
        if (!this.insideLandmark && ent.targetDoorOpen) {
          const lm = ent.landmark;
          const insideLocalZ = Math.max(0, lm.depth * 0.5 - 2.6);
          const c = Math.cos(lm.yaw);
          const s = Math.sin(lm.yaw);
          this.px = lm.x + insideLocalZ * s;
          this.pz = lm.z + insideLocalZ * c;
          this.insideLandmark = ent;
          this.currentFloor = 0;
          this.py = ent.baseY + AMEEN_CENTER_SPEC.slabOffsetY;
          this.audio.playInteractChime('door');
          this.showToast(`Entered ${lm.name}`);
          this.persistNow();
        } else {
          ent.targetDoorOpen = !ent.targetDoorOpen;
          this.audio.playInteractChime('door');
          this.showToast(ent.targetDoorOpen ? `Opened ${ent.landmark.name} door` : `Closed door`);
        }
      }
    } else if (this.currentPrompt.kind === 'vehicle' && this.currentPrompt.vehicleId) {
      const veh = this.traffic.vehicles.find((v) => v.id === this.currentPrompt!.vehicleId);
      if (veh) {
        this.enterVehicle(veh);
      }
    } else if (this.currentPrompt.kind === 'rooftop_stairs' && this.insideLandmark) {
      const nextF = this.currentFloor < this.insideLandmark.landmark.floors ? this.currentFloor + 1 : 0;
      this.climbStairsFloor(nextF - this.currentFloor);
    }
  }

  private enterVehicle(veh: WorldVehicle) {
    this.activeVehicle = veh;
    veh.isPlayerDriven = true;
    veh.isParkedStart = false;
    veh.speed = 0;
    this.currentGear = 'P';
    this.currentIsReversing = false;
    this.compState = 'in_vehicle';
    this.playerMesh.group.visible = this.camMode === 'third' && veh.type === 'motorbike';
    this.camYaw = veh.yaw - Math.PI;
    this.audio.playInteractChime('horn');
    this.showToast(`Driving ${veh.label} with Tariq (WASD/Arrows · E Exit)`);
    this.persistNow();
    this.emitHud();
  }

  private exitVehicle() {
    if (!this.activeVehicle) return;
    const veh = this.activeVehicle;
    veh.isPlayerDriven = false;
    veh.speed = 0;
    this.currentGear = 'P';
    this.currentIsReversing = false;
    // Step out on left side of vehicle
    const sideX = veh.x - Math.cos(veh.yaw) * 2.2;
    const sideZ = veh.z + Math.sin(veh.yaw) * 2.2;
    const res = this.collision.resolveCircle(sideX, sideZ, 0.45, 0, null, {
      actorAbsY: veh.y,
      isVehicle: false,
    });
    this.px = res.x;
    this.pz = res.z;
    const sup = resolveSupportSurfaceHeight(this.px, this.pz, veh.y);
    this.py = sup.y;
    this.onFlyover = sup.onFlyover;
    this.activeVehicle = null;
    this.compState = 'following';
    // Step companion Tariq out on right side beside player
    this.compX = veh.x + Math.cos(veh.yaw) * 1.9;
    this.compZ = veh.z - Math.sin(veh.yaw) * 1.9;
    this.compY = this.py;
    this.playerMesh.group.visible = this.camMode === 'third';
    this.persistNow();
    this.emitHud();
  }

  public resetPlayerPosition(freshData: PlayerSaveData) {
    if (this.activeVehicle) this.exitVehicle();
    this.sleepState = createIdleSleepState();
    this.lieAmount = 0;
    this.saveState = { ...freshData };
    this.px = freshData.x;
    this.pz = freshData.z;
    this.py = this.sampleRenderedGroundY(this.px, this.pz, getTerrainHeight(this.px, this.pz));
    this.playerYaw = freshData.yaw;
    this.camYaw = freshData.yaw - Math.PI;
    this.camPitch = 0.04;
    this.insideLandmark = null;
    this.currentFloor = 0;
    this.compX = freshData.companion.x;
    this.compZ = freshData.companion.z;
    this.compY = getTerrainHeight(this.compX, this.compZ);
    this.compFloor = 0;
    this.compInsideId = null;
    this.compState = 'following';
    this.npcs.setDensity(freshData.crowdDensity);
    this.playerMesh.group.position.set(this.px, this.py, this.pz);
    this.playerMesh.group.rotation.y = this.playerYaw;
    this.camera.position.set(
      this.px + Math.sin(this.camYaw) * 5.6,
      this.py + 2.25,
      this.pz + Math.cos(this.camYaw) * 5.6
    );
    this.camera.lookAt(this.px, this.py + 1.85, this.pz);
    this.emitHud();
  }

  private buildUpdatedSaveData(): PlayerSaveData {
    this.saveState.saveVersion = 3;
    this.saveState.x = Math.round(this.px * 10) / 10;
    this.saveState.y = Math.round(this.py * 10) / 10;
    this.saveState.z = Math.round(this.pz * 10) / 10;
    this.saveState.yaw = this.playerYaw;
    this.saveState.insideLandmarkId = this.insideLandmark ? this.insideLandmark.landmark.id : null;
    this.saveState.currentFloor = this.currentFloor;
    this.saveState.companion = {
      ...this.saveState.companion,
      x: Math.round(this.compX * 10) / 10,
      y: Math.round(this.compY * 10) / 10,
      z: Math.round(this.compZ * 10) / 10,
      yaw: this.compYaw,
      state: this.compState,
      insideBuildingId: this.compInsideId,
      currentFloor: this.compFloor,
    };
    if (this.activeVehicle) {
      this.saveState.savedVehicle = {
        id: this.activeVehicle.id,
        type: this.activeVehicle.type,
        x: Math.round(this.activeVehicle.x * 10) / 10,
        y: Math.round(this.activeVehicle.y * 10) / 10,
        z: Math.round(this.activeVehicle.z * 10) / 10,
        yaw: this.activeVehicle.yaw,
      };
    }
    this.saveState.settings = {
      ...this.saveState.settings,
      cameraMode: this.camMode,
    };
    return { ...this.saveState };
  }

  public flushSaveSync() {
    saveWorldProgressSyncMirror(this.buildUpdatedSaveData());
  }

  private persistNow() {
    this.onSaveTrigger(this.buildUpdatedSaveData());
  }

  private scheduleNextFrame() {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => {
        if (!this.disposed) this.tick();
      });
    } else {
      this.frameId = requestAnimationFrame(() => {
        if (!this.disposed) this.tick();
      });
    }
  }

  private afterDraw(cb: () => void) {
    try {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } catch {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private tick() {
    const now = performance.now();
    const rawDt = (now - this.lastTickTime) / 1000;
    this.lastTickTime = now;
    const frameTime = Math.min(Math.max(rawDt, 0.001), this.isSoftwareGl ? 0.5 : 0.15);

    const maxStep = 0.05;
    let remaining = frameTime;
    while (remaining > 0.0001) {
      const dt = Math.min(remaining, maxStep);
      remaining -= dt;
      this.stepSimulation(dt);
    }

    this.renderActiveFrame();

    if (this.mode === 'playing' && this.hudEmitAccum >= 0.12) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }

    this.scheduleNextFrame();
  }

  private updateTrafficSignalBulbs() {
    for (const b of this.trafficLightBulbs) {
      const sig = evaluateIntersectionSignal(this.elapsed, 14, b.phaseOffsetSec);
      const isNsGreen = sig.nsState === 'green';
      b.green.emissiveIntensity = isNsGreen ? 1.5 : 0.12;
      b.red.emissiveIntensity = isNsGreen ? 0.15 : 1.5;
    }
  }

  private stepSimulation(dt: number) {
    this.elapsed += dt;
    this.updateTrafficSignalBulbs();

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastMessage = null;
    }

    if (this.greetingTimer > 0) {
      this.greetingTimer -= dt;
      if (this.greetingTimer <= 0) this.activeNpcGreeting = null;
    }

    if (this.vendorVoiceTimer > 0) {
      this.vendorVoiceTimer -= dt;
      if (this.vendorVoiceTimer <= 0) this.activeVendorVoice = null;
    }

    if (this.compDialogueActive) {
      this.compDialogueActive.timer -= dt;
      if (this.compDialogueActive.timer <= 0) this.compDialogueActive = null;
    }

    if (this.mode === 'title') {
      // Live World Camera Tour directly framing Ameen Center's blue front facade & entrance plaza
      const wEval = this.evaluateCurrentWeather();
      this.traffic.update(dt, this.elapsed, this.collision, this.roadGraph.driveableLanes);
      this.npcs.update(dt, AMEEN_CENTER_SPEC.x, AMEEN_CENTER_SPEC.z, this.collision, this.traffic.vehicles);
      this.skyWeather.update(
        dt,
        this.saveState.timeOfDay,
        wEval,
        AMEEN_CENTER_SPEC.x,
        getTerrainHeight(AMEEN_CENTER_SPEC.x, AMEEN_CENTER_SPEC.z),
        AMEEN_CENTER_SPEC.z,
        this.roadMaterials
      );

      const t = this.elapsed * 0.22;
      const sway = Math.sin(t) * 10;
      const orbitX = 294 + sway * 0.65;
      const orbitZ = 272 - sway * 0.55;
      const baseH = getTerrainHeight(AMEEN_CENTER_SPEC.x, AMEEN_CENTER_SPEC.z);
      this.camera.position.set(orbitX, baseH + 11.5 + Math.sin(t * 0.8) * 1.8, orbitZ);
      this.camera.lookAt(AMEEN_CENTER_SPEC.x, baseH + 6.5, AMEEN_CENTER_SPEC.z);
    } else if (this.mode === 'playing') {
      // Advance Chattogram internal simulation clock (base 1 game hour per 75s * clockSpeed)
      this.saveState.timeOfDay =
        (this.saveState.timeOfDay + dt * (1 / 75) * (this.saveState.clockSpeed || 1)) % 24;

      const prevWeather = this.saveState.weather;
      const wEval = this.evaluateCurrentWeather();
      if (this.saveState.weatherAuto) {
        this.saveState.weather = wEval.state;
        if (wEval.state !== prevWeather) {
          const msg =
            wEval.state === 'rain'
              ? 'Monsoon Rain starting over Lalkhan Bazar'
              : wEval.state === 'overcast'
                ? 'Overcast clouds gathering over Chattogram'
                : 'Skies clearing over Lalkhan Bazar';
          this.showToast(msg);
        }
      }

      if (this.sleepState.phase !== 'idle') {
        const stepOut = stepSleepSequence(this.sleepState, dt, AMEEN_CENTER_SPEC.yaw);
        this.sleepState = stepOut.state;
        this.px = stepOut.playerX;
        this.py = stepOut.playerY;
        this.pz = stepOut.playerZ;
        this.playerYaw = stepOut.playerYaw;
        this.lieAmount = stepOut.lieAmount;
        if (stepOut.isMoving) {
          this.walkPhase += dt * 11;
        }
        if (stepOut.applyRestNow) {
          this.saveState.timeOfDay = (this.saveState.timeOfDay + this.sleepState.sleepDurationHours) % 24;
          this.saveState.energy = 100;
          this.saveState.sleepCount += 1;
          this.saveState.lastSleptHour = Math.round(this.saveState.timeOfDay);
          this.persistNow();
        }
        if (stepOut.justWokeUp) {
          const ameen = this.enterables.find((e) => e.landmark.id === AMEEN_CENTER_SPEC.id) || this.insideLandmark;
          this.insideLandmark = ameen;
          this.currentFloor = 2;
          this.lieAmount = 0;
          this.grounded = true;
          this.vy = 0;
          this.persistNow();
          this.showToast('Good morning! Woke up inside Ameen Center Apartment (+100% Energy)');
        }
        updateProtagonistAnimation(
          this.playerMesh,
          {
            x: this.px,
            y: this.py,
            z: this.pz,
            yaw: this.playerYaw,
            yawRate: 0,
            moveSpeed: stepOut.isMoving ? 3.2 : 0,
            isRunning: false,
            grounded: true,
            vy: 0,
            walkPhase: this.walkPhase,
            squashScaleY: 1,
            elapsed: this.elapsed,
            isSitting: false,
            lieAmount: this.lieAmount,
          },
          dt
        );
      } else {
        this.updatePlayerOrVehicle(dt);
      }

      this.updateCompanion(dt);
      this.updateEnterableBuildings(dt);
      this.traffic.update(dt, this.elapsed, this.collision, this.roadGraph.driveableLanes);
      this.npcs.update(dt, this.px, this.pz, this.collision, this.traffic.vehicles);

      const distNM = Math.hypot(this.px - NEW_MARKET_GATE_POS.x, this.pz - NEW_MARKET_GATE_POS.z);
      const crowdLvl = Math.max(0, Math.min(1, 1 - (distNM - 20) / 115));
      this.audio.setMarketCrowdLevel(crowdLvl);

      if (this.sleepState.phase === 'idle') {
        const proxVendor = this.npcs.evaluateProximityVendorVoice(
          this.px,
          this.pz,
          Boolean(this.activeVehicle)
        );
        if (proxVendor) {
          this.activeVendorVoice = proxVendor;
          this.vendorVoiceTimer = 4.6;
          this.audio.playVendorVoice(proxVendor.line, proxVendor.distanceM, 24);
          this.emitHud();
        }

        const proxGreeting = this.npcs.evaluateProximityGreeting(
          this.px,
          this.pz,
          Boolean(this.activeVehicle)
        );
        if (proxGreeting) {
          this.activeNpcGreeting = proxGreeting;
          this.greetingTimer = 4.2;
          this.audio.playInteractChime('greet');
          this.emitHud();
        }

        this.nearbyTalkNpc = this.activeVehicle ? null : this.npcs.findNearbyTalkNpc(this.px, this.pz, 6.5);
      } else {
        this.nearbyTalkNpc = null;
      }

      this.skyWeather.update(
        dt,
        this.saveState.timeOfDay,
        wEval,
        this.px,
        this.py,
        this.pz,
        this.roadMaterials
      );
      this.audio.tickAmbientTraffic(this.elapsed, true);

      this.updateFollowCamera(dt);

      this.hudEmitAccum += dt;
      this.saveAccum += dt;
      if (this.saveAccum >= 6.0) {
        this.saveAccum = 0;
        this.persistNow();
      }
    }
  }

  private updateCompanion(dt: number) {
    // 1. Inside player-driven vehicle -> seat Tariq cleanly in the exact passenger seat!
    if (this.activeVehicle) {
      this.compState = 'in_vehicle';
      this.compInsideId = null;
      this.compFloor = 0;
      const offset = getVehiclePassengerSeatOffset(this.activeVehicle.type);
      const seatW = transformSeatToWorld(
        this.activeVehicle.x,
        this.activeVehicle.y,
        this.activeVehicle.z,
        this.activeVehicle.yaw,
        offset
      );
      this.compX = seatW.x;
      this.compY = seatW.y;
      this.compZ = seatW.z;
      this.compYaw = this.activeVehicle.yaw;
      updateCompanionAnimation(
        this.companionRig,
        {
          x: this.compX,
          y: this.compY,
          z: this.compZ,
          yaw: this.compYaw,
          moveSpeed: 0,
          walkPhase: 0,
          isSitting: true,
          lieAmount: 0,
          elapsed: this.elapsed,
        },
        dt
      );
      return;
    }

    // 2. While sleeping inside Floor 2 Apartment -> Tariq rests on his dedicated companion bed!
    if (this.sleepState.phase !== 'idle') {
      const ameen = this.enterables.find((e) => e.landmark.id === AMEEN_CENTER_SPEC.id);
      const bedW = ameenLocalToWorld(AMEEN_BED_COORDS.companionBedLocal.lx, AMEEN_BED_COORDS.companionBedLocal.lz);
      const aptBaseY = ameen ? ameen.baseY + 2 * ameen.floorHeight + AMEEN_CENTER_SPEC.slabOffsetY : this.py;
      const sleepingNow =
        this.sleepState.phase === 'lying_down' ||
        this.sleepState.phase === 'fading_out' ||
        this.sleepState.phase === 'sleeping_screen' ||
        this.sleepState.phase === 'fading_in';
      this.compState = 'sleeping';
      this.compInsideId = AMEEN_CENTER_SPEC.id;
      this.compFloor = 2;
      this.compX = THREE.MathUtils.damp(this.compX, bedW.x, 4, dt);
      this.compZ = THREE.MathUtils.damp(this.compZ, bedW.z, 4, dt);
      this.compY = sleepingNow ? aptBaseY + 0.56 : aptBaseY;
      this.compYaw = AMEEN_CENTER_SPEC.yaw;
      updateCompanionAnimation(
        this.companionRig,
        {
          x: this.compX,
          y: this.compY,
          z: this.compZ,
          yaw: this.compYaw,
          moveSpeed: 0,
          walkPhase: 0,
          isSitting: false,
          lieAmount: sleepingNow ? 1 : 0,
          elapsed: this.elapsed,
        },
        dt
      );
      return;
    }

    // 3. On foot (outdoors or exploring inside buildings/floors with player)
    const desiredBuildingId = this.insideLandmark ? this.insideLandmark.landmark.id : null;
    const desiredFloor = this.insideLandmark ? this.currentFloor : 0;

    // Follow at natural companion offset behind/beside protagonist
    const targetX = this.px - Math.cos(this.playerYaw) * 1.65 - Math.sin(this.playerYaw) * 1.45;
    const targetZ = this.pz + Math.sin(this.playerYaw) * 1.65 - Math.cos(this.playerYaw) * 1.45;

    // If floor/building changed via elevator or fast-travel, snap companion smoothly onto matching floor
    if (this.compInsideId !== desiredBuildingId || Math.abs(this.compFloor - desiredFloor) > 0) {
      const farDist = Math.hypot(targetX - this.compX, targetZ - this.compZ);
      if (farDist > 12 || this.compFloor !== desiredFloor) {
        this.compX = targetX;
        this.compZ = targetZ;
      }
      this.compInsideId = desiredBuildingId;
      this.compFloor = desiredFloor;
    }

    const dx = targetX - this.compX;
    const dz = targetZ - this.compZ;
    const dist = Math.hypot(dx, dz);

    let compMoveSpeed = 0;
    if (dist > 0.75) {
      compMoveSpeed = dist > 5.0 ? 6.8 : 4.0;
      const step = Math.min(dist, compMoveSpeed * dt);
      const nx = this.compX + (dx / dist) * step;
      const nz = this.compZ + (dz / dist) * step;
      const col = this.collision.resolveCircle(nx, nz, 0.36, 0, this.compInsideId, {
        actorAbsY: this.compY,
        currentFloor: this.compFloor,
      });
      this.compX = col.x;
      this.compZ = col.z;
      this.compYaw = Math.atan2(dx, dz);
      this.compWalkPhase += step * 3.1;
    } else {
      let yawDiff = this.playerYaw - this.compYaw;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      this.compYaw += yawDiff * Math.min(1, dt * 6);
    }

    if (this.insideLandmark) {
      this.compY = this.insideLandmark.baseY + this.compFloor * this.insideLandmark.floorHeight + 0.14;
      this.compState = this.insideLandmark.landmark.id === AMEEN_CENTER_SPEC.id && this.compFloor === 2 ? 'home' : 'following';
    } else {
      const sup = resolveSupportSurfaceHeight(this.compX, this.compZ, this.compY);
      this.compY = sup.y;
      this.compState = 'following';
    }

    updateCompanionAnimation(
      this.companionRig,
      {
        x: this.compX,
        y: this.compY,
        z: this.compZ,
        yaw: this.compYaw,
        moveSpeed: compMoveSpeed,
        walkPhase: this.compWalkPhase,
        isSitting: false,
        lieAmount: 0,
        elapsed: this.elapsed,
      },
      dt
    );
  }

  private updatePlayerOrVehicle(dt: number) {
    if (this.activeVehicle) {
      const v = this.activeVehicle;
      const accelerate = Boolean(this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp') || this.mobileInput.accelerate);
      const brakeOrReverse = Boolean(this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown') || this.mobileInput.brake);
      const handbrake = this.keysHeld.has('Space');
      const steer =
        (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft') ? 1 : 0) -
        (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight') ? 1 : 0) -
        this.mobileInput.steer;

      v.speed = stepVehicleDrivePhysics(
        v.speed,
        v.maxSpeed,
        { accelerate, brakeOrReverse, handbrake, steer },
        dt
      );
      const hudReadout = computeVehicleHudReadout(v.speed, brakeOrReverse);
      this.currentGear = hudReadout.gear;
      this.currentIsReversing = hudReadout.isReversing;

      if (Math.abs(v.speed) > 0.25) {
        const turnSign = v.speed >= 0 ? 1 : -1;
        v.yaw += steer * turnSign * 1.85 * dt;
      }

      const nx = v.x + Math.sin(v.yaw) * v.speed * dt;
      const nz = v.z + Math.cos(v.yaw) * v.speed * dt;
      const clampedX = Math.max(-740, Math.min(972, nx));
      const clampedZ = Math.max(-670, Math.min(750, nz));

      const relY = v.y - getTerrainHeight(clampedX, clampedZ);
      const col = this.collision.resolveCircle(clampedX, clampedZ, v.radius, relY, null, {
        actorAbsY: v.y,
        isVehicle: true,
      });
      const vCol = resolveVehiclePairCollision(col.x, v.y, col.z, v.radius, this.traffic.vehicles, v.id);
      if (col.hit || vCol.hitVehicle) {
        v.speed *= 0.42;
      }
      v.x = vCol.x;
      v.z = vCol.z;

      const sup = resolveSupportSurfaceHeight(v.x, v.z, v.y);
      v.y = THREE.MathUtils.damp(v.y, sup.y, 16, dt);
      v.onFlyover = sup.onFlyover;

      v.group.position.set(v.x, v.y, v.z);
      v.group.rotation.y = v.yaw;
      for (const w of v.wheels) w.rotation.x += v.speed * dt * 2.4;

      this.px = v.x;
      this.py = v.y;
      this.pz = v.z;
      this.playerYaw = v.yaw;
      this.onFlyover = v.onFlyover;
      this.nearbyShop = null;
      this.nearbyApartmentSpot = null;

      if (v.type === 'motorbike') {
        this.playerMesh.group.visible = this.camMode === 'third';
        updateProtagonistAnimation(
          this.playerMesh,
          {
            x: v.x - Math.sin(v.yaw) * 0.14,
            y: v.y + 0.56,
            z: v.z - Math.cos(v.yaw) * 0.14,
            yaw: v.yaw,
            yawRate: steer * 1.4,
            moveSpeed: Math.abs(v.speed),
            isRunning: false,
            grounded: true,
            vy: 0,
            walkPhase: 0,
            squashScaleY: 1,
            elapsed: this.elapsed,
            isSitting: true,
            lieAmount: 0,
          },
          dt
        );
      }

      this.currentPrompt = {
        kind: 'vehicle',
        title: v.label,
        bengaliTitle: v.bengaliLabel,
        actionLabel: 'Exit Vehicle [E]',
        vehicleId: v.id,
      };
      return;
    }

    // Pedestrian walking / running / hill & stair climbing
    let inFwd =
      (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp') ? 1 : 0) -
      (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown') ? 1 : 0) +
      this.mobileInput.moveY;
    let inRight =
      (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight') ? 1 : 0) -
      (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft') ? 1 : 0) +
      this.mobileInput.moveX;

    if (this.mobileInput.jump && this.grounded) {
      this.vy = 6.2;
      this.grounded = false;
      this.squashScaleY = 1.18;
      this.mobileInput.jump = false;
    }

    // Q/E or Left/Right arrow? Wait: ArrowLeft/Right steer/move, let's also let Q/Z rotate camera if user doesn't drag mouse
    if (this.keysHeld.has('KeyQ')) this.camYaw += 1.9 * dt;
    if (this.keysHeld.has('KeyC')) this.camYaw -= 1.9 * dt;

    const len = Math.hypot(inFwd, inRight);
    if (len > 1) {
      inFwd /= len;
      inRight /= len;
    }

    const isRunning = this.keysHeld.has('ShiftLeft') || this.keysHeld.has('ShiftRight') || this.mobileInput.run;
    const speed = isRunning && this.saveState.energy > 5 ? 7.6 : 4.2;

    if (len > 0.05) {
      // Camera-relative movement: forward is (-sin(camYaw), -cos(camYaw))
      const fwdX = -Math.sin(this.camYaw);
      const fwdZ = -Math.cos(this.camYaw);
      const rightX = Math.cos(this.camYaw);
      const rightZ = -Math.sin(this.camYaw);

      const dirX = fwdX * inFwd + rightX * inRight;
      const dirZ = fwdZ * inFwd + rightZ * inRight;
      const targetYaw = Math.atan2(dirX, dirZ);

      // Smoothly turn character toward movement direction
      let yawDiff = targetYaw - this.playerYaw;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      const yawDelta = yawDiff * Math.min(1, dt * 12);
      this.playerYaw += yawDelta;
      this.playerYawRate = dt > 0 ? yawDelta / dt : 0;

      const step = speed * dt;
      const nx = Math.max(-742, Math.min(975, this.px + dirX * step));
      const nz = Math.max(-672, Math.min(752, this.pz + dirZ * step));

      const relY = this.py - getTerrainHeight(nx, nz);
      const col = this.collision.resolveCircle(
        nx,
        nz,
        0.42,
        relY,
        this.insideLandmark ? this.insideLandmark.landmark.id : null,
        { actorAbsY: this.py, isVehicle: false, currentFloor: this.currentFloor }
      );
      this.px = col.x;
      this.pz = col.z;

      this.walkPhase += step * 3.1;
      this.stepAccum += step;
      if (this.stepAccum > 1.75 && this.grounded) {
        this.stepAccum = 0;
        const surf = detectGroundSurface({
          x: this.px,
          z: this.pz,
          onFlyover: this.onFlyover,
          insideLandmark: Boolean(this.insideLandmark),
        });
        this.currentSurface = surf;
        this.audio.playStep(surf, isRunning, this.evaluateCurrentWeather().rainIntensity);
      }

      if (isRunning) {
        this.saveState.energy = Math.max(0, this.saveState.energy - dt * 1.4);
      }
    } else {
      this.playerYawRate = THREE.MathUtils.damp(this.playerYawRate, 0, 12, dt);
      this.saveState.energy = Math.min(100, this.saveState.energy + dt * 0.65);
    }

    // Check if inside an enterable landmark (using exact Three.js Y-rotation inverse!)
    let activeLm: EnterableLandmarkInstance | null = null;
    for (const ent of this.enterables) {
      const lm = ent.landmark;
      const dx = this.px - lm.x;
      const dz = this.pz - lm.z;
      const c = Math.cos(lm.yaw);
      const s = Math.sin(lm.yaw);
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      if (Math.abs(lx) < lm.width * 0.5 && Math.abs(lz) < lm.depth * 0.5) {
        activeLm = ent;
        break;
      }
    }

    if (activeLm !== this.insideLandmark) {
      this.insideLandmark = activeLm;
      this.ameenStairMode = 'none';
      if (activeLm) {
        if (!this.saveState.visitedLandmarks.includes(activeLm.landmark.id)) {
          this.saveState.visitedLandmarks.push(activeLm.landmark.id);
        }
        activeLm.targetDoorOpen = true;
        this.showToast(`Entered ${activeLm.landmark.name}`);
      } else {
        this.currentFloor = 0;
        this.nearbyApartmentSpot = null;
      }
    }

    // Track arrival inside Chattogram New Market open-air shopping plaza
    const nmPlaza = VERIFIED_LANDMARKS.find((l) => l.isOpenPlaza);
    if (
      nmPlaza &&
      !this.saveState.visitedLandmarks.includes(nmPlaza.id) &&
      Math.hypot(this.px - nmPlaza.x, this.pz - nmPlaza.z) < 52
    ) {
      this.saveState.visitedLandmarks.push(nmPlaza.id);
      this.showToast(`Entered ${nmPlaza.name}`);
    }

    // Surface support height: interior floor slab / walkable Ameen Center stairs OR terrain/flyover
    let supportY: number;
    if (this.insideLandmark) {
      if (this.insideLandmark.landmark.id === AMEEN_CENTER_SPEC.id) {
        const loc = worldToAmeenLocal(this.px, this.pz);
        const stair = resolveAmeenStairRamp(
          loc.lx,
          loc.lz,
          this.currentFloor,
          this.insideLandmark.baseY,
          this.ameenStairMode
        );
        this.ameenStairMode = stair.nextMode;
        if (stair.nextFloor !== this.currentFloor) {
          this.currentFloor = stair.nextFloor;
          if (stair.exitedToLz !== null) {
            const wExit = ameenLocalToWorld(loc.lx, stair.exitedToLz);
            this.px = wExit.x;
            this.pz = wExit.z;
          }
          const lbl =
            this.currentFloor === 0
              ? 'Ground Floor'
              : this.currentFloor === 2
                ? 'Floor 2 (Home Apartment)'
                : this.currentFloor === 3
                  ? 'Rooftop Terrace'
                  : `Floor ${this.currentFloor}`;
          this.showToast(`Reached ${lbl}`);
          this.persistNow();
        }
        supportY = stair.y;
      } else {
        supportY =
          this.insideLandmark.baseY + this.currentFloor * this.insideLandmark.floorHeight + 0.14;
      }
      this.onFlyover = false;
    } else {
      const sup = resolveSupportSurfaceHeight(this.px, this.pz, this.py);
      supportY = sup.y;
      this.onFlyover = sup.onFlyover;
      if (!this.onFlyover) {
        supportY = this.sampleRenderedGroundY(this.px, this.pz, supportY);
      }
    }

    this.currentSurface = detectGroundSurface({
      x: this.px,
      z: this.pz,
      onFlyover: this.onFlyover,
      insideLandmark: Boolean(this.insideLandmark),
    });

    if (!this.grounded) {
      this.vy -= 18.5 * dt;
      this.py += this.vy * dt;
      if (this.py <= supportY) {
        this.py = supportY;
        this.vy = 0;
        this.grounded = true;
        this.squashScaleY = 0.82;
        this.audio.playLanding(this.currentSurface);
      }
    } else {
      this.py = THREE.MathUtils.damp(this.py, supportY, 18, dt);
    }

    // Update protagonist mesh pose & gait
    this.squashScaleY = THREE.MathUtils.damp(this.squashScaleY, 1, 14, dt);
    updateProtagonistAnimation(
      this.playerMesh,
      {
        x: this.px,
        y: this.py,
        z: this.pz,
        yaw: this.playerYaw,
        yawRate: this.playerYawRate,
        moveSpeed: len,
        isRunning,
        grounded: this.grounded,
        vy: this.vy,
        walkPhase: this.walkPhase,
        squashScaleY: this.squashScaleY,
        elapsed: this.elapsed,
        isSitting: false,
        lieAmount: this.lieAmount,
      },
      dt
    );

    // Determine nearest contextual interaction prompt
    this.currentPrompt = this.computeNearestPrompt();
  }

  private computeNearestPrompt(): ActivePrompt | null {
    // 1. Inside a building: Ameen Center Apartment, Ground Branded Shops, elevator, mosque, shop, or stairs
    if (this.insideLandmark) {
      const lm = this.insideLandmark.landmark;
      if (lm.id === AMEEN_CENTER_SPEC.id) {
        const loc = worldToAmeenLocal(this.px, this.pz);
        const aptSpot = findNearestApartmentSpot(loc.lx, loc.lz, this.currentFloor);
        this.nearbyApartmentSpot = aptSpot;
        const groundShop = findNearestAmeenGroundShop(loc.lx, loc.lz, this.currentFloor);
        if (groundShop) {
          this.nearbyShop = {
            shopId: groundShop.id,
            name: groundShop.brand,
            bengaliName: groundShop.bengaliName,
            items: groundShop.items,
          };
        } else {
          this.nearbyShop = null;
        }
        if (aptSpot) {
          return {
            kind: 'apartment',
            title: aptSpot.name,
            bengaliTitle: aptSpot.bengaliName,
            actionLabel: aptSpot.actionLabel,
            landmarkId: lm.id,
            apartmentSpotId: aptSpot.id,
          };
        }
        if (groundShop) {
          return {
            kind: 'shop',
            title: groundShop.brand,
            bengaliTitle: groundShop.bengaliName,
            actionLabel: `Browse ${groundShop.brand}`,
            landmarkId: lm.id,
          };
        }
      } else {
        this.nearbyApartmentSpot = null;
      }

      if (lm.isMosque) {
        return {
          kind: 'mosque',
          title: lm.name,
          bengaliTitle: lm.bengaliName,
          actionLabel: 'Mosque Etiquette & Prayer Panel',
          landmarkId: lm.id,
        };
      }
      if (lm.hasElevator) {
        return {
          kind: 'elevator',
          title: lm.name,
          bengaliTitle: lm.bengaliName,
          actionLabel: 'Use Elevator / Rooftop',
          landmarkId: lm.id,
        };
      }
      if (lm.shopMenu && lm.shopMenu.length > 0) {
        return {
          kind: 'shop',
          title: lm.name,
          bengaliTitle: lm.bengaliName,
          actionLabel: 'Order Food / Buy Items',
          landmarkId: lm.id,
        };
      }
      if (lm.hasRooftop) {
        return {
          kind: 'rooftop_stairs',
          title: lm.name,
          bengaliTitle: lm.bengaliName,
          actionLabel: 'Climb Stairs / Rooftop [E]',
          landmarkId: lm.id,
        };
      }
    }
    this.nearbyApartmentSpot = null;

    // 2. Nearby Vehicle to board
    const nearVeh = this.traffic.findNearestInteractableVehicle(this.px, this.py, this.pz, 4.4);
    if (nearVeh) {
      return {
        kind: 'vehicle',
        title: nearVeh.label,
        bengaliTitle: nearVeh.bengaliLabel,
        actionLabel: `Drive ${nearVeh.label} [E]`,
        vehicleId: nearVeh.id,
      };
    }

    // 3. Nearby Landmark Doorway
    for (const ent of this.enterables) {
      const lm = ent.landmark;
      const dx = this.px - lm.x;
      const dz = this.pz - lm.z;
      const d = Math.hypot(dx, dz);
      if (d < Math.max(lm.width, lm.depth) * 0.65 + 3.5) {
        return {
          kind: 'door',
          title: lm.name,
          bengaliTitle: lm.bengaliName,
          actionLabel: ent.targetDoorOpen ? 'Enter Building [E]' : 'Open Door [E]',
          landmarkId: lm.id,
        };
      }
    }

    // 4. Nearby Bus Stop
    for (const bs of VERIFIED_BUS_STOPS) {
      if (Math.hypot(this.px - bs.x, this.pz - bs.z) < 7.5) {
        this.nearbyShop = null;
        return {
          kind: 'bus_stop',
          title: bs.name,
          bengaliTitle: bs.bengaliName,
          actionLabel: 'Board Local City Bus (৳15)',
          busStopId: bs.id,
        };
      }
    }

    // 5. Nearby Roadside Business or New Market Stall Counter
    let bestShopDist = Infinity;
    let bestShop: (typeof ROADSIDE_AND_NEW_MARKET_SHOPS)[number] | null = null;
    for (const s of ROADSIDE_AND_NEW_MARKET_SHOPS) {
      if (s.items.length === 0) continue;
      const fx = s.x + Math.sin(s.yaw) * (s.depth * 0.5 + 1.4);
      const fz = s.z + Math.cos(s.yaw) * (s.depth * 0.5 + 1.4);
      const d = Math.hypot(this.px - fx, this.pz - fz);
      const reach = Math.min(7.5, Math.max(4.4, s.width * 0.25 + 3.2));
      if (d < reach && d < bestShopDist) {
        bestShopDist = d;
        bestShop = s;
      }
    }
    if (bestShop) {
      this.nearbyShop = {
        shopId: bestShop.id,
        name: bestShop.name,
        bengaliName: bestShop.bengaliName,
        items: bestShop.items,
      };
      return {
        kind: 'shop',
        title: bestShop.name,
        bengaliTitle: bestShop.bengaliName,
        actionLabel: 'Browse Shop / Buy Items',
      };
    }

    this.nearbyShop = null;
    return null;
  }

  private updateEnterableBuildings(dt: number) {
    for (const ent of this.enterables) {
      const targetAngle = ent.targetDoorOpen ? -Math.PI * 0.48 : 0;
      ent.doorOpenProgress = THREE.MathUtils.damp(ent.doorOpenProgress, targetAngle, 8, dt);
      ent.doorPivot.rotation.y = ent.doorOpenProgress;

      if (ent.elevatorCabin) {
        ent.elevatorFloor = THREE.MathUtils.damp(ent.elevatorFloor, ent.targetFloor, 4.5, dt);
        ent.elevatorCabin.position.y = ent.elevatorFloor * ent.floorHeight + 0.3;
      }
    }
  }

  private sampleRenderedGroundY(x: number, z: number, baseY: number): number {
    if (this.groundRoadMeshes.length === 0) return baseY;
    _rayOrigin.set(x, baseY + 1.8, z);
    _rayDir.set(0, -1, 0);
    this.raycaster.set(_rayOrigin, _rayDir);
    this.raycaster.far = 2.0;
    const hits = this.raycaster.intersectObjects(this.groundRoadMeshes, false);
    if (hits.length > 0 && hits[0].point.y > baseY && hits[0].point.y <= baseY + 1.45) {
      return hits[0].point.y;
    }
    return baseY;
  }

  private updateFollowCamera(dt: number) {
    if (this.camMode === 'first' && !this.activeVehicle) {
      const eyeY = this.py + 1.66;
      this.camera.position.set(this.px, eyeY, this.pz);
      _v2.set(
        this.px - Math.sin(this.camYaw) * Math.cos(this.camPitch) * 10,
        eyeY - Math.sin(this.camPitch) * 10,
        this.pz - Math.cos(this.camYaw) * Math.cos(this.camPitch) * 10
      );
      this.camera.lookAt(_v2);
      return;
    }

    const followDist = this.activeVehicle
      ? this.activeVehicle.type === 'bus'
        ? 12.5
        : 7.6
      : this.insideLandmark
        ? 2.85
        : 5.6;
    const targetHeight = this.activeVehicle ? 2.1 : this.insideLandmark ? 1.55 : 1.85;

    _v1.set(this.px, this.py + targetHeight, this.pz);
    const desiredX = this.px + Math.sin(this.camYaw) * Math.cos(this.camPitch) * followDist;
    const desiredY =
      this.py + (this.insideLandmark ? 1.95 : 2.1) + Math.sin(this.camPitch) * followDist;
    const desiredZ = this.pz + Math.cos(this.camYaw) * Math.cos(this.camPitch) * followDist;

    // Wall pull-in raycast against solid building meshes so camera never clips inside buildings
    _rayOrigin.copy(_v1);
    _rayDir.set(desiredX - _v1.x, desiredY - _v1.y, desiredZ - _v1.z);
    const fullDist = _rayDir.length();
    let finalDist = fullDist;
    if (fullDist > 0.1 && !this.insideLandmark) {
      _rayDir.divideScalar(fullDist);
      this.raycaster.set(_rayOrigin, _rayDir);
      this.raycaster.far = fullDist;
      const hits = this.raycaster.intersectObjects(this.solidMeshes, true);
      if (hits.length > 0 && hits[0].distance > 0.9) {
        finalDist = hits[0].distance - 0.35;
      }
    } else if (fullDist > 0.1) {
      _rayDir.divideScalar(fullDist);
    }

    const alpha = 1 - Math.exp(-(this.insideLandmark ? 18 : 10) * dt);
    let goalX = _rayOrigin.x + _rayDir.x * finalDist;
    let goalY = Math.max(this.py + 0.7, _rayOrigin.y + _rayDir.y * finalDist);
    let goalZ = _rayOrigin.z + _rayDir.z * finalDist;

    // Clamp camera position strictly INSIDE the building footprint & current floor ceiling
    if (this.insideLandmark && !this.activeVehicle) {
      const lm = this.insideLandmark.landmark;
      const dx = goalX - lm.x;
      const dz = goalZ - lm.z;
      const c = Math.cos(lm.yaw);
      const s = Math.sin(lm.yaw);
      let clx = dx * c - dz * s;
      let clz = dx * s + dz * c;
      const maxX = lm.width * 0.5 - 0.65;
      const maxZ = lm.depth * 0.5 - 0.65;
      clx = Math.max(-maxX, Math.min(maxX, clx));
      clz = Math.max(-maxZ, Math.min(maxZ, clz));
      goalX = lm.x + (clx * c + clz * s);
      goalZ = lm.z + (-clx * s + clz * c);
      if (this.currentFloor < lm.floors) {
        const ceilingMaxY =
          this.insideLandmark.baseY +
          (this.currentFloor + 1) * this.insideLandmark.floorHeight -
          0.45;
        goalY = Math.min(goalY, ceilingMaxY);
      }
    }

    this.camera.position.lerp(_v2.set(goalX, goalY, goalZ), alpha);
    this.camera.lookAt(_v1);
  }

  private projectWorldToScreen(wx: number, wy: number, wz: number): { x: number; y: number } | null {
    const viewW = this.container.clientWidth || window.innerWidth;
    const viewH = this.container.clientHeight || window.innerHeight || 1;
    _projVec.set(wx, wy, wz).project(this.camera);
    if (_projVec.z < -1 || _projVec.z > 1) return null;
    const sx = (_projVec.x * 0.5 + 0.5) * viewW;
    const sy = (-_projVec.y * 0.5 + 0.5) * viewH;
    if (sx < 60 || sx > viewW - 60 || sy < 65 || sy > viewH - 55) return null;
    return { x: Math.round(sx), y: Math.round(sy) };
  }

  private computeSpeechBubbles(): ScreenSpeechBubble[] {
    if (this.mode !== 'playing' || this.sleepState.phase !== 'idle') return [];
    this.camera.updateMatrixWorld();
    const out: ScreenSpeechBubble[] = [];

    if (this.activeNpcGreeting) {
      const livePos = this.npcs.getAgentWorldPosition(this.activeNpcGreeting.npcId);
      const wx = livePos ? livePos.x : this.activeNpcGreeting.npcX;
      const wy = livePos ? livePos.y : this.activeNpcGreeting.npcY;
      const wz = livePos ? livePos.z : this.activeNpcGreeting.npcZ;
      const scr = this.projectWorldToScreen(wx, wy + 2.25, wz);
      if (scr) {
        out.push({
          id: `greet_${this.activeNpcGreeting.npcId}`,
          speakerLabel: this.activeNpcGreeting.roleLabel,
          bengaliText: this.activeNpcGreeting.bengaliText,
          romanized: this.activeNpcGreeting.romanized,
          englishMeaning: this.activeNpcGreeting.englishMeaning,
          screenX: scr.x,
          screenY: scr.y,
          distanceM: this.activeNpcGreeting.distanceM,
          variant: 'npc',
        });
      }
    }

    if (this.compDialogueActive) {
      const scr = this.projectWorldToScreen(this.compX, this.compY + 2.25, this.compZ);
      if (scr) {
        out.push({
          id: 'companion_bubble',
          speakerLabel: 'Tariq · তারিক',
          bengaliText: this.compDialogueActive.bengaliText,
          romanized: this.compDialogueActive.romanized,
          englishMeaning: this.compDialogueActive.englishMeaning,
          screenX: scr.x,
          screenY: scr.y,
          distanceM: Math.round(Math.hypot(this.compX - this.px, this.compZ - this.pz) * 10) / 10,
          variant: 'companion',
        });
      }
    }

    return out;
  }

  public emitHud() {
    const ll = metricToLatLon(this.px, this.pz);
    const utm = metricToUtm46N(this.px, this.pz);
    const zone = getZoneAt(this.px, this.pz);
    const street = findNearestRoadName(this.px, this.pz);
    const prayer = getNextPrayer(this.saveState.timeOfDay);
    const wEval = this.evaluateCurrentWeather();
    const speedKmh = this.activeVehicle ? Math.round(Math.abs(this.activeVehicle.speed) * 3.6) : 0;

    this.onHudUpdate({
      x: this.px,
      y: this.py,
      z: this.pz,
      yaw: this.playerYaw,
      lat: ll.lat,
      lon: ll.lon,
      utmEasting: utm.easting,
      utmNorthing: utm.northing,
      elevationASL: Math.round(sampleElevationASL(this.px, this.pz) * 10) / 10,
      zoneName: zone.name,
      zoneBengali: zone.bengaliName,
      insideLalkhanBazar: zone.insideLalkhanBazar,
      streetName: this.onFlyover ? 'Elevated Expressway / Flyover Deck' : street || 'Residential Lane',
      onFlyover: this.onFlyover,
      timeOfDay: this.saveState.timeOfDay,
      prayerCurrent: prayer.current.name,
      prayerNext: prayer.next.name,
      prayerNextTime: prayer.next.timeStr,
      isAdhanWindow: prayer.isAdhanWindow,
      weather: wEval.state,
      weatherAuto: this.saveState.weatherAuto,
      clockSpeed: this.saveState.clockSpeed || 1,
      weatherLabel: wEval.label,
      weatherTransitioning: wEval.isTransitioning,
      rainIntensity: wEval.rainIntensity,
      walletBdt: this.saveState.walletBdt,
      energy: Math.round(this.saveState.energy),
      speedKmh,
      gear: this.activeVehicle ? this.currentGear : 'P',
      isReversing: this.activeVehicle ? this.currentIsReversing : false,
      isDriving: Boolean(this.activeVehicle),
      vehicleLabel: this.activeVehicle ? this.activeVehicle.label : '',
      insideLandmark: this.insideLandmark ? this.insideLandmark.landmark : null,
      currentFloor: this.currentFloor,
      shoesRemoved: this.saveState.shoesRemoved,
      wuduPerformed: this.saveState.wuduPerformed,
      prayersCompleted: this.saveState.prayersCompleted,
      visitedCount: this.saveState.visitedLandmarks.length,
      prompt: this.currentPrompt,
      npcGreeting: this.activeNpcGreeting,
      nearbyTalkNpc: this.nearbyTalkNpc,
      speechBubbles: this.computeSpeechBubbles(),
      vendorVoice: this.activeVendorVoice,
      nearbyShop: this.nearbyShop,
      apartmentSpot: this.nearbyApartmentSpot,
      apartmentState: { ...this.saveState.apartmentState },
      sleepOverlay: {
        active: this.sleepState.phase !== 'idle',
        fadeOpacity: this.sleepState.fadeOpacity,
        progress: this.sleepState.loadingProgress,
        phase: this.sleepState.phase,
        hours: this.sleepState.sleepDurationHours,
      },
      companionInfo: {
        name: this.companionRig.identity.name,
        bengaliName: this.companionRig.identity.bengaliName,
        state: this.compState,
        nearbyDialogue: this.compDialogueActive ? this.compDialogueActive.bengaliText : null,
      },
      sleepCount: this.saveState.sleepCount,
      inventory: [...this.saveState.inventory],
      groundSurface: this.currentSurface,
      photoMode: this.photoMode,
      cameraMode: this.camMode,
      toastMessage: this.toastMessage,
    });
  }

  public dispose() {
    this.flushSaveSync();
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('pagehide', this.onPageHide);
    window.removeEventListener('beforeunload', this.onPageHide);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);

    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    dom.removeEventListener('contextmenu', this.onContextMenu);

    this.photoPost?.dispose();
    this.audio.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.renderer.dispose();
    if (dom.parentElement) dom.parentElement.removeChild(dom);
  }
}
