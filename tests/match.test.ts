import { describe, expect, it } from 'vitest';
import { reconcile } from '../src/lib/match';
import { normaliseRows } from '../src/lib/normalise';
import type { NormalizedRow, ParsedTable } from '../src/types';

function row(partial: Partial<NormalizedRow> & Pick<NormalizedRow, 'key'>): NormalizedRow {
  return {
    rowNumber: partial.rowNumber ?? 1,
    key: partial.key,
    amount: partial.amount ?? null,
    date: partial.date ?? null,
    cells: partial.cells ?? {},
  };
}

function run(
  rowsA: NormalizedRow[],
  rowsB: NormalizedRow[],
  options: { amountTolerance?: number; dateToleranceDays?: number; compareDates?: boolean } = {},
) {
  return reconcile({
    rowsA,
    rowsB,
    amountTolerance: options.amountTolerance ?? 0,
    dateToleranceDays: options.dateToleranceDays ?? 0,
    compareDates: options.compareDates ?? true,
  });
}

describe('reconcile', () => {
  it('matches equal keys, amounts, and dates', () => {
    const result = run(
      [row({ key: ' INV001 ', amount: 100, date: '2024-01-15', rowNumber: 1 })],
      [row({ key: 'INV001', amount: 100, date: '2024-01-15', rowNumber: 4 })],
    );
    expect(result.summary).toEqual({ matched: 1, mismatched: 0, onlyA: 0, onlyB: 0 });
    expect(result.matched[0]).toMatchObject({ key: 'INV001', rowA: '1', rowB: '4', reason: '' });
  });

  it('reports how far the amount is off', () => {
    const result = run(
      [row({ key: 'A', amount: 50, date: '2024-01-16' })],
      [row({ key: 'A', amount: 55, date: '2024-01-16' })],
    );
    expect(result.mismatched[0].reason).toBe('amount differs by 5.00');
  });

  it('reports a date difference', () => {
    const result = run(
      [row({ key: 'A', amount: 20, date: '2024-01-17' })],
      [row({ key: 'A', amount: 20, date: '2024-01-24' })],
    );
    expect(result.mismatched[0].reason).toBe('date differs');
  });

  it('reports amount and date together', () => {
    const result = run(
      [row({ key: 'A', amount: 10, date: '2024-01-01' })],
      [row({ key: 'A', amount: 12, date: '2024-01-05' })],
    );
    expect(result.mismatched[0].reason).toBe('amount differs by 2.00; date differs');
  });

  it('treats a repeated key as a duplicate instead of a match', () => {
    const result = run(
      [
        row({ key: 'INV004', amount: 10, date: '2024-01-18', rowNumber: 4 }),
        row({ key: 'INV004', amount: 11, date: '2024-01-18', rowNumber: 5 }),
      ],
      [row({ key: 'INV004', amount: 10, date: '2024-01-18', rowNumber: 4 })],
    );
    expect(result.summary).toEqual({ matched: 0, mismatched: 1, onlyA: 0, onlyB: 0 });
    expect(result.mismatched[0]).toMatchObject({
      reason: 'duplicate key',
      rowA: '4, 5',
      rowB: '4',
    });
    expect(result.onlyA.map((line) => line.key)).not.toContain('INV004');
    expect(result.onlyB.map((line) => line.key)).not.toContain('INV004');
  });

  it('lists rows that are only on one side', () => {
    const result = run(
      [row({ key: 'ONLYA', amount: 5, date: '2024-01-19', rowNumber: 6 })],
      [row({ key: 'ONLYB', amount: 8, date: '2024-01-20', rowNumber: 6 })],
    );
    expect(result.summary).toEqual({ matched: 0, mismatched: 0, onlyA: 1, onlyB: 1 });
    expect(result.onlyA[0].key).toBe('ONLYA');
    expect(result.onlyB[0].key).toBe('ONLYB');
  });

  it('does not match blank keys to each other', () => {
    const result = run(
      [row({ key: '   ', amount: 1, date: '2024-01-01' })],
      [row({ key: '', amount: 1, date: '2024-01-01' })],
    );
    expect(result.summary).toEqual({ matched: 0, mismatched: 0, onlyA: 1, onlyB: 1 });
  });

  it('honours amount and date tolerances', () => {
    const within = run(
      [row({ key: 'A', amount: 10, date: '2024-01-01' })],
      [row({ key: 'A', amount: 10.05, date: '2024-01-03' })],
      { amountTolerance: 0.05, dateToleranceDays: 2 },
    );
    expect(within.summary.matched).toBe(1);

    const outside = run(
      [row({ key: 'A', amount: 10, date: '2024-01-01' })],
      [row({ key: 'A', amount: 10.06, date: '2024-01-04' })],
      { amountTolerance: 0.05, dateToleranceDays: 2 },
    );
    expect(outside.mismatched[0].reason).toBe('amount differs by 0.06; date differs');
  });

  it('skips dates when they are not being compared', () => {
    const result = run(
      [row({ key: 'A', amount: 10, date: '2024-01-01' })],
      [row({ key: 'A', amount: 10, date: '2024-06-01' })],
      { compareDates: false },
    );
    expect(result.summary.matched).toBe(1);
  });

  it('says the amount differs when one side is missing it', () => {
    const result = run(
      [row({ key: 'A', amount: 10, date: '2024-01-01' })],
      [row({ key: 'A', amount: null, date: '2024-01-01' })],
    );
    expect(result.mismatched[0].reason).toBe('amount differs');
  });

  it('keeps capital letters in the key', () => {
    const result = run(
      [row({ key: 'Ab', amount: 1, date: '2024-01-01' })],
      [row({ key: 'ab', amount: 1, date: '2024-01-01' })],
    );
    expect(result.summary).toEqual({ matched: 0, mismatched: 0, onlyA: 1, onlyB: 1 });
  });
});

describe('normaliseRows', () => {
  it('turns mixed amount and date text into the shared row shape', () => {
    const table: ParsedTable = {
      format: 'csv',
      columns: ['reference', 'date', 'amount'],
      rows: [{ reference: 'REF001', date: '15/01/2024', amount: '£1,234.56' }],
      warnings: [],
    };
    expect(normaliseRows(table, { keyColumn: 'reference', amountColumns: ['amount'], dateColumn: 'date' })).toEqual([
      {
        rowNumber: 1,
        key: 'REF001',
        amount: 1234.56,
        date: '2024-01-15',
        cells: table.rows[0],
      },
    ]);
  });
});
