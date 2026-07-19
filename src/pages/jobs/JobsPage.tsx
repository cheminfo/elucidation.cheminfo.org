import {
  Alert,
  Button,
  Card,
  HTMLTable,
  NonIdealState,
  Spinner,
} from '@blueprintjs/core';
import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useState } from 'react';
import { MF } from 'react-mf';
import { IdcodeSvgRenderer } from 'react-ocl';

import { CapsuleFilter } from '../../components/CapsuleFilter.tsx';
import { JobStatusTag } from '../../components/JobStatusTag.tsx';
import { useListKeyboardNav } from '../../components/useListKeyboardNav.ts';
import { activeJobId, challengeCandidates } from '../../state/data.ts';
import {
  clearAllRuns,
  removeRun,
  runCandidates,
  runs,
  runsLoaded,
} from '../../state/runs.ts';
import type { StoredRun } from '../../state/runsDb.ts';
import { storageEstimate } from '../../state/runsDb.ts';
import { navigate } from '../../state/view.ts';

type Filter = 'all' | 'running' | 'done' | 'failed';

/**
 * The history of every run submitted from this browser.
 *
 * Runs are stored in IndexedDB with the full request and every response, so a result
 * stays readable long after the server has forgotten it. That matters more than usual
 * here: the server identifies a run by its spectrum, so a discarded result can never be
 * recomputed from the same file.
 * @returns The runs page.
 */
export function JobsPage() {
  useSignals();
  const [filter, setFilter] = useState<Filter>('all');
  const [confirmClear, setConfirmClear] = useState(false);
  const usage = useStorageUsage();

  const all = runs.value;
  const visible = all.filter((run) => matchesFilter(run, filter));
  const selectedIndex = useListKeyboardNav(visible.length, (index) => {
    const run = visible[index];
    if (run !== undefined) openRun(run);
  });

  if (!runsLoaded.value) {
    return <NonIdealState icon={<Spinner />} title="Loading run history" />;
  }
  if (all.length === 0) {
    return (
      <NonIdealState
        icon="history"
        title="No runs yet"
        description="Submitted spectra are stored in this browser with their full results, and stay available after a reload."
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <CapsuleFilter
          options={[
            { value: 'all', label: 'All', count: all.length },
            {
              value: 'running',
              label: 'Running',
              count: all.filter((run) => matchesFilter(run, 'running')).length,
              intent: 'primary',
            },
            {
              value: 'done',
              label: 'Finished',
              count: all.filter((run) => matchesFilter(run, 'done')).length,
              intent: 'success',
            },
            {
              value: 'failed',
              label: 'Failed',
              count: all.filter((run) => matchesFilter(run, 'failed')).length,
              intent: 'danger',
            },
          ]}
          value={filter}
          onChange={(value) => setFilter(value as Filter)}
        />
        <span style={{ flex: 1 }} />
        {usage !== null && (
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {formatBytes(usage.usage)} stored
          </span>
        )}
        <Button
          variant="minimal"
          intent="danger"
          icon="eraser"
          text="Clear history"
          onClick={() => setConfirmClear(true)}
        />
      </Card>

      <Card style={{ padding: 0, overflowX: 'auto' }}>
        <HTMLTable interactive compact style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Structure</th>
              <th>Formula</th>
              <th>Status</th>
              <th>Candidates</th>
              <th>Model</th>
              <th>Submitted</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((run, index) => (
              <tr
                key={run.jobId}
                data-testid="job-row"
                onClick={() => openRun(run)}
                style={{
                  background:
                    index === selectedIndex ? 'var(--row-selected)' : undefined,
                }}
              >
                <td>
                  {run.expected === null ? (
                    <span style={{ color: 'var(--muted)' }}>—</span>
                  ) : (
                    <IdcodeSvgRenderer
                      idcode={run.expected.idCode}
                      width={90}
                      height={60}
                      autoCrop
                    />
                  )}
                </td>
                <td>
                  <MF mf={run.request.mf} />
                </td>
                <td>
                  <JobStatusTag state={run.state} />
                </td>
                <td>
                  {run.resultPayload === null ? '—' : runCandidates(run).length}
                </td>
                <td style={{ fontSize: 12 }}>
                  {run.request.model ?? 'residual'}
                </td>
                <td title={new Date(run.submittedAt).toLocaleString()}>
                  {run.submittedAt === 0
                    ? '—'
                    : new Date(run.submittedAt).toLocaleDateString()}
                </td>
                <td>
                  <Button
                    variant="minimal"
                    size="small"
                    icon="trash"
                    aria-label="Remove from history"
                    onClick={(event) => {
                      event.stopPropagation();
                      void removeRun(run.jobId);
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </HTMLTable>
      </Card>

      <Alert
        isOpen={confirmClear}
        intent="danger"
        icon="trash"
        cancelButtonText="Keep"
        confirmButtonText="Delete all"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          void clearAllRuns();
          setConfirmClear(false);
        }}
      >
        <p>
          Delete all {all.length} runs from this browser? Their stored results
          go with them, and because the server identifies a run by its spectrum,
          resubmitting the same file cannot recompute them.
        </p>
      </Alert>
    </div>
  );
}

/**
 * Opens a run's stored result on the elucidate page, without contacting the server.
 * @param run - The run to display.
 */
function openRun(run: StoredRun): void {
  challengeCandidates.value = null;
  activeJobId.value = run.jobId;
  navigate('elucidate', run.jobId);
}

function useStorageUsage(): { usage: number; quota: number } | null {
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(
    null,
  );
  useEffect(() => {
    let cancelled = false;
    storageEstimate()
      .then((value) => {
        if (!cancelled) setUsage(value);
      })
      .catch(() => {
        if (!cancelled) setUsage(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return usage;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function matchesFilter(run: StoredRun, filter: Filter): boolean {
  if (filter === 'running') {
    return run.state === 'pending' || run.state === 'running';
  }
  if (filter === 'done') return run.state === 'success';
  if (filter === 'failed') {
    return ['failure', 'expired', 'revoked'].includes(run.state);
  }
  return true;
}
