import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTENT_SECURITY_POLICY } from '../src/csp';
import { matchToCsv } from '../src/lib/csvExport';
import type { MatchLine } from '../src/types';

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return filesUnder(path);
    return [path];
  });
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('privacy', () => {
  it('does not send file contents over the network', () => {
    const sources = filesUnder('src').filter((path) => /\.(ts|tsx|css)$/.test(path));
    expect(sources.length).toBeGreaterThan(5);
    for (const path of sources) {
      const code = stripComments(readFileSync(path, 'utf8'));
      expect(code, path).not.toMatch(/\bfetch\s*\(/);
      expect(code, path).not.toMatch(/XMLHttpRequest/);
      expect(code, path).not.toMatch(/sendBeacon/);
      expect(code, path).not.toMatch(/new WebSocket/);
      expect(code, path).not.toMatch(/google-analytics|googletagmanager|posthog|mixpanel|segment\.com|sentry\.io/i);
    }

    expect(CONTENT_SECURITY_POLICY).toContain("connect-src 'none'");
    expect(readFileSync('vite.config.ts', 'utf8')).toContain('CONTENT_SECURITY_POLICY');
    expect(readFileSync('src/App.tsx', 'utf8')).toContain('new Worker');
    expect(readFileSync('src/worker/match.worker.ts', 'utf8')).toContain('reconcile');
    expect(readFileSync('src/parsers/pdf.ts', 'utf8')).not.toMatch(/ocr|tesseract/i);
    expect(readFileSync('package.json', 'utf8')).not.toMatch(/tesseract|analytics|sentry/i);
  });

  it('exports every result, quoting commas', () => {
    const line: MatchLine = {
      status: 'mismatched',
      reason: 'duplicate key',
      key: 'INV004',
      amountA: 10,
      amountB: 10,
      dateA: '2024-01-18',
      dateB: '2024-01-18',
      rowA: '4, 5',
      rowB: '4',
    };
    const csv = matchToCsv([line]);
    expect(csv).toContain('Mismatched');
    expect(csv).toContain('"4, 5"');
    expect(csv.split('\n')[0]).toBe('status,reason,key,amount A,amount B,date A,date B,row A,row B');
  });

  it('prefixes values that a spreadsheet would treat as a formula', () => {
    const line: MatchLine = {
      status: 'onlyA',
      reason: '=1+1',
      key: '+cmd',
      amountA: -50,
      amountB: null,
      dateA: null,
      dateB: null,
      rowA: '@row',
      rowB: '\rSTART',
    };
    const csv = matchToCsv([line]);
    expect(csv).toContain("'=1+1");
    expect(csv).toContain("'+cmd");
    expect(csv).toContain("'-50.00");
    expect(csv).toContain("'@row");
    expect(csv).toContain("'\rSTART");
    const tabLine: MatchLine = { ...line, reason: '', key: '\t1', amountA: 1, rowA: '1', rowB: '' };
    expect(matchToCsv([tabLine])).toContain("'\t1");
  });
});
