import { combineAmounts } from './amount';
import { parseDate } from './date';
import type { ColumnMapping, NormalizedRow, ParsedTable } from '../types';

export function normaliseKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/** Turn a parsed table plus the user's column choices into the shared row shape. */
export function normaliseRows(table: ParsedTable, mapping: ColumnMapping): NormalizedRow[] {
  return table.rows.map((cells, index) => ({
    rowNumber: index + 1,
    key: cells[mapping.keyColumn] ?? '',
    amount: combineAmounts(cells, mapping.amountColumns),
    date: mapping.dateColumn ? parseDate(cells[mapping.dateColumn] ?? '') : null,
    cells,
  }));
}
