import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import type { JobResult } from '../../api/types.ts';
import { extractCandidates } from '../../api/types.ts';
import { expectedFromMolfile, rankCandidates } from '../candidates.ts';

/**
 * A real `/jobs/{id}/result` payload, recorded from a live run of the experimental
 * ethyl vinyl ether spectrum (job `d2cc7dd964d5defb38819a3717c33875`, 729 s of compute).
 * It is the only fixture in the suite that exercises the ranking against genuine model
 * output rather than hand-written candidates.
 */
const PAYLOAD = JSON.parse(
  readFileSync(
    join(import.meta.dirname, 'data', 'ethylvinylether-result.json'),
    'utf8',
  ),
) as JobResult;

const MOLFILE = readFileSync(
  join(
    import.meta.dirname,
    '..',
    '..',
    'spectrum',
    '__tests__',
    'data',
    'ethylvinylether',
    'structure.mol',
  ),
  'utf8',
);

test('the recorded run returns 512 candidates carrying provenance', () => {
  const candidates = extractCandidates(PAYLOAD);

  expect(candidates).toHaveLength(512);
  expect(
    candidates.filter((candidate) => candidate.retrieved === true),
  ).toHaveLength(61);
});

test('most returned candidates do not match the requested formula', () => {
  // The formula only enters the fitness function as a penalty, so the model happily
  // returns C4H8OS, C4H9NO and the like. Filtering them out is what makes a displayed
  // rank meaningful, and 505 of 512 is the scale of it on a real run.
  const expected = expectedFromMolfile(MOLFILE);
  const ranked = rankCandidates(
    extractCandidates(PAYLOAD),
    'C4H8O',
    expected?.noStereoIDCode,
  );

  expect(ranked.candidates).toHaveLength(7);
  expect(ranked.rejectedCount).toBe(505);
  expect(ranked.hasProvenance).toBe(true);
});

test('ethyl vinyl ether is recovered at rank 1, well clear of the runner-up', () => {
  const expected = expectedFromMolfile(MOLFILE);
  const ranked = rankCandidates(
    extractCandidates(PAYLOAD),
    'C4H8O',
    expected?.noStereoIDCode,
  );

  expect(ranked.positionNoStereo).toBe(0);

  const best = ranked.candidates[0];
  expect(best?.smiles).toBe('C=COCC');
  expect(best?.isExpected).toBe(true);
  expect(best?.retrieved).toBe(true);
  expect(best?.score).toBeCloseTo(0.788, 3);

  // The gap to the next candidate is what makes the answer confident rather than lucky.
  expect(ranked.candidates[1]?.score).toBeLessThan(0.25);
});

test('the ranking is stable regardless of the order the API returns', () => {
  // The live API returns candidates unsorted, so the ranking must not depend on it.
  const expected = expectedFromMolfile(MOLFILE);
  const shuffled = extractCandidates(PAYLOAD).toReversed();
  const ranked = rankCandidates(shuffled, 'C4H8O', expected?.noStereoIDCode);

  expect(ranked.positionNoStereo).toBe(0);
  expect(ranked.candidates[0]?.smiles).toBe('C=COCC');
});
