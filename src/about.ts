/**
 * What this site says about itself, read by the shared About page.
 *
 * The prose is content, never markup: the page draws it, so every About of the
 * family holds the same sections in the same order and one voice. What this
 * deployment does not do is the one thing that does not fit that shape, and it
 * sits beside the record in `pages/about/AboutPage.tsx`.
 */

import { BUILD_INFO } from 'react-cheminfo/build-info';
import type { AboutContent, CitedWork } from 'react-cheminfo/core';
import { PLATFORM_WORK } from 'react-cheminfo/core';

import { SECS_PAPER } from './data/secsPaper.ts';

/** The record the `/about` page is drawn from. */
export const ABOUT: AboutContent = {
  siteId: 'elucidation',
  // Which release, built when, from which commit: the build says so,
  // because a version written by hand is wrong by the next release.
  build: BUILD_INFO,
  what: 'Drop a 1H NMR spectrum, give its molecular formula, and get candidate structures ranked by how well their predicted spectrum matches.',
  can: [
    'Drop a JCAMP-DX file or a Bruker or Varian folder — a FID is transformed for you.',
    'Submit a spectrum with its molecular formula and follow the run in the queue.',
    'Read the candidates ranked by score, and keep only those holding a fragment you draw.',
    'Open twenty worked challenges from the paper, their candidates already computed.',
    'Come back to a run later: what you submitted is kept in this browser, not on a server.',
  ],
  paragraphs: [
    'A contrastive model places a spectrum and its molecule at nearly the same point in one space, so the measurement is itself the query: an index built from PubChem returns the closest known compounds, and a graph genetic algorithm mutates those hits into new ones, scored on similarity to the spectrum and penalised for leaving the formula.',
  ],
  credits: [
    'openchemlib',
    'openchemlib-utils',
    'react-ocl',
    'react-mf',
    'mass-tools',
    'ml-spectra-processing',
    'blueprint',
    'react-science',
    'react-cheminfo',
    'react',
    'vite',
  ],
  cite: citedWorks(),
};

/**
 * The works a reader publishing what this page produced owes: the platform the
 * site runs on, then SECS itself, the method behind every candidate it ranks.
 * @returns The works, in the order the page lists them.
 */
function citedWorks(): CitedWork[] {
  return [
    PLATFORM_WORK,
    {
      reference: SECS_PAPER,
      what: 'SECS',
      note: 'Cite it for the model, the retrieval index and the evolutionary search behind every candidate here.',
    },
  ];
}
