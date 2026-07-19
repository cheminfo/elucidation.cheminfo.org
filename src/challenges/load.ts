import type { ApiCandidate } from '../api/types.ts';
import { PPM_POINTS, ppmAxis } from '../spectrum/grid.ts';

export interface ChallengeSummary {
  id: string;
  /** SMILES of the true structure. */
  smiles: string;
  mf: string;
  /** Where the reference dataset came from. */
  source: string;
  idCode: string;
  noStereoIDCode: string;
  nbHydrogens: number;
  heavyAtoms: number;
  monoisotopicMass: number;
  unsaturation: number;
  /** Rank of the correct answer in the published run, -1 when it was not found. */
  positionNoStereo: number;
  candidates: ApiCandidate[];
}

const BASE_PATH = 'challenges';

let indexPromise: Promise<ChallengeSummary[]> | null = null;
const spectrumCache = new Map<string, Float64Array>();

/**
 * Loads the challenge index.
 *
 * The index carries every challenge's metadata and its full candidate list but no
 * spectra, so the gallery renders from a single small request. Cached for the session.
 * @returns All challenges, in dataset order.
 */
export async function loadChallengeIndex(): Promise<ChallengeSummary[]> {
  indexPromise ??= fetchJson<ChallengeSummary[]>(`${BASE_PATH}/index.json`);
  return indexPromise;
}

/**
 * Loads one challenge's intensities.
 *
 * Spectra are stored one file per challenge and fetched only when a challenge is
 * opened. The ppm axis is not stored: it is the fixed grid, identical for every entry.
 * @param id - The challenge id.
 * @returns The spectrum on the canonical ascending grid.
 */
export async function loadChallengeSpectrum(
  id: string,
): Promise<{ x: Float64Array; y: Float64Array }> {
  const cached = spectrumCache.get(id);
  if (cached !== undefined) return { x: ppmAxis(), y: cached };

  const { y } = await fetchJson<{ y: number[] }>(`${BASE_PATH}/${id}.json`);
  if (y.length !== PPM_POINTS) {
    throw new Error(
      `Challenge ${id}: expected ${PPM_POINTS} intensities, got ${y.length}`,
    );
  }
  const values = Float64Array.from(y);
  spectrumCache.set(id, values);
  return { x: ppmAxis(), y: values };
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Could not load ${path}: HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}
