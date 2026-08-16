import { Icon, Tag } from '@blueprintjs/core';
import { useSignals } from '@preact/signals-react/runtime';
import { useEffect } from 'react';
import { CiteButton, EcosystemButton } from 'react-cheminfo/ui';

import { useJobPolling } from './api/usePolling.ts';
import { BrandMark, Wordmark } from './components/Brand.tsx';
import { useCompactHeader } from './components/useCompactHeader.ts';
import { SECS_PAPER } from './data/secsPaper.ts';
import { AboutPage } from './pages/about/AboutPage.tsx';
import { DebugPage } from './pages/debug/DebugPage.tsx';
import { ElucidatePage } from './pages/elucidate/ElucidatePage.tsx';
import { ExamplesPage } from './pages/examples/ExamplesPage.tsx';
import { JobsPage } from './pages/jobs/JobsPage.tsx';
import { activeJobId } from './state/data.ts';
import { startRunRestore } from './state/restore.ts';
import { hydrateRuns, runs } from './state/runs.ts';
import type { PageName } from './state/view.ts';
import { navigate, route, startRouting } from './state/view.ts';

const TABS: Array<{
  page: PageName;
  label: string;
  icon: 'lab-test' | 'grid-view' | 'history' | 'info-sign';
}> = [
  { page: 'elucidate', label: 'Elucidate', icon: 'lab-test' },
  { page: 'examples', label: 'Examples', icon: 'grid-view' },
  { page: 'jobs', label: 'Runs', icon: 'history' },
  { page: 'about', label: 'About', icon: 'info-sign' },
];

/**
 * Application shell: the header, the routing, and the open page.
 * @returns The app.
 */
export function App() {
  useSignals();
  useEffect(() => startRouting(), []);
  useEffect(() => {
    startRunRestore();
    void hydrateRuns();
  }, []);
  // Polling lives here, not on a page, so unfinished runs keep updating while the user
  // browses the examples or reads the about page.
  useJobPolling(activeJobId.value);

  const current = route.value.page;

  return (
    <>
      <Header current={current} />
      <main className="page">
        {current === 'elucidate' && <ElucidatePage />}
        {current === 'examples' && <ExamplesPage />}
        {current === 'jobs' && <JobsPage />}
        {current === 'about' && <AboutPage />}
        {current === 'debug' && <DebugPage />}
      </main>
    </>
  );
}

function Header(props: { current: PageName }) {
  useSignals();
  const { current } = props;
  const compact = useCompactHeader();
  const runningCount = runs.value.filter(
    (run) => run.state === 'pending' || run.state === 'running',
  ).length;

  return (
    <>
      <header className="app-header">
        <div className="app-header__inner">
          <a
            href="#/elucidate"
            className="brand"
            title="elucidation.cheminfo.org"
          >
            <BrandMark />
            <Wordmark />
          </a>
          <nav className="app-header-nav">
            {TABS.map((tab) => (
              <button
                key={tab.page}
                type="button"
                className={
                  current === tab.page
                    ? 'nav-link nav-link--active'
                    : 'nav-link'
                }
                onClick={() =>
                  navigate(
                    tab.page,
                    // Keep the open run in the hash so a reload comes back to it.
                    tab.page === 'elucidate'
                      ? (activeJobId.value ?? undefined)
                      : undefined,
                  )
                }
              >
                <Icon icon={tab.icon} size={14} />
                {tab.label}
                {tab.page === 'jobs' && runningCount > 0 ? (
                  <Tag round minimal intent="primary">
                    {runningCount}
                  </Tag>
                ) : null}
              </button>
            ))}
          </nav>
          <div className="app-header-actions">
            <a
              className="nav-link"
              href="https://github.com/cheminfo/elucidation.cheminfo.org"
              target="_blank"
              rel="noreferrer"
              title="Source of this web interface"
            >
              <Icon icon="git-repo" size={14} />
              {compact ? null : 'Source'}
            </a>
            <CiteButton reference={SECS_PAPER} compact={compact} />
            <EcosystemButton compact={compact} />
          </div>
        </div>
      </header>
      <p className="app-tagline">
        SECS · structure elucidation from NMR spectra
      </p>
    </>
  );
}
