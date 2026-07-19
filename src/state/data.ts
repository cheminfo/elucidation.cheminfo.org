import { computed, signal } from '@preact/signals-react';

import type { RankedCandidates } from '../chemistry/candidates.ts';
import { rankCandidates } from '../chemistry/candidates.ts';
import type { NormalizedSpectrum } from '../spectrum/normalize.ts';
import type {
  ExpectedStructure,
  SpectrumMeta,
} from '../spectrum/parseFiles.ts';

import { findRun, runCandidates, runs } from './runs.ts';

/** The spectrum currently loaded, from a dropped file or a demo challenge. */
export const currentSpectrum = signal<NormalizedSpectrum | null>(null);
export const spectrumMeta = signal<SpectrumMeta | null>(null);

/** The formula, editable so a spectrum can be run without a reference structure. */
export const mfInput = signal<string>('');

/** The known answer, when a molfile was dropped or a demo challenge was opened. */
export const expectedStructure = signal<ExpectedStructure | null>(null);

/** Messages from the last file parse. */
export const parseWarnings = signal<string[]>([]);
export const parseErrors = signal<string[]>([]);

/** The run whose results are being displayed, if any. */
export const activeJobId = signal<string | null>(null);

/** Candidates from a demo challenge, which need no API call. */
export const challengeCandidates = signal<RankedCandidates | null>(null);

/** Substructure query drawn in the editor, as an OCL id code. */
export const substructureQuery = signal<string>('');

/**
 * Candidates to display: either the opened demo challenge, or the active run's stored
 * result ranked against the formula and structure that were submitted with it.
 */
export const rankedCandidates = computed<RankedCandidates | null>(() => {
  const challenge = challengeCandidates.value;
  if (challenge !== null) return challenge;

  const jobId = activeJobId.value;
  if (jobId === null) return null;
  // Touch the runs signal so results arriving later re-run this computation.
  void runs.value;
  const run = findRun(jobId);
  if (run?.resultPayload == null) return null;
  return rankCandidates(
    runCandidates(run),
    run.request.mf,
    run.expected?.noStereoIDCode,
  );
});

/** Clears everything derived from a loaded spectrum. */
export function resetAnalysis(): void {
  currentSpectrum.value = null;
  spectrumMeta.value = null;
  mfInput.value = '';
  expectedStructure.value = null;
  parseWarnings.value = [];
  parseErrors.value = [];
  activeJobId.value = null;
  challengeCandidates.value = null;
  substructureQuery.value = '';
}
