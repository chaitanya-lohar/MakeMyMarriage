/**
 * Where to go after signing in or up. Only a member-invitation page may be asked for (the
 * invitee returns to accept, Stitch "P10 · M7"); anything else is the dashboard, so the
 * parameter can never send a user to another site or page.
 */
export function nextPath(value: unknown): string {
  return typeof value === 'string' && /^\/member-invite\/[A-Za-z0-9_-]{43}$/.test(value)
    ? value
    : '/dashboard';
}
