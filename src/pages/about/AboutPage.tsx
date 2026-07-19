import { Button, Callout, Card } from '@blueprintjs/core';
import { useState } from 'react';

import { CITATION, CITATION_BIBTEX } from './citation.ts';

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
 * Explains the method and carries the citation for the paper this tool accompanies.
 * @returns The about page.
 */
export function AboutPage() {
  const [copied, setCopied] = useState(false);

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 860 }}>
      <Card style={{ display: 'grid', gap: 8 }}>
        <h2 style={{ margin: 0 }}>
          Structure elucidation from a 1H NMR spectrum
        </h2>
        <p style={{ margin: 0 }}>
          Give the tool a proton spectrum and a molecular formula, and it
          returns a ranked list of candidate structures with confidence scores.
          It combines a multimodal contrastive model, retrieval over a reference
          database, and an evolutionary search that can propose molecules absent
          from every database.
        </p>
      </Card>

      <div
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        }}
      >
        {STEPS.map((step) => (
          <Card key={step.title} compact style={{ display: 'grid', gap: 6 }}>
            <strong>{step.title}</strong>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              {step.body}
            </span>
          </Card>
        ))}
      </div>

      <Callout
        intent="primary"
        icon="info-sign"
        title="What this deployment does and does not do"
      >
        <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
          <li>
            Only 1H NMR is used. Carbon, IR and HSQC encoders exist but are not
            active here.
          </li>
          <li>
            A run takes roughly 20 to 45 minutes and the server reports no
            intermediate progress.
          </li>
          <li>
            Candidates are compared to a known answer ignoring stereochemistry:
            the method is not evaluated on stereo assignment.
          </li>
          <li>
            A run is identified by its spectrum alone, so the same file cannot
            be recomputed with a different formula or different settings.
          </li>
        </ul>
      </Callout>

      <Card style={{ display: 'grid', gap: 10 }}>
        <strong>How to cite</strong>
        <p style={{ margin: 0 }}>
          {CITATION.authors}. {CITATION.title}. <em>{CITATION.journal}</em>{' '}
          <strong>{CITATION.volume}</strong>, {CITATION.article} (
          {CITATION.year}).
        </p>
        <a href={CITATION.url} target="_blank" rel="noreferrer">
          doi:{CITATION.doi}
        </a>
        <pre
          style={{
            background: 'var(--code-bg)',
            padding: 12,
            borderRadius: 4,
            overflowX: 'auto',
            fontSize: 12,
            margin: 0,
          }}
        >
          {CITATION_BIBTEX}
        </pre>
        <div>
          <Button
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

      <Card style={{ display: 'grid', gap: 6 }}>
        <strong>Source code</strong>
        <a
          href="https://github.com/cheminfo/elucidation.cheminfo.org"
          target="_blank"
          rel="noreferrer"
        >
          This web interface
        </a>
        <a
          href="https://github.com/lamalab-org/secs-app"
          target="_blank"
          rel="noreferrer"
        >
          The elucidation backend
        </a>
      </Card>
    </div>
  );
}
