import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { Payroll, User } from '../models';
import { ensureUploadRoot } from '../utils/uploadPath';
import { sameMonthPayrollPeriodWhere } from './payrollBulkGeneration';

export type ApprovalAttachmentMeta = {
  name: string;
  originalName: string;
  storedName: string;
};

function toInt(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function toNum(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function extraOf(row: any): Record<string, unknown> {
  const x = row?.extra_fields;
  return x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
}

function ex(x: Record<string, unknown>, key: string): unknown {
  return x[key];
}

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFC6EFCE' },
};

const HEADERS = [
  'No',
  'Emp ID',
  'Employee Name',
  'Department',
  'Bank Account',
  'IFSC',
  'Bank Name',
  'Email',
  'Basic',
  'HRA',
  'Other Allowance',
  'Total Salary',
  'Days Worked',
  'OT Hour',
  'Sum Total',
  'ESIC (Employee)',
  'PF (Employee)',
  'TDS',
  'PT',
  'Net Salary',
] as const;

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

/** 급여월 활성 급여 목록 엑셀을 uploads에 저장하고 결재 첨부 메타를 반환 */
export async function buildAndStorePayrollListExcelAttachment(opts: {
  tenantId: number;
  companyId: number;
  payrollPeriod: string;
}): Promise<ApprovalAttachmentMeta | null> {
  const { tenantId, companyId, payrollPeriod } = opts;
  const rows = await (Payroll as any).findAll({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      is_active: true,
      ...sameMonthPayrollPeriodWhere(payrollPeriod),
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
          'bank_account',
          'bank_ifsc',
          'bank_name',
        ],
        required: false,
      },
    ],
    order: [['id', 'ASC']],
  });

  if (!Array.isArray(rows) || rows.length === 0) return null;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Payroll');
  const headerRow = sheet.addRow([...HEADERS]);
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = { name: 'Calibri', size: 9, bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFB4B4B4' } },
      left: { style: 'thin', color: { argb: 'FFB4B4B4' } },
      bottom: { style: 'thin', color: { argb: 'FFB4B4B4' } },
      right: { style: 'thin', color: { argb: 'FFB4B4B4' } },
    };
  });

  rows.forEach((p: any, index: number) => {
    const emp = p.employee || {};
    const x = extraOf(p);
    const basic = toInt(p.basic_salary);
    const hra = toInt(ex(x, 'house_rent_allowance'));
    const other = toInt(ex(x, 'other_allowance'));
    const totalSalary = toInt(ex(x, 'total_salary')) || basic + hra + other;
    const daysWorked = toInt(ex(x, 'days_worked') ?? ex(x, 'working_days'));
    const otHour = toNum(ex(x, 'day_ot_hour') ?? ex(x, 'ot_hours'));
    const sumTotal = toInt(ex(x, 'sum_total') ?? p.gross_salary);
    const esicEmployee = toInt(ex(x, 'esic_employee'));
    const pfEmployee = toInt(ex(x, 'pf_employee'));
    const tds = toInt(ex(x, 'tds') ?? p.tax_amount);
    const pt = toInt(ex(x, 'pt') ?? ex(x, 'professional_tax'));
    const net = toInt(p.net_salary);

    const dataRow = sheet.addRow([
      index + 1,
      String(emp.employee_number ?? ''),
      String(emp.username ?? ''),
      String(emp.department ?? ''),
      String(emp.bank_account ?? ''),
      String(emp.bank_ifsc ?? ''),
      String(emp.bank_name ?? ''),
      String(emp.email ?? ''),
      basic,
      hra,
      other,
      totalSalary,
      daysWorked,
      otHour,
      sumTotal,
      esicEmployee,
      pfEmployee,
      tds,
      pt,
      net,
    ]);
    dataRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 9 };
      const isText = colNumber >= 2 && colNumber <= 8;
      if (!isText && typeof cell.value === 'number') {
        cell.numFmt = colNumber === 14 ? '#,##0.0' : '#,##0';
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else {
        if (typeof cell.value === 'number' && isText) cell.value = String(cell.value);
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  HEADERS.forEach((_, i) => {
    const col = sheet.getColumn(i + 1);
    col.width = i === 0 ? 5 : i <= 3 ? 14 : i <= 7 ? 16 : 12;
  });
  sheet.getRow(1).height = 20;

  const displayName = `급여리스트_${payrollPeriod}.xlsx`;
  const storedName = uniqueStoredName(
    `payroll_list_${payrollPeriod}_${Date.now()}.xlsx`.replace(/[^a-zA-Z0-9.\-_]/g, '_')
  );
  const absPath = path.join(ensureUploadRoot(), storedName);
  await workbook.xlsx.writeFile(absPath);

  return {
    name: displayName,
    originalName: displayName,
    storedName,
  };
}

/** document_id PAYROLL-{companyId}-{YYYY-MM} 파싱 */
export function parsePayrollApprovalDocumentId(
  documentId: string
): { companyId: number; payrollPeriod: string } | null {
  const m = String(documentId || '').trim().match(/^PAYROLL-(\d+)-(\d{4}-\d{2})$/i);
  if (!m) return null;
  const companyId = Number(m[1]);
  if (!Number.isFinite(companyId) || companyId <= 0) return null;
  return { companyId, payrollPeriod: m[2] };
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

function hasPayrollListAttachment(list: any[]): boolean {
  return list.some((f) => {
    const label = String(
      typeof f === 'string' ? f : f?.name || f?.originalName || f?.storedName || ''
    ).toLowerCase();
    return label.includes('급여리스트') || label.includes('payroll_list') || label.endsWith('.xlsx');
  });
}

function attachmentFileExists(list: any[]): boolean {
  const root = ensureUploadRoot();
  return list.some((f) => {
    const stored =
      typeof f === 'string'
        ? f
        : String(f?.storedName || f?.name || f?.originalName || '');
    const normalized = stored
      .replace(/^\/+/, '')
      .replace(/^uploads\//i, '')
      .replace(/^approvals\//i, '');
    if (!normalized) return false;
    return fs.existsSync(path.join(root, normalized));
  });
}

/**
 * 급여확정 결재에 엑셀 첨부가 없거나 파일이 없으면 생성해 attachments에 저장.
 * 기존(첨부 없이 올라간) 문서 상세에서도 보이도록 getApproval에서 호출.
 */
export async function ensurePayrollApprovalExcelAttachment(approval: any): Promise<any> {
  if (!approval || String(approval.type || '') !== 'payroll') return approval;
  const parsed = parsePayrollApprovalDocumentId(String(approval.document_id || ''));
  if (!parsed) return approval;

  const list = attachmentListOf(approval);
  if (hasPayrollListAttachment(list) && attachmentFileExists(list)) return approval;

  const tenantId = Number(approval.tenant_id);
  const companyId = Number(approval.company_id || parsed.companyId);
  if (!Number.isFinite(tenantId) || !Number.isFinite(companyId)) return approval;

  const meta = await buildAndStorePayrollListExcelAttachment({
    tenantId,
    companyId,
    payrollPeriod: parsed.payrollPeriod,
  });
  if (!meta) return approval;

  const next = [...list.filter((f) => !hasPayrollListAttachment([f])), meta];
  await approval.update({ attachments: next });
  return approval;
}
