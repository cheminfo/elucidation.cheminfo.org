import { Button, Card, Icon, Tag } from '@blueprintjs/core';
import { CiteButton, CollapsibleSection } from 'react-cheminfo/ui';

import { CitationLine } from '../../components/CitationLine.tsx';
import { SECS_PAPER } from '../../data/secsPaper.ts';
import { navigate } from '../../state/view.ts';

/** The four steps between a spectrum and a ranked list of structures. */
const STEPS = [
  {
    title: '1. Embed the spectrum',
    body: 'Encoders trained with a contrastive objective place a spectrum and its molecule at nearly the same point in a shared space, so a measured spectrum can be used directly as a query for molecules.',
  },
  {
    title: '2. Retrieve reference molecules',
    body: 'The spectrum embedding is matched against an index built from PubChem, returning the known compounds whose predicted spectra look most like the measurement.',
  },
  {
    title: '3. Evolve new candidates',
    body: 'Because the compound may not be in any database, a graph genetic algorithm seeds itself with those hits and mutates molecular graphs. Fitness is similarity to the spectrum, penalised for departing from the given molecular formula.',
  },
  {
    title: '4. Rank with confidence',
    body: 'The final pool is ranked by similarity score. Scores are comparable within a run and act as calibrated confidence estimates.',
  },
];

/**
 * The landing state of the workspace, shown until a spectrum is loaded.
 *
 * It stays deliberately short: it names what the tool does and points at the two ways
 * in, then gets out of the way. The method is folded away under its own heading, and it
 * does not offer a second drop target — the one in the input panel to the left is the
 * only one, and this panel points at it.
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
              color: 'var(--text-muted)',
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
            body="Drop a JCAMP-DX file or a whole Bruker or Varian folder into the panel on the left — a FID is transformed for you — add the molecular formula, and start a run."
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

        <CollapsibleSection
          title="How the method works"
          icon="info-sign"
          defaultOpen={false}
        >
          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            }}
          >
            {STEPS.map((step) => (
              <div key={step.title} style={{ display: 'grid', gap: 6 }}>
                <strong style={{ fontSize: 13 }}>{step.title}</strong>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {step.body}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
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
        background: 'var(--surface-raised)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon icon={icon} intent="primary" />
        <strong>{title}</strong>
      </div>
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{body}</span>
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
  return (
    <Card
      compact
      style={{ display: 'grid', gap: 8, justifyItems: 'start' }}
      data-testid="home-citation"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon icon="book" color="var(--text-muted)" />
        <strong style={{ fontSize: 13 }}>
          If you use this tool, please cite
        </strong>
      </div>
      <p style={{ margin: 0, fontSize: 13 }}>
        <CitationLine reference={SECS_PAPER} />
      </p>
      <CiteButton reference={SECS_PAPER} placement="bottom-start" />
    </Card>
  );
}
