import { Alert, Callout, Card, Switch, Tag } from '@blueprintjs/core';
import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useState } from 'react';

import { cancelJob, getQueueStats, getWorkers } from '../../api/client.ts';
import type { SubmitOutcome } from '../../api/submit.ts';
import { submitSpectrum } from '../../api/submit.ts';
import type { QueueStats } from '../../api/types.ts';
import { countSlots } from '../../api/types.ts';
import { CandidateList } from '../../components/CandidateList.tsx';
import { JobProgress } from '../../components/JobProgress.tsx';
import { SpectrumPlot } from '../../components/SpectrumPlot.tsx';
import {
  activeJobId,
  challengeCandidates,
  currentSpectrum,
  expectedStructure,
  mfInput,
  rankedCandidates,
  spectrumMeta,
} from '../../state/data.ts';
import { preferences } from '../../state/preferences.ts';
import { findRun, runs, updateRun } from '../../state/runs.ts';
import type { StoredRun } from '../../state/runsDb.ts';
import { navigate } from '../../state/view.ts';
import { formatRelativeTime } from '../../time/relativeTime.ts';

import { InputPanel } from './InputPanel.tsx';
import { WelcomePanel } from './WelcomePanel.tsx';

/**
 * The main workspace: load a spectrum, submit it, and read the ranked candidates.
 * @returns The elucidate page.
 */
export function ElucidatePage() {
  useSignals();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mismatch, setMismatch] = useState<SubmitOutcome['mismatch'] | null>(
    null,
  );
  const [showIntegral, setShowIntegral] = useState(true);
  const [reused, setReused] = useState(false);
  const queue = useQueueStats();

  const jobId = activeJobId.value;
  // Read the runs signal so the panel re-renders as polling stores new payloads.
  void runs.value;
  const run = jobId === null ? undefined : findRun(jobId);
  const ranked = rankedCandidates.value;
  const spectrum = currentSpectrum.value;

  async function handleSubmit(): Promise<void> {
    if (spectrum === null) return;
    setSubmitting(true);
    setError(null);
    setMismatch(null);
    setReused(false);
    try {
      challengeCandidates.value = null;
      const outcome = await submitSpectrum({
        spectrum,
        mf: mfInput.value,
        expected: expectedStructure.value,
        meta: spectrumMeta.value,
        preferences: preferences.value,
      });
      if (outcome.kind === 'mismatch') {
        setMismatch(outcome.mismatch ?? null);
      } else {
        setReused(outcome.kind === 'existing');
        activeJobId.value = outcome.jobId;
        // Put the job in the URL, otherwise a reload lands on a bare `#/elucidate`,
        // startRunRestore has no id to restore, and a job still running on the server
        // looks like it was never submitted.
        navigate('elucidate', outcome.jobId);
      }
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : String(error_));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(): Promise<void> {
    if (jobId === null) return;
    try {
      await cancelJob(jobId, preferences.value.apiUrl);
      await updateRun(jobId, { state: 'revoked' });
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : String(error_));
    }
  }

  return (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'minmax(280px, 340px) minmax(0, 1fr)',
        alignItems: 'start',
      }}
    >
      <div style={{ display: 'grid', gap: 16 }}>
        <InputPanel
          onSubmit={() => void handleSubmit()}
          submitting={submitting}
        />
        {error !== null && (
          <Callout intent="danger" icon="error" title="Submission failed">
            {error}
          </Callout>
        )}
        {run !== undefined && (
          <JobProgress
            run={run}
            queue={queue}
            onCancel={() => void handleCancel()}
          />
        )}
      </div>

      <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
        {reused && (
          <Callout intent="primary" icon="database" title="Already run">
            This spectrum was elucidated before, so the stored result is shown
            instead of starting another run. The server identifies a run by its
            spectrum, and resubmitting would occupy a worker for half an hour to
            recompute the same answer.
          </Callout>
        )}
        {run !== undefined && <RunSummary run={run} />}

        {spectrum === null ? (
          <WelcomePanel />
        ) : (
          <Card style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <strong>Normalized spectrum</strong>
              <span style={{ flex: 1 }} />
              <Switch
                checked={showIntegral}
                label="Integral"
                style={{ margin: 0 }}
                onChange={(event) =>
                  setShowIntegral(event.currentTarget.checked)
                }
              />
            </div>
            <SpectrumPlot
              spectrum={spectrum.spectrum}
              integral={spectrum.integral}
              showIntegral={showIntegral}
            />
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
              Resampled to 10 000 points between −2 and 10 ppm and rescaled to
              0–1. This fixed grid is what the model was trained on. Scroll to
              scale the intensity, drag to zoom a shift range, double click to
              reset.
            </p>
          </Card>
        )}

        {ranked !== null && (
          <Card style={{ minWidth: 0 }}>
            <CandidateList
              ranked={ranked}
              hasExpected={expectedStructure.value !== null}
            />
          </Card>
        )}
      </div>

      <Alert
        isOpen={mismatch !== null}
        intent="warning"
        icon="warning-sign"
        confirmButtonText="I understand"
        onClose={() => setMismatch(null)}
      >
        <p>
          <strong>These results were computed for a different formula.</strong>
        </p>
        <p>
          The server identifies a run by the spectrum alone, so it returned an
          earlier result for this file — computed for {mismatch?.storedMf}, not{' '}
          {mismatch?.requestedMf}. It cannot recompute the same spectrum, so
          those candidates are not shown.
        </p>
      </Alert>
    </div>
  );
}

function RunSummary(props: { run: StoredRun }) {
  const { run } = props;
  return (
    <Card
      compact
      data-testid="run-summary"
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <Tag minimal icon="database">
        Stored run
      </Tag>
      <code style={{ fontSize: 12 }}>{run.jobId}</code>
      <Tag minimal>{run.request.model ?? 'residual'}</Tag>
      <Tag minimal>{run.request.gens_ga ?? 10} generations</Tag>
      {run.submittedAt > 0 && (
        <span
          style={{ fontSize: 12, color: 'var(--muted)' }}
          title={new Date(run.submittedAt).toLocaleString()}
        >
          submitted {formatRelativeTime(run.submittedAt)}
        </span>
      )}
    </Card>
  );
}

function useQueueStats(): QueueStats | null {
  const [stats, setStats] = useState<QueueStats | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = (): void => {
      const apiUrl = preferences.value.apiUrl;
      // `/queue/stats` only names the nodes; the pool size lives in `/workers`. A failing
      // `/workers` must not blank the queue panel, so it degrades to a null slot count.
      Promise.all([
        getQueueStats(apiUrl),
        getWorkers(apiUrl)
          .then(countSlots)
          .catch(() => null),
      ])
        .then(([value, slots]) => {
          if (!cancelled) setStats({ ...value, slots });
        })
        .catch(() => {
          if (!cancelled) setStats(null);
        });
    };
    load();
    // 30 s was long enough that a freshly started job still saw "0 running", which reads
    // as a contradiction next to its own running bar.
    const timer = globalThis.setInterval(load, 10_000);
    return () => {
      cancelled = true;
      globalThis.clearInterval(timer);
    };
  }, []);
  return stats;
}
