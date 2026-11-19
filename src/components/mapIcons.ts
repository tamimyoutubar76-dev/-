/**
 * Draws a high-contrast vector house/home icon centered around (cx, cy) on a 2D map canvas
 * so Ameen Center (the player's permanent home) stands out immediately on both the minimap and full GIS map.
 */
export function drawMapHouseIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  selected = false
): void {
  const halfW = size * 0.52;
  const roofPeakY = cy - size * 0.56;
  const eaveY = cy - size * 0.04;
  const baseY = cy + size * 0.48;
  const bodyHalfW = size * 0.38;

  ctx.save();

  // Subtle selection or home glow ring
  if (selected) {
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.85, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(250, 204, 21, 0.25)';
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }

  // House body (Ameen Center royal blue)
  ctx.fillStyle = '#2563eb';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1.2, size * 0.11);
  ctx.beginPath();
  ctx.rect(cx - bodyHalfW, eaveY, bodyHalfW * 2, baseY - eaveY);
  ctx.fill();
  ctx.stroke();

  // Pitched roof (warm amber/gold)
  ctx.fillStyle = '#facc15';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1.1, size * 0.1);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, roofPeakY);
  ctx.lineTo(cx + halfW, eaveY + 1);
  ctx.lineTo(cx - halfW, eaveY + 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Front entrance door
  const doorW = Math.max(2.2, size * 0.24);
  const doorH = Math.max(3, (baseY - eaveY) * 0.58);
  ctx.fillStyle = '#fef3c7';
  ctx.fillRect(cx - doorW * 0.5, baseY - doorH, doorW, doorH);

  ctx.restore();
}
