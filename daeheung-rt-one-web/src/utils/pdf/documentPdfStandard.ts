/** 문서 PDF 표준 — MVS 모든 PDF 다운로드에 동일 적용 */

export type DocumentPdfMarginsMm = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

/** A4 여백 (mm): 상 10 / 좌 20 / 우 10 / 하 10 */
export const DOCUMENT_PDF_MARGINS_MM: DocumentPdfMarginsMm = {
  left: 20,
  right: 10,
  top: 10,
  bottom: 10,
};

export const A4_PAGE_MM = { width: 210, height: 297 } as const;

/** 엑셀 기본 글자 크기 9 */
export const DOCUMENT_PDF_FONT_SIZE_PT = 9;
/** 엑셀 행 높이 18 (포인트) */
export const DOCUMENT_PDF_LINE_HEIGHT_PT = 18;
/** 문서 제목만 본문보다 크게 (QUOTATION 등) */
export const DOCUMENT_PDF_TITLE_FONT_SIZE_PT = 14;

export const DOCUMENT_PDF_FONT_SIZE_CSS = `${DOCUMENT_PDF_FONT_SIZE_PT}pt`;
export const DOCUMENT_PDF_LINE_HEIGHT_CSS = `${DOCUMENT_PDF_LINE_HEIGHT_PT}pt`;
export const DOCUMENT_PDF_TITLE_FONT_SIZE_CSS = `${DOCUMENT_PDF_TITLE_FONT_SIZE_PT}pt`;
export const DOCUMENT_PDF_FONT_FAMILY =
  '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", "Segoe UI", Arial, sans-serif';

/** 선·헤더 — 검정 단일선, 헤더 채움만 회색 */
export const DOCUMENT_PDF_LINE = '#000000';
export const DOCUMENT_PDF_HEADER_BG = '#F2F2F2';
export const DOCUMENT_PDF_BORDER_W = '0.45px';
export const DOCUMENT_PDF_BORDER = `${DOCUMENT_PDF_BORDER_W} solid ${DOCUMENT_PDF_LINE}`;
/** 셀·라벨 왼쪽 안쪽 여백 */
export const DOCUMENT_PDF_TEXT_PAD_LEFT = '6px';

/** 다운로드 기본 캡처 scale (견적서 download) */
export const DOCUMENT_PDF_SCALE_DOWNLOAD = 2;
/** 메일용 낮은 scale (견적서 email) */
export const DOCUMENT_PDF_SCALE_EMAIL = 1.35;

/** 이 개수 미만이면 1페이지 맞춤 축소 시도 */
export const DOCUMENT_PDF_FIT_ONE_PAGE_ITEM_THRESHOLD = 10;

/** 오프스크린 클론 루트 표시 속성 */
export const DOCUMENT_PDF_CAPTURE_ROOT_ATTR = 'data-document-pdf-root';

/**
 * 모든 PDF 본문 기본 타이포.
 * 문서별 제목 등만 더 구체적인 선택자로 덮어쓴다.
 */
export const DOCUMENT_PDF_BASE_TYPOGRAPHY_CSS = `
  color: #000000 !important;
  -webkit-text-fill-color: #000000 !important;
  font-family: ${DOCUMENT_PDF_FONT_FAMILY} !important;
  font-size: ${DOCUMENT_PDF_FONT_SIZE_CSS} !important;
  line-height: ${DOCUMENT_PDF_LINE_HEIGHT_CSS} !important;
  box-sizing: border-box !important;
`;

export const DOCUMENT_PDF_STANDARD_CSS = `
  [${DOCUMENT_PDF_CAPTURE_ROOT_ATTR}],
  [${DOCUMENT_PDF_CAPTURE_ROOT_ATTR}] * {
    ${DOCUMENT_PDF_BASE_TYPOGRAPHY_CSS}
  }
`;

export function injectDocumentPdfStandardCss(doc: Document): void {
  if (doc.head.querySelector('[data-document-pdf-standard]')) return;
  const style = doc.createElement('style');
  style.setAttribute('data-document-pdf-standard', 'true');
  style.textContent = DOCUMENT_PDF_STANDARD_CSS;
  doc.head.appendChild(style);
}

export function getPrintableSizeMm(margins: DocumentPdfMarginsMm = DOCUMENT_PDF_MARGINS_MM) {
  return {
    widthMm: A4_PAGE_MM.width - margins.left - margins.right,
    heightMm: A4_PAGE_MM.height - margins.top - margins.bottom,
  };
}
