import { Callout, InputGroup, NonIdealState, Switch } from '@blueprintjs/core';
import { useMemo, useState } from 'react';

import type {
  RankedCandidate,
  RankedCandidates,
} from '../chemistry/candidates.ts';
import { useSubstructureMatches } from '../chemistry/useSubstructureSearch.ts';

import { CandidateCard } from './CandidateCard.tsx';
import { SubstructureFilter } from './SubstructureFilter.tsx';

export interface CandidateListProps {
  ranked: RankedCandidates;
  /** Whether the true structure is known, which changes how the banner reads. */
  hasExpected: boolean;
}

/**
 * The ranked candidate list, with a substructure filter and an answer banner.
 * @param props - Ranked candidates and whether the answer is known.
 * @returns The results panel.
 */
export function CandidateList(props: CandidateListProps) {
  const { ranked, hasExpected } = props;
  const [query, setQuery] = useState('');
  const [smilesFilter, setSmilesFilter] = useState('');
  const [onlyRetrieved, setOnlyRetrieved] = useState(false);

  const substructureMatches = useSubstructureMatches(ranked.candidates, query);
  const filtered = useFilteredCandidates(
    ranked.candidates,
    substructureMatches,
    smilesFilter,
    onlyRetrieved,
  );
  const topScore = ranked.candidates[0]?.score ?? 0;

  return (
    <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
      <AnswerBanner ranked={ranked} hasExpected={hasExpected} />

      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <InputGroup
          leftIcon="search"
          placeholder="Filter by SMILES text"
          value={smilesFilter}
          onValueChange={setSmilesFilter}
          style={{ minWidth: 200, flex: 1 }}
          spellCheck={false}
          autoComplete="off"
        />
        {/* The published challenge dataset does not record where a candidate came
            from, so the filter is only offered when the data can answer it. */}
        {ranked.hasProvenance && (
          <Switch
            checked={onlyRetrieved}
            label="Only PubChem hits"
            onChange={(event) => setOnlyRetrieved(event.currentTarget.checked)}
            style={{ margin: 0 }}
            data-testid="retrieved-filter"
          />
        )}
      </div>

      <SubstructureFilter query={query} onQueryChange={setQuery} />

      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
        Showing {filtered.length} of {ranked.candidates.length} candidates
        {ranked.rejectedCount > 0 &&
          ` · ${ranked.rejectedCount} rejected for not matching the formula`}
      </div>

      {filtered.length === 0 ? (
        <NonIdealState
          icon="search"
          title="No candidate matches"
          description="Relax the substructure query or the text filter."
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          }}
        >
          {filtered.map((candidate) => (
            <CandidateCard
              key={`${candidate.idCode}-${candidate.rank}`}
              candidate={candidate}
              topScore={topScore}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AnswerBanner(props: {
  ranked: RankedCandidates;
  hasExpected: boolean;
}) {
  const { ranked, hasExpected } = props;

  if (!hasExpected) {
    return (
      <Callout intent="none" icon="help">
        The true structure was not provided, so the candidates below are
        unranked against an answer. Drop a molfile to score a run.
      </Callout>
    );
  }
  if (ranked.positionNoStereo < 0) {
    return (
      <Callout
        intent="danger"
        icon="cross-circle"
        title="Correct structure not found"
      >
        None of the {ranked.candidates.length} candidates matches the known
        structure, ignoring stereochemistry.
      </Callout>
    );
  }
  return (
    <Callout
      intent="success"
      icon="tick-circle"
      title={`Correct structure at rank ${ranked.positionNoStereo + 1}`}
    >
      Matched ignoring stereochemistry, out of {ranked.candidates.length}{' '}
      candidates with the right molecular formula.
    </Callout>
  );
}

function useFilteredCandidates(
  candidates: readonly RankedCandidate[],
  substructureMatches: ReadonlySet<string> | null,
  smilesFilter: string,
  onlyRetrieved: boolean,
): RankedCandidate[] {
  return useMemo(() => {
    const needle = smilesFilter.trim().toLowerCase();
    return candidates.filter((candidate) => {
      if (onlyRetrieved && candidate.retrieved !== true) return false;
      if (needle !== '' && !candidate.smiles.toLowerCase().includes(needle)) {
        return false;
      }
      if (
        substructureMatches !== null &&
        !substructureMatches.has(candidate.idCode)
      ) {
        return false;
      }
      return true;
    });
  }, [candidates, smilesFilter, onlyRetrieved, substructureMatches]);
}
