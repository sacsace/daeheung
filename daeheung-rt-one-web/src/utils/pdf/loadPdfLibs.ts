type Html2CanvasModule = typeof import('html2canvas');
type JsPdfModule = typeof import('jspdf');

export type PdfLibs = {
  html2canvas: Html2CanvasModule['default'];
  jsPDF: JsPdfModule['default'];
};

let pdfLibsPromise: Promise<PdfLibs> | null = null;

/** html2canvas + jsPDF 동적 import (캐시) */
export function loadPdfLibs(): Promise<PdfLibs> {
  if (!pdfLibsPromise) {
    pdfLibsPromise = Promise.all([import('html2canvas'), import('jspdf')]).then(
      ([{ default: html2canvas }, { default: jsPDF }]) => ({ html2canvas, jsPDF })
    );
  }
  return pdfLibsPromise;
}
