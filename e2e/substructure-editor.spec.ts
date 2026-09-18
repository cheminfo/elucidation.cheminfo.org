import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

test('the substructure editor names its toolbar buttons and explains its keys', async ({
  page,
}) => {
  await page.goto('/#/examples');
  await page.getByTestId('challenge-card').first().click();
  await expect(page.getByTestId('candidate-card')).toHaveCount(54);
  await page.getByText('Filter by substructure', { exact: true }).click();
  await page.getByTestId('substructure-editor').scrollIntoViewIfNeeded();
  const toolbar = await settledToolbar(page);

  // The toolbar is two columns of 21 px buttons inside a 2 px border; the sixth
  // button of the first column is the single bond, the default tool.
  await page.mouse.move(toolbar.x + 12, toolbar.y + 2 + 5 * 21 + 10);
  const tooltip = page.getByTestId('structure-editor-tooltip');
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText('Single bond');

  await page.getByRole('button', { name: 'Mouse and keyboard' }).click();
  await expect(page.getByTestId('structure-editor-help')).toBeVisible();
});

/**
 * Where the editor's toolbar sits, once the folding panel it lives in has stopped
 * moving.
 *
 * The toolbar is a canvas in the editor's shadow root, which locators do not reach, and
 * the panel slides open, so a box read too early points above the button.
 * @param page - The page under test.
 * @returns The toolbar's box, in viewport pixels.
 */
async function settledToolbar(
  page: Page,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const read = () =>
    page.evaluate(() => {
      const root = document.querySelector(
        '[data-testid="substructure-editor"] [data-openchemlib-canvas-editor]',
      );
      const toolbar = root?.shadowRoot?.firstElementChild;
      if (!toolbar) return null;
      const { x, y, width, height } = toolbar.getBoundingClientRect();
      return { x, y, width, height };
    });

  let previous: Awaited<ReturnType<typeof read>> = null;
  await expect
    .poll(async () => {
      const current = await read();
      const settled =
        current !== null &&
        current.height > 0 &&
        JSON.stringify(current) === JSON.stringify(previous);
      previous = current;
      return settled;
    })
    .toBe(true);
  if (previous === null) throw new Error('the editor toolbar was not found');
  return previous;
}
