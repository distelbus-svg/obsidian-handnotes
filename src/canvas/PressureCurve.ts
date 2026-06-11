import { PressureCurveConfig } from '../types';

/**
 * Monotone cubic spline interpolation (Fritsch–Carlson).
 * Returns a function that maps input t ∈ [0,1] → output pressure.
 * Guarantees no overshoot.
 */
export function monotoneCubicSpline(
  controlPoints: { x: number; y: number }[]
): (t: number) => number {
  const n = controlPoints.length;
  if (n < 2) return (t: number) => t;

  const xs = controlPoints.map(p => p.x);
  const ys = controlPoints.map(p => p.y);

  const dx: number[] = [];
  const dy: number[] = [];
  const slopes: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    dx[i] = xs[i + 1] - xs[i];
    dy[i] = ys[i + 1] - ys[i];
    if (dx[i] === 0) {
      slopes[i] = 0;
    } else {
      slopes[i] = dy[i] / dx[i];
    }
  }

  const tangents: number[] = new Array(n);
  if (n === 2) {
    tangents[0] = slopes[0];
    tangents[1] = slopes[0];
  } else {
    tangents[0] = slopes[0];
    tangents[n - 1] = slopes[n - 2];
    for (let i = 1; i < n - 1; i++) {
      if (slopes[i - 1] * slopes[i] <= 0) {
        tangents[i] = 0;
      } else {
        tangents[i] =
          (dx[i - 1] + dx[i]) /
          (dx[i - 1] / slopes[i - 1] + dx[i] / slopes[i]);
      }
    }
  }

  for (let i = 0; i < n - 1; i++) {
    const a = tangents[i] / slopes[i];
    const b = tangents[i + 1] / slopes[i];
    if (a * a + b * b > 9) {
      const t = 3 / Math.sqrt(a * a + b * b);
      tangents[i] = t * a * slopes[i];
      tangents[i + 1] = t * b * slopes[i];
    }
  }

  return function (t: number): number {
    if (t <= xs[0]) return ys[0];
    if (t >= xs[n - 1]) return ys[n - 1];

    let i = 0;
    for (let j = 0; j < n - 1; j++) {
      if (t >= xs[j] && t < xs[j + 1]) {
        i = j;
        break;
      }
    }

    const h = dx[i];
    if (h === 0) return ys[i];
    const s = (t - xs[i]) / h;
    const s2 = s * s;
    const s3 = s2 * s;

    const h00 = 2 * s3 - 3 * s2 + 1;
    const h10 = s3 - 2 * s2 + s;
    const h01 = -2 * s3 + 3 * s2;
    const h11 = s3 - s2;

    return (
      h00 * ys[i] +
      h10 * tangents[i] * h +
      h01 * ys[i + 1] +
      h11 * tangents[i + 1] * h
    );
  };
}

/**
 * Apply pressure curve to a raw pressure value.
 * Falls back to identity (linear) if curve is invalid.
 */
export function applyPressureCurve(
  rawPressure: number,
  curve: PressureCurveConfig
): number {
  if (!curve || !curve.points || curve.points.length < 2) {
    return Math.max(0, Math.min(1, rawPressure));
  }
  try {
    const interpolator = monotoneCubicSpline(curve.points);
    const result = interpolator(Math.max(0, Math.min(1, rawPressure)));
    if (curve.clamp) {
      return Math.max(0, Math.min(1, result));
    }
    return result;
  } catch {
    return Math.max(0, Math.min(1, rawPressure));
  }
}
