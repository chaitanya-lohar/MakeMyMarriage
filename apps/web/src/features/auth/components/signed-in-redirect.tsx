'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { api, call } from '@/lib/api';

/**
 * Sends a visitor who is already signed in to /dashboard (approved 2026-10-05). Used on
 * /login, /signup and /forgot-password, not /reset-password, which opens from an email.
 * The session cookies are HttpOnly, so the check asks the API; the form stays usable
 * meanwhile.
 */
export function SignedInRedirect() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    void call(() => api.GET('/api/v1/me')).then((result) => {
      if (active && result.data) router.replace('/dashboard');
    });
    return () => {
      active = false;
    };
  }, [router]);

  return null;
}
