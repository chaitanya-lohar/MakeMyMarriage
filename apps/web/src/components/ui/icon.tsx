import { iconPaths, type IconName } from './icon-paths';

export type { IconName };

interface IconProps {
  name: IconName;
  /** Tailwind size and colour classes; the icon inherits the text colour. */
  className?: string;
  /** Accessible label. Omit for decorative icons next to visible text. */
  label?: string;
}

/** Material Symbols (Outlined) icon rendered as inline SVG. */
export function Icon({ name, className = 'size-6', label }: IconProps) {
  return (
    <svg
      viewBox="0 -960 960 960"
      fill="currentColor"
      className={`inline-block shrink-0 ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}
