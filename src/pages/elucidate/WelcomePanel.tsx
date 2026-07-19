import { Button, Card, Icon, Tag } from '@blueprintjs/core';
import { useState } from 'react';

import { navigate } from '../../state/view.ts';
import { CITATION, CITATION_BIBTEX } from '../about/citation.ts';

/**
 * The landing state of the workspace, shown until a spectrum is loaded.
 *
 * It stays deliberately short: it names what the tool does and points at the two ways
 * in, then gets out of the way. The method itself is explained on the About page rather
 * than repeated here, and it does not offer a second drop target — the one in the input
 * panel to the left is the only one, and this panel points at it.
 * @returns The welcome panel.
 */
export function WelcomePanel() {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.25 }}>
            Find the structure behind a <sup>1</sup>H NMR spectrum
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              color: 'var(--muted)',
              maxWidth: '62ch',
            }}
          >
            Give SECS a proton spectrum and a molecular formula. It searches a
            reference database and evolves new molecules from the hits, then
            returns a ranked list of candidate structures with confidence
            scores.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          }}
        >
          <PathCard
            icon="arrow-left"
            title="Use your own spectrum"
            body="Drop a JCAMP-DX, Bruker, JEOL or Varian file into the panel on the left, add the molecular formula, and start a run."
            note="A run takes 20 to 45 minutes."
          />
          <PathCard
            icon="grid-view"
            title="Look at worked examples"
            body="Twenty experimental spectra from the paper, each with the ranked candidates the model produced. Nothing to wait for."
            action={{
              text: 'Browse examples',
              onClick: () => navigate('examples'),
            }}
          />
        </div>

        <div>
          <Button
            variant="minimal"
            size="small"
            icon="info-sign"
            text="How the method works"
            onClick={() => navigate('about')}
          />
        </div>
      </Card>

      <CitationCard />
    </div>
  );
}

interface PathCardProps {
  icon: 'arrow-left' | 'grid-view';
  title: string;
  body: string;
  note?: string;
  action?: { text: string; onClick: () => void };
}

function PathCard(props: PathCardProps) {
  const { icon, title, body, note, action } = props;
  return (
    <div
      style={{
        display: 'grid',
        gap: 8,
        alignContent: 'start',
        padding: 16,
        borderRadius: 6,
        border: '1px solid var(--border)',
        background: 'var(--panel-bg)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon icon={icon} intent="primary" />
        <strong>{title}</strong>
      </div>
      <span style={{ fontSize: 13, color: 'var(--muted)' }}>{body}</span>
      {note !== undefined && (
        <Tag minimal icon="time">
          {note}
        </Tag>
      )}
      {action !== undefined && (
        <div>
          <Button
            intent="primary"
            text={action.text}
            onClick={action.onClick}
          />
        </div>
      )}
    </div>
  );
}

function CitationCard() {
  const [copied, setCopied] = useState(false);

  return (
    <Card
      compact
      style={{ display: 'grid', gap: 8 }}
      data-testid="home-citation"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon icon="book" color="var(--muted)" />
        <strong style={{ fontSize: 13 }}>
          If you use this tool, please cite
        </strong>
      </div>
      <p style={{ margin: 0, fontSize: 13 }}>
        {CITATION.authors} {CITATION.title}. <em>{CITATION.journal}</em>{' '}
        <strong>{CITATION.volume}</strong>, {CITATION.article} ({CITATION.year}
        ).
      </p>
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <a
          href={CITATION.url}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 13 }}
        >
          doi:{CITATION.doi}
        </a>
        <Button
          variant="minimal"
          size="small"
          icon={copied ? 'tick' : 'duplicate'}
          text={copied ? 'Copied' : 'Copy BibTeX'}
          onClick={() => {
            void navigator.clipboard?.writeText(CITATION_BIBTEX);
            setCopied(true);
            globalThis.setTimeout(() => setCopied(false), 2000);
          }}
        />
      </div>
    </Card>
  );
}
