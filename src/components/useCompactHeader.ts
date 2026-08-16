import { useSyncExternalStore } from 'react';

// Below this the bar has run out of room: the utilities keep their icons and
// give up their labels rather than pushing the pages off the edge.
const NARROW = '(max-width: 1000px)';

function subscribe(onChange: () => void): () => void {
  const query = globalThis.matchMedia(NARROW);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function isNarrow(): boolean {
  return globalThis.matchMedia(NARROW).matches;
}

/**
 * Whether the header utilities should be reduced to their icons.
 * @returns True on a window too narrow to write their labels.
 */
export function useCompactHeader(): boolean {
  return useSyncExternalStore(subscribe, isNarrow, () => false);
}
