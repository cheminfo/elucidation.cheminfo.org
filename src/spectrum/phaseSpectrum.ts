import type { Spectrum1D } from '@zakodium/nmrium-core';
import { xMinMaxValues } from 'ml-spectra-processing';

/**
 * Phases a spectrum that the loader Fourier-transformed from a FID.
 *
 * The load pipeline phases with the angles the spectrometer stored — Bruker `PHC0` and
 * `PHC1` in `procs` — which are whatever the operator last left there and can belong to
 * another experiment: on an ibuprofen FID they leave every line half dispersive.
 * `nmr-processing` carries the automatic phase correction, so it is run over the
 * pipeline's output to correct that, and the magnitude spectrum is the last resort when
 * even that leaves the lines dispersive.
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

  // No ph0/ph1 asks nmr-processing for its automatic correction.
  phaseCorrection.apply(spectrum, {});
  if (!isDispersive(spectrum.data.re)) return false;

  phaseCorrection.apply(spectrum, { absolute: true });
  return true;
}

/**
 * Tells a phased spectrum from one the automatic phase correction gave up on.
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
