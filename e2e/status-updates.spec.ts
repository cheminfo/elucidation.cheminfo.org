import { expect, test } from '@playwright/test';

import { dropFiles } from './helpers.ts';

const CANDIDATES = [
  {
    smiles: 'CCOC=C',
    score: 0.81,
    molecular_formula: 'C4H8O',
    retrieved: true,
  },
  {
    smiles: 'CC(C)C=O',
    score: 0.64,
    molecular_formula: 'C4H8O',
    retrieved: false,
  },
];

/**
 * The API reports a job's life cycle through three distinct shapes, and the middle one
 * is not a Celery state at all: it is the worker's own stage description leaking through
 * the `status` field. This drives the whole sequence to prove the interface follows it.
 */
test('the panel follows the job through queued, running and finished', async ({
  page,
}) => {
  let phase: 'pending' | 'running' | 'success' = 'pending';

  await page.route('**/submit', (route) =>
    route.fulfill({
      json: { job_id: 'seq-1', task_id: 't1', status: 'submitted' },
    }),
  );
  await page.route('**/jobs/seq-1/status', (route) => {
    if (phase === 'pending') {
      return route.fulfill({
        json: { job_id: 'seq-1', task_id: 't1', status: 'pending' },
      });
    }
    if (phase === 'running') {
      return route.fulfill({
        json: {
          job_id: 'seq-1',
          task_id: 't1',
          status: 'Initializing genetic algorithm...',
          current: 0,
          total: 10,
        },
      });
    }
    return route.fulfill({
      json: { job_id: 'seq-1', task_id: 't1', status: 'success' },
    });
  });
  await page.route('**/jobs/seq-1/result', (route) =>
    route.fulfill({
      json: { results: CANDIDATES, metadata: { job_id: 'seq-1' } },
    }),
  );
  await page.route('**/queue/stats', (route) =>
    route.fulfill({
      json: { active_tasks: 1, reserved_tasks: 3, workers: ['w1'] },
    }),
  );

  await page.goto('/');
  await dropFiles(page);
  await page.getByTestId('mf-input').fill('C4H8O');
  await page.getByTestId('submit-button').click();

  const progress = page.getByTestId('job-progress');
  await expect(progress).toContainText('Queued');
  await expect(progress).toContainText('Waiting for a free worker.');

  // The worker picks the job up: the stage string replaces the queued message.
  phase = 'running';
  await expect(progress).toContainText('Running', { timeout: 20_000 });
  await expect(progress).toContainText('Initializing genetic algorithm...');
  await expect(progress).toContainText('Queue: 1 running');

  // The job finishes: the panel gives way to the ranked candidates.
  phase = 'success';
  await expect(page.getByTestId('candidate-card')).toHaveCount(2, {
    timeout: 20_000,
  });
  await expect(progress).toHaveCount(0);
  await expect(page.getByTestId('candidate-card').first()).toContainText(
    'CCOC=C',
  );
});

test('the elapsed time keeps ticking while the status string stays frozen', async ({
  page,
}) => {
  // The backend emits its progress event once and never updates it, so the elapsed
  // clock is the only moving evidence that a run is alive. If it stopped, a running job
  // would look indistinguishable from a hung one.
  await page.route('**/submit', (route) =>
    route.fulfill({
      json: { job_id: 'tick-1', task_id: 't', status: 'submitted' },
    }),
  );
  await page.route('**/jobs/tick-1/status', (route) =>
    route.fulfill({
      json: {
        job_id: 'tick-1',
        task_id: 't',
        status: 'Initializing genetic algorithm...',
        current: 0,
        total: 10,
      },
    }),
  );
  await page.route('**/queue/stats', (route) => route.fulfill({ json: {} }));

  await page.goto('/');
  await dropFiles(page);
  await page.getByTestId('mf-input').fill('C4H8O');
  await page.getByTestId('submit-button').click();

  const progress = page.getByTestId('job-progress');
  await expect(progress).toContainText('Running');
  await expect(progress).toContainText('3 s', { timeout: 10_000 });
  await expect(progress).toContainText('6 s', { timeout: 10_000 });
});
