import { useEffect, useRef, useState } from 'react';
import { FilePanel, type LoadedFile } from './components/FilePanel';
import { Results } from './components/Results';
import { DEFAULT_AMOUNT_TOLERANCE, DEFAULT_DATE_TOLERANCE_DAYS } from './lib/defaults';
import { normaliseRows } from './lib/normalise';
import { reconcileSamplePair } from './lib/samplePair';
import { suggestMapping } from './lib/suggest';
import type { ColumnMapping, MatchResult, NormalizedRow } from './types';

const EMPTY_MAPPING: ColumnMapping = { keyColumn: '', amountColumns: [], dateColumn: '' };

function slim(rows: NormalizedRow[]): NormalizedRow[] {
  return rows.map((row) => ({
    rowNumber: row.rowNumber,
    key: row.key,
    amount: row.amount,
    date: row.date,
    cells: {},
  }));
}

export function App() {
  const [fileA, setFileA] = useState<LoadedFile | null>(null);
  const [fileB, setFileB] = useState<LoadedFile | null>(null);
  const [mappingA, setMappingA] = useState<ColumnMapping>(EMPTY_MAPPING);
  const [mappingB, setMappingB] = useState<ColumnMapping>(EMPTY_MAPPING);
  const [amountTolerance, setAmountTolerance] = useState(String(DEFAULT_AMOUNT_TOLERANCE));
  const [dateTolerance, setDateTolerance] = useState(String(DEFAULT_DATE_TOLERANCE_DAYS));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [result, setResult] = useState<MatchResult | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => () => workerRef.current?.terminate(), []);

  function loadA(file: LoadedFile | null) {
    setFileA(file);
    setMappingA(file && !file.table.error ? suggestMapping(file.table.columns) : EMPTY_MAPPING);
    setResult(null);
  }

  function loadB(file: LoadedFile | null) {
    setFileB(file);
    setMappingB(file && !file.table.error ? suggestMapping(file.table.columns) : EMPTY_MAPPING);
    setResult(null);
  }

  const readyA = Boolean(fileA && !fileA.table.error && mappingA.keyColumn);
  const readyB = Boolean(fileB && !fileB.table.error && mappingB.keyColumn);
  const bothDates = Boolean(mappingA.dateColumn) && Boolean(mappingB.dateColumn);
  const oneDate = Boolean(mappingA.dateColumn) !== Boolean(mappingB.dateColumn);

  function trySample() {
    workerRef.current?.terminate();
    workerRef.current = null;
    const sample = reconcileSamplePair();
    setFileA({ name: sample.invoices.name, table: sample.invoices.table });
    setFileB({ name: sample.bank.name, table: sample.bank.table });
    setMappingA(sample.invoices.mapping);
    setMappingB(sample.bank.mapping);
    setAmountTolerance(String(DEFAULT_AMOUNT_TOLERANCE));
    setDateTolerance(String(DEFAULT_DATE_TOLERANCE_DAYS));
    setProblem('');
    setBusy(false);
    setResult(sample.result);
  }

  function compare() {
    if (!fileA || !fileB || !readyA || !readyB) return;
    const amount = Number(amountTolerance);
    const days = Number(dateTolerance);
    if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(days) || days < 0) {
      setProblem('Tolerances need to be zero or a positive number.');
      return;
    }

    setProblem('');
    setBusy(true);
    workerRef.current?.terminate();
    const worker = new Worker(new URL('./worker/match.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<MatchResult>) => {
      setResult(event.data);
      setBusy(false);
    };
    worker.onerror = () => {
      setProblem('Something went wrong while comparing. Please try again.');
      setBusy(false);
    };
    worker.postMessage({
      rowsA: slim(normaliseRows(fileA.table, mappingA)),
      rowsB: slim(normaliseRows(fileB.table, mappingB)),
      amountTolerance: amount,
      dateToleranceDays: days,
      compareDates: bothDates,
    });
  }

  return (
    <div className="page">
      <header className="site">
        <a className="wordmark" href="https://deartech.co" target="_blank" rel="noopener noreferrer">
          <span>&lt;</span>DearTech<span>/&gt;</span>
        </a>
        <div>
          <h1>Recon Check</h1>
          <p>Compare two files on this computer. Nothing is uploaded.</p>
        </div>
        <a className="cta" href="https://deartech.co" target="_blank" rel="noopener noreferrer">
          Need this across more sources? Talk to DearTech
        </a>
      </header>

      <main>
        <div className="sample-row">
          <button type="button" className="secondary" onClick={trySample} disabled={busy}>
            Try with sample data
          </button>
          <p className="note">Loads a sample invoice ledger and a bank statement, then shows the results.</p>
        </div>

        <div className="files">
          <FilePanel
            title="File A"
            hint="The first file, such as your accounts list or bank export."
            loaded={fileA}
            mapping={mappingA}
            onLoaded={loadA}
            onMapping={(mapping) => {
              setMappingA(mapping);
              setResult(null);
            }}
          />
          <FilePanel
            title="File B"
            hint="The second file, such as the other system’s export."
            loaded={fileB}
            mapping={mappingB}
            onLoaded={loadB}
            onMapping={(mapping) => {
              setMappingB(mapping);
              setResult(null);
            }}
          />
        </div>

        <section className="card tolerances" aria-label="Tolerances">
          <h2>How close is close enough?</h2>
          <div className="tolerance-grid">
            <label>
              Amount can differ by
              <span className="inline">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountTolerance}
                  onChange={(event) => {
                    setAmountTolerance(event.target.value);
                    setResult(null);
                  }}
                />
                <span>either way</span>
              </span>
            </label>
            <label>
              Date can differ by
              <span className="inline">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={dateTolerance}
                  onChange={(event) => {
                    setDateTolerance(event.target.value);
                    setResult(null);
                  }}
                />
                <span>days either way</span>
              </span>
            </label>
          </div>
          {oneDate ? (
            <p className="note">Pick a date column on both files, or leave both as “Don't compare dates”.</p>
          ) : null}
          <button type="button" className="primary" disabled={!readyA || !readyB || busy} onClick={compare}>
            {busy ? 'Comparing…' : 'Compare files'}
          </button>
          {problem ? <p className="alert" role="alert">{problem}</p> : null}
        </section>

        {result ? <Results result={result} /> : null}
      </main>
    </div>
  );
}
