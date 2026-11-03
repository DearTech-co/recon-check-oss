import { daysBetween } from './date';
import { normaliseKey } from './normalise';
import type { MatchLine, MatchResult, NormalizedRow, ReconcileInput } from '../types';

function cents(value: number): number {
  return Math.round(value * 100);
}

function lineFrom(
  status: MatchLine['status'],
  reason: string,
  key: string,
  rowA: NormalizedRow | null,
  rowB: NormalizedRow | null,
  rowALabel = '',
  rowBLabel = '',
): MatchLine {
  return {
    status,
    reason,
    key,
    amountA: rowA?.amount ?? null,
    amountB: rowB?.amount ?? null,
    dateA: rowA?.date ?? null,
    dateB: rowB?.date ?? null,
    rowA: rowALabel || (rowA ? String(rowA.rowNumber) : ''),
    rowB: rowBLabel || (rowB ? String(rowB.rowNumber) : ''),
  };
}

function groupRows(rows: NormalizedRow[], only: MatchLine[], side: 'A' | 'B'): Map<string, NormalizedRow[]> {
  const groups = new Map<string, NormalizedRow[]>();
  for (const row of rows) {
    const key = normaliseKey(row.key);
    if (!key) {
      only.push(
        lineFrom(side === 'A' ? 'onlyA' : 'onlyB', '', '', side === 'A' ? row : null, side === 'B' ? row : null),
      );
      continue;
    }
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}

/**
 * Match file A to file B by key.
 * A key that appears more than once on either side is a duplicate, not a match.
 */
export function reconcile(input: ReconcileInput): MatchResult {
  const matched: MatchLine[] = [];
  const mismatched: MatchLine[] = [];
  const onlyA: MatchLine[] = [];
  const onlyB: MatchLine[] = [];

  const groupsA = groupRows(input.rowsA, onlyA, 'A');
  const groupsB = groupRows(input.rowsB, onlyB, 'B');
  const seenB = new Set<string>();
  const toleranceCents = Math.round(Math.max(0, input.amountTolerance) * 100);
  const dateTolerance = Math.max(0, input.dateToleranceDays);

  for (const [key, listA] of groupsA) {
    const listB = groupsB.get(key);
    if (!listB) {
      for (const row of listA) onlyA.push(lineFrom('onlyA', '', key, row, null));
      continue;
    }
    seenB.add(key);
    const displayKey = normaliseKey(listA[0].key) || key;

    if (listA.length !== 1 || listB.length !== 1) {
      mismatched.push(
        lineFrom(
          'mismatched',
          'duplicate key',
          displayKey,
          listA[0],
          listB[0],
          listA.map((row) => row.rowNumber).join(', '),
          listB.map((row) => row.rowNumber).join(', '),
        ),
      );
      continue;
    }

    const rowA = listA[0];
    const rowB = listB[0];
    const reasons: string[] = [];

    if (rowA.amount != null || rowB.amount != null) {
      if (rowA.amount == null || rowB.amount == null) {
        reasons.push('amount differs');
      } else {
        const diff = Math.abs(cents(rowA.amount) - cents(rowB.amount));
        if (diff > toleranceCents) reasons.push(`amount differs by ${(diff / 100).toFixed(2)}`);
      }
    }

    if (input.compareDates) {
      if (rowA.date && rowB.date) {
        if (Math.abs(daysBetween(rowA.date, rowB.date)) > dateTolerance) reasons.push('date differs');
      } else if (rowA.date || rowB.date) {
        reasons.push('date differs');
      }
    }

    const reason = reasons.join('; ');
    const line = lineFrom(reason ? 'mismatched' : 'matched', reason, displayKey, rowA, rowB);
    if (reason) mismatched.push(line);
    else matched.push(line);
  }

  for (const [key, listB] of groupsB) {
    if (seenB.has(key)) continue;
    for (const row of listB) onlyB.push(lineFrom('onlyB', '', key, null, row));
  }

  return {
    summary: {
      matched: matched.length,
      mismatched: mismatched.length,
      onlyA: onlyA.length,
      onlyB: onlyB.length,
    },
    matched,
    mismatched,
    onlyA,
    onlyB,
  };
}
