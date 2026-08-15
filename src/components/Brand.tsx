export interface BrandMarkProps {
  /**
   * Edge of the square the mark is drawn in, in pixels.
   * @default 26
   */
  size?: number;
}

/**
 * The mark: a spectrum, with the peak that settles the structure picked out.
 * What the tool does is read a trace and land on one answer, so the mark is
 * that reading rather than a picture of a molecule. Only the resolved peak
 * carries the second brand colour, which is what keeps the mark from reading as
 * a row of ticks at 16 px.
 *
 * Kept in step with `public/favicon.svg`, which is the same geometry written
 * out with literal colours because a file served on its own cannot read the
 * page's custom properties.
 * @param props - The mark size.
 * @param props.size - Edge of the square the mark is drawn in, in pixels.
 * @returns The mark, as an inline SVG.
 */
export function BrandMark(props: BrandMarkProps) {
  const { size = 26 } = props;

  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="6" fill="var(--brand)" />
      <path
        d="M5 24h4l2-11 2 11h4l2-15 2 15h3l1.5-7 1.5 7"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="19" cy="9" r="3" fill="var(--brand-alt)" />
    </svg>
  );
}

export interface WordmarkProps {
  /**
   * Extra class names, for sizing or spacing at the place it is used.
   * @default undefined
   */
  className?: string;
}

/**
 * The name, in the two colours this site owns — the way chemcalc.org writes
 * `ChemCalc`. Always lowercase, and always the whole address minus the `.org`,
 * because the address is the name here; the product name `SECS` is carried by
 * the tagline under the bar rather than by the mark.
 *
 * The mark's amber reaches about 2.2:1 on white, far too little for text, so
 * the second half is set in a darkened one of the same hue.
 * @param props - The wordmark options.
 * @param props.className - Extra class names, for sizing or spacing.
 * @returns The site name, in its two colours.
 */
export function Wordmark(props: WordmarkProps) {
  const { className } = props;

  return (
    <span className={className ? `wordmark ${className}` : 'wordmark'}>
      <span className="wordmark__lead">elucidation</span>
      <span className="wordmark__dot">.</span>
      <span className="wordmark__alt">cheminfo</span>
    </span>
  );
}
