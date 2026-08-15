import { Icon, Tag } from '@blueprintjs/core';
import { useSignals } from '@preact/signals-react/runtime';
import { useEffect } from 'react';

import { useJobPolling } from './api/usePolling.ts';
import { BrandMark, Wordmark } from './components/Brand.tsx';
import { AboutPage } from './pages/about/AboutPage.tsx';
import { CITATION } from './pages/about/citation.ts';
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
 * Application shell: navigation, routing and the citation footer.
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
  const runningCount = runs.value.filter(
    (run) => run.state === 'pending' || run.state === 'running',
  ).length;

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}
    >
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
        </div>
      </header>
      <p className="app-tagline">
        SECS · structure elucidation from NMR spectra
      </p>

      <main style={{ flex: 1, padding: 16, minWidth: 0 }}>
        {current === 'elucidate' && <ElucidatePage />}
        {current === 'examples' && <ExamplesPage />}
        {current === 'jobs' && <JobsPage />}
        {current === 'about' && <AboutPage />}
        {current === 'debug' && <DebugPage />}
      </main>

      <footer
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          fontSize: 12,
          color: 'var(--muted)',
        }}
      >
        {/* Kept to a short reference line: the full citation, with BibTeX, lives on
            the home page and on About, and repeating it in full on every screen was
            just noise. */}
        SECS · {CITATION.authors} <em>{CITATION.journal}</em>{' '}
        <strong>{CITATION.volume}</strong>, {CITATION.article} ({CITATION.year})
        ·{' '}
        <a href={CITATION.url} target="_blank" rel="noreferrer">
          doi:{CITATION.doi}
        </a>{' '}
        ·{' '}
        <a
          href="https://github.com/cheminfo/elucidation.cheminfo.org"
          target="_blank"
          rel="noreferrer"
        >
          Source
        </a>
      </footer>
    </div>
  );
}
