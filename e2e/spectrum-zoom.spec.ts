import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Reads the rendered tick labels of an axis. Zooming changes the visible range, so the
 * extreme labels are a faithful, implementation-independent view of the current zoom.
 */
async function axisLabels(page: Page, axis: 'x' | 'y'): Promise<number[]> {
  const values = await page.evaluate((which) => {
    const svg = document.querySelector('[data-testid="spectrum-plot"] svg');
    if (svg === null) return [];
    const numbers: number[] = [];
    for (const node of svg.querySelectorAll('text')) {
      const value = Number(node.textContent);
      if (!Number.isFinite(value) || node.textContent?.trim() === '') continue;
      const box = node.getBoundingClientRect();
      const svgBox = svg.getBoundingClientRect();
      // x-axis labels sit along the bottom; y-axis labels along the left edge.
      // The bottom band starts around 0.76 of the height, so 0.7 leaves margin.
      const isBottom = box.top - svgBox.top > svgBox.height * 0.7;
      const isLeft = box.left - svgBox.left < svgBox.width * 0.12;
      if (
        (which === 'x' && isBottom) ||
        (which === 'y' && isLeft && !isBottom)
      ) {
        numbers.push(value);
      }
    }
    return numbers;
  }, axis);
  return values;
}

async function openSpectrum(page: Page): Promise<void> {
  await page.goto('/#/examples');
  await page.getByTestId('challenge-card').first().click();
  await expect(page.getByTestId('spectrum-plot')).toBeVisible();
  await page.waitForTimeout(500);
}

test('the wheel scales the intensity axis without changing the shift range', async ({
  page,
}) => {
  await openSpectrum(page);

  const xBefore = await axisLabels(page, 'x');
  const yBefore = await axisLabels(page, 'y');
  expect(yBefore.length).toBeGreaterThan(2);

  const plot = page.getByTestId('spectrum-plot');
  const box = await plot.boundingBox();
  if (box === null) throw new Error('plot has no bounding box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(400);

  const xAfter = await axisLabels(page, 'x');
  const yAfter = await axisLabels(page, 'y');

  // Intensity range shrank (zoomed in), shift range untouched.
  expect(Math.max(...yAfter)).toBeLessThan(Math.max(...yBefore));
  expect(Math.max(...xAfter)).toBeCloseTo(Math.max(...xBefore), 1);
  expect(Math.min(...xAfter)).toBeCloseTo(Math.min(...xBefore), 1);
});

test('dragging horizontally zooms into a shift range', async ({ page }) => {
  await openSpectrum(page);

  const xBefore = await axisLabels(page, 'x');
  const spanBefore = Math.max(...xBefore) - Math.min(...xBefore);

  const plot = page.getByTestId('spectrum-plot');
  const box = await plot.boundingBox();
  if (box === null) throw new Error('plot has no bounding box');
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.35, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.55, y, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(400);

  const xAfter = await axisLabels(page, 'x');
  const spanAfter = Math.max(...xAfter) - Math.min(...xAfter);
  expect(spanAfter).toBeLessThan(spanBefore);
});

test('a double click restores the full spectrum on both axes', async ({
  page,
}) => {
  await openSpectrum(page);

  const xBefore = await axisLabels(page, 'x');
  const yBefore = await axisLabels(page, 'y');

  const plot = page.getByTestId('spectrum-plot');
  const box = await plot.boundingBox();
  if (box === null) throw new Error('plot has no bounding box');
  const y = box.y + box.height / 2;

  // Zoom both axes, then reset.
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.wheel(0, -600);
  await page.mouse.move(box.x + box.width * 0.35, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.55, y, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(400);

  const xZoomed = await axisLabels(page, 'x');
  expect(Math.max(...xZoomed) - Math.min(...xZoomed)).toBeLessThan(
    Math.max(...xBefore) - Math.min(...xBefore),
  );

  await page.mouse.dblclick(box.x + box.width / 2, y);
  await page.waitForTimeout(400);

  const xReset = await axisLabels(page, 'x');
  const yReset = await axisLabels(page, 'y');
  expect(Math.max(...xReset)).toBeCloseTo(Math.max(...xBefore), 1);
  expect(Math.min(...xReset)).toBeCloseTo(Math.min(...xBefore), 1);
  expect(Math.max(...yReset)).toBeCloseTo(Math.max(...yBefore), 1);
});
