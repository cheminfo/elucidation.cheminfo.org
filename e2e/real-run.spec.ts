import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

const DATA = join(import.meta.dirname, '..', 'src');
const RESULT = JSON.parse(
  readFileSync(
    join(DATA, 'chemistry', '__tests__', 'data', 'ethylvinylether-result.json'),
    'utf8',
  ),
);
const SPECTRUM = join(
  DATA,
  'spectrum',
  '__tests__',
  'data',
  'ethylvinylether',
  '1h.jdx',
);
const MOL = join(
  DATA,
  'spectrum',
  '__tests__',
  'data',
  'ethylvinylether',
  'structure.mol',
);

test('the recorded ethyl vinyl ether run renders end to end', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.route('**/submit', (r) =>
    r.fulfill({ json: { job_id: 'evd', task_id: 't', status: 'submitted' } }),
  );
  await page.route('**/jobs/evd/status', (r) =>
    r.fulfill({ json: { job_id: 'evd', task_id: 't', status: 'success' } }),
  );
  await page.route('**/jobs/evd/result', (r) => r.fulfill({ json: RESULT }));
  await page.route('**/queue/stats', (r) => r.fulfill({ json: {} }));

  await page.goto('/');
  await page
    .locator('[data-testid="file-dropzone"] input[type="file"]')
    .setInputFiles([SPECTRUM, MOL]);
  await expect(
    page.getByText('Normalized spectrum', { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('mf-input')).toHaveValue('C4H8O');
  await page.getByTestId('submit-button').click();

  await expect(
    page.getByText('Correct structure at rank 1', { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('candidate-card')).toHaveCount(7);
  await expect(
    page.getByText('505 rejected for not matching the formula', {
      exact: false,
    }),
  ).toBeVisible();
  const first = page.getByTestId('candidate-card').first();
  await expect(first).toContainText('Known answer');
  await expect(first).toContainText('Retrieved');
  await expect(first).toContainText('0.788');
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/shots/9-evd.png' });
});
