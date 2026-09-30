'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { ButtonLink } from '../ui/button-link';
import { Icon } from '../ui/icon';
import { headerLinks, signInHref, signUpHref } from './site-links';

/**
 * Collapsible navigation for narrow screens. The panel drops down under the sticky
 * header, closes on navigation, on Escape and on outside clicks, and keeps the sign-up
 * call to action at the bottom of the menu.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={rootRef} className="lg:hidden">
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex size-11 items-center justify-center rounded-lg text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-secondary"
      >
        <Icon name={open ? 'close' : 'menu'} className="size-6" />
        <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-outline-variant/30 bg-surface-container-lowest shadow-lg"
      >
        <nav aria-label="Main" className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <ul className="space-y-1">
            {headerLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={close}
                  className="block rounded-lg px-3 py-3 text-title-md text-on-surface transition-colors hover:bg-surface-container hover:text-secondary"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-3 border-t border-outline-variant/30 pt-4">
            <ButtonLink href={signUpHref} size="lg" trailingIcon="arrow_forward" className="w-full">
              Create Your Wedding
            </ButtonLink>
            <ButtonLink href={signInHref} variant="secondary" size="lg" className="w-full">
              Sign In
            </ButtonLink>
          </div>
        </nav>
      </div>
    </div>
  );
}
