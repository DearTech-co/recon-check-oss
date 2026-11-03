import { describe, expect, it } from 'vitest';
import { reconcile } from '../src/lib/match';
import type { NormalizedRow } from '../src/types';

describe('performance', () => {
  it('matches 50,000 rows against 50,000 rows in under 5 seconds', () => {
    const rowsA: NormalizedRow[] = new Array(50_000);
    const rowsB: NormalizedRow[] = new Array(50_000);
    for (let i = 0; i < 50_000; i += 1) {
      rowsA[i] = {
        rowNumber: i + 1,
        key: `K${i}`,
        amount: 100,
        date: '2024-01-15',
        cells: {},
      };
      if (i < 45_000) {
        rowsB[i] = { rowNumber: i + 1, key: `K${i}`, amount: 100, date: '2024-01-15', cells: {} };
      } else if (i < 48_000) {
        rowsB[i] = { rowNumber: i + 1, key: `K${i}`, amount: 130, date: '2024-02-01', cells: {} };
      } else {
        rowsB[i] = { rowNumber: i + 1, key: `B${i}`, amount: 80, date: '2024-03-01', cells: {} };
      }
    }

    const started = performance.now();
    const result = reconcile({
      rowsA,
      rowsB,
      amountTolerance: 0.01,
      dateToleranceDays: 0,
      compareDates: true,
    });
    const elapsed = performance.now() - started;
    console.info(`50k x 50k matched in ${elapsed.toFixed(1)} ms`);

    expect(result.summary).toEqual({
      matched: 45_000,
      mismatched: 3_000,
      onlyA: 2_000,
      onlyB: 2_000,
    });
    expect(elapsed).toBeLessThan(5_000);
  });
});
