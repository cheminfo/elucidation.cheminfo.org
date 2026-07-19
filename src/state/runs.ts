import { signal } from '@preact/signals-react';

import type { ApiCandidate } from '../api/types.ts';
import { extractCandidates } from '../api/types.ts';

import { readStoredArray } from './persist.ts';
import type { RunState, StoredRun } from './runsDb.ts';
import {
  clearRuns as clearRunsDb,
  deleteRun,
  listRuns,
  patchRun,
  putRun,
} from './runsDb.ts';

/** Legacy localStorage keys, imported once so earlier histories are not lost. */
const LEGACY_KEYS = ['elucidation:jobs:v1', 'nmrStructureElucidationJobs'];

/** Every stored run, newest first. Empty until {@link hydrateRuns} resolves. */
export const runs = signal<StoredRun[]>([]);

/** False until the initial read from IndexedDB has completed. */
export const runsLoaded = signal(false);

let hydrated: Promise<void> | null = null;

/**
 * Loads the run history from IndexedDB into the signal, migrating any legacy
 * localStorage history on the first run.
 * @returns A promise that resolves once the signal reflects storage.
 */
export async function hydrateRuns(): Promise<void> {
  hydrated ??= (async () => {
    const existing = await listRuns();
    if (existing.length === 0) {
      const migrated = await migrateLegacy();
      runs.value = migrated;
    } else {
      runs.value = existing;
    }
    runsLoaded.value = true;
  })();
  return hydrated;
}

/**
 * Stores a run and refreshes the signal.
 * @param run - The complete record.
 */
export async function saveRun(run: StoredRun): Promise<void> {
  await putRun(run);
  await refresh();
}

/**
 * Merges an update into a stored run.
 * @param jobId - The run to update.
 * @param patch - Fields to change.
 */
export async function updateRun(
  jobId: string,
  patch: Partial<StoredRun>,
): Promise<void> {
  await patchRun(jobId, patch);
  await refresh();
}

/**
 * Removes a run from local history. The server is not contacted.
 * @param jobId - The run to remove.
 */
export async function removeRun(jobId: string): Promise<void> {
  await deleteRun(jobId);
  await refresh();
}

/** Removes every stored run. */
export async function clearAllRuns(): Promise<void> {
  await clearRunsDb();
  await refresh();
}

/**
 * Looks up a run in the currently loaded list.
 * @param jobId - The job id.
 * @returns The run, or undefined when it is not in history.
 */
export function findRun(jobId: string): StoredRun | undefined {
  return runs.value.find((run) => run.jobId === jobId);
}

/**
 * Finds a run previously produced by the same spectrum.
 *
 * Falls back to the job id so runs stored before the hash was recorded, and runs
 * migrated from the prototype, are still recognised.
 * @param spectrumHash - The id derived locally from the spectrum.
 * @returns The matching run, or undefined.
 */
export function findRunBySpectrum(spectrumHash: string): StoredRun | undefined {
  return runs.value.find(
    (run) => run.spectrumHash === spectrumHash || run.jobId === spectrumHash,
  );
}

/**
 * The candidates of a run, normalized across the two payload shapes the API uses.
 * @param run - A stored run.
 * @returns The candidate list, empty when the run has no result yet.
 */
export function runCandidates(run: StoredRun): ApiCandidate[] {
  if (run.resultPayload === null) return [];
  return extractCandidates(run.resultPayload);
}

/**
 * Maps the server's status string onto a local state label.
 *
 * The API overwrites `status` with the worker's own stage description while a job runs,
 * so any unrecognised value means the job is still being worked on.
 * @param status - The `status` field from a status response.
 * @returns The corresponding local state.
 */
export function toRunState(status: string): RunState {
  const normalized = status.toLowerCase();
  if (normalized === 'success') return 'success';
  if (normalized === 'failure') return 'failure';
  if (normalized === 'revoked') return 'revoked';
  if (normalized === 'expired') return 'expired';
  if (normalized === 'pending') return 'pending';
  return 'running';
}

async function refresh(): Promise<void> {
  runs.value = await listRuns();
}

interface LegacyJob {
  job_id?: string;
  task_id?: string;
  mf?: string;
  model?: string;
  status?: string;
  submittedAt?: number;
  y?: number[];
  candidates?: ApiCandidate[];
  expectedIdCode?: string;
  expectedNoStereoIDCode?: string;
}

async function migrateLegacy(): Promise<StoredRun[]> {
  const legacy: LegacyJob[] = [];
  for (const key of LEGACY_KEYS) {
    legacy.push(...readStoredArray<LegacyJob>(key));
  }
  if (legacy.length === 0) return [];

  const seen = new Set<string>();
  const records: StoredRun[] = [];
  for (const job of legacy) {
    const jobId = job.job_id;
    if (typeof jobId !== 'string' || seen.has(jobId)) continue;
    seen.add(jobId);
    records.push(toStoredRun(jobId, job));
  }

  // The writes target distinct keys, so they are independent.
  await Promise.all(records.map((record) => putRun(record)));

  return listRuns();
}

function toStoredRun(jobId: string, job: LegacyJob): StoredRun {
  const submittedAt = job.submittedAt ?? 0;
  return {
    jobId,
    request: {
      mf: job.mf ?? '',
      // The visualizer prototype never stored the spectrum, so migrated runs cannot
      // be replotted. Everything else about them is still worth keeping.
      spectrum: { x: [], y: job.y ?? [] },
      model: job.model === 'regular' ? 'regular' : 'residual',
    },
    submitResponse: {
      job_id: jobId,
      task_id: job.task_id,
      status: 'submitted',
    },
    status: null,
    resultPayload:
      job.candidates === undefined ? null : { results: job.candidates },
    expected:
      job.expectedIdCode === undefined
        ? null
        : {
            idCode: job.expectedIdCode,
            noStereoIDCode: job.expectedNoStereoIDCode ?? job.expectedIdCode,
            smiles: '',
            molfile: '',
          },
    meta: null,
    state: toRunState(job.status ?? 'pending'),
    submittedAt,
    updatedAt: submittedAt,
    completedAt: job.candidates === undefined ? null : submittedAt,
  };
}
