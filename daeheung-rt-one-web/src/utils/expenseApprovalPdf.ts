import {
  DOCUMENT_PDF_CAPTURE_ROOT_ATTR,
  DOCUMENT_PDF_MARGINS_MM,
  buildDocumentDownloadFilename,
  downloadDocumentPdf,
  resolveCaptureRoot,
} from './pdf';

/** @deprecated 표준 여백은 DOCUMENT_PDF_MARGINS_MM */
export const EXPENSE_PDF_MARGINS_MM = DOCUMENT_PDF_MARGINS_MM;

/** 지출결의서 PDF — 엑셀형, 본문 9보다 한 단계 작게 */
const EXPENSE_PDF_FONT_SIZE_PT = 8;
const EXPENSE_PDF_LINE_HEIGHT_PT = 16;
/** 전표번호·작성일·결재란 — 본문보다 약간 높게 (영문 라벨 줄바꿈 대응) */
const EXPENSE_PDF_HEADER_ROW_MIN_HEIGHT_PT = 18;
const EXPENSE_PDF_LINE = '#000000';
const EXPENSE_PDF_HEADER_BG = '#F2F2F2';
const EXPENSE_PDF_BORDER_W = '0.45px';
const EXPENSE_PDF_BORDER = `${EXPENSE_PDF_BORDER_W} solid ${EXPENSE_PDF_LINE}`;
const EXPENSE_PDF_BOX_HEIGHT_PT = EXPENSE_PDF_HEADER_ROW_MIN_HEIGHT_PT * 2;
const EXPENSE_PDF_TEXT_PAD_LEFT = '6px';
/** 세금/합계 박스 — 기준 280px 대비 30% 확대 */
const EXPENSE_TAX_BOX_BASE_WIDTH_PX = 280;
export const EXPENSE_TAX_BOX_WIDTH_PX = Math.round(EXPENSE_TAX_BOX_BASE_WIDTH_PX * 1.3);
export const EXPENSE_TAX_BOX_WIDTH_PERCENT = 32.5;
export const EXPENSE_TAX_RATE_COL_WIDTH_PX = 72;
export const EXPENSE_TAX_AMOUNT_COL_WIDTH_PX = 136;
export const EXPENSE_ITEMS_QTY_COL_WIDTH_PX = 64;
export const EXPENSE_ITEMS_UNIT_PRICE_COL_WIDTH_PX = 96;
const EXPENSE_PDF_TAX_BOX_MAX_WIDTH_PERCENT = 59.8;
/** 결재란 — 1행 4칸, 5명 이상이면 다음 줄 */
const EXPENSE_PDF_STAMPS_PER_ROW = 4;
const EXPENSE_PDF_STAMP_MIN_WIDTH_PX = 88;
const EXPENSE_PDF_STAMP_MAX_WIDTH_PX = 108;
/** 수정 반려 등 긴 영문 라벨 */
const EXPENSE_PDF_STAMP_RELAXED_MIN_WIDTH_PX = 138;

/**
 * 지출결의서 PDF — 화면 전표를 A4에 맞게 가로 배치.
 * html2canvas는 -webkit-box(세로 클램프)와 좁은 그리드 컬럼에서 글자를 세로로 쌓으므로
 * 캡처 전에 헤더를 세로 스택으로 풀고 클램프를 해제한다.
 */
export const EXPENSE_DOCUMENT_EXPORT_CSS = `
  .expense-pdf-root,
  .expense-pdf-root * {
    font-family: "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", "Segoe UI", Arial, sans-serif !important;
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
    font-size: ${EXPENSE_PDF_FONT_SIZE_PT}pt !important;
    font-weight: 400 !important;
    line-height: 1 !important;
    box-sizing: border-box !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    writing-mode: horizontal-tb !important;
    text-orientation: mixed !important;
    border-radius: 0 !important;
    border-top-left-radius: 0 !important;
    border-top-right-radius: 0 !important;
    border-bottom-right-radius: 0 !important;
    border-bottom-left-radius: 0 !important;
    border-top-color: ${EXPENSE_PDF_LINE} !important;
    border-right-color: ${EXPENSE_PDF_LINE} !important;
    border-bottom-color: ${EXPENSE_PDF_LINE} !important;
    border-left-color: ${EXPENSE_PDF_LINE} !important;
  }
  .expense-pdf-root {
    background: #ffffff !important;
    box-shadow: none !important;
    border: none !important;
    outline: none !important;
    border-radius: 0 !important;
    padding: 0 1px !important;
    margin: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    overflow: visible !important;
  }
  .expense-pdf-hide,
  .expense-no-print {
    display: none !important;
  }
  .expense-pdf-root .MuiButton-root,
  .expense-pdf-root .MuiIconButton-root,
  .expense-pdf-root .MuiAutocomplete-endAdornment,
  .expense-pdf-root .MuiAutocomplete-popupIndicator,
  .expense-pdf-root .MuiAutocomplete-clearIndicator,
  .expense-pdf-root button,
  .expense-pdf-root .MuiFormHelperText-root,
  .expense-pdf-root .MuiAlert-root,
  .expense-pdf-root .MuiRadio-root,
  .expense-pdf-root .MuiFormControlLabel-root,
  .expense-pdf-root .MuiRadioGroup-root,
  .expense-pdf-root .MuiSvgIcon-root {
    display: none !important;
  }

  /* 헤더: 회사·전표 + 금액 / 그 아래 결재란 가로 1줄 */
  .expense-pdf-root > .MuiBox-root {
    border-color: ${EXPENSE_PDF_LINE} !important;
    border-bottom: none !important;
  }
  .expense-pdf-root .expense-pdf-header {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) auto !important;
    align-items: start !important;
    column-gap: 12px !important;
    row-gap: 6px !important;
    width: 100% !important;
    max-width: 100% !important;
    padding: 0 0 8px 0 !important;
    margin: 0 !important;
  }
  .expense-pdf-root .expense-pdf-header-left {
    display: flex !important;
    flex-direction: column !important;
    min-width: 0 !important;
    max-width: 100% !important;
    gap: 6px !important;
    grid-column: 1 !important;
    grid-row: 1 !important;
  }
  .expense-pdf-root .expense-pdf-header-right {
    display: flex !important;
    flex-direction: column !important;
    align-items: flex-end !important;
    width: auto !important;
    min-width: 0 !important;
    gap: 2px !important;
    grid-column: 2 !important;
    grid-row: 1 !important;
  }
  .expense-pdf-root .expense-pdf-amount,
  .expense-pdf-root .expense-pdf-doc-title {
    display: block !important;
    font-size: 14pt !important;
    font-weight: 700 !important;
    text-align: right !important;
    line-height: 1.2 !important;
    margin: 0 0 4px 0 !important;
  }
  .expense-pdf-root .expense-pdf-amount-hint {
    display: none !important;
  }
  .expense-pdf-root .expense-pdf-company {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    text-align: left !important;
  }
  .expense-pdf-root .expense-pdf-company-name {
    display: block !important;
    font-size: ${EXPENSE_PDF_FONT_SIZE_PT}pt !important;
    font-weight: 700 !important;
    line-height: ${EXPENSE_PDF_LINE_HEIGHT_PT}pt !important;
    white-space: normal !important;
    word-break: keep-all !important;
    overflow-wrap: break-word !important;
    margin: 0 0 2px 0 !important;
  }
  .expense-pdf-root .expense-pdf-company-address,
  .expense-pdf-root .expense-pdf-company p,
  .expense-pdf-root .expense-pdf-company span {
    display: block !important;
    white-space: normal !important;
    word-break: normal !important;
    overflow-wrap: break-word !important;
    font-size: ${EXPENSE_PDF_FONT_SIZE_PT}pt !important;
    line-height: ${EXPENSE_PDF_LINE_HEIGHT_PT}pt !important;
  }
  .expense-pdf-root img {
    max-height: 32px !important;
    max-width: 140px !important;
    width: auto !important;
    height: auto !important;
    object-fit: contain !important;
    display: block !important;
  }

  .expense-pdf-root .expense-pdf-voucher-row {
    display: flex !important;
    flex-direction: row !important;
    justify-content: space-between !important;
    align-items: stretch !important;
    overflow: visible !important;
    width: 100% !important;
    max-width: 100% !important;
    column-gap: 16px !important;
    grid-column: 1 / -1 !important;
    grid-row: 2 !important;
    box-sizing: border-box !important;
  }
  .expense-pdf-root .expense-pdf-voucher-row-stamps-multiline {
    flex-direction: column !important;
    align-items: stretch !important;
    row-gap: 4px !important;
  }
  .expense-pdf-root .expense-pdf-voucher-row-stamps-multiline .expense-pdf-voucher-meta {
    max-width: 100% !important;
  }
  .expense-pdf-root .expense-pdf-voucher-meta {
    flex: 0 0 auto !important;
    width: fit-content !important;
    max-width: 58% !important;
    display: grid !important;
    grid-template-columns: 128px minmax(20.4ch, auto) !important;
    grid-template-rows: ${EXPENSE_PDF_HEADER_ROW_MIN_HEIGHT_PT}pt ${EXPENSE_PDF_HEADER_ROW_MIN_HEIGHT_PT}pt !important;
    height: ${EXPENSE_PDF_BOX_HEIGHT_PT}pt !important;
    min-height: ${EXPENSE_PDF_BOX_HEIGHT_PT}pt !important;
    overflow: hidden !important;
    border: ${EXPENSE_PDF_BORDER} !important;
    border-radius: 0 !important;
  }
  .expense-pdf-root .expense-pdf-voucher-meta > * {
    height: 100% !important;
    min-height: 0 !important;
    max-height: none !important;
    padding: 0 8px !important;
    display: flex !important;
    align-items: center !important;
    box-sizing: border-box !important;
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
    border: none !important;
    border-radius: 0 !important;
    text-align: left !important;
    text-indent: 0 !important;
    margin: 0 !important;
    white-space: nowrap !important;
    word-break: keep-all !important;
    overflow-wrap: normal !important;
    line-height: 1 !important;
    overflow: hidden !important;
  }
  .expense-pdf-root .expense-pdf-voucher-meta > *:nth-child(odd) {
    width: 128px !important;
    min-width: 128px !important;
    max-width: 128px !important;
    background: ${EXPENSE_PDF_HEADER_BG} !important;
    border-right: ${EXPENSE_PDF_BORDER} !important;
    padding-left: ${EXPENSE_PDF_TEXT_PAD_LEFT} !important;
  }
  .expense-pdf-root .expense-pdf-voucher-meta > *:nth-child(-n+2) {
    border-bottom: ${EXPENSE_PDF_BORDER} !important;
  }
  .expense-pdf-root .expense-pdf-stamps {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: wrap !important;
    width: auto !important;
    max-width: 100% !important;
    height: ${EXPENSE_PDF_BOX_HEIGHT_PT}pt !important;
    min-height: ${EXPENSE_PDF_BOX_HEIGHT_PT}pt !important;
    column-gap: 0 !important;
    row-gap: 0 !important;
    margin: 0 0 0 auto !important;
    flex: 0 1 auto !important;
    overflow: visible !important;
    box-sizing: border-box !important;
    justify-content: flex-end !important;
    align-content: flex-start !important;
    align-items: stretch !important;
  }
  .expense-pdf-root .expense-pdf-stamps-multiline {
    width: 100% !important;
    max-width: 100% !important;
    height: auto !important;
    min-height: 0 !important;
    margin-left: auto !important;
    justify-content: flex-end !important;
    row-gap: 0 !important;
  }
  .expense-pdf-root .expense-pdf-stamps-row-break {
    flex-basis: 100% !important;
    width: 0 !important;
    height: 0 !important;
    overflow: hidden !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  .expense-pdf-root .expense-flow-stamp-wrap {
    display: flex !important;
    flex-direction: row !important;
    align-items: stretch !important;
    flex: 0 0 auto !important;
    width: auto !important;
    max-width: 100% !important;
    min-width: 0 !important;
    height: ${EXPENSE_PDF_BOX_HEIGHT_PT}pt !important;
    min-height: ${EXPENSE_PDF_BOX_HEIGHT_PT}pt !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
    border-radius: 0 !important;
  }
  .expense-pdf-root .expense-flow-stamp-wrap > div:not(.expense-flow-stamp) {
    display: none !important;
  }
  .expense-pdf-root .expense-flow-stamp {
    display: grid !important;
    grid-template-rows: ${EXPENSE_PDF_HEADER_ROW_MIN_HEIGHT_PT}pt ${EXPENSE_PDF_HEADER_ROW_MIN_HEIGHT_PT}pt !important;
    flex-direction: column !important;
    flex: 0 0 auto !important;
    width: auto !important;
    min-width: 0 !important;
    max-width: 100% !important;
    height: ${EXPENSE_PDF_BOX_HEIGHT_PT}pt !important;
    min-height: ${EXPENSE_PDF_BOX_HEIGHT_PT}pt !important;
    border: ${EXPENSE_PDF_BORDER} !important;
    border-left: none !important;
    border-radius: 0 !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
  }
  .expense-pdf-root .expense-flow-stamp-wrap:first-child .expense-flow-stamp,
  .expense-pdf-root .expense-pdf-stamps-row-break + .expense-flow-stamp-wrap .expense-flow-stamp {
    border-left: ${EXPENSE_PDF_BORDER} !important;
  }
  .expense-pdf-root .expense-flow-stamp > div:first-child,
  .expense-pdf-root .expense-flow-stamp > div:last-child {
    height: 100% !important;
    min-height: 0 !important;
    max-height: none !important;
    padding: 0 4px !important;
    margin: 0 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    white-space: nowrap !important;
    word-break: keep-all !important;
    overflow-wrap: normal !important;
    line-height: 1 !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
    border-radius: 0 !important;
  }
  .expense-pdf-root .expense-flow-stamp > div:first-child {
    background: ${EXPENSE_PDF_HEADER_BG} !important;
    border-bottom: ${EXPENSE_PDF_BORDER} !important;
    border-top-left-radius: 0 !important;
    border-top-right-radius: 0 !important;
  }
  .expense-pdf-root .expense-flow-stamp--relaxed-label > div:first-child {
    padding: 0 8px !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    word-break: keep-all !important;
  }
  .expense-pdf-root .expense-flow-stamp--relaxed-label {
    min-width: ${EXPENSE_PDF_STAMP_RELAXED_MIN_WIDTH_PX}px !important;
  }
  .expense-pdf-root .expense-pdf-stamps-row {
    display: contents !important;
  }

  /* 화면용 2줄 클램프(-webkit-box vertical) → html2canvas가 글자를 세로로 쌓음 */
  .expense-pdf-root .expense-clamp {
    display: block !important;
    -webkit-box-orient: unset !important;
    -webkit-line-clamp: unset !important;
    overflow: visible !important;
    text-overflow: clip !important;
    white-space: normal !important;
    word-break: normal !important;
    overflow-wrap: break-word !important;
    max-height: none !important;
    line-height: 1 !important;
    font-size: inherit !important;
    vertical-align: middle !important;
  }

  .expense-pdf-root .MuiCardContent-root {
    padding: 8px 0 0 0 !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 6px !important;
    width: 100% !important;
  }
  .expense-pdf-root .MuiCardContent-root > div {
    border: none !important;
    margin: 0 !important;
    overflow: visible !important;
  }
  .expense-pdf-root .MuiCardContent-root > .expense-pdf-title-row {
    border: none !important;
    overflow: visible !important;
  }
  .expense-pdf-root .MuiCardContent-root > .expense-pdf-section,
  .expense-pdf-root .MuiCardContent-root > .expense-pdf-plain,
  .expense-pdf-root .MuiCardContent-root > .expense-pdf-tax {
    border: none !important;
    overflow: visible !important;
  }
  .expense-pdf-root .expense-pdf-title-row,
  .expense-pdf-root .MuiTableRow-root {
    min-height: ${EXPENSE_PDF_LINE_HEIGHT_PT}pt !important;
    height: ${EXPENSE_PDF_LINE_HEIGHT_PT}pt !important;
    margin: 0 !important;
  }
  .expense-pdf-root .expense-pdf-title-row {
    display: grid !important;
    grid-template-columns: 128px 1fr !important;
    align-items: center !important;
    overflow: visible !important;
    border: none !important;
    box-sizing: border-box !important;
  }
  .expense-pdf-root .expense-pdf-title-row > * {
    padding: 0 8px !important;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
    min-height: 0 !important;
    height: 100% !important;
    display: flex !important;
    align-items: center !important;
    justify-content: flex-start !important;
    overflow: hidden !important;
    border: none !important;
    line-height: 1 !important;
    text-align: left !important;
    text-indent: 0 !important;
    margin: 0 !important;
    margin-left: 0 !important;
  }
  .expense-pdf-root .expense-pdf-title-row > *:first-child {
    width: 128px !important;
    min-width: 128px !important;
    max-width: 128px !important;
    padding-left: ${EXPENSE_PDF_TEXT_PAD_LEFT} !important;
    border: ${EXPENSE_PDF_BORDER} !important;
  }
  .expense-pdf-root .expense-pdf-title-row > *:not(:first-child) {
    border: none !important;
  }
  .expense-pdf-root .expense-pdf-title-row .MuiTypography-root,
  .expense-pdf-root .expense-pdf-title {
    font-size: ${EXPENSE_PDF_FONT_SIZE_PT}pt !important;
    line-height: 1 !important;
    margin: 0 !important;
    padding: 0 !important;
    height: auto !important;
    display: flex !important;
    align-items: center !important;
  }
  .expense-pdf-root .expense-pdf-section-title,
  .expense-pdf-root .MuiTypography-subtitle2 {
    display: block !important;
    align-items: center !important;
    padding: 0 0 0 ${EXPENSE_PDF_TEXT_PAD_LEFT} !important;
    margin: 0 0 2px 0 !important;
    margin-left: 0 !important;
    text-indent: 0 !important;
    text-align: left !important;
    font-size: ${EXPENSE_PDF_FONT_SIZE_PT}pt !important;
    line-height: ${EXPENSE_PDF_LINE_HEIGHT_PT}pt !important;
    height: auto !important;
    min-height: 0 !important;
    background: transparent !important;
    border: none !important;
  }
  .expense-pdf-root .MuiCardContent-root > .expense-pdf-tax {
    margin-top: 0 !important;
  }
  .expense-pdf-root .MuiCardContent-root .MuiTableContainer-root,
  .expense-pdf-root .expense-pdf-section .MuiTableContainer-root,
  .expense-pdf-root .expense-pdf-tax .MuiTableContainer-root {
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
    border-radius: 0 !important;
  }
  .expense-pdf-root .expense-pdf-grand-row,
  .expense-pdf-root .expense-pdf-grand-row .MuiTableCell-root {
    background: ${EXPENSE_PDF_HEADER_BG} !important;
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
    border-top: none !important;
  }
  .expense-pdf-root .MuiChip-root {
    display: none !important;
  }
  .expense-pdf-root table,
  .expense-pdf-root .MuiTable-root {
    border-collapse: collapse !important;
    border-spacing: 0 !important;
    border: none !important;
    outline: none !important;
    width: 100% !important;
    max-width: 100% !important;
    table-layout: fixed !important;
  }
  .expense-pdf-root .expense-pdf-tax {
    display: block !important;
    width: ${EXPENSE_TAX_BOX_WIDTH_PX}px !important;
    min-width: ${EXPENSE_TAX_BOX_WIDTH_PX}px !important;
    max-width: ${EXPENSE_PDF_TAX_BOX_MAX_WIDTH_PERCENT}% !important;
    margin-left: auto !important;
    margin-right: 0 !important;
  }
  .expense-pdf-root .expense-pdf-tax .MuiTableContainer-root {
    width: 100% !important;
    max-width: 100% !important;
    overflow: visible !important;
    overflow-x: hidden !important;
  }
  .expense-pdf-root .expense-pdf-tax table,
  .expense-pdf-root .expense-pdf-tax .MuiTable-root {
    width: 100% !important;
    min-width: 0 !important;
    table-layout: fixed !important;
  }
  .expense-pdf-root .expense-pdf-tax .MuiTableCell-root:nth-child(2) {
    width: ${EXPENSE_TAX_RATE_COL_WIDTH_PX}px !important;
    min-width: ${EXPENSE_TAX_RATE_COL_WIDTH_PX}px !important;
    max-width: ${EXPENSE_TAX_RATE_COL_WIDTH_PX}px !important;
    text-align: center !important;
  }
  .expense-pdf-root .expense-pdf-tax .MuiTableCell-root:nth-child(3),
  .expense-pdf-root .expense-pdf-tax .MuiTableCell-root:last-child {
    width: ${EXPENSE_TAX_AMOUNT_COL_WIDTH_PX}px !important;
    min-width: ${EXPENSE_TAX_AMOUNT_COL_WIDTH_PX}px !important;
    max-width: ${EXPENSE_TAX_AMOUNT_COL_WIDTH_PX}px !important;
    text-align: right !important;
  }
  .expense-pdf-root .expense-pdf-items .MuiTableCell-root:nth-child(3),
  .expense-pdf-root .expense-pdf-items .MuiTableCell-head:nth-child(3),
  .expense-pdf-root .expense-pdf-items .expense-pdf-items-numeric-block {
    width: ${EXPENSE_TAX_BOX_WIDTH_PX}px !important;
    min-width: ${EXPENSE_TAX_BOX_WIDTH_PX}px !important;
    max-width: ${EXPENSE_TAX_BOX_WIDTH_PX}px !important;
    padding: 0 !important;
  }
  .expense-pdf-root .expense-pdf-items .expense-pdf-items-numeric-grid {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) ${EXPENSE_ITEMS_QTY_COL_WIDTH_PX}px ${EXPENSE_ITEMS_UNIT_PRICE_COL_WIDTH_PX}px ${EXPENSE_TAX_AMOUNT_COL_WIDTH_PX}px !important;
    width: 100% !important;
    align-items: center !important;
  }
  .expense-pdf-root .expense-pdf-items .expense-pdf-items-numeric-grid > *:nth-child(2),
  .expense-pdf-root .expense-pdf-items .expense-pdf-items-numeric-grid > *:nth-child(3),
  .expense-pdf-root .expense-pdf-items .expense-pdf-items-numeric-grid > *:nth-child(4) {
    text-align: right !important;
    padding: 0 8px !important;
    white-space: nowrap !important;
  }
  .expense-pdf-root .expense-pdf-items .expense-pdf-items-numeric-grid > *:nth-child(4) {
    width: ${EXPENSE_TAX_AMOUNT_COL_WIDTH_PX}px !important;
    min-width: ${EXPENSE_TAX_AMOUNT_COL_WIDTH_PX}px !important;
    max-width: ${EXPENSE_TAX_AMOUNT_COL_WIDTH_PX}px !important;
  }
  .expense-pdf-root .expense-pdf-tax .MuiTableCell-root {
    white-space: nowrap !important;
  }
  .expense-pdf-root .MuiTableContainer-root {
    width: 100% !important;
    max-width: 100% !important;
    overflow: visible !important;
    border-radius: 0 !important;
  }
  .expense-pdf-root .MuiTableCell-root {
    border: none !important;
    border-top: none !important;
    border-left: none !important;
    border-right: ${EXPENSE_PDF_BORDER} !important;
    border-bottom: ${EXPENSE_PDF_BORDER} !important;
    border-radius: 0 !important;
    font-size: ${EXPENSE_PDF_FONT_SIZE_PT}pt !important;
    font-weight: 400 !important;
    padding: 0 8px !important;
    height: ${EXPENSE_PDF_LINE_HEIGHT_PT}pt !important;
    min-height: ${EXPENSE_PDF_LINE_HEIGHT_PT}pt !important;
    line-height: 1 !important;
    text-align: left !important;
    text-indent: 0 !important;
    margin-left: 0 !important;
    max-width: none !important;
    vertical-align: middle !important;
    white-space: normal !important;
    word-break: normal !important;
    overflow-wrap: break-word !important;
    overflow: visible !important;
  }
  .expense-pdf-root .MuiTableRow-root .MuiTableCell-root:first-child {
    border-left: ${EXPENSE_PDF_BORDER} !important;
  }
  .expense-pdf-root .MuiTableRow-root .MuiTableCell-root:last-child {
    border-right: ${EXPENSE_PDF_BORDER} !important;
  }
  .expense-pdf-root .expense-pdf-section .MuiTableContainer-root:has(> .expense-pdf-items),
  .expense-pdf-root .expense-pdf-section .MuiTableContainer-root:has(> table.expense-pdf-items) {
    border: ${EXPENSE_PDF_BORDER} !important;
    border-radius: 0 !important;
    overflow: visible !important;
  }
  .expense-pdf-root .expense-pdf-items .MuiTableCell-root,
  .expense-pdf-root .expense-pdf-items .MuiTableRow-root .MuiTableCell-root:first-child,
  .expense-pdf-root .expense-pdf-items .MuiTableRow-root .MuiTableCell-root:last-child {
    border-left: none !important;
    border-right: none !important;
  }
  .expense-pdf-root .MuiTable-root .MuiTableRow-root:first-child .MuiTableCell-root {
    border-top: ${EXPENSE_PDF_BORDER} !important;
  }
  .expense-pdf-root .MuiTable-root .MuiTableRow-root:last-child .MuiTableCell-root {
    border-bottom: ${EXPENSE_PDF_BORDER} !important;
  }
  .expense-pdf-root .expense-pdf-items .MuiTableRow-root:first-child .MuiTableCell-root {
    border-top: none !important;
  }
  .expense-pdf-root .expense-pdf-items .MuiTableRow-root:last-child .MuiTableCell-root {
    border-bottom: none !important;
  }
  .expense-pdf-root .MuiTableHead-root .MuiTableCell-root {
    font-size: ${EXPENSE_PDF_FONT_SIZE_PT}pt !important;
    font-weight: 700 !important;
    background: ${EXPENSE_PDF_HEADER_BG} !important;
    padding: 0 8px !important;
    height: ${EXPENSE_PDF_LINE_HEIGHT_PT}pt !important;
    line-height: 1 !important;
    vertical-align: middle !important;
  }
  .expense-pdf-root .MuiTableRow-root > .MuiTableCell-root:first-child,
  .expense-pdf-root .expense-pdf-kv-label {
    padding-left: ${EXPENSE_PDF_TEXT_PAD_LEFT} !important;
    margin-left: 0 !important;
    text-indent: 0 !important;
    text-align: left !important;
  }
  .expense-pdf-root .expense-pdf-items .MuiTableCell-root:first-child,
  .expense-pdf-root .expense-pdf-kv-label {
    width: 128px !important;
    min-width: 128px !important;
    max-width: 128px !important;
  }
  .expense-pdf-root .MuiTableRow-root {
    height: ${EXPENSE_PDF_LINE_HEIGHT_PT}pt !important;
  }
  .expense-pdf-root .expense-pdf-vcenter {
    display: flex !important;
    align-items: center !important;
    justify-content: flex-start !important;
    width: 100% !important;
    height: 100% !important;
    min-height: ${EXPENSE_PDF_LINE_HEIGHT_PT}pt !important;
    line-height: 1 !important;
    margin: 0 !important;
    padding: 0 !important;
    box-sizing: border-box !important;
  }
  .expense-pdf-root .MuiTableCell-alignRight .expense-pdf-vcenter {
    justify-content: flex-end !important;
  }
  .expense-pdf-root .expense-flow-stamp .expense-pdf-vcenter {
    justify-content: center !important;
  }
  .expense-pdf-root .expense-pdf-title-row > *:first-child,
  .expense-pdf-root .expense-pdf-kv-label {
    background: ${EXPENSE_PDF_HEADER_BG} !important;
  }
  .expense-pdf-root .expense-flow-stamp > div:first-child {
    background: ${EXPENSE_PDF_HEADER_BG} !important;
  }
  .expense-pdf-root [class*="MuiTypography"],
  .expense-pdf-root .MuiTypography-root {
    font-weight: 400 !important;
    line-height: 1 !important;
    margin: 0 !important;
  }
  .expense-pdf-root .MuiTypography-subtitle2,
  .expense-pdf-root .expense-pdf-section-title,
  .expense-pdf-root .expense-pdf-company-name,
  .expense-pdf-root .expense-pdf-title,
  .expense-pdf-root .expense-pdf-amount,
  .expense-pdf-root .expense-pdf-grand {
    font-weight: 700 !important;
  }
  .expense-pdf-root .MuiTypography-subtitle2 {
    font-size: ${EXPENSE_PDF_FONT_SIZE_PT}pt !important;
    margin: 0 0 2px 0 !important;
    height: auto !important;
    line-height: ${EXPENSE_PDF_LINE_HEIGHT_PT}pt !important;
    background: transparent !important;
    border: none !important;
  }
  .expense-pdf-root .MuiTypography-caption {
    font-size: ${EXPENSE_PDF_FONT_SIZE_PT}pt !important;
  }
  .expense-pdf-root .MuiOutlinedInput-notchedOutline {
    border: none !important;
  }
  .expense-pdf-root .MuiInputBase-root,
  .expense-pdf-root .MuiInputBase-input {
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
    font-size: ${EXPENSE_PDF_FONT_SIZE_PT}pt !important;
    padding: 0 !important;
    margin: 0 !important;
    min-height: 0 !important;
    height: auto !important;
  }
  .expense-pdf-attachments {
    margin: 0 !important;
    padding: 0 0 0 16px !important;
    list-style: disc !important;
  }
  .expense-pdf-attachments li {
    font-size: ${EXPENSE_PDF_FONT_SIZE_PT}pt !important;
    line-height: ${EXPENSE_PDF_LINE_HEIGHT_PT}pt !important;
    margin: 0 !important;
    padding: 0 !important;
  }
`;

function wrapForExactVerticalCenter(el: HTMLElement, doc: Document): void {
  if (el.getAttribute('data-pdf-vcenter') === '1') return;
  const wrap = doc.createElement('span');
  wrap.className = 'expense-pdf-vcenter';
  wrap.setAttribute('data-pdf-vcenter', '1');
  while (el.firstChild) wrap.appendChild(el.firstChild);
  el.appendChild(wrap);
  el.setAttribute('data-pdf-vcenter', '1');
}

function injectExportCss(doc: Document, cssText: string): void {
  const style = doc.createElement('style');
  style.textContent = cssText;
  doc.head.appendChild(style);
}

function measureStampWidthPx(stamp: HTMLElement): number {
  const labelCell = stamp.querySelector(':scope > div:first-child') as HTMLElement | null;
  const relaxed = stamp.classList.contains('expense-flow-stamp--relaxed-label');
  const minWidth = relaxed ? EXPENSE_PDF_STAMP_RELAXED_MIN_WIDTH_PX : EXPENSE_PDF_STAMP_MIN_WIDTH_PX;
  if (!labelCell) return minWidth;

  labelCell.style.setProperty('white-space', relaxed ? 'nowrap' : 'normal', 'important');
  labelCell.style.setProperty('width', 'auto', 'important');
  labelCell.style.setProperty('overflow', 'visible', 'important');
  const measured = Math.ceil(labelCell.scrollWidth) + 12;
  if (relaxed) {
    return Math.max(EXPENSE_PDF_STAMP_RELAXED_MIN_WIDTH_PX, measured);
  }
  return Math.max(EXPENSE_PDF_STAMP_MIN_WIDTH_PX, Math.min(EXPENSE_PDF_STAMP_MAX_WIDTH_PX, measured));
}

function flattenStampRowsForPdf(stamps: HTMLElement): void {
  const rowEls = Array.from(stamps.querySelectorAll(':scope > .expense-pdf-stamps-row'));
  if (rowEls.length === 0) return;
  rowEls.forEach((row) => {
    while (row.firstChild) {
      stamps.insertBefore(row.firstChild, row);
    }
    row.remove();
  });
}

function resolveStampWidthsForPdf(wraps: HTMLElement[], availableWidth: number): number[] {
  const widths = wraps.map((wrap) => {
    const stamp = wrap.querySelector('.expense-flow-stamp') as HTMLElement | null;
    return stamp ? measureStampWidthPx(stamp) : EXPENSE_PDF_STAMP_MIN_WIDTH_PX;
  });
  const total = widths.reduce((sum, width) => sum + width, 0);
  if (total <= availableWidth) return widths;

  const relaxedIndexes = widths
    .map((_, index) => (wraps[index].querySelector('.expense-flow-stamp--relaxed-label') ? index : -1))
    .filter((index) => index >= 0);
  const relaxedTotal = relaxedIndexes.reduce((sum, index) => sum + widths[index], 0);
  const normalIndexes = widths
    .map((_, index) => (!wraps[index].querySelector('.expense-flow-stamp--relaxed-label') ? index : -1))
    .filter((index) => index >= 0);

  if (normalIndexes.length === 0) return widths;

  const normalWidth = Math.max(
    EXPENSE_PDF_STAMP_MIN_WIDTH_PX,
    Math.floor((availableWidth - relaxedTotal) / normalIndexes.length)
  );
  normalIndexes.forEach((index) => {
    widths[index] = normalWidth;
  });
  return widths;
}

function applyHeaderRowHeightPt(el: HTMLElement, heightPt: number): void {
  el.style.setProperty('height', `${heightPt}pt`, 'important');
  el.style.setProperty('min-height', `${heightPt}pt`, 'important');
  el.style.setProperty('max-height', `${heightPt}pt`, 'important');
  el.style.setProperty('overflow', 'hidden', 'important');
  el.style.setProperty('border-radius', '0', 'important');
}

function applyVoucherMetaBordersForPdf(meta: HTMLElement): void {
  meta.style.setProperty('border', EXPENSE_PDF_BORDER, 'important');
  meta.style.setProperty('border-radius', '0', 'important');
  meta.style.setProperty('box-sizing', 'border-box', 'important');
  meta.style.setProperty('overflow', 'hidden', 'important');

  Array.from(meta.children).forEach((child, index) => {
    const cell = child as HTMLElement;
    const isLabel = index % 2 === 0;
    const isFirstRow = index < 2;
    cell.style.setProperty('border-top', 'none', 'important');
    cell.style.setProperty('border-left', 'none', 'important');
    cell.style.setProperty('border-right', isLabel ? EXPENSE_PDF_BORDER : 'none', 'important');
    // 1행만 가로 구분선 — 2행 하단은 컨테이너 border-bottom 한 줄만 사용
    cell.style.setProperty('border-bottom', isFirstRow ? EXPENSE_PDF_BORDER : 'none', 'important');
    cell.style.setProperty('border-radius', '0', 'important');
    cell.style.setProperty('box-sizing', 'border-box', 'important');
    cell.style.setProperty('margin', '0', 'important');
    cell.style.setProperty('padding-top', '0', 'important');
    cell.style.setProperty('padding-bottom', '0', 'important');
  });
}

function adjustExpenseHeaderRowHeightsForPdf(root: HTMLElement): void {
  // 전표번호·작성일자와 작성/승인 결재란 — 동일 2행 높이로 가로선 정렬
  const unifiedRow1Pt = EXPENSE_PDF_HEADER_ROW_MIN_HEIGHT_PT;
  const unifiedRow2Pt = EXPENSE_PDF_HEADER_ROW_MIN_HEIGHT_PT;
  const stampBoxPt = EXPENSE_PDF_BOX_HEIGHT_PT;

  const meta = root.querySelector('.expense-pdf-voucher-meta') as HTMLElement | null;
  if (meta) {
    const cells = Array.from(meta.children) as HTMLElement[];
    meta.style.setProperty('grid-template-rows', `${unifiedRow1Pt}pt ${unifiedRow2Pt}pt`, 'important');
    meta.style.setProperty('height', `${stampBoxPt}pt`, 'important');
    meta.style.setProperty('min-height', `${stampBoxPt}pt`, 'important');
    meta.style.setProperty('max-height', `${stampBoxPt}pt`, 'important');
    cells.slice(0, 2).forEach((cell) => applyHeaderRowHeightPt(cell, unifiedRow1Pt));
    cells.slice(2, 4).forEach((cell) => applyHeaderRowHeightPt(cell, unifiedRow2Pt));
    applyVoucherMetaBordersForPdf(meta);
  }

  root.querySelectorAll('.expense-flow-stamp').forEach((stampEl) => {
    const stamp = stampEl as HTMLElement;
    const rows = stamp.querySelectorAll(':scope > div');
    stamp.style.setProperty('display', 'grid', 'important');
    stamp.style.setProperty(
      'grid-template-rows',
      `${unifiedRow1Pt}pt ${unifiedRow2Pt}pt`,
      'important'
    );
    applyHeaderRowHeightPt(stamp, stampBoxPt);
    stamp.style.setProperty('border-radius', '0', 'important');
    stamp.style.setProperty('overflow', 'hidden', 'important');
    if (rows.length >= 1) {
      const label = rows[0] as HTMLElement;
      applyHeaderRowHeightPt(label, unifiedRow1Pt);
      label.style.setProperty('border-bottom', EXPENSE_PDF_BORDER, 'important');
      label.style.setProperty('border-top-left-radius', '0', 'important');
      label.style.setProperty('border-top-right-radius', '0', 'important');
    }
    if (rows.length >= 2) {
      applyHeaderRowHeightPt(rows[rows.length - 1] as HTMLElement, unifiedRow2Pt);
    }
  });
  root.querySelectorAll('.expense-flow-stamp-wrap:not(.expense-pdf-hide)').forEach((wrap) => {
    applyHeaderRowHeightPt(wrap as HTMLElement, stampBoxPt);
  });

  const voucherRow = root.querySelector('.expense-pdf-voucher-row') as HTMLElement | null;
  const stamps = root.querySelector('.expense-pdf-stamps') as HTMLElement | null;
  voucherRow?.style.setProperty('align-items', 'stretch', 'important');
  stamps?.style.setProperty('align-items', 'stretch', 'important');
  if (stamps && !stamps.classList.contains('expense-pdf-stamps-multiline')) {
    stamps.style.setProperty('height', `${stampBoxPt}pt`, 'important');
    stamps.style.setProperty('min-height', `${stampBoxPt}pt`, 'important');
  }
}

function hideApprovalArrowsForPdf(wraps: HTMLElement[]): void {
  wraps.forEach((wrap) => {
    const stamp = wrap.querySelector('.expense-flow-stamp');
    Array.from(wrap.children).forEach((child) => {
      if (child === stamp) return;
      (child as HTMLElement).style.setProperty('display', 'none', 'important');
    });
  });
}

function insertStampRowBreaks(wraps: HTMLElement[]): void {
  if (wraps.length <= EXPENSE_PDF_STAMPS_PER_ROW) return;
  for (let i = EXPENSE_PDF_STAMPS_PER_ROW - 1; i < wraps.length - 1; i += EXPENSE_PDF_STAMPS_PER_ROW) {
    const anchor = wraps[i];
    if (!anchor.parentElement) continue;
    if (anchor.nextElementSibling?.classList.contains('expense-pdf-stamps-row-break')) continue;
    const breakEl = anchor.ownerDocument.createElement('div');
    breakEl.className = 'expense-pdf-stamps-row-break';
    breakEl.setAttribute('data-expense-pdf-stamps-row-break', '1');
    anchor.after(breakEl);
  }
}

function layoutApprovalStampsForPdf(root: HTMLElement): void {
  const voucherRow = root.querySelector('.expense-pdf-voucher-row') as HTMLElement | null;
  const stamps = root.querySelector('.expense-pdf-stamps') as HTMLElement | null;
  if (!stamps || !voucherRow) return;

  flattenStampRowsForPdf(stamps);

  const wraps = Array.from(
    stamps.querySelectorAll('.expense-flow-stamp-wrap:not(.expense-pdf-hide)')
  ) as HTMLElement[];
  const count = wraps.length;
  if (count === 0) return;

  const rootWidth = root.getBoundingClientRect().width || root.clientWidth || 680;
  const meta = root.querySelector('.expense-pdf-voucher-meta') as HTMLElement | null;
  const metaWidth = meta?.getBoundingClientRect().width || meta?.clientWidth || 240;
  const rowGap = 16;
  const useMultiline = count > EXPENSE_PDF_STAMPS_PER_ROW;

  stamps.style.setProperty('max-width', '100%', 'important');
  stamps.style.setProperty('overflow', 'visible', 'important');
  stamps.style.setProperty('display', 'flex', 'important');
  stamps.style.setProperty('flex-direction', 'row', 'important');
  stamps.style.setProperty('flex-wrap', 'wrap', 'important');
  stamps.style.setProperty('justify-content', 'flex-end', 'important');
  stamps.style.setProperty('align-content', 'flex-start', 'important');
  stamps.style.setProperty('align-items', 'stretch', 'important');
  stamps.style.setProperty('row-gap', '4px', 'important');
  voucherRow.style.setProperty('max-width', '100%', 'important');
  voucherRow.style.setProperty('overflow', 'visible', 'important');
  voucherRow.style.setProperty('align-items', 'stretch', 'important');

  if (useMultiline) {
    voucherRow.classList.add('expense-pdf-voucher-row-stamps-multiline');
    stamps.classList.add('expense-pdf-stamps-multiline');
  }

  const availableWidth = useMultiline
    ? rootWidth
    : Math.max(240, rootWidth - metaWidth - rowGap);
  const stampWidths = resolveStampWidthsForPdf(wraps, availableWidth);

  hideApprovalArrowsForPdf(wraps);
  insertStampRowBreaks(wraps);

  wraps.forEach((wrap, index) => {
    const stamp = wrap.querySelector('.expense-flow-stamp') as HTMLElement | null;
    const stampWidth = stampWidths[index] ?? EXPENSE_PDF_STAMP_MIN_WIDTH_PX;

    wrap.style.setProperty('display', 'flex', 'important');
    wrap.style.setProperty('flex-direction', 'row', 'important');
    wrap.style.setProperty('align-items', 'stretch', 'important');
    wrap.style.setProperty('width', `${stampWidth}px`, 'important');
    wrap.style.setProperty('min-width', `${stampWidth}px`, 'important');
    wrap.style.setProperty('max-width', `${stampWidth}px`, 'important');
    wrap.style.setProperty('flex', `0 0 ${stampWidth}px`, 'important');

    if (stamp) {
      stamp.style.setProperty('width', `${stampWidth}px`, 'important');
      stamp.style.setProperty('min-width', `${stampWidth}px`, 'important');
      stamp.style.setProperty('max-width', `${stampWidth}px`, 'important');
      stamp.style.setProperty('flex', `0 0 ${stampWidth}px`, 'important');
      stamp.style.setProperty('border', EXPENSE_PDF_BORDER, 'important');
      stamp.style.setProperty('border-left', 'none', 'important');
      stamp.style.setProperty('border-radius', '0', 'important');
      stamp.style.setProperty('overflow', 'hidden', 'important');
    }
  });

  wraps.forEach((wrap, index) => {
    const stamp = wrap.querySelector('.expense-flow-stamp') as HTMLElement | null;
    if (!stamp) return;
    const isRowStart = index % EXPENSE_PDF_STAMPS_PER_ROW === 0;
    if (isRowStart) {
      stamp.style.setProperty('border-left', EXPENSE_PDF_BORDER, 'important');
    }
  });

  const fullRowWidth = stampWidths
    .slice(0, Math.min(count, EXPENSE_PDF_STAMPS_PER_ROW))
    .reduce((sum, width) => sum + width, 0);
  stamps.style.setProperty('width', `${Math.min(availableWidth, fullRowWidth)}px`, 'important');
  stamps.style.setProperty('max-width', '100%', 'important');
  stamps.style.setProperty('margin-left', 'auto', 'important');
}

function flattenHeaderForPdf(root: HTMLElement): void {
  const apply = (el: HTMLElement | null, styles: Record<string, string>) => {
    if (!el) return;
    Object.entries(styles).forEach(([key, value]) => {
      el.style.setProperty(key, value, 'important');
    });
  };

  const header = root.querySelector('.expense-pdf-header') as HTMLElement | null;
  const stamps = root.querySelector('.expense-pdf-stamps') as HTMLElement | null;
  const voucherRow = root.querySelector('.expense-pdf-voucher-row') as HTMLElement | null;
  if (header && voucherRow && voucherRow.parentElement !== header) {
    header.appendChild(voucherRow);
  }
  if (voucherRow && stamps && stamps.parentElement !== voucherRow) {
    voucherRow.appendChild(stamps);
  }

  apply(header, {
    display: 'grid',
    'grid-template-columns': 'minmax(0, 1fr) auto',
    'align-items': 'start',
    width: '100%',
    'max-width': '100%',
    'column-gap': '12px',
  });
  apply(root.querySelector('.expense-pdf-header-left'), {
    display: 'flex',
    'flex-direction': 'column',
    'min-width': '0',
    'grid-column': '1',
    'grid-row': '1',
  });
  apply(root.querySelector('.expense-pdf-header-right'), {
    display: 'flex',
    'flex-direction': 'column',
    'align-items': 'flex-end',
    width: 'auto',
    'grid-column': '2',
    'grid-row': '1',
  });
  apply(root.querySelector('.expense-pdf-company'), {
    display: 'block',
    width: '100%',
    'max-width': '100%',
    'min-width': '0',
  });
  apply(voucherRow, {
    display: 'flex',
    'flex-direction': 'row',
    'justify-content': 'space-between',
    'align-items': 'stretch',
    width: '100%',
    'max-width': '100%',
    'grid-column': '1 / -1',
    'grid-row': '2',
    overflow: 'visible',
  });
  apply(root.querySelector('.expense-pdf-tax'), {
    display: 'block',
    width: `${EXPENSE_TAX_BOX_WIDTH_PX}px`,
    'min-width': `${EXPENSE_TAX_BOX_WIDTH_PX}px`,
    'max-width': `${EXPENSE_PDF_TAX_BOX_MAX_WIDTH_PERCENT}%`,
    'margin-left': 'auto',
    'margin-right': '0',
  });

  root.querySelectorAll<HTMLElement>(
    '.expense-pdf-title-row, .MuiTableRow-root'
  ).forEach((el) => {
    el.style.setProperty('min-height', `${EXPENSE_PDF_LINE_HEIGHT_PT}pt`, 'important');
    el.style.setProperty(
      'height',
      el.classList.contains('expense-pdf-title-row')
        ? `${EXPENSE_PDF_LINE_HEIGHT_PT}pt`
        : 'auto',
      'important'
    );
  });
  root.querySelectorAll<HTMLElement>(
    '.expense-pdf-title-row > :first-child, .expense-pdf-section-title, .MuiTypography-subtitle2, .MuiTableRow-root > .MuiTableCell-root:first-child, .expense-pdf-kv-label, .expense-pdf-voucher-meta > :nth-child(odd)'
  ).forEach((el) => {
    el.style.setProperty('padding-left', EXPENSE_PDF_TEXT_PAD_LEFT, 'important');
    el.style.setProperty('margin-left', '0', 'important');
    el.style.setProperty('text-indent', '0', 'important');
    el.style.setProperty('text-align', 'left', 'important');
    el.style.setProperty('border-left', 'none', 'important');
  });
  root.querySelectorAll<HTMLElement>(
    '.expense-pdf-section-title, .MuiTypography-subtitle2'
  ).forEach((el) => {
    el.style.setProperty('background', 'transparent', 'important');
    el.style.setProperty('border', 'none', 'important');
    el.style.setProperty('height', 'auto', 'important');
  });

  root.querySelectorAll<HTMLElement>('.expense-pdf-company-name, .expense-pdf-company-address').forEach((el) => {
    el.style.setProperty('display', 'block', 'important');
    el.style.setProperty('white-space', 'normal', 'important');
    el.style.setProperty('word-break', 'normal', 'important');
    el.style.setProperty('overflow-wrap', 'break-word', 'important');
    el.style.setProperty('writing-mode', 'horizontal-tb', 'important');
  });

  root.querySelectorAll<HTMLElement>('.expense-clamp').forEach((el) => {
    el.style.setProperty('display', 'block', 'important');
    el.style.setProperty('-webkit-box-orient', 'unset', 'important');
    el.style.setProperty('-webkit-line-clamp', 'unset', 'important');
    el.style.setProperty('overflow', 'visible', 'important');
    el.style.setProperty('max-height', 'none', 'important');
    el.style.setProperty('white-space', 'normal', 'important');
    el.style.setProperty('writing-mode', 'horizontal-tb', 'important');
  });
}

function replaceAutocompleteWithPlainText(root: HTMLElement, doc: Document): void {
  root.querySelectorAll('.MuiAutocomplete-root').forEach((el) => {
    const input = el.querySelector('input') as HTMLInputElement | null;
    const text = (input?.value || '').trim() || '-';
    const span = doc.createElement('span');
    span.textContent = text;
    span.setAttribute(
      'style',
      `display:block;width:100%;text-align:center;font-size:${EXPENSE_PDF_FONT_SIZE_PT}pt;font-weight:400;line-height:${EXPENSE_PDF_LINE_HEIGHT_PT}pt;color:#000000;white-space:normal;word-break:keep-all;`
    );
    el.replaceWith(span);
  });
}

/** 썸네일 그리드를 파일명 목록으로 바꿔 세로 공간 절약 */
function compactAttachmentGrids(root: HTMLElement, doc: Document): void {
  const thumbs = Array.from(root.querySelectorAll('.receipt-thumb'));
  if (thumbs.length === 0) return;

  const processed = new Set<HTMLElement>();

  thumbs.forEach((thumb) => {
    const item = (thumb.closest('button') as HTMLElement | null) || (thumb.parentElement as HTMLElement | null);
    const grid = item?.parentElement as HTMLElement | null;
    if (!grid || processed.has(grid) || grid.getAttribute('data-expense-pdf-attachments') === '1') {
      return;
    }

    const names: string[] = [];
    grid.querySelectorAll('.receipt-thumb').forEach((node) => {
      const row = (node.closest('button') as HTMLElement | null) || (node.parentElement as HTMLElement | null);
      const caption =
        row?.querySelector('.MuiTypography-root, span, p')?.textContent?.trim() ||
        (node as HTMLElement).getAttribute('alt') ||
        '';
      if (caption) names.push(caption);
    });
    if (names.length === 0) return;

    processed.add(grid);
    const list = doc.createElement('ul');
    list.className = 'expense-pdf-attachments';
    list.setAttribute('data-expense-pdf-attachments', '1');
    names.forEach((name) => {
      const li = doc.createElement('li');
      li.textContent = name;
      list.appendChild(li);
    });
    grid.replaceWith(list);
  });
}

export function sanitizeExpenseCloneForPdf(clonedDoc: Document): void {
  const root =
    resolveCaptureRoot(clonedDoc, {
      captureRootAttr: DOCUMENT_PDF_CAPTURE_ROOT_ATTR,
      liveRootSelector: '.expense-pdf-root',
    }) || (clonedDoc.querySelector('.expense-pdf-root') as HTMLElement | null);
  if (!root) return;

  root.querySelectorAll('.expense-pdf-hide, .expense-no-print').forEach((node) => {
    node.remove();
  });
  compactAttachmentGrids(root, clonedDoc);
  root.querySelectorAll('.MuiButton-root, .MuiIconButton-root, button').forEach((node) => {
    node.remove();
  });
  replaceAutocompleteWithPlainText(root, clonedDoc);
  flattenHeaderForPdf(root);
  injectExportCss(clonedDoc, EXPENSE_DOCUMENT_EXPORT_CSS);
  layoutApprovalStampsForPdf(root);
  // 화면용 rounded(6px)가 html2canvas에서 깨진 원형 코너로 보이므로 PDF는 전부 직각
  root.querySelectorAll<HTMLElement>('*').forEach((el) => {
    el.style.setProperty('border-radius', '0', 'important');
    el.style.setProperty('border-top-left-radius', '0', 'important');
    el.style.setProperty('border-top-right-radius', '0', 'important');
    el.style.setProperty('border-bottom-right-radius', '0', 'important');
    el.style.setProperty('border-bottom-left-radius', '0', 'important');
  });
  root.querySelectorAll<HTMLElement>(
    '.MuiTableCell-root, .expense-pdf-title-row > *, .expense-pdf-voucher-meta > *, .expense-flow-stamp > div'
  ).forEach((el) => wrapForExactVerticalCenter(el, clonedDoc));
  root.querySelectorAll<HTMLElement>(
    '.MuiTableContainer-root, table, .MuiTable-root'
  ).forEach((el) => {
    el.style.setProperty('border', 'none', 'important');
    el.style.setProperty('outline', 'none', 'important');
    el.style.setProperty('box-shadow', 'none', 'important');
    el.style.setProperty('border-radius', '0', 'important');
    el.style.setProperty('border-collapse', 'collapse', 'important');
    el.style.setProperty('border-spacing', '0', 'important');
  });
  root.querySelectorAll<HTMLElement>('.MuiTableCell-root').forEach((el) => {
    const row = el.parentElement;
    const table = el.closest('table, .MuiTable-root');
    const inItemsTable = !!el.closest('.expense-pdf-items');
    const rows = table ? Array.from(table.querySelectorAll('tr, .MuiTableRow-root')) : [];
    const isFirstRow = !!row && rows[0] === row;
    const isLastRow = !!row && rows[rows.length - 1] === row;
    const isFirstCell = !el.previousElementSibling;
    if (inItemsTable) {
      el.style.setProperty('border-left', 'none', 'important');
      el.style.setProperty('border-right', 'none', 'important');
      el.style.setProperty('border-top', 'none', 'important');
      el.style.setProperty('border-bottom', isLastRow ? 'none' : EXPENSE_PDF_BORDER, 'important');
    } else {
      el.style.setProperty('border-top', isFirstRow ? EXPENSE_PDF_BORDER : 'none', 'important');
      el.style.setProperty('border-bottom', EXPENSE_PDF_BORDER, 'important');
      el.style.setProperty('border-right', EXPENSE_PDF_BORDER, 'important');
      el.style.setProperty('border-left', isFirstCell ? EXPENSE_PDF_BORDER : 'none', 'important');
    }
    el.style.setProperty('border-radius', '0', 'important');
    el.style.setProperty('vertical-align', 'middle', 'important');
    el.style.setProperty('line-height', '1', 'important');
    el.style.setProperty('height', `${EXPENSE_PDF_LINE_HEIGHT_PT}pt`, 'important');
    el.style.setProperty('padding-top', '0', 'important');
    el.style.setProperty('padding-bottom', '0', 'important');
  });
  root.querySelectorAll<HTMLElement>('.expense-pdf-items').forEach((tableEl) => {
    const container = tableEl.closest('.MuiTableContainer-root') as HTMLElement | null;
    if (container) {
      container.style.setProperty('border', EXPENSE_PDF_BORDER, 'important');
      container.style.setProperty('border-radius', '0', 'important');
      container.style.setProperty('overflow', 'visible', 'important');
    }
  });
  root.querySelectorAll<HTMLElement>('.expense-pdf-tax .MuiTableContainer-root').forEach((el) => {
    el.style.setProperty('border-radius', '0', 'important');
  });
  root.querySelectorAll<HTMLElement>(
    '.MuiTableCell-root *, .expense-pdf-title-row *, .expense-pdf-voucher-meta *, .expense-clamp'
  ).forEach((el) => {
    el.style.setProperty('line-height', '1', 'important');
    el.style.setProperty('vertical-align', 'middle', 'important');
    el.style.setProperty('margin-top', '0', 'important');
    el.style.setProperty('margin-bottom', '0', 'important');
    el.style.setProperty('padding-top', '0', 'important');
    el.style.setProperty('padding-bottom', '0', 'important');
  });
  root.querySelectorAll<HTMLElement>(
    '.expense-pdf-title-row > *, .expense-pdf-voucher-meta > *'
  ).forEach((el) => {
    el.style.setProperty('display', 'flex', 'important');
    el.style.setProperty('align-items', 'center', 'important');
    el.style.setProperty('line-height', '1', 'important');
  });
  root.querySelectorAll<HTMLElement>('*').forEach((el) => {
    el.style.setProperty('border-top-color', EXPENSE_PDF_LINE, 'important');
    el.style.setProperty('border-right-color', EXPENSE_PDF_LINE, 'important');
    el.style.setProperty('border-bottom-color', EXPENSE_PDF_LINE, 'important');
    el.style.setProperty('border-left-color', EXPENSE_PDF_LINE, 'important');
  });
  root.querySelectorAll<HTMLElement>('.expense-pdf-title-row').forEach((el) => {
    el.style.setProperty('border', 'none', 'important');
    el.style.setProperty('grid-template-columns', '128px 1fr', 'important');
    el.style.setProperty('align-items', 'center', 'important');
  });
  root.querySelectorAll<HTMLElement>('.expense-pdf-title-row > :not(:first-child)').forEach((el) => {
    el.style.setProperty('border', 'none', 'important');
  });
  root.querySelectorAll<HTMLElement>('.expense-pdf-title-row .expense-pdf-title, .expense-pdf-title-row .MuiTypography-root').forEach((el) => {
    el.style.setProperty('display', 'flex', 'important');
    el.style.setProperty('align-items', 'center', 'important');
    el.style.setProperty('line-height', '1', 'important');
    el.style.setProperty('margin', '0', 'important');
    el.style.setProperty('padding', '0', 'important');
  });
  root.querySelectorAll<HTMLElement>('.expense-pdf-title-row > :first-child').forEach((el) => {
    el.style.setProperty('border', EXPENSE_PDF_BORDER, 'important');
    el.style.setProperty('border-color', EXPENSE_PDF_LINE, 'important');
    el.style.setProperty('width', '128px', 'important');
    el.style.setProperty('min-width', '128px', 'important');
    el.style.setProperty('max-width', '128px', 'important');
  });
  root.querySelectorAll<HTMLElement>('.expense-pdf-voucher-meta').forEach((el) => {
    el.style.setProperty('grid-template-columns', '128px minmax(20.4ch, auto)', 'important');
  });
  root.querySelectorAll<HTMLElement>(
    '.expense-pdf-voucher-meta > :nth-child(odd), .expense-pdf-items .MuiTableCell-root:first-child, .expense-pdf-kv-label'
  ).forEach((el) => {
    el.style.setProperty('width', '128px', 'important');
    el.style.setProperty('min-width', '128px', 'important');
    el.style.setProperty('max-width', '128px', 'important');
  });
  root.style.setProperty('overflow', 'visible', 'important');
  root.style.setProperty('padding', '0 1px', 'important');
  root.style.setProperty('width', '100%', 'important');
  root.style.setProperty('max-width', '100%', 'important');
  root.style.setProperty('box-sizing', 'border-box', 'important');
  root.querySelectorAll<HTMLElement>(
    '.expense-pdf-header, .expense-pdf-voucher-row, .expense-pdf-stamps, .MuiTableContainer-root, .expense-pdf-tax'
  ).forEach((el) => {
    el.style.setProperty('overflow', 'visible', 'important');
    el.style.setProperty('max-width', '100%', 'important');
    el.style.setProperty('box-sizing', 'border-box', 'important');
  });
  adjustExpenseHeaderRowHeightsForPdf(root);
}

export async function downloadExpenseApprovalPdf(
  element: HTMLElement,
  filename: string
): Promise<void> {
  await downloadDocumentPdf({
    element,
    filename,
    margins: DOCUMENT_PDF_MARGINS_MM,
    purpose: 'download',
    /** 좌우 여백 유지 + 길면 A4 다중 페이지로 분할 (한 장 강제 축소 안 함) */
    forceFitOnePage: false,
    fitOnePageItemThreshold: 0,
    captureRootAttr: DOCUMENT_PDF_CAPTURE_ROOT_ATTR,
    onClone: sanitizeExpenseCloneForPdf,
  });
}

export function buildExpenseApprovalPdfFilename(opts: {
  companyName?: string | null;
  detail?: string | null;
  /** @deprecated detail 없을 때 보조 */
  voucherNo?: string | null;
  title?: string | null;
  date?: Date | string | null;
}): string {
  return buildDocumentDownloadFilename({
    code: 'PV',
    companyName: opts.companyName,
    detail: opts.detail || opts.title || opts.voucherNo,
    date: opts.date,
  });
}
