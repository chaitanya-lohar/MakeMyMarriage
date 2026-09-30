import type { ReactNode } from 'react';

/**
 * Status chip tones from the design system: sage for confirmed/paid, champagne for
 * pending/highlighted, neutral for informational, muted for low-emphasis tags.
 */
export type ChipTone = 'sage' | 'champagne' | 'neutral' | 'muted';

const toneClasses: Record<ChipTone, string> = {
  sage: 'bg-tertiary-fixed text-on-tertiary-fixed',
  champagne: 'bg-secondary-fixed text-on-secondary-fixed',
  neutral: 'bg-surface-container text-on-surface-variant',
  muted: 'bg-surface-container-highest text-on-surface-variant',
};

interface ChipProps {
  tone: ChipTone;
  children: ReactNode;
  /** Pills for statuses; `tag` is the squarer label used for categories and badges. */
  shape?: 'pill' | 'tag';
  className?: string;
}

export function Chip({ tone, children, shape = 'pill', className = '' }: ChipProps) {
  const shapeClasses = shape === 'pill' ? 'rounded-full px-2.5 py-0.5' : 'rounded px-2 py-0.5';
  return (
    <span
      className={`inline-flex items-center font-semibold whitespace-nowrap ${shapeClasses} ${toneClasses[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
