import { useEffect, useRef } from 'react';

import { preferences } from '../state/preferences.ts';
import { runs, toRunState, updateRun } from '../state/runs.ts';
import type { StoredRun } from '../state/runsDb.ts';

import { ApiError, getJobResult, getJobStatus } from './client.ts';

/** How often the run the user is looking at is refreshed. */
const ACTIVE_INTERVAL_MS = 10_000;
/** How often other unfinished runs are refreshed. */
const BACKGROUND_INTERVAL_MS = 60_000;
const MAX_BACKOFF_MS = 120_000;

/**
 * How often the due-check runs. It must be shorter than the shortest interval above:
 * with a timer of exactly ACTIVE_INTERVAL_MS, millisecond drift makes `now - last` fall
 * a hair short on the matching tick, so every other tick was skipped and the real
 * cadence was twice the intended one.
 */
const TICK_INTERVAL_MS = 2000;

const FINISHED = new Set(['success', 'failure', 'revoked', 'expired']);

/**
 * Keeps unfinished runs up to date and stores every payload the server returns.
 *
 * Mount this exactly once, at the application root. Mounting it per page ran several
 * independent timers at the same time, so every poll was duplicated.
 *
 * Replaces the prototype's two unconditional `setInterval`s, which re-fetched and
 * re-parsed the full result of the selected job every ten seconds forever, including
 * after it had finished. Here polling stops once a run reaches a final state, the result
 * is fetched exactly once and then persisted (the backend forgets it an hour after
 * completion), requests never stack, and nothing runs while the tab is hidden.
 * @param activeJobId - The run currently displayed, polled more frequently.
 */
export function useJobPolling(activeJobId: string | null): void {
  const inFlight = useRef(new Set<string>());
  const backoff = useRef(0);
  const lastPolled = useRef(new Map<string, number>());

  useEffect(() => {
    let cancelled = false;

    async function tick(): Promise<void> {
      if (cancelled || globalThis.document.visibilityState === 'hidden') return;

      const now = Date.now();
      const due = runs.value.filter((run) => {
        if (FINISHED.has(run.state)) return false;
        if (inFlight.current.has(run.jobId)) return false;
        const interval =
          run.jobId === activeJobId
            ? ACTIVE_INTERVAL_MS
            : BACKGROUND_INTERVAL_MS;
        const last = lastPolled.current.get(run.jobId) ?? 0;
        return now - last >= interval + backoff.current;
      });

      if (due.length === 0) return;

      // Stamp before the request, not after: stamping on completion adds the round-trip
      // and the IndexedDB write to every cycle, so the real cadence silently drifts
      // longer than the interval asks for. The in-flight guard prevents overlap.
      for (const run of due) lastPolled.current.set(run.jobId, now);

      const outcomes = await Promise.all(
        due.map((run) => refresh(run, inFlight.current)),
      );
      if (cancelled) return;

      backoff.current = outcomes.includes('network-error')
        ? Math.min(
            backoff.current === 0 ? ACTIVE_INTERVAL_MS : backoff.current * 2,
            MAX_BACKOFF_MS,
          )
        : 0;
    }

    const onVisible = (): void => {
      if (globalThis.document.visibilityState === 'visible') void tick();
    };

    void tick();
    const timer = globalThis.setInterval(() => void tick(), TICK_INTERVAL_MS);
    globalThis.document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      globalThis.clearInterval(timer);
      globalThis.document.removeEventListener('visibilitychange', onVisible);
    };
  }, [activeJobId]);
}

type Outcome = 'ok' | 'network-error';

async function refresh(
  run: StoredRun,
  inFlight: Set<string>,
): Promise<Outcome> {
  inFlight.add(run.jobId);
  const baseUrl = preferences.value.apiUrl;
  try {
    const status = await getJobStatus(run.jobId, baseUrl);
    const state = toRunState(status.status);
    await updateRun(run.jobId, { status, state, error: status.error });

    if (state === 'success') {
      await cacheResult(run.jobId, baseUrl);
    }
    return 'ok';
  } catch (error) {
    if (error instanceof ApiError) {
      // 404 means the backend has forgotten the job entirely: its mapping expired.
      if (error.status === 404) {
        await updateRun(run.jobId, {
          state: 'expired',
          error: 'The server no longer knows this run.',
        });
      }
      return 'ok';
    }
    return 'network-error';
  } finally {
    inFlight.delete(run.jobId);
  }
}

async function cacheResult(jobId: string, baseUrl: string): Promise<void> {
  try {
    const payload = await getJobResult(jobId, baseUrl);
    await updateRun(jobId, { resultPayload: payload, completedAt: Date.now() });
  } catch (error) {
    // 400 means the algorithm is still writing; the next tick will pick it up.
    if (error instanceof ApiError && error.status !== 400) {
      await updateRun(jobId, { error: error.message });
    }
  }
}
