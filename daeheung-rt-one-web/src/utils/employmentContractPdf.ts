import {
  DOCUMENT_PDF_MARGINS_MM,
  downloadDocumentPdf,
  ensurePdfExtension,
} from './pdf';

export async function downloadEmploymentContractPdf(
  element: HTMLElement,
  filename: string
): Promise<void> {
  await downloadDocumentPdf({
    element,
    filename: ensurePdfExtension(filename),
    margins: DOCUMENT_PDF_MARGINS_MM,
    purpose: 'download',
    itemCount: 0,
    onClone: (clonedDoc) => {
      clonedDoc.querySelectorAll('button, .MuiButton-root, .MuiIconButton-root').forEach((n) => {
        n.remove();
      });
      const style = clonedDoc.createElement('style');
      style.textContent = `
        body, body * {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
        }
      `;
      clonedDoc.head.appendChild(style);
    },
  });
}
