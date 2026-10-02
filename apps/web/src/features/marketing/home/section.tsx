import type { ReactNode } from 'react';

/** Full-width home page band with the shared container and vertical rhythm. */
export function Section({
  id,
  tone,
  bordered = true,
  children,
}: {
  id?: string;
  tone: 'surface' | 'low';
  bordered?: boolean;
  children: ReactNode;
}) {
  const background = tone === 'surface' ? 'bg-surface' : 'bg-surface-container-low';
  return (
    <section
      id={id}
      className={`py-16 sm:py-20 md:py-24 ${background} ${bordered ? 'border-b border-outline-variant/30' : ''}`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-12">{children}</div>
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-label-sm text-secondary uppercase">{children}</p>;
}

/** Section eyebrow, heading and lead paragraph. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  lead = 'lg',
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  align?: 'center' | 'start';
  lead?: 'lg' | 'md';
  /** Extra content under the lead paragraph. */
  children?: ReactNode;
}) {
  const alignment = align === 'center' ? 'mx-auto text-center max-w-3xl' : 'max-w-3xl';
  return (
    <div className={`mb-12 space-y-3 md:mb-16 ${alignment}`}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="font-serif text-headline-lg-mobile text-on-surface md:text-headline-lg">
        {title}
      </h2>
      <p
        className={`text-on-surface-variant ${lead === 'lg' ? 'text-body-md sm:text-body-lg' : 'text-body-md'}`}
      >
        {description}
      </p>
      {children}
    </div>
  );
}

/** Rounded frame with a fake browser bar, used for product mock-ups. */
export function BrowserFrame({
  address,
  label,
  variant,
  children,
}: {
  address: string;
  label: ReactNode;
  variant: 'app' | 'site';
  children: ReactNode;
}) {
  const app = variant === 'app';
  return (
    <div
      className={`mx-auto overflow-hidden rounded-2xl bg-surface-container-lowest ${
        app
          ? 'max-w-6xl border border-outline-variant/40 shadow-2xl'
          : 'max-w-5xl border border-secondary/30 shadow-xl'
      }`}
    >
      <div
        className={`flex items-center justify-between gap-3 border-b border-outline-variant/30 px-4 text-xs ${
          app ? 'bg-surface-container-high py-3' : 'bg-surface-container py-2'
        }`}
      >
        <div className="flex shrink-0 items-center gap-1.5">
          {app ? (
            <>
              <span className="size-3 rounded-full bg-error/70" />
              <span className="size-3 rounded-full bg-secondary-fixed" />
              <span className="size-3 rounded-full bg-tertiary-fixed-dim" />
            </>
          ) : (
            <>
              <span className="size-2.5 rounded-full bg-outline-variant" />
              <span className="size-2.5 rounded-full bg-outline-variant" />
              <span className="size-2.5 rounded-full bg-outline-variant" />
            </>
          )}
        </div>
        <div
          className={`min-w-0 truncate font-mono text-on-surface-variant ${
            app
              ? 'rounded-md border border-outline-variant/30 bg-surface-container-lowest px-4 py-1 sm:w-72 sm:text-center'
              : 'text-[11px]'
          }`}
        >
          {address}
        </div>
        <div className="hidden shrink-0 sm:block">{label}</div>
      </div>
      {children}
    </div>
  );
}
