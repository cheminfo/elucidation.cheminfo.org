import { expect, test } from 'vitest';

import { estimateRunSeconds } from '../duration.ts';
import { DEFAULT_GA_PARAMETERS } from '../types.ts';

const SPECTRUM = { x: [], y: [] };

test('the estimate reproduces the runs it was fitted on', () => {
  // 1 x 64 measured at 91 s, 5 x 256 at 96 s on 2026-07-27.
  expect(
    estimateRunSeconds({
      mf: 'C4H8O',
      spectrum: SPECTRUM,
      gens_ga: 1,
      offspring_ga: 64,
    }),
  ).toBeCloseTo(91.3, 1);
  expect(
    estimateRunSeconds({
      mf: 'C4H8O',
      spectrum: SPECTRUM,
      gens_ga: 5,
      offspring_ga: 256,
    }),
  ).toBeCloseTo(96.5, 1);
});

test('a request without parameters is estimated at the defaults', () => {
  const implicit = estimateRunSeconds({ mf: 'C4H8O', spectrum: SPECTRUM });
  const explicit = estimateRunSeconds({
    mf: 'C4H8O',
    spectrum: SPECTRUM,
    gens_ga: DEFAULT_GA_PARAMETERS.gens_ga,
    offspring_ga: DEFAULT_GA_PARAMETERS.offspring_ga,
  });
  expect(implicit).toBe(explicit);
  expect(implicit).toBeCloseTo(96.5, 1);
});

test('pop_ga does not enter the estimate, only the search size does', () => {
  const small = estimateRunSeconds({
    mf: 'C4H8O',
    spectrum: SPECTRUM,
    gens_ga: 5,
    pop_ga: 50,
    offspring_ga: 256,
  });
  const large = estimateRunSeconds({
    mf: 'C4H8O',
    spectrum: SPECTRUM,
    gens_ga: 5,
    pop_ga: 512,
    offspring_ga: 256,
  });
  expect(large).toBe(small);
});
