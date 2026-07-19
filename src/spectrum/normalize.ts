import { xRescale, xyEquallySpaced, xySortX } from 'ml-spectra-processing';

import { PPM_FROM, PPM_POINTS, PPM_TO, ppmAxis } from './grid.ts';
import { displayIntegral } from './integral.ts';

export interface XY {
  x: Float64Array | number[];
  y: Float64Array | number[];
}

export interface NormalizedSpectrum {
  /** Resampled onto the canonical ascending grid, intensities rescaled to 0..1. */
  spectrum: { x: Float64Array; y: Float64Array };
  /** Cumulative integral of the normalized spectrum, also rescaled to 0..1. */
  integral: { x: Float64Array; y: Float64Array };
  /** The parsed spectrum before resampling, kept for the raw/normalized toggle. */
  original: { x: Float64Array; y: Float64Array };
}

/**
 * Normalizes a raw 1H spectrum onto the fixed grid the SECS model expects.
 *
 * Every submitted spectrum must go through this single function. The backend derives
 * the job id from the bytes of `spectrum.y`, so any divergence between two ingestion
 * paths (JCAMP vs Bruker, say) silently produces two different jobs for one sample.
 * The prototype had exactly that bug: its Bruker branch skipped the rescale, so Bruker
 * spectra were submitted with un-normalized amplitudes.
 * @param data - Raw x/y as parsed from JCAMP-DX, Bruker, JEOL or Varian.
 * @returns The gridded spectrum, its rescaled cumulative integral, and the original.
 */
export function normalizeSpectrum(data: XY): NormalizedSpectrum {
  if (data.x.length !== data.y.length) {
    throw new Error(
      `Spectrum x and y must have the same length, got ${data.x.length} and ${data.y.length}`,
    );
  }
  if (data.x.length < 2) {
    throw new Error('Spectrum must contain at least two points');
  }

  const growing = xySortX(data);
  const resampled = xyEquallySpaced(growing, {
    from: PPM_FROM,
    to: PPM_TO,
    numberOfPoints: PPM_POINTS,
  });

  const spectrum = {
    x: ppmAxis(),
    y: Float64Array.from(xRescale(resampled.y)),
  };

  return {
    spectrum,
    integral: displayIntegral(spectrum),
    original: {
      x: Float64Array.from(growing.x),
      y: Float64Array.from(growing.y),
    },
  };
}
