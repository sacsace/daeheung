/** 문서 PDF 표준 — 프론트 DOCUMENT_PDF_* 와 동일 (엑셀 9 / 행 18, 여백 상10·좌20·우10·하10) */

const MM_TO_PT = 72 / 25.4;

export const DOCUMENT_PDF_FONT_SIZE_PT = 9;
export const DOCUMENT_PDF_LINE_HEIGHT_PT = 18;
export const DOCUMENT_PDF_TITLE_FONT_SIZE_PT = 14;
/** PDFKit lineGap = 줄간격 − 글자크기 */
export const DOCUMENT_PDF_LINE_GAP_PT = DOCUMENT_PDF_LINE_HEIGHT_PT - DOCUMENT_PDF_FONT_SIZE_PT;

export const DOCUMENT_PDF_MARGINS_MM = {
  top: 10,
  left: 20,
  right: 10,
  bottom: 10,
} as const;

export const DOCUMENT_PDF_MARGINS_PT = {
  top: DOCUMENT_PDF_MARGINS_MM.top * MM_TO_PT,
  left: DOCUMENT_PDF_MARGINS_MM.left * MM_TO_PT,
  right: DOCUMENT_PDF_MARGINS_MM.right * MM_TO_PT,
  bottom: DOCUMENT_PDF_MARGINS_MM.bottom * MM_TO_PT,
};

export function getPdfKitContentWidth(pageWidth: number): number {
  return pageWidth - DOCUMENT_PDF_MARGINS_PT.left - DOCUMENT_PDF_MARGINS_PT.right;
}
