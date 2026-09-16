import { signal } from '@preact/signals-react';

import type { GaParameters, SecsModel } from '../api/types.ts';
import { DEFAULT_GA_PARAMETERS } from '../api/types.ts';

import { BASE_PATH } from './site.ts';

export interface Preferences {
  /**
   * Where the API answers. Empty means same-origin at the root, which is how
   * the site is deployed on a host of its own; under a mount it is the mount,
   * so the calls land on this deployment rather than on whatever owns the root
   * of the shared host.
   */
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
 * users into a setting that silently does nothing, so the values stay constant at
 * {@link DEFAULT_GA_PARAMETERS}.
 */
export const preferences = signal<Preferences>({
  apiUrl: BASE_PATH,
  model: 'residual',
  parameters: DEFAULT_GA_PARAMETERS,
});
