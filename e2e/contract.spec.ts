import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { APP_ROUTES } from '../src/seo/routes.ts';

import { dropFiles, stubIdleApi } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await stubIdleApi(page);
  // Stubbed so no page reaches the real deployment's worker pool.
  await page.route('**/workers', (route) =>
    route.fulfill({ json: { workers: {} } }),
  );
});

/**
 * Collects every uncaught page error and every console error of a page.
 * @param page - The page under test.
 * @returns The live list of messages.
 */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

for (const { path } of APP_ROUTES) {
  test(`${path} loads without an error`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(path);

    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('banner')).toHaveCount(1);
    await expect(page.getByRole('contentinfo')).toHaveCount(1);
    await page.waitForLoadState('networkidle');
    expect(errors).toStrictEqual([]);
  });
}

test('/about is the About page, with the Cite control and the footer', async ({
  page,
}) => {
  await page.goto('/about');

  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText(
    'elucidation.cheminfo',
  );
  await expect(
    main.getByText('A structure from a 1H NMR spectrum and a formula.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('banner').getByRole('button', { name: 'Cite' }),
  ).toBeVisible();
  await expect(page.getByRole('contentinfo')).toHaveCount(1);
});

for (const query of ['?embed', '?embed=1']) {
  test(`${query} drops the header and the footer and keeps the tool`, async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto(`/${query}`);

    await expect(page.getByTestId('file-dropzone')).toBeVisible();
    await expect(page.getByRole('banner')).toHaveCount(0);
    await expect(page.getByRole('contentinfo')).toHaveCount(0);

    await dropFiles(page);
    await expect(
      page.getByText('4-chlorobenzylamine', { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId('submit-button')).toBeDisabled();
    await page.getByTestId('mf-input').fill('C7H8ClN');
    await expect(page.getByTestId('submit-button')).toBeEnabled();

    await expect(page.getByRole('banner')).toHaveCount(0);
    await expect(page.getByRole('contentinfo')).toHaveCount(0);
    expect(errors).toStrictEqual([]);
  });
}

test('an unknown path falls back to the tool', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/no-such-page');

  await expect(
    page.getByRole('heading', { name: /Find the structure behind/ }),
  ).toBeVisible();
  await expect(page.getByTestId('file-dropzone')).toHaveCount(1);
  await expect(page.getByRole('banner')).toHaveCount(1);
  await page.waitForLoadState('networkidle');
  expect(errors).toStrictEqual([]);
});
