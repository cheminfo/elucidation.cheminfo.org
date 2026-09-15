import { Card, Tag, Tooltip } from '@blueprintjs/core';
import { Structure } from 'react-cheminfo/structure';
import { CopyButton } from 'react-cheminfo/ui';
import { MF } from 'react-mf';

import type { RankedCandidate } from '../chemistry/candidates.ts';

export interface CandidateCardProps {
  candidate: RankedCandidate;
  /** Highest score in the list, used to scale the score bar. */
  topScore: number;
}

/**
 * One ranked candidate: structure, rank, score and provenance.
 *
 * The score is a cosine similarity between the spectrum embedding and the molecule
 * embedding, so it is comparable within a run but not across runs. The bar is therefore
 * scaled against the best candidate of this run rather than against an absolute scale.
 * @param props - The candidate and the run's top score.
 * @returns The card.
 */
export function CandidateCard(props: CandidateCardProps) {
  const { candidate, topScore } = props;
  const fraction = topScore > 0 ? Math.max(0, candidate.score / topScore) : 0;

  return (
    <Card
      compact
      data-testid="candidate-card"
      data-expected={candidate.isExpected ? 'true' : 'false'}
      style={{
        display: 'grid',
        gap: 8,
        borderLeft: `4px solid ${candidate.isExpected ? 'var(--success)' : 'transparent'}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
        }}
      >
        <Tag minimal round>
          #{candidate.rank}
        </Tag>
        <MF mf={candidate.mf} style={{ fontWeight: 600 }} />
        <span style={{ flex: 1 }} />
        {candidate.isExpected && (
          <Tag intent="success" icon="tick-circle">
            Known answer
          </Tag>
        )}
        {candidate.retrieved !== null && (
          <Tooltip
            content={
              candidate.retrieved
                ? 'Returned by the retrieval step, from the PubChem reference index'
                : 'Proposed by the genetic algorithm'
            }
          >
            <Tag minimal intent={candidate.retrieved ? 'primary' : 'warning'}>
              {candidate.retrieved ? 'Retrieved' : 'Generated'}
            </Tag>
          </Tooltip>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          background: 'var(--surface)',
          borderRadius: 4,
          padding: 4,
        }}
      >
        <Structure smiles={candidate.smiles} width={200} height={140} />
      </div>

      <div style={{ display: 'grid', gap: 4 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
          }}
          title="Cosine similarity between the spectrum and the molecule embedding"
        >
          <span>Similarity</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {candidate.score.toFixed(3)}
          </span>
        </div>
        <div
          style={{ height: 4, background: 'var(--bar-track)', borderRadius: 2 }}
        >
          <div
            style={{
              height: '100%',
              width: `${(fraction * 100).toFixed(1)}%`,
              background: candidate.isExpected
                ? 'var(--success)'
                : 'var(--accent)',
              borderRadius: 2,
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <code
          style={{
            flex: 1,
            fontSize: 12,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={candidate.smiles}
        >
          {candidate.smiles}
        </code>
        <CopyButton
          content={candidate.smiles}
          minimal
          small
          title="Copy SMILES"
        />
      </div>
    </Card>
  );
}
