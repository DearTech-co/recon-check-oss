import type { ParsedTable } from '../types';

function tag(block: string, name: string): string {
  const match = block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, 'i'));
  return match ? decodeXml(match[1].trim()) : '';
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

const COLUMNS = ['date', 'amount', 'type', 'fitId', 'name', 'memo', 'checkNum'];

export function parseOfx(text: string): ParsedTable {
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  const rows = blocks
    .map((block) => {
      const body = block.split(/<\/STMTTRN>/i)[0];
      return {
        date: tag(body, 'DTPOSTED'),
        amount: tag(body, 'TRNAMT'),
        type: tag(body, 'TRNTYPE'),
        fitId: tag(body, 'FITID'),
        name: tag(body, 'NAME'),
        memo: tag(body, 'MEMO'),
        checkNum: tag(body, 'CHECKNUM'),
      };
    })
    .filter((row) => Object.values(row).some((value) => value !== ''));

  return {
    format: 'ofx',
    columns: COLUMNS,
    rows,
    warnings: rows.length === 0 ? ['No transactions were found in this OFX file.'] : [],
  };
}
