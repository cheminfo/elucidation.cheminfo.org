import type { Page } from '@playwright/test';
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

test('the substructure editor stays inside the box reserved for it', async ({
  page,
}) => {
  await page.goto('/#/examples');
  await page.getByTestId('challenge-card').first().click();
  await expect(page.getByTestId('candidate-card').first()).toBeVisible();
  await page.getByText('Filter by substructure', { exact: true }).click();

  // The OCL editor renders a fixed-size toolbar in a shadow root and clips nothing,
  // so a box that is too small lets it spill over the candidates below.
  const overflow = await page.evaluate(() => {
    const box = document.querySelector('[data-testid="substructure-editor"]');
    if (!box) return [];
    const host = [...box.querySelectorAll('div')].find(
      (element) => element.shadowRoot !== null,
    );
    if (!host?.shadowRoot) return [];
    const hostRect = host.getBoundingClientRect();
    return [...host.shadowRoot.querySelectorAll('canvas')].map((canvas) => {
      const rect = canvas.getBoundingClientRect();
      return {
        bottom: Math.round(rect.bottom - hostRect.bottom),
        right: Math.round(rect.right - hostRect.right),
      };
    });
  });

  expect(overflow).toHaveLength(2);
  for (const canvas of overflow) {
    expect(canvas.bottom).toBeLessThanOrEqual(0);
    expect(canvas.right).toBeLessThanOrEqual(0);
  }
});

test('clearing the substructure filter also empties the editor', async ({
  page,
}) => {
  await page.goto('/#/examples');
  await page.getByTestId('challenge-card').first().click();
  await expect(page.getByTestId('candidate-card')).toHaveCount(54);
  await page.getByText('Filter by substructure', { exact: true }).click();
  await page.getByTestId('substructure-editor').scrollIntoViewIfNeeded();

  const empty = await drawingCanvas(page);
  expect(empty.ink).toBe(0);

  // Drag across the canvas to draw a single C-C bond, the smallest query that
  // actually excludes candidates.
  const centerX = empty.x + empty.width / 2;
  const centerY = empty.y + empty.height / 2;
  await page.mouse.move(centerX - 40, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 40, centerY, { steps: 10 });
  await page.mouse.up();

  await expect(page.getByTestId('candidate-card')).toHaveCount(50);
  const drawn = await drawingCanvas(page);
  expect(drawn.ink).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Clear' }).click();

  await expect(page.getByTestId('candidate-card')).toHaveCount(54);
  await expect(page.getByRole('button', { name: 'Clear' })).toHaveCount(0);
  // The editor owns its structure, so dropping the query is not enough: the drawn
  // fragment must disappear from the canvas as well.
  const cleared = await drawingCanvas(page);
  expect(cleared.ink).toBe(0);
});

/**
 * Measures how much has been drawn in the editor's drawing area, and where it sits.
 *
 * The editor lives in a shadow root and renders two canvases — a toolbar and, last, the
 * drawing area. Counting its non-white pixels is the only way to see what the user sees;
 * the query id code says nothing about what the canvas still shows.
 */
async function drawingCanvas(page: Page): Promise<{
  ink: number;
  x: number;
  y: number;
  width: number;
  height: number;
}> {
  const measured = await page.evaluate(() => {
    const box = document.querySelector('[data-testid="substructure-editor"]');
    const host = [...(box?.querySelectorAll('div') ?? [])].find(
      (element) => element.shadowRoot !== null,
    );
    const canvas = [...(host?.shadowRoot?.querySelectorAll('canvas') ?? [])].at(
      -1,
    );
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return null;
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) ink++;
    }
    const rect = canvas.getBoundingClientRect();
    return {
      ink,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  });
  if (measured === null) throw new Error('the editor canvas was not found');
  return measured;
}
