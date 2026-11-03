import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { normaliseRows } from '../src/lib/normalise';
import { suggestMapping } from '../src/lib/suggest';
import { parseCamt053 } from '../src/parsers/camt053';
import { parseCsv } from '../src/parsers/csv';
import { parseFile } from '../src/parsers/parseFile';
import { parseXlsx } from '../src/parsers/xlsx';
import { tableFromTextItems } from '../src/parsers/pdfTable';
import type { ParsedTable } from '../src/types';

const EXPECTED = [
  ['REF001', -4.5, '2024-01-15'],
  ['REF002', 1200, '2024-01-16'],
  ['REF003', -19.99, '2024-02-01'],
];

async function parsedRows(filename: string) {
  const bytes = readFileSync(`samples/${filename}`);
  const table = await parseFile(filename, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  expect(table.error, table.error).toBeUndefined();
  const mapping = suggestMapping(table.columns);
  const rows = normaliseRows(table, mapping);
  return { table, mapping, rows };
}

describe('parsers', () => {
  it.each([
    'statement.csv',
    'statement.xlsx',
    'statement.ofx',
    'statement.qfx',
    'statement.qif',
    'statement.camt053.xml',
    'statement.mt940',
    'statement.pdf',
  ])('reads %s into the shared row shape', async (filename) => {
    const { rows, mapping } = await parsedRows(filename);
    expect(mapping.keyColumn).not.toBe('');
    expect(mapping.amountColumns.length).toBeGreaterThan(0);
    expect(mapping.dateColumn).not.toBe('');
    expect(rows.map((row) => [row.key, row.amount, row.date])).toEqual(EXPECTED);
  });

  it('reads a text PDF by rows and columns', async () => {
    const { table } = await parsedRows('statement.pdf');
    expect(table.format).toBe('pdf');
    expect(table.columns).toEqual(['Date', 'Description', 'Amount', 'Reference']);
    expect(table.rows[0]).toMatchObject({
      Date: '2024-01-15',
      Description: 'Coffee',
      Amount: '-4.50',
      Reference: 'REF001',
    });
  });

  it('includes the underlying PDF error while developing', async () => {
    const bytes = new TextEncoder().encode('this is not a pdf');
    const table = await parseFile('broken.pdf', bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    expect(table.error?.startsWith('We could not read this PDF.')).toBe(true);
    if (import.meta.env.DEV) {
      expect(table.error).not.toBe('We could not read this PDF.');
    }
  });

  it('tells the user when a PDF has no text', async () => {
    const bytes = readFileSync('samples/statement-image-only.pdf');
    const table = await parseFile(
      'statement-image-only.pdf',
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
    expect(table.error).toMatch(/not supported yet/);
    expect(table.rows).toEqual([]);
    expect(table.columns).toEqual([]);
  });

  it('builds a table from spaced text when cells are not separate items', () => {
    const width = (text: string) => text.length * 5;
    const header = 'Date    Description    Amount';
    const body = '2024-01-15    Coffee    -4.50';
    const table = tableFromTextItems([
      { text: header, x: 10, y: 100, width: width(header) },
      { text: body, x: 10, y: 80, width: width(body) },
    ]);
    expect(table.columns).toEqual(['Date', 'Description', 'Amount']);
    expect(table.rows[0]).toEqual({
      Date: '2024-01-15',
      Description: 'Coffee',
      Amount: '-4.50',
    });
  });

  it('keeps quoted commas and detects a semicolon file', () => {
    const quoted = parseCsv('reference,description,amount\nREF001,"Coffee, large",-4.50\n');
    expect(quoted.rows[0]).toEqual({
      reference: 'REF001',
      description: 'Coffee, large',
      amount: '-4.50',
    });

    const semi = parseCsv('reference;amount;date\nREF001;12,50;15/01/2024\n');
    expect(semi.columns).toEqual(['reference', 'amount', 'date']);
    expect(semi.rows[0].amount).toBe('12,50');
  });

  it('warns when an Excel file has more than one sheet and uses the first', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['reference', 'amount', 'date'],
        ['REF001', '-4.50', '2024-01-15'],
      ]),
      'First',
    );
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['ignore'], ['x']]), 'Second');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const table = parseXlsx(buffer);
    expect(table.warnings[0]).toMatch(/First/);
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0].reference).toBe('REF001');
  });

  it('reads namespaced CAMT entries, including the debit sign', () => {
    const xml = readFileSync('samples/statement.camt053.xml', 'utf8');
    const table = parseCamt053(xml);
    expect(table.rows.map((row) => [row.endToEndId, row.amount, row.counterparty])).toEqual([
      ['REF001', '-4.50', 'Coffee'],
      ['REF002', '1200.00', 'Client payment'],
      ['REF003', '-19.99', 'Software'],
    ]);
  });

  it('suggests a key, amount, and date, and both sides of a debit and credit pair', () => {
    expect(suggestMapping(['Date', 'Description', 'Amount', 'Reference'])).toEqual({
      keyColumn: 'Reference',
      amountColumns: ['Amount'],
      dateColumn: 'Date',
    });
    expect(suggestMapping(['Posted', 'Debit', 'Credit', 'Invoice Number'])).toEqual({
      keyColumn: 'Invoice Number',
      amountColumns: ['Debit', 'Credit'],
      dateColumn: 'Posted',
    });
  });
});

describe('sample pair', () => {
  it('has the expected matched, mismatched, and only-in counts', async () => {
    const load = async (filename: string): Promise<ParsedTable> => {
      const bytes = readFileSync(`samples/${filename}`);
      return parseFile(filename, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    };
    const [fileA, fileB] = await Promise.all([load('pair-a.csv'), load('pair-b.csv')]);
    const mappingA = suggestMapping(fileA.columns);
    const mappingB = suggestMapping(fileB.columns);
    expect(mappingA).toEqual({ keyColumn: 'reference', amountColumns: ['amount'], dateColumn: 'date' });
    expect(mappingB).toEqual(mappingA);

    const { reconcile } = await import('../src/lib/match');
    const result = reconcile({
      rowsA: normaliseRows(fileA, mappingA),
      rowsB: normaliseRows(fileB, mappingB),
      amountTolerance: 0,
      dateToleranceDays: 0,
      compareDates: true,
    });

    expect(result.summary).toEqual({ matched: 2, mismatched: 3, onlyA: 1, onlyB: 1 });
    expect(result.matched.map((line) => line.key).sort()).toEqual(['INV001', 'INV006']);
    expect(result.onlyA.map((line) => line.key)).toEqual(['INV005']);
    expect(result.onlyB.map((line) => line.key)).toEqual(['INV008']);
    expect(result.mismatched.find((line) => line.key === 'INV002')?.reason).toBe('amount differs by 5.00');
    expect(result.mismatched.find((line) => line.key === 'INV003')?.reason).toBe('date differs');
    expect(result.mismatched.find((line) => line.key === 'INV004')).toMatchObject({
      reason: 'duplicate key',
      rowA: '4, 5',
      rowB: '4',
    });
  });
});
