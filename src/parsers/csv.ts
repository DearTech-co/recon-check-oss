import { uniqueHeaders } from '../lib/headers';
import type { ParsedTable } from '../types';

function detectDelimiter(text: string): string {
  const line = text.split(/\r?\n/).find((row) => row.trim()) ?? '';
  const score = (delimiter: string) => {
    let count = 0;
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (quoted && line[i + 1] === '"') {
          i += 1;
          continue;
        }
        quoted = !quoted;
        continue;
      }
      if (!quoted && char === delimiter) count += 1;
    }
    return count;
  };
  const comma = score(',');
  const semicolon = score(';');
  const tab = score('\t');
  if (tab > comma && tab >= semicolon) return '\t';
  if (semicolon > comma) return ';';
  return ',';
}

function splitCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === delimiter) {
      row.push(field);
      field = '';
      continue;
    }
    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    if (char === '\r') continue;
    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
}

export function parseCsv(text: string): ParsedTable {
  let source = text.replace(/^\uFEFF/, '');
  const firstLine = source.split(/\r?\n/, 1)[0] ?? '';
  const sep = firstLine.match(/^sep=(.)$/i);
  const delimiter = sep ? sep[1] : detectDelimiter(source);
  if (sep) source = source.slice(firstLine.length).replace(/^\r?\n/, '');

  const matrix = splitCsv(source, delimiter);
  if (matrix.length === 0) {
    return { format: 'csv', columns: [], rows: [], warnings: ['This file has no rows.'] };
  }

  const columns = uniqueHeaders(matrix[0]);
  const rows = matrix.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    columns.forEach((column, index) => {
      record[column] = (cells[index] ?? '').trim();
    });
    return record;
  });

  return { format: 'csv', columns, rows, warnings: [] };
}
