import { effect } from '@preact/signals-react';

import { ppmAxis } from '../spectrum/grid.ts';
import { displayIntegral } from '../spectrum/integral.ts';

import {
  activeJobId,
  challengeCandidates,
  currentSpectrum,
  expectedStructure,
  mfInput,
  spectrumMeta,
} from './data.ts';
import { findRun, runsLoaded } from './runs.ts';
import { route } from './view.ts';

let started = false;

/**
 * Restores a stored run whenever the elucidate page is opened with a job id.
 *
 * This is what makes an old run readable without resubmitting it: the spectrum, the
 * formula and the reference structure all come back from IndexedDB rather than from the
 * server, which has usually forgotten the job by then. It lives in the state layer and
 * reacts to signals, so a deep link works on a cold load — the route can be read long
 * before the history has finished loading, and this runs again once it has.
 */
export function startRunRestore(): void {
  if (started) return;
  started = true;

  effect(() => {
    const current = route.value;
    const loaded = runsLoaded.value;
    if (current.page !== 'elucidate' || current.id === null || !loaded) return;

    const run = findRun(current.id);
    if (run === undefined) return;

    challengeCandidates.value = null;
    activeJobId.value = current.id;
    mfInput.value = run.request.mf;
    expectedStructure.value = run.expected;
    spectrumMeta.value = run.meta;

    const y = run.request.spectrum.y;
    if (y.length === 0) {
      // Runs migrated from the visualizer prototype carry no spectrum.
      currentSpectrum.value = null;
      return;
    }
    const values = Float64Array.from(y);
    const spectrum = { x: ppmAxis(), y: values };
    currentSpectrum.value = {
      spectrum,
      integral: displayIntegral(spectrum),
      original: { x: ppmAxis(), y: values },
    };
  });
}
