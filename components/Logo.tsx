/** Beat Pad mark: two keycap pairs, rotated 45°. Uses currentColor. */
/** one keycap pair: its outline, and the line between its two keys. The mark is two of these, the second turned 180°. */
export const LOGO_OUTLINE = 'M-192-246H192A44 44 0 0 1 236-202V-86A44 44 0 0 1 192-42H48L0-86-48-42H-192A44 44 0 0 1-236-86V-202A44 44 0 0 1-192-246Z';
export const LOGO_DIVIDER = 'M0-246V-86';
const HALF = LOGO_OUTLINE + LOGO_DIVIDER;

export const Logo = ({ className, stroke = 28 }: { className?: string; stroke?: number }) => (
  <svg className={className} viewBox="-360 -360 720 720" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
    <g transform="rotate(-45)">
      <path d={HALF} />
      <path d={HALF} transform="rotate(180)" />
    </g>
  </svg>
);
