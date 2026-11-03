import { useState } from 'react';
import { normaliseRows } from '../lib/normalise';
import { parseFile } from '../parsers/parseFile';
import type { ColumnMapping, FileFormat, ParsedTable } from '../types';

export type LoadedFile = {
  name: string;
  table: ParsedTable;
};

const FORMAT_LABEL: Record<FileFormat, string> = {
  csv: 'CSV',
  xlsx: 'Excel',
  ofx: 'OFX / QFX',
  qif: 'QIF',
  camt053: 'CAMT.053',
  mt940: 'MT940',
  pdf: 'PDF',
};

type Props = {
  title: string;
  hint: string;
  loaded: LoadedFile | null;
  mapping: ColumnMapping;
  onLoaded: (file: LoadedFile | null) => void;
  onMapping: (mapping: ColumnMapping) => void;
};

function money(value: number | null): string {
  return value == null ? 'not readable' : value.toFixed(2);
}

export function FilePanel({ title, hint, loaded, mapping, onLoaded, onMapping }: Props) {
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [problem, setProblem] = useState('');

  async function read(file: File | undefined) {
    if (!file) return;
    setReading(true);
    setProblem('');
    try {
      const bytes = await file.arrayBuffer();
      const table = await parseFile(file.name, bytes);
      onLoaded({ name: file.name, table });
    } catch {
      onLoaded(null);
      setProblem('We could not read that file. Try CSV, Excel, OFX, QFX, QIF, CAMT.053, MT940, or a text PDF.');
    } finally {
      setReading(false);
    }
  }

  const table = loaded?.table;
  const columns = table?.columns ?? [];
  const preview = table && !table.error ? normaliseRows(table, mapping).slice(0, 5) : [];

  return (
    <section className="card" aria-label={title}>
      <div className="card-head">
        <h2>{title}</h2>
        <p>{hint}</p>
      </div>

      <label
        className={dragging ? 'drop hot' : 'drop'}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void read(event.dataTransfer.files?.[0]);
        }}
      >
        <span>{reading ? 'Reading the file…' : 'Drop a file here, or choose one'}</span>
        <input
          type="file"
          accept=".csv,.tsv,.txt,.xlsx,.xls,.ofx,.qfx,.qif,.xml,.sta,.mt940,.940,.pdf"
          onChange={(event) => {
            void read(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </label>

      {problem ? <p className="alert" role="alert">{problem}</p> : null}
      {table?.error ? <p className="alert" role="alert">{table.error}</p> : null}
      {table && !table.error ? (
        <p className="meta">
          {loaded?.name} · {FORMAT_LABEL[table.format]} · {table.rows.length} rows
        </p>
      ) : null}
      {table?.warnings.map((warning) => (
        <p className="note" key={warning}>{warning}</p>
      ))}

      {table && !table.error && columns.length > 0 ? (
        <div className="mapping">
          <label>
            Column that should match
            <select
              value={mapping.keyColumn}
              onChange={(event) => onMapping({ ...mapping, keyColumn: event.target.value })}
            >
              <option value="">Choose a column</option>
              {columns.map((column) => (
                <option key={column} value={column}>{column}</option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend>Amount columns</legend>
            <div className="checks">
              {columns.map((column) => (
                <label key={column}>
                  <input
                    type="checkbox"
                    checked={mapping.amountColumns.includes(column)}
                    onChange={(event) => {
                      const amountColumns = event.target.checked
                        ? [...mapping.amountColumns, column]
                        : mapping.amountColumns.filter((item) => item !== column);
                      onMapping({ ...mapping, amountColumns });
                    }}
                  />
                  {column}
                </label>
              ))}
            </div>
            <p className="note">
              Tick both a money-out and a money-in column if they are separate. Money out is taken off, money in is added.
            </p>
          </fieldset>

          <label>
            Date column
            <select
              value={mapping.dateColumn}
              onChange={(event) => onMapping({ ...mapping, dateColumn: event.target.value })}
            >
              <option value="">Don't compare dates</option>
              {columns.map((column) => (
                <option key={column} value={column}>{column}</option>
              ))}
            </select>
          </label>

          <div className="preview-wrap">
            <h3>Preview</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {columns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.slice(0, 5).map((row, index) => (
                    <tr key={index}>
                      {columns.map((column) => (
                        <td key={column}>{row[column]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="readout">
              {preview.map((row) => (
                <li key={row.rowNumber}>
                  Row {row.rowNumber}: key {row.key || 'blank'}, amount {money(row.amount)}
                  {mapping.dateColumn ? `, date ${row.date ?? 'not readable'}` : ''}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}
