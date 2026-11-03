import { parseAmount } from '../lib/amount';
import { parseDate } from '../lib/date';
import { uniqueHeaders } from '../lib/headers';

export type TextItem = {
  text: string;
  x: number;
  y: number;
  width?: number;
};

const ROW_TOLERANCE = 2;

function explodeItem(item: TextItem): TextItem[] {
  const text = item.text.replace(/\s+/g, (gap) => (gap.length > 1 ? gap : ' '));
  if (!text.trim()) return [];
  if (!/\s{2,}/.test(text)) return [{ ...item, text: text.trim() }];

  const width = item.width && item.width > 0 ? item.width : text.length * 5;
  const charWidth = width / text.length;
  const parts: TextItem[] = [];
  let x = item.x;
  for (const token of text.split(/(\s{2,})/)) {
    if (!token) continue;
    if (/^\s+$/.test(token)) {
      x += token.length * charWidth;
      continue;
    }
    const value = token.trim();
    if (value) parts.push({ text: value, x, y: item.y });
    x += token.length * charWidth;
  }
  return parts;
}

function clusterRows(items: TextItem[]): TextItem[][] {
  const sorted = items
    .flatMap(explodeItem)
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: TextItem[][] = [];
  for (const item of sorted) {
    const current = rows[rows.length - 1];
    if (!current || Math.abs(current[0].y - item.y) > ROW_TOLERANCE) rows.push([item]);
    else current.push(item);
  }
  for (const row of rows) row.sort((a, b) => a.x - b.x);
  return rows;
}

function isHeaderRow(cells: string[]): boolean {
  const filled = cells.filter(Boolean);
  if (filled.length < 2) return false;
  if (filled.some((cell) => parseDate(cell) || parseAmount(cell) != null)) return false;
  const words = filled.filter((cell) => /[A-Za-z]{2,}/.test(cell));
  return words.length >= Math.max(2, filled.length - 1);
}

function nearest(x: number, anchors: number[]): number {
  let index = 0;
  let distance = Infinity;
  for (let i = 0; i < anchors.length; i += 1) {
    const gap = Math.abs(x - anchors[i]);
    if (gap < distance) {
      distance = gap;
      index = i;
    }
  }
  return index;
}

/** Group positioned text into a table. Used by the PDF parser and covered on its own. */
export function tableFromTextItems(items: TextItem[]): {
  columns: string[];
  rows: Record<string, string>[];
} {
  const lines = clusterRows(items);
  if (lines.length === 0) return { columns: [], rows: [] };

  const anchorLine = lines.reduce((best, line) => (line.length > best.length ? line : best));
  const anchors: number[] = [];
  for (const item of [...anchorLine].sort((a, b) => a.x - b.x)) {
    if (anchors.length === 0 || item.x - anchors[anchors.length - 1] > 8) anchors.push(item.x);
  }

  const matrix = lines
    .map((line) => {
      const cells = Array<string>(anchors.length).fill('');
      for (const item of line) {
        const index = nearest(item.x, anchors);
        cells[index] = cells[index] ? `${cells[index]} ${item.text}` : item.text;
      }
      return cells.map((cell) => cell.trim());
    })
    .filter((cells) => cells.some(Boolean));

  let headerIndex = matrix.findIndex(isHeaderRow);
  if (headerIndex < 0) headerIndex = 0;
  const columns = uniqueHeaders(matrix[headerIndex].map((cell, index) => cell || `Column ${index + 1}`));
  const rows = matrix.slice(headerIndex + 1).map((cells) => {
    const record: Record<string, string> = {};
    columns.forEach((column, index) => {
      record[column] = cells[index] ?? '';
    });
    return record;
  }).filter((row) => Object.values(row).some(Boolean));

  return { columns, rows };
}
