import type { PageName, Route } from './view.ts';
import { parsePath, routePath } from './view.ts';

export const SITE_NAME = 'elucidation.cheminfo.org';
export const SITE_URL = 'https://elucidation.cheminfo.org';

export interface PageMeta {
  /** What the tab, the search result and the shared card are titled. */
  title: string;
  /** The line under the title in a search result and a shared card. */
  description: string;
  /** The address this page is indexed under. */
  canonicalPath: string;
}

const META: Record<PageName, { title: string; description: string }> = {
  elucidate: {
    title: 'SECS — a structure from a 1H NMR spectrum and a formula',
    description:
      'Give a molecular formula and a 1H NMR spectrum, and get the structures that explain it — found by contrastive learning and an evolutionary search over the isomer space.',
  },
  examples: {
    title: 'Worked elucidation examples',
    description:
      'Ready-made elucidation challenges, each with its spectrum, its formula and the structure to find. Open one to watch the search run on a case whose answer is known.',
  },
  jobs: {
    title: 'Your elucidation runs',
    description:
      'Every elucidation you have started, with its progress and the structures it found. The list is kept in your browser, not on a server.',
  },
  about: {
    title: 'About SECS, and what to cite',
    description:
      'How structure elucidation from a 1H NMR spectrum works here, what the model was trained on, its limits, and the paper to cite when it helped.',
  },
  debug: {
    title: 'Debug',
    description: 'A development surface, not part of the tool.',
  },
};

/**
 * The pages a visitor is meant to find. The debug surface is left out, and so
 * is a run: a job id belongs to one browser and describes nothing to anybody
 * else.
 */
export const INDEXED_PAGES: readonly PageName[] = [
  'elucidate',
  'examples',
  'jobs',
  'about',
];

/**
 * The title, the description and the canonical address of a page.
 * @param route - The page, and the entity it names.
 * @returns What that page is called and what it is about.
 */
export function pageMetaFor(route: Route): PageMeta {
  const { title, description } = META[route.page];
  // A run or a challenge is opened inside a page, not indexed beside it.
  return {
    title,
    description,
    canonicalPath: routePath({ page: route.page, id: null }),
  };
}

/**
 * The address of each page a visitor is meant to find, and what it is called.
 * @returns Every indexed page, the elucidate page first.
 */
export function everyPage(): PageMeta[] {
  return INDEXED_PAGES.map((page) => pageMetaFor({ page, id: null }));
}

/**
 * What the tab says on the page currently open.
 * @param pathname - The path of the address.
 * @returns The title, site name included.
 */
export function documentTitle(pathname: string): string {
  return `${pageMetaFor(parsePath(pathname)).title} — ${SITE_NAME}`;
}
