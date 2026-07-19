import * as OCL from 'openchemlib';
import { MoleculesDB } from 'openchemlib-utils';
import { useMemo } from 'react';

import type { RankedCandidate } from './candidates.ts';

/**
 * Restricts candidates to those containing a drawn substructure.
 *
 * The molecule database is rebuilt only when the candidate list itself changes, so
 * editing the query re-searches without re-parsing every SMILES — the same optimisation
 * the prototype made, kept here because a run can return several hundred candidates.
 * @param candidates - The ranked candidates.
 * @param queryIdCode - OCL id code of the drawn query, empty when there is none.
 * @returns The set of candidate id codes matching the query, or null when inactive.
 */
export function useSubstructureMatches(
  candidates: readonly RankedCandidate[],
  queryIdCode: string,
): ReadonlySet<string> | null {
  const database = useMemo(() => {
    if (candidates.length === 0) return null;
    const db = new MoleculesDB(OCL, {
      computeProperties: false,
      keepEmptyMolecules: false,
    });
    for (const candidate of candidates) {
      try {
        db.pushEntry(OCL.Molecule.fromSmiles(candidate.smiles), candidate);
      } catch {
        // A candidate whose SMILES openchemlib cannot parse simply cannot be searched.
      }
    }
    return db;
  }, [candidates]);

  return useMemo(() => {
    if (database === null || queryIdCode === '') return null;
    try {
      const hits = database.search(queryIdCode, {
        mode: 'substructure',
        format: 'idCode',
        flattenResult: true,
      }) as Array<{ data?: RankedCandidate }>;
      const matched = new Set<string>();
      for (const hit of hits) {
        if (hit.data !== undefined) matched.add(hit.data.idCode);
      }
      return matched;
    } catch {
      return null;
    }
  }, [database, queryIdCode]);
}
