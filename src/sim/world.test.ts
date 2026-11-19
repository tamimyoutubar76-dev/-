import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GIS_DATA,
  getSurveyReport,
  getZoneAt,
  latLonToMetric,
  metricToLatLon,
  FUTURE_EXPANSION_CHUNKS,
} from '../gis/projection';
import { VERIFIED_LANDMARKS, VERIFIED_BUS_STOPS } from '../gis/landmarks';
import {
  getTerrainHeight,
  resolveSupportSurfaceHeight,
  sampleElevationASL,
  sampleFlyoverHeightAt,
} from './terrain';
import { buildRoadGraph, findNearestRoadName } from './roadGraph';
import { WorldCollisionGrid } from './collision';
import { formatChattogramClock, getNextPrayer } from './worldState';
import { evaluateManualWeather, evaluateWeatherAtClock } from './weatherCycle';

test('GIS projection maintains 1:1 metric scale and round-trips lat/lon accurately', () => {
  const [x, z] = latLonToMetric(22.3474936, 91.8193918); // Ispahani Circle OSM node
  assert.ok(x > 240 && x < 300, `Expected Ispahani Circle East ~268m, got ${x}`);
  assert.ok(z > 300 && z < 360, `Expected Ispahani Circle South ~324m, got ${z}`);

  const back = metricToLatLon(x, z);
  assert.ok(Math.abs(back.lat - 22.3474936) < 0.00001);
  assert.ok(Math.abs(back.lon - 91.8193918) < 0.00001);
});

test('Survey report exposes full real-world Lalkhan Bazar map dimensions without compression', () => {
  const report = getSurveyReport();
  assert.ok(report.mappedAreaSqM >= 2_000_000, 'Mapped area must exceed 2 sq km');
  assert.ok(report.nsExtentM >= 1400, 'N-S extent must preserve full ~1440m scale');
  assert.ok(report.ewExtentM >= 1500, 'E-W extent must preserve full ~1540m scale');
  assert.ok(report.mappedBuildings >= 4000, 'Must include all mapped OSM buildings');
  assert.ok(report.totalRoadLengthM >= 35_000, 'Must preserve full mapped road length');
  assert.ok(report.elevationMaxM - report.elevationMinM >= 40, 'Must preserve real hills');
  assert.equal(FUTURE_EXPANSION_CHUNKS.length, 12);
});

test('SRTM 30m DEM terrain preserves western Batali/Motijharna hills higher than eastern valley', () => {
  const hillASL = sampleElevationASL(-260, 200); // Batali / Motijharna ridge
  const valleyASL = sampleElevationASL(450, 150); // CDA Avenue / SS Khaled valley
  assert.ok(hillASL > valleyASL + 10, `Expected hill (${hillASL}m) significantly higher than valley (${valleyASL}m)`);
});

test('Flyover deck sits ~8.6m above CDA Avenue while under-flyover ground remains accessible', () => {
  // Underneath flyover near Lalkhan Bazar junction [415.5, 167.3]
  const groundY = getTerrainHeight(415.5, 167.3);
  const fly = sampleFlyoverHeightAt(415.5, 167.3);
  assert.ok(fly !== null, 'Flyover deck should exist at [415.5, 167.3]');
  assert.ok(fly!.y - groundY > 7.5 && fly!.y - groundY < 10.0, `Expected ~8.6m clearance, got ${fly!.y - groundY}`);

  // Ground vehicle/pedestrian stays underneath when currentY is near ground
  const underSupport = resolveSupportSurfaceHeight(415.5, 167.3, groundY);
  assert.equal(underSupport.onFlyover, false);
  assert.ok(Math.abs(underSupport.y - groundY) < 0.01);

  // Elevated vehicle stays on deck when currentY is near deck
  const overSupport = resolveSupportSurfaceHeight(415.5, 167.3, fly!.y);
  assert.equal(overSupport.onFlyover, true);
  assert.ok(Math.abs(overSupport.y - fly!.y) < 0.01);

  // Ispahani Circle ramp mouth [214.8, 371.1] touches down to ground so cars can drive onto it
  const rampMouthGround = getTerrainHeight(214.8, 371.1);
  const rampMouthSupport = resolveSupportSurfaceHeight(214.8, 371.1, rampMouthGround);
  assert.ok(Math.abs(rampMouthSupport.y - rampMouthGround) < 0.5);
});

test('Road graph is populated with connected OSM arteries and named streets', () => {
  const graph = buildRoadGraph(GIS_DATA.roads);
  assert.ok(graph.nodes.size > 500);
  assert.ok(graph.driveableLanes.length >= 25);
  assert.ok(graph.largestComponentNodes > 300, 'Main road network must form a large connected graph');

  const streetAtIspahani = findNearestRoadName(268.7, 324.1);
  assert.ok(streetAtIspahani.length > 0, `Expected named road at Ispahani Circle, got "${streetAtIspahani}"`);
});

test('Collision spatial hash blocks solid buildings and keeps enterable landmark doorways open', () => {
  const grid = new WorldCollisionGrid();
  const ispahani = VERIFIED_LANDMARKS.find((l) => l.id === 'ispahani_centre')!;
  // Spawn point at Ispahani Circle sidewalk should be unobstructed
  const spawnCheck = grid.resolveCircle(262, 344, 0.45, 0, null);
  assert.equal(spawnCheck.hit, false);

  // Center of Ispahani Centre side wall should collide from outside
  const sideHit = grid.resolveCircle(ispahani.x, ispahani.z, 0.45, 0, null);
  assert.equal(sideHit.hit, true);

  // Inside Ispahani Centre when insideBuildingId === 'ispahani_centre' should stay unpushed near center
  const insideOk = grid.resolveCircle(ispahani.x, ispahani.z, 0.45, 0, 'ispahani_centre');
  assert.equal(insideOk.hit, false);
});

test('Landmarks, bus stops, neighborhood zones, and prayer clock work deterministically', () => {
  assert.ok(VERIFIED_LANDMARKS.some((l) => l.isMosque && l.enterable));
  assert.ok(VERIFIED_LANDMARKS.some((l) => l.hasElevator && l.hasRooftop));
  assert.ok(VERIFIED_BUS_STOPS.length >= 4);

  const zone = getZoneAt(268, 340);
  assert.equal(zone.id, 'ispahani');
  assert.equal(zone.insideLalkhanBazar, true);

  assert.equal(formatChattogramClock(10.25), '10:15 AM');
  const prayer = getNextPrayer(12.2);
  assert.equal(prayer.current.name, 'Dhuhr');
  assert.equal(prayer.next.name, 'Asr');
});

test('Dynamic weather system transitions smoothly between clear, overcast, and monsoon rain based on simulation clock', () => {
  // Morning spawn (10:15 AM) -> Clear
  const morning = evaluateWeatherAtClock(10.25);
  assert.equal(morning.state, 'clear');
  assert.equal(morning.isTransitioning, false);
  assert.equal(morning.cloudCover, 0);
  assert.equal(morning.rainIntensity, 0);

  // Midday transition (11:30 AM) -> Clear -> Overcast halfway
  const buildUp = evaluateWeatherAtClock(11.5);
  assert.equal(buildUp.isTransitioning, true);
  assert.equal(buildUp.nextState, 'overcast');
  assert.equal(buildUp.label, 'Clear → Overcast');
  assert.ok(buildUp.cloudCover > 0.4 && buildUp.cloudCover < 0.6);

  // Midday (13:00) -> Overcast
  const midday = evaluateWeatherAtClock(13.0);
  assert.equal(midday.state, 'overcast');
  assert.equal(midday.cloudCover, 1.0);
  assert.equal(midday.rainIntensity, 0);

  // Squall onset (15:00) -> Overcast -> Monsoon Rain
  const squall = evaluateWeatherAtClock(15.0);
  assert.equal(squall.isTransitioning, true);
  assert.equal(squall.nextState, 'rain');
  assert.equal(squall.label, 'Overcast → Monsoon Rain');
  assert.ok(squall.rainIntensity > 0.4 && squall.rainIntensity < 0.6);
  assert.ok(squall.roadWetness > 0.5);

  // Afternoon Monsoon (17:00) -> Full Monsoon Rain
  const monsoon = evaluateWeatherAtClock(17.0);
  assert.equal(monsoon.state, 'rain');
  assert.equal(monsoon.rainIntensity, 1.0);
  assert.equal(monsoon.roadWetness, 1.0);

  // Evening tapering (19:30) -> Monsoon Rain -> Overcast
  const tapering = evaluateWeatherAtClock(19.5);
  assert.equal(tapering.isTransitioning, true);
  assert.equal(tapering.nextState, 'overcast');
  assert.ok(tapering.rainIntensity > 0.4 && tapering.rainIntensity < 0.6);

  // Night clearing (23:00) -> Clear
  const nightClear = evaluateWeatherAtClock(23.0);
  assert.equal(nightClear.state, 'clear');
  assert.equal(nightClear.rainIntensity, 0);
  assert.equal(nightClear.roadWetness, 0);

  // Manual override preserves exact state
  const manualRain = evaluateManualWeather('rain');
  assert.equal(manualRain.state, 'rain');
  assert.equal(manualRain.rainIntensity, 1.0);
});

import {
  CHITTAGONIAN_GREETINGS,
  findProximityGreetingCandidate,
  selectChittagonianGreeting,
} from './npcGreetings';

test('Proximity NPC greeting system emits culturally relevant Chittagonian greetings within range and respects cooldowns', () => {
  const candidates = [
    { id: 'npc_0', x: 266, z: 334, activity: 'walking' as const, greetCooldown: 0 },
    { id: 'npc_1', x: 264, z: 342, activity: 'waiting_bus' as const, greetCooldown: 12 },
    { id: 'npc_2', x: 310, z: 310, activity: 'tea_stall' as const, greetCooldown: 0 },
  ];

  // Player at (262, 344): npc_1 is 2.8m away but on cooldown (12s), npc_0 is ~10.8m away -> out of 6.5m radius
  const noneInRange = findProximityGreetingCandidate(candidates, 3, 262, 344, 6.5);
  assert.equal(noneInRange, null);

  // Player walks closer to npc_0 at (264, 338) -> 4.47m away, ready to greet
  const match = findProximityGreetingCandidate(candidates, 3, 264, 338, 6.5);
  assert.ok(match !== null);
  assert.equal(match!.agent.id, 'npc_0');
  assert.ok(match!.distanceM < 6.5);

  // Greeting selection picks valid Chittagonian Bengali + Romanized greeting and avoids immediate repeat
  const g1 = selectChittagonianGreeting('waiting_bus', 0.99);
  assert.ok(CHITTAGONIAN_GREETINGS.some((g) => g.id === g1.id));
  assert.ok(g1.bengaliText.length > 0 && g1.romanized.length > 0);

  const g2 = selectChittagonianGreeting('waiting_bus', 0.99, g1.id);
  assert.notEqual(g2.id, g1.id);
});

import { detectGroundSurface, getFootstepAudioProfile } from './groundSurface';

test('Dynamic footstep ground surface detection distinguishes concrete, gravel, and grass across Lalkhan Bazar', () => {
  // Ispahani Circle sidewalk & CDA Avenue -> concrete
  assert.equal(detectGroundSurface({ x: 262, z: 344 }), 'concrete');
  // Elevated flyover deck & landmark interiors -> concrete
  assert.equal(detectGroundSurface({ x: 500, z: 180, onFlyover: true }), 'concrete');
  assert.equal(detectGroundSurface({ x: 500, z: 180, insideLandmark: true }), 'concrete');

  // Earthen / laterite footpath & roadside shoulder -> gravel
  assert.equal(detectGroundSurface({ x: 687.4, z: 649.5 }), 'gravel');
  assert.equal(detectGroundSurface({ x: 250, z: 344 }), 'gravel');

  // Chittagong Club green pocket & Batali hill slopes away from roads -> grass
  assert.equal(detectGroundSurface({ x: 500, z: 180 }), 'grass');
  assert.equal(detectGroundSurface({ x: -260, z: 200 }), 'grass');

  // Acoustic synthesis profiles differ per surface
  const pConcrete = getFootstepAudioProfile('concrete');
  const pGrass = getFootstepAudioProfile('grass');
  const pGravel = getFootstepAudioProfile('gravel');
  assert.ok(pGravel.grainCount > pConcrete.grainCount);
  assert.ok(pGrass.durationSec > pConcrete.durationSec);
  assert.ok(pGravel.filterFreqHz > pConcrete.filterFreqHz && pConcrete.filterFreqHz > pGrass.filterFreqHz);
});

import {
  buildTrafficIntersections,
  computeVehicleTargetSpeed,
  evaluateIntersectionSignal,
} from './trafficRules';
import {
  PHOTO_GRAIN_FRAGMENT_SHADER,
  computeHighResSnapshotSize,
} from '../engine/photoPostProcess';

test('AI traffic system enforces intersection stop-and-go signals and vehicle queue spacing', () => {
  const graph = buildRoadGraph(GIS_DATA.roads);
  const intersections = buildTrafficIntersections(graph);
  assert.ok(intersections.length >= 3, 'Should include verified Lalkhan Bazar signal junctions');

  // Verify two-phase signal alternation
  const sigPhaseA = evaluateIntersectionSignal(2.0, 14, 0); // N-S green, E-W red
  assert.equal(sigPhaseA.nsState, 'green');
  assert.equal(sigPhaseA.ewState, 'red');

  const sigPhaseB = evaluateIntersectionSignal(9.0, 14, 0); // N-S red, E-W green
  assert.equal(sigPhaseB.nsState, 'red');
  assert.equal(sigPhaseB.ewState, 'green');

  // Vehicle approaching Ispahani Circle (268.7, 324.1) heading North (yaw = PI) 12m south of center
  const probe = {
    id: 'ai_test_1',
    x: 268.7,
    y: 12,
    z: 336.1,
    yaw: Math.PI,
    speed: 10,
    maxSpeed: 14,
    onFlyover: false,
  };

  // At t=9.0s, N-S is RED -> approaching ground vehicle stops
  const onRed = computeVehicleTargetSpeed(probe, [probe], intersections, 9.0, 0);
  assert.equal(onRed.stoppedBySignal, true);
  assert.equal(onRed.targetSpeed, 0);

  // At t=2.0s, N-S is GREEN -> vehicle proceeds
  const onGreen = computeVehicleTargetSpeed(probe, [probe], intersections, 2.0, 0);
  assert.equal(onGreen.stoppedBySignal, false);
  assert.ok(onGreen.targetSpeed > 8);

  // Same coordinates on flyover overhead never stop at ground red lights
  const flyProbe = { ...probe, y: 20.6, onFlyover: true };
  const flyoverFlow = computeVehicleTargetSpeed(flyProbe, [flyProbe], intersections, 9.0, 0);
  assert.equal(flyoverFlow.stoppedBySignal, false);
  assert.ok(flyoverFlow.targetSpeed > 8);

  // Car-following rule stops trailing vehicle behind a stopped lead vehicle 6m ahead
  const lead = { ...probe, id: 'ai_lead', z: 330.1, speed: 0 };
  const queued = computeVehicleTargetSpeed(probe, [probe, lead], intersections, 2.0, 0);
  assert.equal(queued.stoppedByTraffic, true);
  assert.equal(queued.targetSpeed, 0);
});

test('Photo Mode film-grain shader uniforms and high-resolution snapshot dimensions are valid', () => {
  assert.ok(PHOTO_GRAIN_FRAGMENT_SHADER.includes('uGrainStrength'));
  assert.ok(PHOTO_GRAIN_FRAGMENT_SHADER.includes('uTime'));
  assert.ok(PHOTO_GRAIN_FRAGMENT_SHADER.includes('tDiffuse'));

  const sw = computeHighResSnapshotSize(1440, 900, true);
  assert.equal(sw.width, 1920);
  assert.equal(sw.height, 1200);

  const gpu = computeHighResSnapshotSize(1440, 900, false);
  assert.equal(gpu.width, 2880);
  assert.equal(gpu.height, 1800);
});

import { ROAD_BARRIERS, U_TURN_OPENINGS, isInsideUTurnOpening } from './roadBarriers';
import { FLYOVER_SEGMENTS } from './terrain';
import { getLaneLateralOffset } from './roadGraph';
import { findUTurnTransferTarget, resolveVehiclePairCollision } from './trafficRules';
import {
  NEW_MARKET_VENDOR_LINES,
  ROADSIDE_AND_NEW_MARKET_SHOPS,
  computeSpatialVoiceGain,
  findNearestVendorVoiceCandidate,
} from './newMarketAndShops';

test('Road center dividers block vehicles while designated U-turn openings remain open for safe turning', () => {
  const grid = new WorldCollisionGrid();
  assert.ok(ROAD_BARRIERS.groundDividers.length >= 20, 'Ground road dividers must be populated');

  // Pick a tall non-jumpable concrete center divider segment
  const tallDiv = ROAD_BARRIERS.groundDividers.find((b) => !b.jumpable && b.kind === 'concrete_divider')!;
  assert.ok(tallDiv, 'Expected concrete center divider segment');
  const midX = (tallDiv.x1 + tallDiv.x2) * 0.5;
  const midZ = (tallDiv.z1 + tallDiv.z2) * 0.5;
  const midY = (tallDiv.baseY1 + tallDiv.baseY2) * 0.5;

  // Vehicle driving into the concrete divider MUST collide and be blocked
  const vehHit = grid.resolveCircle(midX, midZ, 1.15, 0, null, { actorAbsY: midY, isVehicle: true });
  assert.equal(vehHit.hit, true);
  assert.equal(vehHit.hitBarrierKind, 'concrete_divider');

  // Even a jumping player cannot clear a tall 1.28m concrete divider
  const jumpHitTall = grid.resolveCircle(midX, midZ, 0.42, 1.04, null, {
    actorAbsY: midY + 1.04,
    isVehicle: false,
  });
  assert.equal(jumpHitTall.hit, true);

  // Designated U-turn bay centers must NOT contain a concrete divider
  assert.ok(U_TURN_OPENINGS.length >= 3);
  const ut = U_TURN_OPENINGS[1]; // Lalkhan Bazar U-Turn Bay
  assert.ok(isInsideUTurnOpening(ut.x, ut.z) !== null);
  const utHit = grid.resolveCircle(ut.x, ut.z, 1.15, 0, null, {
    actorAbsY: getTerrainHeight(ut.x, ut.z),
    isVehicle: true,
  });
  assert.notEqual(utHit.hitBarrierKind, 'concrete_divider');

  // U-turn lane transfer helper finds opposing lane cleanly
  const graph = buildRoadGraph();
  const transfer = findUTurnTransferTarget(ut.x, ut.z, 0, 'test_road', graph.driveableLanes, ut);
  assert.ok(transfer !== null, 'Expected valid opposing lane target inside U-turn bay');
});

test('Low jumpable barriers block walking and vehicles while Space jump clears them cleanly', () => {
  const grid = new WorldCollisionGrid();
  const lowBar = ROAD_BARRIERS.groundDividers.find((b) => b.jumpable && b.kind === 'low_metal_barrier')!;
  assert.ok(lowBar, 'Expected low jumpable metal barrier');
  const mx = (lowBar.x1 + lowBar.x2) * 0.5;
  const mz = (lowBar.z1 + lowBar.z2) * 0.5;
  const my = (lowBar.baseY1 + lowBar.baseY2) * 0.5;

  // Ground walking is blocked
  const walkBlock = grid.resolveCircle(mx, mz, 0.42, 0.1, null, { actorAbsY: my + 0.1, isVehicle: false });
  assert.equal(walkBlock.hit, true);
  assert.equal(walkBlock.hitBarrierKind, 'low_metal_barrier');

  // Vehicles are ALWAYS blocked even if barrier is jumpable for pedestrians
  const vehBlock = grid.resolveCircle(mx, mz, 1.15, 0.6, null, { actorAbsY: my + 0.6, isVehicle: true });
  assert.equal(vehBlock.hit, true);

  // Player mid-jump (0.75m above ground) clears the 0.56m low barrier
  const jumpClear = grid.resolveCircle(mx, mz, 0.42, 0.75, null, { actorAbsY: my + 0.75, isVehicle: false });
  assert.equal(jumpClear.hitBarrierKind, null);
});

test('Flyover decks are smoothly subdivided and enforce side crash walls & opposite-direction center dividers', () => {
  assert.ok(FLYOVER_SEGMENTS.length > 40);
  for (const seg of FLYOVER_SEGMENTS) {
    const len = Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
    assert.ok(len <= 10.5, `Flyover segment ${seg.id} length ${len}m exceeds smooth 10.5m cap`);
  }

  const grid = new WorldCollisionGrid();
  const wall = ROAD_BARRIERS.flyoverBarriers[0];
  const div = ROAD_BARRIERS.flyoverDividers[0];
  assert.ok(wall && div, 'Expected flyover side walls and center divider');

  const wx = (wall.x1 + wall.x2) * 0.5;
  const wz = (wall.z1 + wall.z2) * 0.5;
  const wy = (wall.baseY1 + wall.baseY2) * 0.5;

  // Vehicle on flyover deck hitting side barrier MUST be stopped
  const flyWallHit = grid.resolveCircle(wx, wz, 1.15, 8.6, null, { actorAbsY: wy + 0.2, isVehicle: true });
  assert.equal(flyWallHit.hit, true);
  assert.equal(flyWallHit.hitBarrierKind, 'flyover_wall');

  // Vehicle driving underneath flyover at ground height MUST NOT collide with overhead flyover wall
  const groundY = getTerrainHeight(wx, wz);
  const groundUnder = grid.resolveCircle(wx, wz, 1.15, 0, null, { actorAbsY: groundY, isVehicle: true });
  assert.notEqual(groundUnder.hitBarrierKind, 'flyover_wall');

  // Flyover opposite lane offsets stay strictly separated on opposite sides of center divider
  const posOff = getLaneLateralOffset({ hw: 'trunk', bridge: true, oneway: false }, 1);
  const negOff = getLaneLateralOffset({ hw: 'trunk', bridge: true, oneway: false }, -1);
  assert.ok(posOff > 2.0 && negOff < -2.0 && posOff === -negOff);
});

test('Bangladeshi roadside shops & New Market Plaza include all requested business types, solid colliders, and spatial Bengali vendor voices', () => {
  const categories = new Set(ROADSIDE_AND_NEW_MARKET_SHOPS.map((s) => s.category));
  for (const req of [
    'tea_stall',
    'paan_shop',
    'clothing',
    'car_showroom',
    'motorbike_showroom',
    'grocery',
    'restaurant',
    'mobile_shop',
    'electronics',
    'pharmacy',
    'shopping_complex',
    'bus_counter',
    'repair_garage',
    'footwear',
    'bags',
    'cosmetics',
    'toys',
    'household',
  ] as const) {
    assert.ok(categories.has(req), `Missing requested Bangladeshi shop category: ${req}`);
  }

  // Solid shop collider check (New Market Main Arcade)
  const grid = new WorldCollisionGrid();
  const mainNM = ROADSIDE_AND_NEW_MARKET_SHOPS.find((s) => s.id === 'nm_main_building_east')!;
  const shopHit = grid.resolveCircle(mainNM.x, mainNM.z, 0.45, 0, null, {
    actorAbsY: getTerrainHeight(mainNM.x, mainNM.z),
    isVehicle: false,
  });
  assert.equal(shopHit.hit, true);

  // Spatial Bengali vendor voice gain & proximity candidate
  assert.equal(computeSpatialVoiceGain(1.5, 24), 1.0);
  assert.ok(computeSpatialVoiceGain(8, 24) > computeSpatialVoiceGain(18, 24));
  assert.equal(computeSpatialVoiceGain(30, 24), 0);

  const nmClothing = ROADSIDE_AND_NEW_MARKET_SHOPS.find((s) => s.id === 'nm_stall_clothing_1')!;
  const cand = findNearestVendorVoiceCandidate(nmClothing.x, nmClothing.z + 4.2, new Map(), 22);
  assert.ok(cand !== null, 'Expected nearby New Market vendor voice candidate');
  assert.ok(NEW_MARKET_VENDOR_LINES.some((l) => l.id === cand!.line.id));
  assert.ok(cand!.line.bengaliText.length > 0 && cand!.spatialGain > 0.5);

  // Vehicle-to-vehicle physical separation
  const sep = resolveVehiclePairCollision(
    100.5,
    10,
    200,
    1.2,
    [{ id: 'other_car', x: 100, y: 10, z: 200, radius: 1.2 }],
    'self_car'
  );
  assert.equal(sep.hitVehicle, true);
  assert.ok(Math.hypot(sep.x - 100, sep.z - 200) >= 2.39);
});

import {
  CHARACTER_BODY_PROPORTIONS,
  CHARACTER_REF_CROPS,
  CHARACTER_REF_DIMENSIONS,
  CHARACTER_REF_IMAGE_URL,
} from './characterReference';

test('4-view protagonist reference crop rects fit inside sheet bounds and preserve exact blocky proportions', () => {
  assert.equal(CHARACTER_REF_IMAGE_URL, '/assets/aistudio/file_00000000275082118eadfb0e7497ce25_dd2ae07e.png');
  const { sheetWidth, sheetHeight, worldHeightM } = CHARACTER_REF_DIMENSIONS;
  for (const [key, r] of Object.entries(CHARACTER_REF_CROPS)) {
    assert.ok(r.x >= 0 && r.y >= 0, `${key} crop origin must be non-negative`);
    assert.ok(r.w > 10 && r.h > 10, `${key} crop dimensions must be positive`);
    assert.ok(r.x + r.w <= sheetWidth, `${key} exceeds sheet width`);
    assert.ok(r.y + r.h <= sheetHeight, `${key} exceeds sheet height`);
  }

  // Front, Back, Left, and Right views must not overlap horizontally
  assert.ok(CHARACTER_REF_CROPS.armLeftFront.x + CHARACTER_REF_CROPS.armLeftFront.w < CHARACTER_REF_CROPS.armLeftBack.x);
  assert.ok(CHARACTER_REF_CROPS.armRightBack.x + CHARACTER_REF_CROPS.armRightBack.w < CHARACTER_REF_CROPS.headLeft.x);
  assert.ok(CHARACTER_REF_CROPS.headLeft.x + CHARACTER_REF_CROPS.headLeft.w < CHARACTER_REF_CROPS.headRight.x);

  // Total assembled height matches worldHeightM (legs + torso + head)
  const assembledHeight =
    CHARACTER_BODY_PROPORTIONS.hipY +
    CHARACTER_BODY_PROPORTIONS.torsoHeight +
    CHARACTER_BODY_PROPORTIONS.headHeight;
  assert.ok(Math.abs(assembledHeight - worldHeightM) < 0.01);
  // Feet rest cleanly at y = 0 (hipY + kneeOffsetY - shinHeight - shoeHeight === 0)
  const soleY =
    CHARACTER_BODY_PROPORTIONS.hipY +
    CHARACTER_BODY_PROPORTIONS.kneeOffsetY -
    CHARACTER_BODY_PROPORTIONS.shinHeight -
    CHARACTER_BODY_PROPORTIONS.shoeHeight;
  assert.ok(Math.abs(soleY) < 0.005, `Expected sole at y=0, got ${soleY}`);
});

import {
  AMEEN_APARTMENT_SPOTS,
  AMEEN_CENTER_SPEC,
  AMEEN_FRONT_SPAWN,
  AMEEN_GROUND_SHOPS,
  FLOOR2_APARTMENT_COLLIDERS,
  ameenLocalToWorld,
  findNearestAmeenGroundShop,
  findNearestApartmentSpot,
  resolveAmeenCenterInterior,
  resolveAmeenStairRamp,
  worldToAmeenLocal,
} from './ameenCenter';
import {
  createIdleSleepState,
  startSleepSequence,
  stepSleepSequence,
} from './sleepSystem';
import { DEFAULT_SPAWN, createInitialSaveData } from './worldState';
import { migrateSaveData } from './saveSystem';
import {
  computeVehicleHudReadout,
  stepVehicleDrivePhysics,
} from './vehicleControls';
import {
  COMPANION_DIALOGUE_LINES,
  FIXED_COMPANION_IDENTITY,
  getVehiclePassengerSeatOffset,
  transformSeatToWorld,
} from './companionState';

test('Ameen Center spawn is unobstructed, doorways allow walkthrough, Floor 2 apartment colliders & stairs work bidirectionally', () => {
  const grid = new WorldCollisionGrid();
  assert.equal(DEFAULT_SPAWN.x, AMEEN_FRONT_SPAWN.x);
  assert.equal(DEFAULT_SPAWN.z, AMEEN_FRONT_SPAWN.z);

  // Front entrance sidewalk spawn must NOT collide for player or companion
  const spawnHit = grid.resolveCircle(DEFAULT_SPAWN.x, DEFAULT_SPAWN.z, 0.45, 0, null);
  assert.equal(spawnHit.hit, false, 'Ameen Center front spawn must be completely clear');

  // Round-trip world <-> local transforms match Three.js Y-rotation cleanly
  const doorWorld = ameenLocalToWorld(0, 8.0);
  const backLocal = worldToAmeenLocal(doorWorld.x, doorWorld.z);
  assert.ok(Math.abs(backLocal.lx - 0) < 0.001);
  assert.ok(Math.abs(backLocal.lz - 8.0) < 0.001);

  // Walking straight through front double glass door (|lx| < 2.5, lz = 7.6) is unobstructed on Ground Floor
  const doorPass = resolveAmeenCenterInterior(0, 7.6, 0.42, 0);
  assert.equal(doorPass.hit, false, 'Center doorway must remain open');

  // Walking through solid wall away from doorway pushes back
  const wallBlocked = resolveAmeenCenterInterior(9.0, 7.8, 0.42, 0);
  assert.equal(wallBlocked.hit, true);

  // Ground floor shops match all 6 reference brands (Bata, oppo, SAMSUNG, vivo, realme, itel)
  const brands = AMEEN_GROUND_SHOPS.map((s) => s.brand);
  for (const b of ['Bata', 'oppo', 'SAMSUNG', 'vivo', 'realme', 'itel']) {
    assert.ok(brands.includes(b), `Expected Ameen Center ground shop brand ${b}`);
  }
  const nearBata = findNearestAmeenGroundShop(-14.1, 2.5, 0);
  assert.equal(nearBata?.brand, 'Bata');

  // Floor 2 Apartment spots and solid furniture colliders work
  assert.ok(FLOOR2_APARTMENT_COLLIDERS.length >= 10);
  assert.ok(AMEEN_APARTMENT_SPOTS.some((s) => s.id === 'bed'));
  const bedSpot = findNearestApartmentSpot(1.5, -4.1, 2);
  assert.equal(bedSpot?.id, 'bed');

  // Bidirectional stairs climb Ground (0) -> Floor 1 -> Floor 2 and descend Floor 2 -> Floor 1 -> Ground (0)
  const midClimb = resolveAmeenStairRamp(-8.0, -1.0, 0, 12.0, 'up');
  assert.equal(midClimb.onRamp, true);
  assert.ok(midClimb.y > 12.14 && midClimb.y < 16.34);

  const topFinish = resolveAmeenStairRamp(-8.0, -5.5, 0, 12.0, 'up');
  assert.equal(topFinish.nextFloor, 1);
  assert.ok(topFinish.exitedToLz !== null && topFinish.exitedToLz < AMEEN_CENTER_SPEC.stairBounds.zTop);

  const downFinish = resolveAmeenStairRamp(-8.0, 3.1, 2, 12.0, 'down');
  assert.equal(downFinish.nextFloor, 1);
  assert.ok(downFinish.exitedToLz !== null && downFinish.exitedToLz > AMEEN_CENTER_SPEC.stairBounds.zBottom);
});

test('Sleep state machine completes full walk-to-bed -> lie -> fade -> Sleeping... -> wake sequence inside bedroom', () => {
  const idle = createIdleSleepState();
  assert.equal(idle.phase, 'idle');

  let state = startSleepSequence({
    startX: 0,
    startZ: -3.5,
    bedSideX: 0.1,
    bedSideZ: -4.2,
    mattressX: 1.75,
    mattressZ: -5.35,
    bedSurfaceY: 21.16,
    floorStandingY: 20.54,
    sleepDurationHours: 7.5,
  });
  assert.equal(state.phase, 'walking_to_bed');

  let sawSleepingScreen = false;
  let restAppliedCount = 0;
  let wokeCount = 0;
  let finalX = 0;
  let finalY = 0;
  let finalZ = 0;

  for (let i = 0; i < 400; i++) {
    const out = stepSleepSequence(state, 0.05, AMEEN_CENTER_SPEC.yaw);
    state = out.state;
    if (state.phase === 'sleeping_screen') {
      sawSleepingScreen = true;
      assert.equal(state.fadeOpacity, 1);
    }
    if (out.applyRestNow) restAppliedCount++;
    if (out.justWokeUp) {
      wokeCount++;
      finalX = out.playerX;
      finalY = out.playerY;
      finalZ = out.playerZ;
    }
    if (state.phase === 'idle') break;
  }

  assert.equal(sawSleepingScreen, true);
  assert.equal(restAppliedCount, 1);
  assert.equal(wokeCount, 1);
  assert.equal(state.phase, 'idle');
  // Wakes standing beside the Floor 2 bed, never teleported outside!
  assert.ok(Math.abs(finalX - 0.1) < 0.05);
  assert.ok(Math.abs(finalZ - (-4.2)) < 0.05);
  assert.ok(Math.abs(finalY - 20.54) < 0.05);
});

test('Save migration preserves home apartment, character/companion identity, and updates pre-v3 saves to start outside Ameen Center', () => {
  const initial = createInitialSaveData();
  assert.equal(initial.homeBuildingId, 'amin_centre');
  assert.equal(initial.saveVersion, 3);
  assert.equal(initial.x, DEFAULT_SPAWN.x);
  assert.equal(initial.z, DEFAULT_SPAWN.z);
  assert.equal(initial.companion.name, FIXED_COMPANION_IDENTITY.name);

  // Migrating pre-v3 saves (v1 or v2) moves player right in front of Ameen Center while preserving wallet & items
  const migratedV1 = migrateSaveData({
    saveVersion: 1,
    x: 262,
    z: 344,
    walletBdt: 8900,
    inventory: [{ id: 'cha_1', name: 'Cha Cup', bengaliName: 'গরম চা', count: 1, kind: 'drink' }],
  });
  assert.equal(migratedV1.saveVersion, 3);
  assert.equal(migratedV1.x, DEFAULT_SPAWN.x);
  assert.equal(migratedV1.z, DEFAULT_SPAWN.z);
  assert.equal(migratedV1.walletBdt, 8900);
  assert.equal(migratedV1.inventory[0]?.name, 'Cha Cup');

  const migratedPreV3Offsite = migrateSaveData({
    saveVersion: 2,
    x: 415,
    z: 180,
    walletBdt: 3400,
    sleepCount: 2,
  });
  assert.equal(migratedPreV3Offsite.saveVersion, 3);
  assert.equal(migratedPreV3Offsite.x, DEFAULT_SPAWN.x);
  assert.equal(migratedPreV3Offsite.z, DEFAULT_SPAWN.z);
  assert.equal(migratedPreV3Offsite.walletBdt, 3400);
  assert.equal(migratedPreV3Offsite.sleepCount, 2);

  // Mid-game v3 reload inside Floor 2 apartment preserves player position & fixed companion identity
  const migratedV3 = migrateSaveData({
    saveVersion: 3,
    x: 271.5,
    y: 20.54,
    z: 244.0,
    insideLandmarkId: 'amin_centre',
    currentFloor: 2,
    sleepCount: 3,
    companion: {
      id: 'hacked',
      name: 'Random',
      bengaliName: 'অন্য',
      currentFloor: 2,
      x: 270,
      y: 20.54,
      z: 245,
      yaw: 0,
      state: 'following',
      insideBuildingId: 'amin_centre',
    },
  });
  assert.equal(migratedV3.insideLandmarkId, 'amin_centre');
  assert.equal(migratedV3.currentFloor, 2);
  assert.equal(migratedV3.sleepCount, 3);
  assert.equal(migratedV3.companion.id, FIXED_COMPANION_IDENTITY.id);
  assert.equal(migratedV3.companion.name, FIXED_COMPANION_IDENTITY.name);
});

test('Vehicle mobile controls enforce realistic braking to zero before engaging Reverse gear', () => {
  // Moving forward at 12 m/s, pressing Brake/Reverse slows smoothly without jumping straight into negative speed
  let speed = 12.0;
  for (let i = 0; i < 6; i++) {
    speed = stepVehicleDrivePhysics(
      speed,
      26,
      { accelerate: false, brakeOrReverse: true, handbrake: false, steer: 0 },
      0.1
    );
    assert.ok(speed >= 0, 'Must brake forward speed down to 0 before engaging reverse');
  }
  // Continue holding Brake/Reverse from standstill -> Reverse gear engages smoothly
  for (let i = 0; i < 10; i++) {
    speed = stepVehicleDrivePhysics(
      speed,
      26,
      { accelerate: false, brakeOrReverse: true, handbrake: false, steer: 0 },
      0.1
    );
  }
  assert.ok(speed < -2.0, `Expected reverse speed < -2.0 m/s, got ${speed}`);
  const revHud = computeVehicleHudReadout(speed, true);
  assert.equal(revHud.gear, 'R');
  assert.equal(revHud.isReversing, true);
  assert.ok(revHud.speedKmh > 0);
});

test('Companion passenger seat transforms support all 5 vehicle types and NPC greetings include Bangla dialogue lines', () => {
  for (const vType of ['car', 'cng', 'bus', 'rickshaw', 'motorbike'] as const) {
    const off = getVehiclePassengerSeatOffset(vType);
    const worldSeat = transformSeatToWorld(100, 12, 200, Math.PI * 0.5, off);
    assert.ok(Number.isFinite(worldSeat.x) && Number.isFinite(worldSeat.y) && Number.isFinite(worldSeat.z));
    assert.ok(worldSeat.y > 12.1);
  }
  assert.ok(COMPANION_DIALOGUE_LINES.length >= 4);

  const requiredBangla = [
    'ভাই, কোথায় যাবেন?',
    'আমাদের দোকানে নতুন পণ্য এসেছে।',
    'কেমন আছেন?',
    'কিছু কিনবেন?',
    'এইদিকে আসুন!',
  ];
  for (const line of requiredBangla) {
    assert.ok(
      CHITTAGONIAN_GREETINGS.some((g) => g.bengaliText === line),
      `Missing required Bangla NPC dialogue line: ${line}`
    );
  }
});

