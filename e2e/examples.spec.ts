import { expect, test } from '@playwright/test';

test('the gallery lists the 20 reference challenges', async ({ page }) => {
  await page.goto('/#/examples');
  await expect(page.getByTestId('challenge-card')).toHaveCount(20);
  await expect(
    page.getByText('The correct structure was recovered for 10 of them.', {
      exact: false,
    }),
  ).toBeVisible();
});

test('opening a challenge shows its ranked candidates and highlights the answer', async ({
  page,
}) => {
  await page.goto('/#/examples');
  await page.getByTestId('challenge-card').first().click();

  // Challenge 0 is C9H6N4, whose correct structure was not recovered.
  await expect(
    page.getByText('Correct structure not found', { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('candidate-card')).toHaveCount(54);
  await expect(page.getByTestId('candidate-card').first()).toContainText('#1');
});

test('a solved challenge reports the rank of the correct structure', async ({
  page,
}) => {
  await page.goto('/#/examples');
  // C7H8ClN was solved at rank 3 (positionNoStereo 2).
  await page
    .getByTestId('challenge-card')
    .filter({ hasText: 'Rank 3' })
    .first()
    .click();

  await expect(
    page.getByText('Correct structure at rank 3', { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('candidate-card')).toHaveCount(18);
  await expect(
    page.getByTestId('candidate-card').filter({ hasText: 'Known answer' }),
  ).toHaveCount(1);
});

test('a challenge is deep-linkable and the spectrum renders', async ({
  page,
}) => {
  await page.goto('/#/examples');
  await page.getByTestId('challenge-card').first().click();
  const url = page.url();
  expect(url).toContain('#/examples/');

  await page.goto(url);
  await expect(
    page.getByText('Experimental 1H spectrum', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('svg').first()).toBeVisible();
});

test('the text filter narrows the candidate list', async ({ page }) => {
  await page.goto('/#/examples');
  await page.getByTestId('challenge-card').first().click();
  await expect(page.getByTestId('candidate-card')).toHaveCount(54);

  await page.getByPlaceholder('Filter by SMILES text').fill('N#C');
  const count = await page.getByTestId('candidate-card').count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThan(54);
});

test('the demo challenges hide provenance, which their data does not record', async ({
  page,
}) => {
  await page.goto('/#/examples');
  await page.getByTestId('challenge-card').first().click();
  await expect(page.getByTestId('candidate-card').first()).toBeVisible();

  // The published dataset does not say where a candidate came from, so neither the
  // filter nor the badge may claim to know.
  await expect(page.getByTestId('retrieved-filter')).toHaveCount(0);
  await expect(
    page.getByTestId('candidate-card').filter({ hasText: 'Generated' }),
  ).toHaveCount(0);
  await expect(
    page.getByTestId('candidate-card').filter({ hasText: 'Retrieved' }),
  ).toHaveCount(0);
});
