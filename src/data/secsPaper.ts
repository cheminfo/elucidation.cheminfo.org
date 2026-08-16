import type { Reference } from 'react-cheminfo/core';

/**
 * The work this tool asks to be cited: SECS itself, not the site around it.
 * One place holds it, so the header's Cite button, the home page and the About
 * page can never name a different paper.
 *
 * Verified against Crossref (doi 10.1038/s41467-026-73846-y).
 */
export const SECS_PAPER: Reference = {
  authors: [
    { given: 'A.', family: 'Mirza' },
    { given: 'L.', family: 'Patiny' },
    { given: 'K. M.', family: 'Jablonka' },
  ],
  title:
    'End-to-end multimodal structure elucidation from raw spectra combining contrastive learning and evolutionary algorithms',
  journal: 'Nature Communications',
  journalAbbreviation: 'Nat. Commun.',
  year: 2026,
  volume: '17',
  issue: '1',
  // An article number rather than a page range, which is how this journal
  // paginates: the article is 17, 5013.
  firstPage: '5013',
  lastPage: '5013',
  doi: '10.1038/s41467-026-73846-y',
  publisher: 'Springer Nature',
};
