/** Fixed-grid spectrum exactly as the elucidation API expects it. */
export interface ApiSpectrum {
  /** Ascending ppm axis, 10000 points from -2 to 10. */
  x: number[];
  /** Intensities, min-max rescaled to 0..1. */
  y: number[];
}

/** Selects the 1H encoder checkpoint. Not an algorithm choice. */
export type SecsModel = 'residual' | 'regular';

/**
 * Genetic-algorithm settings.
 *
 * The defaults are the reference client's, not the paper's. The paper runs
 * `gens_ga: 10`, `pop_ga: 512`, `offspring_ga: 1024`, which scores roughly twenty times
 * more molecules per run and takes correspondingly longer for a demo-sized problem.
 */
export interface GaParameters {
  /** Random seed. @default 42 */
  seed: number;
  /** Number of GA generations. @default 5 */
  gens_ga: number;
  /** Population size carried between generations. @default 50 */
  pop_ga: number;
  /** Candidates generated per generation. @default 256 */
  offspring_ga: number;
  /** Fraction of offspring produced by mutation rather than crossover. @default 0.3 */
  frac_graph_ga_mutate: number;
}

export const DEFAULT_GA_PARAMETERS: GaParameters = {
  seed: 42,
  gens_ga: 5,
  pop_ga: 50,
  offspring_ga: 256,
  frac_graph_ga_mutate: 0.3,
};

export interface SubmitRequest extends Partial<GaParameters> {
  mf: string;
  spectrum: ApiSpectrum;
  model?: SecsModel;
}

export interface SubmitResponse {
  job_id: string;
  /** Absent when `status` is `cached` — the server never queued a task. */
  task_id?: string;
  status: 'submitted' | 'cached';
  message?: string;
}

/**
 * Celery states the API can report, lowercased.
 *
 * `progress` is listed for completeness but is never actually observed: the API
 * overwrites `status` with the task meta's own `status` string, so a running job
 * reports free text such as `"Initializing genetic algorithm..."`. Use
 * {@link isTerminalStatus} rather than comparing against this union.
 */
export type JobStatus =
  'pending' | 'progress' | 'success' | 'failure' | 'retry' | 'revoked';

export interface JobStatusResponse {
  job_id: string;
  task_id: string;
  /** Either a Celery state or, while running, a free-text stage description. */
  status: string;
  current?: number;
  total?: number;
  completed?: boolean;
  error?: string;
  traceback?: string | null;
}

export interface ApiCandidate {
  smiles: string;
  score: number;
  /** The live API spells this `molecular_formula`; the demo dataset spells it `mf`. */
  molecular_formula?: string;
  mf?: string;
  /** True when the molecule came from the PubChem index rather than the GA. */
  retrieved?: boolean;
}

export interface JobResult {
  results: ApiCandidate[];
  metadata?: {
    job_id: string;
    processing_time: number;
    timestamp: number;
    task_id: string;
  };
}

export interface QueueStats {
  active_tasks?: number;
  scheduled_tasks?: number;
  reserved_tasks?: number;
  total_submitted_jobs?: number;
  workers?: string[];
  error?: string;
  /** Merged in client-side from `/workers`; null when that call failed. */
  slots?: number | null;
}

/** One node in the `/workers` response. Only the pool size is used here. */
export interface WorkerInfo {
  pool?: {
    'max-concurrency'?: number;
  };
}

/** Response of `/workers`, keyed by Celery node name (e.g. `celery@6135b5887a13`). */
export interface WorkersResponse {
  workers?: Record<string, WorkerInfo>;
}

/**
 * Total task slots across every worker node.
 *
 * This, not the node count, is what bounds how many jobs run at once: the deployment
 * runs a single node with `--concurrency=12`, so `workers.length` of 1 understates
 * capacity twelvefold.
 * @param response - The parsed `/workers` payload.
 * @returns The summed pool size, or null when no node reported one.
 */
export function countSlots(response: WorkersResponse): number | null {
  const nodes = response.workers;
  if (!nodes) return null;
  let total = 0;
  let known = false;
  for (const name of Object.keys(nodes)) {
    const slots = nodes[name]?.pool?.['max-concurrency'];
    if (typeof slots === 'number') {
      total += slots;
      known = true;
    }
  }
  return known ? total : null;
}

const TERMINAL_STATUSES = new Set(['success', 'failure', 'revoked']);

/**
 * Whether a job will never change state again, so polling can stop.
 * @param status - The `status` field from a status response.
 * @returns True for success, failure and revoked.
 */
export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status.toLowerCase());
}

const RUNNING_STATUSES = new Set(['pending', 'progress', 'retry']);

const KNOWN_STATUSES = new Set([
  'pending',
  'progress',
  'success',
  'failure',
  'retry',
  'revoked',
]);

/**
 * Whether a job is still being worked on.
 *
 * Anything the API reports that is not a recognised Celery state is a stage
 * description leaking through the `status` field, which means the task is running.
 * @param status - The `status` field from a status response.
 * @returns True while the job is queued, running or retrying.
 */
export function isRunningStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  if (!KNOWN_STATUSES.has(normalized)) return true;
  return RUNNING_STATUSES.has(normalized);
}

/**
 * Extracts the candidate list from a result payload.
 *
 * While the genetic algorithm is running, the backend's cache file holds a bare JSON
 * array of the current best candidates instead of the `{results, metadata}` object it
 * writes on completion. Both shapes are served from the same endpoint.
 * @param payload - Whatever `/jobs/{id}/result` returned.
 * @returns The candidate list.
 */
export function extractCandidates(
  payload: JobResult | ApiCandidate[],
): ApiCandidate[] {
  return Array.isArray(payload) ? payload : (payload.results ?? []);
}

/**
 * Reads a candidate's molecular formula regardless of which key it uses.
 * @param candidate - A candidate from the live API or the demo dataset.
 * @returns The formula, or an empty string when absent.
 */
export function candidateFormula(candidate: ApiCandidate): string {
  return candidate.molecular_formula ?? candidate.mf ?? '';
}
