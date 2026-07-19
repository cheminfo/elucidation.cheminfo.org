import { Button, Card, Tag } from '@blueprintjs/core';
import { useSignals } from '@preact/signals-react/runtime';
import { MF } from 'react-mf';

import { JobStatusTag } from '../../components/JobStatusTag.tsx';
import { challengeCandidates } from '../../state/data.ts';
import { runs } from '../../state/runs.ts';
import type { StoredRun } from '../../state/runsDb.ts';
import { navigate } from '../../state/view.ts';

/** How many past runs the tile lists before pointing at the full history. */
const RECENT_COUNT = 5;

const UNFINISHED = new Set(['pending', 'running']);

/**
 * Landing content shown while no spectrum is loaded: what the tool does, the reference
 * examples, and the runs already submitted from this browser.
 *
 * Runs live in IndexedDB, so this is what a returning user sees after a reload —
 * including the ones still being computed on the server.
 * @returns The home tiles.
 */
export function HomeTiles() {
  useSignals();
  const all = runs.value;
  const recent = all.slice(0, RECENT_COUNT);
  const running = all.filter((run) => UNFINISHED.has(run.state)).length;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card style={{ display: 'grid', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>
          Structure elucidation from a 1H NMR spectrum
        </h2>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          Drop a spectrum and give its molecular formula. A genetic algorithm
          then searches chemical space for the structures whose predicted
          spectrum best matches yours, and returns them ranked. A run typically
          takes tens of minutes, and you can close this page while it works.
        </p>
      </Card>

      <div
        style={{
          display: 'grid',
          gap: 16,
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          alignItems: 'start',
        }}
      >
        <Card style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
          <TileHeading icon="grid-view" title="Reference examples" />
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
            Solved challenges from the paper, each with its spectrum and
            precomputed candidates. They open instantly and need no run, so this
            is the quickest way to see what the results look like.
          </p>
          <Button
            icon="grid-view"
            text="Browse examples"
            onClick={() => navigate('examples')}
          />
        </Card>

        <Card style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
          <TileHeading
            icon="history"
            title="Your previous runs"
            right={
              running > 0 ? (
                <Tag round minimal intent="primary">
                  {running} running
                </Tag>
              ) : undefined
            }
          />
          {recent.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
              Nothing submitted yet. Runs you start are kept in this browser and
              come back after a reload, with their status refreshed from the
              server.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 4 }}>
              {recent.map((run) => (
                <RecentRun key={run.jobId} run={run} />
              ))}
            </div>
          )}
          <Button
            icon="history"
            text={all.length > 0 ? `All runs (${all.length})` : 'Run history'}
            onClick={() => navigate('jobs')}
          />
        </Card>
      </div>
    </div>
  );
}

function RecentRun(props: { run: StoredRun }) {
  const { run } = props;
  return (
    <Button
      variant="minimal"
      alignText="start"
      data-testid="home-run"
      onClick={() => {
        challengeCandidates.value = null;
        navigate('elucidate', run.jobId);
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          fontSize: 13,
        }}
      >
        <span style={{ flex: 1, textAlign: 'left' }}>
          {run.request.mf === '' ? (
            run.jobId.slice(0, 8)
          ) : (
            <MF mf={run.request.mf} />
          )}
        </span>
        <JobStatusTag state={run.state} />
        <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>
          {run.submittedAt === 0
            ? '—'
            : new Date(run.submittedAt).toLocaleDateString()}
        </span>
      </span>
    </Button>
  );
}

function TileHeading(props: {
  icon: 'grid-view' | 'history';
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Tag minimal icon={props.icon} />
      <strong>{props.title}</strong>
      <span style={{ flex: 1 }} />
      {props.right}
    </div>
  );
}
