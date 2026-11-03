import type { MatchLine, MatchResult } from '../types';

const HEADERS = [
  'status',
  'reason',
  'key',
  'amount A',
  'amount B',
  'date A',
  'date B',
  'row A',
  'row B',
];

const STATUS_LABEL: Record<MatchLine['status'], string> = {
  matched: 'Matched',
  mismatched: 'Mismatched',
  onlyA: 'Only in A',
  onlyB: 'Only in B',
};

function cell(value: string): string {
  // A leading = + - @, tab, or carriage return can run as a formula in a spreadsheet.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

function money(value: number | null): string {
  return value == null ? '' : value.toFixed(2);
}

export function allMatchLines(result: MatchResult): MatchLine[] {
  return [...result.matched, ...result.mismatched, ...result.onlyA, ...result.onlyB];
}

export function matchToCsv(lines: MatchLine[]): string {
  const rows = [
    HEADERS.join(','),
    ...lines.map((line) =>
      [
        STATUS_LABEL[line.status],
        line.reason,
        line.key,
        money(line.amountA),
        money(line.amountB),
        line.dateA ?? '',
        line.dateB ?? '',
        line.rowA,
        line.rowB,
      ]
        .map(cell)
        .join(','),
    ),
  ];
  return `${rows.join('\n')}\n`;
}
