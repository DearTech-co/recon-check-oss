import { describe, expect, it } from 'vitest';
import { combineAmounts, parseAmount } from '../src/lib/amount';

describe('parseAmount', () => {
  it.each([
    ['£1,234.56', 1234.56],
    ['$1,234.56', 1234.56],
    ['€1.234,56', 1234.56],
    ['1.234.567,89', 1234567.89],
    ['(1,234.56)', -1234.56],
    ['-12.50', -12.5],
    ['12,50', 12.5],
    ['1,234', 1234],
    ['1,234,567.89', 1234567.89],
    ['GBP 10.00', 10],
    ['USD1,200.00', 1200],
    ['10.00 DR', -10],
    ['10.00 CR', 10],
    ['1 234,56', 1234.56],
    ['−£12.50', -12.5],
    ['75', 75],
    ['R1 234,56', 1234.56],
    ['R -50.00', -50],
    ['ZAR 1 234,56', 1234.56],
    ['ZAR99.50', 99.5],
  ])('reads %s as %s', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it('returns null for blank or text values', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('   ')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount(null)).toBeNull();
  });
});

describe('combineAmounts', () => {
  it('subtracts a debit column and adds a credit column', () => {
    expect(combineAmounts({ Debit: '10.00', Credit: '3.00' }, ['Debit', 'Credit'])).toBe(-7);
    expect(combineAmounts({ 'Money out': '4.50', 'Money in': '' }, ['Money out', 'Money in'])).toBe(-4.5);
  });

  it('keeps the sign when only one amount column is chosen', () => {
    expect(combineAmounts({ Debit: '10.00' }, ['Debit'])).toBe(10);
  });
});
