import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { stubIdleApi } from './helpers.ts';

/**
 * The rank-1 candidate of the first reference challenge (C9H6N4), read straight out of
 * `public/challenges/index.json`, so the assertion pins the value a visitor pastes.
 */
const TOP_SMILES = 'N#Cc1ccc(-n2ccnn2)cc1';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test.beforeEach(async ({ page }) => {
  await stubIdleApi(page);
});

test('the text of the tool cannot be selected, and a field still can', async ({
  page,
}) => {
  await page.goto('/');

  const heading = page.getByRole('heading', {
    name: /Find the structure behind/,
  });
  await expect(heading).toBeVisible();
  expect(await userSelect(heading)).toBe('none');

  // A double click on the prose paints nothing: a drag over the tool is a drag, never
  // a selection.
  await heading.dblclick();
  expect(
    await page.evaluate(() => globalThis.getSelection()?.toString() ?? ''),
  ).toBe('');

  // What is typed stays selectable, or the formula could not be corrected.
  expect(await userSelect(page.getByTestId('mf-input'))).toBe('text');
});

test('the candidate SMILES is copied by a click, and names itself on hover', async ({
  page,
}) => {
  await page.goto('/examples');
  await page.getByTestId('challenge-card').first().click();

  const card = page.getByTestId('candidate-card').first();
  await expect(card).toBeVisible();
  const smiles = card.locator(
    '.click-to-copy:has([data-testid="candidate-smiles"])',
  );

  // The SMILES is cut with an ellipsis, so the title is what makes it readable.
  await expect(smiles).toHaveAttribute(
    'title',
    `Copy the SMILES (${TOP_SMILES})`,
  );
  expect(await cursor(smiles)).toBe('copy');
  expect(await copyAndRead(page, smiles)).toBe(TOP_SMILES);
});

test('the similarity score and the challenge formula copy what they show', async ({
  page,
}) => {
  await page.goto('/examples');
  await page.getByTestId('challenge-card').first().click();

  const card = page.getByTestId('candidate-card').first();
  await expect(card).toBeVisible();
  const score = card.getByTitle('Copy the similarity score (0.698)', {
    exact: true,
  });
  await expect(score).toHaveText('0.698');
  expect(await copyAndRead(page, score)).toBe('0.698');

  // The score keeps room on its right for the clipboard glyph, so the bar under it is
  // inset by the same amount and the two right edges read as one.
  const edges = await card.evaluate((element) => {
    const value = element.querySelector<HTMLElement>(
      '.click-to-copy[title*="similarity"]',
    );
    const track = element.querySelector<HTMLElement>(
      '[data-testid="score-bar"]',
    );
    if (value === null || track === null) throw new Error('missing score row');
    const gutter = Number.parseFloat(
      globalThis.getComputedStyle(value).paddingRight,
    );
    return {
      number: Math.round(value.getBoundingClientRect().right - gutter),
      track: Math.round(track.getBoundingClientRect().right),
    };
  });
  expect(edges.number).toBe(edges.track);

  // The formula is drawn by <MF>, so the click copies its plain string, never the
  // subscripted markup.
  const formula = page.getByTitle('Copy the molecular formula (C9H6N4)', {
    exact: true,
  });
  expect(await copyAndRead(page, formula)).toBe('C9H6N4');
});

test('the formula, the mass and the DBE of the entered formula are copyable', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('mf-input').fill('C7H8ClN');

  const formula = page.getByTitle('Copy the molecular formula (C7H8ClN)', {
    exact: true,
  });
  expect(await copyAndRead(page, formula)).toBe('C7H8ClN');

  // The unit is shown but never copied: what is pasted is the number.
  const mass = page.getByTitle('Copy the monoisotopic mass (141.0345)', {
    exact: true,
  });
  await expect(mass).toHaveText('141.0345 Da');
  expect(await copyAndRead(page, mass)).toBe('141.0345');

  const dbe = page.getByTitle('Copy the degree of unsaturation (4)', {
    exact: true,
  });
  await expect(dbe).toHaveText('4 DBE');
  expect(await copyAndRead(page, dbe)).toBe('4');
});

test('a copyable value shows where the keyboard is', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('mf-input').fill('C7H8ClN');

  const formula = page.getByTitle('Copy the molecular formula (C7H8ClN)', {
    exact: true,
  });
  await expect(formula).toBeVisible();
  await page.getByTestId('mf-input').focus();
  await page.keyboard.press('Tab');

  // The tint answers the mouse only, so the ring is the whole cue: the site's blanket
  // `outline: none` must let this one through.
  const ring = await formula.evaluate((element) => {
    const style = globalThis.getComputedStyle(element);
    return {
      focused: element === document.activeElement,
      style: style.outlineStyle,
      width: style.outlineWidth,
    };
  });
  expect(ring).toStrictEqual({ focused: true, style: 'solid', width: '2px' });
});

test('the queue error on the diagnostics page stays selectable', async ({
  page,
}) => {
  await page.route('**/queue/stats', (route) =>
    route.fulfill({ status: 502, body: 'bad gateway' }),
  );
  await page.goto('/debug');

  // A failure a developer quotes verbatim: a danger callout, which the family keeps
  // selectable, rather than page text nobody can pick up.
  const callout = page.locator('.bp6-callout.bp6-intent-danger');
  await expect(callout).toContainText('502');
  expect(await userSelect(callout)).toBe('text');
  expect(await userSelect(callout.locator('.bp6-heading'))).toBe('text');
});

test('the diagnostics block and the About prose stay selectable', async ({
  page,
}) => {
  await page.goto('/debug');

  // A developer pastes this ranking into an issue, so it is a code block rather than
  // page text.
  const block = page.locator('.code-block');
  await expect(block).toBeVisible();
  expect(await userSelect(block)).toBe('text');
  expect(await userSelect(block.locator('pre'))).toBe('text');

  await page.goto('/about');
  const deployment = page.getByText('Carbon, IR and HSQC encoders');
  await expect(deployment).toBeVisible();
  expect(await userSelect(deployment)).toBe('text');
});

/**
 * The computed `user-select` of an element.
 * @param target - The element to measure.
 * @returns The computed value, `none` or `text`.
 */
async function userSelect(target: Locator): Promise<string> {
  return target.evaluate(
    (element) => globalThis.getComputedStyle(element).userSelect,
  );
}

/**
 * The computed `cursor` of an element, which is what promises the copy.
 * @param target - The element to measure.
 * @returns The computed cursor.
 */
async function cursor(target: Locator): Promise<string> {
  return target.evaluate(
    (element) => globalThis.getComputedStyle(element).cursor,
  );
}

/**
 * Clicks a copyable value and reads back what it put on the clipboard.
 *
 * The write is asynchronous, so the tick the component shows is what says the clipboard
 * has been written; reading before it is set would read the previous value.
 * @param page - The page under test.
 * @param target - The copyable value.
 * @returns The clipboard's text.
 */
async function copyAndRead(page: Page, target: Locator): Promise<string> {
  await target.click();
  await expect(target).toHaveAttribute('data-copy', 'copied');
  return page.evaluate(() => navigator.clipboard.readText());
}
