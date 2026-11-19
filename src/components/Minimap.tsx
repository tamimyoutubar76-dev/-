import { useEffect, useRef } from 'react';
import { GIS_DATA, LALKHAN_LOCALITY_BOUNDARY } from '../gis/projection';
import { VERIFIED_BUS_STOPS, VERIFIED_LANDMARKS } from '../gis/landmarks';
import { FLYOVER_SEGMENTS } from '../sim/terrain';
import { NEW_MARKET_CONNECTOR_ROADS } from '../sim/newMarketAndShops';
import { AMEEN_CENTER_SPEC } from '../sim/ameenCenter';
import { drawMapHouseIcon } from './mapIcons';

interface MinimapProps {
  playerX: number;
  playerZ: number;
  playerYaw: number;
  onOpenFullMap: () => void;
}

export function Minimap({ playerX, playerZ, playerYaw, onOpenFullMap }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 148;
    const viewRadiusM = 175; // 175m radius => 350m real-world window at 1:1 scale
    const scale = (size * 0.5) / viewRadiusM;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#0e161d';
    ctx.fillRect(0, 0, size, size);

    const toPx = (wx: number, wz: number): [number, number] => [
      size * 0.5 + (wx - playerX) * scale,
      size * 0.5 + (wz - playerZ) * scale,
    ];

    // 1. Subtle hill contour zone shading (West hills vs East valley)
    const [hillEdgeX] = toPx(160, playerZ);
    if (hillEdgeX > 0) {
      ctx.fillStyle = 'rgba(42, 74, 48, 0.35)';
      ctx.fillRect(0, 0, Math.min(size, hillEdgeX), size);
    }

    // 2. Ward 14 Lalkhan Bazar approximate boundary
    ctx.strokeStyle = 'rgba(232, 185, 72, 0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    LALKHAN_LOCALITY_BOUNDARY.forEach(([bx, bz], idx) => {
      const [px, pz] = toPx(bx, bz);
      if (idx === 0) ctx.moveTo(px, pz);
      else ctx.lineTo(px, pz);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Nearby Buildings (simple metric footprints)
    ctx.fillStyle = 'rgba(130, 148, 165, 0.48)';
    for (const b of GIS_DATA.buildings) {
      if (Math.abs(b.cx - playerX) > viewRadiusM + 35 || Math.abs(b.cz - playerZ) > viewRadiusM + 35) continue;
      ctx.beginPath();
      b.poly.forEach(([vx, vz], idx) => {
        const [px, pz] = toPx(vx, vz);
        if (idx === 0) ctx.moveTo(px, pz);
        else ctx.lineTo(px, pz);
      });
      ctx.closePath();
      ctx.fill();
    }

    // 4. Ground OSM Roads + New Market Connector Roads
    for (const r of [...GIS_DATA.roads, ...NEW_MARKET_CONNECTOR_ROADS]) {
      if (r.bridge) continue;
      ctx.strokeStyle =
        r.hw === 'trunk' || r.hw === 'primary'
          ? '#d6cec0'
          : r.hw === 'secondary' || r.hw === 'tertiary'
            ? '#9aa5b0'
            : '#5c6a76';
      ctx.lineWidth = r.hw === 'trunk' || r.hw === 'primary' ? 2.6 : r.hw === 'secondary' ? 1.8 : 1.0;
      ctx.beginPath();
      r.pts.forEach(([rx, rz], idx) => {
        const [px, pz] = toPx(rx, rz);
        if (idx === 0) ctx.moveTo(px, pz);
        else ctx.lineTo(px, pz);
      });
      ctx.stroke();
    }

    // 4b. New Market Courtyard outline when in range
    const [nmX1, nmZ1] = toPx(840, 446);
    const [nmX2, nmZ2] = toPx(954, 632);
    if (nmX2 > 0 && nmX1 < size && nmZ2 > 0 && nmZ1 < size) {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.16)';
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.65)';
      ctx.lineWidth = 1;
      ctx.fillRect(nmX1, nmZ1, nmX2 - nmX1, nmZ2 - nmZ1);
      ctx.strokeRect(nmX1, nmZ1, nmX2 - nmX1, nmZ2 - nmZ1);
    }

    // 5. Elevated Flyover Deck
    ctx.strokeStyle = '#e5a93c';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    for (const s of FLYOVER_SEGMENTS) {
      const [x1, z1] = toPx(s.x1, s.z1);
      const [x2, z2] = toPx(s.x2, s.z2);
      ctx.moveTo(x1, z1);
      ctx.lineTo(x2, z2);
    }
    ctx.stroke();

    // 6. Bus Stops (Blue) & Landmarks / Mosques (Emerald / Amber)
    for (const bs of VERIFIED_BUS_STOPS) {
      const [px, pz] = toPx(bs.x, bs.z);
      if (px < -6 || px > size + 6 || pz < -6 || pz > size + 6) continue;
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(px - 2.5, pz - 2.5, 5, 5);
    }
    for (const lm of VERIFIED_LANDMARKS) {
      if (lm.id === AMEEN_CENTER_SPEC.id) continue;
      const [px, pz] = toPx(lm.x, lm.z);
      if (px < -8 || px > size + 8 || pz < -8 || pz > size + 8) continue;
      ctx.fillStyle = lm.isMosque ? '#10b981' : '#f59e0b';
      ctx.beginPath();
      ctx.arc(px, pz, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6b. Home (Ameen Center) House Icon — always clearly visible inside minimap or pinned at edge toward Home
    const [hx, hz] = toPx(AMEEN_CENTER_SPEC.x, AMEEN_CENTER_SPEC.z);
    const padHome = 12;
    const inView = hx >= padHome && hx <= size - padHome && hz >= padHome && hz <= size - padHome;
    if (inView) {
      drawMapHouseIcon(ctx, hx, hz, 13, false);
    } else {
      const dx = hx - size * 0.5;
      const dz = hz - size * 0.5;
      const maxComp = Math.max(Math.abs(dx), Math.abs(dz), 1);
      const clampScale = (size * 0.5 - padHome) / maxComp;
      const edgeX = size * 0.5 + dx * clampScale;
      const edgeZ = size * 0.5 + dz * clampScale;
      drawMapHouseIcon(ctx, edgeX, edgeZ, 11, true);
    }

    // 7. Player Directional Arrow at Center
    ctx.save();
    ctx.translate(size * 0.5, size * 0.5);
    // In metric coords +X is right, +Z is down, yaw=0 faces +Z (South), yaw=PI faces -Z (North)
    ctx.rotate(-playerYaw + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -6.5);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }, [playerX, playerZ, playerYaw]);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.currentTarget.blur();
        onOpenFullMap();
      }}
      title="Open Full Lalkhan Bazar GIS Map [M]"
      aria-label="Open full interactive Lalkhan Bazar map"
      className="group relative block h-[108px] w-[108px] overflow-hidden rounded-lg border border-[#d6cfc2]/25 bg-[#0e161d] shadow-lg focus-visible:outline-2 focus-visible:outline-amber-400 sm:h-[148px] sm:w-[148px]"
    >
      <canvas ref={canvasRef} width={148} height={148} className="block h-full w-full" />
      <span className="pointer-events-none absolute top-1 left-1 bg-[#0e161d]/85 px-1 py-0.5 font-mono-tabular text-[9px] font-semibold tracking-wider text-amber-300 sm:top-1.5 sm:left-1.5 sm:px-1.5 sm:text-[10px]">
        N ↑
      </span>
      <span className="pointer-events-none absolute right-1 bottom-1 bg-[#0e161d]/85 px-1 py-0.5 font-mono-tabular text-[9px] text-[#e7e2d8] sm:right-1.5 sm:bottom-1.5 sm:px-1.5 sm:text-[10px]">
        Map [M]
      </span>
    </button>
  );
}
