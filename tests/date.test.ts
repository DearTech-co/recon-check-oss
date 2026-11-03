import { describe, expect, it } from 'vitest';
import { daysBetween, parseDate } from '../src/lib/date';

describe('parseDate', () => {
  it.each([
    ['2024-01-15', '2024-01-15'],
    ['2024-01-15T12:00:00', '2024-01-15'],
    ['2024/01/15', '2024-01-15'],
    ['20240115', '2024-01-15'],
    ['20240115120000', '2024-01-15'],
    ['20240201120000.000[-5:EST]', '2024-02-01'],
    ['240115', '2024-01-15'],
    ['15/01/2024', '2024-01-15'],
    ['15-01-2024', '2024-01-15'],
    ['15.01.2024', '2024-01-15'],
    ['01/02/2024', '2024-02-01'],
    ['02/13/2024', '2024-02-13'],
    ['15 Jan 2024', '2024-01-15'],
    ['15-Jan-2024', '2024-01-15'],
    ['Jan 15, 2024', '2024-01-15'],
    ['January 15 2024', '2024-01-15'],
  ])('reads %s as %s', (input, expected) => {
    expect(parseDate(input)).toBe(expected);
  });

  it('rejects dates that are not real', () => {
    expect(parseDate('')).toBeNull();
    expect(parseDate('32/01/2024')).toBeNull();
    expect(parseDate('2024-02-31')).toBeNull();
    expect(parseDate('Coffee')).toBeNull();
  });
});

describe('daysBetween', () => {
  it('counts whole days', () => {
    expect(daysBetween('2024-01-24', '2024-01-17')).toBe(7);
    expect(daysBetween('2024-01-17', '2024-01-24')).toBe(-7);
  });
});
