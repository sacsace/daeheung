import fs from 'fs/promises';
import path from 'path';
import { Op } from 'sequelize';
import { Response } from 'express';
import { RequestWithUser } from '../types';
import { AutoVoucher, AutoVoucherAuditLog, AutoVoucherRule } from '../models';
import { postAutoVoucherToLedger } from '../services/glPostingService';
import { classifyDocumentForAutoVoucher, recordLearningCorrection } from '../services/accountingBrainService';
import { extractTextFromDocument } from '../services/documentOcrService';
import { resolveCompanyScope } from '../utils/companyScope';
import { assertLinesHaveResolvedAccounts } from '../utils/accountResolution';

type VoucherLine = {
  lineNo: number;
  accountId?: number | null;
  accountName: string;
  debit: number;
  credit: number;
  taxType?: string;
  taxRate?: number;
  narration?: string;
};

const SUPPORTED_UPLOAD_TYPES = [
  'purchase_invoice',
  'vendor_bill',
  'sales_invoice',
  'receipt',
  'card_slip',
  'bank_statement',
  'gst_challan',
  'tds_challan',
  'payroll_slip',
  'remittance',
  'credit_note',
  'debit_note',
  'other',
] as const;

const round2 = (n: number) => Number((Number(n) || 0).toFixed(2));
const parseAmount = (value: unknown) => {
  if (value == null) return 0;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));

const readTextFromUploadedFile = async (absolutePath: string, mimetype?: string) => {
  const extracted = await extractTextFromDocument(absolutePath, mimetype);
  return extracted;
};

const extractStructuredFields = (rawText: string, fallbackFileName: string) => {
  const text = String(rawText || '');
  const pick = (regex: RegExp) => text.match(regex)?.[1]?.trim() || '';
  const invoiceNumber = pick(/(?:invoice\s*(?:no|number)|bill\s*(?:no|number)|inv#)\s*[:-]?\s*([A-Za-z0-9/-]+)/i);
  const gstin = pick(/GSTIN\s*[:-]?\s*([A-Z0-9]{10,15})/i);
  const pan = pick(/\bPAN\s*[:-]?\s*([A-Z]{5}[0-9]{4}[A-Z])\b/i);
  const transactionDate =
    pick(/(?:date|invoice\s*date|txn\s*date)\s*[:-]?\s*([0-9]{4}[/-][0-9]{2}[/-][0-9]{2})/i) ||
    new Date().toISOString().slice(0, 10);
  const vendor = pick(/(?:vendor|supplier|party|merchant)\s*[:-]?\s*([^\n\r,]+)/i);
  const customer = pick(/(?:customer|buyer)\s*[:-]?\s*([^\n\r,]+)/i);
  const totalRaw = pick(/(?:total|grand\s*total|amount\s*due|net\s*amount)\s*[:-]?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
  const totalAmount = parseAmount(totalRaw);
  const currency = pick(/\b(INR|KRW|USD|EUR|JPY)\b/i) || 'INR';

  return {
    transactionDate: transactionDate.replace(/\//g, '-'),
    invoiceNumber,
    vendorName: vendor,
    customerName: customer,
    gstin,
    pan,
    totalAmount: round2(totalAmount),
    currency: currency.toUpperCase(),
    narration: text.slice(0, 500) || fallbackFileName,
    rawText: text.slice(0, 8000),
    rawTextLength: text.length,
  };
};

const computeTotals = (lines: VoucherLine[]) => {
  const totalDebit = round2(lines.reduce((sum, line) => sum + parseAmount(line.debit), 0));
  const totalCredit = round2(lines.reduce((sum, line) => sum + parseAmount(line.credit), 0));
  return { totalDebit, totalCredit };
};

const assertBalanced = (lines: VoucherLine[]) => {
  const { totalDebit, totalCredit } = computeTotals(lines);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`복식부기 불일치: 차변 ${totalDebit} / 대변 ${totalCredit}`);
  }
  return { totalDebit, totalCredit };
};

const normalizeLines = (raw: unknown): VoucherLine[] => {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((line: any, index) => ({
    lineNo: Number(line?.lineNo || index + 1),
    accountId: line?.accountId != null && line.accountId !== '' ? Number(line.accountId) : null,
    accountName: String(line?.accountName || '').trim(),
    debit: round2(parseAmount(line?.debit)),
    credit: round2(parseAmount(line?.credit)),
    taxType: line?.taxType ? String(line.taxType) : undefined,
    taxRate: line?.taxRate != null ? Number(line.taxRate) : undefined,
    narration: line?.narration ? String(line.narration) : undefined,
  }));
};

const canReview = (role: string) => role === 'root' || role === 'admin' || role === 'audit';

const buildSuggestedLines = ({
  amount,
  debitAccount,
  creditAccount,
  narration,
}: {
  amount: number;
  debitAccount: string;
  creditAccount: string;
  narration?: string;
}) => {
  const safeAmount = round2(amount > 0 ? amount : 0);
  return [
    {
      lineNo: 1,
      accountName: debitAccount,
      debit: safeAmount,
      credit: 0,
      narration: narration || '',
    },
    {
      lineNo: 2,
      accountName: creditAccount,
      debit: 0,
      credit: safeAmount,
      narration: narration || '',
    },
  ] as VoucherLine[];
};

const normalizeFileName = (name: string) => String(name || '').trim().toLowerCase();

/** 동일 회사 내 이미 등록된 원본 파일명 여부 (반려·취소 제외) */
const findDuplicateByFileName = async ({
  tenantId,
  companyId,
  fileName,
}: {
  tenantId: number;
  companyId: number;
  fileName: string;
}) => {
  const normalized = normalizeFileName(fileName);
  if (!normalized) {
    return { hasDuplicate: false, matchedVoucherCodes: [] as string[] };
  }

  const rows = await (AutoVoucher as any).findAll({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      is_active: true,
      status: { [Op.notIn]: ['rejected', 'cancelled'] },
    },
    attributes: ['voucher_code', 'source_file_name'],
    order: [['created_at', 'DESC']],
    limit: 500,
  });

  const matches = (rows || []).filter(
    (item: any) => normalizeFileName(item.source_file_name) === normalized
  );

  return {
    hasDuplicate: matches.length > 0,
    matchedVoucherCodes: matches.slice(0, 5).map((x: any) => x.voucher_code),
  };
};

const detectDuplicate = async ({
  tenantId,
  companyId,
  invoiceNumber,
  transactionDate,
  amount,
  counterparty,
}: {
  tenantId: number;
  companyId: number;
  invoiceNumber?: string;
  transactionDate?: string;
  amount?: number;
  counterparty?: string;
}) => {
  const recent = await (AutoVoucher as any).findAll({
    where: { tenant_id: tenantId, company_id: companyId, is_active: true },
    order: [['created_at', 'DESC']],
    limit: 300,
  });

  const matches = (recent || []).filter((item: any) => {
    const byInvoice =
      invoiceNumber &&
      item.invoice_number &&
      String(item.invoice_number).trim().toLowerCase() === String(invoiceNumber).trim().toLowerCase();
    const byDateAmount =
      transactionDate &&
      item.transaction_date &&
      String(item.transaction_date) === String(transactionDate) &&
      Math.abs(parseAmount(item.total_debit) - parseAmount(amount)) < 0.01;
    const byCounterpartyAmount =
      counterparty &&
      item.counterparty_name &&
      String(item.counterparty_name).trim().toLowerCase() === String(counterparty).trim().toLowerCase() &&
      Math.abs(parseAmount(item.total_debit) - parseAmount(amount)) < 0.01;
    return Boolean(byInvoice || byDateAmount || byCounterpartyAmount);
  });

  return {
    hasDuplicate: matches.length > 0,
    matchedCount: matches.length,
    matchedVoucherCodes: matches.slice(0, 5).map((x: any) => x.voucher_code),
  };
};

const createAuditLog = async ({
  tenantId,
  companyId,
  voucherId,
  action,
  actorId,
  beforeData,
  afterData,
  metadata,
}: {
  tenantId: number;
  companyId: number;
  voucherId: number;
  action: string;
  actorId?: number;
  beforeData?: Record<string, any>;
  afterData?: Record<string, any>;
  metadata?: Record<string, any>;
}) => {
  await (AutoVoucherAuditLog as any).create({
    tenant_id: tenantId,
    company_id: companyId,
    auto_voucher_id: voucherId,
    action,
    actor_id: actorId,
    before_data: beforeData || {},
    after_data: afterData || {},
    metadata: metadata || {},
  });
};

export const uploadAndGenerateAutoVoucher = async (req: RequestWithUser, res: Response) => {
  try {
    const file = (req as any).file;
    if (!file) {
      return res.status(400).json({ success: false, message: '업로드 파일이 필요합니다.' });
    }

    const sourceDocType = String(req.body?.sourceDocType || 'other').toLowerCase();
    if (!SUPPORTED_UPLOAD_TYPES.includes(sourceDocType as any)) {
      return res.status(400).json({ success: false, message: '지원하지 않는 문서 유형입니다.' });
    }

    const { tenantId, companyId } = resolveCompanyScope(req);
    const { id: userId } = req.user;
    const originalFileName = String(file.originalname || file.filename || '').trim();
    const filePath = String(file.path || '');

    const fileNameDuplicate = await findDuplicateByFileName({
      tenantId,
      companyId,
      fileName: originalFileName,
    });
    if (fileNameDuplicate.hasDuplicate) {
      if (filePath) {
        await fs.unlink(filePath).catch(() => undefined);
      }
      return res.status(409).json({
        success: false,
        code: 'DUPLICATE_FILE_NAME',
        message: `동일한 파일명이 이미 등록되어 있습니다. (${fileNameDuplicate.matchedVoucherCodes.join(', ')})`,
        data: fileNameDuplicate,
      });
    }

    const extracted = await readTextFromUploadedFile(filePath, file.mimetype);
    const fileText = extracted.text || '';
    const ocr = extractStructuredFields(fileText, file.originalname || file.filename);
    const brain = await classifyDocumentForAutoVoucher({
      tenantId,
      companyId,
      userId,
      sourceDocType,
      ocr: {
        ...ocr,
        ocrEngine: extracted.engine,
        ocrNotes: extracted.notes,
      },
    });

    const suggestedLines =
      Array.isArray(brain.lines) && brain.lines.length >= 2
        ? brain.lines.map((line, index) => ({
            lineNo: Number(line.lineNo || index + 1),
            accountId: line.accountId != null ? Number(line.accountId) : null,
            accountName: String(line.accountName || ''),
            debit: round2(parseAmount(line.debit)),
            credit: round2(parseAmount(line.credit)),
            narration: line.narration ? String(line.narration) : ocr.narration,
          }))
        : buildSuggestedLines({
            amount: parseAmount(ocr.totalAmount),
            debitAccount: brain.debitAccount,
            creditAccount: brain.creditAccount,
            narration: ocr.narration,
          });
    const unresolvedLedgers = suggestedLines.filter((l) => !l.accountId && !String(l.accountName || '').trim());
    const totals = computeTotals(suggestedLines);
    const duplicateCheck = brain.duplicateCheck?.hasDuplicate
      ? brain.duplicateCheck
      : await detectDuplicate({
          tenantId,
          companyId,
          invoiceNumber: ocr.invoiceNumber,
          transactionDate: ocr.transactionDate,
          amount: ocr.totalAmount,
          counterparty: ocr.vendorName || ocr.customerName,
        });

    const confidence = clamp(Number(brain.confidenceScore ?? 60));
    const voucherCode = `VCH-${new Date().getFullYear()}-${String(Date.now()).slice(-8)}`;

    const created = await (AutoVoucher as any).create({
      tenant_id: tenantId,
      company_id: companyId,
      voucher_code: voucherCode,
      source_doc_type: sourceDocType,
      source_file_name: originalFileName,
      source_file_path: path.join('auto-vouchers', file.filename || '').replace(/\\/g, '/'),
      source_file_mime: file.mimetype || null,
      ocr_data: {
        ...ocr,
        ocrEngine: extracted.engine,
        ocrNotes: extracted.notes,
        ocrAccuracy: extracted.confidence || (ocr.rawTextLength > 0 ? 0.88 : 0.55),
      },
      ai_analysis: {
        transactionType: brain.transactionType,
        confidence,
        reason: brain.reason,
        ruleName: brain.ruleName,
        needsReview: Boolean(brain.needsReview || unresolvedLedgers.length || !suggestedLines.every((l: any) => l.accountId)),
        validationMessages: brain.recommendation?.validation?.messages || [],
        appliedRules: brain.appliedRules,
        historicalMatches: brain.historicalMatches,
        requestId: brain.recommendation?.requestId,
        matchedCounterparty: ocr.vendorName || ocr.customerName || null,
        disclaimer: brain.recommendation?.disclaimer,
      },
      duplicate_check: duplicateCheck,
      suggested_lines: suggestedLines,
      final_lines: suggestedLines,
      transaction_date: ocr.transactionDate || null,
      invoice_number: ocr.invoiceNumber || null,
      counterparty_name: ocr.vendorName || ocr.customerName || null,
      narration: ocr.narration || null,
      currency: ocr.currency || 'INR',
      total_debit: totals.totalDebit,
      total_credit: totals.totalCredit,
      confidence_score: confidence,
      status: 'review_required',
      created_by: userId,
      updated_by: userId,
      is_active: true,
    });

    await createAuditLog({
      tenantId,
      companyId,
      voucherId: created.id,
      action: 'uploaded',
      actorId: userId,
      afterData: { sourceDocType, fileName: created.source_file_name },
    });
    await createAuditLog({
      tenantId,
      companyId,
      voucherId: created.id,
      action: 'ocr_completed',
      actorId: userId,
      afterData: { extracted: created.ocr_data },
    });
    await createAuditLog({
      tenantId,
      companyId,
      voucherId: created.id,
      action: 'ai_classified',
      actorId: userId,
      afterData: { analysis: created.ai_analysis },
    });
    await createAuditLog({
      tenantId,
      companyId,
      voucherId: created.id,
      action: 'draft_created',
      actorId: userId,
      afterData: { suggestedLines },
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    console.error('AI 자동 전표 생성 오류:', error);
    return res.status(500).json({
      success: false,
      message: '자동 전표 생성에 실패했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getAutoVouchers = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = resolveCompanyScope(req);
    const { status = '', sourceDocType = '', q = '' } = req.query;
    const whereClause: any = { tenant_id: tenantId, company_id: companyId, is_active: true };
    if (status) whereClause.status = status;
    if (sourceDocType) whereClause.source_doc_type = sourceDocType;
    if (q) {
      whereClause[Op.or] = [
        { voucher_code: { [Op.iLike]: `%${q}%` } },
        { source_file_name: { [Op.iLike]: `%${q}%` } },
        { invoice_number: { [Op.iLike]: `%${q}%` } },
        { counterparty_name: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const rows = await (AutoVoucher as any).findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
    });
    return res.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('AI 자동 전표 목록 조회 오류:', error);
    return res.status(500).json({ success: false, message: '목록 조회에 실패했습니다.' });
  }
};

export const getAutoVoucherById = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const { tenantId, companyId } = resolveCompanyScope(req);
    const row = await (AutoVoucher as any).findOne({
      where: { id, tenant_id: tenantId, company_id: companyId, is_active: true },
      include: [{ model: AutoVoucherAuditLog, as: 'auditLogs', required: false }],
      order: [[{ model: AutoVoucherAuditLog, as: 'auditLogs' }, 'created_at', 'DESC']],
    });
    if (!row) {
      return res.status(404).json({ success: false, message: '전표를 찾을 수 없습니다.' });
    }
    return res.json({ success: true, data: row });
  } catch (error: any) {
    console.error('AI 자동 전표 상세 조회 오류:', error);
    return res.status(500).json({ success: false, message: '상세 조회에 실패했습니다.' });
  }
};

export const updateAutoVoucher = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const { tenantId, companyId } = resolveCompanyScope(req);
    const { id: userId } = req.user;
    const row = await (AutoVoucher as any).findOne({
      where: { id, tenant_id: tenantId, company_id: companyId, is_active: true },
    });
    if (!row) {
      return res.status(404).json({ success: false, message: '전표를 찾을 수 없습니다.' });
    }

    const beforeData = {
      transaction_date: row.transaction_date,
      counterparty_name: row.counterparty_name,
      narration: row.narration,
      final_lines: row.final_lines,
      total_debit: row.total_debit,
      total_credit: row.total_credit,
      status: row.status,
    };

    const payload: any = {
      transaction_date: req.body.transactionDate ?? row.transaction_date,
      counterparty_name: req.body.counterpartyName ?? row.counterparty_name,
      narration: req.body.narration ?? row.narration,
      review_notes: req.body.reviewNotes ?? row.review_notes,
      updated_by: userId,
    };

    if (req.body.finalLines) {
      const lines = normalizeLines(req.body.finalLines);
      const totals = assertBalanced(lines);
      payload.final_lines = lines;
      payload.total_debit = totals.totalDebit;
      payload.total_credit = totals.totalCredit;

      // Learning: capture accountant ledger overrides for future Brain recommendations
      const suggested = normalizeLines(row.suggested_lines);
      const suggestedDebit = suggested.find((l) => l.debit > 0)?.accountName || '';
      const suggestedCredit = suggested.find((l) => l.credit > 0)?.accountName || '';
      const finalDebit = lines.find((l) => l.debit > 0)?.accountName || '';
      const finalCredit = lines.find((l) => l.credit > 0)?.accountName || '';
      const keywordSeed =
        String(row.counterparty_name || row.narration || row.source_doc_type || '')
          .split(/\s+/)
          .find((t: string) => t.length > 3) || undefined;

      if (finalDebit && suggestedDebit && finalDebit !== suggestedDebit) {
        await recordLearningCorrection({
          tenantId,
          companyId,
          userId,
          sourceType: 'auto_voucher',
          sourceId: Number(row.id),
          counterpartyName: row.counterparty_name || undefined,
          keyword: keywordSeed,
          docType: row.source_doc_type || undefined,
          fieldName: 'debit_account',
          beforeValue: suggestedDebit,
          afterValue: finalDebit,
          recommendationSnapshot: {
            voucherCode: row.voucher_code,
            suggested_lines: suggested,
            final_lines: lines,
          },
        });
      }
      if (finalCredit && suggestedCredit && finalCredit !== suggestedCredit) {
        await recordLearningCorrection({
          tenantId,
          companyId,
          userId,
          sourceType: 'auto_voucher',
          sourceId: Number(row.id),
          counterpartyName: row.counterparty_name || undefined,
          keyword: keywordSeed,
          docType: row.source_doc_type || undefined,
          fieldName: 'credit_account',
          beforeValue: suggestedCredit,
          afterValue: finalCredit,
          recommendationSnapshot: {
            voucherCode: row.voucher_code,
            suggested_lines: suggested,
            final_lines: lines,
          },
        });
      }
    }

    if (req.body.status) payload.status = String(req.body.status);
    await row.update(payload);
    await row.reload();

    await createAuditLog({
      tenantId,
      companyId,
      voucherId: row.id,
      action: 'updated',
      actorId: userId,
      beforeData,
      afterData: {
        transaction_date: row.transaction_date,
        counterparty_name: row.counterparty_name,
        narration: row.narration,
        final_lines: row.final_lines,
        total_debit: row.total_debit,
        total_credit: row.total_credit,
        status: row.status,
      },
    });

    return res.json({ success: true, data: row });
  } catch (error: any) {
    console.error('AI 자동 전표 수정 오류:', error);
    const statusCode = String(error.message || '').includes('복식부기 불일치') ? 400 : 500;
    return res.status(statusCode).json({ success: false, message: error.message || '수정에 실패했습니다.' });
  }
};

export const approveAutoVoucher = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const { tenantId, companyId } = resolveCompanyScope(req);
    const { id: userId, role } = req.user;
    if (!canReview(role)) {
      return res.status(403).json({ success: false, message: '승인 권한이 없습니다.' });
    }

    const row = await (AutoVoucher as any).findOne({
      where: { id, tenant_id: tenantId, company_id: companyId, is_active: true },
    });
    if (!row) {
      return res.status(404).json({ success: false, message: '전표를 찾을 수 없습니다.' });
    }

    const lines = normalizeLines(row.final_lines || []);
    assertBalanced(lines);
    await assertLinesHaveResolvedAccounts({ tenantId, companyId, lines });

    const beforeStatus = row.status;
    await row.update({
      status: 'approved',
      approved_by: userId,
      approved_at: new Date(),
      updated_by: userId,
    });

    await createAuditLog({
      tenantId,
      companyId,
      voucherId: row.id,
      action: 'approved',
      actorId: userId,
      beforeData: { status: beforeStatus },
      afterData: { status: 'approved' },
    });

    return res.json({ success: true, data: row });
  } catch (error: any) {
    console.error('AI 자동 전표 승인 오류:', error);
    const msg = String(error.message || '');
    const statusCode =
      msg.includes('복식부기 불일치') || msg.includes('계정과목') ? 400 : 500;
    return res.status(statusCode).json({ success: false, message: error.message || '승인에 실패했습니다.' });
  }
};

export const postAutoVoucher = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const { tenantId, companyId } = resolveCompanyScope(req);
    const { id: userId, role } = req.user;
    if (!(role === 'root' || role === 'admin')) {
      return res.status(403).json({ success: false, message: 'Post 권한이 없습니다.' });
    }

    const row = await (AutoVoucher as any).findOne({
      where: { id, tenant_id: tenantId, company_id: companyId, is_active: true },
    });
    if (!row) {
      return res.status(404).json({ success: false, message: '전표를 찾을 수 없습니다.' });
    }
    if (row.status !== 'approved') {
      return res.status(400).json({ success: false, message: '승인된 전표만 Post 할 수 있습니다.' });
    }

    const lines = normalizeLines(row.final_lines || []);
    assertBalanced(lines);
    await assertLinesHaveResolvedAccounts({ tenantId, companyId, lines });

    const glVoucher = await postAutoVoucherToLedger({ autoVoucher: row, userId });

    await row.update({
      status: 'posted',
      posted_by: userId,
      posted_at: new Date(),
      updated_by: userId,
    });

    await createAuditLog({
      tenantId,
      companyId,
      voucherId: row.id,
      action: 'posted',
      actorId: userId,
      beforeData: { status: 'approved' },
      afterData: { status: 'posted', glVoucherId: glVoucher.id, glVoucherNo: glVoucher.voucher_no },
    });

    return res.json({
      success: true,
      data: row,
      glVoucher,
      message: `장부에 반영되었습니다. (${glVoucher.voucher_no})`,
    });
  } catch (error: any) {
    console.error('AI 자동 전표 Post 오류:', error);
    const msg = String(error.message || '');
    const statusCode =
      msg.includes('복식부기 불일치') || msg.includes('계정과목') || msg.includes('금액이 0') ? 400 : 500;
    return res.status(statusCode).json({ success: false, message: error.message || 'Post 처리에 실패했습니다.' });
  }
};

export const rejectAutoVoucher = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const { tenantId, companyId } = resolveCompanyScope(req);
    const { id: userId, role } = req.user;
    if (!canReview(role)) {
      return res.status(403).json({ success: false, message: '반려 권한이 없습니다.' });
    }

    const reason = String(req.body?.reason || '').trim();
    if (!reason) {
      return res.status(400).json({ success: false, message: '반려 사유를 입력해 주세요.' });
    }

    const row = await (AutoVoucher as any).findOne({
      where: { id, tenant_id: tenantId, company_id: companyId, is_active: true },
    });
    if (!row) {
      return res.status(404).json({ success: false, message: '전표를 찾을 수 없습니다.' });
    }

    const beforeStatus = row.status;
    await row.update({
      status: 'rejected',
      rejected_by: userId,
      rejected_at: new Date(),
      rejection_reason: reason,
      updated_by: userId,
    });

    await createAuditLog({
      tenantId,
      companyId,
      voucherId: row.id,
      action: 'rejected',
      actorId: userId,
      beforeData: { status: beforeStatus },
      afterData: { status: 'rejected', reason },
    });

    return res.json({ success: true, data: row });
  } catch (error: any) {
    console.error('AI 자동 전표 반려 오류:', error);
    return res.status(500).json({ success: false, message: '반려 처리에 실패했습니다.' });
  }
};

export const getAutoVoucherRules = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = resolveCompanyScope(req);
    const rows = await (AutoVoucherRule as any).findAll({
      where: { tenant_id: tenantId, company_id: companyId },
      order: [['priority', 'DESC'], ['id', 'DESC']],
    });
    return res.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('AI 전표 규칙 조회 오류:', error);
    return res.status(500).json({ success: false, message: '규칙 조회에 실패했습니다.' });
  }
};

export const upsertAutoVoucherRule = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = resolveCompanyScope(req);
    const { id: userId, role } = req.user;
    if (!(role === 'root' || role === 'admin')) {
      return res.status(403).json({ success: false, message: '규칙 수정 권한이 없습니다.' });
    }

    const id = req.body?.id ? Number(req.body.id) : null;
    const keyword = String(req.body?.keyword || '').trim();
    const debitAccount = String(req.body?.debitAccount || '').trim();
    const creditAccount = String(req.body?.creditAccount || '').trim();
    if (!keyword || !debitAccount || !creditAccount) {
      return res.status(400).json({ success: false, message: 'keyword/debitAccount/creditAccount는 필수입니다.' });
    }

    let row: any = null;
    if (id) {
      row = await (AutoVoucherRule as any).findOne({ where: { id, tenant_id: tenantId, company_id: companyId } });
    }

    if (row) {
      await row.update({
        keyword,
        doc_type: req.body?.docType || null,
        transaction_type: req.body?.transactionType || 'expense',
        debit_account: debitAccount,
        credit_account: creditAccount,
        tax_account: req.body?.taxAccount || null,
        confidence_boost: Number(req.body?.confidenceBoost || 10),
        reason_template: req.body?.reasonTemplate || null,
        priority: Number(req.body?.priority || 100),
        is_active: req.body?.isActive !== false,
        updated_by: userId,
      });
    } else {
      row = await (AutoVoucherRule as any).create({
        tenant_id: tenantId,
        company_id: companyId,
        keyword,
        doc_type: req.body?.docType || null,
        transaction_type: req.body?.transactionType || 'expense',
        debit_account: debitAccount,
        credit_account: creditAccount,
        tax_account: req.body?.taxAccount || null,
        confidence_boost: Number(req.body?.confidenceBoost || 10),
        reason_template: req.body?.reasonTemplate || null,
        priority: Number(req.body?.priority || 100),
        is_active: req.body?.isActive !== false,
        created_by: userId,
        updated_by: userId,
      });
    }

    return res.json({ success: true, data: row });
  } catch (error: any) {
    console.error('AI 전표 규칙 저장 오류:', error);
    return res.status(500).json({ success: false, message: '규칙 저장에 실패했습니다.' });
  }
};

