import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { formulaFromSmiles } from '../../chemistry/candidates.ts';
import { PPM_FROM, PPM_POINTS, PPM_TO, ppmAxis } from '../grid.ts';
import { normalizeSpectrum } from '../normalize.ts';
import { parseDroppedFiles } from '../parseFiles.ts';

const FIXTURE = join(import.meta.dirname, 'data', '4-chlorobenzylamine.jdx');
const ETHYL_VINYL_ETHER = join(
  import.meta.dirname,
  'data',
  'ethylvinylether',
  '1h.jdx',
);
const ETHYL_VINYL_ETHER_MOL = join(
  import.meta.dirname,
  'data',
  'ethylvinylether',
  'structure.mol',
);

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

test('the canonical grid spans exactly -2 to 10 ppm over 10000 points', () => {
  const axis = ppmAxis();
  expect(axis).toHaveLength(PPM_POINTS);
  expect(axis[0]).toBe(PPM_FROM);
  expect(axis.at(-1)).toBe(PPM_TO);
  expect(PPM_POINTS).toBe(10_000);
});

test('the axis is a shared, stable instance', () => {
  expect(ppmAxis()).toBe(ppmAxis());
});

test('normalizeSpectrum resamples a descending spectrum onto the ascending grid', () => {
  const result = normalizeSpectrum(descendingSpectrum(4096));

  expect(result.spectrum.x).toHaveLength(10_000);
  expect(result.spectrum.y).toHaveLength(10_000);
  expect(result.spectrum.x[0]).toBe(-2);
  expect(result.spectrum.x.at(-1)).toBe(10);
  expect(result.original.x[0]).toBeLessThan(result.original.x.at(-1) as number);
});

test('intensities are rescaled to exactly 0..1', () => {
  const { spectrum } = normalizeSpectrum(descendingSpectrum(4096));
  let min = Infinity;
  let max = -Infinity;
  for (const value of spectrum.y) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  expect(min).toBe(0);
  expect(max).toBe(1);
});

test('the integral is drawn in NMR display order, rising left to right', () => {
  // Stored against ascending ppm, but inverted so that on the flipped axis the trace
  // starts at zero on the left (10 ppm) and reaches one on the right (-2 ppm).
  const { integral } = normalizeSpectrum(descendingSpectrum(4096));

  expect(integral.y).toHaveLength(10_000);
  expect(integral.y[0]).toBe(1);
  expect(integral.y.at(-1)).toBe(0);

  let previous = Infinity;
  for (const value of integral.y) {
    expect(value).toBeLessThanOrEqual(previous);
    previous = value;
  }
});

test('the peak lands at the right chemical shift after resampling', () => {
  const { spectrum } = normalizeSpectrum(descendingSpectrum(8192));
  let peakIndex = 0;
  for (let i = 1; i < spectrum.y.length; i++) {
    if ((spectrum.y[i] as number) > (spectrum.y[peakIndex] as number)) {
      peakIndex = i;
    }
  }
  expect(spectrum.x[peakIndex]).toBeCloseTo(7.2, 1);
});

test('a mismatched or degenerate spectrum is rejected', () => {
  expect(() => normalizeSpectrum({ x: [1, 2, 3], y: [1, 2] })).toThrow(
    /same length/,
  );
  expect(() => normalizeSpectrum({ x: [1], y: [1] })).toThrow(
    /at least two points/,
  );
});

test('a JCAMP file is parsed, described and normalized to the grid', async () => {
  const buffer = readFileSync(FIXTURE);
  const file = new File([buffer], '4-chlorobenzylamine.jdx');

  const parsed = await parseDroppedFiles([file]);

  expect(parsed.errors).toStrictEqual([]);
  expect(parsed.warnings).toStrictEqual([]);
  expect(parsed.meta).toStrictEqual({
    name: '4-chlorobenzylamine',
    nucleus: '1H',
    solvent: 'CDCl3',
    frequency: 400.13,
  });
  expect(parsed.spectrum?.spectrum.y).toHaveLength(10_000);
});

test('an unsupported file is reported rather than ignored', async () => {
  const file = new File(['nonsense'], 'notes.txt');
  const parsed = await parseDroppedFiles([file]);

  expect(parsed.spectrum).toBeNull();
  expect(parsed.errors).toStrictEqual([
    'notes.txt: unsupported file type ".txt".',
  ]);
});

test('an empty molfile does not throw, unlike in the prototype', async () => {
  const file = new File([''], 'empty.mol');
  const parsed = await parseDroppedFiles([file]);

  expect(parsed.expected).toBeNull();
  expect(parsed.errors).toStrictEqual([
    'empty.mol does not contain a readable structure.',
  ]);
});

test('a real Bruker NTUPLES spectrum is read with its acquisition metadata', async () => {
  // Experimental 1H of ethyl vinyl ether (CAS 109-92-2), DMSO, 400 MHz. Unlike the
  // synthetic fixture this is a multi-block NTUPLES file straight off a spectrometer.
  const file = new File([readFileSync(ETHYL_VINYL_ETHER)], '1h.jdx');

  const parsed = await parseDroppedFiles([file]);

  expect(parsed.errors).toStrictEqual([]);
  expect(parsed.warnings).toStrictEqual([]);
  expect(parsed.meta?.nucleus).toBe('1H');
  expect(parsed.meta?.solvent).toBe('DMSO');
  expect(parsed.meta?.frequency).toBeCloseTo(400.11, 2);
  expect(parsed.spectrum?.spectrum.y).toHaveLength(10_000);
});

test('the ethyl vinyl ether peaks land at the expected chemical shifts', async () => {
  const file = new File([readFileSync(ETHYL_VINYL_ETHER)], '1h.jdx');
  const parsed = await parseDroppedFiles([file]);
  const spectrum = parsed.spectrum;
  if (spectrum === null) throw new Error('the spectrum failed to parse');

  const shiftOfTallestBetween = (from: number, to: number): number => {
    let best = -1;
    let bestY = -Infinity;
    for (let i = 0; i < spectrum.spectrum.x.length; i++) {
      const x = spectrum.spectrum.x[i] as number;
      if (x < from || x > to) continue;
      const y = spectrum.spectrum.y[i] as number;
      if (y > bestY) {
        bestY = y;
        best = i;
      }
    }
    return spectrum.spectrum.x[best] as number;
  };

  // CH3 triplet, OCH2 quartet, and the deshielded OCH= of the vinyl group.
  expect(shiftOfTallestBetween(1, 1.6)).toBeCloseTo(1.31, 1);
  expect(shiftOfTallestBetween(3.6, 3.9)).toBeCloseTo(3.76, 1);
  expect(shiftOfTallestBetween(6.2, 6.7)).toBeCloseTo(6.47, 1);
});

test('the accompanying molfile gives the formula the run must be submitted with', async () => {
  const spectrumFile = new File([readFileSync(ETHYL_VINYL_ETHER)], '1h.jdx');
  const molFile = new File(
    [readFileSync(ETHYL_VINYL_ETHER_MOL)],
    'structure.mol',
  );

  const parsed = await parseDroppedFiles([spectrumFile, molFile]);

  expect(parsed.expected?.smiles).toBe('CCOC=C');
  expect(formulaFromSmiles(parsed.expected?.smiles ?? '')).toBe('C4H8O');
});
