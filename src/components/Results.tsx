import { useState } from 'react';
import { allMatchLines, matchToCsv } from '../lib/csvExport';
import type { MatchLine, MatchResult, MatchStatus } from '../types';

const TABS: { id: MatchStatus; label: string }[] = [
  { id: 'matched', label: 'Matched' },
  { id: 'mismatched', label: 'Mismatched' },
  { id: 'onlyA', label: 'Only in A' },
  { id: 'onlyB', label: 'Only in B' },
];

const PREVIEW_LIMIT = 200;

function money(value: number | null): string {
  return value == null ? '' : value.toFixed(2);
}

export function Results({ result }: { result: MatchResult }) {
  const [tab, setTab] = useState<MatchStatus>('matched');
  const lines = result[tab];
  const visible = lines.slice(0, PREVIEW_LIMIT);

  function exportCsv() {
    const csv = matchToCsv(allMatchLines(result));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'recon-check.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="card results" aria-label="Results">
      <div className="results-head">
        <h2>Results</h2>
        <button type="button" className="secondary" onClick={exportCsv}>
          Export CSV
        </button>
      </div>

      <div className="summary" aria-live="polite">
        <span><strong>{result.summary.matched}</strong> matched</span>
        <span><strong>{result.summary.mismatched}</strong> mismatched</span>
        <span><strong>{result.summary.onlyA}</strong> only in A</span>
        <span><strong>{result.summary.onlyB}</strong> only in B</span>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'tab on' : 'tab'}
            onClick={() => setTab(item.id)}
          >
            {item.label}
            <span>{result.summary[item.id]}</span>
          </button>
        ))}
      </div>

      {lines.length === 0 ? (
        <p className="note">Nothing in this group.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Key</th>
                <th>Amount A</th>
                <th>Amount B</th>
                <th>Date A</th>
                <th>Date B</th>
                <th>Row A</th>
                <th>Row B</th>
                {tab === 'mismatched' ? <th>Reason</th> : null}
              </tr>
            </thead>
            <tbody>
              {visible.map((line, index) => (
                <ResultRow key={`${line.key}-${line.rowA}-${line.rowB}-${index}`} line={line} showReason={tab === 'mismatched'} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {lines.length > PREVIEW_LIMIT ? (
        <p className="note">
          Showing the first {PREVIEW_LIMIT} of {lines.length} rows. Export CSV includes every row.
        </p>
      ) : null}
    </section>
  );
}

function ResultRow({ line, showReason }: { line: MatchLine; showReason: boolean }) {
  return (
    <tr>
      <td>{line.key}</td>
      <td>{money(line.amountA)}</td>
      <td>{money(line.amountB)}</td>
      <td>{line.dateA ?? ''}</td>
      <td>{line.dateB ?? ''}</td>
      <td>{line.rowA}</td>
      <td>{line.rowB}</td>
      {showReason ? <td>{line.reason}</td> : null}
    </tr>
  );
}
