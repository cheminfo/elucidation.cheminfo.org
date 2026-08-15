import type { NMRiumCore, Spectrum1D, Spectrum } from '@zakodium/nmrium-core';

import type { XY } from './normalize.ts';
import { phaseSpectrum } from './phaseSpectrum.ts';

export interface SpectrumMeta {
  name: string;
  nucleus: string;
  solvent: string;
  frequency: number | null;
}

export interface LoadedSpectrum {
  data: XY;
  meta: SpectrumMeta;
  /** The file held a FID, which the loader Fourier-transformed. */
  fromFid: boolean;
  /** Automatic phasing failed, so the magnitude of the complex spectrum is used. */
  magnitude: boolean;
  /** Still in the time domain, so the automatic transform did not happen. */
  isFid: boolean;
  dimension: number;
  /** Distinct datasets found in the drop, including the one returned. */
  count: number;
}

let corePromise: Promise<NMRiumCore> | null = null;

/**
 * Reads the best 1D spectrum out of a set of files through the NMRium loaders.
 *
 * A drop can hold several spectra: a Bruker experiment directory yields both the FID
 * and the processed `pdata` spectrum, and a sample directory yields one pair per
 * experiment. Time-domain data is Fourier-transformed, apodized and phase-corrected
 * on load, so the caller always receives frequency-domain data when the pipeline
 * succeeded.
 * @param files - Every non-molfile file of the drop, with their relative paths.
 * @returns The chosen spectrum with its metadata, or null when none could be read.
 */
export async function readSpectrum(
  files: readonly File[],
): Promise<LoadedSpectrum | null> {
  // The NMR loaders are a large dependency and are only needed once a file is dropped,
  // so they are kept out of the initial bundle.
  const [{ FileCollection }, { isSpectrum1D }] = await Promise.all([
    import('file-collection'),
    import('@zakodium/nmrium-core'),
  ]);
  // Cache the promise, not the instance, so concurrent drops share one initialization.
  corePromise ??= createCore();
  const core = await corePromise;
  const collection = new FileCollection();
  await collection.appendFileList(files);
  const result = await core.read(collection, {
    onLoadProcessing: { autoProcessing: true },
  });

  const spectra: Spectrum[] = result.state.data?.spectra ?? [];
  const usable = spectra.filter(
    (spectrum) => isSpectrum1D(spectrum) && spectrum.data.re !== undefined,
  ) as Spectrum1D[];
  const spectrum = usable.toSorted(byRelevance)[0];
  if (spectrum === undefined) return null;

  const fromFid = spectrum.originalInfo?.isFid ?? false;
  const magnitude = fromFid ? await phaseSpectrum(spectrum) : false;

  // A Bruker experiment yields both its FID and the spectrum processed from it; those
  // are one dataset, and only a second experiment is worth telling the user about.
  const names = new Set(usable.map((item) => displayName(item, files)));

  return {
    data: { x: spectrum.data.x, y: spectrum.data.re },
    meta: {
      name: displayName(spectrum, files),
      nucleus: nucleusOf(spectrum),
      solvent: spectrum.info?.solvent ?? '',
      frequency: spectrum.info?.baseFrequency ?? null,
    },
    fromFid,
    magnitude,
    isFid: spectrum.info?.isFid ?? false,
    dimension: spectrum.info?.dimension ?? 1,
    count: names.size,
  };
}

/**
 * Orders spectra so that the one a proton elucidation needs comes first: a 1D proton
 * spectrum, and among equals the one the spectrometer already processed rather than
 * the FID transformed here.
 * @param a - Left spectrum.
 * @param b - Right spectrum.
 * @returns The comparison of their penalties.
 */
function byRelevance(a: Spectrum1D, b: Spectrum1D): number {
  return penalty(a) - penalty(b);
}

function penalty(spectrum: Spectrum1D): number {
  let value = 0;
  if ((spectrum.info?.dimension ?? 1) !== 1) value += 4;
  if (nucleusOf(spectrum) !== '1H') value += 2;
  if (spectrum.originalInfo?.isFid === true) value += 1;
  return value;
}

function nucleusOf(spectrum: Spectrum1D): string {
  const { nucleus } = spectrum.info;
  return (Array.isArray(nucleus) ? nucleus[0] : nucleus) ?? '';
}

/**
 * Names the spectrum the way the user would recognize it.
 *
 * Bruker names a spectrum after its experiment number, which on its own says nothing,
 * so the directory it was read from is used instead.
 * @param spectrum - The chosen spectrum.
 * @param files - The files of the drop, for a last-resort name.
 * @returns A display name.
 */
function displayName(spectrum: Spectrum1D, files: readonly File[]): string {
  const name = spectrum.info?.name ?? spectrum.info?.title;
  const path = spectrum.selector?.files?.[0];
  if (name !== undefined && /^\d+$/.test(name) && path !== undefined) {
    const directory = path.includes('/pdata/')
      ? path.replace(/\/pdata\/.*$/, '')
      : path.slice(0, path.lastIndexOf('/'));
    if (directory !== '') return directory;
  }
  return name ?? files[0]?.name ?? 'spectrum';
}

async function createCore(): Promise<NMRiumCore> {
  const [{ NMRiumCore }, plugins] = await Promise.all([
    import('@zakodium/nmrium-core'),
    import('@zakodium/nmrium-core-plugins'),
  ]);
  const instance = new NMRiumCore();
  // The loaders only describe what a FID needs; the processing operators are what
  // actually runs the pipeline, so a time-domain file stays a FID without them.
  instance.registerPlugins(
    plugins.recommended(instance, [
      plugins.spectrum1DProcessings(),
      plugins.filtersToProcessingsMigrator(),
      plugins.autoProcessingsPipeline(),
    ]),
  );
  return instance;
}
