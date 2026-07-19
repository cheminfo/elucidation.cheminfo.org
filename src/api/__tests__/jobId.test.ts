import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { parseDroppedFiles } from '../../spectrum/parseFiles.ts';
import { computeJobId } from '../jobId.ts';

const ETHYL_VINYL_ETHER = join(
  import.meta.dirname,
  '..',
  '..',
  'spectrum',
  '__tests__',
  'data',
  'ethylvinylether',
  '1h.jdx',
);

test('the job id reproduces the identifier the server derived for a real run', async () => {
  // Verified against the live API: submitting this spectrum returned exactly this
  // job_id. If the normalization ever changes, this fails — which is the point, since
  // the id is the server's cache key and a drift silently orphans every stored run.
  const file = new File([readFileSync(ETHYL_VINYL_ETHER)], '1h.jdx');
  const parsed = await parseDroppedFiles([file]);
  if (parsed.spectrum === null) throw new Error('the spectrum failed to parse');

  await expect(computeJobId(parsed.spectrum.spectrum.y)).resolves.toBe(
    'd2cc7dd964d5defb38819a3717c33875',
  );
});

test('the id is 32 hex characters, as the server truncates it', async () => {
  const id = await computeJobId([1, 2, 3]);

  expect(id).toHaveLength(32);
  expect(id).toMatch(/^[0-9a-f]{32}$/);
});

test('the id depends only on the intensities, and on every one of them', async () => {
  const base = [0.1, 0.2, 0.3];
  const same = await computeJobId([0.1, 0.2, 0.3]);
  const nudged = await computeJobId([0.1, 0.2, 0.300_000_1]);

  await expect(computeJobId(base)).resolves.toBe(same);
  expect(nudged).not.toBe(same);
});
