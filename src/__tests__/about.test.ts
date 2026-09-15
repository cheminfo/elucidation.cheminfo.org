import { aboutProblems, resolveAbout } from 'react-cheminfo/core';
import { expect, test } from 'vitest';

import { ABOUT } from '../about.ts';

test('the record says what the family checks it says', () => {
  expect(aboutProblems(ABOUT)).toStrictEqual([]);
});

test('what a visitor is told they can do is the five things the site does', () => {
  expect(ABOUT.siteId).toBe('elucidation');
  expect(ABOUT.can).toHaveLength(5);
  expect(ABOUT.can[0]).toBe(
    'Drop a JCAMP-DX file or a Bruker or Varian folder — a FID is transformed for you.',
  );
  expect(ABOUT.paragraphs).toHaveLength(1);
});

test('every borrowed work the site runs on is named, and named once', () => {
  expect(ABOUT.credits).toStrictEqual([
    'openchemlib',
    'openchemlib-utils',
    'react-ocl',
    'react-mf',
    'mass-tools',
    'ml-spectra-processing',
    'blueprint',
    'react-science',
    'react-cheminfo',
    'react',
    'vite',
  ]);
  expect(new Set(ABOUT.credits).size).toBe(ABOUT.credits.length);
});

test('the record resolves against the shared registries', () => {
  const about = resolveAbout(ABOUT);

  expect(about.site.host).toBe('elucidation.cheminfo.org');
  expect(about.license).toBe('MIT');
  expect(about.repository).toBe(
    'https://github.com/cheminfo/elucidation.cheminfo.org',
  );
  expect(about.issues).toBe(
    'https://github.com/cheminfo/elucidation.cheminfo.org/issues',
  );
  expect(about.credits.map((entry) => entry.name)).toStrictEqual([
    'OpenChemLib',
    'openchemlib-utils',
    'react-ocl',
    'react-mf',
    'mass-tools',
    'ml-spectra-processing',
    'Blueprint',
    'react-science',
    'react-cheminfo',
    'React',
    'Vite',
  ]);
});

test('the platform paper, then the SECS paper, are the works it asks to be cited', () => {
  const cite = ABOUT.cite ?? [];

  expect(cite).toHaveLength(2);
  expect(cite[0]?.reference.doi).toBe('10.2533/chimia.2025.66');
  expect(cite[1]?.reference.doi).toBe('10.1038/s41467-026-73846-y');
  expect(cite[1]?.reference.journal).toBe('Nature Communications');
  expect(cite[1]?.what).toBe('SECS');
});

test('the context paragraph keeps the three stages of the method', () => {
  const [method] = ABOUT.paragraphs ?? [];

  expect(method).toContain('contrastive');
  expect(method).toContain('PubChem');
  expect(method).toContain('genetic algorithm');
});
