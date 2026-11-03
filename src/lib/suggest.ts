import { columnAmountRole } from './amount';
import type { ColumnMapping } from '../types';

function norm(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function bestColumn(columns: string[], candidates: string[]): string {
  let winner = '';
  let winnerScore = 0;
  for (const column of columns) {
    const name = norm(column);
    if (!name) continue;
    candidates.forEach((candidate, index) => {
      const priority = candidates.length - index;
      let score = 0;
      if (name === candidate) score = 3000 + priority;
      else if (candidate.length >= 4 && name.includes(candidate)) score = 1000 + priority;
      if (score > winnerScore) {
        winnerScore = score;
        winner = column;
      }
    });
  }
  return winner;
}

const KEY_CANDIDATES = [
  'endtoendid',
  'fitid',
  'reference',
  'invoicenumber',
  'invoiceno',
  'invoice',
  'transactionid',
  'bankreference',
  'checknumber',
  'chequenumber',
  'txid',
  'txnid',
  'ref',
  'number',
  'id',
  'key',
];

const AMOUNT_CANDIDATES = [
  'amount',
  'transactionamount',
  'value',
  'amt',
  'sum',
  'total',
  'net',
];

const DATE_CANDIDATES = [
  'transactiondate',
  'posteddate',
  'bookingdate',
  'valuedate',
  'bookdate',
  'paydate',
  'dtposted',
  'date',
  'posted',
  'booking',
];

export function suggestMapping(columns: string[]): ColumnMapping {
  const debits = columns.filter((column) => columnAmountRole(column) === 'debit');
  const credits = columns.filter((column) => columnAmountRole(column) === 'credit');
  const amountColumns =
    debits.length > 0 && credits.length > 0
      ? [...debits, ...credits]
      : [bestColumn(columns, AMOUNT_CANDIDATES)].filter(Boolean);

  return {
    keyColumn: bestColumn(columns, KEY_CANDIDATES),
    amountColumns,
    dateColumn: bestColumn(columns, DATE_CANDIDATES),
  };
}
