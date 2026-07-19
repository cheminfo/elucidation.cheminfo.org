import { expect, test } from '@playwright/test';

import { dropFiles, stubIdleApi } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await stubIdleApi(page);
});

test('the landing page explains the tool and offers both ways in', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: /Find the structure behind/ }),
  ).toBeVisible();
  await expect(page.getByText('Use your own spectrum', { exact: true })).toBeVisible();
  await expect(page.getByText('Look at worked examples', { exact: true })).toBeVisible();
});

test('there is exactly one drop target on the page', async ({ page }) => {
  // The welcome panel points at the input panel's drop zone rather than offering a
  // second one, which was the duplication this page used to have.
  await page.goto('/');

  await expect(page.getByTestId('file-dropzone')).toHaveCount(1);
  await expect(page.locator('input[type="file"]')).toHaveCount(1);
});

test('the citation and DOI are on the home page, not only in the footer', async ({
  page,
}) => {
  await page.goto('/');

  const citation = page.getByTestId('home-citation');
  await expect(citation).toBeVisible();
  await expect(citation).toContainText('Nature Communications');
  await expect(citation.getByRole('link', { name: /doi:10\.1038/ })).toBeVisible();
  await expect(citation.getByRole('button', { name: 'Copy BibTeX' })).toBeVisible();
});

test('the two entry points navigate where they say', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Browse examples' }).click();
  await expect(page.getByTestId('challenge-card').first()).toBeVisible();
  expect(page.url()).toContain('#/examples');

  await page.goto('/');
  await page.getByRole('button', { name: 'How the method works' }).click();
  await expect(
    page.getByRole('heading', { name: /Structure elucidation from a 1H NMR spectrum/ }),
  ).toBeVisible();
  expect(page.url()).toContain('#/about');
});

test('the welcome panel gives way to the spectrum once a file is loaded', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('home-citation')).toBeVisible();

  await dropFiles(page);

  await expect(page.getByTestId('home-citation')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: /Find the structure behind/ }),
  ).toHaveCount(0);
});
