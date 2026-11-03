import * as XLSX from 'xlsx';
import { uniqueHeaders } from '../lib/headers';
import type { ParsedTable } from '../types';

export function parseXlsx(data: ArrayBuffer | Uint8Array): ParsedTable {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { format: 'xlsx', columns: [], rows: [], warnings: ['This workbook has no sheets.'] };
  }

  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(workbook.Sheets[sheetName], {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  });

  const filled = matrix.filter((cells) => cells.some((cell) => String(cell ?? '').trim() !== ''));
  if (filled.length === 0) {
    return { format: 'xlsx', columns: [], rows: [], warnings: ['The first sheet is empty.'] };
  }

  const columns = uniqueHeaders(filled[0].map((cell) => String(cell ?? '')));
  const rows = filled.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    columns.forEach((column, index) => {
      record[column] = String(cells[index] ?? '').trim();
    });
    return record;
  });

  const warnings =
    workbook.SheetNames.length > 1 ? [`Used the first sheet (${sheetName}).`] : [];

  return { format: 'xlsx', columns, rows, warnings };
}
