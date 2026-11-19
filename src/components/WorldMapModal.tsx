import { useEffect, useRef, useState } from 'react';
import { Compass, Home, Layers, MapPin, Navigation, X } from 'lucide-react';
import {
  FUTURE_EXPANSION_CHUNKS,
  GIS_DATA,
  LALKHAN_LOCALITY_BOUNDARY,
  getSurveyReport,
} from '../gis/projection';
import {
  LandmarkRecord,
  VERIFIED_BUS_STOPS,
  VERIFIED_LANDMARKS,
  getLandmarkWithLatLon,
} from '../gis/landmarks';
import { FLYOVER_SEGMENTS, sampleElevationASL } from '../sim/terrain';
import { NEW_MARKET_CONNECTOR_ROADS, NEW_MARKET_GATE_POS } from '../sim/newMarketAndShops';
import { U_TURN_OPENINGS } from '../sim/roadBarriers';
import { AMEEN_CENTER_SPEC, ameenLocalToWorld } from '../sim/ameenCenter';
import { drawMapHouseIcon } from './mapIcons';

interface WorldMapModalProps {
  playerX: number;
  playerZ: number;
  onFastTravel: (x: number, z: number, label: string, yaw?: number) => void;
  onClose: () => void;
}

export function WorldMapModal({ playerX, playerZ, onFastTravel, onClose }: WorldMapModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tab, setTab] = useState<'map' | 'survey' | 'expansion'>('map');
  const [selectedLandmark, setSelectedLandmark] = useState<LandmarkRecord | null>(
    VERIFIED_LANDMARKS.find((l) => l.id === AMEEN_CENTER_SPEC.id) ?? VERIFIED_LANDMARKS[0]
  );
  const survey = getSurveyReport();

  useEffect(() => {
    if (tab !== 'map') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const baseB = GIS_DATA.meta.boundsMetric;
    const b = {
      minX: baseB.minX,
      maxX: Math.max(baseB.maxX, 980),
      minZ: baseB.minZ,
      maxZ: baseB.maxZ,
    };
    const pad = 18;
    const scale = Math.min((W - pad * 2) / (b.maxX - b.minX), (H - pad * 2) / (b.maxZ - b.minZ));
    const offX = (W - (b.maxX - b.minX) * scale) * 0.5;
    const offY = (H - (b.maxZ - b.minZ) * scale) * 0.5;

    const toPx = (x: number, z: number): [number, number] => [
      offX + (x - b.minX) * scale,
      offY + (z - b.minZ) * scale,
    ];

    ctx.fillStyle = '#0c131a';
    ctx.fillRect(0, 0, W, H);

    // 1. Real SRTM Elevation heatmap cells
    const elev = GIS_DATA.elevation;
    const cellW = ((elev.maxX - elev.minX) / (elev.cols - 1)) * scale + 1;
    const cellH = ((elev.maxZ - elev.minZ) / (elev.rows - 1)) * scale + 1;
    for (let r = 0; r < elev.rows; r++) {
      for (let c = 0; c < elev.cols; c++) {
        const val = elev.values[r * elev.cols + c];
        const wx = elev.minX + (c / (elev.cols - 1)) * (elev.maxX - elev.minX);
        const wz = elev.maxZ - (r / (elev.rows - 1)) * (elev.maxZ - elev.minZ);
        const [px, pz] = toPx(wx, wz);
        const t = Math.max(0, Math.min(1, (val - 12) / 47));
        const rCol = Math.round(22 + t * 44);
        const gCol = Math.round(35 + t * 62);
        const bCol = Math.round(32 + (1 - t) * 18);
        ctx.fillStyle = `rgb(${rCol},${gCol},${bCol})`;
        ctx.fillRect(px - cellW * 0.5, pz - cellH * 0.5, cellW, cellH);
      }
    }

    // 2. Estimated Ward 14 Lalkhan Bazar locality boundary
    ctx.strokeStyle = 'rgba(245, 194, 82, 0.85)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    LALKHAN_LOCALITY_BOUNDARY.forEach(([bx, bz], i) => {
      const [px, pz] = toPx(bx, bz);
      if (i === 0) ctx.moveTo(px, pz);
      else ctx.lineTo(px, pz);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. All 4,190 mapped buildings
    ctx.fillStyle = 'rgba(182, 194, 204, 0.28)';
    for (const bldg of GIS_DATA.buildings) {
      const [px, pz] = toPx(bldg.cx, bldg.cz);
      const r = Math.max(1.2, Math.sqrt(bldg.area) * scale * 0.5);
      ctx.fillRect(px - r * 0.5, pz - r * 0.5, r, r);
    }

    // 4. All 239 OSM roads + New Market Connector Roads
    for (const road of [...GIS_DATA.roads, ...NEW_MARKET_CONNECTOR_ROADS]) {
      if (road.bridge) continue;
      ctx.strokeStyle =
        road.hw === 'trunk' || road.hw === 'primary'
          ? '#eae4d8'
          : road.hw === 'secondary' || road.hw === 'tertiary'
            ? '#9aa8b5'
            : 'rgba(130, 148, 165, 0.52)';
      ctx.lineWidth = road.hw === 'trunk' ? 2.4 : road.hw === 'primary' ? 1.8 : 0.85;
      ctx.beginPath();
      road.pts.forEach(([rx, rz], i) => {
        const [px, pz] = toPx(rx, rz);
        if (i === 0) ctx.moveTo(px, pz);
        else ctx.lineTo(px, pz);
      });
      ctx.stroke();
    }

    // 4b. New Market (Biponi Bitan) Plaza Footprint
    const [nmX1, nmZ1] = toPx(840, 446);
    const [nmX2, nmZ2] = toPx(954, 632);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.72)';
    ctx.lineWidth = 1.3;
    ctx.fillRect(nmX1, nmZ1, nmX2 - nmX1, nmZ2 - nmZ1);
    ctx.strokeRect(nmX1, nmZ1, nmX2 - nmX1, nmZ2 - nmZ1);

    // 5. Elevated Flyover & Ramps
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    for (const s of FLYOVER_SEGMENTS) {
      const [x1, z1] = toPx(s.x1, s.z1);
      const [x2, z2] = toPx(s.x2, s.z2);
      ctx.moveTo(x1, z1);
      ctx.lineTo(x2, z2);
    }
    ctx.stroke();

    // 5b. Designated U-Turn Openings
    for (const ut of U_TURN_OPENINGS) {
      const [px, pz] = toPx(ut.x, ut.z);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(px, pz, 3.6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 6. Bus Stops & Verified Landmarks
    for (const bs of VERIFIED_BUS_STOPS) {
      const [px, pz] = toPx(bs.x, bs.z);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(px - 3, pz - 3, 6, 6);
    }

    for (const lm of VERIFIED_LANDMARKS) {
      if (lm.id === AMEEN_CENTER_SPEC.id) continue;
      const [px, pz] = toPx(lm.x, lm.z);
      const isSel = selectedLandmark?.id === lm.id;
      ctx.fillStyle = lm.isMosque ? '#10b981' : '#f59e0b';
      ctx.beginPath();
      ctx.arc(px, pz, isSel ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
      if (isSel) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // 6b. Home Icon (Ameen Center / বাসা) drawn on top so player can spot and travel Home immediately
    const homeLm = VERIFIED_LANDMARKS.find((l) => l.id === AMEEN_CENTER_SPEC.id);
    if (homeLm) {
      const [hx, hz] = toPx(homeLm.x, homeLm.z);
      const isHomeSel = selectedLandmark?.id === homeLm.id;
      drawMapHouseIcon(ctx, hx, hz, isHomeSel ? 17 : 15, isHomeSel);

      const tagText = 'HOME · আমিন সেন্টার';
      ctx.font = 'bold 10px Inter, sans-serif';
      const tagW = ctx.measureText(tagText).width + 10;
      const tagX = Math.max(8, Math.min(W - tagW - 8, hx - tagW * 0.5));
      const tagY = Math.max(8, hz - 28);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(tagX, tagY, tagW, 16, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.textBaseline = 'middle';
      ctx.fillText(tagText, tagX + 5, tagY + 8.5);
    }

    // 7. Current Player Position
    const [ppx, ppz] = toPx(playerX, playerZ);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(ppx, ppz, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }, [tab, playerX, playerZ, selectedLandmark]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const cy = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const baseB = GIS_DATA.meta.boundsMetric;
    const b = {
      minX: baseB.minX,
      maxX: Math.max(baseB.maxX, 980),
      minZ: baseB.minZ,
      maxZ: baseB.maxZ,
    };
    const pad = 18;
    const scale = Math.min((canvas.width - pad * 2) / (b.maxX - b.minX), (canvas.height - pad * 2) / (b.maxZ - b.minZ));
    const offX = (canvas.width - (b.maxX - b.minX) * scale) * 0.5;
    const offY = (canvas.height - (b.maxZ - b.minZ) * scale) * 0.5;

    const wx = b.minX + (cx - offX) / scale;
    const wz = b.minZ + (cy - offY) / scale;

    let nearest: LandmarkRecord | null = null;
    let bestD = 70;
    for (const lm of VERIFIED_LANDMARKS) {
      const d = Math.hypot(lm.x - wx, lm.z - wz);
      if (d < bestD) {
        bestD = d;
        nearest = lm;
      }
    }
    if (nearest) setSelectedLandmark(nearest);
  };

  const selDetail = selectedLandmark ? getLandmarkWithLatLon(selectedLandmark) : null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[#d6cfc2]/20 bg-[#101820] text-[#f4f1ea] shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight text-[#f4f1ea]">
              Lalkhan Bazar GIS Map & Survey
            </h2>
            <p className="text-xs text-[#a5b0ba]">
              1:1 Metric UTM Zone 46N · 1 Game Meter = 1 Real-World Meter · {GIS_DATA.meta.attribution}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('map')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                tab === 'map' ? 'bg-amber-400 text-[#0f172a]' : 'bg-white/5 text-[#cfd6dd] hover:bg-white/10'
              }`}
            >
              Interactive Map
            </button>
            <button
              type="button"
              onClick={() => setTab('survey')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                tab === 'survey' ? 'bg-amber-400 text-[#0f172a]' : 'bg-white/5 text-[#cfd6dd] hover:bg-white/10'
              }`}
            >
              GIS Survey Report
            </button>
            <button
              type="button"
              onClick={() => setTab('expansion')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                tab === 'expansion' ? 'bg-amber-400 text-[#0f172a]' : 'bg-white/5 text-[#cfd6dd] hover:bg-white/10'
              }`}
            >
              Chattogram Expansion
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close map modal"
              className="ml-2 flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        {tab === 'map' && (
          <div className="grid flex-1 gap-5 overflow-y-auto p-5 lg:grid-cols-[1.45fr_1fr]">
            <div className="flex flex-col gap-3">
              <canvas
                ref={canvasRef}
                width={640}
                height={520}
                onClick={handleCanvasClick}
                className="w-full cursor-crosshair rounded-lg border border-white/10 bg-[#0c131a]"
              />
              <div className="flex flex-wrap items-center gap-4 text-xs text-[#b5c0c9]">
                <span className="inline-flex items-center gap-1 font-semibold text-amber-300">
                  <Home className="h-3.5 w-3.5 text-sky-400" />
                  Home Icon: Ameen Center (বাসা)
                </span>
                <span>·</span>
                <span>White Circle: Player</span>
                <span>·</span>
                <span className="text-amber-300">Amber Line: Flyover & Expressway</span>
                <span>·</span>
                <span className="text-emerald-400">Green Dot: Mosque</span>
                <span>·</span>
                <span className="text-sky-400">Blue Square: Bus Stop</span>
                <span>·</span>
                <span className="text-amber-200">Dashed: Est. Ward 14 Boundary</span>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {selDetail && (
                <div className="rounded-lg border border-white/10 bg-[#16212c] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-amber-300">{selDetail.bengaliName}</span>
                    {selDetail.id === AMEEN_CENTER_SPEC.id && (
                      <span className="inline-flex items-center gap-1 rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-300 border border-sky-400/35">
                        <Home className="h-3 w-3" />
                        HOME · বাসা
                      </span>
                    )}
                  </div>
                  <h3 className="font-display text-lg font-bold text-white">{selDetail.name}</h3>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono-tabular text-xs text-[#9fb0be]">
                    <span>{selDetail.lat.toFixed(5)}° N, {selDetail.lon.toFixed(5)}° E</span>
                    <span>·</span>
                    <span>Elev {Math.round(sampleElevationASL(selDetail.x, selDetail.z))} m ASL</span>
                    <span>·</span>
                    <span>{selDetail.floors} Floors</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[#cfd7de]">{selDetail.referenceNote}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[#a6b5c2]">
                    <span>{selDetail.verifiedRealName ? 'Verified Real Name' : 'Plausible Local Reconstruction'}</span>
                    <span>·</span>
                    <span>{selDetail.enterable ? 'Enterable Interior' : 'Exterior'}</span>
                    {selDetail.hasElevator && (
                      <>
                        <span>·</span>
                        <span>Working Elevator & Rooftop</span>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      let destX = selDetail.x;
                      let destZ = selDetail.z + selDetail.depth * 0.5 + 4;
                      let destYaw: number | undefined = undefined;
                      if (selDetail.isOpenPlaza) {
                        destX = NEW_MARKET_GATE_POS.x - 14;
                        destZ = NEW_MARKET_GATE_POS.z;
                        destYaw = Math.PI * 0.5;
                      } else if (selDetail.id === AMEEN_CENTER_SPEC.id) {
                        const front = ameenLocalToWorld(0, 14);
                        destX = front.x;
                        destZ = front.z;
                        destYaw = -2.38;
                      }
                      onFastTravel(destX, destZ, selDetail.name, destYaw);
                      onClose();
                    }}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
                  >
                    {selDetail.id === AMEEN_CENTER_SPEC.id ? (
                      <>
                        <Home className="h-4 w-4" />
                        Go Home · আমিন সেন্টারে যান
                      </>
                    ) : (
                      <>
                        <Navigation className="h-4 w-4" />
                        Walk / Travel to Landmark
                      </>
                    )}
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto rounded-lg border border-white/10 bg-[#141e28] p-3">
                <div className="mb-2 text-xs font-semibold text-[#9eb0bf]">
                  Enterable Landmarks & Mosques ({VERIFIED_LANDMARKS.length})
                </div>
                <div className="flex flex-col gap-1.5">
                  {[...VERIFIED_LANDMARKS]
                    .sort((a, b) => (a.id === AMEEN_CENTER_SPEC.id ? -1 : b.id === AMEEN_CENTER_SPEC.id ? 1 : 0))
                    .map((lm) => {
                      const isHome = lm.id === AMEEN_CENTER_SPEC.id;
                      return (
                        <button
                          key={lm.id}
                          type="button"
                          onClick={() => setSelectedLandmark(lm)}
                          className={`flex items-center justify-between rounded-md px-3 py-2 text-left text-xs transition-colors ${
                            selectedLandmark?.id === lm.id
                              ? 'bg-amber-400/20 text-amber-200'
                              : isHome
                                ? 'border border-sky-400/35 bg-sky-500/15 text-sky-100 hover:bg-sky-500/25'
                                : 'bg-white/5 text-[#d4dde5] hover:bg-white/10'
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-1.5 truncate font-medium">
                            {isHome && <Home className="h-3.5 w-3.5 shrink-0 text-amber-300" />}
                            <span className="truncate">{lm.name}</span>
                          </span>
                          <span
                            className={`ml-2 shrink-0 text-[11px] ${
                              isHome ? 'font-bold text-amber-300' : 'text-[#8ea0b0]'
                            }`}
                          >
                            {isHome ? 'Home · বাসা' : lm.isMosque ? 'Mosque' : lm.hasElevator ? 'Elevator' : lm.category}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'survey' && (
          <div className="overflow-y-auto p-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-white/10 bg-[#16212c] p-4">
                <div className="text-xs text-[#9cb0c0]">Total Mapped Area</div>
                <div className="mt-1 font-mono-tabular text-2xl font-bold text-white">
                  {survey.mappedAreaSqKm} km²
                </div>
                <div className="mt-1 font-mono-tabular text-xs text-[#8fa1b0]">
                  {survey.mappedAreaSqM.toLocaleString()} m² (Ward 14: ~{survey.ward14OfficialSqKm} km²)
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#16212c] p-4">
                <div className="text-xs text-[#9cb0c0]">Geographic Extent</div>
                <div className="mt-1 font-mono-tabular text-2xl font-bold text-white">
                  {survey.ewExtentM} × {survey.nsExtentM} m
                </div>
                <div className="mt-1 text-xs text-[#8fa1b0]">East–West × North–South (1:1 UTM)</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#16212c] p-4">
                <div className="text-xs text-[#9cb0c0]">Road Network & Junctions</div>
                <div className="mt-1 font-mono-tabular text-2xl font-bold text-white">
                  {survey.totalRoadLengthKm} km
                </div>
                <div className="mt-1 font-mono-tabular text-xs text-[#8fa1b0]">
                  {survey.totalRoadLengthM.toLocaleString()} m · {survey.mappedIntersections} intersections
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#16212c] p-4">
                <div className="text-xs text-[#9cb0c0]">Buildings & Hill Elevation</div>
                <div className="mt-1 font-mono-tabular text-2xl font-bold text-white">
                  {survey.mappedBuildings.toLocaleString()}
                </div>
                <div className="mt-1 font-mono-tabular text-xs text-[#8fa1b0]">
                  SRTM 30m DEM: {survey.elevationMinM} m – {survey.elevationMaxM} m ASL
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-lg border border-white/10 bg-[#141e28] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
                <Compass className="h-4 w-4" />
                Verification & Uncertainty Notes
              </div>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs text-[#c8d2dc]">
                {survey.uncertainNotes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-[#93a4b3]">
                Verified sources accessed during build: OpenStreetMap CGImap API (`api.openstreetmap.org`, 239 highway ways, 4,190 building polygons, POIs) and NASA SRTM 30m DEM (`api.opentopodata.org`, 625 elevation grid points). Google Maps / Google Earth interactive web views were not scraped to respect imagery licensing; web search references confirmed Ispahani Circle, Motijharna, Batali Hill, Akhtaruzzaman Flyover, and Patenga Elevated Expressway connectivity.
              </p>
            </div>
          </div>
        )}

        {tab === 'expansion' && (
          <div className="overflow-y-auto p-6">
            <div className="mb-4 flex items-center gap-2 text-sm text-[#cbd5df]">
              <Layers className="h-4 w-4 text-amber-300" />
              <span>
                Modular Chunk Architecture: Version 1 delivers full 1:1 playable Lalkhan Bazar (2.22 km²). Adjacent Chattogram zones below are georeferenced in UTM Zone 46N ready to stream as connected map chunks.
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FUTURE_EXPANSION_CHUNKS.map((chunk) => (
                <div key={chunk.id} className="rounded-lg border border-white/10 bg-[#16212c] p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-base font-semibold text-white">{chunk.name}</span>
                    <span className="font-mono-tabular text-xs text-amber-300">{chunk.distanceKm} km</span>
                  </div>
                  <div className="text-xs text-[#9fb0be]">{chunk.bengaliName}</div>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-[#c5d0da]">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    <span>{chunk.bearingNote}</span>
                  </div>
                  <div className="mt-2 font-mono-tabular text-[11px] text-[#8394a4]">
                    {chunk.lat.toFixed(4)}° N, {chunk.lon.toFixed(4)}° E ·{' '}
                    {chunk.status === 'context-visible' ? 'Border Context Rendered' : 'Expansion Slot'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
