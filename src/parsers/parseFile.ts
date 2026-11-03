import { parseCamt053 } from './camt053';
import { parseCsv } from './csv';
import { parseMt940 } from './mt940';
import { parseOfx } from './ofx';
import { parsePdf } from './pdf';
import { parseQif } from './qif';
import { parseXlsx } from './xlsx';
import type { ParsedTable } from '../types';

function extension(filename: string): string {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() ?? '' : '';
}

function decode(data: ArrayBuffer): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(data).replace(/^\uFEFF/, '');
}

/** Pick a parser from the file name, then from the contents, and return one table. */
export async function parseFile(filename: string, data: ArrayBuffer): Promise<ParsedTable> {
  const ext = extension(filename);
  if (ext === 'pdf') return parsePdf(data);
  if (ext === 'xlsx' || ext === 'xls') return parseXlsx(data);

  const text = decode(data);
  if (ext === 'ofx' || ext === 'qfx') return parseOfx(text);
  if (ext === 'qif') return parseQif(text);
  if (ext === 'xml' || /camt\.053|BkToCstmrStmt/i.test(text)) return parseCamt053(text);
  if (ext === 'sta' || ext === 'mt940' || ext === '940') return parseMt940(text);
  if (ext === 'csv' || ext === 'tsv') return parseCsv(text);

  if (/<OFX>/i.test(text) || /<STMTTRN>/i.test(text)) return parseOfx(text);
  if (/^!Type:/m.test(text)) return parseQif(text);
  if (/^:20:/m.test(text) && /:61:/.test(text)) return parseMt940(text);
  return parseCsv(text);
}
