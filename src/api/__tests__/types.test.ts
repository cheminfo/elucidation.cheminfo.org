import { expect, test } from 'vitest';

import { parsePath, pathFromLegacyHash } from '../../state/view.ts';
import {
  candidateFormula,
  countSlots,
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

test('addresses are parsed and deep links carry an id', () => {
  expect(parsePath('/examples')).toStrictEqual({ page: 'examples', id: null });
  expect(parsePath('/examples/abc123')).toStrictEqual({
    page: 'examples',
    id: 'abc123',
  });
  expect(parsePath('/')).toStrictEqual({ page: 'elucidate', id: null });
  expect(parsePath('/abc123')).toStrictEqual({
    page: 'elucidate',
    id: 'abc123',
  });
});

test('a link written when the site routed by the hash still opens', () => {
  expect(pathFromLegacyHash('#/examples')).toBe('/examples');
  expect(pathFromLegacyHash('#/examples/abc123')).toBe('/examples/abc123');
  expect(pathFromLegacyHash('#/elucidate')).toBe('/');
  expect(pathFromLegacyHash('#/nonsense')).toBeNull();
  expect(pathFromLegacyHash('')).toBeNull();
});

test('slots are summed across worker nodes', () => {
  // Shape taken verbatim from the deployed /workers response.
  expect(
    countSlots({
      workers: { 'celery@6135b5887a13': { pool: { 'max-concurrency': 12 } } },
    }),
  ).toBe(12);
  expect(
    countSlots({
      workers: {
        a: { pool: { 'max-concurrency': 12 } },
        b: { pool: { 'max-concurrency': 4 } },
      },
    }),
  ).toBe(16);
});

test('an unreported pool size yields null rather than zero slots', () => {
  expect(countSlots({})).toBe(null);
  expect(countSlots({ workers: {} })).toBe(null);
  expect(countSlots({ workers: { a: {} } })).toBe(null);
  expect(countSlots({ workers: { a: { pool: {} } } })).toBe(null);
});
