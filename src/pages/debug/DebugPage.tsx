import { Card, HTMLTable } from '@blueprintjs/core';
import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useState } from 'react';

import { getQueueStats } from '../../api/client.ts';
import type { QueueStats } from '../../api/types.ts';
import { rankedCandidates } from '../../state/data.ts';
import { preferences } from '../../state/preferences.ts';

/**
 * Unlinked diagnostics page, reachable only by typing `#/debug`.
 *
 * Kept out of the navigation because queue and worker endpoints expose Celery internals
 * and worker hostnames, which are of no interest to a chemist and should not be
 * advertised publicly.
 * @returns The debug page.
 */
export function DebugPage() {
  useSignals();
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getQueueStats(preferences.value.apiUrl)
      .then(setStats)
      .catch((error_: unknown) =>
        setError(error_ instanceof Error ? error_.message : String(error_)),
      );
  }, []);

  const ranked = rankedCandidates.value;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card style={{ display: 'grid', gap: 8 }}>
        <strong>Queue</strong>
        {error !== null && <span style={{ color: '#c23030' }}>{error}</span>}
        {stats !== null && (
          <HTMLTable compact>
            <tbody>
              <tr>
                <th>Active</th>
                <td>{stats.active_tasks ?? '—'}</td>
              </tr>
              <tr>
                <th>Reserved</th>
                <td>{stats.reserved_tasks ?? '—'}</td>
              </tr>
              <tr>
                <th>Scheduled</th>
                <td>{stats.scheduled_tasks ?? '—'}</td>
              </tr>
              <tr>
                <th>Total submitted</th>
                <td>{stats.total_submitted_jobs ?? '—'}</td>
              </tr>
              <tr>
                <th>Workers</th>
                <td>{stats.workers?.length ?? 0}</td>
              </tr>
            </tbody>
          </HTMLTable>
        )}
      </Card>

      <Card style={{ display: 'grid', gap: 8 }}>
        <strong>Current ranking</strong>
        <pre style={{ fontSize: 12, overflowX: 'auto', margin: 0 }}>
          {JSON.stringify(
            {
              count: ranked?.candidates.length ?? 0,
              positionNoStereo: ranked?.positionNoStereo ?? null,
              rejected: ranked?.rejectedCount ?? 0,
              top: ranked?.candidates.slice(0, 5).map((c) => ({
                rank: c.rank,
                smiles: c.smiles,
                score: c.score,
              })),
            },
            null,
            2,
          )}
        </pre>
      </Card>
    </div>
  );
}
