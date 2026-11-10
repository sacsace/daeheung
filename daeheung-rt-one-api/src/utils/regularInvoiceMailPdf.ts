/**
 * 일반 세금계산서 메일 첨부용 — pdfkit 텍스트/벡터 PDF (클라이언트 html2canvas 경로와 무관)
 */
import {
  DOCUMENT_PDF_FONT_SIZE_PT,
  DOCUMENT_PDF_LINE_GAP_PT,
  DOCUMENT_PDF_MARGINS_PT,
  DOCUMENT_PDF_TITLE_FONT_SIZE_PT,
  getPdfKitContentWidth,
} from './documentPdfStandard';

export type RegularInvoiceMailItem = {
  item_name: string;
  description?: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  tax_rate?: number;
  tax_amount?: number;
};

/** 고객용 PDF에 시스템/삭제 요청 등 내부 메모가 나가지 않도록 정리 */
export function sanitizeInvoiceNotesForPdf(notes: string | null | undefined): string | null {
  if (notes == null || String(notes).trim() === '') return null;
  const lines = String(notes).split(/\r?\n/);
  const kept = lines
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !/\[DELETE_REQUEST\]/i.test(l));
  const out = kept.join('\n').trim();
  return out.length > 0 ? out : null;
}

export async function buildRegularInvoicePdfBuffer(params: {
  companyName: string;
  companyAddress?: string | null;
  companyGstin?: string | null;
  /** 문서 상단 제목 — 기본 TAX INVOICE, 프로포마는 PROFORMA INVOICE */
  documentTitle?: string;
  invoice: {
    invoice_number: string;
    invoice_date: string | Date;
    due_date: string | Date;
    subtotal: number;
    tax_amount: number;
    total_amount: number;
    notes?: string | null;
  };
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  customerGstin?: string | null;
  items: RegularInvoiceMailItem[];
  currency: string;
}): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PDFDocument = require('pdfkit');

  const cur = String(params.currency || 'INR').trim() || 'INR';
  const inv = params.invoice;
  const sub = Number(inv.subtotal) || 0;
  const tax = Number(inv.tax_amount) || 0;
  const total = Number(inv.total_amount) || 0;
  const impliedTaxPct = sub > 0 ? (tax / sub) * 100 : 0;

  const issueDate = inv.invoice_date ? String(inv.invoice_date).split('T')[0] : '—';
  const dueDate = inv.due_date ? String(inv.due_date).split('T')[0] : '—';

  const items = (params.items || []).filter((it) => it && (Number(it.quantity) !== 0 || Number(it.total_price) !== 0));

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margins: DOCUMENT_PDF_MARGINS_PT, size: 'A4' });
    const contentW = getPdfKitContentWidth(doc.page.width);
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const docTitle = (params.documentTitle && String(params.documentTitle).trim()) || 'TAX INVOICE';
    doc.fontSize(DOCUMENT_PDF_TITLE_FONT_SIZE_PT).text(docTitle, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(DOCUMENT_PDF_FONT_SIZE_PT).fillColor('#444').text(`Invoice No. ${inv.invoice_number}`, { align: 'center', lineGap: DOCUMENT_PDF_LINE_GAP_PT });
    doc.fillColor('#000');
    doc.moveDown(1);

    doc.fontSize(DOCUMENT_PDF_FONT_SIZE_PT);
    doc.text(`From: ${params.companyName || '—'}`);
    if (params.companyAddress) doc.text(String(params.companyAddress));
    if (params.companyGstin) doc.text(`GSTIN: ${params.companyGstin}`);
    doc.moveDown(0.8);

    doc.text(`Invoice date: ${issueDate}`);
    doc.text(`Due date: ${dueDate}`);
    doc.moveDown(0.8);

    doc.fontSize(DOCUMENT_PDF_FONT_SIZE_PT).text('Bill to', { underline: true });
    doc.fontSize(DOCUMENT_PDF_FONT_SIZE_PT).moveDown(0.3);
    doc.text(params.customerName || '—');
    if (params.customerAddress) doc.text(String(params.customerAddress));
    if (params.customerEmail) doc.text(`Email: ${params.customerEmail}`);
    if (params.customerPhone) doc.text(`Phone: ${params.customerPhone}`);
    if (params.customerGstin) doc.text(`GSTIN: ${params.customerGstin}`);
    doc.moveDown(0.9);

    doc.fontSize(DOCUMENT_PDF_FONT_SIZE_PT).text('Line items', { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(DOCUMENT_PDF_FONT_SIZE_PT);

    items.forEach((it, i) => {
      const line = [it.item_name, it.description].filter(Boolean).join(' — ') || 'Item';
      const qty = Number(it.quantity) || 0;
      const up = Number(it.unit_price) || 0;
      const lineTot = Number(it.total_price) || 0;
      doc.text(
        `${i + 1}. ${line}\n   Qty: ${qty}   Unit: ${cur} ${up.toLocaleString('en-IN', { minimumFractionDigits: 2 })}   Line total: ${cur} ${lineTot.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        { width: contentW, lineGap: DOCUMENT_PDF_LINE_GAP_PT }
      );
      doc.moveDown(0.35);
    });

    if (items.length === 0) {
      doc.text('(No line items)', { width: contentW });
    }

    doc.moveDown(0.6);
    doc.fontSize(DOCUMENT_PDF_FONT_SIZE_PT);
    doc.text(`Subtotal: ${cur} ${sub.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, { align: 'right' });
    // PDFKit 기본 Helvetica는 ≈(U+2248) 등 일부 유니코드를 깨뜨리므로 ASCII만 사용
    const taxLabel =
      impliedTaxPct > 0 && impliedTaxPct < 100
        ? `Tax (${impliedTaxPct.toFixed(2)}%): ${cur} ${tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
        : `Tax: ${cur} ${tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    doc.text(taxLabel, { align: 'right' });
    doc.fontSize(DOCUMENT_PDF_FONT_SIZE_PT).text(`Total: ${cur} ${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, {
      align: 'right'
    });
    doc.fontSize(DOCUMENT_PDF_FONT_SIZE_PT);
    doc.moveDown(1);

    const notesForPdf = sanitizeInvoiceNotesForPdf(inv.notes);
    if (notesForPdf) {
      doc.text('Notes', { underline: true });
      doc.fontSize(DOCUMENT_PDF_FONT_SIZE_PT).text(notesForPdf, { align: 'left', lineGap: DOCUMENT_PDF_LINE_GAP_PT });
      doc.moveDown(0.6);
    }

    doc.moveDown(0.8);
    doc.fontSize(DOCUMENT_PDF_FONT_SIZE_PT).fillColor('#666').text(
      'This document was generated electronically and is valid without a signature unless otherwise agreed.',
      { align: 'center', width: contentW }
    );

    doc.end();
  });
}
