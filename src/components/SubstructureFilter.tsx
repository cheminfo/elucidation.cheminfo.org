import { Button, Collapse } from '@blueprintjs/core';
import { useState } from 'react';
import { StructureEditor, fragmentQuery } from 'react-cheminfo/structure';

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
  // reload it instead of feeding the query back as a value, which would reset the
  // coordinates on every stroke.
  const [revision, setRevision] = useState(0);

  function clear() {
    onQueryChange('');
    setRevision((current) => current + 1);
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
          <div style={{ maxWidth: 560 }}>
            <StructureEditor
              revision={revision}
              minHeight={EDITOR_HEIGHT}
              style={{ borderRadius: 4 }}
              onChange={(change) =>
                onQueryChange(
                  fragmentQuery(change.idCode).isEmpty ? '' : change.idCode,
                )
              }
            />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Draw a fragment to keep only candidates that contain it.
          </p>
        </div>
      </Collapse>
    </div>
  );
}
