import type { ParsedTable } from '../types';

const COLUMNS = ['date', 'amount', 'type', 'reference', 'bankReference', 'details'];

const TXN =
  /^(?<value>\d{6})(?<entry>\d{4})?(?<mark>RC|RD|C|D)(?<funds>[A-Z])?(?<amount>\d+[,.]\d*|\d+)(?<type>[A-Z][A-Z0-9]{3})(?<ref>[^/\r\n]{0,16})(?:\/\/(?<bank>[^\r\n]{0,16}))?/;

function blank(): Record<string, string> {
  return { date: '', amount: '', type: '', reference: '', bankReference: '', details: '' };
}

function joinDetails(current: string, extra: string): string {
  if (!extra) return current;
  return current ? `${current} ${extra}` : extra;
}

function parse61(body: string): Record<string, string> {
  const match = body.trim().match(TXN);
  if (!match?.groups) {
    const row = blank();
    row.details = body.trim();
    return row;
  }
  const groups = match.groups;
  const negative = groups.mark === 'D' || groups.mark === 'RC';
  return {
    date: groups.value,
    amount: `${negative ? '-' : ''}${groups.amount}`,
    type: groups.type,
    reference: groups.ref.trim(),
    bankReference: (groups.bank ?? '').trim(),
    details: '',
  };
}

export function parseMt940(text: string): ParsedTable {
  const rows: Record<string, string>[] = [];
  let current: Record<string, string> | null = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\r$/, '');
    if (line.startsWith(':61:')) {
      if (current) rows.push(current);
      current = parse61(line.slice(4));
      continue;
    }
    if (!current) continue;
    if (line.startsWith(':86:')) {
      current.details = joinDetails(current.details, line.slice(4).trim());
      continue;
    }
    if (line.trim() === '-' || line.startsWith('-}')) {
      rows.push(current);
      current = null;
      continue;
    }
    if (line.startsWith(':')) continue;
    if (line.trim()) current.details = joinDetails(current.details, line.trim());
  }
  if (current) rows.push(current);

  return {
    format: 'mt940',
    columns: COLUMNS,
    rows,
    warnings: rows.length === 0 ? ['No transactions were found in this MT940 file.'] : [],
  };
}
