/**
 * Every address the site answers, with the name and the sentence it is indexed
 * under.
 *
 * One table, read by three things: the build, which writes an HTML file per
 * entry and the sitemap listing them; the head injector; and the running app,
 * which retitles the tab after an in-app move. A page missing from here is a
 * page a search engine only ever sees as the home page.
 *
 * The machinery that reads it is `react-cheminfo/core` and
 * `react-cheminfo/vite`; what belongs to this site is the prose below.
 */

import type { RouteMeta } from 'react-cheminfo/core';

/**
 * The pages a visitor is meant to find, the elucidate page first.
 *
 * A run is left out: a job id belongs to one browser and describes nothing to
 * anybody else, so it is opened inside a page rather than indexed beside it.
 */
export const PAGE_ROUTES: readonly RouteMeta[] = [
  {
    path: '/',
    title: 'SECS — a structure from a 1H NMR spectrum and a formula',
    description:
      'Give a molecular formula and a 1H NMR spectrum, and get a ranked list of candidate structures, found by contrastive learning and an evolutionary search.',
  },
  {
    path: '/examples',
    title: 'Worked elucidation examples',
    description:
      'Twenty worked elucidation challenges from the paper, each with its 1H NMR spectrum, its molecular formula and the ranked candidate structures SECS found.',
  },
  {
    path: '/jobs',
    title: 'Your elucidation runs',
    description:
      'Every elucidation you have started, with its progress and the structures it found. The list is kept in your browser, not on a server.',
  },
  {
    path: '/about',
    title: 'About SECS, and what to cite',
    description:
      'How structure elucidation from a 1H NMR spectrum works here, what the model was trained on, its limits, and the paper to cite when it helped.',
  },
];

/**
 * The debug surface, which is not one of the pages above: it is absent from the
 * sitemap and `robots.txt` keeps it out of the index. It still names itself in
 * the tab while it is open rather than borrowing the home page's title.
 */
const DEBUG_ROUTE: RouteMeta = {
  path: '/debug',
  title: 'Debug',
  description: 'A development surface, not part of the tool.',
};

/** Every address the app can be on, the debug surface included. */
export const APP_ROUTES: readonly RouteMeta[] = [...PAGE_ROUTES, DEBUG_ROUTE];
