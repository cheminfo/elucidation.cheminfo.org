import type { SubmitRequest } from './types.ts';
import { DEFAULT_GA_PARAMETERS } from './types.ts';

/**
 * Cost of a run before any candidate is scored: model load, the encoder pass over the
 * spectrum and the retrieval index warm-up. Measured, see {@link estimateRunSeconds}.
 */
const FIXED_SECONDS = 87;

/** Marginal cost of one scored candidate. Measured, see {@link estimateRunSeconds}. */
const SECONDS_PER_CANDIDATE = 0.0111;

/**
 * Wall-clock estimate for a run, in seconds.
 *
 * The API reports no real progress — it emits one Celery `PROGRESS` event with `current`
 * hard-coded to 0 before the genetic algorithm starts and never updates it — so a
 * progress bar has nothing to read. This estimate exists only to give elapsed time a
 * scale, and every place it is shown says so.
 *
 * The model is a fixed cost plus a term proportional to the candidates scored
 * (`gens_ga * offspring_ga`), fitted on runs of the same ethyl vinyl ether spectrum
 * against the live deployment on 2026-07-27:
 *
 * | generations x offspring | pop | candidates | measured |
 * |---|---|---|---|
 * | 1 x 64 | 50 | 64 | 91 s |
 * | 5 x 256 | 50 | 1 280 | 96 s |
 * | 5 x 256 | 512 | 1 280 | 101 s |
 * | 10 x 1024 | 512 | 10 240 | 201 s |
 * | 20 x 2048 | 512 | 40 960 | 452 s |
 *
 * The constants are fitted on the runs at the default `pop_ga` up to 10 240 candidates,
 * so the estimate is exact for the settings actually used. Beyond that the real cost per
 * candidate falls — the 40 960 run took 452 s against 542 s predicted — so this
 * overestimates a search an order of magnitude larger than anything the app submits.
 * `pop_ga` is not a term: it costs about five seconds across its whole useful range,
 * which is below the noise of a single run.
 *
 * A run is mostly fixed cost, so the estimate is dominated by the constant. It assumes a
 * warm worker and an idle queue: the first run after a redeploy pays about 21 s more for
 * model loading, and a queued run is timed from when it starts rather than from when it
 * was submitted.
 * @param request - The request as it was submitted, whose GA parameters set the size.
 * @returns The expected duration in seconds.
 */
export function estimateRunSeconds(request: SubmitRequest): number {
  const generations = request.gens_ga ?? DEFAULT_GA_PARAMETERS.gens_ga;
  const offspring = request.offspring_ga ?? DEFAULT_GA_PARAMETERS.offspring_ga;
  return FIXED_SECONDS + SECONDS_PER_CANDIDATE * generations * offspring;
}
