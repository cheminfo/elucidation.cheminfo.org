/**
 * The fixed ppm grid the SECS model is trained on.
 *
 * This is part of the API contract, not a display preference: the backend derives a
 * job's identity from `sha256(spectrum.y)`, so changing any of these three constants
 * changes every job_id and permanently invalidates every cached result. Never touch them.
 */
export const PPM_FROM = -2;
export const PPM_TO = 10;
export const PPM_POINTS = 10_000;

let cachedAxis: Float64Array | null = null;

/**
 * The canonical ascending ppm axis, computed once and shared.
 * It is identical for every spectrum, so it is never stored or transferred.
 * @returns The shared axis. Treat it as read-only.
 */
export function ppmAxis(): Float64Array {
  if (cachedAxis === null) {
    const axis = new Float64Array(PPM_POINTS);
    const span = PPM_TO - PPM_FROM;
    const last = PPM_POINTS - 1;
    for (let i = 0; i < PPM_POINTS; i++) {
      // Interpolate rather than accumulate a step, so both endpoints land exactly.
      axis[i] = PPM_FROM + (span * i) / last;
    }
    cachedAxis = axis;
  }
  return cachedAxis;
}
