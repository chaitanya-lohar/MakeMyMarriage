import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon, type IconName } from './icon';

type Variant = 'primary' | 'secondary' | 'champagne' | 'on-dark';
type Size = 'md' | 'lg';

const variantClasses: Record<Variant, string> = {
  // Midnight navy pill with a champagne hairline (design system: primary button).
  primary:
    'bg-primary-container text-on-primary border border-secondary/40 shadow-sm hover:border-secondary hover:shadow-md',
  // Quiet outline pill on light surfaces.
  secondary: 'text-on-surface border border-outline-variant/50 hover:bg-surface-container',
  // Champagne fill for the dark call-to-action band.
  champagne:
    'bg-secondary-fixed text-on-secondary-fixed font-bold shadow-lg hover:bg-secondary-fixed-dim hover:shadow-xl',
  // Outline pill on the dark call-to-action band.
  'on-dark': 'text-white border border-outline-variant/40 hover:bg-white/5',
};

const sizeClasses: Record<Size, string> = {
  md: 'px-5 py-2.5',
  lg: 'px-8 py-3.5',
};

interface ButtonLinkProps {
  href: string;
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  leadingIcon?: IconName;
  trailingIcon?: IconName;
  className?: string;
}

/** A link styled as a design-system button. */
export function ButtonLink({
  href,
  children,
  variant = 'primary',
  size = 'md',
  leadingIcon,
  trailingIcon,
  className = '',
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center justify-center gap-2 rounded-full text-label-md whitespace-nowrap transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary active:scale-95 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {leadingIcon && <Icon name={leadingIcon} className="size-5 text-secondary" />}
      <span>{children}</span>
      {trailingIcon && (
        <Icon
          name={trailingIcon}
          className="size-[18px] transition-transform duration-150 group-hover:translate-x-1"
        />
      )}
    </Link>
  );
}
