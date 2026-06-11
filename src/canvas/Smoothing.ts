import { Point } from '../types';

/**
 * Rolling weighted average smoothing on raw pointer points.
 * amount: 0–100 (0 = none, 100 = maximum smoothing).
 * Uses a sliding window of (1 + floor(amount / 20)) points.
 */
export function smoothPoints(points: Point[], amount: number): Point[] {
  if (amount <= 0 || points.length < 3) return points;
  const windowSize = Math.max(2, Math.min(10, 1 + Math.floor(amount / 20)));
  const result: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const end = i + 1;
    let wx = 0, wy = 0, wp = 0, wt = 0;
    let totalWeight = 0;
    for (let j = start; j < end; j++) {
      const w = 1 + (j - start);
      wx += points[j].x * w;
      wy += points[j].y * w;
      wp += points[j].pressure * w;
      wt += points[j].t * w;
      totalWeight += w;
    }
    result.push({
      x: wx / totalWeight,
      y: wy / totalWeight,
      pressure: wp / totalWeight,
      t: wt / totalWeight,
    });
  }
  return result;
}

/**
 * Catmull-Rom interpolation: inserts `segments` intermediate points
 * between each consecutive pair of control points.
 * Returns a smoother curve suitable for rendering.
 */
export function catmullRomInterpolate(
  points: Point[],
  segmentsPerPair: number = 4
): Point[] {
  if (points.length < 3) return points;
  const result: Point[] = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 1; s <= segmentsPerPair; s++) {
      const t = s / (segmentsPerPair + 1);
      const t2 = t * t;
      const t3 = t2 * t;
      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const y =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      const pressure = p1.pressure + (p2.pressure - p1.pressure) * t;
      const tstamp = p1.t + (p2.t - p1.t) * t;
      result.push({ x, y, pressure, t: tstamp });
    }
    result.push(p2);
  }
  return result;
}
