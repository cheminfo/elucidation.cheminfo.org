import { effect } from '@preact/signals-react';

import { SITE_URL, documentTitle } from './pageMeta.ts';
import { route, routePath } from './view.ts';

/**
 * Keep the tab and the canonical address in step with the page on screen. The
 * build already titles each file it wrote; this is what a move inside the app
 * changes, and what a crawler rendering the page reads afterwards.
 * Called once, before anything is rendered.
 */
export function startDocumentMeta(): void {
  effect(() => {
    writeDocumentMeta(routePath({ page: route.value.page, id: null }));
  });
}

/**
 * Write the tab and the canonical address of one page.
 * @param path - The address of the page on screen.
 */
export function writeDocumentMeta(path: string): void {
  if (typeof document === 'undefined') return;

  document.title = documentTitle(path);
  canonicalLink().href = `${SITE_URL}${path}`;
}

function canonicalLink(): HTMLLinkElement {
  const existing = document.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );
  if (existing) return existing;

  const link = document.createElement('link');
  link.rel = 'canonical';
  document.head.append(link);
  return link;
}
