/**
 * 견적서 메일용: 법인 접미어 제거, PDF 생성(pdfkit)
 */
import {
  DOCUMENT_PDF_FONT_SIZE_PT,
  DOCUMENT_PDF_LINE_GAP_PT,
  DOCUMENT_PDF_MARGINS_PT,
  DOCUMENT_PDF_TITLE_FONT_SIZE_PT,
  getPdfKitContentWidth,
} from './documentPdfStandard';

/** 메일 제목용 — Private Limited 등 법인 접미어 제거 */
export function stripLegalEntitySuffixesForSubject(name: string): string {
  if (!name || typeof name !== 'string') return '';
  let s = name.trim();
  const patterns = [
    /\s*,?\s*Private\s+Limited\.?$/i,
    /\s*,?\s*PRIVATE\s+LIMITED\.?$/i,
    /\s*,?\s*PVT\.?\s*LTD\.?$/i,
    /\s*,?\s*PVT\.?\s*LIMITED\.?$/i,
    /\s*,?\s*\(P\)\s*Ltd\.?$/i,
    /\s*,?\s*PTE\.?\s*LTD\.?$/i,
    /\s*,?\s*Proprietary\s+Limited\.?$/i,
    /\s*,?\s*Limited\.?$/i,
    /\s*,?\s*LTD\.?$/i,
    /\s*,?\s*LLP\.?$/i,
    /\s*,?\s*LLC\.?$/i,
    /\s*,?\s*INC\.?$/i
  ];
  let prev = '';
  while (prev !== s) {
    prev = s;
    for (const re of patterns) {
      s = s.replace(re, '').trim();
    }
  }
  s = s.replace(/\s+/g, ' ').trim();
  return s || name.trim();
}

export function toTitleCaseWords(s: string): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ')
    .trim();
}

export function getCompanyAbbreviationForMail(settings: unknown, _companyName: string): string {
  const g = (settings as Record<string, unknown> | null | undefined)?.general as
    | { companyAbbreviation?: string }
    | undefined;
  const raw = String(g?.companyAbbreviation ?? '').trim();
  if (raw) return raw.toUpperCase().slice(0, 16);
  const env = process.env.MAIL_COMPANY_ABBREV?.trim();
  if (env) return env.slice(0, 16);
  return 'MVS';
}

type ItemRow = {
  productName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  finalPrice: number;
};

function normalizeItems(raw: unknown): ItemRow[] {
  let arr: any[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) arr = p;
    } catch {
      arr = [];
    }
  }
  return arr.map((row, idx) => ({
    productName: String(row.productName ?? row.product_name ?? ''),
    description: String(row.description ?? ''),
    quantity: Number(row.quantity) || 0,
    unitPrice: Number(row.unitPrice ?? row.unit_price) || 0,
    finalPrice: Number(row.finalPrice ?? row.final_price ?? row.totalPrice ?? row.total_price) || 0
  }));
}

/** 서버 생성 견적 PDF (영문 레이아웃) */
export async function buildQuotationPdfBuffer(quotation: {
  quotation_number: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  customer_gst?: string;
  items?: unknown;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount: number;
  total_amount: number;
  currency: string;
  valid_until?: Date | string | null;
  notes?: string | null;
  terms?: string | null;
  created_at?: Date | string | null;
}): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PDFDocument = require('pdfkit');

  const items = normalizeItems(quotation.items);
  const cur = String(quotation.currency || 'INR');
  const validUntil = quotation.valid_until
    ? String(quotation.valid_until).split('T')[0]
    : '—';
  const issueDate = quotation.created_at
    ? String(quotation.created_at).split('T')[0]
    : new Date().toISOString().split('T')[0];

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margins: DOCUMENT_PDF_MARGINS_PT, size: 'A4' });
    const contentW = getPdfKitContentWidth(doc.page.width);
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(DOCUMENT_PDF_TITLE_FONT_SIZE_PT).text('QUOTATION', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(DOCUMENT_PDF_FONT_SIZE_PT).fillColor('#444').text(`Quotation No. ${quotation.quotation_number}`, { align: 'center', lineGap: DOCUMENT_PDF_LINE_GAP_PT });
    doc.fillColor('#000');
    doc.moveDown(1.2);

    doc.fontSize(DOCUMENT_PDF_FONT_SIZE_PT);
    doc.text(`Issue date: ${issueDate}`, { continued: false });
    doc.text(`Valid until: ${validUntil}`);
    doc.moveDown(0.8);

    doc.fontSize(DOCUMENT_PDF_FONT_SIZE_PT).text('Bill to', { underline: true });
    doc.fontSize(DOCUMENT_PDF_FONT_SIZE_PT).moveDown(0.3);
    doc.text(quotation.customer_name || '—');
    if (quotation.customer_address) doc.text(String(quotation.customer_address));
    if (quotation.customer_email) doc.text(`Email: ${quotation.customer_email}`);
    if (quotation.customer_phone) doc.text(`Phone: ${quotation.customer_phone}`);
    if (quotation.customer_gst) doc.text(`GST: ${quotation.customer_gst}`);
    doc.moveDown(0.9);

    doc.fontSize(DOCUMENT_PDF_FONT_SIZE_PT).text('Line items', { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(DOCUMENT_PDF_FONT_SIZE_PT);

    items.forEach((it, i) => {
      const line = [it.productName, it.description].filter(Boolean).join(' — ') || 'Item';
      doc.text(
        `${i + 1}. ${line}\n   Qty: ${it.quantity}   Unit: ${cur} ${it.unitPrice.toLocaleString('en-IN', {
          minimumFractionDigits: 2
        })}   Line total: ${cur} ${it.finalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        { width: contentW, lineGap: DOCUMENT_PDF_LINE_GAP_PT }
      );
      doc.moveDown(0.35);
    });

    if (items.length === 0) {
      doc.text('(No line items)', { width: contentW });
    }

    doc.moveDown(0.6);
    doc.fontSize(DOCUMENT_PDF_FONT_SIZE_PT);
    doc.text(`Subtotal: ${cur} ${quotation.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, {
      align: 'right'
    });
    doc.text(
      `Tax (${quotation.tax_rate}%): ${cur} ${quotation.tax_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      { align: 'right' }
    );
    doc.text(
      `Discount: ${cur} ${quotation.discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      { align: 'right' }
    );
    doc.fontSize(DOCUMENT_PDF_FONT_SIZE_PT).text(
      `Total: ${cur} ${quotation.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      { align: 'right' }
    );
    doc.fontSize(DOCUMENT_PDF_FONT_SIZE_PT);
    doc.moveDown(1);

    if (quotation.notes) {
      doc.text('Notes', { underline: true });
      doc.fontSize(DOCUMENT_PDF_FONT_SIZE_PT).text(String(quotation.notes), { align: 'left', lineGap: DOCUMENT_PDF_LINE_GAP_PT });
      doc.moveDown(0.6);
    }
    if (quotation.terms) {
      doc.fontSize(DOCUMENT_PDF_FONT_SIZE_PT).text('Terms & conditions', { underline: true });
      doc.fontSize(DOCUMENT_PDF_FONT_SIZE_PT).text(String(quotation.terms), { align: 'left', lineGap: DOCUMENT_PDF_LINE_GAP_PT });
    }

    doc.fontSize(DOCUMENT_PDF_FONT_SIZE_PT).fillColor('#666').text(
      'This document was generated electronically and is valid without a signature unless otherwise agreed.',
      DOCUMENT_PDF_MARGINS_PT.left,
      doc.page.height - DOCUMENT_PDF_MARGINS_PT.bottom - DOCUMENT_PDF_FONT_SIZE_PT,
      { align: 'center', width: contentW }
    );

    doc.end();
  });
}
