/**
 * The text of a PDF, read in the browser.
 *
 * Landlords already have their lease as a PDF, and uploading it is the
 * fastest way in: the scan fills the lease from it. pdf.js is loaded only when
 * a PDF is actually picked, so it never weighs on the rest of the app.
 *
 * A scanned PDF (a photo of paper) has no text layer; that comes back empty
 * and the caller says so, rather than pretending to have read it.
 */

/** Words every Hebrew lease contains. Used to tell reading order apart. */
const MARKERS = ['שכירות', 'המשכיר', 'השוכר', 'הדירה', 'חודש', 'תקופת'];

function markerHits(text: string): number {
  return MARKERS.reduce((n, w) => n + (text.split(w).length - 1), 0);
}

/**
 * Some PDF producers store Hebrew in visual order — each line written left
 * to right, so the words come out reversed. If reversing each line finds
 * clearly more of the words every lease contains, the file was visual.
 */
function logicalOrder(text: string): string {
  const reversed = text
    .split('\n')
    .map((line) => Array.from(line).reverse().join(''))
    .join('\n');
  return markerHits(reversed) > markerHits(text) * 2 ? reversed : text;
}

export async function pdfText(file: File): Promise<string> {
  /* The legacy build: the modern one relies on JavaScript features only the
     newest browsers have, and fails outright on many landlords' phones. */
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  /* Only the text layer is read: nothing is rendered and no PDF scripting
     runs. */
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let line = '';
    const lines: string[] = [];
    for (const item of content.items) {
      if (!('str' in item)) continue;
      line += item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = '';
      }
    }
    if (line) lines.push(line);
    pages.push(lines.join('\n'));
  }
  await task.destroy();

  /* PDF text often carries NUL and other control characters, which Postgres
     refuses to store; the API strips them too. Capped at what the API takes. */
  const clean = pages.join('\n\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  return logicalOrder(clean).trim().slice(0, 400_000);
}
