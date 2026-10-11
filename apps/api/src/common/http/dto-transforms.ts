/** class-transformer helpers shared by request DTOs. */

/** Trims a string; other values pass through for the validators to reject. */
export const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Optional text: trimmed, and an empty value means "not set" (API Design §3). */
export const trimToNull = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};
