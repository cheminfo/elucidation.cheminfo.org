import { Card, Tag, Tooltip } from '@blueprintjs/core';
import { Structure } from 'react-cheminfo/structure';
import { ClickToCopy } from 'react-cheminfo/ui';
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
          <ClickToCopy
            as="div"
            value={candidate.score.toFixed(3)}
            label="similarity score"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {candidate.score.toFixed(3)}
          </ClickToCopy>
        </div>
        {/* Inset by the room the copyable score keeps for its glyph, so the track
            ends where the number above it ends. */}
        <div
          data-testid="score-bar"
          style={{
            height: 4,
            marginRight: 22,
            background: 'var(--bar-track)',
            borderRadius: 2,
          }}
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

      {/* A block target, not an inline one: the code is cut with an ellipsis, so an
          inline glyph floating past its right edge would be clipped away. */}
      <ClickToCopy
        as="div"
        value={candidate.smiles}
        label="SMILES"
        style={{ minWidth: 0 }}
      >
        <code
          data-testid="candidate-smiles"
          style={{
            display: 'block',
            fontSize: 12,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {candidate.smiles}
        </code>
      </ClickToCopy>
    </Card>
  );
}
