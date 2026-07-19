import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { readStored, readStoredArray, writeStored } from '../persist.ts';

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

const DEFAULTS = { apiUrl: '', model: 'residual', showIntegral: true };

test('missing keys fall back to the defaults', () => {
  expect(readStored('absent', DEFAULTS)).toStrictEqual(DEFAULTS);
  expect(readStoredArray('absent')).toStrictEqual([]);
});

test('stored fields are merged over the defaults, so new fields get values', () => {
  // A user who stored preferences before `showIntegral` existed must still get it.
  stubStorage({ prefs: JSON.stringify({ model: 'regular' }) });

  expect(readStored('prefs', DEFAULTS)).toStrictEqual({
    apiUrl: '',
    model: 'regular',
    showIntegral: true,
  });
});

test('corrupt JSON falls back instead of throwing', () => {
  stubStorage({ prefs: '{not json', list: 'oops' });

  expect(readStored('prefs', DEFAULTS)).toStrictEqual(DEFAULTS);
  expect(readStoredArray('list')).toStrictEqual([]);
});

test('a stored non-array is not returned as a list', () => {
  stubStorage({ list: JSON.stringify({ nope: true }) });
  expect(readStoredArray('list')).toStrictEqual([]);
});

test('writes round-trip', () => {
  expect(writeStored('prefs', { model: 'regular' })).toBe(true);
  expect(readStored('prefs', DEFAULTS)).toStrictEqual({
    ...DEFAULTS,
    model: 'regular',
  });
});

test('a storage that refuses to write is reported, not thrown', () => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => {
      throw new DOMException('quota', 'QuotaExceededError');
    },
  });

  expect(writeStored('prefs', { model: 'regular' })).toBe(false);
});

test('an absent localStorage does not break reads or writes', () => {
  vi.stubGlobal('localStorage', undefined);

  expect(readStored('prefs', DEFAULTS)).toStrictEqual(DEFAULTS);
  expect(readStoredArray('list')).toStrictEqual([]);
  expect(writeStored('prefs', {})).toBe(true);
});
