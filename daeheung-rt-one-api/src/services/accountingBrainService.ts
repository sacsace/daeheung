/**
 * MVS Accounting Brain Service
 *
 * Recommend-only accounting intelligence.
 * NEVER imports glPostingService.
 * NEVER posts vouchers.
 *
 * Priority:
 * 1. Accounting masters (AcTransactionItem)
 * 2. Company custom AutoVoucherRule
 * 3. Historical AutoVoucher / posted GL patterns
 * 4. Learning corrections (only when defaults/fallback)
 * 5. Built-in keyword fallbacks (mapped to seeded COA name_en)
 * 6. Unclassified fallback (needs review)
 * LLM: narrative always; ledger override only when rule priority < 70
 */

import crypto from 'crypto';
import { Op } from 'sequelize';
import {
  AcFinancialYear,
  AcTransactionItem,
  AiLearningCorrection,
  AccountingBrainAuditLog,
  AutoVoucher,
  AutoVoucherRule,
  GlAccount,
  GlVoucher,
  GlVoucherLine,
  Partner,
  Customer,
  Invoice,
  ExpenseReport,
} from '../models';
import { reasonOverRetrievedContext } from './accountingBrainLlmService';
import { resolveLedgerStrict } from '../utils/accountResolution';
import { ensureDefaultChartOfAccounts } from './chartOfAccountsService';

export type BrainVoucherLine = {
  lineNo: number;
  accountId?: number | null;
  accountName: string;
  debit: number;
  credit: number;
  taxType?: string;
  taxRate?: number;
  narration?: string;
};

export type BrainRecommendInput = {
  tenantId: number;
  companyId: number;
  userId?: number;
  financialYearId?: number | null;
  source?: string;
  description?: string;
  sourceDocType?: string;
  vendorName?: string;
  customerName?: string;
  invoiceNumber?: string;
  amount?: number;
  currency?: string;
  transactionDate?: string;
  gstin?: string;
  ocrText?: string;
  narration?: string;
};

export type BrainAppliedRule = {
  priority: number;
  layer: 'accounting_master' | 'company_rule' | 'learning' | 'history' | 'default' | 'fallback';
  code: string;
  reason: string;
};

export type BrainRecommendation = {
  requestId: string;
  voucherTypeHint: string;
  transactionType: string;
  debitLedger: { accountId?: number | null; accountName: string };
  creditLedger: { accountId?: number | null; accountName: string };
  gstLedger?: { accountId?: number | null; accountName: string } | null;
  tdsLedger?: { accountId?: number | null; accountName: string } | null;
  party?: { id?: number | null; name?: string | null } | null;
  costCenter?: string | null;
  project?: string | null;
  narration: string;
  lines: BrainVoucherLine[];
  confidenceScore: number;
  needsReview: boolean;
  reasons: string[];
  appliedRules: BrainAppliedRule[];
  historicalMatches: Array<{
    source: string;
    id?: number;
    code?: string;
    counterparty?: string;
    similarity: string;
  }>;
  duplicateCheck: {
    hasDuplicate: boolean;
    matchedCount: number;
    matchedVoucherCodes: string[];
  };
  validation: {
    balanced: boolean;
    totalDebit: number;
    totalCredit: number;
    messages: string[];
  };
  financialYear?: { id: number; name?: string; isOpen?: boolean } | null;
  disclaimer: string;
};

const round2 = (n: number) => Number((Number(n) || 0).toFixed(2));
const parseAmount = (value: unknown) => {
  if (value == null) return 0;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};
const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));

const DEFAULT_RULES = [
  {
    keyword: 'salary',
    debitAccount: 'Office Expense',
    creditAccount: 'Bank Account',
    transactionType: 'salary',
    reason: 'Keyword salary matched default accounting pattern',
    confidenceBoost: 18,
  },
  {
    keyword: 'rent',
    debitAccount: 'Office Expense',
    creditAccount: 'Accounts Payable',
    transactionType: 'expense',
    reason: 'Keyword rent matched default accounting pattern',
    confidenceBoost: 20,
  },
  {
    keyword: 'indian oil',
    debitAccount: 'Purchase Expense',
    creditAccount: 'Bank Account',
    transactionType: 'expense',
    reason: 'Vendor Indian Oil matched default accounting pattern',
    confidenceBoost: 22,
  },
  {
    keyword: 'amazon',
    debitAccount: 'Office Expense',
    creditAccount: 'Accounts Payable',
    transactionType: 'expense',
    reason: 'Vendor Amazon matched default accounting pattern',
    confidenceBoost: 20,
  },
  {
    keyword: 'gst challan',
    debitAccount: 'GST Payable',
    creditAccount: 'Bank Account',
    transactionType: 'gst_payment',
    reason: 'GST challan keyword matched',
    confidenceBoost: 24,
  },
  {
    keyword: 'tds challan',
    debitAccount: 'GST Payable',
    creditAccount: 'Bank Account',
    transactionType: 'tds_payment',
    reason: 'TDS challan keyword matched (mapped to tax payable ledger when dedicated TDS ledger absent)',
    confidenceBoost: 18,
  },
  {
    keyword: 'interest',
    debitAccount: 'Bank Account',
    creditAccount: 'Other Income',
    transactionType: 'interest_income',
    reason: 'Interest keyword matched',
    confidenceBoost: 12,
  },
  {
    keyword: 'emi',
    debitAccount: 'Accounts Payable',
    creditAccount: 'Bank Account',
    transactionType: 'loan_payment',
    reason: 'EMI keyword matched',
    confidenceBoost: 14,
  },
];

const buildCorpus = (input: BrainRecommendInput) =>
  [
    input.description,
    input.vendorName,
    input.customerName,
    input.invoiceNumber,
    input.narration,
    input.ocrText,
    input.sourceDocType,
    input.gstin,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const resolveAccountByName = async (tenantId: number, companyId: number, name: string) => {
  await ensureDefaultChartOfAccounts({ tenantId, companyId });
  const resolved = await resolveLedgerStrict({
    tenantId,
    companyId,
    accountName: name,
    allowPartialName: false,
  });
  if (!resolved) return null;
  return (GlAccount as any).findByPk(resolved.id);
};

const resolveAccountById = async (tenantId: number, companyId: number, accountId?: number | null) => {
  if (!accountId) return null;
  const resolved = await resolveLedgerStrict({
    tenantId,
    companyId,
    accountId,
    allowPartialName: false,
  });
  if (!resolved) return null;
  return (GlAccount as any).findByPk(resolved.id);
};

const buildLines = ({
  amount,
  debit,
  credit,
  narration,
}: {
  amount: number;
  debit: { accountId?: number | null; accountName: string };
  credit: { accountId?: number | null; accountName: string };
  narration?: string;
}): BrainVoucherLine[] => {
  const safeAmount = round2(amount > 0 ? amount : 0);
  return [
    {
      lineNo: 1,
      accountId: debit.accountId ?? null,
      accountName: debit.accountName,
      debit: safeAmount,
      credit: 0,
      narration: narration || '',
    },
    {
      lineNo: 2,
      accountId: credit.accountId ?? null,
      accountName: credit.accountName,
      debit: 0,
      credit: safeAmount,
      narration: narration || '',
    },
  ];
};

const computeTotals = (lines: BrainVoucherLine[]) => {
  const totalDebit = round2(lines.reduce((sum, line) => sum + parseAmount(line.debit), 0));
  const totalCredit = round2(lines.reduce((sum, line) => sum + parseAmount(line.credit), 0));
  return { totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) <= 0.01 };
};

const findOpenFinancialYear = async (tenantId: number, companyId: number, asOfDate?: string) => {
  const date = asOfDate || new Date().toISOString().slice(0, 10);
  const fy = await (AcFinancialYear as any).findOne({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      is_active: true,
      start_date: { [Op.lte]: date },
      end_date: { [Op.gte]: date },
    },
    order: [['start_date', 'DESC']],
  });
  return fy;
};

const detectDuplicate = async (input: BrainRecommendInput) => {
  const recent = await (AutoVoucher as any).findAll({
    where: {
      tenant_id: input.tenantId,
      company_id: input.companyId,
      is_active: true,
    },
    order: [['created_at', 'DESC']],
    limit: 300,
  });

  const counterparty = input.vendorName || input.customerName || '';
  const amount = parseAmount(input.amount);
  const matches = (recent || []).filter((item: any) => {
    const byInvoice =
      input.invoiceNumber &&
      item.invoice_number &&
      String(item.invoice_number).trim().toLowerCase() === String(input.invoiceNumber).trim().toLowerCase();
    const sameDate =
      input.transactionDate &&
      item.transaction_date &&
      String(item.transaction_date) === String(input.transactionDate);
    const sameAmount = amount > 0 && Math.abs(parseAmount(item.total_debit) - amount) < 0.01;
    const sameParty =
      counterparty &&
      item.counterparty_name &&
      String(item.counterparty_name).trim().toLowerCase() === counterparty.trim().toLowerCase();
    // Require party or invoice when matching date+amount to reduce false positives
    const byDateAmountParty = Boolean(sameDate && sameAmount && (sameParty || byInvoice));
    const byCounterpartyAmount = Boolean(sameParty && sameAmount && (sameDate || byInvoice));
    return Boolean(byInvoice || byDateAmountParty || byCounterpartyAmount);
  });

  return {
    hasDuplicate: matches.length > 0,
    matchedCount: matches.length,
    matchedVoucherCodes: matches.slice(0, 5).map((x: any) => x.voucher_code),
  };
};

const searchParty = async (tenantId: number, companyId: number, name?: string) => {
  if (!name || !String(name).trim()) return null;
  const partner = await (Partner as any).findOne({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      is_active: true,
      [Op.or]: [
        { name: { [Op.iLike]: String(name).trim() } },
        { name: { [Op.iLike]: `%${String(name).trim()}%` } },
      ],
    },
  });
  if (!partner) return null;
  return { id: partner.id as number, name: String(partner.name || name) };
};

const matchTransactionItem = async (tenantId: number, companyId: number, corpus: string) => {
  const items = await (AcTransactionItem as any).findAll({
    where: { tenant_id: tenantId, company_id: companyId, is_active: true },
    order: [['sort_order', 'ASC'], ['id', 'ASC']],
  });

  for (const item of items) {
    const keywords = String(item.keywords || '')
      .split(/[,|;/\n]+/)
      .map((k: string) => k.trim().toLowerCase())
      .filter(Boolean);
    const nameHit = String(item.name_ko || '')
      .toLowerCase()
      .split(/\s+/)
      .some((token: string) => token.length > 2 && corpus.includes(token));
    const keywordHit = keywords.some((k: string) => corpus.includes(k));
    if (!keywordHit && !nameHit) continue;

    const debit = await resolveAccountById(tenantId, companyId, item.debit_account_id);
    const credit = await resolveAccountById(tenantId, companyId, item.credit_account_id);
    if (!debit && !credit) continue;

    return {
      layer: 'accounting_master' as const,
      code: `txn_item:${item.code}`,
      reason: `Matched transaction item "${item.name_ko}" from accounting masters`,
      transactionType: String(item.code || 'expense'),
      debitAccountName: debit?.name || 'Expense - Unclassified',
      debitAccountId: debit?.id ?? null,
      creditAccountName: credit?.name || 'Accounts Payable',
      creditAccountId: credit?.id ?? null,
      confidenceBoost: 28,
      priority: 100,
    };
  }
  return null;
};

const matchCompanyRule = async (
  tenantId: number,
  companyId: number,
  corpus: string,
  sourceDocType?: string
) => {
  const customRules = await (AutoVoucherRule as any).findAll({
    where: { tenant_id: tenantId, company_id: companyId, is_active: true },
    order: [['priority', 'DESC'], ['id', 'DESC']],
  });

  const customMatch = customRules.find((rule: any) => {
    const keyword = String(rule.keyword || '').trim().toLowerCase();
    if (!keyword) return false;
    if (rule.doc_type && String(rule.doc_type).trim() && sourceDocType && String(rule.doc_type) !== sourceDocType) {
      return false;
    }
    return corpus.includes(keyword);
  });

  if (!customMatch) return null;

  return {
    layer: 'company_rule' as const,
    code: `custom:${customMatch.keyword}`,
    reason:
      String(customMatch.reason_template || '').trim() ||
      `Matched company rule "${customMatch.keyword}"`,
    transactionType: String(customMatch.transaction_type || 'expense'),
    debitAccountName: String(customMatch.debit_account),
    creditAccountName: String(customMatch.credit_account),
    taxAccountName: customMatch.tax_account ? String(customMatch.tax_account) : null,
    confidenceBoost: Number(customMatch.confidence_boost || 10),
    priority: 90,
  };
};

const matchLearningCorrection = async (
  tenantId: number,
  companyId: number,
  corpus: string,
  counterparty?: string
) => {
  const corrections = await (AiLearningCorrection as any).findAll({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      is_active: true,
      field_name: { [Op.in]: ['debit_account', 'credit_account', 'accountName'] },
    },
    order: [['id', 'DESC']],
    limit: 200,
  });

  const hit = (corrections || []).find((row: any) => {
    const keyword = String(row.keyword || '').toLowerCase();
    const party = String(row.counterparty_name || '').toLowerCase();
    if (keyword && corpus.includes(keyword)) return true;
    if (party && counterparty && party === counterparty.toLowerCase()) return true;
    return false;
  });

  if (!hit) return null;

  return {
    layer: 'learning' as const,
    code: `learning:${hit.id}`,
    reason: `Matched previous accountant correction on "${hit.field_name}"`,
    fieldName: String(hit.field_name),
    afterValue: String(hit.after_value || ''),
    confidenceBoost: 16,
    priority: 80,
    snapshot: hit.recommendation_snapshot || {},
  };
};

const findHistoricalMatches = async (input: BrainRecommendInput, corpus: string) => {
  const counterparty = input.vendorName || input.customerName || '';
  const autoRows = await (AutoVoucher as any).findAll({
    where: {
      tenant_id: input.tenantId,
      company_id: input.companyId,
      is_active: true,
      status: { [Op.in]: ['approved', 'posted', 'review_required'] },
    },
    order: [['created_at', 'DESC']],
    limit: 80,
  });

  const matchedAuto = (autoRows || [])
    .filter((row: any) => {
      const party = String(row.counterparty_name || '').toLowerCase();
      const narration = String(row.narration || '').toLowerCase();
      if (counterparty && party && party.includes(counterparty.toLowerCase())) return true;
      if (corpus && narration && corpus.split(/\s+/).some((t) => t.length > 3 && narration.includes(t))) return true;
      return false;
    })
    .slice(0, 5)
    .map((row: any) => ({
      source: 'auto_voucher',
      id: Number(row.id),
      code: String(row.voucher_code || ''),
      counterparty: String(row.counterparty_name || ''),
      similarity: counterparty ? 'counterparty' : 'narration',
      suggested_lines: row.final_lines || row.suggested_lines || [],
    }));

  // Posted GL vouchers (true historical ledger patterns)
  const glWhere: any = {
    tenant_id: input.tenantId,
    company_id: input.companyId,
    status: 'posted',
    is_active: true,
  };
  if (counterparty) {
    glWhere.narration = { [Op.iLike]: `%${counterparty.slice(0, 80)}%` };
  }
  const glRows = await (GlVoucher as any).findAll({
    where: glWhere,
    include: [
      {
        model: GlVoucherLine,
        as: 'lines',
        required: false,
        attributes: ['line_no', 'account_id', 'debit', 'credit', 'narration'],
        include: [{ model: GlAccount, as: 'account', attributes: ['id', 'name', 'name_en', 'code'], required: false }],
      },
    ],
    order: [['voucher_date', 'DESC'], ['id', 'DESC']],
    limit: 15,
  });

  const matchedGl = (glRows || []).slice(0, 5).map((row: any) => {
    const lines = (row.lines || []).map((line: any, index: number) => ({
      lineNo: Number(line.line_no || index + 1),
      accountId: line.account_id ?? line.account?.id ?? null,
      accountName: String(line.account?.name_en || line.account?.name || ''),
      debit: parseAmount(line.debit),
      credit: parseAmount(line.credit),
      narration: line.narration || '',
    }));
    return {
      source: 'gl_voucher',
      id: Number(row.id),
      code: String(row.voucher_no || ''),
      counterparty: String(row.narration || '').slice(0, 80),
      similarity: counterparty ? 'narration_counterparty' : 'recent_posted',
      suggested_lines: lines,
    };
  });

  return [...matchedAuto, ...matchedGl].slice(0, 8);
};

const matchDefaultRule = (corpus: string, sourceDocType?: string) => {
  const fallback = DEFAULT_RULES.find((rule) => corpus.includes(rule.keyword));
  if (fallback) {
    return {
      layer: 'default' as const,
      code: `default:${fallback.keyword}`,
      reason: fallback.reason,
      transactionType: fallback.transactionType,
      debitAccountName: fallback.debitAccount,
      creditAccountName: fallback.creditAccount,
      confidenceBoost: fallback.confidenceBoost,
      priority: 40,
    };
  }

  if (sourceDocType === 'sales_invoice') {
    return {
      layer: 'default' as const,
      code: 'default:sales_invoice',
      reason: 'Sales invoice default mapping from document type',
      transactionType: 'sales',
      debitAccountName: 'Accounts Receivable',
      creditAccountName: 'Sales Revenue',
      taxAccountName: 'Output GST',
      confidenceBoost: 12,
      priority: 35,
    };
  }

  return {
    layer: 'fallback' as const,
    code: 'fallback:unclassified',
    reason: 'No accounting master / company rule / history match — unclassified fallback',
    transactionType: 'expense',
    debitAccountName: 'Expense - Unclassified',
    creditAccountName: 'Accounts Payable',
    confidenceBoost: 0,
    priority: 10,
  };
};

const writeBrainAudit = async (payload: {
  tenantId: number;
  companyId: number;
  userId?: number;
  financialYearId?: number | null;
  requestId: string;
  action: string;
  source?: string;
  prompt?: string;
  retrievedContext?: Record<string, unknown>;
  appliedRules?: unknown[];
  recommendation?: Record<string, unknown>;
  confidenceScore?: number;
  validationResult?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}) => {
  try {
    await (AccountingBrainAuditLog as any).create({
      tenant_id: payload.tenantId,
      company_id: payload.companyId,
      financial_year_id: payload.financialYearId || null,
      user_id: payload.userId || null,
      request_id: payload.requestId,
      action: payload.action,
      source: payload.source || 'brain',
      prompt: payload.prompt || null,
      retrieved_context: payload.retrievedContext || {},
      applied_rules: payload.appliedRules || [],
      recommendation: payload.recommendation || {},
      confidence_score: payload.confidenceScore ?? null,
      validation_result: payload.validationResult || {},
      user_changes: {},
      approval: {},
      metadata: payload.metadata || {},
    });
  } catch (err) {
    // Audit must not break recommendation path
    console.error('[AccountingBrain] audit write failed:', err);
  }
};

/**
 * Core recommend entry — NEVER posts.
 */
export const recommendVoucher = async (input: BrainRecommendInput): Promise<BrainRecommendation> => {
  const requestId = crypto.randomUUID();
  const corpus = buildCorpus(input);
  const amount = parseAmount(input.amount);
  const counterpartyName = input.vendorName || input.customerName || '';
  const narration =
    String(input.narration || input.description || input.ocrText || '').slice(0, 500) ||
    'Accounting Brain recommendation';

  const appliedRules: BrainAppliedRule[] = [];
  const reasons: string[] = [];
  const historicalMatchesRaw = await findHistoricalMatches(input, corpus);
  const duplicateCheck = await detectDuplicate(input);
  const fy = await findOpenFinancialYear(input.tenantId, input.companyId, input.transactionDate);
  const party = await searchParty(input.tenantId, input.companyId, counterpartyName);

  let debitAccountName = 'Expense - Unclassified';
  let creditAccountName = 'Accounts Payable';
  let debitAccountId: number | null = null;
  let creditAccountId: number | null = null;
  let taxAccountName: string | null = null;
  let transactionType = 'expense';
  let confidenceBoost = 0;
  let needsReview = false;

  const txnItem = await matchTransactionItem(input.tenantId, input.companyId, corpus);
  const companyRule = !txnItem
    ? await matchCompanyRule(input.tenantId, input.companyId, corpus, input.sourceDocType)
    : null;
  const learning = await matchLearningCorrection(
    input.tenantId,
    input.companyId,
    corpus,
    counterpartyName
  );

  if (txnItem) {
    debitAccountName = txnItem.debitAccountName;
    creditAccountName = txnItem.creditAccountName;
    debitAccountId = txnItem.debitAccountId;
    creditAccountId = txnItem.creditAccountId;
    transactionType = txnItem.transactionType;
    confidenceBoost = txnItem.confidenceBoost;
    appliedRules.push({
      priority: txnItem.priority,
      layer: txnItem.layer,
      code: txnItem.code,
      reason: txnItem.reason,
    });
    reasons.push(txnItem.reason);
  } else if (companyRule) {
    debitAccountName = companyRule.debitAccountName;
    creditAccountName = companyRule.creditAccountName;
    taxAccountName = companyRule.taxAccountName;
    transactionType = companyRule.transactionType;
    confidenceBoost = companyRule.confidenceBoost;
    appliedRules.push({
      priority: companyRule.priority,
      layer: companyRule.layer,
      code: companyRule.code,
      reason: companyRule.reason,
    });
    reasons.push(companyRule.reason);

    const debitResolved = await resolveAccountByName(input.tenantId, input.companyId, debitAccountName);
    const creditResolved = await resolveAccountByName(input.tenantId, input.companyId, creditAccountName);
    debitAccountId = debitResolved?.id ?? null;
    creditAccountId = creditResolved?.id ?? null;
  } else if (historicalMatchesRaw.length > 0 && Array.isArray(historicalMatchesRaw[0].suggested_lines)) {
    const histLines = historicalMatchesRaw[0].suggested_lines as any[];
    const debitLine = histLines.find((l) => parseAmount(l.debit) > 0) || histLines[0];
    const creditLine = histLines.find((l) => parseAmount(l.credit) > 0) || histLines[1];
    debitAccountName = String(debitLine?.accountName || debitAccountName);
    creditAccountName = String(creditLine?.accountName || creditAccountName);
    confidenceBoost = historicalMatchesRaw[0].source === 'gl_voucher' ? 18 : 14;
    transactionType = 'expense';
    appliedRules.push({
      priority: 70,
      layer: 'history',
      code: `history:${historicalMatchesRaw[0].code || historicalMatchesRaw[0].id}`,
      reason: `Historical voucher pattern matched (${historicalMatchesRaw.length} similar)`,
    });
    reasons.push(
      `Historical match: ${historicalMatchesRaw[0].code || historicalMatchesRaw[0].id} (${historicalMatchesRaw[0].similarity})`
    );
    if (debitLine?.accountId) {
      const byId = await resolveAccountById(input.tenantId, input.companyId, Number(debitLine.accountId));
      debitAccountId = byId?.id ?? null;
      if (byId) debitAccountName = byId.name_en || byId.name || debitAccountName;
    }
    if (creditLine?.accountId) {
      const byId = await resolveAccountById(input.tenantId, input.companyId, Number(creditLine.accountId));
      creditAccountId = byId?.id ?? null;
      if (byId) creditAccountName = byId.name_en || byId.name || creditAccountName;
    }
    if (!debitAccountId) {
      const debitResolved = await resolveAccountByName(input.tenantId, input.companyId, debitAccountName);
      debitAccountId = debitResolved?.id ?? null;
    }
    if (!creditAccountId) {
      const creditResolved = await resolveAccountByName(input.tenantId, input.companyId, creditAccountName);
      creditAccountId = creditResolved?.id ?? null;
    }
  } else {
    const def = matchDefaultRule(corpus, input.sourceDocType);
    debitAccountName = def.debitAccountName;
    creditAccountName = def.creditAccountName;
    taxAccountName = (def as any).taxAccountName || null;
    transactionType = def.transactionType;
    confidenceBoost = def.confidenceBoost;
    needsReview = def.layer === 'fallback';
    appliedRules.push({
      priority: def.priority,
      layer: def.layer,
      code: def.code,
      reason: def.reason,
    });
    reasons.push(def.reason);
    const debitResolved = await resolveAccountByName(input.tenantId, input.companyId, debitAccountName);
    const creditResolved = await resolveAccountByName(input.tenantId, input.companyId, creditAccountName);
    debitAccountId = debitResolved?.id ?? null;
    creditAccountId = creditResolved?.id ?? null;
  }

  // Learning: only auto-apply when no master / company rule / history won (priority stack).
  // When stronger layers win, only flag for human review.
  if (learning && learning.afterValue) {
    const topLayer = appliedRules[0]?.layer;
    const allowAutoApply = topLayer === 'default' || topLayer === 'fallback' || !topLayer;
    if (allowAutoApply) {
      if (learning.fieldName === 'debit_account' || learning.fieldName === 'accountName') {
        debitAccountName = learning.afterValue;
        const resolved = await resolveAccountByName(input.tenantId, input.companyId, debitAccountName);
        debitAccountId = resolved?.id ?? null;
      }
      if (learning.fieldName === 'credit_account') {
        creditAccountName = learning.afterValue;
        const resolved = await resolveAccountByName(input.tenantId, input.companyId, creditAccountName);
        creditAccountId = resolved?.id ?? null;
      }
      confidenceBoost += learning.confidenceBoost;
      appliedRules.push({
        priority: learning.priority,
        layer: learning.layer,
        code: learning.code,
        reason: learning.reason,
      });
      reasons.push(learning.reason);
    } else {
      needsReview = true;
      reasons.push(
        `Learning correction available (${learning.fieldName}=${learning.afterValue}) but ${topLayer} has higher priority — review required`
      );
      appliedRules.push({
        priority: learning.priority,
        layer: learning.layer,
        code: learning.code,
        reason: `${learning.reason} (not auto-applied: ${topLayer} wins)`,
      });
    }
  }

  if (!fy) {
    needsReview = true;
    reasons.push('No open financial year found for voucher date — review required');
  } else if (fy.is_open === false) {
    needsReview = true;
    reasons.push(`Financial year "${fy.name || fy.id}" is closed — review required`);
  }

  if (duplicateCheck.hasDuplicate) {
    needsReview = true;
    reasons.push(
      `Possible duplicate voucher: ${duplicateCheck.matchedVoucherCodes.join(', ') || 'matched records'}`
    );
  }

  const lines = buildLines({
    amount,
    debit: { accountId: debitAccountId, accountName: debitAccountName },
    credit: { accountId: creditAccountId, accountName: creditAccountName },
    narration,
  });
  const totals = computeTotals(lines);
  const validationMessages: string[] = [];
  if (!totals.balanced) validationMessages.push('Debit does not equal Credit');
  if (amount <= 0) {
    needsReview = true;
    validationMessages.push('Amount is missing or zero');
  }
  if (!debitAccountId || !creditAccountId) {
    needsReview = true;
    validationMessages.push('One or more ledgers could not be resolved to active GL accounts');
  }

  let confidenceScore = clamp(
    55 +
      confidenceBoost +
      (corpus.length > 20 ? 6 : 0) +
      (party ? 5 : 0) +
      (historicalMatchesRaw.length > 0 ? 4 : 0) +
      (duplicateCheck.hasDuplicate ? -25 : 0) +
      (needsReview ? -8 : 0)
  );

  // Optional LLM narrative — ledger override only when rule layer is weak (default/fallback)
  const topPriority = appliedRules[0]?.priority ?? 0;
  const coaSample = await (GlAccount as any).findAll({
    where: {
      tenant_id: input.tenantId,
      company_id: input.companyId,
      is_active: true,
      account_type: 'ledger',
    },
    attributes: ['id', 'code', 'name', 'name_en'],
    limit: 250,
    order: [['code', 'ASC']],
  });
  const draftRecommendation = {
    debitLedger: { accountId: debitAccountId, accountName: debitAccountName },
    creditLedger: { accountId: creditAccountId, accountName: creditAccountName },
    transactionType,
    confidenceScore,
    ruleLayer: appliedRules[0]?.layer,
    rulePriority: topPriority,
  };
  const llm = await reasonOverRetrievedContext({
    description: narration,
    retrievedContext: {
      accounts: (coaSample || []).map((a: any) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        nameEn: a.name_en,
      })),
      historicalMatches: historicalMatchesRaw.slice(0, 5),
      party,
      appliedRules,
    },
    ruleBasedRecommendation: draftRecommendation,
    allowLedgerOverride: topPriority < 70,
  });
  if (llm.used) {
    if (llm.narrative) reasons.push(`LLM: ${llm.narrative}`);
    if (llm.allowLedgerOverride && llm.adjustedDebitAccount) {
      debitAccountName = llm.adjustedDebitAccount;
      const resolved = await resolveAccountByName(input.tenantId, input.companyId, debitAccountName);
      debitAccountId = resolved?.id ?? debitAccountId;
      reasons.push(`LLM adjusted debit ledger to "${debitAccountName}" (COA-validated)`);
    }
    if (llm.allowLedgerOverride && llm.adjustedCreditAccount) {
      creditAccountName = llm.adjustedCreditAccount;
      const resolved = await resolveAccountByName(input.tenantId, input.companyId, creditAccountName);
      creditAccountId = resolved?.id ?? creditAccountId;
      reasons.push(`LLM adjusted credit ledger to "${creditAccountName}" (COA-validated)`);
    }
    if (!llm.allowLedgerOverride && (llm.adjustedDebitAccount || llm.adjustedCreditAccount)) {
      reasons.push('LLM suggested ledger change ignored — rule engine priority wins');
    }
    confidenceScore = clamp(confidenceScore + (llm.confidenceDelta || 0));
    appliedRules.push({
      priority: 50,
      layer: 'default',
      code: 'llm:retrieved-context',
      reason: llm.notes.join('; ') || 'LLM reasoning over retrieved context',
    });
  }

  // Rebuild lines after possible LLM ledger adjustments
  const finalLines = buildLines({
    amount,
    debit: { accountId: debitAccountId, accountName: debitAccountName },
    credit: { accountId: creditAccountId, accountName: creditAccountName },
    narration,
  });
  const finalTotals = computeTotals(finalLines);
  if (!finalTotals.balanced) validationMessages.push('Debit does not equal Credit');
  if (!debitAccountId || !creditAccountId) {
    if (!validationMessages.some((m) => m.includes('ledgers'))) {
      needsReview = true;
      validationMessages.push('One or more ledgers could not be resolved to active GL accounts');
    }
  }

  const recommendation: BrainRecommendation = {
    requestId,
    voucherTypeHint: transactionType.includes('sales')
      ? 'sales'
      : transactionType.includes('payment')
        ? 'payment'
        : transactionType.includes('receipt')
          ? 'receipt'
          : 'journal',
    transactionType,
    debitLedger: { accountId: debitAccountId, accountName: debitAccountName },
    creditLedger: { accountId: creditAccountId, accountName: creditAccountName },
    gstLedger: taxAccountName ? { accountId: null, accountName: taxAccountName } : null,
    tdsLedger: null,
    party,
    costCenter: null,
    project: null,
    narration,
    lines: finalLines,
    confidenceScore,
    needsReview,
    reasons,
    appliedRules: appliedRules.sort((a, b) => b.priority - a.priority),
    historicalMatches: historicalMatchesRaw.map((h) => ({
      source: h.source,
      id: h.id,
      code: h.code,
      counterparty: h.counterparty,
      similarity: h.similarity,
    })),
    duplicateCheck,
    validation: {
      balanced: finalTotals.balanced,
      totalDebit: finalTotals.totalDebit,
      totalCredit: finalTotals.totalCredit,
      messages: validationMessages,
    },
    financialYear: fy
      ? { id: fy.id, name: fy.name || undefined, isOpen: fy.is_open !== false }
      : null,
    disclaimer:
      'Accounting Brain only recommends. No voucher is posted. Accounting Engine validates; user must approve before ledger posting.',
  };

  await writeBrainAudit({
    tenantId: input.tenantId,
    companyId: input.companyId,
    userId: input.userId,
    financialYearId: fy?.id || input.financialYearId || null,
    requestId,
    action: 'recommend',
    source: input.source || 'api',
    prompt: narration,
    retrievedContext: {
      historicalMatchCount: historicalMatchesRaw.length,
      partyMatched: Boolean(party),
      corpusLength: corpus.length,
    },
    appliedRules,
    recommendation: recommendation as unknown as Record<string, unknown>,
    confidenceScore,
    validationResult: recommendation.validation,
    metadata: {
      sourceDocType: input.sourceDocType || null,
      invoiceNumber: input.invoiceNumber || null,
    },
  });

  return recommendation;
};

export const recordLearningCorrection = async ({
  tenantId,
  companyId,
  userId,
  sourceType = 'auto_voucher',
  sourceId,
  counterpartyName,
  keyword,
  docType,
  fieldName,
  beforeValue,
  afterValue,
  recommendationSnapshot,
}: {
  tenantId: number;
  companyId: number;
  userId?: number;
  sourceType?: string;
  sourceId?: number;
  counterpartyName?: string;
  keyword?: string;
  docType?: string;
  fieldName: string;
  beforeValue?: string;
  afterValue?: string;
  recommendationSnapshot?: Record<string, unknown>;
}) => {
  if (!afterValue || afterValue === beforeValue) return null;

  const row = await (AiLearningCorrection as any).create({
    tenant_id: tenantId,
    company_id: companyId,
    user_id: userId || null,
    source_type: sourceType,
    source_id: sourceId || null,
    counterparty_name: counterpartyName || null,
    keyword: keyword || null,
    doc_type: docType || null,
    field_name: fieldName,
    before_value: beforeValue || null,
    after_value: afterValue,
    recommendation_snapshot: recommendationSnapshot || {},
    is_active: true,
  });

  await writeBrainAudit({
    tenantId,
    companyId,
    userId,
    requestId: crypto.randomUUID(),
    action: 'learning_correction',
    source: sourceType,
    recommendation: {
      fieldName,
      beforeValue,
      afterValue,
      sourceId,
    },
    metadata: { correctionId: row.id },
  });

  return row;
};

export const answerAccountingQuestion = async ({
  tenantId,
  companyId,
  userId,
  question,
}: {
  tenantId: number;
  companyId: number;
  userId?: number;
  question: string;
}): Promise<{
  requestId: string;
  answer: string;
  reasons: string[];
  retrieved: Record<string, unknown>;
  disclaimer: string;
}> => {
  const requestId = crypto.randomUUID();
  const q = String(question || '').trim();
  const lower = q.toLowerCase();

  const accounts = await (GlAccount as any).findAll({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      is_active: true,
      account_type: 'ledger',
      [Op.or]: [
        { name: { [Op.iLike]: `%${q.slice(0, 40)}%` } },
        { code: { [Op.iLike]: `%${q.slice(0, 20)}%` } },
      ],
    },
    limit: 8,
  });

  const recentVouchers = await (GlVoucher as any).findAll({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      is_active: true,
      status: 'posted',
    },
    order: [['voucher_date', 'DESC']],
    limit: 5,
  });

  const reasons: string[] = [];
  let answer = '';

  if (lower.includes('trial balance') || lower.includes('시산')) {
    answer =
      'Trial Balance is available via Accounting Books → Trial Balance. It aggregates posted GL voucher lines by account. Accounting Brain does not recompute or post balances.';
    reasons.push('Retrieved from existing GL Trial Balance capability');
  } else if (lower.includes('gst') || lower.includes('tds')) {
    answer =
      'GST/TDS rates and ledgers come from Accounting Masters (gst-codes / tds-codes). Recommendations must use those masters — rates are never hardcoded by the Brain.';
    reasons.push('Accounting masters are the source of GST/TDS truth');
  } else if (accounts.length > 0) {
    answer = `Matching ledgers: ${accounts
      .map((a: any) => `${a.code} ${a.name}`)
      .join('; ')}. Use Chart of Accounts / Voucher Entry for posting — Brain only advises.`;
    reasons.push(`Found ${accounts.length} ledger account(s) from company COA`);
  } else if (recentVouchers.length > 0) {
    answer = `Recent posted vouchers: ${recentVouchers
      .map((v: any) => v.voucher_number || v.id)
      .join(', ')}. Ask a more specific ledger/party question for targeted advice.`;
    reasons.push(`Retrieved ${recentVouchers.length} recent posted vouchers`);
  } else {
    answer =
      'Insufficient retrieved accounting context to answer confidently. Narrow the question to a ledger, party, voucher number, GST code, or document description.';
    reasons.push('No strong COA / voucher matches — refusing to hallucinate');
  }

  const payload = {
    requestId,
    answer,
    reasons,
    retrieved: {
      accounts: accounts.map((a: any) => ({ id: a.id, code: a.code, name: a.name })),
      recentVoucherIds: recentVouchers.map((v: any) => v.id),
    },
    disclaimer:
      'Answers are based only on retrieved company accounting data. No posting or balance mutation is performed.',
  };

  await writeBrainAudit({
    tenantId,
    companyId,
    userId,
    requestId,
    action: 'qa',
    source: 'api',
    prompt: q,
    retrievedContext: payload.retrieved,
    recommendation: { answer },
    metadata: {},
  });

  return payload;
};

export const listBrainAudits = async ({
  tenantId,
  companyId,
  limit = 50,
}: {
  tenantId: number;
  companyId: number;
  limit?: number;
}) => {
  const rows = await (AccountingBrainAuditLog as any).findAll({
    where: { tenant_id: tenantId, company_id: companyId },
    order: [['created_at', 'DESC']],
    limit: Math.min(Math.max(limit, 1), 200),
  });
  return rows;
};

/** Lightweight export for auto-voucher controller reuse (no posting). */
export const classifyDocumentForAutoVoucher = async (args: {
  tenantId: number;
  companyId: number;
  userId?: number;
  sourceDocType: string;
  ocr: Record<string, any>;
}) => {
  const rec = await recommendVoucher({
    tenantId: args.tenantId,
    companyId: args.companyId,
    userId: args.userId,
    source: 'auto_voucher_upload',
    sourceDocType: args.sourceDocType,
    vendorName: args.ocr.vendorName,
    customerName: args.ocr.customerName,
    invoiceNumber: args.ocr.invoiceNumber,
    amount: args.ocr.totalAmount,
    currency: args.ocr.currency,
    transactionDate: args.ocr.transactionDate,
    gstin: args.ocr.gstin,
    narration: args.ocr.narration,
    ocrText: String(args.ocr.rawText || args.ocr.fullText || args.ocr.narration || '').slice(0, 8000),
    description: args.ocr.narration,
  });

  return {
    recommendation: rec,
    debitAccount: rec.debitLedger.accountName,
    creditAccount: rec.creditLedger.accountName,
    taxAccount: rec.gstLedger?.accountName || null,
    transactionType: rec.transactionType,
    reason: rec.reasons.join(' | '),
    ruleName: rec.appliedRules[0]?.code || 'brain',
    confidenceBoost: Math.max(0, rec.confidenceScore - 55),
    confidenceScore: rec.confidenceScore,
    needsReview: rec.needsReview,
    appliedRules: rec.appliedRules,
    historicalMatches: rec.historicalMatches,
    duplicateCheck: rec.duplicateCheck,
    lines: rec.lines,
  };
};

/** Invoice → Brain recommendation (never posts). */
export const recommendFromInvoice = async ({
  tenantId,
  companyId,
  userId,
  invoiceId,
}: {
  tenantId: number;
  companyId: number;
  userId?: number;
  invoiceId: number;
}) => {
  const invoice = await (Invoice as any).findOne({
    where: { id: invoiceId, tenant_id: tenantId, company_id: companyId, is_active: true },
  });
  if (!invoice) {
    throw new Error('Invoice not found for this company');
  }

  let partyName = '';
  if (invoice.customer_id) {
    const cust = await (Customer as any).findOne({
      where: { id: invoice.customer_id, tenant_id: tenantId, company_id: companyId },
    });
    partyName = String(cust?.name || '');
  }

  return recommendVoucher({
    tenantId,
    companyId,
    userId,
    source: 'invoice_bridge',
    sourceDocType: 'sales_invoice',
    customerName: partyName || undefined,
    invoiceNumber: String(invoice.invoice_number || ''),
    amount: Number(invoice.total_amount || 0),
    transactionDate: String(invoice.invoice_date || '').slice(0, 10),
    narration: String(invoice.notes || `Invoice ${invoice.invoice_number}`),
    description: `Sales invoice ${invoice.invoice_number} amount ${invoice.total_amount}`,
  });
};

/** Expense report → Brain recommendation (never posts). */
export const recommendFromExpense = async ({
  tenantId,
  companyId,
  userId,
  expenseId,
}: {
  tenantId: number;
  companyId: number;
  userId?: number;
  expenseId: number;
}) => {
  const expense = await (ExpenseReport as any).findOne({
    where: { id: expenseId, tenant_id: tenantId, company_id: companyId },
  });
  if (!expense) {
    throw new Error('Expense report not found for this company');
  }

  const itemText = Array.isArray(expense.items)
    ? expense.items.map((i: any) => i?.description || i?.item_name || '').join(' ')
    : '';

  return recommendVoucher({
    tenantId,
    companyId,
    userId,
    source: 'expense_bridge',
    sourceDocType: 'receipt',
    amount: Number(expense.total_amount || 0),
    currency: String(expense.currency || 'INR'),
    narration: String(expense.purpose || expense.title || ''),
    description: `${expense.title || ''} ${expense.purpose || ''} ${itemText}`.trim(),
  });
};

// Keep unused import referenced to avoid accidental future posting shortcuts via this module.
void GlVoucherLine;
