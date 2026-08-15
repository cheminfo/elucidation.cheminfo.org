import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export const JCAMP_FIXTURE = join(
  import.meta.dirname,
  '..',
  'src',
  'spectrum',
  '__tests__',
  'data',
  '4-chlorobenzylamine.jdx',
);

/**
 * Loads files through the drop zone.
 *
 * The drop zone renders a hidden file input, which is what Playwright can drive; the
 * visible surface only accepts real drag events.
 * @param page - The page under test.
 * @param files - Paths to load. Defaults to the JCAMP fixture.
 */
export async function dropFiles(
  page: Page,
  files: string[] = [JCAMP_FIXTURE],
): Promise<void> {
  await page
    .locator('[data-testid="file-dropzone"] input[type="file"]')
    .setInputFiles(files);
  await expect(
    page.getByText('Normalized spectrum', { exact: true }),
  ).toBeVisible();
}

/**
 * Drops a directory on the drop zone.
 *
 * A hidden input cannot carry a folder, so the files are handed over as a real drop:
 * each one keeps the `path` a browser sets when a directory is dragged, which is what
 * the parser reads to recognize a Bruker or Varian dataset.
 * @param page - The page under test.
 * @param directory - Absolute path of the folder to drop.
 */
export async function dropDirectory(
  page: Page,
  directory: string,
): Promise<void> {
  const parent = dirname(directory);
  const entries = readdirSync(directory, {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const full = join(entry.parentPath, entry.name);
      return {
        name: entry.name,
        path: relative(parent, full),
        bytes: [...readFileSync(full)],
      };
    });

  await page.evaluate((files) => {
    const dropped = files.map((file) => {
      const created = new File([new Uint8Array(file.bytes)], file.name);
      // file-selector keeps a `path` that is already a string, so this survives as the
      // relative path of the dragged folder.
      Object.defineProperty(created, 'path', { value: file.path });
      return created;
    });
    const zone = document.querySelector('[data-testid="file-dropzone"] > div');
    if (zone === null) throw new Error('the drop zone is not on the page');
    const event = new Event('drop', { bubbles: true });
    // `items` is left out on purpose: with it, file-selector reads the entries through
    // `webkitGetAsEntry`, which a synthetic transfer cannot provide.
    Object.defineProperty(event, 'dataTransfer', {
      value: { files: dropped, types: ['Files'] },
    });
    zone.dispatchEvent(event);
  }, entries);

  await expect(
    page.getByText('Normalized spectrum', { exact: true }),
  ).toBeVisible();
}

/**
 * Stubs the API endpoints used in the background.
 *
 * The patterns must not match the SPA's own hash routes (`/#/jobs`), or Playwright
 * fulfils the page navigation itself and renders a blank page.
 * @param page - The page under test.
 */
export async function stubIdleApi(page: Page): Promise<void> {
  await page.route('**/jobs/*/status', (route) =>
    route.fulfill({ status: 404, json: { detail: 'Job not found' } }),
  );
  await page.route('**/jobs/*/result', (route) =>
    route.fulfill({ status: 404, json: { detail: 'Job not found' } }),
  );
  await page.route('**/queue/stats', (route) => route.fulfill({ json: {} }));
}

/**
 * Reads a run straight out of IndexedDB, so a test can assert on exactly what was
 * stored rather than on what the interface chose to render.
 * @param page - The page under test.
 * @param jobId - The run to read.
 * @returns The stored record, or null when absent.
 */
export async function readStoredRun(
  page: Page,
  jobId: string,
): Promise<Record<string, unknown> | null> {
  return page.evaluate(async (id: string) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('elucidation', 1);
      request.addEventListener('success', () => resolve(request.result));
      request.addEventListener('error', () =>
        reject(new Error('could not open the database')),
      );
    });
    return new Promise<Record<string, unknown> | null>((resolve) => {
      const get = db
        .transaction('runs', 'readonly')
        .objectStore('runs')
        .get(id);
      get.addEventListener('success', () => resolve(get.result ?? null));
      get.addEventListener('error', () => resolve(null));
    });
  }, jobId);
}

/**
 * Counts the runs currently in IndexedDB.
 * @param page - The page under test.
 * @returns The number of stored runs, or -1 when the store cannot be read.
 */
export async function countStoredRuns(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('elucidation', 1);
      request.addEventListener('success', () => resolve(request.result));
      request.addEventListener('error', () =>
        reject(new Error('could not open the database')),
      );
    });
    return new Promise<number>((resolve) => {
      const count = db
        .transaction('runs', 'readonly')
        .objectStore('runs')
        .count();
      count.addEventListener('success', () => resolve(count.result));
      count.addEventListener('error', () => resolve(-1));
    });
  });
}
