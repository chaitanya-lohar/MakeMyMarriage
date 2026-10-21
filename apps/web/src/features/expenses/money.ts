/**
 * Rupee amounts (decision 0028 #6): entered in rupees with at most two decimals, sent and
 * stored as integer paise. Text is turned into paise digit by digit, never through floating
 * point, so ₹1,50,000.50 is exactly 15000050.
 */

/** ₹10 crore in paise; the API enforces the same. */
export const MAX_AMOUNT_MINOR = 10_000_000_000;

export type AmountProblem = 'required' | 'invalid' | 'decimals' | 'zero' | 'tooLarge';

/** Paise for what was typed, or why it is not a valid amount. Commas and spaces are ignored. */
export function parseRupees(text: string): { minor: number } | { problem: AmountProblem } {
  const cleaned = text.replace(/[\s,]/g, '').replace(/^₹/, '');
  if (cleaned === '') return { problem: 'required' };
  const match = /^(\d+)(?:\.(\d*))?$/.exec(cleaned);
  if (!match) return { problem: 'invalid' };
  const [, whole = '', fraction = ''] = match;
  if (fraction.length > 2) return { problem: 'decimals' };
  // More digits than ₹10 crore can have: too large, whatever they are.
  if (whole.replace(/^0+/, '').length > 9) return { problem: 'tooLarge' };
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (minor === 0) return { problem: 'zero' };
  if (minor > MAX_AMOUNT_MINOR) return { problem: 'tooLarge' };
  return { minor };
}

const pad2 = (value: number) => String(value).padStart(2, '0');

/** "₹1,50,000", or "₹1,50,000.50" when there are paise (Indian grouping — 0028 #24). */
export function formatRupees(minor: number): string {
  const sign = minor < 0 ? '−' : '';
  const absolute = Math.abs(minor);
  const whole = Math.floor(absolute / 100);
  const paise = absolute % 100;
  return `${sign}₹${whole.toLocaleString('en-IN')}${paise ? `.${pad2(paise)}` : ''}`;
}

/** The amount as the form shows it for editing: "150000" or "150000.50", no grouping. */
export function toRupeeInput(minor: number): string {
  const whole = Math.floor(minor / 100);
  const paise = minor % 100;
  return paise ? `${whole}.${pad2(paise)}` : String(whole);
}
