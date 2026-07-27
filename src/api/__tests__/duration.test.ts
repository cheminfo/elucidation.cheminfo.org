import { expect, test } from 'vitest';

import { estimateRunSeconds } from '../duration.ts';
import { DEFAULT_GA_PARAMETERS } from '../types.ts';

const SPECTRUM = { x: [], y: [] };

test('the estimate reproduces the runs it was fitted on', () => {
  // Measured on 2026-07-27 at the default pop_ga: 5 x 256 -> 101 s, 10 x 1024 -> 201 s.
  expect(
    estimateRunSeconds({
      mf: 'C4H8O',
      spectrum: SPECTRUM,
      gens_ga: 5,
      offspring_ga: 256,
    }),
  ).toBeCloseTo(101.2, 0);
  expect(
    estimateRunSeconds({
      mf: 'C4H8O',
      spectrum: SPECTRUM,
      gens_ga: 10,
      offspring_ga: 1024,
    }),
  ).toBeCloseTo(200.7, 0);
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
  expect(implicit).toBeCloseTo(101.2, 0);
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
