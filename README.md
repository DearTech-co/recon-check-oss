# Recon Check

Recon Check compares two files in your browser. You choose the column that should match, the amount, and an optional date. It then shows what matched, what did not, and what appears in only one file.

Your files stay on this computer. Nothing is uploaded.

## Use it

```bash
npm install
npm run dev
```

Open the address Vite prints. Drop a file on each side. Check the preview, fix the columns if they look wrong, then choose **Compare files**. **Export CSV** downloads the full result.

Supported files: CSV, Excel (xlsx), OFX, QFX, QIF, CAMT.053 XML, MT940, and text-based PDF bank statements. A PDF that is only a picture shows “not supported yet”. Recon Check does not try to read pictures.

## Check the project

```bash
npm test
npm run perf
npm run build
```

`npm run perf` checks that 50,000 rows against 50,000 rows finishes in under 5 seconds. **Try with sample data** loads `samples/invoices.csv` and `samples/bank-statement.csv`: a fictional invoice ledger and the bank statement to compare with it. The other files in `samples/` are synthetic too.
