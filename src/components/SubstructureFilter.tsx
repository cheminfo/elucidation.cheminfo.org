import { Button, Collapse } from '@blueprintjs/core';
import { useState } from 'react';
import { CanvasMoleculeEditor } from 'react-ocl';

/**
 * The OCL canvas editor lays out a fixed 46x361px toolbar next to a drawing area
 * that never goes below 300px, and it clips neither: a smaller box lets the
 * toolbar spill over whatever follows it.
 */
const EDITOR_MIN_WIDTH = 346;
const EDITOR_HEIGHT = 380;

export interface SubstructureFilterProps {
  /** Current query as an OCL id code, empty when no query is drawn. */
  query: string;
  onQueryChange: (idCode: string) => void;
}

/**
 * A structure editor used to keep only candidates containing a drawn fragment.
 *
 * Collapsed by default: it is a power feature, and an always-visible canvas competes
 * with the candidates for attention.
 * @param props - The current query and a change handler.
 * @returns The collapsible editor.
 */
export function SubstructureFilter(props: SubstructureFilterProps) {
  const { query, onQueryChange } = props;
  const [open, setOpen] = useState(false);
  // The editor owns its structure, so clearing the query cannot empty the canvas:
  // remount it instead of feeding the query back as `inputValue`, which would reset
  // the coordinates on every stroke.
  const [editorKey, setEditorKey] = useState(0);

  function clear() {
    onQueryChange('');
    setEditorKey((key) => key + 1);
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Button
          variant="minimal"
          size="small"
          icon={open ? 'chevron-down' : 'chevron-right'}
          onClick={() => setOpen(!open)}
          text="Filter by substructure"
        />
        {query !== '' && (
          <Button
            variant="minimal"
            size="small"
            intent="warning"
            icon="filter-remove"
            text="Clear"
            onClick={clear}
          />
        )}
      </div>
      <Collapse isOpen={open}>
        <div style={{ paddingTop: 8 }} data-testid="substructure-editor">
          <div style={{ maxWidth: 560, overflowX: 'auto' }}>
            <div
              style={{
                minWidth: EDITOR_MIN_WIDTH,
                height: EDITOR_HEIGHT,
                border: '1px solid var(--border)',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <CanvasMoleculeEditor
                key={editorKey}
                width="100%"
                height="100%"
                onChange={(molecule) =>
                  // An erased canvas still yields the id code of the empty molecule
                  // (`d@`), which would keep the filter alive with nothing drawn.
                  onQueryChange(
                    molecule.getMolecule().getAllAtoms() === 0
                      ? ''
                      : molecule.getIdcode(),
                  )
                }
              />
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            Draw a fragment to keep only candidates that contain it.
          </p>
        </div>
      </Collapse>
    </div>
  );
}
