import type { IconName } from '@blueprintjs/core';
import { Tag } from '@blueprintjs/core';
import { effect } from '@preact/signals-react';
import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useState } from 'react';
import { parseShareConfig, startDocumentMeta } from 'react-cheminfo/core';
import type { NavItem } from 'react-cheminfo/ui';
import {
  CiteButton,
  EcosystemButton,
  NavLink,
  SiteFooter,
  SiteHeader,
  SiteTheme,
  useCompactHeader,
} from 'react-cheminfo/ui';

import { ABOUT } from './about.ts';
import { useJobPolling } from './api/usePolling.ts';
import { AboutPage } from './pages/about/AboutPage.tsx';
import { DebugPage } from './pages/debug/DebugPage.tsx';
import { ElucidatePage } from './pages/elucidate/ElucidatePage.tsx';
import { ExamplesPage } from './pages/examples/ExamplesPage.tsx';
import { JobsPage } from './pages/jobs/JobsPage.tsx';
import { APP_ROUTES } from './seo/routes.ts';
import { activeJobId } from './state/data.ts';
import { startRunRestore } from './state/restore.ts';
import { hydrateRuns, runs } from './state/runs.ts';
import type { PageName } from './state/view.ts';
import { navigate, route, routePath, startRouting } from './state/view.ts';

const SITE_ID = 'elucidation';

// The pages, in the order the bar lists them. About is not among them: it is
// about the site rather than a place in the tool, so it sits with the utilities.
const PAGES: Array<{ page: PageName; label: string; icon: IconName }> = [
  { page: 'elucidate', label: 'Elucidate', icon: 'lab-test' },
  { page: 'examples', label: 'Examples', icon: 'grid-view' },
  { page: 'jobs', label: 'Runs', icon: 'history' },
];

/**
 * Application shell: the header, the routing, and the open page.
 * @returns The app.
 */
export function App() {
  useSignals();
  useEffect(() => startRouting(), []);
  useEffect(
    () =>
      startDocumentMeta({
        site: SITE_ID,
        routes: APP_ROUTES,
        // The id a route carries is dropped: a run and a challenge are opened
        // inside a page, not indexed beside it.
        url: () => routePath({ page: route.value.page, id: null }),
        follow: effect,
      }),
    [],
  );
  useEffect(() => {
    startRunRestore();
    void hydrateRuns();
  }, []);
  // Polling lives here, not on a page, so unfinished runs keep updating while the user
  // browses the examples or reads the about page.
  useJobPolling(activeJobId.value);

  const current = route.value.page;
  const compact = useCompactHeader();
  // Read once: a run the tool opens rewrites the address without the query, and
  // a framed page must not grow its chrome back when it does.
  const [share] = useState(() =>
    parseShareConfig(globalThis.location.search, { parts: [] }),
  );

  return (
    <>
      <SiteTheme siteId={SITE_ID} />

      <div className="app-screen">
        <SiteHeader
          siteId={SITE_ID}
          embedded={share.embed}
          markSize={26}
          nav={navItems()}
          activeId={current}
          homeHref="/"
          onHome={() => {
            navigate('elucidate');
          }}
          actions={
            <>
              <NavLink
                item={{
                  id: 'about',
                  label: compact ? null : 'About',
                  icon: 'info-sign',
                  title: 'About',
                  href: routePath({ page: 'about', id: null }),
                  onSelect: () => {
                    navigate('about');
                  },
                }}
                active={current === 'about'}
              />
              <CiteButton works={ABOUT.cite ?? []} compact={compact} />
              <EcosystemButton compact={compact} currentSiteId={SITE_ID} />
            </>
          }
        />
        {share.embed ? null : (
          <p className="app-tagline">
            SECS · structure elucidation from NMR spectra
          </p>
        )}

        <main className="page">
          {current === 'elucidate' && <ElucidatePage />}
          {current === 'examples' && <ExamplesPage />}
          {current === 'jobs' && <JobsPage />}
          {current === 'about' && <AboutPage />}
          {current === 'debug' && <DebugPage />}
        </main>
      </div>

      <SiteFooter siteId={SITE_ID} embedded={share.embed} />
    </>
  );
}

/**
 * The pages of the bar, each a real address as well as an action, so a crawler
 * walks the site and a middle click opens a tab of its own.
 * @returns One entry per page, the runs entry carrying what is still running.
 */
function navItems(): NavItem[] {
  const runningCount = runs.value.filter(
    (run) => run.state === 'pending' || run.state === 'running',
  ).length;

  return PAGES.map((tab) => ({
    id: tab.page,
    label: tab.label,
    icon: tab.icon,
    href: routePath({ page: tab.page, id: null }),
    after:
      tab.page === 'jobs' && runningCount > 0 ? (
        <Tag round minimal intent="primary">
          {runningCount}
        </Tag>
      ) : null,
    onSelect: () => {
      navigate(
        tab.page,
        // Keep the open run in the address so a reload comes back to it.
        tab.page === 'elucidate' ? (activeJobId.value ?? undefined) : undefined,
      );
    },
  }));
}
