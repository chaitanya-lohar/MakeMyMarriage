/**
 * Where to go after signing in or up. Only an invitation page may be asked for — a member
 * invitation (Stitch "P10 · M7") or a partner invitation ("P16 · M16-03"), where the invitee
 * returns to accept; anything else is the dashboard, so the parameter can never send a user
 * to another site or page.
 */
export function nextPath(value: unknown): string {
  return typeof value === 'string' && /^\/(member|partner)-invite\/[A-Za-z0-9_-]{43}$/.test(value)
    ? value
    : '/dashboard';
}
