import { Card, Tag } from '@blueprintjs/core';
import { MF } from 'react-mf';
import { IdcodeSvgRenderer } from 'react-ocl';

import type { ChallengeSummary } from '../../challenges/load.ts';

export interface ChallengeCardProps {
  challenge: ChallengeSummary;
  onOpen: () => void;
}

/**
 * One reference challenge in the gallery: the true structure and how the model did.
 * @param props - The challenge and an open handler.
 * @returns The card.
 */
export function ChallengeCard(props: ChallengeCardProps) {
  const { challenge, onOpen } = props;
  const solved = challenge.positionNoStereo >= 0;

  return (
    <Card
      interactive
      compact
      onClick={onOpen}
      data-testid="challenge-card"
      style={{ display: 'grid', gap: 8, alignContent: 'start' }}
    >
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <IdcodeSvgRenderer
          idcode={challenge.idCode}
          width={200}
          height={130}
          autoCrop
        />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
        }}
      >
        <MF mf={challenge.mf} style={{ fontWeight: 600 }} />
        <span style={{ flex: 1 }} />
        <Tag
          minimal
          intent={solved ? 'success' : 'danger'}
          icon={solved ? 'tick-circle' : 'cross-circle'}
        >
          {solved ? `Rank ${challenge.positionNoStereo + 1}` : 'Not found'}
        </Tag>
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
        {challenge.candidates.length} candidates · {challenge.nbHydrogens} H ·{' '}
        {challenge.monoisotopicMass.toFixed(3)} Da
      </div>
    </Card>
  );
}
