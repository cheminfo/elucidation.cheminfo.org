import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { countStoredRuns, dropFiles, readStoredRun } from './helpers.ts';

const CANDIDATES = [
  { smiles: 'N#Cc1ccc(-n2ccnn2)cc1', score: 0.7, molecular_formula: 'C9H6N4' },
  {
    smiles: 'N#Cc1ccc(-c2c[nH]nn2)cc1',
    score: 0.6,
    molecular_formula: 'C9H6N4',
  },
];

/** A spectrum on the canonical grid, so a restored run can be replotted. */
function spectrum(): { x: number[]; y: number[] } {
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < 10_000; i++) {
    x.push(-2 + (12 * i) / 9999);
    y.push(i === 5000 ? 1 : 0.001);
  }
  return { x, y };
}

interface SeedRun {
  jobId: string;
  mf: string;
  state: string;
  withResult: boolean;
  withSpectrum: boolean;
}

/**
 * Writes runs straight into IndexedDB, which is where the app now keeps its history.
 * Uses the same database name, version and key path as `src/state/runsDb.ts`.
 */
async function seedRuns(page: Page, seeds: SeedRun[]): Promise<void> {
  await page.addInitScript(
    (payload: { seeds: SeedRun[]; spectrum: { x: number[]; y: number[] } }) => {
      const open = indexedDB.open('elucidation', 1);
      open.addEventListener('upgradeneeded', () => {
        const store = open.result.createObjectStore('runs', {
          keyPath: 'jobId',
        });
        store.createIndex('submittedAt', 'submittedAt');
      });
      open.addEventListener('success', () => {
        const tx = open.result.transaction('runs', 'readwrite');
        const store = tx.objectStore('runs');
        for (const [index, seed] of payload.seeds.entries()) {
          store.put({
            jobId: seed.jobId,
            request: {
              mf: seed.mf,
              spectrum: seed.withSpectrum ? payload.spectrum : { x: [], y: [] },
              model: 'residual',
              seed: 42,
              gens_ga: 10,
              pop_ga: 512,
              offspring_ga: 1024,
              frac_graph_ga_mutate: 0.3,
            },
            submitResponse: {
              job_id: seed.jobId,
              task_id: `task-${seed.jobId}`,
              status: 'submitted',
            },
            status: null,
            resultPayload: seed.withResult
              ? {
                  results: [
                    {
                      smiles: 'N#Cc1ccc(-n2ccnn2)cc1',
                      score: 0.7,
                      molecular_formula: 'C9H6N4',
                    },
                    {
                      smiles: 'N#Cc1ccc(-c2c[nH]nn2)cc1',
                      score: 0.6,
                      molecular_formula: 'C9H6N4',
                    },
                  ],
                }
              : null,
            expected: null,
            meta: null,
            state: seed.state,
            submittedAt: 1_700_000_000_000 + index * 1000,
            updatedAt: 1_700_000_000_000 + index * 1000,
            completedAt: seed.withResult ? 1_700_000_100_000 : null,
          });
        }
      });
    },
    { seeds, spectrum: spectrum() },
  );
  await stubApi(page);
}

/**
 * Stubs only the API endpoints. The patterns must not match the SPA's own hash routes
 * (`/#/jobs`), or Playwright fulfils the page navigation itself and renders a blank page.
 */
async function stubApi(page: Page): Promise<void> {
  await page.route('**/jobs/*/status', (route) =>
    route.fulfill({ status: 404, json: { detail: 'Job not found' } }),
  );
  await page.route('**/jobs/*/result', (route) =>
    route.fulfill({ status: 404, json: { detail: 'Job not found' } }),
  );
  await page.route('**/queue/stats', (route) => route.fulfill({ json: {} }));
}

const TWO_RUNS: SeedRun[] = [
  {
    jobId: 'aaa',
    mf: 'C9H6N4',
    state: 'success',
    withResult: true,
    withSpectrum: true,
  },
  {
    jobId: 'bbb',
    mf: 'C7H8ClN',
    state: 'failure',
    withResult: false,
    withSpectrum: false,
  },
];

test('runs stored in IndexedDB survive a reload', async ({ page }) => {
  await seedRuns(page, TWO_RUNS);
  await page.goto('/#/jobs');

  await expect(page.getByTestId('job-row')).toHaveCount(2);
  await page.reload();
  await expect(page.getByTestId('job-row')).toHaveCount(2);
});

test('a submitted run is written to IndexedDB with the full request and response', async ({
  page,
}) => {
  await stubApi(page);
  await page.unroute('**/jobs/*/status');
  await page.unroute('**/jobs/*/result');
  await page.route('**/submit', (route) =>
    route.fulfill({
      json: { job_id: 'new-1', task_id: 'task-1', status: 'submitted' },
    }),
  );
  await page.route('**/jobs/new-1/status', (route) =>
    route.fulfill({
      json: { job_id: 'new-1', task_id: 'task-1', status: 'success' },
    }),
  );
  await page.route('**/jobs/new-1/result', (route) =>
    route.fulfill({
      json: { results: CANDIDATES, metadata: { job_id: 'new-1' } },
    }),
  );

  await page.goto('/');
  await dropFiles(page);
  await page.getByTestId('mf-input').fill('C9H6N4');
  await page.getByTestId('submit-button').click();
  await expect(page.getByTestId('candidate-card').first()).toBeVisible();

  const stored = await readStoredRun(page, 'new-1');

  const run = stored as {
    request: { mf: string; spectrum: { y: number[] }; gens_ga: number };
    submitResponse: { task_id: string; status: string };
    resultPayload: { results: unknown[]; metadata: { job_id: string } };
    state: string;
  } | null;

  expect(run).not.toBeNull();
  // The exact request that was sent, including the full spectrum and the parameters.
  expect(run?.request.mf).toBe('C9H6N4');
  expect(run?.request.spectrum.y).toHaveLength(10_000);
  expect(run?.request.gens_ga).toBe(10);
  // The exact responses that came back.
  expect(run?.submitResponse.task_id).toBe('task-1');
  expect(run?.submitResponse.status).toBe('submitted');
  expect(run?.resultPayload.results).toHaveLength(2);
  expect(run?.resultPayload.metadata.job_id).toBe('new-1');
  expect(run?.state).toBe('success');
});

test('a stored run is reopened from IndexedDB without contacting the server', async ({
  page,
}) => {
  await seedRuns(page, TWO_RUNS);

  let apiCalls = 0;
  await page.route('**/submit', (route) => {
    apiCalls++;
    return route.fulfill({ json: {} });
  });

  await page.goto('/#/jobs');
  // The list is newest first, so select the finished run by its formula rather than
  // by position.
  await page.getByTestId('job-row').filter({ hasText: 'C9H6N4' }).click();

  // The spectrum and the candidates both come back from local storage.
  await expect(page.getByTestId('run-summary')).toContainText('aaa');
  await expect(
    page.getByText('Normalized spectrum', { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('candidate-card')).toHaveCount(2);
  expect(apiCalls).toBe(0);
});

test('a stored run is deep-linkable and restores on a cold load', async ({
  page,
}) => {
  await seedRuns(page, TWO_RUNS);

  await page.goto('/#/elucidate/aaa');

  await expect(page.getByTestId('run-summary')).toContainText('aaa');
  await expect(page.getByTestId('mf-input')).toHaveValue('C9H6N4');
  await expect(page.getByTestId('candidate-card')).toHaveCount(2);
});

test('status capsules filter the run list', async ({ page }) => {
  await seedRuns(page, TWO_RUNS);
  await page.goto('/#/jobs');

  await page.getByTestId('filter-done').click();
  await expect(page.getByTestId('job-row')).toHaveCount(1);
  await expect(page.getByTestId('job-row').first()).toContainText('Finished');

  await page.getByTestId('filter-failed').click();
  await expect(page.getByTestId('job-row')).toHaveCount(1);
  await expect(page.getByTestId('job-row').first()).toContainText('Failed');

  await page.getByTestId('filter-all').click();
  await expect(page.getByTestId('job-row')).toHaveCount(2);
});

test('clearing history asks for confirmation and empties the store', async ({
  page,
}) => {
  await seedRuns(page, TWO_RUNS);
  await page.goto('/#/jobs');

  await page.getByRole('button', { name: 'Clear history' }).click();
  await expect(
    page.getByText('Delete all 2 runs from this browser?', { exact: false }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Keep' }).click();
  await expect(page.getByTestId('job-row')).toHaveCount(2);

  await page.getByRole('button', { name: 'Clear history' }).click();
  await page.getByRole('button', { name: 'Delete all' }).click();
  await expect(page.getByText('No runs yet', { exact: true })).toBeVisible();

  // Assert against the store itself: reloading would re-run the seeding init script.
  const remaining = await countStoredRuns(page);
  expect(remaining).toBe(0);
});

test('a history from the visualizer prototype is migrated into IndexedDB', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'nmrStructureElucidationJobs',
      JSON.stringify([
        { job_id: 'legacy-1', task_id: 't', mf: 'C6H6', status: 'success' },
      ]),
    );
  });
  await stubApi(page);

  await page.goto('/#/jobs');
  await expect(page.getByTestId('job-row')).toHaveCount(1);
  await expect(page.getByTestId('job-row').first()).toContainText('C6H6');

  // The migration is durable: the localStorage copy is no longer needed.
  await page.reload();
  await expect(page.getByTestId('job-row')).toHaveCount(1);
});

test('the settings dialog is not reachable from the interface', async ({
  page,
}) => {
  await seedRuns(page, TWO_RUNS);
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Settings' })).toHaveCount(0);
  await expect(page.getByText('API endpoint', { exact: true })).toHaveCount(0);
  await expect(
    page.getByText('Mutation fraction', { exact: true }),
  ).toHaveCount(0);
});

test('resubmitting the same spectrum reuses the stored run instead of sending it', async ({
  page,
}) => {
  // The server's own cache check never fires in this deployment, so a resubmit would
  // start a second half-hour job and overwrite the id-to-task mapping, making the
  // finished result unreachable. The app recognises the spectrum before sending.
  let submits = 0;
  await page.route('**/submit', (route) => {
    submits++;
    return route.fulfill({
      json: { job_id: 'reuse-1', task_id: 't', status: 'submitted' },
    });
  });
  await page.route('**/jobs/reuse-1/status', (route) =>
    route.fulfill({
      json: { job_id: 'reuse-1', task_id: 't', status: 'success' },
    }),
  );
  await page.route('**/jobs/reuse-1/result', (route) =>
    route.fulfill({ json: { results: CANDIDATES } }),
  );
  await page.route('**/queue/stats', (route) => route.fulfill({ json: {} }));

  await page.goto('/');
  await dropFiles(page);
  await page.getByTestId('mf-input').fill('C9H6N4');
  await page.getByTestId('submit-button').click();
  await expect(page.getByTestId('candidate-card').first()).toBeVisible();
  expect(submits).toBe(1);

  // Submitting the identical spectrum again must not reach the server.
  await page.getByTestId('submit-button').click();
  await expect(page.getByText('Already run', { exact: true })).toBeVisible();
  await expect(page.getByTestId('candidate-card').first()).toBeVisible();
  expect(submits).toBe(1);
});
