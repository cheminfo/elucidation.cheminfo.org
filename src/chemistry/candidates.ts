import { CanonizerUtil, Molecule } from 'openchemlib';

import type { ApiCandidate } from '../api/types.ts';
import { candidateFormula } from '../api/types.ts';

import { canonicalMf } from './formula.ts';

export interface RankedCandidate {
  smiles: string;
  score: number;
  mf: string;
  idCode: string;
  noStereoIDCode: string;
  /**
   * True when the molecule came from the retrieval step, false when the genetic
   * algorithm proposed it, and null when the source did not record it.
   */
  retrieved: boolean | null;
  /** 1-based rank within the formula-matching candidates. */
  rank: number;
  /** True when this is the known answer, compared ignoring stereochemistry. */
  isExpected: boolean;
}

export interface RankedCandidates {
  candidates: RankedCandidate[];
  /**
   * Whether the source recorded where each candidate came from. The published
   * challenge dataset does not, so provenance must not be shown for it.
   */
  hasProvenance: boolean;
  /** 0-based index of the expected structure, or -1 when absent or unknown. */
  positionNoStereo: number;
  /** Candidates dropped because their formula did not match the query. */
  rejectedCount: number;
}

/**
 * Filters candidates to those matching the query formula, ranks them by score and
 * locates the known answer.
 *
 * The model returns candidates whose formula can differ from the one submitted, since
 * the formula only enters the fitness function as a penalty. Those are dropped, so a
 * rank shown to the user is always a rank among chemically admissible structures.
 * Matching against the expected structure ignores stereochemistry, because the method
 * is not evaluated on stereo assignment.
 * @param candidates - Raw candidates from the API or the demo dataset.
 * @param queryMf - The molecular formula that was submitted.
 * @param expectedNoStereoIDCode - Stereo-stripped ID code of the known answer, if any.
 * @returns Ranked candidates plus the position of the expected structure.
 */
export function rankCandidates(
  candidates: readonly ApiCandidate[],
  queryMf: string,
  expectedNoStereoIDCode?: string,
): RankedCandidates {
  const target = canonicalMf(queryMf);
  const kept: RankedCandidate[] = [];
  let rejectedCount = 0;

  for (const candidate of candidates) {
    const formula = candidateFormula(candidate);
    if (target !== '' && canonicalMf(formula) !== target) {
      rejectedCount++;
      continue;
    }
    const codes = idCodes(candidate.smiles);
    if (codes === null) {
      rejectedCount++;
      continue;
    }
    kept.push({
      smiles: candidate.smiles,
      score: candidate.score,
      mf: formula,
      idCode: codes.idCode,
      noStereoIDCode: codes.noStereoIDCode,
      retrieved: candidate.retrieved ?? null,
      rank: 0,
      isExpected: false,
    });
  }

  // The live API returns candidates unsorted; the demo dataset returns them sorted.
  kept.sort((a, b) => b.score - a.score);

  let positionNoStereo = -1;
  for (let i = 0; i < kept.length; i++) {
    const candidate = kept[i] as RankedCandidate;
    candidate.rank = i + 1;
    if (
      expectedNoStereoIDCode !== undefined &&
      candidate.noStereoIDCode === expectedNoStereoIDCode
    ) {
      candidate.isExpected = true;
      if (positionNoStereo === -1) positionNoStereo = i;
    }
  }

  const hasProvenance = kept.some((candidate) => candidate.retrieved !== null);

  return { candidates: kept, positionNoStereo, rejectedCount, hasProvenance };
}

/**
 * Computes the canonical ID codes of a structure, with and without stereochemistry.
 * @param smiles - A SMILES string, possibly invalid.
 * @returns Both ID codes, or null when the SMILES cannot be parsed.
 */
export function idCodes(
  smiles: string,
): { idCode: string; noStereoIDCode: string } | null {
  try {
    const molecule = Molecule.fromSmiles(smiles);
    return {
      idCode: molecule.getIDCode(),
      noStereoIDCode: CanonizerUtil.getIDCode(molecule, CanonizerUtil.NOSTEREO),
    };
  } catch {
    return null;
  }
}

/**
 * Derives the molecular formula of a structure, used to prefill the formula field when
 * a reference molfile is dropped.
 *
 * The result is passed through the same canonicalization as user input: openchemlib
 * orders elements differently from mf-parser (`C7H8NCl` against `C7H8ClN`), and an
 * uncanonicalized value would fail to match the candidates' formulas.
 * @param smiles - A SMILES string.
 * @returns The canonical formula, or null when the SMILES cannot be parsed.
 */
export function formulaFromSmiles(smiles: string): string | null {
  try {
    const formula = Molecule.fromSmiles(smiles).getMolecularFormula().formula;
    const canonical = canonicalMf(formula);
    return canonical === '' ? null : canonical;
  } catch {
    return null;
  }
}

/**
 * Computes the ID codes of the known answer from a molfile.
 *
 * Returns null for empty or unparsable input rather than throwing: the prototype called
 * `Molecule.fromMolfile('')` unguarded and threw on every reset.
 * @param molfile - Molfile text, possibly empty.
 * @returns Both ID codes and the SMILES, or null when there is no usable structure.
 */
export function expectedFromMolfile(
  molfile: string,
): { idCode: string; noStereoIDCode: string; smiles: string } | null {
  if (molfile.trim() === '') return null;
  try {
    const molecule = Molecule.fromMolfile(molfile);
    if (molecule.getAllAtoms() === 0) return null;
    return {
      idCode: molecule.getIDCode(),
      noStereoIDCode: CanonizerUtil.getIDCode(molecule, CanonizerUtil.NOSTEREO),
      smiles: molecule.toIsomericSmiles(),
    };
  } catch {
    return null;
  }
}
