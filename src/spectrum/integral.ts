import { xRescale, xyIntegral } from 'ml-spectra-processing';

/**
 * Computes the display integral of a spectrum already resampled onto the ppm grid.
 *
 * Kept separate from `normalizeSpectrum` because a recalled run or a stored challenge
 * only persists the gridded `y`; the integral is derived, so it has to be rebuilt on
 * load instead of being carried around.
 * @param spectrum - A spectrum on the canonical ascending ppm grid.
 * @returns The cumulative integral, rescaled to 0..1 and flipped for NMR display order.
 */
export function displayIntegral(spectrum: {
  x: Float64Array;
  y: Float64Array;
}): { x: Float64Array; y: Float64Array } {
  const integral = xyIntegral(spectrum);
  const rescaled = xRescale(integral.y);

  // The integral accumulates along ascending ppm, but the axis is displayed flipped so
  // that shifts decrease left to right. Invert it so the trace rises left to right the
  // way an NMR integral is conventionally drawn, instead of falling from one to zero.
  const flipped = new Float64Array(rescaled.length);
  for (let i = 0; i < rescaled.length; i++) {
    flipped[i] = 1 - (rescaled[i] as number);
  }

  return { x: Float64Array.from(integral.x), y: flipped };
}
