export type FileFormat = 'csv' | 'xlsx' | 'ofx' | 'qif' | 'camt053' | 'mt940' | 'pdf';

export type ParsedTable = {
  format: FileFormat;
  columns: string[];
  rows: Record<string, string>[];
  warnings: string[];
  /** Set when the file cannot be read. Image-only PDFs use this. */
  error?: string;
};

export type ColumnMapping = {
  keyColumn: string;
  amountColumns: string[];
  /** Empty string means dates are not compared. */
  dateColumn: string;
};

/** One shape for every file format, after the user confirms the columns. */
export type NormalizedRow = {
  rowNumber: number;
  key: string;
  amount: number | null;
  date: string | null;
  cells: Record<string, string>;
};

export type MatchStatus = 'matched' | 'mismatched' | 'onlyA' | 'onlyB';

export type MatchLine = {
  status: MatchStatus;
  reason: string;
  key: string;
  amountA: number | null;
  amountB: number | null;
  dateA: string | null;
  dateB: string | null;
  rowA: string;
  rowB: string;
};

export type MatchSummary = {
  matched: number;
  mismatched: number;
  onlyA: number;
  onlyB: number;
};

export type MatchResult = {
  summary: MatchSummary;
  matched: MatchLine[];
  mismatched: MatchLine[];
  onlyA: MatchLine[];
  onlyB: MatchLine[];
};

export type ReconcileInput = {
  rowsA: NormalizedRow[];
  rowsB: NormalizedRow[];
  amountTolerance: number;
  dateToleranceDays: number;
  compareDates: boolean;
};
