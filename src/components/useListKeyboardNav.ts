import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Arrow-key navigation over a list, with Enter to activate.
 *
 * The listener sits on the document so the list does not have to be clicked first, and
 * reads its inputs through refs so it never closes over a stale list. Key presses coming
 * from a text field or the structure editor are ignored, so typing a filter never moves
 * the selection.
 * @param length - Number of items currently displayed.
 * @param onActivate - Called with the selected index when Enter is pressed.
 * @returns The selected index, clamped to the current length, or -1 when nothing is selected.
 */
export function useListKeyboardNav(
  length: number,
  onActivate: (index: number) => void,
): number {
  const [index, setIndex] = useState(-1);
  const lengthRef = useRef(length);
  const activateRef = useRef(onActivate);

  useLayoutEffect(() => {
    lengthRef.current = length;
    activateRef.current = onActivate;
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (isTypingTarget(event.target)) return;
      const count = lengthRef.current;
      if (count === 0) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setIndex((current) => Math.min(count - 1, current + 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setIndex((current) => Math.max(0, current - 1));
      } else if (event.key === 'Enter') {
        setIndex((current) => {
          if (current >= 0 && current < count) activateRef.current(current);
          return current;
        });
      }
    }
    globalThis.document.addEventListener('keydown', onKeyDown);
    return () => globalThis.document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Clamp during render rather than in an effect, so the list shrinking never leaves a
  // selection pointing past the end for one frame.
  return index >= length ? length - 1 : index;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'CANVAS' ||
    target.isContentEditable
  );
}
