import { canonicalMf } from '../chemistry/formula.ts';
import type { NormalizedSpectrum } from '../spectrum/normalize.ts';
import type {
  ExpectedStructure,
  SpectrumMeta,
} from '../spectrum/parseFiles.ts';
import type { Preferences } from '../state/preferences.ts';
import {
  findRun,
  findRunBySpectrum,
  saveRun,
  updateRun,
} from '../state/runs.ts';
import type { StoredRun } from '../state/runsDb.ts';

import { ApiError, getJobResult, submitJob } from './client.ts';
import { computeJobId } from './jobId.ts';
import type { SubmitRequest } from './types.ts';

export interface SubmitOutcome {
  jobId: string;
  /**
   * `queued` when the server accepted new work, `cached` when it returned a prior run,
   * `existing` when this spectrum was already run from this browser and nothing was
   * sent, `mismatch` when the server returned a run computed for another formula.
   */
  kind: 'queued' | 'cached' | 'existing' | 'mismatch';
  /**
   * Set when `kind` is `mismatch`: the server returned a cached job computed for a
   * different formula, and it cannot recompute the same spectrum.
   */
  mismatch?: { storedMf: string; requestedMf: string };
}

export interface SubmitOptions {
  spectrum: NormalizedSpectrum;
  mf: string;
  expected: ExpectedStructure | null;
  meta: SpectrumMeta | null;
  preferences: Preferences;
  /**
   * Send the spectrum even when this browser already has a run for it.
   * @default false
   */
  force?: boolean;
}

/**
 * Submits a spectrum and records the whole exchange locally.
 *
 * The backend identifies a job by `sha256(spectrum.y)` alone — the formula, the model
 * and the search parameters are excluded from that hash. Resubmitting the same spectrum
 * with a different formula therefore returns the earlier run's candidates, computed for
 * the earlier formula, labelled only as `cached`. There is no cache-busting parameter,
 * so this function compares against what was stored for that job id and reports a
 * mismatch rather than letting the caller display misattributed results.
 * @param options - Spectrum, formula, known structure, file metadata and preferences.
 * @returns What the server did, and the details of any mismatch.
 */
export async function submitSpectrum(
  options: SubmitOptions,
): Promise<SubmitOutcome> {
  const { spectrum, mf, expected, meta, preferences, force = false } = options;
  const canonical = canonicalMf(mf);
  if (canonical === '') {
    throw new Error(`"${mf}" is not a valid molecular formula.`);
  }

  // Reuse a run this browser already has rather than sending the spectrum again.
  // The server's own cache check does not fire in this deployment, so resubmitting
  // starts a second half-hour job AND overwrites the id-to-task mapping, which makes
  // the finished result unreachable through the API until the new job completes.
  const spectrumHash = await computeJobId(spectrum.spectrum.y);
  if (!force) {
    const existing = findRunBySpectrum(spectrumHash);
    if (
      existing !== undefined &&
      canonicalMf(existing.request.mf) === canonical
    ) {
      return { jobId: existing.jobId, kind: 'existing' };
    }
  }

  const request: SubmitRequest = {
    mf: canonical,
    spectrum: {
      x: Array.from(spectrum.spectrum.x),
      y: Array.from(spectrum.spectrum.y),
    },
    model: preferences.model,
    ...preferences.parameters,
  };

  const response = await submitJob(request, preferences.apiUrl);
  const jobId = response.job_id;
  const known = findRun(jobId);

  if (
    response.status === 'cached' &&
    known !== undefined &&
    canonicalMf(known.request.mf) !== canonical
  ) {
    return {
      jobId,
      kind: 'mismatch',
      mismatch: { storedMf: known.request.mf, requestedMf: canonical },
    };
  }

  const now = Date.now();
  const run: StoredRun = {
    jobId,
    spectrumHash,
    request,
    submitResponse: response,
    status: known?.status ?? null,
    resultPayload: known?.resultPayload ?? null,
    expected,
    meta,
    state: response.status === 'cached' ? 'success' : 'pending',
    submittedAt: known?.submittedAt ?? now,
    updatedAt: now,
    completedAt: known?.completedAt ?? null,
  };
  await saveRun(run);

  if (response.status === 'cached' && run.resultPayload === null) {
    await fetchCachedResult(jobId, preferences.apiUrl);
  }

  return { jobId, kind: response.status === 'cached' ? 'cached' : 'queued' };
}

async function fetchCachedResult(
  jobId: string,
  baseUrl: string,
): Promise<void> {
  try {
    const payload = await getJobResult(jobId, baseUrl);
    await updateRun(jobId, {
      resultPayload: payload,
      state: 'success',
      completedAt: Date.now(),
    });
  } catch (error) {
    // A 400 means it is still running despite the cached label; polling will catch up.
    if (!(error instanceof ApiError)) throw error;
    await updateRun(jobId, { state: 'running' });
  }
}
