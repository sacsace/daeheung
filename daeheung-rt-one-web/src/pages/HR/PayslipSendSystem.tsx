import React, { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ExcelJS from 'exceljs';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { DeleteOutline, Email, ExpandMore, FileUpload, Preview } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import { useStore } from '../../store';
import { useReferenceDataStore } from '../../store/referenceDataStore';
import PayrollPayslipDialog from './PayrollPayslipDialog';
import type { PayrollGridRow } from './payroll/payrollGridTypes';
import { formatOtHourDisplay } from './payroll/payrollGridUtils';
import { generatePayslipEmailArtifacts, payslipBlobToBase64 } from './payrollPayslipPdf';
import { buildPayslipEmailHtml } from './payslipEmailHtml';
import { payrollService, companyService } from '../../services/api';
import { shortCompanyName, type PayslipCompanyInfo, toPayslipCompanyInfo } from './PayslipContent';
import {
  companySelectListboxSlotProps,
  companySelectNowrapSx,
} from '../../utils/companyDisplayName';
import {
  mvsBodyCardSx,
  mvsBodyListTableSx,
  mvsBodyListZoneSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPrimaryBtnSx,
  mvsBodySectionHeaderSx,
  mvsBodyToolbarSx,
  mvsFilterFieldHeightSx,
  mvsOutlinedLabelProps,
  mvsPageRootSx,
  mvsSearchFieldSx,
  mvsTableBodyRowSx,
  mvsTableHeadHighlightSx,
  mvsTableScrollSx,
} from '../../theme/daeheungLayout';

type Field =
  | 'emp_id'
  | 'employee_name'
  | 'employee_email'
  | 'department'
  | 'position'
  | 'bank_account'
  | 'ifsc'
  | 'bank_name'
  | 'joining_date'
  | 'birth_date'
  | 'basic_salary'
  | 'house_rent_allowance'
  | 'other_allowance'
  | 'food_allowance'
  | 'total_salary'
  | 'total_day_of_month'
  | 'unpaid_leave'
  | 'days_worked'
  | 'day_ot_hour'
  | 'night_ot_hour'
  | 'ot_rate'
  | 'overtime_pay'
  | 'transport_allowance'
  | 'sum_total'
  | 'pf_employee'
  | 'esic_employee'
  | 'tds'
  | 'pt'
  | 'deduct_this_month'
  | 'net_salary_payable';

type ImportRow = PayrollGridRow & { sourceRow: number; issues: string[] };

/** 여러 엑셀 열을 합산해도 되는 필드 (Hyvision: Medical/Meals/Long Service 등) */
const SUMMABLE_FIELDS = new Set<Field>([
  'other_allowance',
  'food_allowance',
  'transport_allowance',
  'deduct_this_month',
]);

const FIELD_OPTIONS: Array<{ value: Field; aliases: string[] }> = [
  { value: 'emp_id', aliases: ['empid', 'employeeid', 'emp id', 'employee id', 'emp. id'] },
  { value: 'employee_name', aliases: ['name of employee', 'employee name', 'name'] },
  { value: 'employee_email', aliases: ['email id', 'emailid', 'e-mail', 'email'] },
  { value: 'department', aliases: ['department', 'dept'] },
  { value: 'position', aliases: ['designation', 'position'] },
  {
    value: 'bank_account',
    aliases: ['bank account', 'account no', 'account number', 'a/c no', 'a/c', 'ac'],
  },
  { value: 'ifsc', aliases: ['ifsc code', 'ifsc'] },
  { value: 'bank_name', aliases: ['bank name', 'bank'] },
  { value: 'joining_date', aliases: ['joining date', 'date of joining', 'date of join', 'doj'] },
  { value: 'birth_date', aliases: ['date of birth', 'birth date', 'dob', 'birthday'] },
  { value: 'basic_salary', aliases: ['basic salary', 'basic'] },
  {
    value: 'house_rent_allowance',
    // Sample.xlsx 오타 HRD(=HRA)
    aliases: ['house rent allowance', 'hra', 'hrd'],
  },
  {
    value: 'other_allowance',
    aliases: [
      'discretionary performance allowance',
      'long service allowance',
      'team leader allowance',
      'team reader allowance', // Hyvision 오타
      'team leader',
      'team reader',
      'korean language allowance',
      'koeran language', // Hyvision 오타
      'korean language',
      'korean',
      'koeran',
      'medical allowance',
      'night shift allowance',
      'day shift allowance',
      'special allowance',
      'site allowance',
      'other site allowance',
      'other (site) allowance',
      'other allowances',
      'other allowance',
    ],
  },
  {
    value: 'food_allowance',
    aliases: [
      'food allowance',
      'food allwance', // 오타
      'meals allowance',
      'meals allowanc', // Hyvision 잘림
      'meals',
      'meal allowance',
      'food',
    ],
  },
  { value: 'total_salary', aliases: ['total salary'] },
  {
    value: 'total_day_of_month',
    aliases: ['total day of month', 'total days of month', 'total days', 'days in month', 'twdf'],
  },
  { value: 'unpaid_leave', aliases: ['unpaid leave', 'lop'] },
  { value: 'days_worked', aliases: ['days worked', 'working days'] },
  {
    value: 'day_ot_hour',
    // Tescom OT/Hour, Hyvision·GS OT/Day Hours — Day Shift(횟수)와 구분
    aliases: [
      'ot day hours',
      'ot/day hours',
      'day ot hours',
      'ot day hour',
      'day ot hour',
      'ot/hour',
      'ot hour',
      'ot hours',
    ],
  },
  {
    value: 'night_ot_hour',
    aliases: [
      'ot night hours',
      'ot/night hours',
      'night ot hours',
      'ot night hour',
      'night ot hour',
    ],
  },
  { value: 'ot_rate', aliases: ['ot rate', 'ot/rate'] },
  // Daily Wage(MSV): OT 열이 시간 없이 금액인 경우
  {
    value: 'overtime_pay',
    aliases: ['overtime pay', 'ot amount', 'ot pay', 'ot amt', 'overtime', 'ot'],
  },
  {
    value: 'transport_allowance',
    aliases: [
      'transportation allowance',
      'transport allowance',
      'transport/travel allowance',
      'travel allowance',
      'extra allowance',
    ],
  },
  { value: 'sum_total', aliases: ['sum total', 'gross total', 'gross pay', 'gross salary'] },
  {
    value: 'pf_employee',
    aliases: ['pf employee contribution', 'employee pf contribution', 'pf employee', 'epf'],
  },
  {
    value: 'esic_employee',
    aliases: [
      'esic employee contribution',
      'esi employee contribution',
      'employee esic contribution',
      'employee esi contribution',
      'esic employee',
      'esi employee',
    ],
  },
  { value: 'tds', aliases: ['tds'] },
  { value: 'pt', aliases: ['professional tax', 'pt'] },
  {
    value: 'deduct_this_month',
    aliases: [
      'amount to be deducted this month',
      'deducted this month',
      'deduct this month',
      'total deduction',
      'total deductions',
      'vpf',
    ],
  },
  {
    value: 'net_salary_payable',
    aliases: ['net salary payable', 'net salary', 'salary payable', 'net pay'],
  },
];

/** 헤더↔별칭 매칭 점수 (길수록·정확할수록 높음). employer 기여분은 매핑하지 않음 */
const scoreFieldAlias = (headerNorm: string, _field: Field, alias: string): number => {
  const a = normalize(alias);
  if (!headerNorm || !a) return 0;
  // PF/ESIC Employer Contribution 등은 직원 공제·수당에 넣지 않음
  if (headerNorm.includes('employer')) return 0;
  // 명세서에 쓰지 않거나 오매핑되는 열
  if (
    headerNorm === 'no' ||
    headerNorm === 'sno' ||
    headerNorm === 'increasesalarydate' ||
    headerNorm === 'advancepaymentamount' ||
    headerNorm === 'balanceofsalaryadvance' ||
    headerNorm === 'previousmonthadjustment' ||
    headerNorm === 'previousmonthadjustemnt' || // MSV 오타
    headerNorm === 'monthtotalcost' ||
    headerNorm === 'accountcash' ||
    headerNorm === 'paymentdate' ||
    // Tescom: Day/Night Shift 는 횟수(×단가)라 OT시간과 다름 — 자동 매핑 제외
    headerNorm === 'dayshift' ||
    headerNorm === 'nightshift' ||
    headerNorm === 'workingmonth' ||
    headerNorm === 'workingmonths'
  ) {
    return 0;
  }

  if (headerNorm === a) return 1000 + a.length;
  if (headerNorm.startsWith(a) || headerNorm.includes(a)) {
    // 짧은 별칭(pf, pt, ac, ot)이 긴 헤더에 과매칭되지 않도록
    if (a.length <= 2 && headerNorm !== a) return 0;
    if (a.length <= 3 && headerNorm.length > a.length + 6 && !headerNorm.startsWith(a)) return 0;
    return 500 + a.length;
  }
  return 0;
};

const matchFieldForHeader = (header: string, used: Set<Field>): Field | null => {
  const key = normalize(header);
  if (!key) return null;
  let best: { field: Field; score: number } | null = null;
  for (const option of FIELD_OPTIONS) {
    if (used.has(option.value) && !SUMMABLE_FIELDS.has(option.value)) continue;
    for (const alias of option.aliases) {
      const score = scoreFieldAlias(key, option.value, alias);
      if (score > 0 && (!best || score > best.score)) {
        best = { field: option.value, score };
      }
    }
  }
  return best?.field ?? null;
};

const sumMappedNumbers = (
  source: Record<string, unknown>,
  mapping: Record<number, Field>,
  field: Field
): number => {
  let total = 0;
  Object.entries(mapping).forEach(([index, mappedField]) => {
    if (mappedField === field) total += numberValue(source[index]);
  });
  return total;
};

const firstMappedText = (
  source: Record<string, unknown>,
  mapping: Record<number, Field>,
  field: Field
): string => {
  for (const [index, mappedField] of Object.entries(mapping)) {
    if (mappedField !== field) continue;
    const text = cellToText(source[index]);
    if (text) return text;
  }
  return '';
};
const filterFieldSx = { ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx } as const;

/** ExcelJS CellValue → 표시용 문자열 (객체/[object Object] 방지) */
const cellToText = (value: unknown): string => {
  if (value == null || value === '') return '';
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s || /^\[object\s+object\]$/i.test(s)) return '';
    // 미계산 수식이 문자열로 남은 경우 (예: =IF(...), _xlfn.LET(...))
    if (/^=/.test(s) || /^_xlfn/i.test(s)) return '';
    return s;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.richText)) {
      return obj.richText
        .map((part) => (part && typeof part === 'object' ? String((part as any).text ?? '') : ''))
        .join('')
        .trim();
    }
    // 수식 셀: 캐시된 계산값(result) 우선 — 고정금액이 수식에 들어 있는 경우 포함
    if (obj.result != null && obj.result !== '') return cellToText(obj.result);
    if (obj.text != null) return cellToText(obj.text);
    if (obj.hyperlink != null && obj.text == null) return String(obj.hyperlink).trim();
    const formulaRaw = obj.formula != null ? String(obj.formula) : '';
    if (formulaRaw) {
      const normalized = formulaRaw.startsWith('=') ? formulaRaw : `=${formulaRaw}`;
      const constant = normalized.match(/^=\s*(-?\d+(?:\.\d+)?)\s*$/);
      if (constant) return constant[1];
    }
  }
  return '';
};

/** 셀에서 수식 문자열 추출 (확인용) */
const cellFormulaText = (cell: ExcelJS.Cell): string => {
  const direct = String((cell as any).formula || '').trim();
  if (direct) return direct.startsWith('=') ? direct : `=${direct}`;
  const v = cell.value as any;
  if (v && typeof v === 'object') {
    if (v.formula) {
      const f = String(v.formula).trim();
      return f.startsWith('=') ? f : `=${f}`;
    }
    if (v.sharedFormula) {
      const f = String(v.sharedFormula).trim();
      return f.startsWith('=') ? f : `=${f}`;
    }
  }
  return '';
};

/** ExcelJS Cell → 표시값 (수식 result / 상수 수식 / 일반 값) */
const resolveExcelCell = (cell: ExcelJS.Cell): string => {
  const formula = cellFormulaText(cell);
  const fromValue = cellToText(cell.value);
  if (fromValue) return fromValue;
  const cached = (cell as any).result;
  if (cached != null && cached !== '') return cellToText(cached);
  if (formula) {
    const constant = formula.match(/^=\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (constant) return constant[1];
  }
  return '';
};

/** 시트 전체를 텍스트 행렬(+수식 행렬)로 읽기 */
const readSheetMatrix = (sheet: ExcelJS.Worksheet): { texts: string[][]; formulas: string[][] } => {
  const texts: string[][] = [];
  const formulas: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const lastCol = Math.max(1, row.cellCount || 0);
    const rowTexts: string[] = [];
    const rowFormulas: string[] = [];
    for (let col = 1; col <= lastCol; col += 1) {
      const cell = row.getCell(col);
      rowTexts.push(resolveExcelCell(cell));
      rowFormulas.push(cellFormulaText(cell));
    }
    texts.push(rowTexts);
    formulas.push(rowFormulas);
  });
  return { texts, formulas };
};

/** 데이터 행에서 열별 샘플 수식 (첫 번째 비어 있지 않은 수식) */
const sampleFormulasByColumn = (formulaRows: string[][], headerIndex: number, colCount: number): Record<number, string> => {
  const out: Record<number, string> = {};
  for (let col = 0; col < colCount; col += 1) {
    for (let r = headerIndex + 1; r < Math.min(formulaRows.length, headerIndex + 40); r += 1) {
      const f = String(formulaRows[r]?.[col] || '').trim();
      if (f) {
        out[col] = f;
        break;
      }
    }
  }
  return out;
};

/** 입사일 등 날짜만 YYYY-MM-DD */
const toDateOnly = (value: unknown): string => {
  const raw = cellToText(value);
  if (!raw) return '';
  const iso = raw.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime()) && (/\bGMT\b/i.test(raw) || /[A-Za-z]{3}/.test(raw))) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return raw;
};

/** 헤더 정규화 — 공백/기호 제거 + Hyvision 등 흔한 오타 보정 */
const normalize = (value: unknown) => {
  let key = cellToText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  // Hyvision 시트 오타·잘림 보정
  key = key
    .replace(/koeran/g, 'korean')
    .replace(/teamreader/g, 'teamleader')
    .replace(/allowanc(?!e)/g, 'allowance'); // Allowanc → Allowance
  return key;
};
const numberValue = (value: unknown) => {
  const n = Number(cellToText(value).replace(/,/g, '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const MONTH_NAME_TO_NUM: Record<string, string> = {
  january: '01',
  jan: '01',
  february: '02',
  feb: '02',
  march: '03',
  mar: '03',
  april: '04',
  apr: '04',
  may: '05',
  june: '06',
  jun: '06',
  july: '07',
  jul: '07',
  august: '08',
  aug: '08',
  september: '09',
  sep: '09',
  sept: '09',
  october: '10',
  oct: '10',
  november: '11',
  nov: '11',
  december: '12',
  dec: '12',
};

/** 시트 제목에서 급여월(YYYY-MM) 추출 — 예: Salary List of June/2026, MONTH JULY/2026 */
const extractPeriodFromTitle = (rows: unknown[][]): string => {
  for (const row of rows.slice(0, 5)) {
    const line = row.map(cellToText).filter(Boolean).join(' ');
    const named = line.match(
      /\b(?:MONTH\s+)?(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[,./\-\s]+(20\d{2})\b/i
    );
    if (named) {
      const mm = MONTH_NAME_TO_NUM[named[1].toLowerCase()];
      if (mm) return `${named[2]}-${mm}`;
    }
    const ymd = line.match(/\b(20\d{2})[./-](\d{1,2})\b/);
    if (ymd) return `${ymd[1]}-${String(ymd[2]).padStart(2, '0')}`;
  }
  return '';
};

const findHeaderRow = (rows: unknown[][]) => {
  let bestIndex = -1;
  let bestScore = 0;
  rows.slice(0, 30).forEach((row, index) => {
    const score = row.reduce((count: number, cell) => {
      const header = cellToText(cell);
      if (!header) return count;
      return count + (matchFieldForHeader(header, new Set()) ? 1 : 0);
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  if (bestScore >= 2) return bestIndex;
  return Math.max(
    0,
    rows.findIndex((row) => row.filter((cell) => cellToText(cell)).length >= 5)
  );
};

const EARNING_LINE_FIELDS = new Set<Field>([
  'basic_salary',
  'house_rent_allowance',
  'other_allowance',
  'food_allowance',
  'transport_allowance',
  'overtime_pay',
]);

const makePayrollRow = (
  source: Record<string, unknown>,
  mapping: Record<number, Field>,
  rowNo: number,
  payrollPeriod: string,
  headers: string[] = []
): ImportRow => {
  const basic = sumMappedNumbers(source, mapping, 'basic_salary');
  const hra = sumMappedNumbers(source, mapping, 'house_rent_allowance');
  const other = sumMappedNumbers(source, mapping, 'other_allowance');
  const food = sumMappedNumbers(source, mapping, 'food_allowance');
  const transport = sumMappedNumbers(source, mapping, 'transport_allowance');
  const totalSalary =
    sumMappedNumbers(source, mapping, 'total_salary') || basic + hra + other + food + transport;
  const dayOt = sumMappedNumbers(source, mapping, 'day_ot_hour');
  const nightOt = sumMappedNumbers(source, mapping, 'night_ot_hour');
  const otRate = sumMappedNumbers(source, mapping, 'ot_rate');
  const overtimePayMapped = sumMappedNumbers(source, mapping, 'overtime_pay');
  const computedOtPay = Math.round(otRate * (dayOt + nightOt));
  // Daily Wage: OT 열이 금액 / Tescom·Hyvision·GS: 시간×단가
  const otPay = overtimePayMapped > 0 ? Math.round(overtimePayMapped) : computedOtPay;
  const gross = Math.round(
    sumMappedNumbers(source, mapping, 'sum_total') || totalSalary + otPay
  );
  const pfEmp = sumMappedNumbers(source, mapping, 'pf_employee');
  const esicEmp = sumMappedNumbers(source, mapping, 'esic_employee');
  const tdsAmt = sumMappedNumbers(source, mapping, 'tds');
  const ptAmt = sumMappedNumbers(source, mapping, 'pt');
  const extraDeduct = sumMappedNumbers(source, mapping, 'deduct_this_month');
  const deductions = Math.round(
    extraDeduct > 0 && pfEmp + esicEmp + tdsAmt + ptAmt === 0
      ? extraDeduct
      : pfEmp + esicEmp + tdsAmt + ptAmt + extraDeduct
  );
  const email = firstMappedText(source, mapping, 'employee_email');
  const name = firstMappedText(source, mapping, 'employee_name');
  const issues: string[] = [];
  if (!name) issues.push('missingName');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.push('invalidEmail');
  const netMapped = sumMappedNumbers(source, mapping, 'net_salary_payable');
  const net = Math.round(netMapped || gross - deductions);
  if (!net) issues.push('missingNet');
  if (!payrollPeriod) issues.push('missingPeriod');

  // 엑셀 열 순서·헤더명 그대로 수당 행 구성 (합산 Other 대신 명세서에 개별 표시)
  const hasOvertimePayCol = Object.values(mapping).includes('overtime_pay');
  const payslip_earning_lines: NonNullable<ImportRow['payslip_earning_lines']> = [];
  let otInserted = false;
  const pushOtLine = () => {
    if (otInserted || hasOvertimePayCol) return;
    if (!(dayOt > 0 || nightOt > 0 || otPay > 0)) return;
    const otHours = dayOt + nightOt;
    payslip_earning_lines.push({
      label: otHours > 0 ? `Overtime (${formatOtHourDisplay(otHours)}h)` : 'Overtime',
      amount: otPay,
      highlight: true,
    });
    otInserted = true;
  };

  Object.keys(mapping)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach((colIndex) => {
      const field = mapping[colIndex];
      if (!field) return;
      if (EARNING_LINE_FIELDS.has(field)) {
        const amount = Math.round(numberValue(source[colIndex]));
        // 기본급은 0이어도 표시, 수당·OT금액은 값이 있을 때만
        if (field !== 'basic_salary' && amount === 0) return;
        const label = String(headers[colIndex] || '').trim() || field;
        payslip_earning_lines.push({
          label,
          amount,
          highlight: field === 'transport_allowance' || field === 'overtime_pay',
        });
        return;
      }
      if (field === 'day_ot_hour' || field === 'night_ot_hour') {
        pushOtLine();
      }
    });
  pushOtLine();

  return {
    id: -(rowNo + 1),
    row_no: rowNo + 1,
    sourceRow: rowNo + 1,
    issues,
    emp_id: String(firstMappedText(source, mapping, 'emp_id') || '').trim().toUpperCase(),
    bank_account: firstMappedText(source, mapping, 'bank_account'),
    ifsc: firstMappedText(source, mapping, 'ifsc'),
    bank_name: firstMappedText(source, mapping, 'bank_name'),
    employee_email: email,
    department: firstMappedText(source, mapping, 'department'),
    employee_name: name,
    position: firstMappedText(source, mapping, 'position'),
    birth_date: toDateOnly(firstMappedText(source, mapping, 'birth_date')),
    joining_date: toDateOnly(firstMappedText(source, mapping, 'joining_date')),
    working_month: payrollPeriod,
    basic_salary: Math.round(basic),
    house_rent_allowance: Math.round(hra),
    other_allowance: Math.round(other),
    food_allowance: Math.round(food),
    total_salary: Math.round(totalSalary),
    total_day_of_month: firstMappedText(source, mapping, 'total_day_of_month'),
    unpaid_leave: firstMappedText(source, mapping, 'unpaid_leave'),
    days_worked: firstMappedText(source, mapping, 'days_worked'),
    ot_rate: otRate,
    day_ot_hour: dayOt,
    night_ot_hour: nightOt,
    transport_allowance: Math.round(transport),
    overtime: otPay,
    sum_total: gross,
    pf_employee: pfEmp ? String(Math.round(pfEmp)) : firstMappedText(source, mapping, 'pf_employee'),
    pf_employer: '',
    esic_employee: esicEmp
      ? String(Math.round(esicEmp))
      : firstMappedText(source, mapping, 'esic_employee'),
    esic_employer: '',
    tds: Math.round(tdsAmt),
    pt: ptAmt ? String(Math.round(ptAmt)) : firstMappedText(source, mapping, 'pt'),
    deduct_this_month: deductions,
    net_salary_payable: net,
    payslip_earning_lines: payslip_earning_lines.length ? payslip_earning_lines : undefined,
  };
};

const PayslipSendSystem: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const user = useStore((s) => s.user);
  const canSelectCompany = false;
  const p = 'payrollManagement.payslipSendSystem';
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnFormulas, setColumnFormulas] = useState<Record<number, string>>({});
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<number, Field>>({});
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [preview, setPreview] = useState<PayrollGridRow | null>(null);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const cancelSendRef = useRef(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [payrollPeriod, setPayrollPeriod] = useState('');
  const [mappingSectionOpen, setMappingSectionOpen] = useState(false);
  const [senderCompanyId, setSenderCompanyId] = useState<number | ''>(
    user?.company_id != null && Number(user.company_id) > 0 ? Number(user.company_id) : ''
  );
  const [companyOptions, setCompanyOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [mail, setMail] = useState({
    subject: '[{{company}}] {{month}} Payslip Attached ({{name}})',
    message:
      'Dear {{name}},\n\nI hope you are doing well.\n\nPlease find attached your payslip for {{month}} {{year}} for your reference.\nKindly review it at your convenience, and please feel free to contact us if you have any questions or require further clarification.\nThank you for your continued dedication and contribution to the company.\nBest regards,\n{{company}}',
  });
  const [companyInfo, setCompanyInfo] = useState<PayslipCompanyInfo | null>(null);

  const effectiveCompanyId = useMemo(() => {
    if (canSelectCompany) {
      return typeof senderCompanyId === 'number' && senderCompanyId > 0 ? senderCompanyId : null;
    }
    const loginId = Number(user?.company_id);
    return Number.isFinite(loginId) && loginId > 0 ? loginId : null;
  }, [canSelectCompany, senderCompanyId, user?.company_id]);

  useEffect(() => {
    if (!canSelectCompany) {
      setCompanyOptions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await companyService.getCompanies();
        const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        if (cancelled) return;
        const list = rows
          .map((c: any) => ({
            id: Number(c.id),
            name: shortCompanyName(c.name || c.company_name) || String(c.name || c.company_name || '').trim(),
          }))
          .filter((c: { id: number; name: string }) => Number.isFinite(c.id) && c.id > 0 && c.name)
          .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
        setCompanyOptions(list);
        if (
          (senderCompanyId === '' || senderCompanyId == null) &&
          user?.company_id != null &&
          list.some((c: { id: number }) => c.id === Number(user.company_id))
        ) {
          setSenderCompanyId(Number(user.company_id));
        }
      } catch {
        if (!cancelled) setCompanyOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canSelectCompany, user?.company_id]);

  useEffect(() => {
    if (!effectiveCompanyId) {
      setCompanyInfo(null);
      return;
    }
    void useReferenceDataStore
      .getState()
      .fetchCompanyById(effectiveCompanyId)
      .then((company) => setCompanyInfo(toPayslipCompanyInfo(company)))
      .catch(() => setCompanyInfo(null));
  }, [effectiveCompanyId]);

  const rebuildRows = useCallback(
    (
      nextMapping: Record<number, Field>,
      nextRawRows = rawRows,
      period = payrollPeriod,
      nextHeaders = headers
    ) => {
      const imported = nextRawRows.map((row, index) =>
        makePayrollRow(row, nextMapping, index, period.trim(), nextHeaders)
      );
      setRows(imported);
      setSelected(new Set(imported.filter((row) => row.issues.length === 0).map((row) => row.id)));
    },
    [rawRows, payrollPeriod, headers]
  );

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setNotice('');
    setError('');
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new Error(t(`${p}.noSheet`));
      const { texts: sheetRows, formulas: formulaRows } = readSheetMatrix(sheet);
      const headerIndex = findHeaderRow(sheetRows);
      const nextHeaders = sheetRows[headerIndex].map(
        (cell, index) =>
          cellToText(cell).replace(/\s+/g, ' ').trim() || t(`${p}.columnFallback`, { n: index + 1 })
      );
      const nextRawRows = sheetRows
        .slice(headerIndex + 1)
        .filter((row) => row.some((cell) => cellToText(cell)))
        .filter((row) => {
          const cells = row.map(cellToText);
          const joined = cells.join(' ').toLowerCase().replace(/\s+/g, ' ').trim();
          if (!joined) return false;
          if (/^total\b/.test(joined) || joined.includes('total amount')) return false;
          // 섹션 제목·반복 헤더 (Daily Wage / OTHER THAN… / NAME 등)
          if (joined.includes('daily wage employee')) return false;
          if (joined.includes('other than')) return false;
          if (/^(no\.?|name|emp\s*id|department)\b/.test(joined) && cells.filter(Boolean).length <= 4) {
            return false;
          }
          const nameCell = cells.find((c) => c.trim()) || '';
          if (/^(name|no\.?|emp\s*id)$/i.test(nameCell.trim())) return false;
          return true;
        })
        .map((row) =>
          Object.fromEntries(
            nextHeaders.map((_, index) => [String(index), cellToText(row[index])])
          )
        );

      const nextMapping: Record<number, Field> = {};
      const used = new Set<Field>();
      nextHeaders.forEach((header, index) => {
        const found = matchFieldForHeader(header, used);
        if (!found) return;
        nextMapping[index] = found;
        if (!SUMMABLE_FIELDS.has(found)) used.add(found);
      });

      const formulaSamples = sampleFormulasByColumn(formulaRows, headerIndex, nextHeaders.length);
      const formulaColCount = Object.keys(formulaSamples).length;
      const detectedPeriod = extractPeriodFromTitle(sheetRows) || payrollPeriod;
      setHeaders(nextHeaders);
      setColumnFormulas(formulaSamples);
      setRawRows(nextRawRows);
      setMapping(nextMapping);
      setPayrollPeriod(detectedPeriod);
      rebuildRows(nextMapping, nextRawRows, detectedPeriod, nextHeaders);
      setNotice(
        t(`${p}.uploadOk`, {
          file: file.name,
          header: headerIndex + 1,
          count: nextRawRows.length,
          period: detectedPeriod
            ? t(`${p}.uploadPeriod`, { period: detectedPeriod })
            : '',
        }) +
          (formulaColCount
            ? ` ${t(`${p}.formulaDetected`, { count: formulaColCount })}`
            : '')
      );
    } catch (e: any) {
      setError(e?.message || t(`${p}.uploadFail`));
    } finally {
      event.target.value = '';
    }
  };

  const validRows = useMemo(() => rows.filter((row) => row.issues.length === 0), [rows]);
  const selectedRows = useMemo(
    () => validRows.filter((row) => selected.has(row.id)),
    [validRows, selected]
  );
  const selectedCount = selected.size;
  const allRowIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const validRowIds = useMemo(() => validRows.map((row) => row.id), [validRows]);
  const allRowsSelected = allRowIds.length > 0 && allRowIds.every((id) => selected.has(id));
  const someRowsSelected = selectedCount > 0 && !allRowsSelected;
  const allValidSelected =
    validRowIds.length > 0 &&
    validRowIds.every((id) => selected.has(id)) &&
    selected.size === validRowIds.length;

  const toggleAllRows = () => {
    setSelected(allRowsSelected ? new Set() : new Set(allRowIds));
  };
  const toggleValidRows = () => {
    setSelected(allValidSelected ? new Set() : new Set(validRowIds));
  };
  const invertSelection = () => {
    setSelected((prev) => {
      const next = new Set<number>();
      rows.forEach((row) => {
        if (!prev.has(row.id)) next.add(row.id);
      });
      return next;
    });
  };

  const removeSelectedRows = () => {
    if (!selectedCount || sending) return;
    const removeRawIdx = new Set(
      rows.filter((row) => selected.has(row.id)).map((row) => row.sourceRow - 1)
    );
    const nextRaw = rawRows.filter((_, index) => !removeRawIdx.has(index));
    setRawRows(nextRaw);
    rebuildRows(mapping, nextRaw, payrollPeriod, headers);
  };

  const updateMapping = (index: number, field: Field | '') => {
    const next = { ...mapping };
    if (field) next[index] = field;
    else delete next[index];
    setMapping(next);
    rebuildRows(next);
  };

  const replaceTemplate = (template: string, row: PayrollGridRow) => {
    const period = String(row.working_month || payrollPeriod || '').trim();
    const ym = period.match(/^(20\d{2})-(\d{1,2})$/);
    const year = ym ? ym[1] : period.match(/^(20\d{2})/)?.[1] || '';
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const monthLabel = ym ? monthNames[Math.max(0, Number(ym[2]) - 1)] || period : period;
    return template
      .replaceAll('{{name}}', row.employee_name || '')
      .replaceAll('{{month}}', monthLabel)
      .replaceAll('{{year}}', year)
      .replaceAll('{{company}}', shortCompanyName(companyInfo?.name));
  };

  /** PDF 생성 + SMTP를 겹치되, Gmail 한도·브라우저 부하를 위해 동시 3건 */
  const SEND_CONCURRENCY = 3;

  const send = async () => {
    if (!selectedRows.length) return;
    if (!effectiveCompanyId) {
      setError(t(`${p}.selectCompanyRequired`));
      return;
    }
    cancelSendRef.current = false;
    setSending(true);
    setProgress({ done: 0, total: selectedRows.length });
    let ok = 0;
    let fail = 0;
    let saved = 0;
    let firstError = '';
    let cursor = 0;
    let completed = 0;

    const sendOne = async (row: PayrollGridRow) => {
      if (cancelSendRef.current) return;
      try {
        const { pdfBlob, imageBlob } = await generatePayslipEmailArtifacts(row, companyInfo, {
          locale: 'en',
          purpose: 'email',
          companyId: effectiveCompanyId,
        });
        if (cancelSendRef.current) return;
        const messageText = replaceTemplate(mail.message, row);
        const htmlBody = buildPayslipEmailHtml(row, {
          companyInfo,
          companyId: effectiveCompanyId,
          introText: messageText,
          inlineImageCid: 'payslip@mvs',
        });
        const result = await payrollService.sendImportedPayslip({
          to: row.employee_email,
          employee_name: row.employee_name,
          payroll_period: row.working_month || payrollPeriod,
          emp_id: row.emp_id,
          net_salary: row.net_salary_payable,
          subject: replaceTemplate(mail.subject, row),
          message: messageText,
          pdf_base64: await payslipBlobToBase64(pdfBlob),
          image_base64: await payslipBlobToBase64(imageBlob),
          html_body: htmlBody,
          company_id: effectiveCompanyId,
        });
        if (cancelSendRef.current) return;
        if (result.success) {
          ok += 1;
          if (result.data?.saved_for_user) saved += 1;
        } else {
          fail += 1;
          if (!firstError) firstError = String(result.message || '').trim();
        }
      } catch (e: any) {
        if (!cancelSendRef.current) {
          fail += 1;
          if (!firstError) {
            const raw = String(e?.response?.data?.message || e?.message || '');
            const timedOut = e?.code === 'ECONNABORTED' || /timeout/i.test(raw);
            const noResponse =
              !e?.response && /failed to fetch|network error|load failed/i.test(raw);
            firstError = timedOut
              ? t(`${p}.sendTimeout`)
              : noResponse
                ? t(`${p}.sendNetwork`)
                : raw.trim();
          }
        }
      } finally {
        completed += 1;
        setProgress({ done: completed, total: selectedRows.length });
      }
    };

    const workers = Array.from(
      { length: Math.min(SEND_CONCURRENCY, selectedRows.length) },
      async () => {
        while (true) {
          if (cancelSendRef.current) break;
          const index = cursor;
          cursor += 1;
          if (index >= selectedRows.length) break;
          await sendOne(selectedRows[index]);
        }
      }
    );
    await Promise.all(workers);

    const cancelled = cancelSendRef.current;
    const summary =
      (cancelled
        ? t(`${p}.sendCancelled`, { ok, fail })
        : t(`${p}.sendDone`, { ok, fail })) +
      (saved ? t(`${p}.sendSaved`, { saved }) : '') +
      (firstError ? ` ${firstError}` : '');
    if (ok === 0 && fail > 0) {
      setNotice('');
      setError(summary);
    } else {
      setError('');
      setNotice(summary);
    }
    cancelSendRef.current = false;
    setSending(false);
  };

  const headSx =
    typeof mvsTableHeadHighlightSx === 'function'
      ? mvsTableHeadHighlightSx(theme)
      : mvsTableHeadHighlightSx;
  const bodyRowSx =
    typeof mvsTableBodyRowSx === 'function' ? mvsTableBodyRowSx(theme) : mvsTableBodyRowSx;

  return (
    <Box sx={mvsPageRootSx}>
      <DaeheungPageHeader
        title={t(`${p}.title`)}
        description={t(`${p}.description`)}
      />

      <Alert severity="info" sx={{ mb: 2 }}>
        {t(`${p}.infoHint`)}
      </Alert>
      {notice && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>
          {notice}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Box sx={{ ...mvsBodyCardSx, mb: 2.5 }}>
        <Box sx={mvsBodySectionHeaderSx}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
            {t(`${p}.uploadSection`)}
          </Typography>
          <Button
            variant="contained"
            disableElevation
            startIcon={<FileUpload />}
            onClick={() => inputRef.current?.click()}
            sx={mvsBodyPrimaryBtnSx}
          >
            {t(`${p}.uploadButton`)}
          </Button>
          <input
            ref={inputRef}
            hidden
            type="file"
            accept=".xlsx"
            onChange={(event) => void handleFile(event)}
          />
        </Box>
        <Box sx={{ px: { xs: 2, sm: 2.5 }, py: 2, display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          {canSelectCompany ? (
            <Autocomplete
              options={companyOptions}
              value={
                typeof senderCompanyId === 'number'
                  ? companyOptions.find((c) => c.id === senderCompanyId) ?? null
                  : null
              }
              onChange={(_, next) => {
                setSenderCompanyId(next?.id && next.id > 0 ? next.id : '');
              }}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              disableClearable={Boolean(
                typeof senderCompanyId === 'number' &&
                  companyOptions.some((c) => c.id === senderCompanyId)
              )}
              slotProps={companySelectListboxSlotProps}
              sx={{
                ...filterFieldSx,
                minWidth: { xs: '100%', sm: 280 },
                maxWidth: { sm: 360 },
                ...companySelectNowrapSx,
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label={t(`${p}.senderCompany`)}
                  placeholder={t(`${p}.senderCompanySearch`, {
                    defaultValue: t(`${p}.senderCompanyPlaceholder`),
                  })}
                  helperText={t(`${p}.senderCompanyHelper`)}
                  {...mvsOutlinedLabelProps}
                  sx={companySelectNowrapSx}
                />
              )}
            />
          ) : null}
          <TextField
            size="small"
            label={t(`${p}.payMonth`)}
            value={payrollPeriod}
            onChange={(e) => {
              const next = e.target.value;
              setPayrollPeriod(next);
              if (rawRows.length) rebuildRows(mapping, rawRows, next);
            }}
            placeholder="YYYY-MM"
            sx={{ ...filterFieldSx, width: { xs: '100%', sm: 160 } }}
            {...mvsOutlinedLabelProps}
            helperText={t(`${p}.payMonthHelper`)}
          />
        </Box>
      </Box>

      {headers.length > 0 && (
        <Box sx={{ ...mvsBodyCardSx, mb: 2.5 }}>
          <Box
            role="button"
            tabIndex={0}
            aria-expanded={mappingSectionOpen}
            onClick={() => setMappingSectionOpen((open) => !open)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setMappingSectionOpen((open) => !open);
              }
            }}
            sx={{
              ...mvsBodySectionHeaderSx,
              cursor: 'pointer',
              userSelect: 'none',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
              {t(`${p}.mappingSection`)}
            </Typography>
            <ExpandMore
              sx={{
                fontSize: 22,
                color: 'text.secondary',
                transform: mappingSectionOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                transition: 'transform 0.15s ease',
              }}
            />
          </Box>
          {mappingSectionOpen && (
            <Box
              sx={{
                px: { xs: 2, sm: 2.5 },
                py: 2,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 1.5,
              }}
            >
              {headers.map((header, index) => (
                <FormControl key={`${header}-${index}`} size="small" sx={filterFieldSx}>
                  <InputLabel shrink>{header}</InputLabel>
                  <Select
                    label={header}
                    notched
                    value={mapping[index] || ''}
                    onChange={(event) => updateMapping(index, event.target.value as Field | '')}
                  >
                    <MenuItem value="">{t(`${p}.unused`)}</MenuItem>
                    {FIELD_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {t(`${p}.fields.${option.value}`)}
                      </MenuItem>
                    ))}
                  </Select>
                  {columnFormulas[index] ? (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        mt: 0.5,
                        display: 'block',
                        fontFamily: 'ui-monospace, Consolas, monospace',
                        fontSize: '0.7rem',
                        lineHeight: 1.35,
                        wordBreak: 'break-all',
                      }}
                      title={columnFormulas[index]}
                    >
                      {t(`${p}.formulaSample`)}: {columnFormulas[index]}
                    </Typography>
                  ) : null}
                </FormControl>
              ))}
            </Box>
          )}
        </Box>
      )}

      {rows.length > 0 && (
        <>
          <Box sx={mvsBodyListZoneSx}>
            <Box sx={{ ...mvsBodyCardSx, mb: 2.5 }}>
              <Box sx={mvsBodyToolbarSx}>
                <Typography variant="body2" sx={{ fontWeight: 700, flex: 1 }}>
                  {t(`${p}.reviewSection`, {
                    valid: validRows.length,
                    error: rows.length - validRows.length,
                  })}
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={sending || !rows.length}
                  onClick={toggleAllRows}
                  sx={mvsBodyOutlinedBtnSx}
                >
                  {allRowsSelected ? t(`${p}.clearAll`) : t(`${p}.selectAll`)}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={sending || !validRows.length}
                  onClick={toggleValidRows}
                  sx={mvsBodyOutlinedBtnSx}
                >
                  {allValidSelected ? t(`${p}.clearValid`) : t(`${p}.selectAllValid`)}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={sending || !rows.length}
                  onClick={invertSelection}
                  sx={mvsBodyOutlinedBtnSx}
                >
                  {t(`${p}.invertSelection`)}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  disabled={sending || !selectedCount}
                  startIcon={<DeleteOutline fontSize="small" />}
                  onClick={removeSelectedRows}
                  sx={mvsBodyOutlinedBtnSx}
                >
                  {t(`${p}.deleteSelected`, { count: selectedCount })}
                </Button>
              </Box>
              <TableContainer
                sx={{
                  ...mvsBodyListTableSx,
                  ...mvsTableScrollSx,
                  maxHeight: 560,
                  // mvsBodyListTableSx 의 overflow:hidden 이 overflow-y 를 막아
                  // maxHeight 아래에서 행이 잘리므로 세로 스크롤을 명시
                  overflow: 'auto',
                  border: 'none',
                  boxShadow: 'none',
                  borderRadius: 0,
                }}
              >
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    width: '100%',
                    // collapse + stickyHeader 조합 시 헤더가 첫 행과 겹침
                    borderCollapse: 'separate',
                    borderSpacing: 0,
                    '& .MuiTableCell-root': {
                      borderLeft: 'none',
                      borderRight: 'none',
                      borderTop: 'none',
                    },
                  }}
                >
                  <TableHead
                    sx={{
                      ...(headSx as object),
                      '& .MuiTableCell-head': {
                        py: 0.75,
                        px: 1,
                        whiteSpace: 'nowrap',
                        position: 'sticky',
                        top: 0,
                        zIndex: 3,
                        bgcolor: '#F8FAFC',
                      },
                    }}
                  >
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={allRowsSelected}
                          indeterminate={someRowsSelected}
                          disabled={sending || !rows.length}
                          onChange={toggleAllRows}
                          inputProps={{ 'aria-label': t(`${p}.selectAll`) }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{t(`${p}.colRow`)}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{t(`${p}.colName`)}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{t(`${p}.colEmail`)}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{t(`${p}.colPayMonth`)}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">
                        {t(`${p}.colNet`)}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{t(`${p}.colReview`)}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="center">
                        {t(`${p}.colPayslip`)}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody sx={bodyRowSx}>
                    {rows.map((row) => (
                      <TableRow
                        key={row.id}
                        hover
                        sx={row.issues.length ? { bgcolor: '#FEF2F2 !important' } : undefined}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selected.has(row.id)}
                            disabled={sending}
                            onChange={() =>
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (next.has(row.id)) next.delete(row.id);
                                else next.add(row.id);
                                return next;
                              })
                            }
                          />
                        </TableCell>
                        <TableCell>{row.sourceRow}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.employee_name || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.employee_email || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.working_month || '—'}</TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {row.net_salary_payable.toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell sx={{ color: row.issues.length ? 'error.main' : 'text.secondary' }}>
                          {row.issues.length
                            ? row.issues.map((issue) => t(`${p}.issues.${issue}`)).join(', ')
                            : t(`${p}.statusOk`)}
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            startIcon={<Preview fontSize="small" />}
                            onClick={() => setPreview(row)}
                            sx={mvsBodyOutlinedBtnSx}
                          >
                            {t(`${p}.view`)}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Box>

          <Box sx={{ ...mvsBodyCardSx, mb: 2 }}>
            <Box sx={mvsBodySectionHeaderSx}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {t(`${p}.mailSection`)}
              </Typography>
            </Box>
            <Box sx={{ px: { xs: 2, sm: 2.5 }, py: 2 }}>
              <TextField
                fullWidth
                size="small"
                label={t(`${p}.mailSubject`)}
                value={mail.subject}
                onChange={(event) => setMail({ ...mail, subject: event.target.value })}
                sx={{ ...filterFieldSx, mb: 1.5 }}
                {...mvsOutlinedLabelProps}
                helperText={t(`${p}.mailVars`)}
              />
              <TextField
                fullWidth
                multiline
                minRows={4}
                label={t(`${p}.mailBody`)}
                value={mail.message}
                onChange={(event) => setMail({ ...mail, message: event.target.value })}
                sx={{ ...mvsSearchFieldSx, mb: 2 }}
                {...mvsOutlinedLabelProps}
              />
              {sending && (
                <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <CircularProgress size={18} />
                  <Typography variant="body2" color="text.secondary">
                    {t(`${p}.sending`, { done: progress.done, total: progress.total })}
                  </Typography>
                  <Button
                    size="small"
                    color="warning"
                    variant="outlined"
                    onClick={() => {
                      cancelSendRef.current = true;
                    }}
                    sx={mvsBodyOutlinedBtnSx}
                  >
                    {t(`${p}.cancelSending`)}
                  </Button>
                </Box>
              )}
              <Button
                variant="contained"
                disableElevation
                startIcon={<Email />}
                disabled={sending || !selectedRows.length || !effectiveCompanyId}
                onClick={() => void send()}
                sx={mvsBodyPrimaryBtnSx}
              >
                {t(`${p}.sendAction`, { count: selectedRows.length })}
              </Button>
            </Box>
          </Box>
        </>
      )}

      <PayrollPayslipDialog
        open={Boolean(preview)}
        row={preview}
        onClose={() => setPreview(null)}
        forceEnglish
        companyInfoOverride={companyInfo}
        companyIdOverride={effectiveCompanyId}
      />
    </Box>
  );
};

export default PayslipSendSystem;
