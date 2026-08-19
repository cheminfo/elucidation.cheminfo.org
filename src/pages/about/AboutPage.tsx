import { AboutPage as FamilyAboutPage, AboutSection } from 'react-cheminfo/ui';

import { ABOUT } from '../../about.ts';
import { navigate } from '../../state/view.ts';

/** Where the elucidation itself is computed, which is not this repository. */
const BACKEND_REPOSITORY = 'https://github.com/lamalab-org/secs-app';

/**
 * The About: the family's page, plus the one section that belongs to this site
 * alone — what this deployment does not do, which is what a reader needs before
 * trusting a ranked list.
 * @returns The about page.
 */
export function AboutPage() {
  return (
    <FamilyAboutPage content={ABOUT}>
      <AboutSection title="What this deployment does and does not do">
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>
            Only <sup>1</sup>H NMR is used. Carbon, IR and HSQC encoders exist
            but are not active here.
          </li>
          <li>
            A run takes roughly 20 to 45 minutes, and the server reports no
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
        <p style={{ margin: '8px 0 0' }}>
          The four steps the method takes are laid out on{' '}
          <a
            href="/"
            onClick={(event) => {
              event.preventDefault();
              navigate('elucidate');
            }}
          >
            the elucidate page
          </a>
          . This site is the web interface; the elucidation runs in{' '}
          <a href={BACKEND_REPOSITORY} target="_blank" rel="noreferrer">
            lamalab-org/secs-app
          </a>
          .
        </p>
      </AboutSection>
    </FamilyAboutPage>
  );
}
