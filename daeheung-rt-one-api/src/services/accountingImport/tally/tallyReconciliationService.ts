import Decimal from 'decimal.js';
import { Op } from 'sequelize';
import AcImportBatch from '../../../models/AcImportBatch';
import AcImportBatchDocument from '../../../models/AcImportBatchDocument';
import AcImportSourceDocument from '../../../models/AcImportSourceDocument';
import GlVoucher from '../../../models/GlVoucher';
import GlVoucherLine from '../../../models/GlVoucherLine';

type Amounts = { debit: Decimal; credit: Decimal };

const emptyAmounts = (): Amounts => ({ debit: new Decimal(0), credit: new Decimal(0) });

const normalizedLedgerName = (value: unknown) =>
  String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim();

const sourceLedgerKey = (accountId: unknown, ledgerName: unknown) => {
  const id = Number(accountId);
  return Number.isInteger(id) && id > 0 ? `account:${id}` : `source:${normalizedLedgerName(ledgerName)}`;
};

const toDecimal = (value: unknown) => {
  if (value == null || value === '') return new Decimal(0);
  if (value instanceof Decimal) return value;
  if (typeof value === 'number' || typeof value === 'string') {
    try {
      return new Decimal(value);
    } catch {
      return new Decimal(0);
    }
  }
  try {
    return new Decimal(String(value));
  } catch {
    return new Decimal(0);
  }
};

const addAmount = (amounts: Amounts, debit: unknown, credit: unknown) => {
  amounts.debit = amounts.debit.plus(toDecimal(debit));
  amounts.credit = amounts.credit.plus(toDecimal(credit));
};

const serialiseAmounts = (amounts: Amounts) => ({
  debit: amounts.debit.toFixed(2),
  credit: amounts.credit.toFixed(2),
});

export const reconcileTallyImportBatch = async ({
  batchId,
  tenantId,
  companyId,
}: {
  batchId: number;
  tenantId: number;
  companyId: number;
}) => {
  const batch = await (AcImportBatch as any).findOne({
    where: { id: batchId, tenant_id: tenantId, company_id: companyId, source_system: 'tally' },
  });
  if (!batch) throw new Error('Tally Import Batch를 찾을 수 없습니다.');

  const batchDocuments = await (AcImportBatchDocument as any).findAll({
    where: { batch_id: batchId },
    include: [{ model: AcImportSourceDocument, as: 'sourceDocument', required: true }],
    order: [['id', 'ASC']],
  });
  const sourceDocuments = batchDocuments.map((link: any) => link.sourceDocument).filter(Boolean);
  const voucherIds = sourceDocuments
    .map((document: any) => Number(document.voucher_id))
    .filter((id: number) => Number.isInteger(id) && id > 0);
  const activeVouchers = voucherIds.length
    ? await (GlVoucher as any).findAll({
        where: {
          id: voucherIds,
          tenant_id: tenantId,
          company_id: companyId,
          source_type: 'tally_import',
          is_active: true,
          status: { [Op.ne]: 'cancelled' },
        },
        attributes: ['id'],
      })
    : [];
  const activeVoucherIds = activeVouchers.map((voucher: any) => Number(voucher.id));
  const voucherLines = activeVoucherIds.length
    ? await (GlVoucherLine as any).findAll({
        where: { voucher_id: activeVoucherIds },
        attributes: ['voucher_id', 'account_id', 'account_name', 'debit', 'credit'],
      })
    : [];

  const sourceTotals = emptyAmounts();
  const mvsTotals = emptyAmounts();
  const sourceLedgers = new Map<string, Amounts>();
  const mvsLedgers = new Map<string, Amounts>();
  const ledgerLabels = new Map<string, string>();

  for (const document of sourceDocuments) {
    const raw = document.raw_document || {};
    const normalized = document.normalized_document || {};
    const lineMappings = Array.isArray(normalized.lineMappings) ? normalized.lineMappings : [];
    const lines = Array.isArray(raw.lines) ? raw.lines : [];
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      const mapping = lineMappings[lineIndex];
      addAmount(sourceTotals, line.debit, line.credit);
      const key = sourceLedgerKey(mapping?.mvsAccountId, line.ledgerName);
      if (!key) continue;
      const ledger = sourceLedgers.get(key) || emptyAmounts();
      addAmount(ledger, line.debit, line.credit);
      sourceLedgers.set(key, ledger);
      ledgerLabels.set(key, mapping?.mvsAccountName || String(line.ledgerName || key));
    }
  }

  for (const line of voucherLines) {
    addAmount(mvsTotals, line.debit, line.credit);
    const key = sourceLedgerKey(line.account_id, line.account_name);
    if (!key) continue;
    const ledger = mvsLedgers.get(key) || emptyAmounts();
    addAmount(ledger, line.debit, line.credit);
    mvsLedgers.set(key, ledger);
    if (!ledgerLabels.has(key)) ledgerLabels.set(key, String(line.account_name || key));
  }

  const allLedgerKeys = new Set([...sourceLedgers.keys(), ...mvsLedgers.keys()]);
  const ledgerDifferences = [...allLedgerKeys]
    .map((ledger) => {
      const source = sourceLedgers.get(ledger) || emptyAmounts();
      const mvs = mvsLedgers.get(ledger) || emptyAmounts();
      const difference = {
        debit: source.debit.minus(mvs.debit),
        credit: source.credit.minus(mvs.credit),
      };
      return { ledger, label: ledgerLabels.get(ledger) || ledger, source, mvs, difference };
    })
    .filter((row) => !row.difference.debit.isZero() || !row.difference.credit.isZero())
    .sort((a, b) => a.ledger.localeCompare(b.ledger));

  const debitDifference = sourceTotals.debit.minus(mvsTotals.debit);
  const creditDifference = sourceTotals.credit.minus(mvsTotals.credit);
  const voucherCountMatches = sourceDocuments.length === activeVoucherIds.length;
  const totalsMatch = debitDifference.isZero() && creditDifference.isZero();
  const ledgerMovementsMatch = ledgerDifferences.length === 0;

  return {
    batch: {
      id: batch.id,
      status: batch.status,
      fileName: batch.file_name,
      completedAt: batch.completed_at,
    },
    scope: 'voucher-movements-only',
    note: '기초잔액·Tally Trial Balance 원본은 별도 Scan 단계가 구현된 후 전체 Trial Balance 대사에 포함됩니다.',
    checks: {
      voucherCount: {
        status: voucherCountMatches ? 'PASS' : 'FAIL',
        source: sourceDocuments.length,
        mvs: activeVoucherIds.length,
      },
      debitTotal: {
        status: debitDifference.isZero() ? 'PASS' : 'FAIL',
        source: sourceTotals.debit.toFixed(2),
        mvs: mvsTotals.debit.toFixed(2),
        difference: debitDifference.toFixed(2),
      },
      creditTotal: {
        status: creditDifference.isZero() ? 'PASS' : 'FAIL',
        source: sourceTotals.credit.toFixed(2),
        mvs: mvsTotals.credit.toFixed(2),
        difference: creditDifference.toFixed(2),
      },
      ledgerMovements: {
        status: ledgerMovementsMatch ? 'PASS' : 'FAIL',
        differenceCount: ledgerDifferences.length,
      },
    },
    status: voucherCountMatches && totalsMatch && ledgerMovementsMatch ? 'PASS' : 'FAIL',
    ledgerDifferenceTotal: ledgerDifferences.length,
    ledgerDifferences: ledgerDifferences.slice(0, 100).map((row) => ({
      ledger: row.label,
      source: serialiseAmounts(row.source),
      mvs: serialiseAmounts(row.mvs),
      difference: serialiseAmounts(row.difference),
    })),
  };
};
