import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const samples = join(root, 'samples');

const rows = [
  ['date', 'description', 'amount', 'reference'],
  ['2024-01-15', 'Coffee', '-4.50', 'REF001'],
  ['2024-01-16', 'Client payment', '1200.00', 'REF002'],
  ['2024-02-01', 'Software', '-19.99', 'REF003'],
];

const workbook = XLSX.utils.book_new();
const sheet = XLSX.utils.aoa_to_sheet(rows);
XLSX.utils.book_append_sheet(workbook, sheet, 'Statement');
XLSX.writeFile(workbook, join(samples, 'statement.xlsx'));

function buildPdf(objects) {
  let body = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const startxref = Buffer.byteLength(body);
  let xref = `xref\n0 ${objects.length + 1}\n`;
  xref += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;
  return Buffer.from(body + xref + trailer);
}

const textStream = `BT
/F1 11 Tf
1 0 0 1 40 740 Tm (Date) Tj
1 0 0 1 150 740 Tm (Description) Tj
1 0 0 1 320 740 Tm (Amount) Tj
1 0 0 1 430 740 Tm (Reference) Tj
1 0 0 1 40 710 Tm (2024-01-15) Tj
1 0 0 1 150 710 Tm (Coffee) Tj
1 0 0 1 320 710 Tm (-4.50) Tj
1 0 0 1 430 710 Tm (REF001) Tj
1 0 0 1 40 690 Tm (2024-01-16) Tj
1 0 0 1 150 690 Tm (Client payment) Tj
1 0 0 1 320 690 Tm (1200.00) Tj
1 0 0 1 430 690 Tm (REF002) Tj
1 0 0 1 40 670 Tm (2024-02-01) Tj
1 0 0 1 150 670 Tm (Software) Tj
1 0 0 1 320 670 Tm (-19.99) Tj
1 0 0 1 430 670 Tm (REF003) Tj
ET`;

const textObjects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
  `<< /Length ${Buffer.byteLength(textStream)} >>\nstream\n${textStream}\nendstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
];

writeFileSync(join(samples, 'statement.pdf'), buildPdf(textObjects));

const imageStream = `q
0.2 0.2 0.2 rg
40 700 200 40 re
f
Q`;

const imageObjects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >>',
  `<< /Length ${Buffer.byteLength(imageStream)} >>\nstream\n${imageStream}\nendstream`,
];

writeFileSync(join(samples, 'statement-image-only.pdf'), buildPdf(imageObjects));

console.log('Wrote statement.xlsx, statement.pdf, and statement-image-only.pdf');
