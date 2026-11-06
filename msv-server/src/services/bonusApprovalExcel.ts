import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { PayrollBonus, User } from '../models';
import { ensureUploadRoot } from '../utils/uploadPath';

export type BonusApprovalAttachmentMeta = {
  name: string;
  originalName: string;
  storedName: string;
};

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFC6EFCE' },
};

const GRID = { style: 'thin' as const, color: { argb: 'FFB4B4B4' } };

const HEADERS = [
  'No',
  '사번',
  '성명',
  '부서',
  '입사일',
  '근속 개월',
  '월급',
  '지급률(%)',
  '이번 지급액',
  '상태',
  '이메일',
  '계좌',
  'IFSC',
] as const;

function money(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function uniqueStoredName(originalName: string): string {
  const root = ensureUploadRoot();
  const safe = originalName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  let finalName = safe;
  let counter = 1;
  while (fs.existsSync(path.join(root, finalName))) {
    const extIndex = safe.lastIndexOf('.');
    const base = extIndex > -1 ? safe.slice(0, extIndex) : safe;
    const ext = extIndex > -1 ? safe.slice(extIndex) : '';
    finalName = `${base}_${counter}${ext}`;
    counter += 1;
  }
  return finalName;
}

/** BONUS-{companyId}-{YYYY-YYYY}-{1|2}-{1|2} */
export function parseBonusApprovalDocumentId(documentId: string): {
  companyId: number;
  fiscalYear: string;
  installmentsPerYear: number;
  installment: number;
} | null {
  const match = String(documentId || '')
    .trim()
    .match(/^BONUS-(\d+)-(\d{4}-\d{4})-([12])-([12])$/i);
  if (!match) return null;
  const companyId = Number(match[1]);
  if (!Number.isFinite(companyId) || companyId <= 0) return null;
  return {
    companyId,
    fiscalYear: match[2],
    installmentsPerYear: Number(match[3]),
    installment: Number(match[4]),
  };
}

export async function buildAndStoreBonusListExcelAttachment(opts: {
  tenantId: number;
  companyId: number;
  fiscalYear: string;
  installmentsPerYear: number;
  installment: number;
}): Promise<BonusApprovalAttachmentMeta | null> {
  const { tenantId, companyId, fiscalYear, installmentsPerYear, installment } = opts;
  const bonuses = await (PayrollBonus as any).findAll({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      fiscal_year: fiscalYear,
      installments_per_year: installmentsPerYear,
      installment,
      excluded_at: null,
    },
    include: [
      {
        model: User,
        as: 'employee',
        attributes: [
          'id',
          'username',
          'email',
          'department',
          'employee_number',
          'hire_date',
          'bank_account',
          'bank_ifsc',
        ],
        required: false,
      },
    ],
    order: [[{ model: User, as: 'employee' }, 'username', 'ASC']],
  });
  if (!Array.isArray(bonuses) || bonuses.length === 0) return null;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Bonus');
  const headerRow = sheet.addRow([...HEADERS]);
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = { name: 'Calibri', size: 9, bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { top: GRID, left: GRID, bottom: GRID, right: GRID };
  });

  bonuses.forEach((row: any, index: number) => {
    const employee = row.employee || {};
    const hire = employee.hire_date ? String(employee.hire_date).slice(0, 10) : '';
    const status = String(row.status) === 'paid' ? '지급 완료' : '등록';
    const dataRow = sheet.addRow([
      index + 1,
      String(employee.employee_number || ''),
      String(employee.username || ''),
      String(employee.department || ''),
      hire,
      Number(row.months_worked) || 0,
      Math.round(money(row.monthly_salary)),
      Math.round(money(row.rate_percent) * 100) / 100,
      Math.round(money(row.amount)),
      status,
      String(employee.email || ''),
      String(employee.bank_account || ''),
      String(employee.bank_ifsc || ''),
    ]);
    dataRow.eachCell((cell, col) => {
      cell.font = { name: 'Calibri', size: 9 };
      cell.border = { top: GRID, left: GRID, bottom: GRID, right: GRID };
      const isAmount = col === 7 || col === 9;
      const isRate = col === 8;
      if ((isAmount || isRate) && typeof cell.value === 'number') {
        cell.numFmt = isRate ? '0.00' : '#,##0';
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else if (col === 6) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  });

  HEADERS.forEach((_, index) => {
    sheet.getColumn(index + 1).width = index === 0 ? 5 : 16;
  });
  sheet.getRow(1).height = 20;

  const roundLabel = installmentsPerYear === 2 ? `_${installment}차` : '';
  const displayName = `보너스리스트_${fiscalYear}${roundLabel}.xlsx`;
  const storedName = uniqueStoredName(
    `bonus_list_${fiscalYear}_${installmentsPerYear}_${installment}_${Date.now()}.xlsx`
  );
  await workbook.xlsx.writeFile(path.join(ensureUploadRoot(), storedName));
  return { name: displayName, originalName: displayName, storedName };
}

function attachmentListOf(approval: any): any[] {
  const raw = approval?.attachments;
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function isBonusListAttachment(file: any): boolean {
  const label = String(
    typeof file === 'string' ? file : file?.name || file?.originalName || file?.storedName || ''
  ).toLowerCase();
  return label.includes('보너스리스트') || label.includes('bonus_list');
}

function attachmentFileExists(list: any[]): boolean {
  const root = ensureUploadRoot();
  return list.some((file) => {
    const stored =
      typeof file === 'string' ? file : String(file?.storedName || file?.name || file?.originalName || '');
    const normalized = stored.replace(/^\/+/, '').replace(/^uploads\//i, '');
    if (!normalized) return false;
    return fs.existsSync(path.join(root, normalized));
  });
}

/** 이미 올라간 보너스 결재에 목록 엑셀이 없으면 만들어 붙인다. */
export async function ensureBonusApprovalExcelAttachment(approval: any): Promise<any> {
  if (!approval) return approval;
  const parsed = parseBonusApprovalDocumentId(String(approval.document_id || ''));
  if (!parsed) return approval;

  const list = attachmentListOf(approval);
  const bonusFiles = list.filter(isBonusListAttachment);
  if (bonusFiles.length > 0 && attachmentFileExists(bonusFiles)) return approval;

  const tenantId = Number(approval.tenant_id);
  const companyId = Number(approval.company_id || parsed.companyId);
  if (!Number.isFinite(tenantId) || !Number.isFinite(companyId)) return approval;

  const meta = await buildAndStoreBonusListExcelAttachment({
    tenantId,
    companyId,
    fiscalYear: parsed.fiscalYear,
    installmentsPerYear: parsed.installmentsPerYear,
    installment: parsed.installment,
  });
  if (!meta) return approval;

  await approval.update({
    attachments: [...list.filter((file) => !isBonusListAttachment(file)), meta],
  });
  return approval;
}
