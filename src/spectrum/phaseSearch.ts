export interface PhaseAngles {
  /** Zero-order angle, in degrees. */
  ph0: number;
  /** First-order angle across the whole sweep, in degrees. */
  ph1: number;
}

/** Widest first-order angle the search considers, in degrees. */
const PH1_RANGE = 2000;
/** Points the score is computed on, whatever the size of the spectrum. */
const SAMPLE_COUNT = 2048;

/**
 * Finds the angles that leave the fewest lines pointing down.
 *
 * A residual group delay shows up as a first-order angle of several hundred degrees per
 * sweep, which inverts some multiplets and leaves their neighbours upright — no small
 * angle can undo that, so the first order is searched over a wide range rather than
 * around zero. Candidates are scored on the downward peak area they leave behind,
 * measured on the tallest point of each block so a narrow line is never sampled away.
 * @param re - Real part of the spectrum.
 * @param im - Imaginary part of the spectrum.
 * @param proposed - Angles from another correction, kept as a candidate.
 * @returns The best angles found, in degrees.
 */
export function bestAngles(
  re: Float64Array,
  im: Float64Array,
  proposed: PhaseAngles,
): PhaseAngles {
  const samples = takeSamples(re, im);
  let best = { ph0: 0, ph1: 0 };
  let bestScore = score(samples, best);
  const keep = (candidate: PhaseAngles): void => {
    const value = score(samples, candidate);
    if (value < bestScore) {
      bestScore = value;
      best = candidate;
    }
  };

  keep(proposed);

  for (let ph0 = -180; ph0 < 180; ph0 += 15) {
    for (let ph1 = -PH1_RANGE; ph1 <= PH1_RANGE; ph1 += 20) {
      keep({ ph0, ph1 });
    }
  }

  for (const [span, step] of [
    [15, 2],
    [2, 0.25],
  ] as const) {
    const around = best;
    for (let ph0 = around.ph0 - span; ph0 <= around.ph0 + span; ph0 += step) {
      for (
        let ph1 = around.ph1 - span * 2;
        ph1 <= around.ph1 + span * 2;
        ph1 += step * 2
      ) {
        keep({ ph0, ph1 });
      }
    }
  }

  return best;
}

interface Samples {
  re: Float64Array;
  im: Float64Array;
  /** Position of each sample in the sweep, from 0 to 1. */
  position: Float64Array;
  /** Intensity a point must reach to count as signal rather than noise. */
  threshold: number;
}

/**
 * Reduces the spectrum to the tallest point of each block.
 *
 * Every point of a block shares the same first-order angle to within a fraction of a
 * degree, so the tallest one stands for all of them, and taking every nth point instead
 * would step over the narrow lines the score is about.
 * @param re - Real part of the spectrum.
 * @param im - Imaginary part of the spectrum.
 * @returns The samples and the noise threshold, both phase-independent.
 */
function takeSamples(re: Float64Array, im: Float64Array): Samples {
  const length = re.length;
  const count = Math.min(SAMPLE_COUNT, length);
  const block = Math.ceil(length / count);
  const sampledRe = new Float64Array(count);
  const sampledIm = new Float64Array(count);
  const position = new Float64Array(count);
  const magnitudes = new Float64Array(count);

  let taken = 0;
  for (let start = 0; start < length; start += block) {
    const end = Math.min(start + block, length);
    let index = start;
    let peak = -1;
    for (let i = start; i < end; i++) {
      const real = re[i] as number;
      const imaginary = im[i] as number;
      const magnitude = real * real + imaginary * imaginary;
      if (magnitude > peak) {
        peak = magnitude;
        index = i;
      }
    }
    sampledRe[taken] = re[index] as number;
    sampledIm[taken] = im[index] as number;
    position[taken] = index / length;
    magnitudes[taken] = Math.sqrt(peak);
    taken++;
  }

  const sorted = magnitudes.slice(0, taken).toSorted();
  // The magnitude does not depend on the phase, so every candidate is scored against
  // the same threshold. Blocks are mostly baseline, so their median is noise.
  const median = sorted[Math.floor(taken / 2)] ?? 0;
  return {
    re: sampledRe.subarray(0, taken),
    im: sampledIm.subarray(0, taken),
    position: position.subarray(0, taken),
    threshold: median * 2,
  };
}

/**
 * Measures how much of the signal points down once the angles are applied.
 *
 * The rotation is the one `reimPhaseCorrection` performs in reverse mode, so the winner
 * can be handed straight to the phase correction filter.
 * The signals cover only part of the sweep, so a first-order angle can be traded
 * against a zero-order one over that part: the winning pair is one of many, and its
 * first order is not a measurement of the group delay left over.
 * @param samples - The sampled spectrum.
 * @param angles - Candidate angles, in degrees.
 * @returns Downward over upward peak area; zero for a fully absorptive spectrum.
 */
function score(samples: Samples, angles: PhaseAngles): number {
  const { re, im, position, threshold } = samples;
  const first = ((angles.ph0 + angles.ph1) * Math.PI) / 180;
  const slope = (angles.ph1 * Math.PI) / 180;
  let up = 0;
  let down = 0;
  for (let i = 0; i < re.length; i++) {
    const angle = first - slope * (position[i] as number);
    const value =
      (re[i] as number) * Math.cos(angle) - (im[i] as number) * Math.sin(angle);
    if (value > threshold) up += value;
    else if (value < -threshold) down -= value;
  }
  return up === 0 ? Infinity : down / up;
}
