import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import type { ApiCandidate } from '../../api/types.ts';
import {
  expectedFromMolfile,
  formulaFromSmiles,
  idCodes,
  rankCandidates,
} from '../candidates.ts';
import { canonicalMf, formulaInfo, hydrogenCount } from '../formula.ts';

interface ChallengeFixture {
  id: string;
  mf: string;
  smiles: string;
  noStereoIDCode: string;
  positionNoStereo: number;
  candidates: ApiCandidate[];
}

const CHALLENGES = JSON.parse(
  readFileSync(
    join(
      import.meta.dirname,
      '..',
      '..',
      '..',
      'public',
      'challenges',
      'index.json',
    ),
    'utf8',
  ),
) as ChallengeFixture[];

test('canonicalMf normalizes spelling, case and ordering', () => {
  expect(canonicalMf('C9H6N4')).toBe('C9H6N4');
  expect(canonicalMf('c9h6n4')).toBe('C9H6N4');
  expect(canonicalMf('  C9H6N4 ')).toBe('C9H6N4');
  expect(canonicalMf('N4C9H6')).toBe('C9H6N4');
});

test('canonicalMf returns an empty string for unusable input', () => {
  expect(canonicalMf('')).toBe('');
  expect(canonicalMf('not a formula!!')).toBe('');
});

test('formulaInfo reports mass, unsaturation and atom counts', () => {
  const info = formulaInfo('c9h6n4');
  expect(info).toStrictEqual({
    mf: 'C9H6N4',
    mass: 170.17108044073507,
    monoisotopicMass: 170.0592462111,
    unsaturation: 9,
    charge: 0,
    atoms: { C: 9, H: 6, N: 4 },
  });
  expect(hydrogenCount('C12H16O3')).toBe(16);
  expect(formulaInfo('garbage!')).toBeNull();
});

test('idCodes are stereo-aware and stereo-stripped', () => {
  const chiral = idCodes('C[C@H](N)C(=O)O');
  const inverted = idCodes('C[C@@H](N)C(=O)O');
  expect(chiral).not.toBeNull();
  expect(inverted).not.toBeNull();
  expect(chiral?.idCode).not.toBe(inverted?.idCode);
  expect(chiral?.noStereoIDCode).toBe(inverted?.noStereoIDCode);
});

test('idCodes returns null instead of throwing on invalid SMILES', () => {
  expect(idCodes('this is not smiles')).toBeNull();
  expect(formulaFromSmiles('also not smiles')).toBeNull();
});

test('formulaFromSmiles derives the formula used to prefill the input', () => {
  expect(formulaFromSmiles('NCc1ccc(Cl)cc1')).toBe('C7H8ClN');
});

test('expectedFromMolfile tolerates empty input', () => {
  expect(expectedFromMolfile('')).toBeNull();
  expect(expectedFromMolfile(' '.repeat(3))).toBeNull();
  expect(expectedFromMolfile('not a molfile')).toBeNull();
});

test('candidates not matching the formula are rejected', () => {
  const candidates: ApiCandidate[] = [
    { smiles: 'NCc1ccc(Cl)cc1', score: 0.5, molecular_formula: 'C7H8ClN' },
    { smiles: 'CCCCCC', score: 0.9, molecular_formula: 'C6H14' },
  ];
  const ranked = rankCandidates(candidates, 'C7H8ClN');

  expect(ranked.candidates).toHaveLength(1);
  expect(ranked.rejectedCount).toBe(1);
  expect(ranked.candidates[0]?.smiles).toBe('NCc1ccc(Cl)cc1');
  expect(ranked.candidates[0]?.rank).toBe(1);
});

test('candidates are ranked by descending score regardless of input order', () => {
  const candidates: ApiCandidate[] = [
    { smiles: 'Cc1ccc(N)c(Cl)c1', score: 0.2, mf: 'C7H8ClN' },
    { smiles: 'NCc1ccc(Cl)cc1', score: 0.8, mf: 'C7H8ClN' },
  ];
  const ranked = rankCandidates(candidates, 'C7H8ClN');

  expect(ranked.candidates.map((item) => item.rank)).toStrictEqual([1, 2]);
  expect(ranked.candidates[0]?.score).toBe(0.8);
});

test('the expected structure is matched ignoring stereochemistry', () => {
  const expected = idCodes('C[C@H](N)C(=O)O');
  const candidates: ApiCandidate[] = [
    { smiles: 'CCC(N)C(=O)O', score: 0.9, mf: 'C4H9NO2' },
    { smiles: 'C[C@@H](N)C(=O)O', score: 0.5, mf: 'C3H7NO2' },
  ];
  const ranked = rankCandidates(
    candidates,
    'C3H7NO2',
    expected?.noStereoIDCode,
  );

  expect(ranked.candidates).toHaveLength(1);
  expect(ranked.positionNoStereo).toBe(0);
  expect(ranked.candidates[0]?.isExpected).toBe(true);
});

test('positionNoStereo is -1 when the answer is absent', () => {
  const ranked = rankCandidates(
    [{ smiles: 'NCc1ccc(Cl)cc1', score: 0.5, mf: 'C7H8ClN' }],
    'C7H8ClN',
    idCodes('CCCCCC')?.noStereoIDCode,
  );
  expect(ranked.positionNoStereo).toBe(-1);
});

test('ranking reproduces the published rank for every reference challenge', () => {
  expect(CHALLENGES).toHaveLength(20);
  for (const challenge of CHALLENGES) {
    const ranked = rankCandidates(
      challenge.candidates,
      challenge.mf,
      challenge.noStereoIDCode,
    );
    expect(
      ranked.positionNoStereo,
      `challenge ${challenge.mf} (${challenge.id})`,
    ).toBe(challenge.positionNoStereo);
  }
});

test('exactly 10 of the 20 reference challenges were solved', () => {
  const solved = CHALLENGES.filter((item) => item.positionNoStereo >= 0);
  expect(solved).toHaveLength(10);
  expect(CHALLENGES.filter((item) => item.positionNoStereo === 0)).toHaveLength(
    6,
  );
});

test('provenance is reported as unknown when the source does not record it', () => {
  // The published challenge dataset carries no `retrieved` field, so a candidate must
  // not be presented as algorithm-generated just because the flag is missing.
  const ranked = rankCandidates(
    [{ smiles: 'NCc1ccc(Cl)cc1', score: 0.5, mf: 'C7H8ClN' }],
    'C7H8ClN',
  );

  expect(ranked.hasProvenance).toBe(false);
  expect(ranked.candidates[0]?.retrieved).toBeNull();
});

test('provenance is carried through when the API reports it', () => {
  const ranked = rankCandidates(
    [
      {
        smiles: 'NCc1ccc(Cl)cc1',
        score: 0.8,
        molecular_formula: 'C7H8ClN',
        retrieved: true,
      },
      {
        smiles: 'Cc1ccc(N)c(Cl)c1',
        score: 0.5,
        molecular_formula: 'C7H8ClN',
        retrieved: false,
      },
    ],
    'C7H8ClN',
  );

  expect(ranked.hasProvenance).toBe(true);
  expect(ranked.candidates[0]?.retrieved).toBe(true);
  expect(ranked.candidates[1]?.retrieved).toBe(false);
});

test('none of the 20 reference challenges records provenance', () => {
  // Pins the fact behind the hidden filter: if the dataset ever gains the field, this
  // fails and the interface should start offering the filter again.
  for (const challenge of CHALLENGES) {
    const ranked = rankCandidates(challenge.candidates, challenge.mf);
    expect(ranked.hasProvenance, `challenge ${challenge.mf}`).toBe(false);
  }
});
