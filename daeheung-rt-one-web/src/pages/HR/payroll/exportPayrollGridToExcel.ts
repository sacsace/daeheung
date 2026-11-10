import ExcelJS from 'exceljs';
import type { PayrollGridRow } from './payrollGridTypes';
import { computeTenureMonths, roundOtHour } from './payrollGridUtils';
import { loadPayrollColumnPrefs } from './payrollColumnPrefs';
import { loadPayrollSalaryRatios } from './payrollSalaryRatios';
import { downloadExcelWorkbook } from '../../../utils/excelExportStyle';
import { getEmploymentTypeLabel } from '../../../utils/personalInfoFormat';

type PayrollTranslate = (key: string, opts?: Record<string, unknown>) => string;

/** Excel Accounting — 정수 (소수점 없음) */
const ACCOUNTING_INT_FMT = '_(* #,##0_);_(* (#,##0);_(* "-"??_);_(@_)';

/** OT 시간만 소수 1자리 회계형 */
const ACCOUNTING_HOUR_FMT = '_(* #,##0.0_);_(* (#,##0.0);_(* "-"??_);_(@_)';

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFC6EFCE' },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  name: 'Calibri',
  size: 9,
  bold: true,
  color: { argb: 'FF000000' },
};

function toNum(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** 금액·일수·번호 등 — 소수점 버림(정수) */
function toInt(value: unknown): number {
  return Math.trunc(toNum(value));
}

/** Salary Details 그리드와 동일 열 순서로 xlsx 저장 (폰트 9 · 헤더 색 · 회계 형식 · 열 너비 맞춤) */
export async function exportPayrollGridToExcel(
  rows: PayrollGridRow[],
  t: PayrollTranslate,
  companyId?: string | number | null
): Promise<void> {
  const prefs = loadPayrollColumnPrefs(companyId);
  const ratios = loadPayrollSalaryRatios(companyId);

  const textKeys = new Set<string>([
    t('payrollManagement.gridColumns.empId'),
    t('payrollManagement.gridColumns.bankAccount'),
    t('payrollManagement.gridColumns.ifsc'),
    t('payrollManagement.gridColumns.bankName'),
    t('payrollManagement.gridColumns.email'),
    t('payrollManagement.gridColumns.department'),
    t('payrollManagement.gridColumns.employeeName'),
    t('payrollManagement.gridColumns.employmentType'),
    t('payrollManagement.gridColumns.joiningDate'),
  ]);

  const hourKey = t('payrollManagement.gridColumns.dayOtHour');

  const sheetRows = rows.map((row) => {
    const tenure = toInt(computeTenureMonths(row.joining_date, row.working_month));
    const constantEntries: Record<string, number> = {};
    for (const part of ratios.parts) {
      let amount = 0;
      if (part.id === 'basic_salary') amount = Number(row.basic_salary) || 0;
      else if (part.id === 'house_rent_allowance') amount = Number(row.house_rent_allowance) || 0;
      else if (part.id === 'other_allowance') amount = Number(row.other_allowance) || 0;
      else amount = Number(row.constant_parts?.[part.id]) || 0;
      constantEntries[part.label] = toInt(amount);
    }
    const customEntries: Record<string, number> = {};
    for (const col of prefs.customColumns) {
      const isCountFormula = col.inputMode === 'count' && Boolean(String(col.formula || '').trim());
      customEntries[col.label] = isCountFormula
        ? toInt(row.custom_allowance_inputs?.[col.id] ?? 0)
        : toInt(row.custom_allowances?.[col.id] ?? 0);
    }
    return {
      [t('payrollManagement.gridColumns.rowNo')]: toInt(row.row_no),
      [t('payrollManagement.gridColumns.empId')]: String(row.emp_id ?? ''),
      [t('payrollManagement.gridColumns.bankAccount')]: String(row.bank_account ?? ''),
      [t('payrollManagement.gridColumns.ifsc')]: String(row.ifsc ?? ''),
      [t('payrollManagement.gridColumns.bankName')]: String(row.bank_name ?? ''),
      [t('payrollManagement.gridColumns.email')]: String(row.employee_email ?? ''),
      [t('payrollManagement.gridColumns.department')]: String(row.department ?? ''),
      [t('payrollManagement.gridColumns.employeeName')]: String(row.employee_name ?? ''),
      [t('payrollManagement.gridColumns.employmentType')]:
        getEmploymentTypeLabel(t, row.employment_type) || String(row.employment_type ?? ''),
      [t('payrollManagement.gridColumns.joiningDate')]: String(row.joining_date ?? ''),
      [t('payrollManagement.gridColumns.workingMonth')]: tenure,
      ...constantEntries,
      [t('payrollManagement.gridColumns.totalSalary')]: toInt(row.total_salary),
      [t('payrollManagement.gridColumns.totalDayOfMonth')]: toInt(row.total_day_of_month),
      [t('payrollManagement.gridColumns.unpaidLeave')]: toInt(row.unpaid_leave),
      [t('payrollManagement.gridColumns.daysWorked')]: toInt(row.days_worked),
      [t('payrollManagement.gridColumns.otRate')]: toInt(row.ot_rate),
      [hourKey]: roundOtHour(toNum(row.day_ot_hour)),
      ...customEntries,
      [t('payrollManagement.gridColumns.sumTotal')]: toInt(row.sum_total),
      [t('payrollManagement.gridColumns.esicEmployer')]: toInt(row.esic_employer),
      [t('payrollManagement.gridColumns.pfEmployer')]: toInt(row.pf_employer),
      [t('payrollManagement.gridColumns.esicEmployee')]: toInt(row.esic_employee),
      [t('payrollManagement.gridColumns.pfEmployee')]: toInt(row.pf_employee),
      [t('payrollManagement.gridColumns.tds')]: toInt(row.tds),
      [t('payrollManagement.gridColumns.pt')]: toInt(row.pt),
      [t('payrollManagement.gridColumns.netSalary')]: toInt(row.net_salary_payable),
    } as Record<string, string | number>;
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Payroll'.slice(0, 31));

  if (sheetRows.length === 0) {
    sheet.addRow(['(empty)']);
  } else {
    const keys = Object.keys(sheetRows[0]);
    const headerRow = sheet.addRow(keys);
    headerRow.eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFB4B4B4' } },
        left: { style: 'thin', color: { argb: 'FFB4B4B4' } },
        bottom: { style: 'thin', color: { argb: 'FFB4B4B4' } },
        right: { style: 'thin', color: { argb: 'FFB4B4B4' } },
      };
    });

    for (const row of sheetRows) {
      const dataRow = sheet.addRow(keys.map((k) => row[k] ?? ''));
      dataRow.eachCell((cell, colNumber) => {
        const key = keys[colNumber - 1];
        const isText = textKeys.has(key);
        if (!isText && typeof cell.value === 'number') {
          cell.numFmt = key === hourKey ? ACCOUNTING_HOUR_FMT : ACCOUNTING_INT_FMT;
          cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: false };
        } else {
          // 사번·계좌 등이 숫자로 깨지지 않도록 텍스트 유지
          if (typeof cell.value === 'number' && isText) {
            cell.value = String(cell.value);
          }
          cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
        }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });
    }
  }

  const dateToken = new Date().toISOString().slice(0, 10);
  await downloadExcelWorkbook(workbook, `payroll_export_${dateToken}.xlsx`, { rowHeight: 20 });
}
