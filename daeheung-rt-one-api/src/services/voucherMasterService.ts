import { Op } from 'sequelize';
import {
  AcBankAccount,
  AcFinancialYear,
  AcGstCode,
  AcTdsCode,
  AcTransactionItem,
  AcVoucherType,
  GlAccount,
  GlVoucher,
} from '../models';
import { ensureDefaultChartOfAccounts } from './glPostingService';

const round2 = (n: number) => Number((Number(n) || 0).toFixed(2));
const parseAmount = (value: unknown) => {
  if (value == null) return 0;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

export type SimpleVoucherInput = {
  voucherTypeId?: number;
  voucherTypeCode?: string;
  transactionItemId?: number;
  partyId?: number;
  bankAccountId?: number;
  paymentAccountId?: number;
  voucherDate: string;
  taxableAmount: number;
  discount?: number;
  otherCharges?: number;
  gstCodeId?: number;
  tdsCodeId?: number;
  roundOff?: number;
  paidAmount?: number;
  narration?: string;
  isInterState?: boolean;
};

export type PreviewLine = {
  lineNo: number;
  lineCategory: string;
  accountId?: number;
  accountName: string;
  partyId?: number;
  partyName?: string;
  debit: number;
  credit: number;
  gstCodeId?: number;
  tdsCodeId?: number;
  taxableAmount?: number;
  taxAmount?: number;
  narration?: string;
};

const DEFAULT_VOUCHER_TYPES = [
  { code: 'PAY', name_ko: '지급 전표', name_en: 'Payment Voucher', prefix: 'PAY', category: 'payment', icon: 'payment', legacy_type: 'payment', sort_order: 1 },
  { code: 'REC', name_ko: '수금 전표', name_en: 'Receipt Voucher', prefix: 'REC', category: 'receipt', icon: 'receipt', legacy_type: 'receipt', sort_order: 2 },
  { code: 'PUR', name_ko: '매입 전표', name_en: 'Purchase Voucher', prefix: 'PUR', category: 'purchase', icon: 'shopping_cart', legacy_type: 'purchase', sort_order: 3, requires_party: true },
  { code: 'SAL', name_ko: '매출 전표', name_en: 'Sales Voucher', prefix: 'SAL', category: 'sales', icon: 'sell', legacy_type: 'sales', sort_order: 4, requires_party: true },
  { code: 'CTR', name_ko: '자금 이동', name_en: 'Contra Voucher', prefix: 'CTR', category: 'contra', icon: 'swap_horiz', legacy_type: 'contra', sort_order: 5 },
  { code: 'JOU', name_ko: '대체 전표', name_en: 'Journal Voucher', prefix: 'JOU', category: 'journal', icon: 'edit_note', legacy_type: 'journal', sort_order: 6 },
  { code: 'CRN', name_ko: 'Credit Note', name_en: 'Credit Note', prefix: 'CRN', category: 'credit_note', icon: 'note_add', legacy_type: 'journal', sort_order: 7 },
  { code: 'DBN', name_ko: 'Debit Note', name_en: 'Debit Note', prefix: 'DBN', category: 'debit_note', icon: 'note', legacy_type: 'journal', sort_order: 8 },
];

const getFinancialYearLabel = (date: Date) => {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const startYear = m >= 4 ? y : y - 1;
  const endYear = startYear + 1;
  return `${startYear}-${String(endYear).slice(-2)}`;
};

export const ensureAccountingMasters = async ({
  tenantId,
  companyId,
  userId,
}: {
  tenantId: number;
  companyId: number;
  userId?: number;
}) => {
  await ensureDefaultChartOfAccounts({ tenantId, companyId, userId });

  const accounts = await (GlAccount as any).findAll({
    where: { tenant_id: tenantId, company_id: companyId, is_active: true, account_type: 'ledger' },
  });
  const byCode = new Map<string, any>();
  accounts.forEach((a: any) => byCode.set(a.code, a));

  const created = { voucherTypes: 0, gstCodes: 0, tdsCodes: 0, transactionItems: 0, bankAccounts: 0, financialYears: 0 };

  const vtCount = await (AcVoucherType as any).count({ where: { tenant_id: tenantId, company_id: companyId } });
  if (vtCount === 0) {
    for (const row of DEFAULT_VOUCHER_TYPES) {
      await (AcVoucherType as any).create({
        tenant_id: tenantId,
        company_id: companyId,
        ...row,
        requires_party: row.requires_party ?? false,
        is_active: true,
      });
      created.voucherTypes += 1;
    }
  }

  const fyCount = await (AcFinancialYear as any).count({ where: { tenant_id: tenantId, company_id: companyId } });
  if (fyCount === 0) {
    const now = new Date();
    const label = getFinancialYearLabel(now);
    const startYear = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
    await (AcFinancialYear as any).create({
      tenant_id: tenantId,
      company_id: companyId,
      name: label,
      start_date: `${startYear}-04-01`,
      end_date: `${startYear + 1}-03-31`,
      is_open: true,
      is_active: true,
    });
    created.financialYears += 1;
  }

  const gstCount = await (AcGstCode as any).count({ where: { tenant_id: tenantId, company_id: companyId } });
  if (gstCount === 0) {
    const gstPayable = byCode.get('2102');
    const defaults = [
      { code: 'GST18', name: 'GST 18%', rate: 18, cgst_rate: 9, sgst_rate: 9, igst_rate: 18, io_type: 'input' },
      { code: 'GST12', name: 'GST 12%', rate: 12, cgst_rate: 6, sgst_rate: 6, igst_rate: 12, io_type: 'input' },
      { code: 'GST5', name: 'GST 5%', rate: 5, cgst_rate: 2.5, sgst_rate: 2.5, igst_rate: 5, io_type: 'input' },
      { code: 'GST0', name: 'GST 0%', rate: 0, cgst_rate: 0, sgst_rate: 0, igst_rate: 0, io_type: 'input' },
    ];
    for (const row of defaults) {
      await (AcGstCode as any).create({
        tenant_id: tenantId,
        company_id: companyId,
        ...row,
        tax_type: 'cgst_sgst',
        output_account_id: gstPayable?.id ?? null,
        is_active: true,
      });
      created.gstCodes += 1;
    }
  }

  const tdsCount = await (AcTdsCode as any).count({ where: { tenant_id: tenantId, company_id: companyId } });
  if (tdsCount === 0) {
    await (AcTdsCode as any).create({
      tenant_id: tenantId,
      company_id: companyId,
      section: '194-I',
      description: '임대료 TDS',
      description_en: 'Rent TDS',
      individual_rate: 10,
      company_rate: 10,
      no_pan_rate: 20,
      threshold_amount: 240000,
      is_active: true,
    });
    created.tdsCodes += 1;
  } else {
    await (AcTdsCode as any).update(
      { description_en: 'Rent TDS' },
      {
        where: {
          tenant_id: tenantId,
          company_id: companyId,
          section: '194-I',
          description_en: { [Op.or]: [null, ''] },
        },
      }
    );
  }

  const bankCount = await (AcBankAccount as any).count({ where: { tenant_id: tenantId, company_id: companyId } });
  if (bankCount === 0 && byCode.get('1102')) {
    await (AcBankAccount as any).create({
      tenant_id: tenantId,
      company_id: companyId,
      bank_name: 'Primary Bank',
      account_name: 'Operating Account',
      ledger_account_id: byCode.get('1102')?.id,
      currency: 'INR',
      is_active: true,
    });
    created.bankAccounts += 1;
  }

  const tiCount = await (AcTransactionItem as any).count({ where: { tenant_id: tenantId, company_id: companyId } });
  if (tiCount === 0) {
    const payType = await (AcVoucherType as any).findOne({ where: { tenant_id: tenantId, company_id: companyId, code: 'PAY' } });
    const gst18 = await (AcGstCode as any).findOne({ where: { tenant_id: tenantId, company_id: companyId, code: 'GST18' } });
    const tds194 = await (AcTdsCode as any).findOne({ where: { tenant_id: tenantId, company_id: companyId, section: '194-I' } });
    const items = [
      { code: 'RENT', name_ko: '사무실 임차료', name_en: 'Office Rent', keywords: 'rent,임대료,office rent', debit_account_id: byCode.get('5200')?.id, voucher_type_id: payType?.id },
      { code: 'UTIL', name_ko: '전기료', name_en: 'Electricity', keywords: 'electricity,전기,utility', debit_account_id: byCode.get('5200')?.id, voucher_type_id: payType?.id },
      { code: 'SALARY', name_ko: '직원 급여', name_en: 'Salary', keywords: 'salary,payroll,급여', debit_account_id: byCode.get('5200')?.id },
      { code: 'TRAVEL', name_ko: '출장비', name_en: 'Travel', keywords: 'travel,출장', debit_account_id: byCode.get('5200')?.id },
      { code: 'SUPPLY', name_ko: '소모품비', name_en: 'Supplies', keywords: 'supplies,소모품', debit_account_id: byCode.get('5200')?.id },
    ];
    for (const [idx, row] of items.entries()) {
      await (AcTransactionItem as any).create({
        tenant_id: tenantId,
        company_id: companyId,
        ...row,
        default_gst_code_id: gst18?.id ?? null,
        default_tds_code_id: row.code === 'RENT' ? tds194?.id ?? null : null,
        party_required: row.code === 'RENT',
        sort_order: idx + 1,
        is_active: true,
      });
      created.transactionItems += 1;
    }
  }

  return created;
};

export const generateVoucherNumber = async ({
  tenantId,
  companyId,
  voucherTypeId,
  voucherDate,
}: {
  tenantId: number;
  companyId: number;
  voucherTypeId: number;
  voucherDate: string;
}) => {
  const vt = await (AcVoucherType as any).findOne({
    where: { id: voucherTypeId, tenant_id: tenantId, company_id: companyId, is_active: true },
  });
  if (!vt) throw new Error('전표 유형을 찾을 수 없습니다.');

  const date = new Date(voucherDate);
  const fyLabel = getFinancialYearLabel(date);
  const prefix = `${vt.prefix}/${fyLabel}/`;

  const last = await (GlVoucher as any).findOne({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      voucher_no: { [Op.like]: `${prefix}%` },
    },
    order: [['id', 'DESC']],
  });
  const lastSeq = last ? Number(String(last.voucher_no).split('/').pop() || 0) : 0;
  return `${prefix}${String(lastSeq + 1).padStart(5, '0')}`;
};

const resolveAccountById = async (tenantId: number, companyId: number, accountId?: number | null) => {
  if (!accountId) return null;
  return (GlAccount as any).findOne({
    where: { id: accountId, tenant_id: tenantId, company_id: companyId, is_active: true, account_type: 'ledger' },
  });
};

export const buildSimpleVoucherPreview = async ({
  tenantId,
  companyId,
  input,
}: {
  tenantId: number;
  companyId: number;
  input: SimpleVoucherInput;
}): Promise<{ lines: PreviewLine[]; amountDetails: Record<string, number>; totalDebit: number; totalCredit: number; balanced: boolean }> => {
  await ensureAccountingMasters({ tenantId, companyId });

  const taxable = round2(parseAmount(input.taxableAmount));
  const discount = round2(parseAmount(input.discount));
  const otherCharges = round2(parseAmount(input.otherCharges));
  const baseAmount = round2(Math.max(0, taxable - discount + otherCharges));

  let gstCode = null;
  if (input.gstCodeId) {
    gstCode = await (AcGstCode as any).findOne({
      where: { id: input.gstCodeId, tenant_id: tenantId, company_id: companyId, is_active: true },
    });
  }

  let tdsCode = null;
  if (input.tdsCodeId) {
    tdsCode = await (AcTdsCode as any).findOne({
      where: { id: input.tdsCodeId, tenant_id: tenantId, company_id: companyId, is_active: true },
    });
  }

  let transactionItem = null;
  if (input.transactionItemId) {
    transactionItem = await (AcTransactionItem as any).findOne({
      where: { id: input.transactionItemId, tenant_id: tenantId, company_id: companyId, is_active: true },
    });
    if (!gstCode && transactionItem?.default_gst_code_id) {
      gstCode = await (AcGstCode as any).findByPk(transactionItem.default_gst_code_id);
    }
    if (!tdsCode && transactionItem?.default_tds_code_id) {
      tdsCode = await (AcTdsCode as any).findByPk(transactionItem.default_tds_code_id);
    }
  }

  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  if (gstCode) {
    if (input.isInterState) {
      igst = round2((baseAmount * parseAmount(gstCode.igst_rate)) / 100);
    } else {
      cgst = round2((baseAmount * parseAmount(gstCode.cgst_rate)) / 100);
      sgst = round2((baseAmount * parseAmount(gstCode.sgst_rate)) / 100);
    }
  }
  const gstTotal = round2(cgst + sgst + igst);
  const grossTotal = round2(baseAmount + gstTotal);

  let tdsAmount = 0;
  if (tdsCode) {
    tdsAmount = round2((baseAmount * parseAmount(tdsCode.company_rate)) / 100);
  }

  const roundOff = round2(parseAmount(input.roundOff));
  const totalPayable = round2(grossTotal - tdsAmount + roundOff);
  const paidAmount = round2(input.paidAmount != null ? parseAmount(input.paidAmount) : totalPayable);

  let paymentAccount = null;
  if (input.paymentAccountId) {
    paymentAccount = await resolveAccountById(tenantId, companyId, input.paymentAccountId);
  } else if (input.bankAccountId) {
    const bank = await (AcBankAccount as any).findOne({
      where: { id: input.bankAccountId, tenant_id: tenantId, company_id: companyId, is_active: true },
    });
    if (bank?.ledger_account_id) {
      paymentAccount = await resolveAccountById(tenantId, companyId, bank.ledger_account_id);
    }
  }
  if (!paymentAccount) {
    paymentAccount = await (GlAccount as any).findOne({
      where: { tenant_id: tenantId, company_id: companyId, code: '1102', is_active: true, account_type: 'ledger' },
    });
  }

  const expenseAccount = transactionItem?.debit_account_id
    ? await resolveAccountById(tenantId, companyId, transactionItem.debit_account_id)
    : await (GlAccount as any).findOne({
        where: { tenant_id: tenantId, company_id: companyId, code: '5200', is_active: true, account_type: 'ledger' },
      });

  const lines: PreviewLine[] = [];
  let lineNo = 1;

  if (expenseAccount && baseAmount > 0) {
    lines.push({
      lineNo: lineNo++,
      lineCategory: 'expense',
      accountId: expenseAccount.id,
      accountName: expenseAccount.name,
      partyId: input.partyId,
      debit: baseAmount,
      credit: 0,
      taxableAmount: baseAmount,
      narration: input.narration,
    });
  }

  if (cgst > 0) {
    const acct = gstCode?.input_account_id
      ? await resolveAccountById(tenantId, companyId, gstCode.input_account_id)
      : await (GlAccount as any).findOne({ where: { tenant_id: tenantId, company_id: companyId, code: '2102', is_active: true } });
    lines.push({
      lineNo: lineNo++,
      lineCategory: 'gst',
      accountId: acct?.id,
      accountName: acct?.name || 'Input CGST',
      debit: cgst,
      credit: 0,
      gstCodeId: gstCode?.id,
      taxAmount: cgst,
      narration: 'CGST',
    });
  }

  if (sgst > 0) {
    const acct = gstCode?.input_account_id
      ? await resolveAccountById(tenantId, companyId, gstCode.input_account_id)
      : await (GlAccount as any).findOne({ where: { tenant_id: tenantId, company_id: companyId, code: '2102', is_active: true } });
    lines.push({
      lineNo: lineNo++,
      lineCategory: 'gst',
      accountId: acct?.id,
      accountName: acct?.name || 'Input SGST',
      debit: sgst,
      credit: 0,
      gstCodeId: gstCode?.id,
      taxAmount: sgst,
      narration: 'SGST',
    });
  }

  if (igst > 0) {
    const acct = gstCode?.input_account_id
      ? await resolveAccountById(tenantId, companyId, gstCode.input_account_id)
      : await (GlAccount as any).findOne({ where: { tenant_id: tenantId, company_id: companyId, code: '2102', is_active: true } });
    lines.push({
      lineNo: lineNo++,
      lineCategory: 'gst',
      accountId: acct?.id,
      accountName: acct?.name || 'Input IGST',
      debit: igst,
      credit: 0,
      gstCodeId: gstCode?.id,
      taxAmount: igst,
      narration: 'IGST',
    });
  }

  if (paymentAccount && paidAmount > 0) {
    lines.push({
      lineNo: lineNo++,
      lineCategory: 'payment',
      accountId: paymentAccount.id,
      accountName: paymentAccount.name,
      debit: 0,
      credit: paidAmount,
      narration: input.narration,
    });
  }

  if (tdsAmount > 0) {
    const tdsAcct = tdsCode?.payable_account_id
      ? await resolveAccountById(tenantId, companyId, tdsCode.payable_account_id)
      : await (GlAccount as any).findOne({ where: { tenant_id: tenantId, company_id: companyId, code: '2101', is_active: true } });
    lines.push({
      lineNo: lineNo++,
      lineCategory: 'tds',
      accountId: tdsAcct?.id,
      accountName: tdsAcct?.name || 'TDS Payable',
      debit: 0,
      credit: tdsAmount,
      tdsCodeId: tdsCode?.id,
      taxAmount: tdsAmount,
      narration: tdsCode?.section || 'TDS',
    });
  }

  const totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0));

  return {
    lines,
    amountDetails: {
      taxableAmount: taxable,
      discount,
      otherCharges,
      baseAmount,
      cgst,
      sgst,
      igst,
      gstTotal,
      tdsAmount,
      roundOff,
      grossTotal,
      totalPayable,
      paidAmount,
      outstanding: round2(totalPayable - paidAmount),
    },
    totalDebit,
    totalCredit,
    balanced: Math.abs(totalDebit - totalCredit) < 0.01,
  };
};

export const validateVoucherInput = async ({
  tenantId,
  companyId,
  input,
  lines,
  requireBalanced = true,
}: {
  tenantId: number;
  companyId: number;
  input: {
    voucherDate: string;
    voucherTypeId?: number;
    partyId?: number;
    financialYearId?: number;
  };
  lines: PreviewLine[];
  requireBalanced?: boolean;
}) => {
  const errors: string[] = [];

  if (!input.voucherDate) errors.push('거래일을 입력해 주세요.');

  if (input.financialYearId) {
    const fy = await (AcFinancialYear as any).findOne({
      where: { id: input.financialYearId, tenant_id: tenantId, company_id: companyId, is_active: true },
    });
    if (!fy) errors.push('회계연도를 찾을 수 없습니다.');
    else if (!fy.is_open) errors.push('선택한 회계연도는 마감되어 전표를 입력할 수 없습니다.');
    else if (input.voucherDate < fy.start_date || input.voucherDate > fy.end_date) {
      errors.push('거래일이 회계연도 범위를 벗어났습니다.');
    }
  }

  if (input.voucherTypeId) {
    const vt = await (AcVoucherType as any).findOne({
      where: { id: input.voucherTypeId, tenant_id: tenantId, company_id: companyId, is_active: true },
    });
    if (!vt) errors.push('전표 유형을 찾을 수 없습니다.');
    else if (vt.requires_party && !input.partyId) errors.push('이 전표 유형은 거래처 선택이 필수입니다.');
  }

  if (!lines.length) errors.push('전표 라인이 없습니다.');

  const totalDebit = round2(lines.reduce((s, l) => s + parseAmount(l.debit), 0));
  const totalCredit = round2(lines.reduce((s, l) => s + parseAmount(l.credit), 0));

  if (totalDebit <= 0 && totalCredit <= 0) errors.push('금액이 0입니다. 금액을 입력해 주세요.');

  if (requireBalanced && Math.abs(totalDebit - totalCredit) >= 0.01) {
    errors.push(`차변과 대변의 금액이 ₹${Math.abs(totalDebit - totalCredit).toLocaleString('en-IN')}만큼 일치하지 않습니다. 계정별 금액을 다시 확인해 주세요.`);
  }

  return { valid: errors.length === 0, errors, totalDebit, totalCredit };
};
