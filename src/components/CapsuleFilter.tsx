import type { Intent } from '@blueprintjs/core';
import { Button, ButtonGroup, Tag } from '@blueprintjs/core';

export interface CapsuleOption {
  value: string;
  label: string;
  count: number;
  intent?: Intent;
}

export interface CapsuleFilterProps {
  options: readonly CapsuleOption[];
  value: string;
  onChange: (value: string) => void;
}

/**
 * Status filter rendered as capsules carrying their counts.
 *
 * Inactive capsules keep their semantic intent in minimal form rather than falling back
 * to grey, so the colour of a status is learnable regardless of what is selected.
 * @param props - Options, the selected value and a change handler.
 * @returns The filter row.
 */
export function CapsuleFilter(props: CapsuleFilterProps) {
  const { options, value, onChange } = props;
  return (
    <ButtonGroup>
      {options.map((option) => (
        <Button
          key={option.value}
          active={value === option.value}
          onClick={() => onChange(option.value)}
          data-testid={`filter-${option.value}`}
        >
          {option.label}{' '}
          <Tag minimal round intent={option.intent}>
            {option.count}
          </Tag>
        </Button>
      ))}
    </ButtonGroup>
  );
}
