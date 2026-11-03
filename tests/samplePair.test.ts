import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { daysBetween } from '../src/lib/date';
import { reconcileSamplePair } from '../src/lib/samplePair';

function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function loadSample() {
  return reconcileSamplePair();
}

describe('try with sample data', () => {
  it('loads an invoice ledger and a bank statement and maps columns the tool already knows', () => {
    const sample = loadSample();

    expect(sample.invoices.name).toBe('invoices.csv');
    expect(sample.bank.name).toBe('bank-statement.csv');
    expect(sample.invoices.table.rows.length).toBeGreaterThanOrEqual(25);
    expect(sample.invoices.table.rows.length).toBeLessThanOrEqual(40);
    expect(sample.amountTolerance).toBe(0);
    expect(sample.dateToleranceDays).toBe(3);

    expect(sample.invoices.mapping).toEqual({
      keyColumn: 'Invoice number',
      amountColumns: ['Amount'],
      dateColumn: 'Invoice date',
    });
    expect(sample.bank.mapping).toEqual({
      keyColumn: 'Reference',
      amountColumns: ['Debit', 'Credit'],
      dateColumn: 'Date',
    });

    const screen = readFileSync('src/App.tsx', 'utf8');
    expect(screen).toContain('Try with sample data');
    expect(screen).toContain('reconcileSamplePair');
    expect(screen).toContain('DEFAULT_DATE_TOLERANCE_DAYS');
    expect(screen).toContain('invoice ledger');
  });

  it('matches most rows when the amount and the date are the same', () => {
    const sample = loadSample();
    const exact = sample.result.matched.filter(
      (line) => line.amountA === line.amountB && line.dateA === line.dateB && line.reason === '',
    );

    expect(exact.length).toBe(18);
    expect(exact.length).toBeGreaterThan(
      sample.result.mismatched.length + sample.result.onlyA.length + sample.result.onlyB.length,
    );
    expect(sample.result.matched.find((line) => line.key === 'INV-2026-0141')).toMatchObject({
      amountA: 12345.67,
      amountB: 12345.67,
      dateA: '2026-09-02',
      dateB: '2026-09-02',
      reason: '',
    });
    expect(sample.result.matched.find((line) => line.key === 'INV-2026-0153')).toMatchObject({
      amountA: -10990,
      amountB: -10990,
      dateA: '2026-09-10',
      dateB: '2026-09-10',
    });
  });

  it('matches a payment that clears within the three-day tolerance', () => {
    const sample = loadSample();
    const within = [
      { key: 'INV-2026-0161', dateA: '2026-09-15', dateB: '2026-09-18', amount: 17660.2 },
      { key: 'INV-2026-0162', dateA: '2026-09-16', dateB: '2026-09-14', amount: 15480 },
      { key: 'INV-2026-0163', dateA: '2026-09-18', dateB: '2026-09-17', amount: 12875.45 },
    ];

    for (const expected of within) {
      const line = sample.result.matched.find((item) => item.key === expected.key);
      expect(line, expected.key).toMatchObject({
        amountA: expected.amount,
        amountB: expected.amount,
        dateA: expected.dateA,
        dateB: expected.dateB,
        reason: '',
      });
      const gap = Math.abs(daysBetween(expected.dateA, expected.dateB));
      expect(gap).toBeGreaterThan(0);
      expect(gap).toBeLessThanOrEqual(sample.dateToleranceDays);
    }
  });

  it('flags a payment dated further out than the three-day tolerance', () => {
    const sample = loadSample();
    const late = [
      { key: 'INV-2026-0171', dateA: '2026-09-01', dateB: '2026-09-05', amount: 21340 },
      { key: 'INV-2026-0172', dateA: '2026-09-21', dateB: '2026-09-28', amount: 16725.3 },
    ];

    for (const expected of late) {
      const line = sample.result.mismatched.find((item) => item.key === expected.key);
      expect(line, expected.key).toMatchObject({
        amountA: expected.amount,
        amountB: expected.amount,
        dateA: expected.dateA,
        dateB: expected.dateB,
        reason: 'date differs',
      });
      expect(Math.abs(daysBetween(expected.dateA, expected.dateB))).toBeGreaterThan(sample.dateToleranceDays);
    }
  });

  it('flags a partial payment by the unpaid amount', () => {
    const sample = loadSample();
    const line = sample.result.mismatched.find((item) => item.key === 'INV-2026-0181');
    expect(line).toMatchObject({
      amountA: 24800,
      amountB: 15000,
      dateA: '2026-09-22',
      dateB: '2026-09-22',
      reason: 'amount differs by 9800.00',
    });
    const bank = sample.bank.table.rows.find((row) => row.Reference === 'INV-2026-0181');
    expect(bank?.Description).toMatch(/PART PAYMENT/i);
  });

  it('flags a payment that is short because a bank fee was deducted', () => {
    const sample = loadSample();
    const line = sample.result.mismatched.find((item) => item.key === 'INV-2026-0182');
    expect(line).toMatchObject({
      amountA: 8640.25,
      amountB: 8575.25,
      dateA: '2026-09-23',
      dateB: '2026-09-23',
      reason: 'amount differs by 65.00',
    });
    const bank = sample.bank.table.rows.find((row) => row.Reference === 'INV-2026-0182');
    expect(bank?.Description).toMatch(/BANK FEE/i);
  });

  it('flags a duplicate payment instead of matching it', () => {
    const sample = loadSample();
    const line = sample.result.mismatched.find((item) => item.key === 'INV-2026-0183');
    expect(line).toMatchObject({
      reason: 'duplicate key',
      amountA: 15200,
      amountB: 15200,
    });
    expect(line?.rowA.split(', ')).toHaveLength(1);
    expect(line?.rowB.split(', ')).toHaveLength(2);
    expect(sample.result.onlyA.some((item) => item.key === 'INV-2026-0183')).toBe(false);
    expect(sample.result.onlyB.some((item) => item.key === 'INV-2026-0183')).toBe(false);
    expect(sample.invoices.table.rows.filter((row) => row['Invoice number'] === 'INV-2026-0183')).toHaveLength(1);
    expect(sample.bank.table.rows.filter((row) => row.Reference === 'INV-2026-0183')).toHaveLength(2);
  });

  it('lists an invoice with no payment on the invoice side only', () => {
    const sample = loadSample();
    expect(sample.result.onlyA.map((line) => line.key).sort()).toEqual(['INV-2026-0191', 'INV-2026-0192']);
    for (const key of ['INV-2026-0191', 'INV-2026-0192']) {
      expect(sample.bank.table.rows.some((row) => row.Reference === key)).toBe(false);
      expect(sample.result.matched.some((line) => line.key === key)).toBe(false);
      expect(sample.result.mismatched.some((line) => line.key === key)).toBe(false);
    }
  });

  it('lists a refund and a bank charge that have no invoice', () => {
    const sample = loadSample();
    expect(sample.result.onlyB.map((line) => line.key).sort()).toEqual(['FEE-2026-09', 'RF-2026-0926']);
    expect(sample.bank.table.rows.find((row) => row.Reference === 'RF-2026-0926')?.Description).toMatch(/REFUND/i);
    expect(sample.bank.table.rows.find((row) => row.Reference === 'FEE-2026-09')?.Description).toMatch(/ACCOUNT FEE/i);
    for (const key of ['FEE-2026-09', 'RF-2026-0926']) {
      expect(sample.invoices.table.rows.some((row) => row['Invoice number'] === key)).toBe(false);
    }
  });

  it('reports the sample counts for every outcome', () => {
    const sample = loadSample();
    expect(sample.result.summary).toEqual({ matched: 21, mismatched: 5, onlyA: 2, onlyB: 2 });
  });

  it('ships a 240 pixel DearTech icon and a favicon linked from the page', () => {
    expect(pngSize('public/icon-240.png')).toEqual({ width: 240, height: 240 });
    expect(readFileSync('public/favicon.svg', 'utf8')).toContain('#DD5230');
    expect(readFileSync('public/favicon.ico').length).toBeGreaterThan(100);
    const page = readFileSync('index.html', 'utf8');
    expect(page).toContain('href="/favicon.ico"');
    expect(page).toContain('href="/favicon.svg"');
    expect(page).toContain('href="/icon-240.png"');
  });
});
