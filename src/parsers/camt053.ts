import type { ParsedTable } from '../types';

const COLUMNS = [
  'date',
  'amount',
  'currency',
  'creditDebit',
  'endToEndId',
  'transactionId',
  'reference',
  'counterparty',
  'remittance',
];

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function blocks(xml: string, name: string): string[] {
  const pattern = new RegExp(
    `<(?:[\\w.-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${name}>`,
    'gi',
  );
  return [...xml.matchAll(pattern)].map((match) => match[1]);
}

function tag(xml: string, name: string): string {
  const pattern = new RegExp(`<(?:[\\w.-]+:)?${name}(?:\\s[^>]*)?>([^<]*)`, 'i');
  const match = xml.match(pattern);
  return match ? decodeXml(match[1].trim()) : '';
}

function signedAmount(raw: string, indicator: string): string {
  if (!raw) return '';
  const number = raw.trim().replace(/^[+-]/, '');
  if (indicator.toUpperCase() === 'DBIT') return `-${number}`;
  return raw.trim().startsWith('-') ? raw.trim() : number;
}

export function parseCamt053(text: string): ParsedTable {
  const rows = blocks(text, 'Ntry').map((entry) => {
    const booking = blocks(entry, 'BookgDt')[0] ?? '';
    const date = tag(booking, 'Dt') || tag(booking, 'DtTm');
    const amountTag = entry.match(/<(?:[\w.-]+:)?Amt(\s[^>]*)?>/i);
    const currency = amountTag?.[1]?.match(/\bCcy="([^"]+)"/i)?.[1] ?? '';
    const indicator = tag(entry, 'CdtDbtInd');
    const parties = blocks(entry, 'RltdPties')[0] ?? '';
    const creditor = tag(blocks(parties, 'Cdtr')[0] ?? '', 'Nm');
    const debtor = tag(blocks(parties, 'Dbtr')[0] ?? '', 'Nm');
    const counterparty =
      indicator.toUpperCase() === 'CRDT' ? debtor || creditor : creditor || debtor;

    return {
      date,
      amount: signedAmount(tag(entry, 'Amt'), indicator),
      currency,
      creditDebit: indicator,
      endToEndId: tag(entry, 'EndToEndId'),
      transactionId: tag(entry, 'TxId'),
      reference: tag(entry, 'AcctSvcrRef'),
      counterparty,
      remittance: tag(entry, 'Ustrd'),
    };
  });

  return {
    format: 'camt053',
    columns: COLUMNS,
    rows,
    warnings: rows.length === 0 ? ['No entries were found in this CAMT.053 file.'] : [],
  };
}
