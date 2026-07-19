import { signal } from '@preact/signals-react';

export type PageName = 'elucidate' | 'examples' | 'jobs' | 'about' | 'debug';

export interface Route {
  page: PageName;
  /** Challenge id on the examples page, job id on the elucidate and jobs pages. */
  id: string | null;
}

const PAGES = new Set<PageName>([
  'elucidate',
  'examples',
  'jobs',
  'about',
  'debug',
]);
const DEFAULT_ROUTE: Route = { page: 'elucidate', id: null };

export const route = signal<Route>(parseHash(globalThis.location?.hash ?? ''));

/**
 * Navigates by writing the hash, which drives the route signal through the hash listener.
 * @param page - Destination page.
 * @param id - Optional entity id to deep-link.
 */
export function navigate(page: PageName, id?: string): void {
  const hash = id === undefined ? `#/${page}` : `#/${page}/${id}`;
  if (globalThis.location !== undefined) {
    globalThis.location.hash = hash;
  } else {
    route.value = { page, id: id ?? null };
  }
}

/**
 * Starts mirroring `window.location.hash` into the route signal.
 * @returns A function that stops listening.
 */
export function startRouting(): () => void {
  const onHashChange = (): void => {
    route.value = parseHash(globalThis.location.hash);
  };
  globalThis.addEventListener('hashchange', onHashChange);
  onHashChange();
  return () => {
    globalThis.removeEventListener('hashchange', onHashChange);
  };
}

/**
 * Parses a location hash into a route.
 * @param hash - The raw hash, with or without the leading `#`.
 * @returns The route, falling back to the elucidate page.
 */
export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [page, id] = parts;
  if (page === undefined || !PAGES.has(page as PageName)) return DEFAULT_ROUTE;
  return { page: page as PageName, id: id ?? null };
}
