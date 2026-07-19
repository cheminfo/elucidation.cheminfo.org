import { signal } from '@preact/signals-react';

import type { GaParameters, SecsModel } from '../api/types.ts';
import { DEFAULT_GA_PARAMETERS } from '../api/types.ts';

export interface Preferences {
  /** API origin. Empty means same-origin, which is how the site is deployed. */
  apiUrl: string;
  model: SecsModel;
  parameters: GaParameters;
}

/**
 * Run settings, fixed in code and deliberately not editable from the interface.
 *
 * The server identifies a run by its spectrum alone, so a spectrum submitted once can
 * never be recomputed with a different model or different search parameters — it will
 * always return the original result. Exposing these as controls would therefore invite
 * users into a setting that silently does nothing, so the values used are the defaults
 * from the paper and they stay constant.
 */
export const preferences = signal<Preferences>({
  apiUrl: '',
  model: 'residual',
  parameters: DEFAULT_GA_PARAMETERS,
});
