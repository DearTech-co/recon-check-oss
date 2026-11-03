const CURRENCY_CODES = 'GBP|USD|EUR|AUD|CAD|JPY|CHF|INR|NZD|ZAR';

/**
 * Read a money cell into a number.
 * Currency symbols, thousand separators, and European decimal commas are accepted.
 * Parentheses and a trailing DR mark a negative amount.
 */
export function parseAmount(input: string | null | undefined): number | null {
  if (input == null) return null;
  let s = String(input).trim();
  if (!s) return null;

  let negative = false;
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true;
    s = s.slice(1, -1).trim();
  }

  const trail = s.match(/\s*(CR|DR)\.?$/i);
  if (trail) {
    if (trail[1].toUpperCase() === 'DR') negative = true;
    s = s.slice(0, trail.index).trim();
  }

  s = s.replace(new RegExp(`^(?:${CURRENCY_CODES})\\s*`, 'i'), '');
  // Rand is written as a leading R, as in "R1 234,56" or "R -50.00".
  s = s.replace(/^R(?=\s|-|−|\d)/i, '');
  s = s.replace(/[£$€¥₹]/g, '');
  s = s.replace(new RegExp(`\\s*(?:${CURRENCY_CODES})$`, 'i'), '');
  s = s.replace(/[\s\u00a0]/g, '');

  if (s.startsWith('+')) s = s.slice(1);
  if (s.startsWith('-') || s.startsWith('−')) {
    negative = true;
    s = s.slice(1);
  }
  if (s.endsWith('-') || s.endsWith('−')) {
    negative = true;
    s = s.slice(0, -1);
  }

  if (!/\d/.test(s)) return null;
  s = normaliseSeparators(s);
  if (!/^\d+(\.\d+)?$/.test(s)) return null;

  const cents = Math.round(Number(s) * 100);
  if (!Number.isFinite(cents)) return null;
  const value = cents / 100;
  return negative ? -value : value;
}

function normaliseSeparators(s: string): string {
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma >= 0 && lastDot >= 0) {
    return lastComma > lastDot
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '');
  }

  if (lastComma >= 0) return collapse(s, ',');
  if (lastDot >= 0) return collapse(s, '.');
  return s;
}

/** A single separator with 1–2 digits after it is decimal. Groups of 3 are thousands. */
function collapse(s: string, sep: ',' | '.'): string {
  const parts = s.split(sep);
  if (parts.some((part) => !/^\d+$/.test(part))) return s;
  const frac = parts[parts.length - 1];

  if (parts.length === 2 && frac.length > 0 && frac.length <= 2) {
    return `${parts[0]}.${frac}`;
  }

  if (frac.length === 3 && parts.slice(1).every((part) => part.length === 3)) {
    return parts.join('');
  }

  if (parts.length > 2 && frac.length > 0 && frac.length <= 2) {
    return `${parts.slice(0, -1).join('')}.${frac}`;
  }

  return s;
}

export function columnAmountRole(name: string): 'debit' | 'credit' | 'plain' {
  const n = name.toLowerCase().replace(/[^a-z]/g, '');
  const debit = /debit|moneyout|withdrawal|paidout/.test(n);
  const credit = /credit|moneyin|deposit|paidin/.test(n);
  if (debit && credit) return 'plain';
  if (debit) return 'debit';
  if (credit) return 'credit';
  return 'plain';
}

/**
 * Sum the chosen amount columns.
 * When more than one is chosen, debit columns are subtracted and credit columns are added.
 */
export function combineAmounts(cells: Record<string, string>, columns: string[]): number | null {
  if (columns.length === 0) return null;
  const split = columns.length > 1;
  let cents = 0;
  let any = false;

  for (const column of columns) {
    const raw = cells[column];
    if (raw == null || !String(raw).trim()) continue;
    const parsed = parseAmount(raw);
    if (parsed == null) continue;
    any = true;
    const role = split ? columnAmountRole(column) : 'plain';
    const value = Math.round(Math.abs(parsed) * 100);
    if (role === 'debit') cents -= value;
    else if (role === 'credit') cents += value;
    else cents += Math.round(parsed * 100);
  }

  return any ? cents / 100 : null;
}
