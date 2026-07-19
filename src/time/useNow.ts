import { useEffect, useState } from 'react';

/**
 * A timestamp that advances on an interval, so relative times do not go stale.
 *
 * Without it a row rendered as `2 minutes ago` keeps saying that for as long as the page
 * stays open, because nothing else re-renders a finished run.
 * @param intervalMs - How often to tick. Defaults to 30 seconds.
 * @returns The current epoch milliseconds.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = globalThis.setInterval(() => setNow(Date.now()), intervalMs);
    return () => globalThis.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
