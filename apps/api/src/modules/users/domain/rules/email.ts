/** Canonical form of an email address for storage and lookup (API Design §22). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
