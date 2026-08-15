import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

import { expect, test } from 'vitest';

import type { NormalizedSpectrum } from '../normalize.ts';
import { parseDroppedFiles } from '../parseFiles.ts';

const DATA = join(import.meta.dirname, 'data');
/** Aspirin in CDCl3 at 300 MHz, time domain (jcamp-data-test, MIT). */
const ASPIRIN_FID = join(DATA, 'aspirin', '1h.fid.dx');
/** One Bruker experiment: acqus + fid + pdata/1 (bruker-data-test, MIT). */
const BRUKER = join(DATA, 'coffee', '20');
/**
 * Ibuprofen in CDCl3 at 300 MHz, never processed: `pdata/1` holds a `procs` but no
 * spectrum, and the PHC0/PHC1 stored there phase the transformed FID into a dispersive
 * line shape. Only the automatic phase correction recovers it.
 */
const IBUPROFEN = join(DATA, 'ibuprofen', '1');

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

test('a Bruker folder is read through its processed data, not its FID', async () => {
  const parsed = await parseDroppedFiles(folderFiles(BRUKER));

  expect(parsed.errors).toStrictEqual([]);
  expect(parsed.warnings).toStrictEqual([]);
  // The FID is in the drop too, but pdata is what the spectrometer already phased.
  expect(parsed.notes).toStrictEqual([]);
  expect(parsed.meta).toStrictEqual({
    name: '20',
    nucleus: '1H',
    solvent: 'COFFEE_calctemp',
    frequency: 400.13,
  });
  expect(parsed.spectrum?.spectrum.y).toHaveLength(10_000);
});

test('a Bruker folder holding only a FID is transformed on load', async () => {
  const files = folderFiles(BRUKER, ['acqus', 'fid']);
  expect(files.map((file) => file.name)).toStrictEqual(['acqus', 'fid']);

  const parsed = await parseDroppedFiles(files);

  // Neither file has an extension: they are only readable as a dataset.
  expect(parsed.errors).toStrictEqual([]);
  expect(parsed.warnings).toStrictEqual([]);
  expect(parsed.notes).toStrictEqual([FID_NOTE]);
  expect(parsed.meta?.name).toBe('20');
  expect(parsed.meta?.frequency).toBe(400.13);
});

test('transforming the FID reproduces the spectrometer-processed spectrum', async () => {
  const processed = await parseDroppedFiles(folderFiles(BRUKER));
  const transformed = await parseDroppedFiles(
    folderFiles(BRUKER, ['acqus', 'fid']),
  );
  if (processed.spectrum === null || transformed.spectrum === null) {
    throw new Error('a spectrum failed to parse');
  }

  // Apodization and phasing are not the operator's own choices, so the peaks land near
  // rather than exactly on theirs: 0.02 ppm is 8 Hz at 400 MHz.
  for (const [from, to] of [
    [3.3, 3.45],
    [4.85, 4.95],
  ] as const) {
    const shift = shiftOfTallestBetween(transformed.spectrum, from, to);
    expect(shift).toBeCloseTo(
      shiftOfTallestBetween(processed.spectrum, from, to),
      2,
    );
  }

  // An empty region stays near the bottom of the rescaled range instead of floating a
  // quarter of the way up it, which is where a dispersive line shape would put it.
  expect(intensityAt(transformed.spectrum, 7)).toBeLessThan(0.06);
  expect(intensityAt(processed.spectrum, 7)).toBeLessThan(0.01);
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

test('a stray file next to a dataset is read with it rather than rejected', async () => {
  const files = folderFiles(BRUKER, ['acqus', 'fid']);
  const stray = new File(['scan 1'], 'audita.txt');
  Object.defineProperty(stray, 'path', { value: '20/audita.txt' });

  const parsed = await parseDroppedFiles([...files, stray]);

  expect(parsed.errors).toStrictEqual([]);
  expect(parsed.meta?.name).toBe('20');
});
