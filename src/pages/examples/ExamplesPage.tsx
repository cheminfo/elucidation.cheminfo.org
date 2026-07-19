import { Card, NonIdealState, Spinner, Tag } from '@blueprintjs/core';
import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useState } from 'react';
import { MF } from 'react-mf';

import type { ChallengeSummary } from '../../challenges/load.ts';
import {
  loadChallengeIndex,
  loadChallengeSpectrum,
} from '../../challenges/load.ts';
import { rankCandidates } from '../../chemistry/candidates.ts';
import { CandidateList } from '../../components/CandidateList.tsx';
import { SpectrumPlot } from '../../components/SpectrumPlot.tsx';
import { displayIntegral } from '../../spectrum/integral.ts';
import {
  activeJobId,
  challengeCandidates,
  currentSpectrum,
  expectedStructure,
  mfInput,
  rankedCandidates,
} from '../../state/data.ts';
import { navigate, route } from '../../state/view.ts';

import { ChallengeCard } from './ChallengeCard.tsx';

/**
 * Browsable gallery of the reference challenges published with the paper.
 *
 * Every challenge carries its precomputed candidate list, so opening one is instant and
 * makes no call to the elucidation API. This is the fastest way to understand what the
 * method does before committing a spectrum to a half-hour run.
 * @returns The examples page.
 */
export function ExamplesPage() {
  useSignals();
  const [challenges, setChallenges] = useState<ChallengeSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedId = route.value.id;

  useEffect(() => {
    loadChallengeIndex()
      .then(setChallenges)
      .catch((error_: unknown) => {
        setError(error_ instanceof Error ? error_.message : String(error_));
      });
  }, []);

  const selected = challenges?.find((item) => item.id === selectedId) ?? null;
  useChallengeSelection(selected);

  if (error !== null) {
    return (
      <NonIdealState
        icon="error"
        title="Could not load the examples"
        description={error}
      />
    );
  }
  if (challenges === null) {
    return (
      <NonIdealState icon={<Spinner />} title="Loading reference challenges" />
    );
  }

  const solved = challenges.filter((item) => item.positionNoStereo >= 0).length;

  if (selected !== null) {
    return <SelectedChallenge challenge={selected} />;
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card style={{ display: 'grid', gap: 6 }}>
        <strong>Reference challenges</strong>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          {challenges.length} experimental spectra of compounds the model had
          never seen, each with the ranked candidates it produced. The correct
          structure was recovered for {solved} of them.
        </p>
      </Card>

      <div
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        }}
      >
        {challenges.map((challenge) => (
          <ChallengeCard
            key={challenge.id}
            challenge={challenge}
            onOpen={() => navigate('examples', challenge.id)}
          />
        ))}
      </div>
    </div>
  );
}

function SelectedChallenge(props: { challenge: ChallengeSummary }) {
  useSignals();
  const { challenge } = props;
  const spectrum = currentSpectrum.value;
  const ranked = rankedCandidates.value;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <a href="#/examples" className="bp6-button bp6-minimal">
          ← All challenges
        </a>
        <MF mf={challenge.mf} style={{ fontWeight: 600 }} />
        <Tag minimal>{challenge.source}</Tag>
        <Tag
          minimal
          intent={challenge.positionNoStereo >= 0 ? 'success' : 'danger'}
          icon={
            challenge.positionNoStereo >= 0 ? 'tick-circle' : 'cross-circle'
          }
        >
          {challenge.positionNoStereo >= 0
            ? `Solved at rank ${challenge.positionNoStereo + 1}`
            : 'Not solved'}
        </Tag>
      </Card>

      {spectrum !== null && (
        <Card style={{ display: 'grid', gap: 8 }}>
          <strong>Experimental 1H spectrum</strong>
          <SpectrumPlot spectrum={spectrum.spectrum} showIntegral={false} />
        </Card>
      )}

      {ranked !== null && (
        <Card style={{ minWidth: 0 }}>
          <CandidateList ranked={ranked} hasExpected />
        </Card>
      )}
    </div>
  );
}

function useChallengeSelection(challenge: ChallengeSummary | null): void {
  useEffect(() => {
    if (challenge === null) {
      challengeCandidates.value = null;
      return;
    }
    let cancelled = false;
    activeJobId.value = null;
    mfInput.value = challenge.mf;
    expectedStructure.value = {
      idCode: challenge.idCode,
      noStereoIDCode: challenge.noStereoIDCode,
      smiles: challenge.smiles,
      molfile: '',
    };
    challengeCandidates.value = rankCandidates(
      challenge.candidates,
      challenge.mf,
      challenge.noStereoIDCode,
    );

    loadChallengeSpectrum(challenge.id)
      .then((data) => {
        if (cancelled) return;
        currentSpectrum.value = {
          spectrum: data,
          integral: displayIntegral(data),
          original: data,
        };
      })
      .catch(() => {
        if (!cancelled) currentSpectrum.value = null;
      });

    return () => {
      cancelled = true;
    };
  }, [challenge]);
}
