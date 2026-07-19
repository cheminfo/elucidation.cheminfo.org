import { expect, test } from 'vitest';

import { formatRelativeTime } from '../relativeTime.ts';

const NOW = Date.UTC(2026, 6, 19, 12, 0, 0);

test('sub-minute ages read as just now', () => {
  expect(formatRelativeTime(NOW, NOW)).toBe('just now');
  expect(formatRelativeTime(NOW - 59_000, NOW)).toBe('just now');
});

test('the coarsest fitting unit is used', () => {
  expect(formatRelativeTime(NOW - 60_000, NOW)).toBe('1 minute ago');
  expect(formatRelativeTime(NOW - 15 * 60_000, NOW)).toBe('15 minutes ago');
  expect(formatRelativeTime(NOW - 90 * 60_000, NOW)).toBe('1 hour ago');
  expect(formatRelativeTime(NOW - 5 * 3_600_000, NOW)).toBe('5 hours ago');
  expect(formatRelativeTime(NOW - 86_400_000, NOW)).toBe('yesterday');
  expect(formatRelativeTime(NOW - 3 * 86_400_000, NOW)).toBe('3 days ago');
  expect(formatRelativeTime(NOW - 14 * 86_400_000, NOW)).toBe('2 weeks ago');
  expect(formatRelativeTime(NOW - 60 * 86_400_000, NOW)).toBe('2 months ago');
  // `numeric: 'auto'` words a single unit idiomatically: "yesterday", not "1 day ago".
  expect(formatRelativeTime(NOW - 400 * 86_400_000, NOW)).toBe('last year');
});

test('a missing timestamp is not rendered as 1970', () => {
  expect(formatRelativeTime(0, NOW)).toBe('unknown');
});

test('a timestamp ahead of the clock does not read as the future', () => {
  expect(formatRelativeTime(NOW + 5000, NOW)).toBe('just now');
});
