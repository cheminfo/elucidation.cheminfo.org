import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

import { expect, test } from 'vitest';

import type { NormalizedSpectrum } from '../normalize.ts';
import { parseDroppedFiles } from '../parseFiles.ts';

const DATA = join(import.meta.dirname, 'data');
/** Aspirin in CDCl3 at 300 MHz, time domain (jcamp-data-test, MIT). */
const ASPIRIN_FID = join(DATA, 'aspirin', '1h.fid.dx');
/**
 * Ibuprofen in CDCl3 at 300 MHz, never processed: `pdata/1` holds a `procs` but no
 * spectrum, and the PHC0/PHC1 stored there phase the transformed FID into a dispersive
 * line shape. Only the automatic phase correction recovers it.
 */
const IBUPROFEN = join(DATA, 'ibuprofen', '1');
/**
 * Ibuprofen in CDCl3 at 600 MHz, also never processed: `pdata/1` holds a `procs` but no
 * spectrum, and `pdata/700` is the probe wobble curve TopSpin writes there — 512 points
 * over a 20 MHz sweep, not an NMR spectrum. The FID it carries leaves a residual first
 * order phase of several hundred degrees per sweep.
 */
const IBUPROFEN_600 = join(DATA, 'ibuprofen-600', '1');
/**
 * Ibuprofen in CDCl3 at 400 MHz, the same sample processed: `pdata/1` holds the `1r`
 * the spectrometer phased with its own PHC0 79.98 / PHC1 -19.36, next to the `fid` it
 * was computed from. Dropping the directory and dropping the FID alone must therefore
 * land on the same spectrum by two different routes.
 */
const IBUPROFEN_400 = join(DATA, 'ibuprofen-400', '1');

const FID_NOTE =
  'This file holds a FID. It was apodized, zero-filled, Fourier-transformed and phase-corrected automatically — check the spectrum before submitting.';

/**
 * Rebuilds what the browser hands over when a folder is dropped: plain files carrying
 * the path they had inside the dropped directory.
 * @param directory - Directory to load.
 * @param only - Basenames to keep, to simulate a dataset without processed data.
 * @returns The files, with a `path` relative to the directory's parent.
 */
function folderFiles(directory: string, only?: string[]): File[] {
  const root = join(directory, '..');
  const files: File[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (only === undefined || only.includes(entry)) {
        const file = new File([readFileSync(full)], entry);
        Object.defineProperty(file, 'path', { value: relative(root, full) });
        files.push(file);
      }
    }
  };
  walk(directory);
  return files;
}

function fileOf(path: string): File {
  return new File([readFileSync(path)], basename(path));
}

/**
 * Finds the chemical shift of the tallest point of a window.
 * @param spectrum - A normalized spectrum.
 * @param from - Lower bound in ppm.
 * @param to - Upper bound in ppm.
 * @returns The shift of the maximum.
 */
function shiftOfTallestBetween(
  spectrum: NormalizedSpectrum,
  from: number,
  to: number,
): number {
  const { x, y } = spectrum.spectrum;
  let best = 0;
  let bestY = -Infinity;
  for (let i = 0; i < x.length; i++) {
    const shift = x[i] as number;
    if (shift < from || shift > to) continue;
    const intensity = y[i] as number;
    if (intensity > bestY) {
      bestY = intensity;
      best = i;
    }
  }
  return x[best] as number;
}

/**
 * Reads the normalized intensity at a chemical shift.
 * @param spectrum - A normalized spectrum.
 * @param ppm - The shift to sample.
 * @returns The intensity of the nearest grid point.
 */
function intensityAt(spectrum: NormalizedSpectrum, ppm: number): number {
  const { x, y } = spectrum.spectrum;
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < x.length; i++) {
    const distance = Math.abs((x[i] as number) - ppm);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return y[best] as number;
}

test('a JCAMP FID is Fourier-transformed instead of being submitted as-is', async () => {
  const parsed = await parseDroppedFiles([fileOf(ASPIRIN_FID)]);

  expect(parsed.errors).toStrictEqual([]);
  expect(parsed.warnings).toStrictEqual([]);
  expect(parsed.notes).toStrictEqual([FID_NOTE]);
  expect(parsed.meta).toStrictEqual({
    name: '1h.fid',
    nucleus: '1H',
    solvent: 'CDCl3',
    frequency: 300.13,
  });
  expect(parsed.spectrum?.spectrum.y).toHaveLength(10_000);
});

test('the transformed aspirin FID puts the peaks at the right shifts', async () => {
  const parsed = await parseDroppedFiles([fileOf(ASPIRIN_FID)]);
  const spectrum = parsed.spectrum;
  if (spectrum === null) throw new Error('the spectrum failed to parse');

  // Acetyl methyl, the aromatic H3/H4/H5 multiplets and the deshielded H6.
  expect(shiftOfTallestBetween(spectrum, 2, 2.6)).toBeCloseTo(2.29, 1);
  expect(shiftOfTallestBetween(spectrum, 7.2, 7.4)).toBeCloseTo(7.28, 1);
  expect(shiftOfTallestBetween(spectrum, 7.9, 8.2)).toBeCloseTo(8.02, 1);
});

test('a Bruker folder holding only a FID is transformed on load', async () => {
  const files = folderFiles(IBUPROFEN_400, ['acqus', 'fid']);
  expect(files.map((file) => file.name)).toStrictEqual(['acqus', 'fid']);

  const parsed = await parseDroppedFiles(files);

  // Neither file has an extension: they are only readable as a dataset.
  expect(parsed.errors).toStrictEqual([]);
  expect(parsed.warnings).toStrictEqual([]);
  expect(parsed.notes).toStrictEqual([FID_NOTE]);
  expect(parsed.meta?.name).toBe('1');
  expect(parsed.meta?.frequency).toBe(400.13);
});

test('a FID whose stored phase is wrong is phased by the automatic correction', async () => {
  const parsed = await parseDroppedFiles(folderFiles(IBUPROFEN));

  expect(parsed.errors).toStrictEqual([]);
  expect(parsed.warnings).toStrictEqual([]);
  // Applying the stored PHC0/PHC1 leaves a trough half the height of every peak, which
  // used to send this spectrum through the magnitude fallback.
  expect(parsed.notes).toStrictEqual([FID_NOTE]);
  expect(parsed.meta).toStrictEqual({
    name: '1',
    nucleus: '1H',
    solvent: 'CDCl3',
    frequency: 300.159,
  });
});

test('the phased ibuprofen FID puts every multiplet at its shift', async () => {
  const parsed = await parseDroppedFiles(folderFiles(IBUPROFEN));
  const spectrum = parsed.spectrum;
  if (spectrum === null) throw new Error('the spectrum failed to parse');

  // The isopropyl methyls, the methyl doublet, the isopropyl methine, the benzylic
  // CH2, the CH alpha to the acid, and both halves of the aromatic AA'BB'.
  expect(shiftOfTallestBetween(spectrum, 0.7, 1.1)).toBeCloseTo(0.934, 2);
  expect(shiftOfTallestBetween(spectrum, 1.4, 1.7)).toBeCloseTo(1.537, 2);
  expect(shiftOfTallestBetween(spectrum, 1.7, 2)).toBeCloseTo(1.87, 2);
  expect(shiftOfTallestBetween(spectrum, 2.3, 2.6)).toBeCloseTo(2.461, 2);
  expect(shiftOfTallestBetween(spectrum, 3.5, 3.9)).toBeCloseTo(3.722, 2);
  expect(shiftOfTallestBetween(spectrum, 7.05, 7.2)).toBeCloseTo(7.14, 2);
  expect(shiftOfTallestBetween(spectrum, 7.2, 7.35)).toBeCloseTo(7.235, 2);

  // Absorption mode, not dispersion: the empty regions on both sides of the CH quartet
  // sit on the floor of the rescaled range.
  expect(intensityAt(spectrum, 5)).toBeLessThan(0.005);
  expect(intensityAt(spectrum, 6)).toBeLessThan(0.005);
});

/** The seven multiplets of ibuprofen, from the isopropyl methyls to the aromatics. */
const IBUPROFEN_WINDOWS = [
  [0.8, 1.05],
  [1.4, 1.6],
  [1.75, 2],
  [2.3, 2.6],
  [3.6, 3.85],
  [7, 7.15],
  [7.15, 7.3],
] as const;

test('the processed spectrum is taken as it is, not recomputed from the FID', async () => {
  const parsed = await parseDroppedFiles(folderFiles(IBUPROFEN_400));
  const spectrum = parsed.spectrum;
  if (spectrum === null) throw new Error('the spectrum failed to parse');

  expect(parsed.errors).toStrictEqual([]);
  expect(parsed.warnings).toStrictEqual([]);
  // The FID sits in the same directory; the note is what a transform here would add.
  expect(parsed.notes).toStrictEqual([]);
  expect(parsed.meta).toStrictEqual({
    name: '1',
    nucleus: '1H',
    solvent: 'CDCl3',
    frequency: 400.13,
  });

  const shifts = IBUPROFEN_WINDOWS.map(([from, to]) =>
    shiftOfTallestBetween(spectrum, from, to),
  );
  expect(shifts.map((shift) => Number(shift.toFixed(3)))).toStrictEqual([
    0.915, 1.533, 1.87, 2.463, 3.725, 7.137, 7.236,
  ]);
});

test('transforming that FID lands on the spectrum the spectrometer processed', async () => {
  const processed = await parseDroppedFiles(folderFiles(IBUPROFEN_400));
  const transformed = await parseDroppedFiles(
    folderFiles(IBUPROFEN_400, ['acqus', 'fid']),
  );
  if (processed.spectrum === null || transformed.spectrum === null) {
    throw new Error('a spectrum failed to parse');
  }

  expect(transformed.errors).toStrictEqual([]);
  expect(transformed.notes).toStrictEqual([FID_NOTE]);
  expect(transformed.meta).toStrictEqual(processed.meta);

  // Apodization and phasing are ours, not the operator's, so the multiplets land near
  // rather than exactly on theirs: 0.02 ppm is 8 Hz at 400 MHz.
  for (const [from, to] of IBUPROFEN_WINDOWS) {
    const shift = shiftOfTallestBetween(transformed.spectrum, from, to);
    const reference = shiftOfTallestBetween(processed.spectrum, from, to);
    expect(Math.abs(shift - reference)).toBeLessThan(0.02);
  }

  // Both are absorption mode, so the empty window between them sits on the floor.
  expect(intensityAt(transformed.spectrum, 5)).toBeLessThan(0.005);
  expect(intensityAt(processed.spectrum, 5)).toBeLessThan(0.005);
});

test('a residual group delay does not leave whole multiplets pointing down', async () => {
  const parsed = await parseDroppedFiles(
    folderFiles(IBUPROFEN_600, ['acqus', 'fid']),
  );
  const spectrum = parsed.spectrum;
  if (spectrum === null) throw new Error('the spectrum failed to parse');

  expect(parsed.errors).toStrictEqual([]);
  expect(parsed.notes).toStrictEqual([FID_NOTE]);
  expect(parsed.meta).toStrictEqual({
    name: '1',
    nucleus: '1H',
    solvent: 'CDCl3',
    frequency: 600.13,
  });

  // The isopropyl methyls, the methyl doublet, the isopropyl methine, the benzylic
  // CH2, the CH alpha to the acid, and both halves of the aromatic AA'BB'.
  expect(shiftOfTallestBetween(spectrum, 0.8, 1.05)).toBeCloseTo(0.916, 2);
  expect(shiftOfTallestBetween(spectrum, 1.4, 1.6)).toBeCloseTo(1.518, 2);
  expect(shiftOfTallestBetween(spectrum, 1.75, 2)).toBeCloseTo(1.868, 2);
  expect(shiftOfTallestBetween(spectrum, 2.3, 2.6)).toBeCloseTo(2.466, 2);
  expect(shiftOfTallestBetween(spectrum, 3.6, 3.85)).toBeCloseTo(3.728, 2);
  expect(shiftOfTallestBetween(spectrum, 7.05, 7.18)).toBeCloseTo(7.137, 2);
  expect(shiftOfTallestBetween(spectrum, 7.18, 7.3)).toBeCloseTo(7.241, 2);

  // The first order angle this FID needs is about -1200 degrees over the sweep, far
  // outside what the automatic correction searches: with only its answer applied, the
  // CH2 and the CH quartet came out inverted while their neighbours stayed upright.
  const baseline = intensityAt(spectrum, 5);
  expect(baseline).toBeLessThan(0.01);
  expect(intensityAt(spectrum, 2.466)).toBeGreaterThan(baseline * 10);
  expect(intensityAt(spectrum, 3.728)).toBeGreaterThan(baseline * 10);
});

test('a probe wobble curve stored in pdata is not read as the spectrum', async () => {
  const whole = await parseDroppedFiles(folderFiles(IBUPROFEN_600));
  const fidOnly = await parseDroppedFiles(
    folderFiles(IBUPROFEN_600, ['acqus', 'fid']),
  );
  if (whole.spectrum === null || fidOnly.spectrum === null) {
    throw new Error('a spectrum failed to parse');
  }

  // `pdata/700` is a 20 MHz tuning sweep, so the FID stays the only spectrum of the
  // dataset and the whole directory reads exactly like the two files it is built from.
  expect(whole.errors).toStrictEqual([]);
  expect(whole.warnings).toStrictEqual([]);
  expect(whole.notes).toStrictEqual([FID_NOTE]);
  expect(whole.meta).toStrictEqual(fidOnly.meta);
  expect(whole.spectrum.spectrum.y).toStrictEqual(fidOnly.spectrum.spectrum.y);
  expect(shiftOfTallestBetween(whole.spectrum, 0.8, 1.05)).toBeCloseTo(
    0.916,
    2,
  );
});

test('a stray file next to a dataset is read with it rather than rejected', async () => {
  const files = folderFiles(IBUPROFEN_400, ['acqus', 'fid']);
  const stray = new File(['scan 1'], 'audita.txt');
  Object.defineProperty(stray, 'path', { value: '1/audita.txt' });

  const parsed = await parseDroppedFiles([...files, stray]);

  expect(parsed.errors).toStrictEqual([]);
  expect(parsed.meta?.name).toBe('1');
});
