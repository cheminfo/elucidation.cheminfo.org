const FORMATTER = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/** Largest unit first, so the loop below picks the coarsest one that still fits. */
const THRESHOLDS: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: 'year', ms: 365 * 86_400_000 },
  { unit: 'month', ms: 30 * 86_400_000 },
  { unit: 'week', ms: 7 * 86_400_000 },
  { unit: 'day', ms: 86_400_000 },
  { unit: 'hour', ms: 3_600_000 },
  { unit: 'minute', ms: 60_000 },
];

/**
 * How long ago an instant was, in words.
 *
 * A run is identified by its spectrum, so several rows in the history can share a
 * structure, a formula and a calendar date. Only the elapsed time tells them apart,
 * which a `toLocaleDateString()` of `19/07/2026` cannot.
 * @param timestamp - Epoch milliseconds. Zero means the time was never recorded.
 * @param now - Epoch milliseconds to measure against. Defaults to the current time.
 * @returns A phrase such as `15 minutes ago`, or `unknown` for a missing timestamp.
 */
export function formatRelativeTime(
  timestamp: number,
  now = Date.now(),
): string {
  if (timestamp <= 0) return 'unknown';
  const elapsed = now - timestamp;
  // A clock skew that puts the timestamp slightly ahead also lands here, which reads
  // better than "in 3 seconds".
  if (elapsed < 60_000) return 'just now';
  for (const { unit, ms } of THRESHOLDS) {
    if (elapsed >= ms) return FORMATTER.format(-Math.floor(elapsed / ms), unit);
  }
  return 'just now';
}
