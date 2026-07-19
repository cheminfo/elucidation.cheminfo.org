import { expect, test } from 'vitest';

import { parseHash } from '../../state/view.ts';
import {
  candidateFormula,
  extractCandidates,
  isRunningStatus,
  isTerminalStatus,
} from '../types.ts';

test('terminal statuses stop polling', () => {
  expect(isTerminalStatus('success')).toBe(true);
  expect(isTerminalStatus('SUCCESS')).toBe(true);
  expect(isTerminalStatus('failure')).toBe(true);
  expect(isTerminalStatus('revoked')).toBe(true);
  expect(isTerminalStatus('pending')).toBe(false);
});

test('a leaked stage description counts as running, not as an unknown state', () => {
  // The API overwrites `status` with the worker's own meta.status string, so a running
  // job reports free text rather than the Celery state.
  expect(isRunningStatus('Initializing genetic algorithm...')).toBe(true);
  expect(isRunningStatus('pending')).toBe(true);
  expect(isRunningStatus('retry')).toBe(true);
  expect(isRunningStatus('success')).toBe(false);
  expect(isRunningStatus('failure')).toBe(false);
});

test('both result payload shapes yield the same candidate list', () => {
  const candidates = [{ smiles: 'CCO', score: 0.5 }];
  // Completed jobs return an object; a job still writing returns a bare array.
  expect(extractCandidates({ results: candidates })).toStrictEqual(candidates);
  expect(extractCandidates(candidates)).toStrictEqual(candidates);
});

test('the two spellings of the formula key are both read', () => {
  expect(
    candidateFormula({ smiles: 'CCO', score: 1, molecular_formula: 'C2H6O' }),
  ).toBe('C2H6O');
  expect(candidateFormula({ smiles: 'CCO', score: 1, mf: 'C2H6O' })).toBe(
    'C2H6O',
  );
  expect(candidateFormula({ smiles: 'CCO', score: 1 })).toBe('');
});

test('hash routes are parsed and deep links carry an id', () => {
  expect(parseHash('#/examples')).toStrictEqual({ page: 'examples', id: null });
  expect(parseHash('#/examples/abc123')).toStrictEqual({
    page: 'examples',
    id: 'abc123',
  });
  expect(parseHash('')).toStrictEqual({ page: 'elucidate', id: null });
  expect(parseHash('#/nonsense')).toStrictEqual({
    page: 'elucidate',
    id: null,
  });
});
