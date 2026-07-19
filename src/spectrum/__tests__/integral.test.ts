import { expect, test } from 'vitest';

import { ppmAxis } from '../grid.ts';
import { displayIntegral } from '../integral.ts';
import { normalizeSpectrum } from '../normalize.ts';

function descendingSpectrum(points: number): {
  x: Float64Array;
  y: Float64Array;
} {
  const x = new Float64Array(points);
  const y = new Float64Array(points);
  for (let i = 0; i < points; i++) {
    x[i] = 12 - (24 * i) / (points - 1);
    y[i] = 1000 + 50_000 * Math.exp(-(((x[i] as number) - 7.2) ** 2) / 0.001);
  }
  return { x, y };
}

test('a recalled spectrum rebuilds the same integral it was submitted with', () => {
  const normalized = normalizeSpectrum(descendingSpectrum(4096));

  // A stored run only keeps the gridded y, so recall rebuilds the axis and integral.
  const recalled = displayIntegral({
    x: ppmAxis(),
    y: Float64Array.from(normalized.spectrum.y),
  });

  expect(recalled.y).toStrictEqual(normalized.integral.y);
  expect(recalled.x).toStrictEqual(normalized.integral.x);
});

test('the integral runs from one to zero across the displayed axis', () => {
  const { y } = displayIntegral(
    normalizeSpectrum(descendingSpectrum(4096)).spectrum,
  );

  expect(y).toHaveLength(10_000);
  expect(y[0]).toBe(1);
  expect(y.at(-1)).toBe(0);
});
