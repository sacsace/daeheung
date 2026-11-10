import {
  DOCUMENT_PDF_BORDER,
  DOCUMENT_PDF_CAPTURE_ROOT_ATTR,
  DOCUMENT_PDF_FIT_ONE_PAGE_ITEM_THRESHOLD,
  DOCUMENT_PDF_FONT_FAMILY,
  DOCUMENT_PDF_FONT_SIZE_PT,
  DOCUMENT_PDF_HEADER_BG,
  DOCUMENT_PDF_LINE,
  DOCUMENT_PDF_LINE_HEIGHT_PT,
  DOCUMENT_PDF_MARGINS_MM,
  DOCUMENT_PDF_TEXT_PAD_LEFT,
  DOCUMENT_PDF_TITLE_FONT_SIZE_PT,
  buildDocumentDownloadFilename,
  downloadDocumentPdf,
  documentPdfToBase64,
  ensurePdfExtension,
  sanitizeFilenamePart,
} from './pdf';
import { formatEnglishSentenceLabel } from './textCase';

/** 이 개수 미만이면 가급적 1페이지에 맞춤(축소). 이상이면 필요 시 여러 페이지 허용 */
const FIT_ONE_PAGE_ITEM_THRESHOLD = DOCUMENT_PDF_FIT_ONE_PAGE_ITEM_THRESHOLD;
/** 합계 박스 최소 너비 — 기준 264px, 30% 축소 후 30% 확대 */
const QUOTATION_PDF_TOTALS_MIN_WIDTH_PX = Math.round(264 * 0.7 * 1.3);
/** 은행 정보 열 — 기존 1fr 대비 30% 축소 */
const QUOTATION_BANK_COLUMN_FR = 0.7;
/** 화면 합계 박스 최소 너비 — 218px 대비 30% 확대 */
export const QUOTATION_SCREEN_TOTALS_MIN_WIDTH_PX = Math.round(218 * 1.3);
/** 헤더 메타(Quote # / Date / Valid until) 행 높이 — 표준 18pt 대비 30% 축소 후 40%×2 확대 */
const QUOTATION_META_ROW_HEIGHT_PT = Math.round(DOCUMENT_PDF_LINE_HEIGHT_PT * 0.7 * 1.4 * 1.4 * 10) / 10;
/** 회사명 — 본문(9pt) 대비 약간 크게 */
const QUOTATION_COMPANY_NAME_FONT_SIZE_PT = DOCUMENT_PDF_FONT_SIZE_PT + 1;

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const PDF_ACRONYM_RE =
  /\b(GSTIN|GST|IFSC|SWIFT|CGST|SGST|IGST|QTY|PDF|PAN|TDS|QR|CEO)\b/gi;

function formatPdfEnglishLabel(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return raw;
  if (/^Quote\s*#$/i.test(raw)) return 'Quote #';
  const formatted = formatEnglishSentenceLabel(raw);
  return formatted.replace(PDF_ACRONYM_RE, (word) => word.toUpperCase());
}

function formatPdfLabelPrefix(value: string): string {
  const raw = String(value || '');
  const idx = raw.indexOf(':');
  if (idx <= 0) return formatPdfEnglishLabel(raw);
  return `${formatPdfEnglishLabel(raw.slice(0, idx))}${raw.slice(idx)}`;
}

function flattenMetaCellText(cell: HTMLElement, doc: Document, isHeader: boolean): void {
  const input = cell.querySelector('input:not([type="hidden"])') as HTMLInputElement | null;
  const text = (input?.value ?? cell.textContent ?? '').replace(/\s+/g, ' ').trim() || '-';
  cell.innerHTML = '';
  const div = doc.createElement('div');
  div.setAttribute(
    'style',
    `color:#000000 !important;-webkit-text-fill-color:#000000 !important;font-family:${DOCUMENT_PDF_FONT_FAMILY} !important;font-size:${DOCUMENT_PDF_FONT_SIZE_PT}pt !important;font-weight:${isHeader ? '600' : '400'} !important;line-height:1 !important;padding:0;margin:0;white-space:nowrap;text-align:center;width:100%;`
  );
  div.textContent = text;
  cell.appendChild(div);
}

function wrapForExactVerticalCenter(el: HTMLElement, doc: Document): void {
  if (el.getAttribute('data-pdf-vcenter') === '1') return;
  const wrap = doc.createElement('span');
  wrap.className = 'quotation-pdf-vcenter';
  wrap.setAttribute('data-pdf-vcenter', '1');
  while (el.firstChild) wrap.appendChild(el.firstChild);
  el.appendChild(wrap);
  el.setAttribute('data-pdf-vcenter', '1');
}

function unwrapWebkitBoxClamps(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('*').forEach((el) => {
    const display = getComputedStyle(el).display;
    if (display !== '-webkit-box' && display !== '-webkit-inline-box') return;
    el.style.setProperty('display', 'block', 'important');
    el.style.setProperty('-webkit-box-orient', 'unset', 'important');
    el.style.setProperty('-webkit-line-clamp', 'unset', 'important');
    el.style.setProperty('overflow', 'visible', 'important');
    el.style.setProperty('max-height', 'none', 'important');
    el.style.setProperty('white-space', 'normal', 'important');
    el.style.setProperty('writing-mode', 'horizontal-tb', 'important');
  });
}

function readControlValue(fc: Element): string {
  const combobox = fc.querySelector('[role="combobox"]') as HTMLElement | null;
  if (combobox instanceof HTMLInputElement || combobox instanceof HTMLTextAreaElement) {
    return (combobox.value ?? '').trim();
  }
  if (combobox) return (combobox.textContent ?? '').replace(/\s+/g, ' ').trim();
  const ta = fc.querySelector('textarea') as HTMLTextAreaElement | null;
  if (ta) return (ta.value ?? '').trim();
  const inp = fc.querySelector('input:not([type="hidden"])') as HTMLInputElement | null;
  if (inp) return (inp.value ?? '').trim();
  return (fc.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function readLineControls(wrap: Element | null): string[] {
  if (!wrap) return [];
  return Array.from(wrap.querySelectorAll('.MuiFormControl-root')).map((el) => readControlValue(el));
}

/** Customer info KV 표 열 수 (label|value × 2, Address 행은 value colspan 3) */
const QUOTATION_CUSTOMER_KV_COL_COUNT = 4;

function createCustomerListTable(
  doc: Document,
  rows: Array<Array<{ label: string; value: string; valueColSpan?: number }>>
): HTMLTableElement {
  const table = doc.createElement('table');
  table.className = 'quotation-pdf-kv quotation-pdf-customer-kv';
  const colgroup = doc.createElement('colgroup');
  colgroup.innerHTML = `
    <col class="quotation-pdf-customer-col-label" />
    <col class="quotation-pdf-customer-col-value" />
    <col class="quotation-pdf-customer-col-label" />
    <col class="quotation-pdf-customer-col-value" />
  `;
  table.appendChild(colgroup);
  const tbody = doc.createElement('tbody');
  rows.forEach((pairs) => {
    const tr = doc.createElement('tr');
    if (pairs.length === 1 && /^address$/i.test(pairs[0]?.label || '')) {
      tr.className = 'quotation-pdf-customer-address-row';
    }
    pairs.forEach(({ label, value, valueColSpan }) => {
      const labelTd = doc.createElement('td');
      labelTd.className = 'quotation-pdf-kv-label';
      if (/^gst$/i.test(label)) {
        labelTd.classList.add('quotation-pdf-kv-gst-label');
      }
      labelTd.textContent = formatPdfEnglishLabel(label);
      const valueTd = doc.createElement('td');
      valueTd.className = 'quotation-pdf-kv-value';
      if (/^name$/i.test(label)) {
        valueTd.classList.add('quotation-pdf-customer-name-value');
      }
      if (/^gst$/i.test(label)) {
        valueTd.classList.add('quotation-pdf-kv-gst-value');
        const gstEmpty = !value || value === '-';
        if (gstEmpty) {
          valueTd.classList.add('quotation-pdf-kv-gst-empty');
        }
      }
      if (/^address$/i.test(label)) {
        valueTd.classList.add('quotation-pdf-customer-address-value');
        valueTd.textContent = formatAddressTwoLines(value);
      } else {
        valueTd.textContent = value || '-';
      }
      if (valueColSpan && valueColSpan > 1) {
        valueTd.colSpan = valueColSpan;
      }
      tr.appendChild(labelTd);
      tr.appendChild(valueTd);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  table.querySelectorAll<HTMLElement>('.quotation-pdf-kv-title-cell').forEach((el) => {
    el.style.setProperty('background', '#ffffff', 'important');
    el.style.setProperty('border', 'none', 'important');
  });
  table.querySelectorAll<HTMLElement>('.quotation-pdf-kv-label').forEach((el) => {
    el.style.setProperty('background', DOCUMENT_PDF_HEADER_BG, 'important');
  });
  table.querySelectorAll<HTMLElement>('.quotation-pdf-customer-address-value').forEach((el) => {
    el.style.setProperty('white-space', 'pre-line', 'important');
    el.style.setProperty('word-break', 'break-word', 'important');
    el.style.setProperty('overflow', 'visible', 'important');
    el.style.setProperty('text-overflow', 'unset', 'important');
    el.style.setProperty('height', 'auto', 'important');
    el.style.setProperty('max-height', 'none', 'important');
    el.style.setProperty('line-height', '1.25', 'important');
  });
  table.querySelectorAll<HTMLElement>('.quotation-pdf-customer-address-row td').forEach((el) => {
    el.style.setProperty('vertical-align', 'top', 'important');
    el.style.setProperty('overflow', 'visible', 'important');
    el.style.setProperty('height', 'auto', 'important');
    el.style.setProperty('min-height', `${DOCUMENT_PDF_LINE_HEIGHT_PT}pt`, 'important');
    el.style.setProperty('max-height', 'none', 'important');
    el.style.setProperty('padding-top', '2px', 'important');
    el.style.setProperty('padding-bottom', '2px', 'important');
  });
  return table;
}

function prependKvTitleRow(
  table: HTMLTableElement,
  doc: Document,
  title: string,
  colSpan: number
): void {
  const tbody = table.querySelector('tbody');
  if (!tbody) return;
  const tr = doc.createElement('tr');
  tr.className = 'quotation-pdf-kv-title-row';
  const td = doc.createElement('td');
  td.className = 'quotation-pdf-kv-title-cell';
  td.colSpan = colSpan;
  td.textContent = formatPdfEnglishLabel(title);
  tr.appendChild(td);
  tbody.insertBefore(tr, tbody.firstChild);
}

function applySingleFrameBorder(el: HTMLElement): void {
  el.style.setProperty('outline', 'none', 'important');
  el.style.setProperty('box-shadow', 'none', 'important');
  el.style.setProperty('border', DOCUMENT_PDF_BORDER, 'important');
}

/** PDF용 주소 — 줄바꿈 제거 후 한 줄 */
function formatAddressSingleLine(address: string): string {
  const cleaned = formatEnglishSentenceLabel(
    String(address || '')
      .replace(/\r\n/g, ' ')
      .replace(/\s*\n\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
  return cleaned || '-';
}

/** 긴 주소를 대략 절반에서 두 줄로 나눔 (쉼표 우선) — 화면 표시용 */
function formatAddressTwoLines(address: string): string {
  const cleaned = formatEnglishSentenceLabel(
    String(address || '')
      .replace(/\r\n/g, '\n')
      .replace(/\s*\n\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
  if (!cleaned || cleaned === '-') return cleaned;

  const parts = cleaned.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const mid = Math.ceil(parts.length / 2);
    return `${parts.slice(0, mid).join(', ')}\n${parts.slice(mid).join(', ')}`;
  }

  if (cleaned.length < 36) return cleaned;
  const mid = Math.floor(cleaned.length / 2);
  const spaceAfter = cleaned.indexOf(' ', mid);
  const spaceBefore = cleaned.lastIndexOf(' ', mid);
  const breakAt =
    spaceAfter >= 0 && (spaceBefore < 0 || spaceAfter - mid <= mid - spaceBefore)
      ? spaceAfter
      : spaceBefore;
  if (breakAt > 0) {
    return `${cleaned.slice(0, breakAt).trim()}\n${cleaned.slice(breakAt).trim()}`;
  }
  return cleaned;
}

export { formatAddressTwoLines };

/**
 * html2canvas 클론에서 입력 UI 제거 + PDF 전용 모던 레이아웃.
 */
/** 캡처 전용 오프스크린 복제본 표시 */
const PDF_CAPTURE_ROOT_ATTR = 'data-quotation-pdf-root';

function resolvePdfCaptureRoot(doc: Document): HTMLElement | null {
  return (doc.querySelector(`[${PDF_CAPTURE_ROOT_ATTR}]`) ||
    doc.querySelector(`[${DOCUMENT_PDF_CAPTURE_ROOT_ATTR}]`) ||
    doc.querySelector('.quotation-print-area')) as HTMLElement | null;
}

function syncQuotationPdfBankTotalsHeights(area: HTMLElement): void {
  area.querySelectorAll<HTMLElement>('.quotation-pdf-totals-wrap').forEach((wrap) => {
    const totalsEl = wrap.querySelector<HTMLElement>('.quotation-pdf-totals');
    const bankEl = wrap.querySelector<HTMLElement>('.quotation-pdf-bank');
    if (!totalsEl || !bankEl) return;
    if (getComputedStyle(bankEl).visibility === 'hidden') {
      bankEl.style.setProperty('display', 'none', 'important');
      return;
    }

    totalsEl.style.setProperty('display', 'flex', 'important');
    totalsEl.style.setProperty('flex-direction', 'column', 'important');
    totalsEl.style.setProperty('height', 'auto', 'important');

    totalsEl.querySelectorAll<HTMLElement>(':scope > *').forEach((row) => {
      row.style.setProperty('flex', `0 0 ${DOCUMENT_PDF_LINE_HEIGHT_PT}pt`, 'important');
      row.style.setProperty('height', `${DOCUMENT_PDF_LINE_HEIGHT_PT}pt`, 'important');
      row.style.setProperty('min-height', `${DOCUMENT_PDF_LINE_HEIGHT_PT}pt`, 'important');
      row.style.setProperty('box-sizing', 'border-box', 'important');
    });

    void totalsEl.offsetHeight;
    const rowCount = totalsEl.querySelectorAll(':scope > *').length;
    const fallbackHeightPx = Math.ceil(rowCount * DOCUMENT_PDF_LINE_HEIGHT_PT * (96 / 72));
    const totalsHeightPx = Math.ceil(totalsEl.getBoundingClientRect().height) || fallbackHeightPx;
    if (totalsHeightPx <= 0) return;

    totalsEl.style.setProperty('min-height', `${totalsHeightPx}px`, 'important');
    totalsEl.style.setProperty('height', `${totalsHeightPx}px`, 'important');
    bankEl.style.setProperty('min-height', `${totalsHeightPx}px`, 'important');
    bankEl.style.setProperty('height', `${totalsHeightPx}px`, 'important');
    bankEl.style.setProperty('width', '100%', 'important');
    bankEl.style.setProperty('max-width', '100%', 'important');
    bankEl.style.setProperty('box-sizing', 'border-box', 'important');
  });
}

function sanitizeQuotationCloneForPdf(clonedDoc: Document): void {
  const area = resolvePdfCaptureRoot(clonedDoc);
  if (!area) return;

  // 화면 전용 hide 제거
  area.querySelectorAll('.quotation-pdf-hide').forEach((el) => el.remove());

  // PDF: Phone/Email 한 줄, GST는 다음 줄
  area.querySelectorAll('.quotation-pdf-company-contact').forEach((contactEl) => {
    const el = contactEl as HTMLElement;
    const text = (el.textContent || '').trim();
    const splitIndex = text.search(/\s*\|\s*GST:/i);
    if (splitIndex < 0) return;
    el.textContent = text.slice(0, splitIndex).trim();
    const gstPart = text.slice(splitIndex).replace(/^\s*\|\s*/, '').trim();
    if (!gstPart) return;
    const existingGst = el.nextElementSibling;
    if (existingGst?.classList.contains('quotation-pdf-company-contact-gst')) {
      (existingGst as HTMLElement).textContent = gstPart;
      return;
    }
    const gstLine = clonedDoc.createElement('div');
    gstLine.className = 'quotation-pdf-company-contact-gst';
    gstLine.textContent = gstPart;
    el.insertAdjacentElement('afterend', gstLine);
  });

  // CUSTOMER INFO 라벨의 필수 표시(*) 제거
  area.querySelectorAll('.quotation-pdf-section-body .MuiTypography-caption').forEach((cap) => {
    const el = cap as HTMLElement;
    el.textContent = (el.textContent || '').replace(/\s*\*/g, '').trim();
  });

  const plainStyle =
    `color:#000000 !important;-webkit-text-fill-color:#000000 !important;font-size:${DOCUMENT_PDF_FONT_SIZE_PT}pt;line-height:1;padding:0;margin:0;white-space:pre-wrap;word-break:break-word;`;

  const style = clonedDoc.createElement('style');
  style.textContent = `
    .quotation-print-area, .quotation-print-area * {
      color: #000000 !important;
      -webkit-text-fill-color: #000000 !important;
      font-family: ${DOCUMENT_PDF_FONT_FAMILY} !important;
      font-size: ${DOCUMENT_PDF_FONT_SIZE_PT}pt !important;
      line-height: 1 !important;
      box-sizing: border-box !important;
      border-top-color: ${DOCUMENT_PDF_LINE} !important;
      border-right-color: ${DOCUMENT_PDF_LINE} !important;
      border-bottom-color: ${DOCUMENT_PDF_LINE} !important;
      border-left-color: ${DOCUMENT_PDF_LINE} !important;
    }
    .quotation-print-area {
      font-size: ${DOCUMENT_PDF_FONT_SIZE_PT}pt !important;
      background: #ffffff !important;
      color: #000000 !important;
      padding-bottom: 8px !important;
      border-radius: 0 !important;
      box-shadow: none !important;
    }
    .quotation-print-area .MuiButton-root,
    .quotation-print-area .MuiIconButton-root,
    .quotation-print-area .MuiAutocomplete-endAdornment,
    .quotation-print-area .MuiAutocomplete-popupIndicator,
    .quotation-print-area .MuiAutocomplete-clearIndicator,
    .quotation-print-area button,
    .quotation-print-area .MuiFormHelperText-root,
    .quotation-print-area .MuiAlert-root,
    .quotation-print-area .MuiRadio-root,
    .quotation-print-area .MuiChip-root,
    .quotation-print-area .MuiSvgIcon-root {
      display: none !important;
    }
    .quotation-print-area .quotation-pdf-title,
    .quotation-print-area .quotation-pdf-title * {
      font-size: ${DOCUMENT_PDF_TITLE_FONT_SIZE_PT}pt !important;
      font-weight: 700 !important;
      letter-spacing: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      color: #000000 !important;
      line-height: 1.2 !important;
    }

    .quotation-print-area > fieldset,
    .quotation-print-area fieldset {
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
      border-radius: 0 !important;
      padding: 0 !important;
      margin: 0 !important;
      background: transparent !important;
    }

    .quotation-print-area .quotation-pdf-header {
      display: flex !important;
      justify-content: space-between !important;
      align-items: stretch !important;
      margin: 0 0 12px 0 !important;
      padding: 0 0 10px 0 !important;
      gap: 18px !important;
      border-bottom: none !important;
    }
    .quotation-print-area .quotation-pdf-company {
      flex: 1 1 auto !important;
      min-width: 0 !important;
      max-width: calc(100% - 332px) !important;
      padding-right: 8px !important;
      align-self: flex-start !important;
      text-align: left !important;
      overflow: visible !important;
    }
    .quotation-print-area .quotation-pdf-header-right {
      flex: 0 0 320px !important;
      width: 320px !important;
      max-width: 320px !important;
      min-width: 320px !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: stretch !important;
      align-self: stretch !important;
      text-align: right !important;
      overflow: hidden !important;
      position: relative !important;
      z-index: 2 !important;
      background: #ffffff !important;
    }
    .quotation-print-area .quotation-pdf-header-right .quotation-pdf-title {
      margin: 0 !important;
      text-align: right !important;
    }
    .quotation-print-area .quotation-pdf-header-spacer {
      flex: 1 1 auto !important;
      min-height: 14px !important;
    }
    .quotation-print-area .quotation-pdf-company img {
      max-height: 36px !important;
      margin-bottom: 4px !important;
    }
    .quotation-print-area .quotation-pdf-company .MuiTypography-caption {
      font-size: ${DOCUMENT_PDF_FONT_SIZE_PT}pt !important;
      line-height: 1 !important;
      color: #000000 !important;
      -webkit-text-fill-color: #000000 !important;
      text-align: left !important;
    }
    .quotation-print-area .quotation-pdf-company-address {
      white-space: pre-line !important;
      max-width: 100% !important;
      display: block !important;
      margin: 0 0 2px 0 !important;
      line-height: 1.25 !important;
      font-size: ${DOCUMENT_PDF_FONT_SIZE_PT}pt !important;
      text-align: left !important;
      overflow: visible !important;
      word-break: break-word !important;
    }
    .quotation-print-area .quotation-pdf-company-contact {
      display: block !important;
      white-space: nowrap !important;
      max-width: 100% !important;
      width: auto !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      margin: 2px 0 0 0 !important;
      line-height: 1.25 !important;
      font-size: ${DOCUMENT_PDF_FONT_SIZE_PT}pt !important;
      text-align: left !important;
    }
    .quotation-print-area .quotation-pdf-company-contact-gst {
      display: block !important;
      white-space: nowrap !important;
      max-width: 100% !important;
      width: auto !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      margin: 2px 0 0 0 !important;
      line-height: 1.25 !important;
      font-size: ${DOCUMENT_PDF_FONT_SIZE_PT}pt !important;
      text-align: left !important;
    }
    .quotation-print-area .quotation-pdf-kv {
      width: 100% !important;
      border-collapse: collapse !important;
      border-spacing: 0 !important;
      table-layout: fixed !important;
      margin: 0 !important;
      display: table !important;
    }
    .quotation-print-area .quotation-pdf-kv tbody {
      display: table-row-group !important;
    }
    .quotation-print-area .quotation-pdf-kv tr {
      display: table-row !important;
    }
    .quotation-print-area .quotation-pdf-kv td {
      border: none !important;
      border-right: ${DOCUMENT_PDF_BORDER} !important;
      border-bottom: ${DOCUMENT_PDF_BORDER} !important;
      min-height: ${DOCUMENT_PDF_LINE_HEIGHT_PT}pt !important;
      height: auto !important;
      padding: 0 6px 0 ${DOCUMENT_PDF_TEXT_PAD_LEFT} !important;
      font-size: ${DOCUMENT_PDF_FONT_SIZE_PT}pt !important;
      line-height: 1 !important;
      vertical-align: middle !important;
      text-align: left !important;
      display: table-cell !important;
    }
    .quotation-print-area .quotation-pdf-kv tr:first-child td {
      border-top: ${DOCUMENT_PDF_BORDER} !important;
    }
    .quotation-print-area .quotation-pdf-kv tr td:first-child {
      border-left: ${DOCUMENT_PDF_BORDER} !important;
    }
    .quotation-print-area .quotation-pdf-kv tr:last-child td {
      border-bottom: ${DOCUMENT_PDF_BORDER} !important;
    }
    .quotation-print-area .quotation-pdf-customer-kv {
      border: ${DOCUMENT_PDF_BORDER} !important;
    }
    .quotation-print-area .quotation-pdf-customer-block {
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .quotation-print-area .quotation-pdf-customer-title {
      font-size: ${DOCUMENT_PDF_FONT_SIZE_PT}pt !important;
      font-weight: 700 !important;
      line-height: 1.2 !important;
      color: #000000 !important;
      background: #ffffff !important;
      border: none !important;
      margin: 0 0 4px 0 !important;
      padding: 0 0 0 ${DOCUMENT_PDF_TEXT_PAD_LEFT} !important;
      text-align: left !important;
    }
    .quotation-print-area .quotation-pdf-customer-kv tr:first-child td {
      border-top: none !important;
    }
    .quotation-print-area .quotation-pdf-customer-kv tr td:first-child {
      border-left: none !important;
    }
    .quotation-print-area .quotation-pdf-customer-kv td {
      border-top: none !important;
      border-left: none !important;
      border-right: ${DOCUMENT_PDF_BORDER} !important;
      border-bottom: ${DOCUMENT_PDF_BORDER} !important;
    }
    .quotation-print-area .quotation-pdf-customer-kv tr td:last-child {
      border-right: none !important;
    }
    .quotation-print-area .quotation-pdf-customer-kv tr:last-child td {
      border-bottom: none !important;
    }
    /* 프레임 섹션(notes 등): 외곽선은 섹션만, 표는 내부 격자선만 */
    .quotation-print-area .quotation-pdf-section-notes .quotation-pdf-kv td {
      border-top: none !important;
      border-left: none !important;
      border-right: ${DOCUMENT_PDF_BORDER} !important;
      border-bottom: ${DOCUMENT_PDF_BORDER} !important;
    }
    .quotation-print-area .quotation-pdf-section-notes .quotation-pdf-kv tr td:last-child {
      border-right: none !important;
    }
    .quotation-print-area .quotation-pdf-section-notes .quotation-pdf-kv tr:last-child td {
      border-bottom: none !important;
    }
    .quotation-print-area .quotation-pdf-kv-label {
      font-weight: 600 !important;
      background: ${DOCUMENT_PDF_HEADER_BG} !important;
      white-space: nowrap !important;
    }
    .quotation-print-area .quotation-pdf-kv-value {
      font-weight: 400 !important;
      word-break: break-word !important;
      background: #ffffff !important;
    }
    .quotation-print-area .quotation-pdf-customer-kv .quotation-pdf-kv-label {
      width: 56px !important;
      min-width: 56px !important;
      max-width: 56px !important;
      background: ${DOCUMENT_PDF_HEADER_BG} !important;
    }
    .quotation-print-area .quotation-pdf-customer-kv col.quotation-pdf-customer-col-label {
      width: 56px !important;
    }
    .quotation-print-area .quotation-pdf-customer-kv col.quotation-pdf-customer-col-value {
      width: auto !important;
    }
    .quotation-print-area .quotation-pdf-customer-kv td {
      height: ${DOCUMENT_PDF_LINE_HEIGHT_PT}pt !important;
      min-height: ${DOCUMENT_PDF_LINE_HEIGHT_PT}pt !important;
      max-height: ${DOCUMENT_PDF_LINE_HEIGHT_PT}pt !important;
      padding-top: 0 !important;
      padding-bottom: 0 !important;
      overflow: hidden !important;
    }
    .quotation-print-area .quotation-pdf-customer-kv .quotation-pdf-kv-value {
      white-space: nowrap !important;
      word-break: normal !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }
    .quotation-print-area .quotation-pdf-customer-kv .quotation-pdf-customer-name-value {
      white-space: nowrap !important;
    }
    .quotation-print-area .quotation-pdf-customer-kv .quotation-pdf-customer-address-value {
      white-space: pre-line !important;
      word-break: break-word !important;
      overflow: visible !important;
      text-overflow: unset !important;
      height: auto !important;
      min-height: ${DOCUMENT_PDF_LINE_HEIGHT_PT}pt !important;
      max-height: none !important;
      line-height: 1.25 !important;
    }
    .quotation-print-area .quotation-pdf-customer-kv tr.quotation-pdf-customer-address-row td {
      height: auto !important;
      min-height: ${DOCUMENT_PDF_LINE_HEIGHT_PT}pt !important;
      max-height: none !important;
      overflow: visible !important;
      padding-top: 2px !important;
      padding-bottom: 2px !important;
      vertical-align: top !important;
    }
    .quotation-print-area .quotation-pdf-customer-kv tr.quotation-pdf-customer-address-row .quotation-pdf-kv-label {
      line-height: ${DOCUMENT_PDF_LINE_HEIGHT_PT}pt !important;
    }
    .quotation-print-area .quotation-pdf-customer-kv .quotation-pdf-kv-gst-label {
      background: ${DOCUMENT_PDF_HEADER_BG} !important;
      color: #000000 !important;
      -webkit-text-fill-color: #000000 !important;
      font-weight: 600 !important;
    }
    .quotation-print-area .quotation-pdf-customer-kv .quotation-pdf-kv-gst-value.quotation-pdf-kv-gst-empty {
      background: #ffffff !important;
      color: #000000 !important;
      -webkit-text-fill-color: #000000 !important;
    }
    .quotation-print-area .quotation-pdf-section-customer {
      border: none !important;
      overflow: visible !important;
      background: transparent !important;
      margin: 0 0 8px 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
    }
    .quotation-print-area .quotation-pdf-company .quotation-pdf-company-name,
    .quotation-print-area .quotation-pdf-company .MuiTypography-subtitle2.quotation-pdf-company-name {
      font-size: ${QUOTATION_COMPANY_NAME_FONT_SIZE_PT}pt !important;
      font-weight: 700 !important;
      margin: 0 0 3px 0 !important;
      line-height: 1.1 !important;
      color: #000000 !important;
      text-align: left !important;
    }

    .quotation-print-area .quotation-pdf-meta {
      border: ${DOCUMENT_PDF_BORDER} !important;
      border-radius: 0 !important;
      margin-top: 0 !important;
      min-width: 0 !important;
      width: 100% !important;
      max-width: 100% !important;
      flex: 0 0 auto !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
      background: #fff !important;
      box-sizing: border-box !important;
    }
    .quotation-print-area .quotation-pdf-meta > * {
      border: none !important;
      display: grid !important;
      grid-template-columns: var(--quotation-meta-cols, minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)) !important;
      min-width: 0 !important;
    }
    .quotation-print-area .quotation-pdf-meta > *:not(:last-child) {
      border-bottom: ${DOCUMENT_PDF_BORDER} !important;
    }
    .quotation-print-area .quotation-pdf-meta > * > * {
      min-width: 0 !important;
      min-height: ${QUOTATION_META_ROW_HEIGHT_PT}pt !important;
      height: ${QUOTATION_META_ROW_HEIGHT_PT}pt !important;
      padding: 0 ${DOCUMENT_PDF_TEXT_PAD_LEFT} !important;
      font-size: ${DOCUMENT_PDF_FONT_SIZE_PT}pt !important;
      line-height: 1 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      text-align: center !important;
      text-indent: 0 !important;
      border: none !important;
    }
    .quotation-print-area .quotation-pdf-meta > * > *:not(:last-child) {
      border-right: ${DOCUMENT_PDF_BORDER} !important;
    }
    .quotation-print-area .quotation-pdf-meta > *:nth-child(1) {
      background: ${DOCUMENT_PDF_HEADER_BG} !important;
    }
    .quotation-print-area .quotation-pdf-meta > *:nth-child(2) {
      background: #ffffff !important;
      flex: 0 0 auto !important;
    }
    .quotation-print-area .quotation-pdf-meta [class*="MuiBox-root"] {
      padding: 0 ${DOCUMENT_PDF_TEXT_PAD_LEFT} !important;
      text-align: center !important;
      justify-content: center !important;
    }
    .quotation-print-area .quotation-pdf-meta > *:nth-child(1) > * {
      font-weight: 600 !important;
    }
    .quotation-print-area .quotation-pdf-meta > *:nth-child(2) > * {
      font-weight: 400 !important;
    }
    .quotation-print-area .quotation-pdf-meta .MuiTypography-caption {
      font-size: ${DOCUMENT_PDF_FONT_SIZE_PT}pt !important;
      font-weight: 600 !important;
      letter-spacing: 0 !important;
      color: #000000 !important;
      -webkit-text-fill-color: #000000 !important;
      text-transform: none !important;
      text-align: center !important;
      width: 100% !important;
      display: block !important;
      line-height: 1 !important;
    }
    .quotation-print-area .quotation-pdf-meta .MuiTypography-body2 {
      font-size: ${DOCUMENT_PDF_FONT_SIZE_PT}pt !important;
      font-weight: 400 !important;
      line-height: 1 !important;
      text-align: center !important;
      width: 100% !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }
    .quotation-print-area .quotation-pdf-meta .quotation-pdf-vcenter {
      justify-content: center !important;
      text-align: center !important;
    }
    .quotation-print-area .quotation-pdf-vcenter {
      display: flex !important;
      align-items: center !important;
      width: 100% !important;
      height: 100% !important;
      min-height: inherit !important;
      line-height: 1 !important;
    }
    .quotation-print-area .quotation-pdf-item-box-meta .quotation-pdf-vcenter,
    .quotation-print-area .quotation-pdf-item-box-amount .quotation-pdf-vcenter,
    .quotation-print-area .quotation-pdf-item-box-head span:nth-child(2) .quotation-pdf-vcenter,
    .quotation-print-area .quotation-pdf-item-box-head span:nth-child(3) .quotation-pdf-vcenter,
    .quotation-print-area .quotation-pdf-item-box-head span:nth-child(4) .quotation-pdf-vcenter {
      justify-content: flex-end !important;
    }

    .quotation-print-area .quotation-pdf-signature {
      margin: 12px 0 8px 0 !important;
      padding: 8px 0 4px 0 !important;
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
      gap: 24px !important;
      border-top: none !important;
      width: 100% !important;
      height: auto !important;
      min-height: 0 !important;
      page-break-inside: avoid !important;
      overflow: visible !important;
    }
    .quotation-print-area .quotation-pdf-sign-line {
      margin-top: 28px !important;
      margin-bottom: 4px !important;
      width: 160px !important;
      height: 28px !important;
      border-bottom: ${DOCUMENT_PDF_BORDER} !important;
    }

    /* —— 본문 섹션·아이템 표·합계만 스크린샷 패턴 (헤더/메타는 유지) —— */
    .quotation-print-area .quotation-pdf-section {
      border: none !important;
      border-radius: 0 !important;
      margin: 0 0 8px 0 !important;
      padding: 0 !important;
      overflow: visible !important;
      box-shadow: none !important;
      background: transparent !important;
    }
    .quotation-print-area .quotation-pdf-section-notes {
      border: ${DOCUMENT_PDF_BORDER} !important;
      overflow: hidden !important;
      background: #fff !important;
      box-sizing: border-box !important;
    }
    .quotation-print-area .quotation-pdf-section-title {
      background: ${DOCUMENT_PDF_HEADER_BG} !important;
      border: none !important;
      border-bottom: ${DOCUMENT_PDF_BORDER} !important;
      border-radius: 0 !important;
      padding: 0 ${DOCUMENT_PDF_TEXT_PAD_LEFT} !important;
      margin: 0 !important;
      min-height: ${DOCUMENT_PDF_LINE_HEIGHT_PT}pt !important;
      height: ${DOCUMENT_PDF_LINE_HEIGHT_PT}pt !important;
      display: flex !important;
      align-items: center !important;
      box-sizing: border-box !important;
    }
    .quotation-print-area .quotation-pdf-section-title * {
      font-weight: 700 !important;
      font-size: ${DOCUMENT_PDF_FONT_SIZE_PT}pt !important;
      letter-spacing: 0 !important;
      text-transform: none !important;
      color: #000000 !important;
      -webkit-text-fill-color: #000000 !important;
      line-height: 1 !important;
    }
    .quotation-print-area .quotation-pdf-section-body {
      border: none !important;
      border-radius: 0 !important;
      padding: 6px ${DOCUMENT_PDF_TEXT_PAD_LEFT} 8px ${DOCUMENT_PDF_TEXT_PAD_LEFT} !important;
      margin: 0 !important;
      gap: 4px 12px !important;
      min-height: 0 !important;
      background: #fff !important;
    }
    .quotation-print-area .quotation-pdf-section-body .MuiTypography-caption {
      display: block !important;
      font-size: ${DOCUMENT_PDF_FONT_SIZE_PT}pt !important;
      font-weight: 600 !important;
      letter-spacing: 0 !important;
      color: #000000 !important;
      -webkit-text-fill-color: #000000 !important;
      margin: 0 0 1px 0 !important;
      line-height: 1 !important;
      text-align: left !important;
    }

    .quotation-print-area .quotation-pdf-totals-wrap {
      margin: 8px 0 0 0 !important;
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) auto !important;
      gap: 12px !important;
      align-items: stretch !important;
      width: 100% !important;
    }
    .quotation-print-area .quotation-pdf-totals {
      flex: 0 0 auto !important;
      display: flex !important;
      flex-direction: column !important;
      width: max-content !important;
      min-width: ${QUOTATION_PDF_TOTALS_MIN_WIDTH_PX}px !important;
      max-width: none !important;
      height: auto !important;
      align-self: stretch !important;
      justify-self: end !important;
      border: ${DOCUMENT_PDF_BORDER} !important;
      border-radius: 0 !important;
      overflow: hidden !important;
      background: #fff !important;
      margin: 0 !important;
      flex-shrink: 0 !important;
      box-sizing: border-box !important;
    }
    .quotation-print-area .quotation-pdf-totals > * {
      border: none !important;
      padding: 0 ${DOCUMENT_PDF_TEXT_PAD_LEFT} !important;
      min-height: ${DOCUMENT_PDF_LINE_HEIGHT_PT}pt !important;
      height: ${DOCUMENT_PDF_LINE_HEIGHT_PT}pt !important;
      background: #fff !important;
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      gap: 8px !important;
    }
    .quotation-print-area .quotation-pdf-totals > * > *:last-child {
      text-align: right !important;
      margin-left: auto !important;
      white-space: nowrap !important;
    }
    .quotation-print-area .quotation-pdf-totals > *:not(:last-child) {
      border-bottom: ${DOCUMENT_PDF_BORDER} !important;
    }
    .quotation-print-area .quotation-pdf-totals > *:first-child {
      background: ${DOCUMENT_PDF_HEADER_BG} !important;
    }
    .quotation-print-area .quotation-pdf-totals > *:last-child {
      background: ${DOCUMENT_PDF_HEADER_BG} !important;
      border-top: none !important;
      border-bottom: none !important;
    }
    .quotation-print-area .quotation-pdf-totals .MuiTypography-body2 {
      font-size: ${DOCUMENT_PDF_FONT_SIZE_PT}pt !important;
      line-height: 1 !important;
      color: #000000 !important;
    }
    .quotation-print-area .quotation-pdf-totals .MuiTypography-subtitle2 {
      font-size: ${DOCUMENT_PDF_FONT_SIZE_PT}pt !important;
      font-weight: 700 !important;
      line-height: 1 !important;
      color: #000000 !important;
    }

    .quotation-print-area .quotation-pdf-bank {
      margin: 0 !important;
      width: 100% !important;
      max-width: 100% !important;
      height: auto !important;
      align-self: stretch !important;
      justify-self: stretch !important;
      min-width: 0 !important;
      border: ${DOCUMENT_PDF_BORDER} !important;
      border-radius: 0 !important;
      padding: 4px ${DOCUMENT_PDF_TEXT_PAD_LEFT} !important;
      background: #fff !important;
      box-sizing: border-box !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: flex-start !important;
      align-items: flex-start !important;
      text-align: left !important;
      gap: 0 !important;
    }
    .quotation-print-area .quotation-pdf-bank,
    .quotation-print-area .quotation-pdf-bank * {
      line-height: 1.25 !important;
    }
    .quotation-print-area .quotation-pdf-bank .MuiTypography-subtitle2 {
      font-size: ${DOCUMENT_PDF_FONT_SIZE_PT}pt !important;
      font-weight: 700 !important;
      margin: 0 0 2px 0 !important;
      padding: 0 !important;
      color: #000000 !important;
      text-align: left !important;
      width: 100% !important;
      line-height: 1.25 !important;
    }
    .quotation-print-area .quotation-pdf-bank .MuiTypography-caption {
      font-size: ${DOCUMENT_PDF_FONT_SIZE_PT}pt !important;
      line-height: 1.25 !important;
      margin: 0 !important;
      padding: 0 !important;
      color: #000000 !important;
      -webkit-text-fill-color: #000000 !important;
      display: block !important;
      text-align: left !important;
      width: 100% !important;
    }

    .quotation-print-area .quotation-pdf-signature .MuiTypography-caption {
      font-size: ${DOCUMENT_PDF_FONT_SIZE_PT}pt !important;
      line-height: 1 !important;
      color: #000000 !important;
      -webkit-text-fill-color: #000000 !important;
    }
    .quotation-print-area .quotation-pdf-signature img,
    .quotation-print-area .quotation-pdf-stamp {
      width: 3.5cm !important;
      max-width: 3.5cm !important;
      height: auto !important;
      max-height: 1.8cm !important;
      margin: 6px 0 4px 0 !important;
      object-fit: contain !important;
      display: block !important;
    }

    /* 아이템: 단일 박스 + 내부 리스트 */
    .quotation-print-area .quotation-pdf-item-boxes {
      border: ${DOCUMENT_PDF_BORDER} !important;
      background: #fff !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      box-sizing: border-box !important;
      width: 100% !important;
    }
    .quotation-print-area .quotation-pdf-item-box-head {
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) 52px 70px minmax(100px, max-content) !important;
      align-items: center !important;
      background: ${DOCUMENT_PDF_HEADER_BG} !important;
      padding: 0 ${DOCUMENT_PDF_TEXT_PAD_LEFT} !important;
      min-height: ${DOCUMENT_PDF_LINE_HEIGHT_PT}pt !important;
      height: ${DOCUMENT_PDF_LINE_HEIGHT_PT}pt !important;
      font-size: ${DOCUMENT_PDF_FONT_SIZE_PT}pt !important;
      font-weight: 700 !important;
      letter-spacing: 0 !important;
      color: #000000 !important;
      line-height: 1 !important;
      text-transform: none !important;
      border-bottom: ${DOCUMENT_PDF_BORDER} !important;
      box-sizing: border-box !important;
    }
    .quotation-print-area .quotation-pdf-item-box-head span:nth-child(1) {
      text-align: left !important;
    }
    .quotation-print-area .quotation-pdf-item-box-head span:nth-child(2),
    .quotation-print-area .quotation-pdf-item-box-head span:nth-child(3),
    .quotation-print-area .quotation-pdf-item-box-head span:nth-child(4) {
      text-align: right !important;
    }
    .quotation-print-area .quotation-pdf-item-box-row {
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) 52px 70px minmax(100px, max-content) !important;
      align-items: center !important;
      padding: 0 ${DOCUMENT_PDF_TEXT_PAD_LEFT} !important;
      min-height: ${DOCUMENT_PDF_LINE_HEIGHT_PT}pt !important;
      height: ${DOCUMENT_PDF_LINE_HEIGHT_PT}pt !important;
      font-size: ${DOCUMENT_PDF_FONT_SIZE_PT}pt !important;
      line-height: 1 !important;
      color: #000000 !important;
      border-bottom: ${DOCUMENT_PDF_BORDER} !important;
      box-sizing: border-box !important;
    }
    .quotation-print-area .quotation-pdf-item-box-row:last-child {
      border-bottom: none !important;
    }
    .quotation-print-area .quotation-pdf-item-box-desc {
      font-weight: 500 !important;
      min-width: 0 !important;
      word-break: break-word !important;
      padding-right: 8px !important;
      display: flex !important;
      align-items: center !important;
      text-transform: none !important;
    }
    .quotation-print-area .quotation-pdf-item-box-meta {
      white-space: nowrap !important;
      font-size: ${DOCUMENT_PDF_FONT_SIZE_PT}pt !important;
      color: #000000 !important;
      text-align: right !important;
    }
    .quotation-print-area .quotation-pdf-item-box-amount {
      white-space: nowrap !important;
      font-size: ${DOCUMENT_PDF_FONT_SIZE_PT}pt !important;
      color: #000000 !important;
      text-align: right !important;
    }
    .quotation-print-area table.quotation-itemized-costs-table {
      display: none !important;
    }
    .quotation-print-area .quotation-pdf-section > div {
      overflow: visible !important;
    }
    .quotation-print-area .quotation-pdf-notes-body,
    .quotation-print-area .quotation-pdf-notes-body * {
      min-height: 0 !important;
      margin: 0 !important;
      line-height: 1.25 !important;
    }
    .quotation-print-area .quotation-pdf-notes-body {
      padding: 6px ${DOCUMENT_PDF_TEXT_PAD_LEFT} !important;
      overflow: visible !important;
      white-space: pre-wrap !important;
      word-break: break-word !important;
    }
    .quotation-print-area .quotation-pdf-notes-body div {
      white-space: pre-wrap !important;
      word-break: break-word !important;
      overflow: visible !important;
    }

    .quotation-print-area * {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  `;
  clonedDoc.head.appendChild(style);

  area.querySelectorAll('fieldset').forEach((fs) => {
    const el = fs as HTMLElement;
    el.style.setProperty('border', 'none', 'important');
    el.style.setProperty('outline', 'none', 'important');
    el.style.setProperty('box-shadow', 'none', 'important');
    el.style.setProperty('padding', '0', 'important');
    el.style.setProperty('margin', '0', 'important');
  });

  area.querySelectorAll<HTMLElement>('.quotation-pdf-section').forEach((el) => {
    if (el.classList.contains('quotation-pdf-section-customer')) {
      el.style.setProperty('border', 'none', 'important');
      el.style.setProperty('overflow', 'visible', 'important');
      el.style.setProperty('background', 'transparent', 'important');
      el.style.setProperty('padding', '0', 'important');
      el.style.setProperty('margin', '0 0 8px 0', 'important');
    } else if (el.classList.contains('quotation-pdf-section-notes')) {
      applySingleFrameBorder(el);
      el.style.setProperty('overflow', 'hidden', 'important');
      el.style.setProperty('background', '#ffffff', 'important');
    } else {
      el.style.setProperty('border', 'none', 'important');
    }
    el.style.setProperty('border-radius', '0', 'important');
    el.style.setProperty('box-shadow', 'none', 'important');
    el.style.setProperty('margin-bottom', '10px', 'important');
  });
  area.querySelectorAll<HTMLElement>('.quotation-pdf-section-title').forEach((el) => {
    if (el.closest('.quotation-pdf-section-customer')) return;
    el.style.setProperty('background', DOCUMENT_PDF_HEADER_BG, 'important');
    el.style.setProperty('border', 'none', 'important');
    el.style.setProperty('border-bottom', DOCUMENT_PDF_BORDER, 'important');
    el.style.setProperty('border-radius', '0', 'important');
  });
  area.querySelectorAll<HTMLElement>('.quotation-pdf-section-body').forEach((el) => {
    el.style.setProperty('border', 'none', 'important');
  });
  area.querySelectorAll<HTMLElement>('.quotation-pdf-totals').forEach((el) => {
    applySingleFrameBorder(el);
    el.style.setProperty('border-radius', '0', 'important');
    el.style.setProperty('margin', '0', 'important');
    el.style.setProperty('flex', '0 0 auto', 'important');
    el.style.setProperty('width', 'max-content', 'important');
    el.style.setProperty('min-width', `${QUOTATION_PDF_TOTALS_MIN_WIDTH_PX}px`, 'important');
    el.style.setProperty('max-width', 'none', 'important');
    el.style.setProperty('height', 'auto', 'important');
    el.style.setProperty('align-self', 'stretch', 'important');
    el.style.setProperty('justify-self', 'end', 'important');
    el.style.setProperty('display', 'flex', 'important');
    el.style.setProperty('flex-direction', 'column', 'important');
  });

  area.querySelectorAll<HTMLElement>('.quotation-pdf-totals-wrap').forEach((el) => {
    el.style.setProperty('display', 'grid', 'important');
    el.style.setProperty('grid-template-columns', 'minmax(0, 1fr) auto', 'important');
    el.style.setProperty('gap', '12px', 'important');
    el.style.setProperty('align-items', 'stretch', 'important');
    el.style.setProperty('width', '100%', 'important');
    el.style.setProperty('margin', '8px 0 0 0', 'important');
  });
  area.querySelectorAll<HTMLElement>('.quotation-pdf-bank').forEach((el) => {
    applySingleFrameBorder(el);
    el.style.setProperty('margin', '0', 'important');
    el.style.setProperty('width', '100%', 'important');
    el.style.setProperty('max-width', '100%', 'important');
    el.style.setProperty('height', 'auto', 'important');
    el.style.setProperty('align-self', 'stretch', 'important');
    el.style.setProperty('justify-self', 'stretch', 'important');
    el.style.setProperty('min-width', '0', 'important');
    el.style.setProperty('display', 'flex', 'important');
    el.style.setProperty('flex-direction', 'column', 'important');
    el.style.setProperty('justify-content', 'flex-start', 'important');
    el.style.setProperty('align-items', 'flex-start', 'important');
    el.style.setProperty('text-align', 'left', 'important');
    el.style.setProperty('gap', '0', 'important');
    el.style.setProperty('line-height', '1.25', 'important');
    el.querySelectorAll<HTMLElement>('*').forEach((child) => {
      child.style.setProperty('line-height', '1.25', 'important');
      child.style.setProperty('margin-top', '0', 'important');
      child.style.setProperty('margin-bottom', '0', 'important');
    });
    if (getComputedStyle(el).visibility === 'hidden') {
      el.style.setProperty('visibility', 'hidden', 'important');
    }
  });

  syncQuotationPdfBankTotalsHeights(area);

  area.querySelectorAll('.quotation-pdf-company .MuiTypography-caption').forEach((cap) => {
    const t = (cap.textContent || '').trim().toLowerCase();
    if (t === 'company name') (cap as HTMLElement).style.display = 'none';
  });

  area.querySelectorAll('.quotation-pdf-company-address').forEach((el) => {
    const node = el as HTMLElement;
    node.textContent = formatAddressTwoLines(node.textContent || '');
    node.style.setProperty('white-space', 'pre-line', 'important');
    node.style.setProperty('overflow', 'visible', 'important');
    node.style.setProperty('word-break', 'break-word', 'important');
  });

  area.querySelectorAll(
    '.MuiFormHelperText-root, button, .MuiButton-root, .MuiIconButton-root, .MuiAlert-root, .MuiChip-root, .MuiRadio-root, .MuiAutocomplete-endAdornment'
  ).forEach((el) => el.remove());

  const customerSection = area.querySelector('.quotation-pdf-section-customer') as HTMLElement | null;
  let customerRows: Array<Array<{ label: string; value: string; valueColSpan?: number }>> | null = null;
  if (customerSection) {
    const line1 = customerSection.querySelector('.quotation-pdf-customer-line-1');
    const line2 = customerSection.querySelector('.quotation-pdf-customer-line-2');
    const [name, gstRaw, email] = readLineControls(line1);
    const [phone, addressRaw] = readLineControls(line2);
    const gst = !gstRaw || /^GSTIN/i.test(gstRaw) ? '-' : gstRaw;
    const address = formatAddressTwoLines(formatEnglishSentenceLabel(addressRaw) || '-');
    customerRows = [
      [
        { label: 'Name', value: name || '-' },
        { label: 'GST', value: gst },
      ],
      [
        { label: 'Email', value: email || '-' },
        { label: 'Phone', value: phone || '-' },
      ],
      [{ label: 'Address', value: address, valueColSpan: 3 }],
    ];
  }

  const itemized = area.querySelector('table.quotation-itemized-costs-table');
  if (itemized) {
    const section = itemized.closest('.quotation-pdf-section') as HTMLElement | null;
    const wrap = itemized.parentElement as HTMLElement | null;
    const rows: Array<{ desc: string; qty: string; unit: string; amount: string }> = [];

    itemized.querySelectorAll('tbody tr').forEach((tr) => {
      const cells = Array.from(tr.querySelectorAll('td'));
      if (cells.length < 4) return;
      const cellText = (td: Element) => {
      const inp = td.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement | null;
        if (inp) return (inp.value ?? '').trim();
        return (td.textContent || '').replace(/\s+/g, ' ').trim();
      };
      rows.push({
        desc: formatEnglishSentenceLabel(cellText(cells[0])),
        qty: cellText(cells[1]),
        unit: cellText(cells[2]),
        amount: cellText(cells[3])
      });
    });

    if (wrap && rows.length) {
      const boxes = clonedDoc.createElement('div');
      boxes.className = 'quotation-pdf-item-boxes';
      const head = clonedDoc.createElement('div');
      head.className = 'quotation-pdf-item-box-head';
      head.innerHTML =
        '<span>Description</span><span>Qty</span><span>Unit</span><span>Amount</span>';
      boxes.appendChild(head);
      rows.forEach((row) => {
        const rowEl = clonedDoc.createElement('div');
        rowEl.className = 'quotation-pdf-item-box-row';
        rowEl.innerHTML = `
          <div class="quotation-pdf-item-box-desc">${escapeHtmlText(row.desc || '-')}</div>
          <div class="quotation-pdf-item-box-meta">${escapeHtmlText(row.qty || '0')}</div>
          <div class="quotation-pdf-item-box-meta">${escapeHtmlText(row.unit || '0')}</div>
          <div class="quotation-pdf-item-box-amount">${escapeHtmlText(row.amount || '-')}</div>
        `;
        boxes.appendChild(rowEl);
      });
      wrap.insertBefore(boxes, itemized);
      if (section) {
        section.style.setProperty('border', 'none', 'important');
        section.style.setProperty('padding', '0', 'important');
        section.style.setProperty('background', 'transparent', 'important');
      }
      if (wrap) {
        wrap.style.setProperty('border', 'none', 'important');
        wrap.style.setProperty('overflow', 'visible', 'important');
        wrap.style.setProperty('padding', '0', 'important');
        wrap.style.setProperty('margin', '0', 'important');
      }
      applySingleFrameBorder(boxes);
      boxes.style.setProperty('overflow', 'hidden', 'important');
      boxes.style.setProperty('background', '#ffffff', 'important');
      boxes.style.setProperty('padding', '0', 'important');
      boxes.style.setProperty('width', '100%', 'important');
      boxes.style.setProperty('box-sizing', 'border-box', 'important');
    }
    itemized.remove();
  }

  area.querySelectorAll('.MuiFormControl-root').forEach((fc) => {
    if (fc.closest('.quotation-pdf-item-boxes, .quotation-pdf-kv')) return;
    const combobox = fc.querySelector('[role="combobox"]') as HTMLElement | null;
    const ta = fc.querySelector('textarea') as HTMLTextAreaElement | null;
    const inp = fc.querySelector('input:not([type="hidden"])') as HTMLInputElement | null;
    let val = '';
    // Autocomplete: role=combobox 가 <input> 이라 innerText는 비고 value에 표시명이 있다.
    // Select: role=combobox 가 <div> 라 보이는 텍스트는 innerText에 있다.
    if (combobox instanceof HTMLInputElement || combobox instanceof HTMLTextAreaElement) {
      val = combobox.value;
    } else if (combobox) {
      val = combobox.innerText?.trim() ?? combobox.textContent?.trim() ?? '';
    } else if (ta) val = ta.value;
    else if (inp) val = inp.value;
    else return;
    const label = (fc.parentElement?.querySelector('.MuiTypography-caption')?.textContent || '')
      .replace(/\*/g, '')
      .trim();
    if (/^address$/i.test(label)) {
      val = formatEnglishSentenceLabel(val);
    }
    if (fc.closest('.quotation-pdf-notes-body')) {
      val = val.replace(/\r\n/g, '\n').replace(/\n{2,}/g, '\n').trim();
    }
    const div = clonedDoc.createElement('div');
    div.setAttribute('style', plainStyle);
    div.textContent = val;
    fc.innerHTML = '';
    fc.appendChild(div);
  });

  if (customerSection && customerRows) {
    const titleEl = customerSection.querySelector('.quotation-pdf-section-title');
    const titleText = (titleEl?.textContent || 'Customer info').replace(/\s+/g, ' ').trim();
    const body = customerSection.querySelector('.quotation-pdf-section-body');
    const table = createCustomerListTable(clonedDoc, customerRows);
    const block = clonedDoc.createElement('div');
    block.className = 'quotation-pdf-customer-block';
    const titleDiv = clonedDoc.createElement('div');
    titleDiv.className = 'quotation-pdf-customer-title';
    titleDiv.textContent = formatPdfEnglishLabel(titleText);
    block.appendChild(titleDiv);
    block.appendChild(table);
    if (body) body.replaceWith(block);
    else customerSection.appendChild(block);
    titleEl?.remove();
    customerSection.style.setProperty('border', 'none', 'important');
    customerSection.style.setProperty('padding', '0', 'important');
    customerSection.style.setProperty('margin', '0 0 8px 0', 'important');
    customerSection.style.setProperty('overflow', 'visible', 'important');
    customerSection.style.setProperty('background', 'transparent', 'important');
    applySingleFrameBorder(table);
    table.style.setProperty('width', '100%', 'important');
  }

  area.querySelectorAll('.quotation-pdf-notes-body').forEach((body) => {
    const el = body as HTMLElement;
    el.style.setProperty('min-height', '0', 'important');
    el.style.setProperty('overflow', 'visible', 'important');
    el.style.setProperty('white-space', 'pre-wrap', 'important');
    el.style.setProperty('line-height', '1.25', 'important');
    el.querySelectorAll<HTMLElement>('*').forEach((child) => {
      child.style.setProperty('line-height', '1.25', 'important');
      child.style.setProperty('min-height', '0', 'important');
      child.style.setProperty('margin', '0', 'important');
    });
  });

  area.querySelectorAll('.quotation-pdf-section-body').forEach((body) => {
    (body as HTMLElement).style.setProperty('min-height', '0', 'important');
  });

  area.querySelectorAll<HTMLElement>(
    '.quotation-pdf-meta .MuiTypography-caption, .quotation-pdf-section-title, .quotation-pdf-section-body .MuiTypography-caption, .quotation-pdf-bank .MuiTypography-subtitle2, .quotation-pdf-bank .MuiTypography-caption, .quotation-pdf-totals > * > *:first-child, .quotation-pdf-signature .MuiTypography-caption, .quotation-pdf-item-box-head span, .quotation-pdf-company > .MuiTypography-caption'
  ).forEach((el) => {
    if (el.classList.contains('quotation-pdf-company-address')) return;
    const current = el.textContent || '';
    if (/^For\s/i.test(current.trim())) return;
    const next = formatPdfLabelPrefix(current);
    if (next && next !== (el.textContent || '')) el.textContent = next;
  });

  area.querySelectorAll<HTMLElement>('.quotation-pdf-bank .MuiTypography-caption').forEach((el) => {
    const text = el.textContent || '';
    const idx = text.indexOf(':');
    if (idx < 0) return;
    const label = text.slice(0, idx).trim();
    if (!/^bank address$/i.test(label)) return;
    const value = formatEnglishSentenceLabel(text.slice(idx + 1));
    el.textContent = `${formatPdfEnglishLabel(label)}: ${value}`;
  });

  unwrapWebkitBoxClamps(area);
  area.querySelectorAll<HTMLElement>(
    '.quotation-pdf-meta > * > *, .quotation-pdf-items th, .quotation-pdf-items td, .quotation-pdf-item-box-head span, .quotation-pdf-item-box-row > *, .quotation-pdf-totals > * > *'
  ).forEach((el) => wrapForExactVerticalCenter(el, clonedDoc));

  // 헤더 메타 3열 정렬 (Quote # / Date / Valid until) — 하단을 GST 라인에 맞춤
  area.querySelectorAll<HTMLElement>('.quotation-pdf-header').forEach((header) => {
    header.style.setProperty('display', 'flex', 'important');
    header.style.setProperty('align-items', 'stretch', 'important');
    header.style.setProperty('justify-content', 'space-between', 'important');
    header.style.setProperty('gap', '12px', 'important');
    header.style.setProperty('border-bottom', 'none', 'important');
    const company = header.querySelector('.quotation-pdf-company') as HTMLElement | null;
    const right = header.querySelector('.quotation-pdf-header-right') as HTMLElement | null;
    const meta = header.querySelector('.quotation-pdf-meta') as HTMLElement | null;
    const title = header.querySelector('.quotation-pdf-title') as HTMLElement | null;
    if (!company || !right || !meta) return;

    applySingleFrameBorder(meta);
    right.style.setProperty('display', 'flex', 'important');
    right.style.setProperty('flex-direction', 'column', 'important');
    right.style.setProperty('align-self', 'stretch', 'important');
    right.style.setProperty('overflow', 'hidden', 'important');
    meta.style.setProperty('display', 'flex', 'important');
    meta.style.setProperty('flex-direction', 'column', 'important');
    meta.style.setProperty('flex', '0 0 auto', 'important');
    meta.style.setProperty('margin-top', '0', 'important');
    meta.style.setProperty('width', '100%', 'important');
    meta.style.setProperty('max-width', '100%', 'important');
    meta.style.setProperty('height', 'auto', 'important');
    if (title) title.style.setProperty('margin', '0', 'important');
    let spacer = right.querySelector('.quotation-pdf-header-spacer') as HTMLElement | null;
    if (!spacer && title) {
      spacer = clonedDoc.createElement('div');
      spacer.className = 'quotation-pdf-header-spacer';
      title.insertAdjacentElement('afterend', spacer);
    }
    if (spacer) {
      spacer.style.setProperty('flex', '1 1 auto', 'important');
      spacer.style.setProperty('min-height', '14px', 'important');
    }

    const validLabel = meta.querySelector('.quotation-pdf-meta-valid-label') as HTMLElement | null;
    const validValue = meta.querySelector('.quotation-pdf-meta-valid-value') as HTMLElement | null;
    const headerRow = meta.children[0] as HTMLElement | undefined;
    const valueRow = meta.children[1] as HTMLElement | undefined;
    if (headerRow && validLabel && validLabel.parentElement !== headerRow) {
      headerRow.appendChild(validLabel);
    }
    if (valueRow && validValue && validValue.parentElement !== valueRow) {
      valueRow.appendChild(validValue);
    }
    Array.from(meta.children).forEach((row, index) => {
      if (index >= 2) row.remove();
    });
    const metaCols = 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)';
    meta.style.setProperty('--quotation-meta-cols', metaCols);
    meta.querySelectorAll<HTMLElement>(':scope > *').forEach((row) => {
      row.style.setProperty('display', 'grid', 'important');
      row.style.setProperty('grid-template-columns', metaCols, 'important');
      row.style.setProperty('min-width', '0', 'important');
    });
    meta.querySelectorAll<HTMLElement>(':scope > * > *').forEach((cell) => {
      cell.style.setProperty('justify-content', 'center', 'important');
      cell.style.setProperty('text-align', 'center', 'important');
      cell.style.setProperty('font-size', `${DOCUMENT_PDF_FONT_SIZE_PT}pt`, 'important');
    });
    meta.querySelectorAll<HTMLElement>(':scope > *').forEach((row, rowIndex) => {
      Array.from(row.children).forEach((cell) => {
        flattenMetaCellText(cell as HTMLElement, clonedDoc, rowIndex === 0);
      });
    });
  });

  // 텍스트 완전 검정
  area.querySelectorAll<HTMLElement>('*').forEach((el) => {
    el.style.setProperty('color', '#000000', 'important');
    el.style.setProperty('-webkit-text-fill-color', '#000000', 'important');
  });
  area.querySelectorAll<HTMLElement>('.quotation-pdf-stamp, .quotation-pdf-signature img').forEach((el) => {
    el.style.setProperty('width', '3.5cm', 'important');
    el.style.setProperty('max-width', '3.5cm', 'important');
    el.style.setProperty('height', 'auto', 'important');
    el.style.setProperty('max-height', '1.8cm', 'important');
    el.style.setProperty('object-fit', 'contain', 'important');
  });
  area.querySelectorAll<HTMLElement>('.quotation-pdf-signature').forEach((el) => {
    el.style.setProperty('width', '100%', 'important');
    el.style.setProperty('height', 'auto', 'important');
    el.style.setProperty('display', 'grid', 'important');
    el.style.setProperty('grid-template-columns', '1fr 1fr', 'important');
    el.style.setProperty('border-bottom', 'none', 'important');
  });
}

function countItemizedRows(element: HTMLElement): number {
  const rows = element.querySelectorAll('.quotation-pdf-item-box-row');
  if (rows.length) return rows.length;
  const boxes = element.querySelectorAll('.quotation-pdf-item-box');
  if (boxes.length) return boxes.length;
  const table = element.querySelector('table.quotation-itemized-costs-table');
  if (!table) return 0;
  return table.querySelectorAll('tbody tr').length;
}

/**
 * 견적서 DOM 영역을 캡처해 A4 PDF로 저장합니다. (승인 후 저장 등)
 * 문서 PDF 표준 파이프라인(downloadDocumentPdf) 사용.
 */
export async function downloadQuotationPdf(element: HTMLElement, filename: string): Promise<void> {
  const itemCount = countItemizedRows(element);
  await downloadDocumentPdf({
    element,
    filename: ensurePdfExtension(filename),
    margins: DOCUMENT_PDF_MARGINS_MM,
    purpose: 'download',
    itemCount,
    fitOnePageItemThreshold: FIT_ONE_PAGE_ITEM_THRESHOLD,
    captureRootAttr: DOCUMENT_PDF_CAPTURE_ROOT_ATTR,
    onClone: (clonedDoc) => {
      const area = resolvePdfCaptureRoot(clonedDoc);
      if (area) {
        const fs = area.querySelector('fieldset');
        if (fs) fs.removeAttribute('disabled');
      }
      sanitizeQuotationCloneForPdf(clonedDoc);
    },
  });
}

/** 메일 첨부용 — 용량을 줄인 PDF를 base64(순수 페이로드)로 반환 (Gmail 등 메일 크기 제한 대응) */
export async function quotationPdfToBase64(element: HTMLElement): Promise<string> {
  const itemCount = countItemizedRows(element);
  return documentPdfToBase64({
    element,
    margins: DOCUMENT_PDF_MARGINS_MM,
    purpose: 'email',
    itemCount,
    fitOnePageItemThreshold: FIT_ONE_PAGE_ITEM_THRESHOLD,
    captureRootAttr: DOCUMENT_PDF_CAPTURE_ROOT_ATTR,
    onClone: (clonedDoc) => {
      const area = resolvePdfCaptureRoot(clonedDoc);
      if (area) {
        const fs = area.querySelector('fieldset');
        if (fs) fs.removeAttribute('disabled');
      }
      sanitizeQuotationCloneForPdf(clonedDoc);
    },
  });
}

function sanitizePdfFilenamePart(value: string, maxLen = 80): string {
  return sanitizeFilenamePart(String(value || ''), { fallback: '', maxLength: maxLen });
}

const PDF_FILENAME_DETAIL_MAX = 15;

function buildFilenameDetailFromItems(
  items?: Array<{ productName?: string | null; description?: string | null }> | null
): string {
  if (!items?.length) return '';
  const parts = items
    .map((it) => String(it.productName || it.description || '').trim())
    .filter(Boolean);
  if (!parts.length) return '';
  return sanitizePdfFilenamePart(parts.join(', '), PDF_FILENAME_DETAIL_MAX);
}

/**
 * 예: 20260816_Quot (Test Corporation) (computer, mou).pdf
 * 설명(detail)은 품목명으로 구성하며 최대 15자.
 */
export function buildQuotationPdfFilename(opts: {
  companyName?: string | null;
  items?: Array<{ productName?: string | null; description?: string | null }> | null;
  /** @deprecated 품목 기반 detail 우선. 없을 때만 사용 */
  detail?: string | null;
  quotationNumber?: string | null;
  date?: Date;
  /** 발행 견적 Quot(기본) / 받은 견적 RQuot */
  code?: 'Quot' | 'RQuot';
}): string {
  const detail =
    buildFilenameDetailFromItems(opts.items) ||
    sanitizePdfFilenamePart(opts.detail || '', PDF_FILENAME_DETAIL_MAX) ||
    sanitizePdfFilenamePart(opts.quotationNumber || '', PDF_FILENAME_DETAIL_MAX) ||
    'Quotation';
  return buildDocumentDownloadFilename({
    code: opts.code || 'Quot',
    companyName: opts.companyName,
    detail,
    date: opts.date,
    detailMaxLength: PDF_FILENAME_DETAIL_MAX,
  });
}
