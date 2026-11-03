import bankCsv from '../../samples/bank-statement.csv?raw';
import invoicesCsv from '../../samples/invoices.csv?raw';
import { DEFAULT_AMOUNT_TOLERANCE, DEFAULT_DATE_TOLERANCE_DAYS } from './defaults';
import { reconcile } from './match';
import { normaliseRows } from './normalise';
import { suggestMapping } from './suggest';
import { parseCsv } from '../parsers/csv';
import type { ColumnMapping, MatchResult, ParsedTable } from '../types';

export type SampleSide = {
  name: string;
  table: ParsedTable;
  mapping: ColumnMapping;
};

export type SamplePair = {
  invoices: SampleSide;
  bank: SampleSide;
  amountTolerance: number;
  dateToleranceDays: number;
  result: MatchResult;
};

function side(name: string, csv: string): SampleSide {
  const table = parseCsv(csv.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n'));
  return { name, table, mapping: suggestMapping(table.columns) };
}

/**
 * The invoice ledger is file A (`samples/invoices.csv`).
 * The bank statement is file B (`samples/bank-statement.csv`).
 * Bank references are the invoice numbers.
 */
export function reconcileSamplePair(): SamplePair {
  const invoices = side('invoices.csv', invoicesCsv);
  const bank = side('bank-statement.csv', bankCsv);
  const compareDates = Boolean(invoices.mapping.dateColumn) && Boolean(bank.mapping.dateColumn);
  const amountTolerance = DEFAULT_AMOUNT_TOLERANCE;
  const dateToleranceDays = DEFAULT_DATE_TOLERANCE_DAYS;

  return {
    invoices,
    bank,
    amountTolerance,
    dateToleranceDays,
    result: reconcile({
      rowsA: normaliseRows(invoices.table, invoices.mapping),
      rowsB: normaliseRows(bank.table, bank.mapping),
      amountTolerance,
      dateToleranceDays,
      compareDates,
    }),
  };
}
