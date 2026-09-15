import { signal } from '@preact/signals-react';
import { adoptLegacyHashAddress as legacyHashAddress } from 'react-cheminfo/core';

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

export const route = signal<Route>(
  parsePath(globalThis.location?.pathname ?? '/'),
);

/**
 * Navigates by writing the address, which drives the route signal. Routing is
 * path based through the History API, so every page is an address a crawler can
 * fetch and a link can be handed out — a `#` is dropped by half the tools that
 * pass links around, and the server never sees it.
 * @param page - Destination page.
 * @param id - Optional entity id to deep-link.
 */
export function navigate(page: PageName, id?: string): void {
  const next: Route = { page, id: id ?? null };
  if (globalThis.location !== undefined) {
    globalThis.history.pushState(null, '', routePath(next));
  }
  route.value = next;
}

/**
 * The address of a route. The elucidate page is the home page rather than a
 * page beside it, so the site has one address for it instead of two holding the
 * same thing.
 * @param route - The page, and the entity it names.
 * @returns The path, starting with a slash.
 */
export function routePath(route: Route): string {
  const base = route.page === 'elucidate' ? '' : `/${route.page}`;
  const path = route.id === null ? base : `${base}/${route.id}`;
  return path || '/';
}

/**
 * Starts mirroring the address into the route signal.
 * @returns A function that stops listening.
 */
export function startRouting(): () => void {
  const onPopState = (): void => {
    route.value = parsePath(globalThis.location.pathname);
  };
  globalThis.addEventListener('popstate', onPopState);
  onPopState();
  return () => {
    globalThis.removeEventListener('popstate', onPopState);
  };
}

/**
 * Parses an address into a route.
 * @param pathname - The path of the address, e.g. `/examples/2b277b5e`.
 * @returns The route, falling back to the elucidate page.
 */
export function parsePath(pathname: string): Route {
  const parts = pathname.split('/').filter(Boolean);
  const [page, id] = parts;
  if (page === undefined || !PAGES.has(page as PageName)) {
    // The home page is the elucidate page, and it may carry a job id.
    return page === undefined ? DEFAULT_ROUTE : { page: 'elucidate', id: page };
  }
  return { page: page as PageName, id: id ?? null };
}

/**
 * Put the address a legacy hash link meant in the bar, before anything reads
 * it. Called once, at startup.
 *
 * Those links are in bookmarks and in other people's pages, so they are
 * answered rather than dropped. The adopted path goes back through the site's
 * own router, so a hash link to the elucidate page lands on the one address the
 * home page has rather than on a second one.
 */
export function adoptLegacyHashAddress(): void {
  const location = globalThis.location;
  if (location === undefined) return;
  const adopted = legacyHashAddress(
    `${location.pathname}${location.search}${location.hash}`,
  );
  if (adopted === null) return;
  const query = adopted.indexOf('?');
  const path = query === -1 ? adopted : adopted.slice(0, query);
  const search = query === -1 ? '' : adopted.slice(query);
  globalThis.history.replaceState(
    null,
    '',
    `${routePath(parsePath(path))}${search}`,
  );
}
