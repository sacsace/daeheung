import { type PayrollCustomColumn } from './payrollColumnPrefs';
import type { PayrollGridRow } from './payrollGridTypes';
import {
  countEditProps,
  isDailySalaryBasisRow,
  numberEditProps,
  otHourEditProps,
  resolveDailyDaysWorked,
  roundOtHour,
  roundUnpaidLeave,
  unpaidLeaveEditProps,
} from './payrollGridUtils';
import { toProperCaseInput } from '../../../utils/textCase';

export type PayrollCellAnchor = { rowId: number | string; field: string };

const NUMERIC_FIELDS = new Set([
  'total_salary',
  'total_day_of_month',
  'basic_salary',
  'house_rent_allowance',
  'other_allowance',
  'pf_employee',
  'esic_employee',
  'esic_employer',
  'tds',
  'pt',
]);

export function isPayrollGridCellEditable(
  field: string,
  row: PayrollGridRow,
  options: {
    allowCellEdit: boolean;
    allowConstantsEdit: boolean;
    isRoot: boolean;
    lockedPeriods: Set<string>;
  }
): boolean {
  if (!options.allowCellEdit) return false;
  if (
    field === 'pf_employer' ||
    field === 'days_worked' ||
    field === 'sum_total' ||
    field === 'net_salary_payable' ||
    field === 'emp_id' ||
    field === 'employee_email' ||
    field === 'working_month' ||
    field === 'row_no' ||
    field === 'actions'
  ) {
    return false;
  }
  if (
    (field === 'basic_salary' ||
      field === 'house_rent_allowance' ||
      field === 'other_allowance' ||
      field.startsWith('const__')) &&
    !options.allowConstantsEdit
  ) {
    return false;
  }
  if (options.isRoot) return true;
  const period = String(row.working_month || '').trim();
  if (!period) return true;
  return !options.lockedPeriods.has(period);
}

function customColumnByField(
  field: string,
  customColumns: PayrollCustomColumn[]
): PayrollCustomColumn | undefined {
  if (!field.startsWith('custom__')) return undefined;
  const id = field.slice('custom__'.length);
  return customColumns.find((c) => c.id === id);
}

export function parsePayrollFieldInput(
  field: string,
  raw: string,
  customColumns: PayrollCustomColumn[]
): unknown {
  const trimmed = raw.trim();
  if (field === 'day_ot_hour') return otHourEditProps.valueParser(trimmed);
  if (field === 'unpaid_leave') return unpaidLeaveEditProps.valueParser(trimmed);

  const custom = customColumnByField(field, customColumns);
  if (custom) {
    if (custom.inputMode === 'count' && String(custom.formula || '').trim()) {
      return countEditProps.valueParser(trimmed);
    }
    return numberEditProps.valueParser(trimmed);
  }

  if (field.startsWith('const__') || NUMERIC_FIELDS.has(field)) {
    return numberEditProps.valueParser(trimmed);
  }

  // 텍스트 셀: 단어별 첫 글자 대문자·나머지 소문자 (IFSC 등 코드 제외)
  if (
    field === 'ifsc' ||
    field === 'emp_id' ||
    field === 'employee_email' ||
    field === 'bank_account'
  ) {
    return trimmed;
  }
  if (
    field === 'bank_name' ||
    field === 'department' ||
    field === 'employee_name' ||
    field === 'position'
  ) {
    return toProperCaseInput(trimmed);
  }

  return trimmed;
}

export function patchPayrollRowField(
  row: PayrollGridRow,
  field: string,
  value: unknown,
  customColumns: PayrollCustomColumn[]
): PayrollGridRow {
  const next = { ...row };

  if (field === 'day_ot_hour') {
    const n = roundOtHour(Number(value) || 0);
    next.day_ot_hour = n;
    if (n > 0) next.ot_manual = true;
    return next;
  }

  if (field === 'unpaid_leave') {
    const unpaid = roundUnpaidLeave(Number(value) || 0);
    next.unpaid_leave = String(unpaid);
    // 일용직: 무급 수동 조정 시 근무일 = 월총일 − 무급으로 맞춘 뒤 재계산에 반영
    if (isDailySalaryBasisRow(next)) {
      const calendarDays = Math.max(1, Number(String(next.total_day_of_month).replace(/,/g, '')) || 30);
      next.days_worked = String(
        resolveDailyDaysWorked(calendarDays, Math.max(0, calendarDays - unpaid))
      );
    }
    return next;
  }

  if (field === 'ot_rate') {
    const n = Math.max(0, Math.floor(typeof value === 'number' ? value : Number(value) || 0));
    next.ot_rate = n;
    next.ot_rate_manual = true;
    return next;
  }

  if (field === 'pf_employee') {
    const n = Math.max(0, Math.floor(typeof value === 'number' ? value : Number(value) || 0));
    next.pf_employee = String(n);
    next.pf_manual = true;
    return next;
  }

  if (field === 'esic_employee') {
    const n = Math.max(0, Math.floor(typeof value === 'number' ? value : Number(value) || 0));
    next.esic_employee = String(n);
    next.esic_manual = true;
    return next;
  }

  if (field === 'esic_employer') {
    const n = Math.max(0, Math.floor(typeof value === 'number' ? value : Number(value) || 0));
    next.esic_employer = String(n);
    next.esic_manual = true;
    return next;
  }

  if (field === 'tds') {
    const n = Math.max(0, Math.floor(typeof value === 'number' ? value : Number(value) || 0));
    next.tds = n;
    next.tds_manual = true;
    return next;
  }

  if (field === 'pt') {
    const n = Math.max(0, Math.floor(typeof value === 'number' ? value : Number(value) || 0));
    next.pt = String(n);
    next.pt_manual = true;
    return next;
  }

  const custom = customColumnByField(field, customColumns);
  if (custom) {
    const n = typeof value === 'number' ? value : Number(value) || 0;
    if (custom.inputMode === 'count' && String(custom.formula || '').trim()) {
      return {
        ...next,
        custom_allowance_inputs: {
          ...(next.custom_allowance_inputs || {}),
          [custom.id]: Math.max(0, Math.floor(n)),
        },
      };
    }
    return {
      ...next,
      custom_allowances: {
        ...(next.custom_allowances || {}),
        [custom.id]: Math.max(0, Math.floor(n)),
      },
    };
  }

  if (field.startsWith('const__')) {
    const id = field.slice('const__'.length);
    const n = typeof value === 'number' ? value : Number(value) || 0;
    return {
      ...next,
      constant_parts: {
        ...(next.constant_parts || {}),
        [id]: Math.max(0, Math.floor(n)),
      },
    };
  }

  if (NUMERIC_FIELDS.has(field)) {
    const n = typeof value === 'number' ? value : Number(value) || 0;
    return { ...next, [field]: Math.max(0, Math.floor(n)) } as PayrollGridRow;
  }

  return { ...next, [field]: String(value ?? '') } as PayrollGridRow;
}

export function parsePayrollColumnPasteLines(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => line.split('\t')[0] ?? '');
}

export function getPayrollCellCopyText(
  row: PayrollGridRow | undefined,
  field: string,
  customColumns: PayrollCustomColumn[]
): string {
  if (!row) return '';
  if (field.startsWith('custom__')) {
    const custom = customColumnByField(field, customColumns);
    if (custom?.inputMode === 'count' && String(custom.formula || '').trim()) {
      return String(row.custom_allowance_inputs?.[custom.id] ?? 0);
    }
    if (custom) return String(row.custom_allowances?.[custom.id] ?? 0);
  }
  if (field.startsWith('const__')) {
    const id = field.slice('const__'.length);
    return String(row.constant_parts?.[id] ?? 0);
  }
  const raw = (row as Record<string, unknown>)[field];
  if (raw === null || raw === undefined) return '';
  return String(raw);
}
