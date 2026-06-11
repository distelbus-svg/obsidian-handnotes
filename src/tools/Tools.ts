import { Point, Stroke, ToolType } from '../types';
import { smoothPoints } from '../canvas/Smoothing';

export function getStrokeWidth(
  tool: ToolType,
  baseWidth: number,
  pressure: number,
  pressureEnabled: boolean
): number {
  if (!pressureEnabled) return baseWidth;
  switch (tool) {
    case 'fountain':
      return baseWidth * (0.3 + 0.7 * pressure);
    case 'ballpoint':
      return baseWidth * (0.6 + 0.4 * pressure);
    case 'pencil':
      return baseWidth * (0.4 + 0.6 * pressure);
    case 'marker':
      return baseWidth;
    case 'eraser':
      return baseWidth * (0.5 + 0.5 * pressure);
    default:
      return baseWidth;
  }
}

export function getStrokeOpacity(
  tool: ToolType,
  baseOpacity: number
): number {
  switch (tool) {
    case 'marker':
      return Math.min(baseOpacity, 0.5);
    default:
      return baseOpacity;
  }
}

/**
 * Build the rendered point path from raw input.
 * smoothingWindow: 1 = no smoothing, 2 = 2-point avg, 3 = 3-point avg.
 * Used by both live preview and commit — guaranteed identical output.
 * Deterministic: same input → same output always.
 */
export function buildStrokePath(
  rawPoints: ReadonlyArray<Point>,
  smoothingWindow: number
): Point[] {
  if (smoothingWindow <= 1 || rawPoints.length < 3) {
    return rawPoints.slice();
  }
  return smoothPoints(rawPoints as Point[], (smoothingWindow - 1) * 20);
}

/**
 * Single stroke renderer — the ONLY function that draws strokes.
 * Deterministic: no randomness, no time-dependence, no frame-varying state.
 * Same input → identical pixels every time.
 */
export function renderStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  pressureEnabled: boolean,
  noisePattern?: HTMLCanvasElement | null
): void {
  const pts = stroke.points;
  if (pts.length < 2) {
    if (pts.length === 1) {
      renderDot(ctx, stroke, pts[0], pressureEnabled, noisePattern);
    }
    return;
  }

  ctx.save();
  const opacity = getStrokeOpacity(stroke.tool, stroke.opacity);
  ctx.globalAlpha = opacity;

  const isPencil = stroke.tool === 'pencil' && noisePattern;
  if (isPencil) {
    const pattern = ctx.createPattern(noisePattern!, 'repeat');
    if (pattern) {
      ctx.strokeStyle = pattern;
      ctx.fillStyle = pattern;
    } else {
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
    }
    ctx.globalCompositeOperation = 'multiply';
  } else {
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const w0 = getStrokeWidth(stroke.tool, stroke.width, p0.pressure, pressureEnabled);
    const w1 = getStrokeWidth(stroke.tool, stroke.width, p1.pressure, pressureEnabled);

    if (isPencil || Math.abs(w0 - w1) < 0.1) {
      ctx.lineWidth = w0;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    } else {
      renderTaperedSegment(ctx, p0, p1, w0, w1, stroke.color, opacity);
    }
  }

  if (isPencil) {
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.restore();
}

function renderDot(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  pt: Point,
  pressureEnabled: boolean,
  noisePattern?: HTMLCanvasElement | null
): void {
  const w = getStrokeWidth(stroke.tool, stroke.width, pt.pressure, pressureEnabled);
  ctx.save();
  ctx.globalAlpha = getStrokeOpacity(stroke.tool, stroke.opacity);
  const isPencil = stroke.tool === 'pencil' && noisePattern;
  if (isPencil) {
    const pattern = ctx.createPattern(noisePattern!, 'repeat');
    ctx.fillStyle = pattern || stroke.color;
    ctx.globalCompositeOperation = 'multiply';
  } else {
    ctx.fillStyle = stroke.color;
  }
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, w / 2, 0, Math.PI * 2);
  ctx.fill();
  if (isPencil) ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

function renderTaperedSegment(
  ctx: CanvasRenderingContext2D,
  p0: Point,
  p1: Point,
  w0: number,
  w1: number,
  color: string,
  opacity: number
): void {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.5) {
    ctx.lineWidth = (w0 + w1) / 2;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
    return;
  }
  const nx = -dy / len;
  const ny = dx / len;
  const hw0 = w0 / 2;
  const hw1 = w1 / 2;

  ctx.fillStyle = color;
  ctx.globalAlpha = opacity;
  ctx.beginPath();
  ctx.moveTo(p0.x + nx * hw0, p0.y + ny * hw0);
  ctx.lineTo(p1.x + nx * hw1, p1.y + ny * hw1);
  ctx.lineTo(p1.x - nx * hw1, p1.y - ny * hw1);
  ctx.lineTo(p0.x - nx * hw0, p0.y - ny * hw0);
  ctx.closePath();
  ctx.fill();
}
