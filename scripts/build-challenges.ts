/**
 * Regenerates `public/challenges/` from the upstream challenge dataset.
 *
 * The upstream file is a single 12.7 MB JSON array whose 20 entries each embed a
 * 10 000-point spectrum. Two thirds of it is waste: the ppm axis is byte-identical in
 * every entry (it is the fixed grid the model requires) and is regenerated in code by
 * `ppmAxis()`, never shipped.
 *
 * Output:
 *   public/challenges/index.json  - all metadata + candidates, loaded eagerly
 *   public/challenges/<id>.json   - {y: number[]} only, fetched when a challenge opens
 *
 * Run with `npm run build-challenges` and commit the result.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { PPM_FROM, PPM_POINTS, PPM_TO } from '../src/spectrum/grid.ts';

const SOURCE_URL =
  'https://data.cheminfo.org/kevin/challenge/2025-08-14_full_challenges.json';

/** Intensities are rescaled to 0..1, so six decimals is well below plot resolution. */
const Y_DECIMALS = 6;

const outputDirectory = join(import.meta.dirname, '..', 'public', 'challenges');

await buildChallenges();

async function buildChallenges(): Promise<void> {
  process.stdout.write(`Fetching ${SOURCE_URL}\n`);
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch challenges: HTTP ${response.status}`);
  }
  const challenges = (await response.json()) as UpstreamChallenge[];
  process.stdout.write(`Received ${challenges.length} challenges\n`);

  rmSync(outputDirectory, { recursive: true, force: true });
  mkdirSync(outputDirectory, { recursive: true });

  const index: IndexEntry[] = [];

  for (const challenge of challenges) {
    assertCanonicalGrid(challenge);

    // Upstream stores the axis descending (10 -> -2). Everything downstream works on
    // the ascending canonical grid, so reverse y once here rather than in the browser.
    const ascendingY = challenge.result.data.y.toReversed();
    const y = new Array<number>(ascendingY.length);
    for (let i = 0; i < ascendingY.length; i++) {
      y[i] = round(ascendingY[i] as number);
    }

    writeFileSync(
      join(outputDirectory, `${challenge.id}.json`),
      JSON.stringify({ y }),
    );

    index.push({
      id: challenge.id,
      smiles: challenge.expected_smiles,
      mf: challenge.mf,
      source: challenge.model,
      idCode: challenge.idCode,
      noStereoIDCode: challenge.noStereoIDCode,
      nbHydrogens: challenge.nbHydrogens,
      heavyAtoms: challenge.heavyAtoms,
      monoisotopicMass: challenge.mfInfo.monoisotopicMass,
      unsaturation: challenge.mfInfo.unsaturation,
      positionNoStereo: challenge.positionNoStereo,
      candidates: challenge.result.candidates,
    });
  }

  writeFileSync(join(outputDirectory, 'index.json'), JSON.stringify(index));

  const solved = index.filter((entry) => entry.positionNoStereo >= 0).length;
  process.stdout.write(
    `Wrote ${index.length} challenges to public/challenges (${solved} solved)\n`,
  );
}

function assertCanonicalGrid(challenge: UpstreamChallenge): void {
  const { x, y } = challenge.result.data;
  if (x.length !== PPM_POINTS || y.length !== PPM_POINTS) {
    throw new Error(
      `Challenge ${challenge.id}: expected ${PPM_POINTS} points, got ${x.length}/${y.length}`,
    );
  }
  if (x[0] !== PPM_TO || x.at(-1) !== PPM_FROM) {
    throw new Error(
      `Challenge ${challenge.id}: expected a descending ${PPM_TO}..${PPM_FROM} axis, got ${x[0]}..${x.at(-1)}`,
    );
  }
}

function round(value: number): number {
  return Number(value.toFixed(Y_DECIMALS));
}

interface UpstreamChallenge {
  id: string;
  expected_smiles: string;
  mf: string;
  model: string;
  idCode: string;
  noStereoIDCode: string;
  nbHydrogens: number;
  heavyAtoms: number;
  positionNoStereo: number;
  mfInfo: { monoisotopicMass: number; unsaturation: number };
  result: {
    data: { x: number[]; y: number[] };
    candidates: unknown[];
  };
}

interface IndexEntry {
  id: string;
  smiles: string;
  mf: string;
  source: string;
  idCode: string;
  noStereoIDCode: string;
  nbHydrogens: number;
  heavyAtoms: number;
  monoisotopicMass: number;
  unsaturation: number;
  positionNoStereo: number;
  candidates: unknown[];
}
