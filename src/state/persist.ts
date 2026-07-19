import type { Signal } from '@preact/signals-react';
import { effect } from '@preact/signals-react';

/**
 * Reads a persisted value, merging it over the defaults so fields added in later
 * versions arrive with sensible values for existing users.
 * @param key - Versioned localStorage key.
 * @param fallback - Default value, also used when storage is unavailable or corrupt.
 * @returns The stored value merged over the defaults.
 */
export function readStored<T extends object>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    const parsed = JSON.parse(raw) as Partial<T>;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

/**
 * Reads a persisted array, tolerating corrupt or absent storage.
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

/**
 * Writes a value to localStorage, swallowing quota and privacy-mode failures.
 *
 * Persistence here is a convenience, never a correctness requirement: a browser that
 * refuses to store must still run the app.
 * @param key - Versioned localStorage key.
 * @param value - Value to serialize.
 * @returns True when the write succeeded.
 */
export function writeStored(key: string, value: unknown): boolean {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Mirrors a signal into localStorage on every change.
 * @param key - Versioned localStorage key.
 * @param signal - The signal to persist.
 */
export function persistSignal<T>(key: string, signal: Signal<T>): void {
  effect(() => {
    writeStored(key, signal.value);
  });
}
