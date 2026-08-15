import { expectedFromMolfile } from '../chemistry/candidates.ts';

import type { NormalizedSpectrum } from './normalize.ts';
import { normalizeSpectrum } from './normalize.ts';
import type { LoadedSpectrum, SpectrumMeta } from './readSpectrum.ts';
import { readSpectrum } from './readSpectrum.ts';

export type { SpectrumMeta } from './readSpectrum.ts';

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
  /** How the file was read, when that is not what the user would assume. */
  notes: string[];
  /** Problems the user should see but which do not prevent submission. */
  warnings: string[];
  /** Problems that stopped a file from being used at all. */
  errors: string[];
}

const MOLFILE_EXTENSIONS = new Set(['mol', 'sdf']);
const SPECTRUM_EXTENSIONS = new Set([
  'jdx',
  'dx',
  'jcamp',
  'zip',
  'jdf',
  'fid',
  'nmrium',
]);

/**
 * Files that only ever appear inside a spectrometer directory. One of them is enough
 * to tell that the drop is a dataset rather than a set of standalone files, which is
 * the only way to know that `fid`, `1r`, `pulseprog` and friends belong together.
 */
const DATASET_MARKERS = new Set(['acqu', 'acqus', 'proc', 'procs', 'procpar']);

/**
 * Parses dropped files into a normalized spectrum and, when present, the known structure.
 *
 * Accepts JCAMP-DX, Bruker and Varian directories (dropped as a folder or zipped), JEOL
 * files and NMRium files. Time-domain data is transformed on load, so a FID and the
 * spectrum processed from it are both usable. The result is validated as a 1D proton
 * spectrum: submitting a 2D experiment or a carbon spectrum silently produces
 * meaningless candidates, so those cases are reported rather than sent.
 * @param files - Files from a drop or file input.
 * @returns The normalized spectrum, its metadata, the expected structure and any messages.
 */
export async function parseDroppedFiles(
  files: readonly File[],
): Promise<ParsedDrop> {
  const notes: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  let expected: ExpectedStructure | null = null;

  const molfiles: File[] = [];
  const others: File[] = [];
  for (const file of files) {
    if (MOLFILE_EXTENSIONS.has(extensionOf(file.name))) {
      molfiles.push(file);
    } else {
      others.push(file);
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

  // A dataset directory is read as a whole: its files carry no extension and mean
  // nothing on their own, so they must not be sorted into supported and unsupported.
  const spectrumFiles: File[] = [];
  if (isDataset(others)) {
    spectrumFiles.push(...others);
  } else {
    for (const file of others) {
      const extension = extensionOf(file.name);
      if (SPECTRUM_EXTENSIONS.has(extension)) {
        spectrumFiles.push(file);
      } else {
        errors.push(`${file.name}: unsupported file type ".${extension}".`);
      }
    }
  }

  if (spectrumFiles.length === 0) {
    return { spectrum: null, meta: null, expected, notes, warnings, errors };
  }

  try {
    const loaded = await readSpectrum(spectrumFiles);
    if (loaded === null) {
      errors.push('No 1D spectrum could be read from the dropped file.');
      return { spectrum: null, meta: null, expected, notes, warnings, errors };
    }
    notes.push(...describe(loaded));
    warnings.push(...validate(loaded));
    return {
      spectrum: normalizeSpectrum(loaded.data),
      meta: loaded.meta,
      expected,
      notes,
      warnings,
      errors,
    };
  } catch (error) {
    errors.push(
      `Could not read the spectrum: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { spectrum: null, meta: null, expected, notes, warnings, errors };
  }
}

function extensionOf(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

function isDataset(files: readonly File[]): boolean {
  for (const file of files) {
    const path = relativePathOf(file).toLowerCase();
    if (path.includes('/pdata/')) return true;
    if (DATASET_MARKERS.has(path.split('/').pop() ?? '')) return true;
  }
  return false;
}

/**
 * Reads the path a file had inside the dropped directory.
 *
 * A folder drop sets `path`, the folder picker sets `webkitRelativePath`, and a plain
 * file has neither.
 * @param file - The dropped file.
 * @returns The relative path, falling back to the bare name.
 */
function relativePathOf(file: File): string {
  const dropped = (file as File & { path?: string }).path;
  return dropped ?? (file.webkitRelativePath || file.name);
}

function describe(loaded: LoadedSpectrum): string[] {
  const notes: string[] = [];
  if (loaded.fromFid && !loaded.isFid) {
    notes.push(
      'This file holds a FID. It was apodized, zero-filled, Fourier-transformed and phase-corrected automatically — check the spectrum before submitting.',
    );
  }
  if (loaded.magnitude) {
    notes.push(
      'The automatic phase correction did not converge on this FID, so its magnitude spectrum is used. Lines are broader than on a phased spectrum; supply the processed data if you have it.',
    );
  }
  if (loaded.count > 1) {
    notes.push(
      `${loaded.count} spectra were read; ${loaded.meta.name} was used as the proton spectrum.`,
    );
  }
  return notes;
}

function validate(loaded: LoadedSpectrum): string[] {
  const warnings: string[] = [];
  if (loaded.isFid) {
    warnings.push(
      'This file is a FID (time domain) and could not be Fourier-transformed. SECS expects a transformed, phased spectrum.',
    );
  }
  if (loaded.dimension !== 1) {
    warnings.push(
      `This is a ${loaded.dimension}D experiment. SECS only uses 1D proton spectra in this deployment.`,
    );
  }
  const { nucleus } = loaded.meta;
  if (nucleus !== '' && nucleus !== '1H') {
    warnings.push(
      `The nucleus is reported as ${nucleus}. SECS only uses 1H spectra in this deployment.`,
    );
  }
  return warnings;
}
