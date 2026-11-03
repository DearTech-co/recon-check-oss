import type { ParsedTable } from '../types';

const FIELDS: Record<string, string> = {
  D: 'date',
  T: 'amount',
  P: 'payee',
  M: 'memo',
  N: 'number',
  L: 'category',
};

const COLUMNS = ['date', 'amount', 'payee', 'memo', 'number', 'category'];

function blank(): Record<string, string> {
  return { date: '', amount: '', payee: '', memo: '', number: '', category: '' };
}

export function parseQif(text: string): ParsedTable {
  const rows: Record<string, string>[] = [];
  let current: Record<string, string> | null = null;

  const flush = () => {
    if (current && Object.values(current).some((value) => value.trim() !== '')) rows.push(current);
    current = null;
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('!')) continue;
    if (line === '^') {
      flush();
      continue;
    }
    const field = FIELDS[line[0]];
    if (!field) continue;
    current ??= blank();
    current[field] = line.slice(1).trim();
  }
  flush();

  return {
    format: 'qif',
    columns: COLUMNS,
    rows,
    warnings: rows.length === 0 ? ['No transactions were found in this QIF file.'] : [],
  };
}
