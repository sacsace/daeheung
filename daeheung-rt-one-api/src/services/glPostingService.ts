import { Op, Transaction } from 'sequelize';
import sequelize from '../config/database';
import GlAccount from '../models/GlAccount';
import GlVoucher from '../models/GlVoucher';
import GlVoucherLine from '../models/GlVoucherLine';
import { resolveLedgerStrict } from '../utils/accountResolution';
import { ensureDefaultChartOfAccounts } from './chartOfAccountsService';

export type VoucherLineInput = {
  lineNo?: number;
  accountId?: number;
  accountName?: string;
  debit?: number;
  credit?: number;
  narration?: string;
};

const round2 = (n: number) => Number((Number(n) || 0).toFixed(2));
const parseAmount = (value: unknown) => {
  if (value == null) return 0;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

export { ensureDefaultChartOfAccounts } from './chartOfAccountsService';

export const computeTotals = (lines: VoucherLineInput[]) => {
  const totalDebit = round2(lines.reduce((sum, line) => sum + parseAmount(line.debit), 0));
  const totalCredit = round2(lines.reduce((sum, line) => sum + parseAmount(line.credit), 0));
  return { totalDebit, totalCredit };
};

export const assertBalanced = (lines: VoucherLineInput[]) => {
  const { totalDebit, totalCredit } = computeTotals(lines);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`복식부기 불일치: 차변 ${totalDebit} / 대변 ${totalCredit}`);
  }
  if (totalDebit <= 0) {
    throw new Error('전표 금액이 0입니다. 차변·대변 금액을 입력해 주세요.');
  }
  return { totalDebit, totalCredit };
};

const applyBalanceDelta = (nature: string, debit: number, credit: number) => {
  if (nature === 'asset' || nature === 'expense') {
    return debit - credit;
  }
  return credit - debit;
};

export const resolveAccount = async ({
  tenantId,
  companyId,
  accountId,
  accountName,
  userId,
  allowUnclassifiedFallback = false,
}: {
  tenantId: number;
  companyId: number;
  accountId?: number;
  accountName?: string;
  userId?: number;
  /** Only for legacy callers that explicitly opt in — prefer false */
  allowUnclassifiedFallback?: boolean;
}) => {
  await ensureDefaultChartOfAccounts({ tenantId, companyId, userId });

  const resolved = await resolveLedgerStrict({
    tenantId,
    companyId,
    accountId,
    accountName,
    allowPartialName: false,
  });
  if (resolved) {
    const row = await (GlAccount as any).findByPk(resolved.id);
    if (row) return row;
  }

  if (allowUnclassifiedFallback) {
    const fallback = await (GlAccount as any).findOne({
      where: { tenant_id: tenantId, company_id: companyId, code: '5299', is_active: true },
    });
    if (fallback) return fallback;
  }

  throw new Error(`계정과목을 찾을 수 없습니다: ${String(accountName || accountId || '').trim() || '(empty)'}`);
};

export const generateVoucherNo = async (tenantId: number, companyId: number) => {
  const year = new Date().getFullYear();
  const prefix = `JV-${year}-`;
  const last = await (GlVoucher as any).findOne({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      voucher_no: { [Op.like]: `${prefix}%` },
    },
    order: [['id', 'DESC']],
  });
  const lastSeq = last ? Number(String(last.voucher_no).split('-').pop() || 0) : 0;
  return `${prefix}${String(lastSeq + 1).padStart(5, '0')}`;
};

export const postVoucherToLedger = async ({
  voucherId,
  tenantId,
  companyId,
  userId,
  transaction,
}: {
  voucherId: number;
  tenantId: number;
  companyId: number;
  userId: number;
  transaction?: Transaction;
}) => {
  const run = async (t: Transaction) => {
    const voucher = await (GlVoucher as any).findOne({
      where: { id: voucherId, tenant_id: tenantId, company_id: companyId, is_active: true },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!voucher) throw new Error('전표를 찾을 수 없습니다.');
    if (voucher.status === 'posted') throw new Error('이미 장부에 반영된 전표입니다.');

    const lines = await (GlVoucherLine as any).findAll({
      where: { voucher_id: voucher.id },
      order: [['line_no', 'ASC']],
      transaction: t,
    });
    if (!lines.length) throw new Error('전표 라인이 없습니다.');

    for (const line of lines) {
      const account = await (GlAccount as any).findOne({
        where: { id: line.account_id, tenant_id: tenantId, company_id: companyId, is_active: true },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!account || account.account_type !== 'ledger') {
        throw new Error(`장부 계정이 아닙니다: ${line.account_name}`);
      }
      const debit = parseAmount(line.debit);
      const credit = parseAmount(line.credit);
      const delta = applyBalanceDelta(String(account.nature), debit, credit);
      const nextBalance = round2(parseAmount(account.current_balance) + delta);
      await account.update({ current_balance: nextBalance, updated_by: userId }, { transaction: t });
    }

    await voucher.update(
      {
        status: 'posted',
        posted_by: userId,
        posted_at: new Date(),
        updated_by: userId,
      },
      { transaction: t }
    );

    return voucher;
  };

  if (transaction) return run(transaction);
  return sequelize.transaction(run);
};

export const createGlVoucherWithLines = async ({
  tenantId,
  companyId,
  userId,
  voucherType,
  voucherDate,
  narration,
  lines,
  sourceType,
  sourceId,
  sourceCorrelationId,
  postImmediately = false,
  voucherNo: customVoucherNo,
}: {
  tenantId: number;
  companyId: number;
  userId: number;
  voucherType?: string;
  voucherDate: string;
  narration?: string;
  lines: VoucherLineInput[];
  sourceType?: 'manual' | 'auto_voucher' | 'sap_import' | 'tally_import' | 'bank_import' | 'ocr' | 'api';
  sourceId?: number;
  sourceCorrelationId?: string;
  postImmediately?: boolean;
  voucherNo?: string;
}) => {
  const normalized = lines.map((line, index) => ({
    lineNo: Number(line.lineNo || index + 1),
    accountId: line.accountId,
    accountName: String(line.accountName || '').trim(),
    debit: round2(parseAmount(line.debit)),
    credit: round2(parseAmount(line.credit)),
    narration: line.narration ? String(line.narration) : undefined,
  }));

  const { totalDebit, totalCredit } = assertBalanced(normalized);

  return sequelize.transaction(async (t) => {
    if (sourceType && sourceId) {
      const dup = await (GlVoucher as any).findOne({
        where: {
          tenant_id: tenantId,
          company_id: companyId,
          source_type: sourceType,
          source_id: sourceId,
          status: { [Op.ne]: 'cancelled' },
          is_active: true,
        },
        transaction: t,
      });
      if (dup) {
        throw new Error('이미 장부에 반영된 전표입니다.');
      }
    }

    const voucherNo = customVoucherNo || (await generateVoucherNo(tenantId, companyId));
    const voucher = await (GlVoucher as any).create(
      {
        tenant_id: tenantId,
        company_id: companyId,
        voucher_no: voucherNo,
        voucher_type: voucherType || 'journal',
        voucher_date: voucherDate,
        narration: narration || null,
        status: 'draft',
        source_type: sourceType || null,
        source_id: sourceId || null,
        source_correlation_id: sourceCorrelationId || null,
        total_debit: totalDebit,
        total_credit: totalCredit,
        created_by: userId,
        updated_by: userId,
        is_active: true,
      },
      { transaction: t }
    );

    for (const line of normalized) {
      const account = await resolveAccount({
        tenantId,
        companyId,
        accountId: line.accountId,
        accountName: line.accountName,
        userId,
      });
      await (GlVoucherLine as any).create(
        {
          voucher_id: voucher.id,
          account_id: account.id,
          line_no: line.lineNo,
          account_name: account.name,
          debit: line.debit,
          credit: line.credit,
          narration: line.narration || null,
        },
        { transaction: t }
      );
    }

    if (postImmediately) {
      await postVoucherToLedger({ voucherId: voucher.id, tenantId, companyId, userId, transaction: t });
      await voucher.reload({ transaction: t });
    }

    return voucher;
  });
};

export const postAutoVoucherToLedger = async ({
  autoVoucher,
  userId,
}: {
  autoVoucher: any;
  userId: number;
}) => {
  const lines = Array.isArray(autoVoucher.final_lines) ? autoVoucher.final_lines : [];
  const mapped: VoucherLineInput[] = lines.map((line: any, index: number) => ({
    lineNo: Number(line?.lineNo || index + 1),
    accountId: line?.accountId != null ? Number(line.accountId) : undefined,
    accountName: String(line?.accountName || '').trim(),
    debit: parseAmount(line?.debit),
    credit: parseAmount(line?.credit),
    narration: line?.narration ? String(line.narration) : undefined,
  }));

  return createGlVoucherWithLines({
    tenantId: autoVoucher.tenant_id,
    companyId: autoVoucher.company_id,
    userId,
    voucherType: 'journal',
    voucherDate: autoVoucher.transaction_date || new Date().toISOString().slice(0, 10),
    narration:
      autoVoucher.narration ||
      `${autoVoucher.voucher_code} / ${autoVoucher.counterparty_name || autoVoucher.source_file_name || ''}`.trim(),
    lines: mapped,
    sourceType: 'auto_voucher',
    sourceId: autoVoucher.id,
    postImmediately: true,
  });
};
