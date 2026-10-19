'use client';

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Makes `container` behave as a modal while mounted (review P7-M4):
 * - focus moves into it (to `initialFocus`, or its first focusable element);
 * - Tab and Shift+Tab stay inside it;
 * - Escape calls `onClose`, unless `canClose` is false (e.g. while saving);
 * - the page behind does not scroll;
 * - on close, focus returns to the element that had it before, e.g. the button that opened it.
 */
export function useModal(
  container: RefObject<HTMLElement | null>,
  {
    onClose,
    canClose = true,
    initialFocus,
  }: {
    onClose: () => void;
    canClose?: boolean;
    initialFocus?: RefObject<HTMLElement | null>;
  },
): void {
  // Read at key time, so a changing callback or flag does not restart the effect.
  const latest = useRef({ onClose, canClose });
  useEffect(() => {
    latest.current = { onClose, canClose };
  }, [onClose, canClose]);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusables = () =>
      Array.from(container.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    (initialFocus?.current ?? focusables()[0] ?? container.current)?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (latest.current.canClose) latest.current.onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0] as HTMLElement;
      const last = items[items.length - 1] as HTMLElement;
      const active = document.activeElement;
      const inside = active instanceof Node && container.current?.contains(active);
      if (event.shiftKey && (active === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    };

    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
    // Runs once per opening; the refs are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
