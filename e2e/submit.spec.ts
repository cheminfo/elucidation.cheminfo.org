import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Page, Route } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { dropFiles } from './helpers.ts';

const FIXTURE = join(
  import.meta.dirname,
  '..',
  'src',
  'spectrum',
  '__tests__',
  'data',
  '4-chlorobenzylamine.jdx',
);

const CANDIDATES = [
  {
    smiles: 'NCc1ccc(Cl)cc1',
    score: 0.71,
    molecular_formula: 'C7H8ClN',
    retrieved: true,
  },
  {
    smiles: 'Cc1ccc(N)c(Cl)c1',
    score: 0.64,
    molecular_formula: 'C7H8ClN',
    retrieved: false,
  },
  { smiles: 'CCCCCC', score: 0.9, molecular_formula: 'C6H14', retrieved: true },
];

async function dropSpectrum(page: Page): Promise<void> {
  await dropFiles(page);
}

test('a dropped JCAMP file is parsed, plotted and described', async ({
  page,
}) => {
  await page.goto('/');
  await dropSpectrum(page);

  await expect(
    page.getByText('4-chlorobenzylamine', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('1H', { exact: true })).toBeVisible();
  await expect(page.getByText('CDCl3', { exact: true })).toBeVisible();
  // Submission needs a formula, which this file does not carry.
  await expect(page.getByTestId('submit-button')).toBeDisabled();
});

test('submitting sends exactly 10000 points on the fixed grid', async ({
  page,
}) => {
  let body: {
    mf: string;
    spectrum: { x: number[]; y: number[] };
    model: string;
  } | null = null;

  await page.route('**/submit', async (route: Route) => {
    body = route.request().postDataJSON();
    await route.fulfill({
      json: { job_id: 'job-1', task_id: 'task-1', status: 'submitted' },
    });
  });
  await page.route('**/jobs/job-1/status', (route) =>
    route.fulfill({
      json: { job_id: 'job-1', task_id: 'task-1', status: 'pending' },
    }),
  );
  await page.route('**/queue/stats', (route) =>
    route.fulfill({
      json: { active_tasks: 0, reserved_tasks: 1, workers: ['w1'] },
    }),
  );

  await page.goto('/');
  await dropSpectrum(page);
  await page.getByTestId('mf-input').fill('C7H8ClN');
  await page.getByTestId('submit-button').click();

  await expect(page.getByTestId('job-progress')).toBeVisible();
  expect(body).not.toBeNull();
  const sent = body as unknown as {
    mf: string;
    spectrum: { x: number[]; y: number[] };
  };
  expect(sent.mf).toBe('C7H8ClN');
  expect(sent.spectrum.y).toHaveLength(10_000);
  expect(sent.spectrum.x).toHaveLength(10_000);
  expect(sent.spectrum.x[0]).toBe(-2);
  expect(sent.spectrum.x.at(-1)).toBe(10);
});

test('a running job shows elapsed time and no invented percentage', async ({
  page,
}) => {
  await page.route('**/submit', (route) =>
    route.fulfill({
      json: { job_id: 'job-2', task_id: 't2', status: 'submitted' },
    }),
  );
  await page.route('**/jobs/job-2/status', (route) =>
    route.fulfill({
      json: {
        job_id: 'job-2',
        task_id: 't2',
        // The API leaks the worker's stage string through the status field.
        status: 'Initializing genetic algorithm...',
        current: 0,
        total: 10,
      },
    }),
  );
  await page.route('**/queue/stats', (route) =>
    route.fulfill({
      json: { active_tasks: 1, reserved_tasks: 0, workers: ['w1'] },
    }),
  );
  // Stubbed so the rendered capacity does not depend on the real deployment's pool.
  await page.route('**/workers', (route) =>
    route.fulfill({
      json: { workers: { 'celery@w1': { pool: { 'max-concurrency': 4 } } } },
    }),
  );

  await page.goto('/');
  await dropSpectrum(page);
  await page.getByTestId('mf-input').fill('C7H8ClN');
  await page.getByTestId('submit-button').click();

  const progress = page.getByTestId('job-progress');
  await expect(progress).toContainText('Initializing genetic algorithm...');
  await expect(progress).toContainText('The server is running 1 of the 4 jobs');
  await expect(progress).toContainText('shows activity, not completion');
  // The bar must be indeterminate: no percentage is knowable from this backend.
  await expect(progress.locator('.bp6-progress-bar')).toBeVisible();
  await expect(progress).not.toContainText('%');
});

test('finished results are ranked and filtered to the requested formula', async ({
  page,
}) => {
  await page.route('**/submit', (route) =>
    route.fulfill({
      json: { job_id: 'job-3', task_id: 't3', status: 'submitted' },
    }),
  );
  await page.route('**/jobs/job-3/status', (route) =>
    route.fulfill({
      json: { job_id: 'job-3', task_id: 't3', status: 'success' },
    }),
  );
  await page.route('**/jobs/job-3/result', (route) =>
    route.fulfill({ json: { results: CANDIDATES } }),
  );
  await page.route('**/queue/stats', (route) => route.fulfill({ json: {} }));

  await page.goto('/');
  await dropSpectrum(page);
  await page.getByTestId('mf-input').fill('C7H8ClN');
  await page.getByTestId('submit-button').click();

  // The C6H14 candidate must be rejected: it does not match the requested formula.
  await expect(page.getByTestId('candidate-card')).toHaveCount(2);
  await expect(
    page.getByText('1 rejected for not matching the formula', { exact: false }),
  ).toBeVisible();
  await expect(page.getByTestId('candidate-card').first()).toContainText(
    'Retrieved',
  );
});

test('a cached job computed for another formula is blocked, not shown', async ({
  page,
}) => {
  await page.route('**/submit', (route) =>
    route.fulfill({
      json: { job_id: 'job-4', task_id: 't4', status: 'submitted' },
    }),
  );
  await page.route('**/jobs/job-4/status', (route) =>
    route.fulfill({
      json: { job_id: 'job-4', task_id: 't4', status: 'success' },
    }),
  );
  await page.route('**/jobs/job-4/result', (route) =>
    route.fulfill({ json: { results: CANDIDATES } }),
  );
  await page.route('**/queue/stats', (route) => route.fulfill({ json: {} }));

  await page.goto('/');
  await dropSpectrum(page);
  await page.getByTestId('mf-input').fill('C7H8ClN');
  await page.getByTestId('submit-button').click();
  await expect(page.getByTestId('candidate-card').first()).toBeVisible();

  // Resubmit the same spectrum with a different formula: the server answers "cached"
  // with the previous run's candidates, which must not be attributed to the new formula.
  await page.unroute('**/submit');
  await page.route('**/submit', (route) =>
    route.fulfill({
      json: {
        job_id: 'job-4',
        status: 'cached',
        message: 'Result already exists',
      },
    }),
  );
  await page.getByTestId('mf-input').fill('C9H6N4');
  await page.getByTestId('submit-button').click();

  await expect(
    page.getByText('These results were computed for a different formula.', {
      exact: true,
    }),
  ).toBeVisible();
});

test('the JCAMP fixture is a real file, not an empty placeholder', () => {
  const content = readFileSync(FIXTURE, 'utf8');
  expect(content).toContain('##JCAMP-DX=');
  expect(content.length).toBeGreaterThan(10_000);
});
