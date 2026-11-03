import { tableFromTextItems, type TextItem } from './pdfTable';
import type { ParsedTable } from '../types';

const IMAGE_ONLY_MESSAGE =
  'This PDF has no text we can read. It looks image-only, and image-only PDFs are not supported yet.';

type PdfTextItem = { str?: string; transform?: number[]; width?: number };

type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<{
    getTextContent: () => Promise<{ items: PdfTextItem[] }>;
  }>;
  cleanup?: () => Promise<void>;
  loadingTask?: { destroy?: () => Promise<void> };
};

type PdfjsModule = {
  getDocument: (src: {
    data: Uint8Array;
    disableWorker?: boolean;
    disableAutoFetch?: boolean;
    disableStream?: boolean;
    isEvalSupported?: boolean;
    standardFontDataUrl?: string;
  }) => { promise: Promise<PdfDocument> };
};

type PromiseWithResolvers = {
  withResolvers?: <T>() => {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
  };
};

/**
 * pdf.js 6 calls Promise.withResolvers with no fallback.
 * Node 20 and Safari 17.0–17.3 do not have it. Chrome 119+, Safari 17.4+,
 * and current Safari do. The legacy pdf.js bundle already polyfills the
 * other built-ins it needs (URL.parse, Set methods, Uint8Array base64/hex).
 */
function installPromiseWithResolvers(): void {
  const promiseCtor = Promise as unknown as PromiseWithResolvers;
  if (typeof promiseCtor.withResolvers === 'function') return;
  promiseCtor.withResolvers = function withResolvers<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

function installDomMatrixPolyfill(): void {
  if (typeof globalThis.DOMMatrix !== 'undefined') return;
  class DOMMatrixPolyfill {
    a = 1;
    b = 0;
    c = 0;
    d = 1;
    e = 0;
    f = 0;
    constructor(init?: number[]) {
      if (!init) return;
      this.a = init[0] ?? 1;
      this.b = init[1] ?? 0;
      this.c = init[2] ?? 0;
      this.d = init[3] ?? 1;
      this.e = init[4] ?? 0;
      this.f = init[5] ?? 0;
    }
  }
  (globalThis as { DOMMatrix?: unknown }).DOMMatrix = DOMMatrixPolyfill;
}

async function loadPdfjs(): Promise<PdfjsModule> {
  installPromiseWithResolvers();
  installDomMatrixPolyfill();
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as PdfjsModule;
  // Importing the worker publishes WorkerMessageHandler on globalThis, so PDF.js
  // can read the file on this page instead of fetching a worker script.
  await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  return pdfjs;
}

function standardFontDataUrl(): string | undefined {
  if (typeof process === 'undefined' || !process.versions?.node) return undefined;
  const here = import.meta.url;
  const marker = '/src/parsers/';
  const index = here.indexOf(marker);
  if (index < 0) return undefined;
  const root = decodeURIComponent(new URL(here.slice(0, index)).pathname);
  return `${root}/node_modules/pdfjs-dist/standard_fonts/`;
}

async function extractTextItems(data: ArrayBuffer): Promise<TextItem[]> {
  const pdfjs = await loadPdfjs();
  const document = await pdfjs.getDocument({
    data: new Uint8Array(data),
    disableWorker: true,
    disableAutoFetch: true,
    disableStream: true,
    isEvalSupported: false,
    standardFontDataUrl: standardFontDataUrl(),
  }).promise;

  try {
    const items: TextItem[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      for (const item of content.items) {
        if (!item.str || !item.str.trim() || !item.transform) continue;
        items.push({
          text: item.str,
          x: item.transform[4] ?? 0,
          y: (item.transform[5] ?? 0) - (pageNumber - 1) * 10000,
          width: item.width,
        });
      }
    }
    return items;
  } finally {
    try {
      await document.cleanup?.();
      await document.loadingTask?.destroy?.();
    } catch {
      // Text is already extracted. Cleanup must not hide a successful read.
    }
  }
}

export async function parsePdf(data: ArrayBuffer): Promise<ParsedTable> {
  let items: TextItem[];
  try {
    items = await extractTextItems(data);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const message =
      import.meta.env.DEV && detail
        ? `We could not read this PDF. ${detail}`
        : 'We could not read this PDF.';
    return {
      format: 'pdf',
      columns: [],
      rows: [],
      warnings: [],
      error: message,
    };
  }

  if (items.length === 0) {
    return {
      format: 'pdf',
      columns: [],
      rows: [],
      warnings: [],
      error: IMAGE_ONLY_MESSAGE,
    };
  }

  const table = tableFromTextItems(items);
  if (table.rows.length === 0 && table.columns.length === 0) {
    return {
      format: 'pdf',
      columns: [],
      rows: [],
      warnings: [],
      error: IMAGE_ONLY_MESSAGE,
    };
  }

  return { format: 'pdf', columns: table.columns, rows: table.rows, warnings: [] };
}
