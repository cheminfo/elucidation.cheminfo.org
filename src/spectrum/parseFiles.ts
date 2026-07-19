import type { NMRiumCore } from '@zakodium/nmrium-core';

import { expectedFromMolfile } from '../chemistry/candidates.ts';

import type { NormalizedSpectrum, XY } from './normalize.ts';
import { normalizeSpectrum } from './normalize.ts';

export interface SpectrumMeta {
  name: string;
  nucleus: string;
  solvent: string;
  frequency: number | null;
}

export interface ExpectedStructure {
  idCode: string;
  noStereoIDCode: string;
  smiles: string;
  molfile: string;
}

export interface ParsedDrop {
  spectrum: NormalizedSpectrum | null;
  meta: SpectrumMeta | null;
  expected: ExpectedStructure | null;
  /** Problems the user should see but which do not prevent submission. */
  warnings: string[];
  /** Problems that stopped a file from being used at all. */
  errors: string[];
}

const MOLFILE_EXTENSIONS = new Set(['mol', 'sdf']);
const SPECTRUM_EXTENSIONS = new Set([
  'jdx',
  'dx',
  'zip',
  'jdf',
  'fid',
  'nmrium',
]);

let corePromise: Promise<NMRiumCore> | null = null;

/**
 * Parses dropped files into a normalized spectrum and, when present, the known structure.
 *
 * Accepts JCAMP-DX, zipped Bruker directories, JEOL and Varian data through the NMRium
 * loaders, plus a molfile carrying the expected answer. The spectrum is validated as a
 * 1D proton FT spectrum: submitting a FID, a 2D experiment or a carbon spectrum silently
 * produces meaningless candidates, so those cases are reported rather than sent.
 * @param files - Files from a drop or file input.
 * @returns The normalized spectrum, its metadata, the expected structure and any messages.
 */
export async function parseDroppedFiles(
  files: readonly File[],
): Promise<ParsedDrop> {
  const warnings: string[] = [];
  const errors: string[] = [];
  let expected: ExpectedStructure | null = null;

  const spectrumFiles: File[] = [];
  const molfiles: File[] = [];
  for (const file of files) {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (MOLFILE_EXTENSIONS.has(extension)) {
      molfiles.push(file);
    } else if (SPECTRUM_EXTENSIONS.has(extension)) {
      spectrumFiles.push(file);
    } else {
      errors.push(`${file.name}: unsupported file type ".${extension}".`);
    }
  }

  const molfileTexts = await Promise.all(molfiles.map((file) => file.text()));
  for (const [index, molfile] of molfileTexts.entries()) {
    const parsed = expectedFromMolfile(molfile);
    if (parsed === null) {
      errors.push(
        `${molfiles[index]?.name ?? 'file'} does not contain a readable structure.`,
      );
    } else {
      expected = { ...parsed, molfile };
    }
  }

  if (spectrumFiles.length === 0) {
    return { spectrum: null, meta: null, expected, warnings, errors };
  }
  if (spectrumFiles.length > 1) {
    warnings.push(
      `${spectrumFiles.length} spectra were dropped; only ${spectrumFiles[0]?.name ?? 'the first'} was used.`,
    );
  }

  try {
    const loaded = await readSpectrum(spectrumFiles);
    if (loaded === null) {
      errors.push('No 1D spectrum could be read from the dropped file.');
      return { spectrum: null, meta: null, expected, warnings, errors };
    }
    warnings.push(...validate(loaded.meta, loaded.isFid, loaded.dimension));
    return {
      spectrum: normalizeSpectrum(loaded.data),
      meta: loaded.meta,
      expected,
      warnings,
      errors,
    };
  } catch (error) {
    errors.push(
      `Could not read the spectrum: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { spectrum: null, meta: null, expected, warnings, errors };
  }
}

interface LoadedSpectrum {
  data: XY;
  meta: SpectrumMeta;
  isFid: boolean;
  dimension: number;
}

async function readSpectrum(
  files: readonly File[],
): Promise<LoadedSpectrum | null> {
  // The NMR loaders are a large dependency and are only needed once a file is dropped,
  // so they are kept out of the initial bundle.
  const { FileCollection } = await import('file-collection');
  // Cache the promise, not the instance, so concurrent drops share one initialization.
  corePromise ??= createCore();
  const core = await corePromise;
  const collection = new FileCollection();
  await collection.appendFileList(files);
  const result = await core.read(collection);

  const spectra = (result.state.data?.spectra ?? []) as RawSpectrum[];
  const spectrum = spectra.find((item) => item.data?.x !== undefined);
  if (spectrum === undefined) return null;

  const x = spectrum.data.x;
  const y = spectrum.data.re ?? spectrum.data.y;
  if (x === undefined || y === undefined) return null;

  return {
    data: { x, y },
    meta: {
      name:
        spectrum.info?.name ??
        spectrum.info?.title ??
        files[0]?.name ??
        'spectrum',
      nucleus: spectrum.info?.nucleus ?? '',
      solvent: spectrum.info?.solvent ?? '',
      frequency: spectrum.info?.baseFrequency ?? null,
    },
    isFid: spectrum.info?.isFid ?? false,
    dimension: spectrum.info?.dimension ?? 1,
  };
}

function validate(
  meta: SpectrumMeta,
  isFid: boolean,
  dimension: number,
): string[] {
  const warnings: string[] = [];
  if (isFid) {
    warnings.push(
      'This file is a FID (time domain). SECS expects a Fourier-transformed, phased spectrum.',
    );
  }
  if (dimension !== 1) {
    warnings.push(
      `This is a ${dimension}D experiment. SECS only uses 1D proton spectra in this deployment.`,
    );
  }
  if (meta.nucleus !== '' && meta.nucleus !== '1H') {
    warnings.push(
      `The nucleus is reported as ${meta.nucleus}. SECS only uses 1H spectra in this deployment.`,
    );
  }
  return warnings;
}

async function createCore(): Promise<NMRiumCore> {
  const [{ NMRiumCore }, { recommended }] = await Promise.all([
    import('@zakodium/nmrium-core'),
    import('@zakodium/nmrium-core-plugins'),
  ]);
  const instance = new NMRiumCore();
  instance.registerPlugins(recommended(instance));
  return instance;
}

interface RawSpectrum {
  data: {
    x?: Float64Array | number[];
    re?: Float64Array | number[];
    y?: Float64Array | number[];
  };
  info?: {
    name?: string;
    title?: string;
    nucleus?: string;
    solvent?: string;
    baseFrequency?: number;
    isFid?: boolean;
    dimension?: number;
  };
}
