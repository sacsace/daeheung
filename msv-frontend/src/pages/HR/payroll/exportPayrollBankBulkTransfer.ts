import ExcelJS from 'exceljs';
import { downloadExcelWorkbook } from '../../../utils/excelExportStyle';

/** 은행 업로드에 필요한 최소 행. 급여 그리드 행도 그대로 넘길 수 있다. */
export type BankBulkSourceRow = {
  employee_name: string;
  emp_id: string;
  bank_account: string;
  ifsc: string;
  employee_email?: string;
  net_salary_payable: number;
};

/** 인도 법인 은행 대량송금 업로드 대상 */
export type PayrollBulkBankId = 'hana' | 'shinhan' | 'kotak' | 'icici';

export const PAYROLL_BULK_BANKS: Array<{
  id: PayrollBulkBankId;
  /** IFSC 앞 4자리 (동일 은행 내 이체 판별) */
  ifscPrefix: string;
}> = [
  { id: 'hana', ifscPrefix: 'HNBE' },
  { id: 'shinhan', ifscPrefix: 'SHBK' },
  { id: 'kotak', ifscPrefix: 'KKBK' },
  { id: 'icici', ifscPrefix: 'ICIC' },
];

export type PayrollBankBulkExportOptions = {
  bankId: PayrollBulkBankId;
  /** 회사 출금 계좌 (비어 있으면 엑셀에 공란). ICICI는 12자리 Account No */
  debitAccount?: string;
  /** ICICI CIB Corporate ID. 한 번 입력하면 회사별로 저장 */
  corporateId?: string;
  /** YYYY-MM 또는 보너스 회계연도 */
  payrollPeriod: string;
  /** 파일명·Remarks용 라벨 */
  bankLabel: string;
  /** 적요 앞부분. 급여는 Salary, 보너스는 Bonus */
  purpose?: string;
};

const ICICI_BULK_STORAGE_PREFIX = 'mvs.payroll.iciciBulk.';

export type IciciBulkSavedSettings = {
  corporateId: string;
  accountNo: string;
};

function iciciBulkStorageKey(companyId: number | null | undefined): string {
  const id = companyId != null && Number.isFinite(companyId) && companyId > 0 ? String(companyId) : 'default';
  return `${ICICI_BULK_STORAGE_PREFIX}${id}`;
}

export function readIciciBulkSaved(companyId: number | null | undefined): IciciBulkSavedSettings {
  try {
    const raw = localStorage.getItem(iciciBulkStorageKey(companyId));
    if (!raw) return { corporateId: '', accountNo: '' };
    const parsed = JSON.parse(raw) as { corporateId?: unknown; accountNo?: unknown };
    return {
      corporateId: String(parsed.corporateId || '').trim(),
      accountNo: String(parsed.accountNo || '').replace(/\D/g, ''),
    };
  } catch {
    return { corporateId: '', accountNo: '' };
  }
}

export function writeIciciBulkSaved(
  companyId: number | null | undefined,
  value: IciciBulkSavedSettings
): void {
  const corporateId = String(value.corporateId || '').trim();
  const accountNo = String(value.accountNo || '').replace(/\D/g, '');
  if (!corporateId && !accountNo) return;
  localStorage.setItem(
    iciciBulkStorageKey(companyId),
    JSON.stringify({ corporateId, accountNo })
  );
}

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

function toInt(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '').replace(/,/g, ''));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function cleanText(value: unknown, maxLen?: number): string {
  let s = String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  // 은행 업로드: 특수문자 최소화
  s = s.replace(/[,"']/g, ' ').replace(/\s+/g, ' ').trim();
  if (maxLen != null && s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

function ifscOf(row: BankBulkSourceRow): string {
  return cleanText(row.ifsc, 11).toUpperCase();
}

function isSameBank(ifsc: string, prefix: string): boolean {
  return ifsc.length >= 4 && ifsc.slice(0, 4) === prefix.toUpperCase();
}

function salaryRemark(period: string, empId: string, purpose = 'Salary'): string {
  const ym = String(period || '').trim() || purpose;
  const id = cleanText(empId, 12);
  return cleanText(`${purpose} ${ym}${id ? ` ${id}` : ''}`, 30);
}

function eligibleRows(rows: BankBulkSourceRow[]): BankBulkSourceRow[] {
  return rows.filter((row) => {
    const amount = toInt(row.net_salary_payable);
    const account = cleanText(row.bank_account);
    const ifsc = ifscOf(row);
    const name = cleanText(row.employee_name);
    return amount > 0 && account.length > 0 && ifsc.length === 11 && name.length > 0;
  });
}

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
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
}

function addSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  headers: string[],
  dataRows: Array<Array<string | number>>
) {
  const sheet = workbook.addWorksheet(name.slice(0, 31));
  const headerRow = sheet.addRow(headers);
  styleHeader(headerRow);
  for (const values of dataRows) {
    const row = sheet.addRow(values);
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1] || '';
      const isAmount = /amount/i.test(header);
      if (isAmount && typeof cell.value === 'number') {
        cell.numFmt = '#,##0';
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else {
        if (typeof cell.value === 'number') cell.value = String(cell.value);
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  }
  if (dataRows.length === 0) {
    sheet.addRow(['(no eligible rows — check account / IFSC / net pay)']);
  }
}

function digitsOnly(value: unknown, maxLen?: number): string {
  let s = String(value ?? '').replace(/\D/g, '');
  if (maxLen != null && s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

/** 은행 업로드: 영문·숫자·공백만. 특수문자 제거 */
function bankName(value: unknown, maxLen: number): string {
  return String(value ?? '')
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function formatMmDdYyyy(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${date.getFullYear()}`;
}

function formatIciciAmount(value: number): string {
  const n = Math.round(Number(value) * 100) / 100;
  if (!Number.isFinite(n) || n <= 0) return '0.00';
  return n.toFixed(2);
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * ICICI CIB 벌크 업로드 txt.
 * 템플릿의 OUTPUT 열(메모장 붙여넣기)과 같은 파이프 구분 파일.
 * FHR: Corporate ID, 12자리 출금계좌, 합계, 건수, MM/DD/YYYY, External Reference
 * APW: WIB(ICICI, IFSC 공란) / NFT, 금액, 수취계좌, 이름(80), 비고(30)
 */
function buildIciciTxt(rows: BankBulkSourceRow[], options: PayrollBankBulkExportOptions): string {
  const corporateId = cleanText(options.corporateId, 32).replace(/\|/g, '');
  const debitAccount = digitsOnly(options.debitAccount, 12);
  const period = String(options.payrollPeriod || '').trim();
  const yyyymm = period.replace(/\D/g, '').slice(0, 6);
  const purpose = bankName(options.purpose || 'Salary', 20) || 'Salary';
  const fileRemark = bankName(yyyymm ? `${purpose} ${yyyymm}` : purpose, 30);
  const externalRef = bankName(yyyymm ? `${purpose.slice(0, 1)}${yyyymm}` : purpose, 10).replace(/ /g, '');
  const valueDate = formatMmDdYyyy(new Date());
  let total = 0;
  const details: string[] = [];

  for (const row of rows) {
    const ifsc = ifscOf(row);
    const withinBank = isSameBank(ifsc, 'ICIC');
    const network = withinBank ? 'WIB' : 'NFT';
    const amount = toInt(row.net_salary_payable);
    total += amount;
    const beneAccount = digitsOnly(row.bank_account, withinBank ? 12 : 30);
    const beneName = bankName(row.employee_name, 80);
    const beneRemark = bankName(salaryRemark(period, row.emp_id, purpose), 30);
    const ifscField = withinBank ? '' : ifsc;
    details.push(
      [
        'APW',
        network,
        formatIciciAmount(amount),
        'INR',
        debitAccount,
        ifscField,
        beneAccount,
        beneName,
        fileRemark,
        beneRemark,
      ].join('|') + '^'
    );
  }

  const header =
    [
      'FHR',
      corporateId,
      debitAccount,
      'INR',
      formatIciciAmount(total),
      String(details.length),
      valueDate,
      externalRef,
    ].join('|') + '^';

  return [header, ...details].join('\r\n');
}

/** Kotak / 일반 NEFT 벌크 (헤더 행 포함 엑셀) */
function buildKotakRows(
  rows: BankBulkSourceRow[],
  debitAccount: string,
  period: string,
  purpose: string
): { headers: string[]; data: Array<Array<string | number>> } {
  const headers = [
    'Payment Type',
    'Debit Account Number',
    'Beneficiary Name',
    'Beneficiary Account Number',
    'IFSC Code',
    'Amount',
    'Currency',
    'Remarks',
    'Email',
  ];
  const data = rows.map((row) => {
    const ifsc = ifscOf(row);
    const paymentType = isSameBank(ifsc, 'KKBK') ? 'IFT' : 'NEFT';
    return [
      paymentType,
      cleanText(debitAccount, 24),
      cleanText(row.employee_name, 40),
      cleanText(row.bank_account, 24),
      ifsc,
      toInt(row.net_salary_payable),
      'INR',
      salaryRemark(period, row.emp_id, purpose),
      cleanText(row.employee_email, 80),
    ];
  });
  return { headers, data };
}

/** 신한은행 인도 — 법인 대량 NEFT/IFT 엑셀 */
function buildShinhanRows(
  rows: BankBulkSourceRow[],
  debitAccount: string,
  period: string,
  purpose: string
): { headers: string[]; data: Array<Array<string | number>> } {
  const headers = [
    'Sr No',
    'Beneficiary Name',
    'Beneficiary Account Number',
    'IFSC Code',
    'Amount',
    'Payment Mode',
    'Debit Account Number',
    'Remarks',
    'Employee Code',
  ];
  const data = rows.map((row, index) => {
    const ifsc = ifscOf(row);
    const mode = isSameBank(ifsc, 'SHBK') ? 'IFT' : 'NEFT';
    return [
      index + 1,
      cleanText(row.employee_name, 50),
      cleanText(row.bank_account, 34),
      ifsc,
      toInt(row.net_salary_payable),
      mode,
      cleanText(debitAccount, 34),
      salaryRemark(period, row.emp_id, purpose),
      cleanText(row.emp_id, 20).toUpperCase(),
    ];
  });
  return { headers, data };
}

/** 하나은행 인도 — 법인 대량 NEFT/IFT 엑셀 */
function buildHanaRows(
  rows: BankBulkSourceRow[],
  debitAccount: string,
  period: string,
  purpose: string
): { headers: string[]; data: Array<Array<string | number>> } {
  const headers = [
    'Serial No',
    'Beneficiary Name',
    'Account Number',
    'IFSC',
    'Amount',
    'Transfer Type',
    'Debit Account',
    'Narration',
    'Emp ID',
  ];
  const data = rows.map((row, index) => {
    const ifsc = ifscOf(row);
    const transferType = isSameBank(ifsc, 'HNBE') ? 'WITHIN' : 'NEFT';
    return [
      index + 1,
      cleanText(row.employee_name, 50),
      cleanText(row.bank_account, 34),
      ifsc,
      toInt(row.net_salary_payable),
      transferType,
      cleanText(debitAccount, 34),
      salaryRemark(period, row.emp_id, purpose),
      cleanText(row.emp_id, 20).toUpperCase(),
    ];
  });
  return { headers, data };
}

export function countEligiblePayrollBankRows(rows: BankBulkSourceRow[]): number {
  return eligibleRows(rows).length;
}

/**
 * 급여 확정 후 은행 포털 대량 업로드용 엑셀 생성.
 * 직원 전원을 선택 은행 포맷으로 내보냅니다(출금 은행 = 선택 은행).
 */
export async function exportPayrollBankBulkTransfer(
  rows: BankBulkSourceRow[],
  options: PayrollBankBulkExportOptions
): Promise<{ exported: number; skipped: number }> {
  const eligible = eligibleRows(rows);
  const skipped = Math.max(0, rows.length - eligible.length);
  const debit = cleanText(options.debitAccount, 34);
  const period = String(options.payrollPeriod || '').trim();
  const purpose = cleanText(options.purpose || 'Salary', 20) || 'Salary';

  if (options.bankId === 'icici') {
    const content = buildIciciTxt(eligible, { ...options, debitAccount: debit, payrollPeriod: period });
    const periodSlug = period.replace(/[^\d-]/g, '') || 'payroll';
    downloadTextFile(`payroll_bulk_icici_${periodSlug}.txt`, content);
    return { exported: eligible.length, skipped };
  }

  let headers: string[];
  let data: Array<Array<string | number>>;
  switch (options.bankId) {
    case 'kotak':
      ({ headers, data } = buildKotakRows(eligible, debit, period, purpose));
      break;
    case 'shinhan':
      ({ headers, data } = buildShinhanRows(eligible, debit, period, purpose));
      break;
    case 'hana':
    default:
      ({ headers, data } = buildHanaRows(eligible, debit, period, purpose));
      break;
  }

  const workbook = new ExcelJS.Workbook();
  addSheet(workbook, 'Bulk Transfer', headers, data);

  const bankSlug = options.bankId;
  const periodSlug = period.replace(/[^\d-]/g, '') || 'payroll';
  await downloadExcelWorkbook(
    workbook,
    `payroll_bulk_${bankSlug}_${periodSlug}.xlsx`,
    { rowHeight: 18 }
  );

  return { exported: eligible.length, skipped };
}
