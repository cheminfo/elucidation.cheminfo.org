import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { readStoredArray } from '../persist.ts';

function stubStorage(
  initial: Record<string, string> = {},
): Map<string, string> {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
  return store;
}

beforeEach(() => {
  stubStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('missing keys fall back to the defaults', () => {
  expect(readStoredArray('absent')).toStrictEqual([]);
});

test('corrupt JSON falls back instead of throwing', () => {
  stubStorage({ list: 'oops' });

  expect(readStoredArray('list')).toStrictEqual([]);
});

test('a stored non-array is not returned as a list', () => {
  stubStorage({ list: JSON.stringify({ nope: true }) });
  expect(readStoredArray('list')).toStrictEqual([]);
});

test('a stored array round-trips', () => {
  stubStorage({ list: JSON.stringify([{ job_id: 'aaa' }]) });
  expect(readStoredArray('list')).toStrictEqual([{ job_id: 'aaa' }]);
});

test('an absent localStorage does not break reads', () => {
  vi.stubGlobal('localStorage', undefined);

  expect(readStoredArray('list')).toStrictEqual([]);
});
