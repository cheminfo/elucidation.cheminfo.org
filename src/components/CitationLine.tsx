import type { CitationStyleId, Reference } from 'react-cheminfo/core';
import { citationSegments } from 'react-cheminfo/core';

export interface CitationLineProps {
  /** The work being written. */
  reference: Reference;
  /**
   * Journal style the line is written in.
   * @default 'nature'
   */
  style?: CitationStyleId;
}

/**
 * A reference written out on the page, with the emphasis its style asks for and
 * its DOI as a link. The same segments the Cite button copies are what is drawn
 * here, so what a reader sees and what they paste can never drift apart.
 * @param props - The work, and the style to write it in.
 * @param props.reference - The work being written.
 * @param props.style - Journal style the line is written in.
 * @returns The reference, as one line.
 */
export function CitationLine(props: CitationLineProps) {
  const { reference, style = 'nature' } = props;

  return (
    <span>
      {citationSegments(reference, style).map((segment, index) => (
        // The segments of one citation are a fixed list, never reordered.
        // eslint-disable-next-line react/no-array-index-key
        <Segment key={index} segment={segment} />
      ))}
    </span>
  );
}

function Segment(props: {
  segment: ReturnType<typeof citationSegments>[number];
}) {
  const { segment } = props;
  switch (segment.kind) {
    case 'italic':
      return <em>{segment.text}</em>;
    case 'bold':
      return <strong>{segment.text}</strong>;
    case 'link':
      return (
        <a href={segment.href} target="_blank" rel="noreferrer">
          {segment.text}
        </a>
      );
    case 'text':
      return <span>{segment.text}</span>;
    default:
      return <span />;
  }
}
