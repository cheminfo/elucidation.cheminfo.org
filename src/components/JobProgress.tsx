import { Button, Callout, Card, ProgressBar, Tag } from '@blueprintjs/core';
import { useEffect, useState } from 'react';

import type { QueueStats } from '../api/types.ts';
import type { StoredRun } from '../state/runsDb.ts';

const FINISHED = new Set(['success', 'failure', 'revoked', 'expired']);

/** Median wall clock of a run with the default settings, used only to set expectations. */
const TYPICAL_DURATION_MS = 30 * 60 * 1000;

export interface JobProgressProps {
  run: StoredRun;
  queue: QueueStats | null;
  onCancel: () => void;
}

/**
 * Live state of a running elucidation.
 *
 * The backend cannot report real progress: it emits a single Celery `PROGRESS` event
 * before the genetic algorithm starts, with `current` hard-coded to 0, and never updates
 * it. A percentage bar would therefore be invented, so this shows an indeterminate bar
 * plus the things that are genuinely known — elapsed time, the stage string the worker
 * leaked into the status field, queue depth and worker count.
 * @param props - The run, current queue statistics and a cancel handler.
 * @returns The progress panel.
 */
export function JobProgress(props: JobProgressProps) {
  const { run, queue, onCancel } = props;
  const elapsed = useElapsed(run.submittedAt, !FINISHED.has(run.state));

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

      <ProgressBar intent="primary" stripes animate />

      <div
        style={{ fontSize: 12, color: 'var(--muted)', display: 'grid', gap: 2 }}
      >
        <span>{describeStage(run.status?.status ?? '', waiting)}</span>
        <span>
          A run takes roughly {Math.round(TYPICAL_DURATION_MS / 60_000)}{' '}
          minutes. The server does not report intermediate progress, so this bar
          shows activity, not completion.
        </span>
        {queue !== null && (
          <span>
            Queue: {queue.active_tasks ?? 0} running ·{' '}
            {queue.reserved_tasks ?? 0} waiting · {queue.workers?.length ?? 0}{' '}
            worker
            {(queue.workers?.length ?? 0) === 1 ? '' : 's'}
          </span>
        )}
        <span>
          You can close this page — the job keeps running and is stored locally.
        </span>
      </div>
    </Card>
  );
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

function useElapsed(since: number, live: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!live) return;
    const timer = globalThis.setInterval(() => setNow(Date.now()), 1000);
    return () => globalThis.clearInterval(timer);
  }, [live]);
  return Math.max(0, now - since);
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
