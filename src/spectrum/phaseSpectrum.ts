import type { Spectrum1D } from '@zakodium/nmrium-core';
import { reimAutoPhaseCorrection, xMinMaxValues } from 'ml-spectra-processing';

import type { PhaseAngles } from './phaseSearch.ts';
import { bestAngles } from './phaseSearch.ts';

/**
 * Phases a spectrum that the loader Fourier-transformed from a FID.
 *
 * The load pipeline phases with the angles the spectrometer stored — Bruker `PHC0` and
 * `PHC1` in `procs` — which are whatever the operator last left there and can belong to
 * another experiment. The automatic correction of `nmr-processing` only searches small
 * first-order angles, so a residual group delay of several hundred degrees per sweep is
 * out of its reach and leaves whole multiplets pointing down. Its answer therefore
 * competes with a wide search of its own, and the magnitude spectrum is the last resort
 * when neither leaves the lines absorptive.
 * @param spectrum - A frequency-domain spectrum, phased in place.
 * @returns True when the magnitude spectrum had to be used.
 */
export async function phaseSpectrum(spectrum: Spectrum1D): Promise<boolean> {
  const { Filters1D } = await import('nmr-processing');
  // Filters1D is keyed by filter name, so the entry is typed as possibly absent.
  const { phaseCorrection } = Filters1D;
  if (!phaseCorrection?.isApplicable(spectrum)) {
    return false;
  }

  const { re, im } = spectrum.data;
  if (im === undefined) return false;

  phaseCorrection.apply(spectrum, bestAngles(re, im, automatic(re, im)));
  const { re: phased } = spectrum.data;
  if (!isDispersive(phased)) return false;

  phaseCorrection.apply(spectrum, { absolute: true });
  return true;
}

/**
 * Asks `nmr-processing` for its automatic angles, with the options its own filter uses.
 * @param re - Real part of the spectrum.
 * @param im - Imaginary part of the spectrum.
 * @returns The angles it proposes, kept as one candidate of the search.
 */
function automatic(re: Float64Array, im: Float64Array): PhaseAngles {
  const { ph0, ph1 } = reimAutoPhaseCorrection(
    { re, im },
    {
      minRegSize: 5,
      maxDistanceToJoin: 128,
      magnitudeMode: false,
      factorNoise: 5,
      reverse: true,
    },
  );
  return { ph0, ph1 };
}

/**
 * Tells a phased spectrum from one the phase search gave up on.
 *
 * A phased proton spectrum dips barely below zero — a few thousandths of the tallest
 * peak. A dispersive line shape puts a trough next to every peak that is a sizeable
 * fraction of it, and rescaling such a spectrum onto the submission grid crushes the
 * real signal into the top of the range.
 * @param real - The real part of the spectrum.
 * @returns True when the negative excursion is too large to be noise.
 */
function isDispersive(real: Float64Array): boolean {
  const { min, max } = xMinMaxValues(real);
  return max > 0 && -min > 0.2 * max;
}
