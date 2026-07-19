import { Tag } from '@blueprintjs/core';

import type { RunState } from '../state/runsDb.ts';

export interface JobStatusTagProps {
  state: RunState;
}

/**
 * Renders a run's state as a colored capsule.
 * @param props - The run state.
 * @returns The status tag.
 */
export function JobStatusTag(props: JobStatusTagProps) {
  switch (props.state) {
    case 'success': {
      return (
        <Tag minimal intent="success" icon="tick-circle">
          Finished
        </Tag>
      );
    }
    case 'failure': {
      return (
        <Tag minimal intent="danger" icon="error">
          Failed
        </Tag>
      );
    }
    case 'revoked': {
      return (
        <Tag minimal intent="warning">
          Cancelled
        </Tag>
      );
    }
    case 'expired': {
      return (
        <Tag minimal intent="warning" icon="time">
          Expired
        </Tag>
      );
    }
    case 'running': {
      return (
        <Tag minimal intent="primary">
          Running
        </Tag>
      );
    }
    case 'pending': {
      return <Tag minimal>Queued</Tag>;
    }
    default: {
      return (
        <Tag minimal intent="primary">
          Running
        </Tag>
      );
    }
  }
}
