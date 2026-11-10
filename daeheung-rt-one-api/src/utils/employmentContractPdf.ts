/**
 * 전자근로계약 서명본 PDF — Unicode 폰트 + 계약서형 레이아웃
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ensureUploadSubdir } from './uploadPath';
import {
  DOCUMENT_PDF_FONT_SIZE_PT,
  DOCUMENT_PDF_LINE_GAP_PT,
  DOCUMENT_PDF_MARGINS_PT,
} from './documentPdfStandard';

const TITLE_KO_TO_EN: Record<string, string> = {
  '고용 계약서': 'Employment Contract',
  '수습 고용 계약서': 'Probationary Employment Contract',
  '연봉 조정 계약서': 'Salary Adjustment Agreement',
};

const STATUS_EN: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  in_review: 'Under Review',
  rejected: 'Rejected',
  awaiting_company_sign: 'Awaiting Company Signature',
  awaiting_employee_sign: 'Awaiting Employee Signature',
  signed: 'Signed',
  active: 'Active',
  expired: 'Expired',
  terminated: 'Terminated',
};

function toEnglishTitle(title?: string | null): string {
  const raw = String(title || '').trim();
  if (!raw) return 'Employment Contract';
  return TITLE_KO_TO_EN[raw] || raw;
}

function statusLabel(status?: string | null): string {
  const key = String(status || '').trim().toLowerCase();
  return STATUS_EN[key] || key.replace(/_/g, ' ') || '-';
}

function formatSignMethodLabel(method?: string | null): string {
  const m = String(method || '').toLowerCase();
  if (m === 'aadhaar_esign') return 'Aadhaar eSign';
  if (m === 'internal_ack') return 'Internal Acknowledgement';
  return method || '-';
}

function parseSignatureMeta(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, any>;
  try {
    return JSON.parse(String(raw));
  } catch {
    return {};
  }
}

/** Date/locale 문자열에서 한글·비ASCII 깨짐 방지 — UTC ASCII만 출력 */
export function formatPdfDateTime(value: unknown): string {
  if (value == null || value === '') return '-';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    return (
      String(value)
        .replace(/[^\x20-\x7E]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || '-'
    );
  }
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss} UTC`;
}

export function formatPdfDateOnly(value: unknown): string {
  if (value == null || value === '') return '-';
  const s = String(value);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.replace(/[^\x20-\x7E]/g, '').trim() || '-';
  return formatPdfDateTime(d).slice(0, 10);
}

function stripHtmlToText(html: string): string {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function resolveUnicodeFontPaths(): { regular: string | null; bold: string | null } {
  const envRegular = process.env.EMP_CONTRACT_PDF_FONT_PATH?.trim();
  const envBold = process.env.EMP_CONTRACT_PDF_FONT_BOLD_PATH?.trim();
  if (envRegular && fs.existsSync(envRegular)) {
    return {
      regular: envRegular,
      bold: envBold && fs.existsSync(envBold) ? envBold : envRegular,
    };
  }

  const candidatesRegular = [
    path.join(process.cwd(), 'assets', 'fonts', 'NotoSansKR-Regular.otf'),
    path.join(process.cwd(), 'assets', 'fonts', 'NotoSansKR-Regular.ttf'),
    path.join(__dirname, '..', '..', 'assets', 'fonts', 'NotoSansKR-Regular.otf'),
    'C:\\Windows\\Fonts\\malgun.ttf',
    '/usr/share/fonts/truetype/noto/NotoSansKR-Regular.ttf',
    '/usr/share/fonts/opentype/noto/NotoSansKR-Regular.otf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  ];
  const candidatesBold = [
    path.join(process.cwd(), 'assets', 'fonts', 'NotoSansKR-Bold.otf'),
    path.join(process.cwd(), 'assets', 'fonts', 'NotoSansKR-Bold.ttf'),
    path.join(__dirname, '..', '..', 'assets', 'fonts', 'NotoSansKR-Bold.otf'),
    'C:\\Windows\\Fonts\\malgunbd.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
  ];

  const regular = candidatesRegular.find((p) => fs.existsSync(p)) || null;
  const bold = candidatesBold.find((p) => fs.existsSync(p)) || regular;
  return { regular, bold };
}

function drawHLine(doc: any, y: number, x0: number, x1: number, color = '#1F2937') {
  doc.save();
  doc.strokeColor(color).lineWidth(1).moveTo(x0, y).lineTo(x1, y).stroke();
  doc.restore();
}

export type EmploymentContractPdfInput = {
  contract: any;
  signerType: 'company' | 'employee';
  signerId: number;
  signatures?: any[];
};

export async function createEmploymentContractPdfFile(
  input: EmploymentContractPdfInput
): Promise<{ pdfUrl: string; hashSha256: string }> {
  const { contract, signerType, signerId, signatures = [] } = input;
  const targetDir = ensureUploadSubdir('contracts', 'employment');
  await fs.promises.mkdir(targetDir, { recursive: true });

  const fileName = `employment-contract-${contract.id}-${Date.now()}.pdf`;
  const filePath = path.join(targetDir, fileName);

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({
    margins: DOCUMENT_PDF_MARGINS_PT,
    size: 'A4',
    bufferPages: true,
    info: {
      Title: toEnglishTitle(contract.title),
      Author: String(contract.company?.name || 'MVS'),
      Subject: 'Signed Employment Contract',
    },
  });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const fonts = resolveUnicodeFontPaths();
  const FONT_R = 'EmpContractRegular';
  const FONT_B = 'EmpContractBold';
  let hasUnicodeFont = false;
  if (fonts.regular) {
    try {
      doc.registerFont(FONT_R, fonts.regular);
      doc.registerFont(FONT_B, fonts.bold || fonts.regular);
      hasUnicodeFont = true;
    } catch (err) {
      console.warn('[employmentContractPdf] font register failed:', (err as Error)?.message || err);
    }
  } else {
    console.warn(
      '[employmentContractPdf] No Unicode font found. Set EMP_CONTRACT_PDF_FONT_PATH or install Malgun/Noto.'
    );
  }

  const useRegular = () => {
    if (hasUnicodeFont) doc.font(FONT_R);
    else doc.font('Helvetica');
  };
  const useBold = () => {
    if (hasUnicodeFont) doc.font(FONT_B);
    else doc.font('Helvetica-Bold');
  };

  const pageW = doc.page.width;
  const left = doc.page.margins.left;
  const right = pageW - doc.page.margins.right;
  const contentW = right - left;

  const companyName = String(contract.company?.name || 'Company');
  const employeeName = String(contract.employee?.username || `Employee #${contract.employee_id || '-'}`);
  const approverName = String(
    contract.approver?.username || (contract.approver_id ? `User #${contract.approver_id}` : '-')
  );
  const titleEn = toEnglishTitle(contract.title);
  const issueDate = formatPdfDateOnly(
    contract.approved_at || contract.employee_signed_at || contract.updated_at || new Date()
  );

  // Header band
  doc.save();
  doc.rect(0, 0, pageW, 92).fill('#0F3D68');
  doc.restore();

  useBold();
  doc.fillColor('#FFFFFF').fontSize(11).text(companyName.toUpperCase(), left, 22, {
    width: contentW,
    align: 'center',
  });
  useBold();
  doc.fontSize(18).text('EMPLOYMENT CONTRACT', left, 42, { width: contentW, align: 'center' });
  useRegular();
  doc.fontSize(10).fillColor('#D6E4F0').text(titleEn, left, 66, { width: contentW, align: 'center' });

  doc.y = 110;
  doc.fillColor('#111827');

  useBold();
  doc.fontSize(9).fillColor('#6B7280').text('CONTRACT NO.', left, doc.y);
  const metaY = doc.y;
  doc.text('DATE OF ISSUE', left + contentW / 2, metaY);
  useBold();
  doc.fillColor('#111827').fontSize(11);
  doc.text(String(contract.id), left, metaY + 12);
  doc.text(issueDate, left + contentW / 2, metaY + 12);
  doc.y = metaY + 36;
  drawHLine(doc, doc.y, left, right, '#D1D5DB');
  doc.y += 14;

  // Parties
  const partiesTop = doc.y;
  const partiesH = 78;
  doc.save();
  doc.lineWidth(1).fillColor('#F8FAFC').strokeColor('#CBD5E1');
  doc.rect(left, partiesTop, contentW, partiesH).fillAndStroke();
  doc.restore();

  useBold();
  doc.fillColor('#0F3D68').fontSize(10).text('PARTIES', left + 12, partiesTop + 10);
  useRegular();
  doc.fillColor('#111827').fontSize(10);
  const col1 = left + 12;
  const col2 = left + contentW / 2 + 8;
  doc.text('Employer (Company)', col1, partiesTop + 28);
  useBold();
  doc.text(companyName, col1, partiesTop + 42, { width: contentW / 2 - 24 });
  useRegular();
  doc.fontSize(10).text('Employee', col2, partiesTop + 28);
  useBold();
  doc.text(employeeName, col2, partiesTop + 42, { width: contentW / 2 - 24 });
  doc.y = partiesTop + partiesH + 16;

  // Key terms
  useBold();
  doc.fillColor('#0F3D68').fontSize(11).text('KEY TERMS', left, doc.y);
  doc.y += 8;
  drawHLine(doc, doc.y, left, right, '#0F3D68');
  doc.y += 10;

  const rows: Array<[string, string]> = [
    ['Approver', approverName],
    ['Status', statusLabel(contract.status)],
    [
      'Contract Period',
      `${formatPdfDateOnly(contract.start_date)}  to  ${formatPdfDateOnly(contract.end_date)}`,
    ],
    ['Salary / CTC', contract.salary != null && contract.salary !== '' ? String(contract.salary) : '-'],
    [
      'Bonus',
      `${contract.bonus_type || '-'} ${
        contract.bonus_value != null && contract.bonus_value !== '' ? contract.bonus_value : ''
      }`.trim(),
    ],
    ['Working Days', String(contract.working_days || '-')],
    ['Working Hours', String(contract.working_hours || '-')],
    ['Work Location', String(contract.work_location || '-')],
  ];

  const labelW = 130;
  for (const [label, value] of rows) {
    const rowTop = doc.y;
    useBold();
    doc.fillColor('#374151').fontSize(DOCUMENT_PDF_FONT_SIZE_PT).text(label, left, rowTop, { width: labelW });
    useRegular();
    doc.fillColor('#111827').fontSize(DOCUMENT_PDF_FONT_SIZE_PT).text(String(value || '-'), left + labelW, rowTop, {
      width: contentW - labelW,
    });
    doc.y = Math.max(doc.y, rowTop + 16);
    drawHLine(doc, doc.y, left, right, '#E5E7EB');
    doc.y += 6;
  }

  doc.y += 8;

  const bodyText = stripHtmlToText(contract.rendered_content_html || '');
  useBold();
  doc.fillColor('#0F3D68').fontSize(11).text('CONTRACT BODY', left, doc.y);
  doc.y += 8;
  drawHLine(doc, doc.y, left, right, '#0F3D68');
  doc.y += 10;

  useRegular();
  doc.fillColor('#1F2937').fontSize(DOCUMENT_PDF_FONT_SIZE_PT);
  if (bodyText) {
    doc.text(bodyText, left, doc.y, { width: contentW, align: 'justify', lineGap: DOCUMENT_PDF_LINE_GAP_PT });
  } else {
    doc.text('No contract body content was registered.', left, doc.y, { width: contentW });
  }

  doc.moveDown(1.2);

  const sigBlockH = 150;
  if (doc.y + sigBlockH > doc.page.height - doc.page.margins.bottom - 40) {
    doc.addPage();
  }

  useBold();
  doc.fillColor('#0F3D68').fontSize(11).text('SIGNATURES', left, doc.y);
  doc.y += 8;
  drawHLine(doc, doc.y, left, right, '#0F3D68');
  doc.y += 12;

  const signRows = Array.isArray(signatures) ? signatures : [];
  const companySign = signRows.find((s) => String(s.signer_type || '').toLowerCase() === 'company');
  const employeeSign = signRows.find((s) => String(s.signer_type || '').toLowerCase() === 'employee');

  const boxGap = 16;
  const boxW = (contentW - boxGap) / 2;
  const boxY = doc.y;
  const boxH = 128;

  const drawSignBox = (x: number, role: string, sign: any | undefined, fallbackName: string) => {
    doc.save();
    doc.lineWidth(1).fillColor('#FFFFFF').strokeColor('#94A3B8');
    doc.rect(x, boxY, boxW, boxH).fillAndStroke();
    doc.fillColor('#0F3D68').rect(x, boxY, boxW, 22).fill();
    doc.restore();

    useBold();
    doc.fillColor('#FFFFFF').fontSize(9).text(role, x + 10, boxY + 6, { width: boxW - 20 });

    const meta = parseSignatureMeta(sign?.signature_data);
    const name = sign?.signer?.username || fallbackName;
    const signedAt = sign ? formatPdfDateTime(sign.signed_at) : 'Not signed';
    const method = sign ? formatSignMethodLabel(sign.sign_method) : '-';

    useRegular();
    doc.fillColor('#111827').fontSize(9);
    let ty = boxY + 32;
    doc.text(`Name: ${name}`, x + 10, ty, { width: boxW - 20 });
    ty += 16;
    doc.text(`Signed at: ${signedAt}`, x + 10, ty, { width: boxW - 20 });
    ty += 16;
    doc.text(`Method: ${method}`, x + 10, ty, { width: boxW - 20 });
    ty += 16;
    if (sign?.sign_ip) {
      doc.text(`IP: ${String(sign.sign_ip)}`, x + 10, ty, { width: boxW - 20 });
      ty += 16;
    }
    if (String(sign?.sign_method || '').toLowerCase() === 'aadhaar_esign') {
      if (meta.aadhaar_last4) {
        doc.text(`Aadhaar (last 4): ****${meta.aadhaar_last4}`, x + 10, ty, { width: boxW - 20 });
        ty += 14;
      }
      if (meta.auth_reference) {
        doc.text(`Auth ref: ${String(meta.auth_reference)}`, x + 10, ty, { width: boxW - 20 });
      }
    }

    doc.save();
    doc
      .strokeColor('#64748B')
      .lineWidth(0.8)
      .moveTo(x + 10, boxY + boxH - 18)
      .lineTo(x + boxW - 10, boxY + boxH - 18)
      .stroke();
    doc.restore();
    useRegular();
    doc.fillColor('#6B7280').fontSize(8).text('Authorized signature', x + 10, boxY + boxH - 14, {
      width: boxW - 20,
      align: 'center',
    });
  };

  drawSignBox(left, 'COMPANY / APPROVER', companySign, approverName);
  drawSignBox(left + boxW + boxGap, 'EMPLOYEE', employeeSign, employeeName);

  doc.y = boxY + boxH + 18;

  useRegular();
  doc.fillColor('#6B7280').fontSize(8);
  doc.text(
    `This document is a system-generated signed copy. Finalized by ${signerType} (user #${signerId}) on ${formatPdfDateTime(new Date())}.`,
    left,
    doc.y,
    { width: contentW }
  );
  doc.moveDown(0.4);
  if (contract.hash_sha256) {
    doc.text(`Document hash (SHA-256): ${contract.hash_sha256}`, left, doc.y, { width: contentW });
  }

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    useRegular();
    doc.fillColor('#9CA3AF').fontSize(8);
    doc.text(
      `${companyName}  ·  Confidential employment record  ·  Page ${i + 1} of ${range.count}`,
      left,
      doc.page.height - 36,
      { width: contentW, align: 'center' }
    );
  }

  doc.end();
  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  const pdfBuffer = await fs.promises.readFile(filePath);
  const hashSha256 = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
  const pdfUrl = `/uploads/contracts/employment/${fileName}`;
  return { pdfUrl, hashSha256 };
}
