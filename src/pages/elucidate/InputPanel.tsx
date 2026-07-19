import {
  Button,
  Callout,
  Card,
  FormGroup,
  InputGroup,
  Tag,
} from '@blueprintjs/core';
import { useSignals } from '@preact/signals-react/runtime';
import { MF } from 'react-mf';
import { IdcodeSvgRenderer } from 'react-ocl';
import { DropZone } from 'react-science/ui';

import { formulaFromSmiles } from '../../chemistry/candidates.ts';
import { formulaInfo } from '../../chemistry/formula.ts';
import { parseDroppedFiles } from '../../spectrum/parseFiles.ts';
import {
  currentSpectrum,
  expectedStructure,
  mfInput,
  parseErrors,
  parseWarnings,
  spectrumMeta,
} from '../../state/data.ts';

/**
 * Extensions the parser understands. react-dropzone matches on the extension as well as
 * the MIME type, so the browser guessing `application/octet-stream` for a .jdx is fine.
 */
const ACCEPTED_FILES = {
  'chemical/x-jcamp-dx': ['.jdx', '.dx'],
  'chemical/x-mdl-molfile': ['.mol', '.sdf'],
  'application/zip': ['.zip'],
  'application/octet-stream': ['.jdf'],
};

export interface InputPanelProps {
  onSubmit: () => void;
  submitting: boolean;
}

/**
 * Parses dropped files and publishes the result into the data bucket.
 *
 * Lives at module scope because it only touches signals: keeping it in the component
 * would rebuild the closure on every keystroke in the formula field.
 * @param files - Files dropped on, or picked through, the drop zone.
 */
async function handleFiles(files: readonly File[]): Promise<void> {
  if (files.length === 0) return;
  const parsed = await parseDroppedFiles([...files]);
  parseWarnings.value = parsed.warnings;
  parseErrors.value = parsed.errors;
  if (parsed.spectrum !== null) {
    currentSpectrum.value = parsed.spectrum;
    spectrumMeta.value = parsed.meta;
  }
  if (parsed.expected !== null) {
    expectedStructure.value = parsed.expected;
    const formula = formulaFromSmiles(parsed.expected.smiles);
    if (formula !== null) mfInput.value = formula;
  }
}

/**
 * File input, structure preview and the molecular formula field.
 * @param props - Submit handler and pending state.
 * @returns The input column.
 */
export function InputPanel(props: InputPanelProps) {
  useSignals();
  const { onSubmit, submitting } = props;

  const info = formulaInfo(mfInput.value);
  const meta = spectrumMeta.value;
  const expected = expectedStructure.value;
  const ready = currentSpectrum.value !== null && info !== null;

  return (
    <Card style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
      <FormGroup
        label="Spectrum and optional reference structure"
        helperText="JCAMP-DX (.jdx, .dx), zipped Bruker, JEOL or Varian data. Add a .mol file to score the run against a known answer."
      >
        <div style={{ minHeight: 210 }} data-testid="file-dropzone">
          <DropZone
            accept={ACCEPTED_FILES}
            onDrop={(files) => void handleFiles(files)}
            emptyIcon="upload"
            emptyTitle="Drop your spectrum here"
            emptyDescription="Drag and drop the files, or browse for them"
            emptyButtonText="Choose files"
            emptyButtonIcon="folder-open"
          />
        </div>
      </FormGroup>

      {parseErrors.value.map((message) => (
        <Callout key={message} intent="danger" icon="error">
          {message}
        </Callout>
      ))}
      {parseWarnings.value.map((message) => (
        <Callout key={message} intent="warning" icon="warning-sign">
          {message}
        </Callout>
      ))}

      {meta !== null && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Tag minimal icon="document">
            {meta.name}
          </Tag>
          {meta.nucleus !== '' && <Tag minimal>{meta.nucleus}</Tag>}
          {meta.solvent !== '' && <Tag minimal>{meta.solvent}</Tag>}
          {meta.frequency !== null && (
            <Tag minimal>{meta.frequency.toFixed(2)} MHz</Tag>
          )}
        </div>
      )}

      {expected !== null && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
            Reference structure
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <IdcodeSvgRenderer
              idcode={expected.idCode}
              width={220}
              height={150}
              autoCrop
            />
          </div>
        </div>
      )}

      <FormGroup
        label="Molecular formula"
        helperText="Usually from high-resolution mass spectrometry. Required, and editable without a reference structure."
        intent={mfInput.value !== '' && info === null ? 'danger' : 'none'}
      >
        <InputGroup
          placeholder="C9H6N4"
          value={mfInput.value}
          onValueChange={(value) => (mfInput.value = value)}
          intent={mfInput.value !== '' && info === null ? 'danger' : 'none'}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          data-testid="mf-input"
        />
      </FormGroup>

      {info !== null && (
        <div
          style={{ fontSize: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}
        >
          <span>
            <MF mf={info.mf} />
          </span>
          <span>{info.monoisotopicMass.toFixed(4)} Da</span>
          <span>{info.unsaturation} DBE</span>
          <span>{info.atoms.H ?? 0} H</span>
        </div>
      )}

      <Button
        size="large"
        intent="primary"
        icon="lab-test"
        text="Elucidate structure"
        disabled={!ready || submitting}
        loading={submitting}
        onClick={onSubmit}
        data-testid="submit-button"
      />
    </Card>
  );
}
