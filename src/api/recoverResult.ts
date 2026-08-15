import type { StoredRun } from '../state/runsDb.ts';

import { ApiError, getJobResult } from './client.ts';
import type { ApiCandidate, JobResult } from './types.ts';

/**
 * What asking the server for a forgotten run's result produced.
 *
 * `gone` is the only outcome that justifies giving up on a run: `unavailable` covers a
 * transient answer (still running, a server error, no network) and leaves the run as it
 * was, so the next poll tries again.
 */
export type Recovery =
  | { kind: 'recovered'; patch: Partial<StoredRun> }
  | { kind: 'gone' }
  | { kind: 'unavailable' };

/**
 * Retrieves a finished result the API can no longer talk about.
 *
 * `/jobs/{id}/status` answers 404 as soon as the job-to-task mapping expires from Redis,
 * a day after submission. The result does not live there: the worker writes it to a file
 * in the API's cache directory, and `/jobs/{id}/result` serves that file without
 * consulting Redis at all, so it stays available long after the job stops being
 * trackable. A 404 on the status endpoint therefore says nothing about whether the
 * result still exists, and must never be reported as a lost run before this has been
 * tried.
 *
 * The server answers 410 when a file exists but carries no completed result — the run
 * died mid-way — and 404 when it holds nothing for that id at all. Both are final.
 * @param jobId - The job id.
 * @param baseUrl - API origin. Empty string means same-origin.
 * @returns The patch that revives the run, or why it could not be revived.
 */
export async function recoverResult(
  jobId: string,
  baseUrl = '',
): Promise<Recovery> {
  try {
    const payload = await getJobResult(jobId, baseUrl);
    return {
      kind: 'recovered',
      patch: {
        resultPayload: payload,
        state: 'success',
        completedAt: completionTime(payload),
        error: undefined,
      },
    };
  } catch (error) {
    if (error instanceof ApiError) {
      return error.status === 404 || error.status === 410
        ? { kind: 'gone' }
        : { kind: 'unavailable' };
    }
    return { kind: 'unavailable' };
  }
}

/**
 * When the run actually finished, taken from the payload rather than from the clock.
 *
 * A recovered run finished hours or days ago; stamping it with the time it was fetched
 * would date the whole run history from when the page happened to be open.
 * @param payload - The result payload, in either of the two shapes the API returns.
 * @returns Epoch milliseconds.
 */
function completionTime(payload: JobResult | ApiCandidate[]): number {
  if (Array.isArray(payload)) return Date.now();
  const timestamp = payload.metadata?.timestamp;
  // The API stamps it in seconds, as Python's time.time() produces it.
  return typeof timestamp === 'number'
    ? Math.round(timestamp * 1000)
    : Date.now();
}
