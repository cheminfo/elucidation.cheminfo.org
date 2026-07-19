import type {
  ApiCandidate,
  JobResult,
  JobStatusResponse,
  QueueStats,
  SubmitRequest,
  SubmitResponse,
} from './types.ts';

/**
 * Raised when the API answers with a non-2xx status, carrying the HTTP code so
 * callers can distinguish "still running" (400) from "gone" (404).
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Submits a spectrum for elucidation.
 *
 * The backend identifies jobs by `sha256(spectrum.y)` alone, so a spectrum that was
 * submitted before comes back as `{status: 'cached'}` with no task id, regardless of
 * the formula, model or GA parameters sent this time. Callers must compare the
 * parameters they stored for that job id before showing a cached result.
 * @param request - Formula, spectrum and optional model / GA parameters.
 * @param baseUrl - API origin. Empty string means same-origin, which is how it is deployed.
 * @returns The job id and whether a task was actually queued.
 */
export async function submitJob(
  request: SubmitRequest,
  baseUrl = '',
): Promise<SubmitResponse> {
  return requestJson<SubmitResponse>(`${baseUrl}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

/**
 * Fetches the current state of a job.
 * @param jobId - The job id returned by {@link submitJob}.
 * @param baseUrl - API origin. Empty string means same-origin.
 * @returns The status payload. `status` may be free text while the job runs.
 */
export async function getJobStatus(
  jobId: string,
  baseUrl = '',
): Promise<JobStatusResponse> {
  return requestJson<JobStatusResponse>(`${baseUrl}/jobs/${jobId}/status`);
}

/**
 * Fetches a job's result payload, exactly as the server returned it.
 *
 * The payload is returned unmodified so it can be stored verbatim; use
 * {@link extractCandidates} to read the candidate list from either shape. Throws
 * {@link ApiError} with status 400 while the job is still running and 404 once the
 * backend has forgotten it (the Celery result expires after 1 h and the job mapping
 * after 24 h). Persist it the first time it succeeds.
 * @param jobId - The job id.
 * @param baseUrl - API origin. Empty string means same-origin.
 * @returns The raw result payload.
 */
export async function getJobResult(
  jobId: string,
  baseUrl = '',
): Promise<JobResult | ApiCandidate[]> {
  return requestJson<JobResult | ApiCandidate[]>(
    `${baseUrl}/jobs/${jobId}/result`,
  );
}

/**
 * Asks the backend to revoke a running job.
 *
 * The backend does not delete the job's cache file, so the same spectrum can never be
 * recomputed afterwards — it will keep answering `cached`.
 * @param jobId - The job id.
 * @param baseUrl - API origin. Empty string means same-origin.
 */
export async function cancelJob(jobId: string, baseUrl = ''): Promise<void> {
  await requestJson(`${baseUrl}/jobs/${jobId}`, { method: 'DELETE' });
}

/**
 * Reads queue depth and worker count, used to explain why a job is waiting.
 * @param baseUrl - API origin. Empty string means same-origin.
 * @returns Queue statistics, which may itself carry an `error` field.
 */
export async function getQueueStats(baseUrl = ''): Promise<QueueStats> {
  return requestJson<QueueStats>(`${baseUrl}/queue/stats`);
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new ApiError(response.status, await readErrorDetail(response));
  }
  return (await response.json()) as T;
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === 'string') return body.detail;
  } catch {
    // Non-JSON error bodies are common from proxies; fall through to the status text.
  }
  return `HTTP ${response.status} ${response.statusText}`;
}
