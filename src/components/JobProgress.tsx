import { Button, Callout, Card, ProgressBar, Tag } from '@blueprintjs/core';
import { useEffect, useState } from 'react';

import { estimateRunSeconds } from '../api/duration.ts';
import type { QueueStats } from '../api/types.ts';
import type { StoredRun } from '../state/runsDb.ts';

const FINISHED = new Set(['success', 'failure', 'revoked', 'expired']);

/**
 * Where the bar stops while the job is still running. It must never reach the end on an
 * estimate: a full bar next to a job that has not finished reads as a stuck interface.
 */
const MAX_ESTIMATED_FRACTION = 0.95;

export interface JobProgressProps {
  run: StoredRun;
  queue: QueueStats | null;
  onCancel: () => void;
}

/**
 * Live state of a running elucidation.
 *
 * The backend reports no real progress: it emits a single Celery `PROGRESS` event before
 * the genetic algorithm starts, with `current` hard-coded to 0, and never updates it —
 * `/jobs/{id}/result` answers 400 until the run ends, and there is no other endpoint. So
 * the bar is driven by elapsed time against {@link estimateRunSeconds}, which is an
 * estimate from the run's own GA parameters and is labelled as one. It stops short of the
 * end while running, and gives up on the estimate rather than stalling at 95% once a run
 * outlives it.
 * @param props - The run, current queue statistics and a cancel handler.
 * @returns The progress panel.
 */
export function JobProgress(props: JobProgressProps) {
  const { run, queue, onCancel } = props;
  const live = !FINISHED.has(run.state);
  const now = useTicker(live);

  if (run.state === 'failure') {
    return (
      <Callout intent="danger" icon="error" title="The run failed">
        {run.error ?? 'The worker reported a failure without details.'}
      </Callout>
    );
  }
  if (run.state === 'expired') {
    return (
      <Callout intent="warning" icon="time" title="The server forgot this job">
        Results are kept for a limited time. Because a job is identified by its
        spectrum, resubmitting the same file cannot recompute it.
      </Callout>
    );
  }
  if (FINISHED.has(run.state)) return null;

  const waiting = run.state === 'pending';
  const queueText = queue === null ? null : describeQueue(queue, waiting);
  const elapsed = Math.max(0, now - run.submittedAt);
  const expectedMs = estimateRunSeconds(run.request) * 1000;

  // Time the estimate against the moment the job started, not the moment it was
  // submitted: queue time is not compute time, and counting it would run the bar out
  // before the algorithm had done anything.
  const computing = Math.max(0, now - (run.startedAt ?? run.submittedAt));
  const fraction = waiting ? 0 : computing / expectedMs;
  const overrun = fraction >= 1;
  const remaining = Math.max(0, expectedMs - computing);

  return (
    <Card
      compact
      data-testid="job-progress"
      style={{ display: 'grid', gap: 10 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Tag intent={waiting ? 'none' : 'primary'} minimal>
          {waiting ? 'Queued' : 'Running'}
        </Tag>
        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatDuration(elapsed)}
        </strong>
        {!waiting && !overrun && (
          <span
            data-testid="job-remaining"
            style={{ fontSize: 12, color: 'var(--muted)' }}
          >
            about {formatDuration(remaining)} left
          </span>
        )}
        <span style={{ flex: 1 }} />
        <Button
          size="small"
          variant="minimal"
          intent="danger"
          icon="cross"
          text="Cancel"
          onClick={onCancel}
        />
      </div>

      <ProgressBar
        intent="primary"
        stripes
        animate
        // An indeterminate bar is the honest rendering both before the job starts and
        // once it has outlived its estimate; in between, show how far along it should be.
        value={
          waiting || overrun
            ? undefined
            : Math.min(fraction, MAX_ESTIMATED_FRACTION)
        }
      />

      <div
        style={{ fontSize: 12, color: 'var(--muted)', display: 'grid', gap: 2 }}
      >
        <span>{describeStage(run.status?.status ?? '', waiting)}</span>
        <span data-testid="job-estimate">
          {describeEstimate(run, expectedMs, waiting, overrun)}
        </span>
        {queueText !== null && <span>{queueText}</span>}
        <span>
          You can close this page — the job keeps running and is stored locally.
        </span>
      </div>
    </Card>
  );
}

/**
 * The sentence under the bar, which must never let the estimate pass for measured
 * progress: the server reports none, so the wording always names it as an estimate and
 * says what it is derived from.
 * @param run - The run being displayed.
 * @param expectedMs - Its estimated duration.
 * @param waiting - Whether it is still queued.
 * @param overrun - Whether it has already outlived the estimate.
 * @returns The sentence to render.
 */
function describeEstimate(
  run: StoredRun,
  expectedMs: number,
  waiting: boolean,
  overrun: boolean,
): string {
  const size = `${run.request.gens_ga ?? '?'} generations of ${run.request.offspring_ga ?? '?'} candidates`;
  if (waiting) {
    return `Once started it should take about ${formatDuration(expectedMs)} (${size}).`;
  }
  if (overrun) {
    return `This is taking longer than the estimated ${formatDuration(expectedMs)}. The server reports no progress, so there is nothing to read beyond elapsed time.`;
  }
  return `Estimated from ${size}; the server reports no real progress, so the bar is a projection, not a measurement.`;
}

/**
 * Server load, in words that mean something without knowing Celery.
 *
 * "Worker", "slot" and "queue depth" are all implementation vocabulary. What a submitter
 * actually needs is whether anything stands between their job and a result, so a waiting
 * job reports the jobs ahead of it and a running one reports how loaded the server is.
 * @param queue - The queue statistics, with the slot count merged in.
 * @param waiting - Whether this job has yet to start.
 * @returns A sentence, or null when there is nothing meaningful to say.
 */
function describeQueue(queue: QueueStats, waiting: boolean): string | null {
  if (waiting) {
    const ahead = queue.reserved_tasks ?? 0;
    if (ahead === 0) return 'No other job is waiting, so yours starts next.';
    return `${ahead} other job${ahead === 1 ? '' : 's'} ahead of yours.`;
  }
  const capacity = queue.slots;
  if (typeof capacity !== 'number') return null;
  const running = queue.active_tasks ?? 0;
  return `The server is running ${running} of the ${capacity} jobs it can process at the same time.`;
}

function describeStage(status: string, waiting: boolean): string {
  if (waiting) return 'Waiting for a free worker.';
  // A recognised Celery state carries no detail; anything else is the worker's own
  // stage description, which the API leaks through the status field.
  const generic = new Set(['', 'progress', 'retry', 'started', 'pending']);
  if (generic.has(status.toLowerCase())) {
    return 'Retrieving reference molecules and evolving candidates.';
  }
  return status;
}

function useTicker(live: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!live) return;
    const timer = globalThis.setInterval(() => setNow(Date.now()), 1000);
    return () => globalThis.clearInterval(timer);
  }, [live]);
  return now;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')} min`;
  if (minutes > 0) {
    return `${minutes} min ${String(seconds).padStart(2, '0')} s`;
  }
  return `${seconds} s`;
}
