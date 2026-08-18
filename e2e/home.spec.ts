import { expect, test } from '@playwright/test';

import { dropFiles, stubIdleApi } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await stubIdleApi(page);
});

test('the landing page explains the tool and offers both ways in', async ({
  page,
}) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: /Find the structure behind/ }),
  ).toBeVisible();
  await expect(
    page.getByText('Use your own spectrum', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Look at worked examples', { exact: true }),
  ).toBeVisible();
});

test('there is exactly one drop target on the page', async ({ page }) => {
  // The welcome panel points at the input panel's drop zone rather than offering a
  // second one, which was the duplication this page used to have.
  await page.goto('/');

  await expect(page.getByTestId('file-dropzone')).toHaveCount(1);
  await expect(
    page.locator('[data-testid="file-dropzone"] input[type="file"]'),
  ).toHaveCount(1);
  // The drop zone's own input is the only one: a folder is dragged in, never browsed for.
  await expect(page.locator('input[type="file"]')).toHaveCount(1);
});

test('the citation and DOI are on the home page, not only in the header', async ({
  page,
}) => {
  await page.goto('/');

  const citation = page.getByTestId('home-citation');
  await expect(citation).toBeVisible();
  await expect(citation).toContainText('Nat. Commun.');
  await expect(
    citation.getByRole('link', { name: /doi:10\.1038/ }),
  ).toBeVisible();
  await expect(citation.getByRole('button', { name: 'Cite' })).toBeVisible();
});

test('the header carries the Cite and Tools utilities', async ({ page }) => {
  await page.goto('/');

  const header = page.locator('.app-header');
  await expect(header.getByRole('button', { name: 'Cite' })).toBeVisible();

  await header.getByRole('button', { name: 'Tools' }).click();
  // The ecosystem menu opens the other sites of the family.
  await expect(
    page.getByLabel('Our other tools').getByRole('link', { name: /chemcalc/i }),
  ).toBeVisible();
});

test('the two entry points navigate where they say', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Browse examples' }).click();
  await expect(page.getByTestId('challenge-card').first()).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/examples');

  await page.goto('/');
  await page.getByRole('button', { name: 'How the method works' }).click();
  await expect(
    page.getByRole('heading', {
      name: /Structure elucidation from a 1H NMR spectrum/,
    }),
  ).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/about');
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

test('the drag-over overlay fills the drop zone instead of collapsing', async ({
  page,
}) => {
  // The drop zone's root is `height: 100%` and its drag overlay is
  // `position: absolute; inset: 0`. Against a min-height parent the root resolves to
  // zero, so the overlay shrank to its own 5px border and spilled its contents over
  // the label above. The wrapper therefore needs a definite height.
  await page.goto('/');
  const zone = page.getByTestId('file-dropzone');
  await expect(zone).toBeVisible();

  // Dispatch on the drop zone's own root: the events do not reach it from the wrapper.
  await page.evaluate(() => {
    const root = document.querySelector(
      '[data-testid="file-dropzone"]',
    )?.firstElementChild;
    if (!root) throw new Error('the drop zone root is missing');
    const transfer = new DataTransfer();
    transfer.items.add(new File(['x'], 'a.jdx'));
    for (const type of ['dragenter', 'dragover']) {
      root.dispatchEvent(
        new DragEvent(type, {
          dataTransfer: transfer,
          bubbles: true,
          cancelable: true,
        }),
      );
    }
  });

  // Wait for the overlay to render before measuring it.
  await expect(zone).toContainText('Drop the files here');

  const measured = await page.evaluate(() => {
    const wrapper = document.querySelector('[data-testid="file-dropzone"]');
    const root = wrapper?.firstElementChild;
    if (!wrapper || !root) return null;
    const overlay = [...wrapper.querySelectorAll('div')].find(
      (element) => globalThis.getComputedStyle(element).position === 'absolute',
    );
    return {
      wrapperHeight: Math.round(wrapper.getBoundingClientRect().height),
      rootHeight: Math.round(root.getBoundingClientRect().height),
      overlayHeight: overlay
        ? Math.round(overlay.getBoundingClientRect().height)
        : 0,
    };
  });
  expect(measured?.wrapperHeight).toBeGreaterThan(100);
  expect(measured?.rootHeight).toBe(measured?.wrapperHeight);
  expect(measured?.overlayHeight).toBe(measured?.wrapperHeight);
});
