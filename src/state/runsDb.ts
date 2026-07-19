import type { DBSchema, IDBPDatabase } from 'idb';
import { openDB } from 'idb';

import type {
  ApiCandidate,
  JobResult,
  JobStatusResponse,
  SubmitRequest,
  SubmitResponse,
} from '../api/types.ts';
import type {
  ExpectedStructure,
  SpectrumMeta,
} from '../spectrum/parseFiles.ts';

const DB_NAME = 'elucidation';
const DB_VERSION = 1;
const STORE = 'runs';

/**
 * A complete record of one elucidation run: exactly what was sent to the server and
 * exactly what came back.
 *
 * The server keeps a result for only an hour after completion and forgets the job
 * entirely after a day, and it identifies a run by its spectrum alone, so a run that is
 * not stored here cannot be recovered — resubmitting the same spectrum returns the old
 * job rather than recomputing it. This record is therefore the durable copy, and it
 * keeps the raw payloads rather than a digest so nothing is lost to interpretation.
 */
export interface StoredRun {
  jobId: string;
  /**
   * The job id derived locally from the spectrum. It equals `jobId` in practice, but
   * is stored separately so recognising an already-run spectrum never depends on the
   * server returning the id we expect.
   */
  spectrumHash?: string;
  /** The exact body POSTed to `/submit`, including the full 10 000-point spectrum. */
  request: SubmitRequest;
  /** The exact body returned by `/submit`. */
  submitResponse: SubmitResponse;
  /** The most recent `/jobs/{id}/status` payload, verbatim. */
  status: JobStatusResponse | null;
  /**
   * The exact `/jobs/{id}/result` payload. Either `{results, metadata}` when the run
   * finished, or a bare candidate array while the algorithm was still writing.
   */
  resultPayload: JobResult | ApiCandidate[] | null;
  /** The known structure, when a reference molfile was supplied. */
  expected: ExpectedStructure | null;
  /** Metadata read from the source spectrum file. */
  meta: SpectrumMeta | null;
  /** Local state label, kept separate from the server's free-text status string. */
  state: RunState;
  submittedAt: number;
  updatedAt: number;
  completedAt: number | null;
  /** Last error surfaced for this run, if any. */
  error?: string;
}

export type RunState =
  'pending' | 'running' | 'success' | 'failure' | 'revoked' | 'expired';

interface ElucidationDb extends DBSchema {
  runs: {
    key: string;
    value: StoredRun;
    indexes: { submittedAt: number };
  };
}

let dbPromise: Promise<IDBPDatabase<ElucidationDb>> | null = null;

function getDb(): Promise<IDBPDatabase<ElucidationDb>> {
  dbPromise ??= openDB<ElucidationDb>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore(STORE, { keyPath: 'jobId' });
      store.createIndex('submittedAt', 'submittedAt');
    },
  });
  return dbPromise;
}

/**
 * Reads every stored run, newest first.
 * @returns All runs, or an empty array when storage is unavailable.
 */
export async function listRuns(): Promise<StoredRun[]> {
  try {
    const db = await getDb();
    const runs = await db.getAllFromIndex(STORE, 'submittedAt');
    return runs.toReversed();
  } catch {
    return [];
  }
}

/**
 * Reads one run.
 * @param jobId - The job id.
 * @returns The run, or undefined when it is not stored.
 */
export async function getRun(jobId: string): Promise<StoredRun | undefined> {
  try {
    const db = await getDb();
    return await db.get(STORE, jobId);
  } catch {
    return undefined;
  }
}

/**
 * Inserts or replaces a run.
 * @param run - The complete record.
 * @returns True when the write succeeded.
 */
export async function putRun(run: StoredRun): Promise<boolean> {
  try {
    const db = await getDb();
    await db.put(STORE, run);
    return true;
  } catch {
    return false;
  }
}

/**
 * Merges a partial update into a stored run.
 * @param jobId - The job to update.
 * @param patch - Fields to change. `updatedAt` is set automatically.
 * @param now - Current epoch milliseconds.
 * @returns The updated run, or undefined when it does not exist.
 */
export async function patchRun(
  jobId: string,
  patch: Partial<StoredRun>,
  now: number = Date.now(),
): Promise<StoredRun | undefined> {
  const existing = await getRun(jobId);
  if (existing === undefined) return undefined;
  const updated: StoredRun = { ...existing, ...patch, updatedAt: now };
  await putRun(updated);
  return updated;
}

/**
 * Deletes one run.
 * @param jobId - The job id.
 */
export async function deleteRun(jobId: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete(STORE, jobId);
  } catch {
    // A failed delete leaves the run listed, which is safer than pretending it is gone.
  }
}

/** Deletes every stored run. */
export async function clearRuns(): Promise<void> {
  try {
    const db = await getDb();
    await db.clear(STORE);
  } catch {
    // Nothing to do: the caller re-reads the list either way.
  }
}

/**
 * Estimates how much space the stored runs occupy.
 *
 * Each run embeds a 10 000-point spectrum, so the history grows by roughly 200 kB per
 * run and is worth surfacing to the user.
 * @returns Usage and quota in bytes, or null when the browser does not report them.
 */
export async function storageEstimate(): Promise<{
  usage: number;
  quota: number;
} | null> {
  try {
    const estimate = await navigator.storage?.estimate();
    if (estimate?.usage === undefined || estimate.quota === undefined) {
      return null;
    }
    return { usage: estimate.usage, quota: estimate.quota };
  } catch {
    return null;
  }
}
