import react from '@vitejs/plugin-react';
import { cheminfoBuildInfo, cheminfoPrerender } from 'react-cheminfo/vite';
import { defineConfig } from 'vite';

import { PAGE_ROUTES } from './src/seo/routes.ts';

/**
 * Default dev port derived from the project creation date (2026-07-18):
 * 6 + 07 + 18 = 60718, which is over 60000, so subtract 50000.
 */
const PORT = Number(process.env.PORT) || 10718;

/**
 * In production the SPA is served same-origin with the FastAPI backend by Traefik,
 * so the app always calls relative paths. In dev we proxy those same paths to a real
 * deployment, which keeps the client code free of environment branching.
 */
const API_TARGET = process.env.API_TARGET || 'https://elucidation.cheminfo.org';

// `/jobs` is also a page of the app, and only the API's per-run endpoints live
// under it — so the proxy takes `/jobs/{id}/...` and leaves the bare path to the
// SPA, which would otherwise be answered by the API and 404.
const API_PATHS = [
  '/submit',
  '^/jobs/.+',
  '/queue',
  '/workers',
  '/openapi.json',
];

export default defineConfig({
  // The build carries no mount path. Every asset is written relative, so the
  // one `dist` serves this site's own host and a path of a shared one without
  // being rebuilt: the `<base>` the page carries is what resolves them, and the
  // router reads its mount back off that.
  base: './',
  plugins: [
    react(),
    cheminfoBuildInfo(),
    cheminfoPrerender({
      site: 'elucidation',
      routes: PAGE_ROUTES,
      // The debug surface is a development page, not part of the tool.
      robots: ['/debug'],
      category: 'ScienceApplication',
      operatingSystem: 'Any',
      description:
        'Elucidate molecular structures from a 1H NMR spectrum and a molecular formula, using contrastive learning and an evolutionary search over the isomer space.',
      noscript: {
        // The build bakes in no mount, so the crawl path is written against
        // the `<base>` the page carries rather than the root of a host this
        // deployment may only share.
        hrefs: 'relative',
        heading: 'elucidation.cheminfo.org — SECS',
        intro:
          'Give a molecular formula and a 1H NMR spectrum, and get the structures that explain it, found by contrastive learning and an evolutionary search over the isomer space. The tool needs JavaScript.',
        // A crawler that runs no script has no other path from one of our
        // tools to the next.
        ecosystem: true,
      },
    }),
  ],
  server: {
    port: PORT,
    proxy: Object.fromEntries(
      API_PATHS.map((path) => [
        path,
        { target: API_TARGET, changeOrigin: true, secure: true },
      ]),
    ),
  },
});
