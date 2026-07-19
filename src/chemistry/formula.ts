import { MF, ensureCase } from 'mf-parser';

export interface FormulaInfo {
  mf: string;
  monoisotopicMass: number;
  mass: number;
  unsaturation: number;
  charge: number;
  atoms: Record<string, number>;
}

/**
 * Canonicalizes a molecular formula so two spellings of the same composition compare equal.
 *
 * Used both to filter candidates and to detect that a cached job was computed for a
 * different formula, so it must be tolerant of user input: `c9h6n4`, `C9H6N4` and
 * `N4C9H6` all collapse to `C9H6N4`.
 * @param input - A formula as typed by a user or returned by the API.
 * @returns The canonical formula, or an empty string when it cannot be parsed.
 */
export function canonicalMf(input: string): string {
  const trimmed = input.trim();
  if (trimmed === '') return '';
  try {
    return new MF(ensureCase(trimmed)).toMF();
  } catch {
    return '';
  }
}

/**
 * Derives mass, unsaturation and atom counts from a formula, for the input summary card.
 * @param input - A formula as typed by a user.
 * @returns Parsed information, or null when the formula is invalid.
 */
export function formulaInfo(input: string): FormulaInfo | null {
  const canonical = canonicalMf(input);
  if (canonical === '') return null;
  try {
    const info = new MF(canonical).getInfo();
    return {
      mf: canonical,
      monoisotopicMass: info.monoisotopicMass,
      mass: info.mass,
      unsaturation: info.unsaturation ?? 0,
      charge: info.charge,
      atoms: info.atoms,
    };
  } catch {
    return null;
  }
}

/**
 * Number of hydrogens in a formula, shown next to the spectrum as a sanity check
 * against the integral.
 * @param input - A formula as typed by a user.
 * @returns The hydrogen count, or null when the formula is invalid.
 */
export function hydrogenCount(input: string): number | null {
  const info = formulaInfo(input);
  if (info === null) return null;
  return info.atoms.H ?? 0;
}
