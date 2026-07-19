import { expect, test } from 'vitest';

import { runCandidates, toRunState } from '../runs.ts';
import type { StoredRun } from '../runsDb.ts';

function run(overrides: Partial<StoredRun> = {}): StoredRun {
  return {
    jobId: 'abc',
    request: { mf: 'C9H6N4', spectrum: { x: [], y: [] } },
    submitResponse: { job_id: 'abc', status: 'submitted' },
    status: null,
    resultPayload: null,
    expected: null,
    meta: null,
    state: 'pending',
    submittedAt: 0,
    updatedAt: 0,
    completedAt: null,
    ...overrides,
  };
}

test('recognised Celery states map to their own labels', () => {
  expect(toRunState('success')).toBe('success');
  expect(toRunState('SUCCESS')).toBe('success');
  expect(toRunState('failure')).toBe('failure');
  expect(toRunState('revoked')).toBe('revoked');
  expect(toRunState('expired')).toBe('expired');
  expect(toRunState('pending')).toBe('pending');
});

test('a leaked stage description counts as running', () => {
  // The API overwrites `status` with the worker's own meta.status string, so a running
  // job reports free text rather than a Celery state.
  expect(toRunState('Initializing genetic algorithm...')).toBe('running');
  expect(toRunState('progress')).toBe('running');
  expect(toRunState('retry')).toBe('running');
});

test('a run with no result yet has no candidates', () => {
  expect(runCandidates(run())).toStrictEqual([]);
});

test('candidates are read from the completed payload shape', () => {
  const stored = run({
    resultPayload: {
      results: [{ smiles: 'CCO', score: 0.5 }],
      metadata: {
        job_id: 'abc',
        processing_time: 1,
        timestamp: 2,
        task_id: 't',
      },
    },
  });
  expect(runCandidates(stored)).toStrictEqual([{ smiles: 'CCO', score: 0.5 }]);
});

test('candidates are read from the in-progress bare-array shape', () => {
  // While the algorithm runs, the same endpoint serves a bare array instead.
  const stored = run({ resultPayload: [{ smiles: 'CCO', score: 0.5 }] });
  expect(runCandidates(stored)).toStrictEqual([{ smiles: 'CCO', score: 0.5 }]);
});
