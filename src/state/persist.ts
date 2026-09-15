/**
 * Reads a persisted array, tolerating corrupt or absent storage.
 *
 * A bucket of preferences belongs in `persistBucket` from `react-cheminfo/core`,
 * which rejects a bare array; this reads the one shape it will not take, and
 * has a single caller — the one-time import of a history the prototype wrote
 * as a JSON array.
 * @param key - Versioned localStorage key.
 * @returns The stored array, or an empty array.
 */
export function readStoredArray<T>(key: string): T[] {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (raw === null || raw === undefined) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}
