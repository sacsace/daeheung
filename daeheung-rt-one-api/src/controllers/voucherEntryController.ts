import { Response } from 'express';
import { Op } from 'sequelize';
import {
  AcBankAccount,
  AcFinancialYear,
  AcGstCode,
  AcTdsCode,
  AcTransactionItem,
  AcVoucherAuditLog,
  AcVoucherType,
  GlAccount,
  GlVoucher,
  GlVoucherLine,
  Partner,
} from '../models';
import { RequestWithUser } from '../types';
import { resolveCompanyScope } from '../utils/companyScope';
import {
  buildSimpleVoucherPreview,
  ensureAccountingMasters,
  generateVoucherNumber,
  validateVoucherInput,
} from '../services/voucherMasterService';
import { createGlVoucherWithLines } from '../services/glPostingService';

const scopeWhere = (req: RequestWithUser) => {
  const { tenantId, companyId } = resolveCompanyScope(req);
  return { tenantId, companyId };
};

const logAudit = async (voucherId: number, action: string, userId: number, meta?: Record<string, unknown>) => {
  await (AcVoucherAuditLog as any).create({
    voucher_id: voucherId,
    action,
    meta: meta ?? null,
    created_by: userId,
  });
};

// ── Masters seed ──
export const seedAccountingMasters = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = scopeWhere(req);
    const result = await ensureAccountingMasters({ tenantId, companyId, userId: req.user.id });
    return res.json({ success: true, data: result, message: '회계 마스터 데이터가 준비되었습니다.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || '마스터 시드 실패' });
  }
};

// ── Voucher Types ──
export const getVoucherTypes = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = scopeWhere(req);
    await ensureAccountingMasters({ tenantId, companyId, userId: req.user.id });
    const rows = await (AcVoucherType as any).findAll({
      where: { tenant_id: tenantId, company_id: companyId, is_active: true },
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
    });
    return res.json({ success: true, data: rows });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const upsertVoucherType = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = scopeWhere(req);
    const { id, ...body } = req.body || {};
    if (id) {
      const row = await (AcVoucherType as any).findOne({ where: { id, tenant_id: tenantId, company_id: companyId } });
      if (!row) return res.status(404).json({ success: false, message: '전표 유형을 찾을 수 없습니다.' });
      await row.update(body);
      return res.json({ success: true, data: row });
    }
    const created = await (AcVoucherType as any).create({ tenant_id: tenantId, company_id: companyId, ...body });
    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Transaction Items ──
export const getTransactionItems = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = scopeWhere(req);
    const search = String(req.query.search || '').trim();
    await ensureAccountingMasters({ tenantId, companyId, userId: req.user.id });
    const where: any = { tenant_id: tenantId, company_id: companyId, is_active: true };
    if (search) {
      where[Op.or] = [
        { name_ko: { [Op.iLike]: `%${search}%` } },
        { name_en: { [Op.iLike]: `%${search}%` } },
        { code: { [Op.iLike]: `%${search}%` } },
        { keywords: { [Op.iLike]: `%${search}%` } },
      ];
    }
    const rows = await (AcTransactionItem as any).findAll({
      where,
      order: [['sort_order', 'ASC'], ['name_ko', 'ASC']],
    });
    return res.json({ success: true, data: rows });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const upsertTransactionItem = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = scopeWhere(req);
    const { id, ...body } = req.body || {};
    if (id) {
      const row = await (AcTransactionItem as any).findOne({ where: { id, tenant_id: tenantId, company_id: companyId } });
      if (!row) return res.status(404).json({ success: false, message: '거래 항목을 찾을 수 없습니다.' });
      await row.update(body);
      return res.json({ success: true, data: row });
    }
    const created = await (AcTransactionItem as any).create({ tenant_id: tenantId, company_id: companyId, ...body });
    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── GST Codes ──
export const getGstCodes = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = scopeWhere(req);
    const voucherDate = req.query.voucherDate ? String(req.query.voucherDate) : null;
    await ensureAccountingMasters({ tenantId, companyId, userId: req.user.id });
    const where: any = { tenant_id: tenantId, company_id: companyId, is_active: true };
    if (voucherDate) {
      where[Op.and] = [
        { [Op.or]: [{ effective_from: null }, { effective_from: { [Op.lte]: voucherDate } }] },
        { [Op.or]: [{ effective_to: null }, { effective_to: { [Op.gte]: voucherDate } }] },
      ];
    }
    const rows = await (AcGstCode as any).findAll({ where, order: [['code', 'ASC']] });
    return res.json({ success: true, data: rows });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const upsertGstCode = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = scopeWhere(req);
    const { id, ...body } = req.body || {};
    if (id) {
      const row = await (AcGstCode as any).findOne({ where: { id, tenant_id: tenantId, company_id: companyId } });
      if (!row) return res.status(404).json({ success: false, message: 'GST 코드를 찾을 수 없습니다.' });
      await row.update(body);
      return res.json({ success: true, data: row });
    }
    const created = await (AcGstCode as any).create({ tenant_id: tenantId, company_id: companyId, ...body });
    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── TDS Codes ──
export const getTdsCodes = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = scopeWhere(req);
    await ensureAccountingMasters({ tenantId, companyId, userId: req.user.id });
    const rows = await (AcTdsCode as any).findAll({
      where: { tenant_id: tenantId, company_id: companyId, is_active: true },
      order: [['section', 'ASC']],
    });
    return res.json({ success: true, data: rows });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const upsertTdsCode = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = scopeWhere(req);
    const { id, ...body } = req.body || {};
    if (id) {
      const row = await (AcTdsCode as any).findOne({ where: { id, tenant_id: tenantId, company_id: companyId } });
      if (!row) return res.status(404).json({ success: false, message: 'TDS 코드를 찾을 수 없습니다.' });
      await row.update(body);
      return res.json({ success: true, data: row });
    }
    const created = await (AcTdsCode as any).create({ tenant_id: tenantId, company_id: companyId, ...body });
    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Bank Accounts ──
export const getBankAccounts = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = scopeWhere(req);
    await ensureAccountingMasters({ tenantId, companyId, userId: req.user.id });
    const rows = await (AcBankAccount as any).findAll({
      where: { tenant_id: tenantId, company_id: companyId, is_active: true },
      order: [['bank_name', 'ASC']],
    });
    return res.json({ success: true, data: rows });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const upsertBankAccount = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = scopeWhere(req);
    const { id, ...body } = req.body || {};
    if (id) {
      const row = await (AcBankAccount as any).findOne({ where: { id, tenant_id: tenantId, company_id: companyId } });
      if (!row) return res.status(404).json({ success: false, message: '은행 계좌를 찾을 수 없습니다.' });
      await row.update(body);
      return res.json({ success: true, data: row });
    }
    const created = await (AcBankAccount as any).create({ tenant_id: tenantId, company_id: companyId, ...body });
    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Financial Years ──
export const getFinancialYears = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = scopeWhere(req);
    await ensureAccountingMasters({ tenantId, companyId, userId: req.user.id });
    const rows = await (AcFinancialYear as any).findAll({
      where: { tenant_id: tenantId, company_id: companyId, is_active: true },
      order: [['start_date', 'DESC']],
    });
    return res.json({ success: true, data: rows });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Parties (reuse partners) ──
export const searchParties = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = scopeWhere(req);
    const search = String(req.query.search || '').trim();
    const where: any = { tenant_id: tenantId, company_id: companyId, status: 'active' };
    if (search) {
      where[Op.or] = [
        { company_name: { [Op.iLike]: `%${search}%` } },
        { business_number: { [Op.iLike]: `%${search}%` } },
        { pan_number: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
      ];
    }
    const rows = await (Partner as any).findAll({
      where,
      limit: 50,
      order: [['company_name', 'ASC']],
    });
    return res.json({ success: true, data: rows });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Accounts search (extended) ──
export const searchAccounts = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = scopeWhere(req);
    const search = String(req.query.search || '').trim();
    await ensureAccountingMasters({ tenantId, companyId, userId: req.user.id });
    const where: any = { tenant_id: tenantId, company_id: companyId, is_active: true, account_type: 'ledger' };
    if (search) {
      where[Op.or] = [
        { code: { [Op.iLike]: `%${search}%` } },
        { name: { [Op.iLike]: `%${search}%` } },
        { name_en: { [Op.iLike]: `%${search}%` } },
        { search_aliases: { [Op.iLike]: `%${search}%` } },
      ];
    }
    const rows = await (GlAccount as any).findAll({ where, order: [['code', 'ASC']], limit: 100 });
    return res.json({ success: true, data: rows });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Preview & Validate ──
export const previewVoucher = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = scopeWhere(req);
    const { inputMode, simpleInput, lines } = req.body || {};

    if (inputMode === 'advanced' && Array.isArray(lines)) {
      const totalDebit = lines.reduce((s: number, l: any) => s + Number(l.debit || 0), 0);
      const totalCredit = lines.reduce((s: number, l: any) => s + Number(l.credit || 0), 0);
      return res.json({
        success: true,
        data: {
          lines,
          totalDebit,
          totalCredit,
          balanced: Math.abs(totalDebit - totalCredit) < 0.01,
        },
      });
    }

    const preview = await buildSimpleVoucherPreview({ tenantId, companyId, input: simpleInput || {} });
    return res.json({ success: true, data: preview });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const validateVoucher = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = scopeWhere(req);
    const { header, lines, requireBalanced } = req.body || {};
    const result = await validateVoucherInput({
      tenantId,
      companyId,
      input: header || {},
      lines: lines || [],
      requireBalanced: requireBalanced !== false,
    });
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// ── Create voucher (enhanced) ──
export const createEnhancedVoucher = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = scopeWhere(req);
    const userId = req.user.id;
    const {
      voucherTypeId,
      financialYearId,
      voucherDate,
      postingDate,
      partyId,
      invoiceNumber,
      invoiceDate,
      narration,
      inputMode,
      amountDetails,
      lines,
      status,
      postImmediately,
    } = req.body || {};

    if (!voucherTypeId || !voucherDate) {
      return res.status(400).json({ success: false, message: '전표 유형과 거래일은 필수입니다.' });
    }

    const vt = await (AcVoucherType as any).findOne({
      where: { id: voucherTypeId, tenant_id: tenantId, company_id: companyId, is_active: true },
    });
    if (!vt) return res.status(404).json({ success: false, message: '전표 유형을 찾을 수 없습니다.' });

    const validation = await validateVoucherInput({
      tenantId,
      companyId,
      input: { voucherDate, voucherTypeId, partyId, financialYearId },
      lines: lines || [],
      requireBalanced: status === 'posted',
    });
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.errors.join(' '), errors: validation.errors });
    }

    const voucherNo = await generateVoucherNumber({ tenantId, companyId, voucherTypeId, voucherDate });

    const glLines = (lines || []).map((line: any, index: number) => ({
      lineNo: line.lineNo || index + 1,
      accountId: line.accountId,
      accountName: line.accountName,
      debit: line.debit,
      credit: line.credit,
      narration: line.narration,
    }));

    const result = await createGlVoucherWithLines({
      tenantId,
      companyId,
      userId,
      voucherType: vt.legacy_type || 'journal',
      voucherDate,
      narration,
      lines: glLines,
      voucherNo,
      postImmediately: false,
    });

    const voucher = result as any;
    await voucher.update({
      voucher_type_id: voucherTypeId,
      financial_year_id: financialYearId ?? null,
      party_id: partyId ?? null,
      posting_date: postingDate || voucherDate,
      invoice_number: invoiceNumber ?? null,
      invoice_date: invoiceDate ?? null,
      input_mode: inputMode || 'simple',
      amount_details: amountDetails ?? null,
      status: status === 'posted' ? 'draft' : status || 'draft',
    });

    const savedLines = await (GlVoucherLine as any).findAll({ where: { voucher_id: voucher.id } });
    for (const saved of savedLines) {
      const src = (lines || []).find((l: any) => l.lineNo === saved.line_no || l.accountId === saved.account_id);
      if (src) {
        await saved.update({
          party_id: src.partyId ?? null,
          gst_code_id: src.gstCodeId ?? null,
          tds_code_id: src.tdsCodeId ?? null,
          transaction_item_id: src.transactionItemId ?? null,
          taxable_amount: src.taxableAmount ?? 0,
          tax_amount: src.taxAmount ?? 0,
          line_category: src.lineCategory ?? null,
        });
      }
    }

    await logAudit(voucher.id, 'created', userId, { inputMode, amountDetails });

    if (postImmediately && status === 'posted') {
      const { postVoucherToLedger } = await import('../services/glPostingService');
      await postVoucherToLedger({ voucherId: voucher.id, tenantId, companyId, userId });
      await logAudit(voucher.id, 'posted', userId);
    }

    const full = await (GlVoucher as any).findByPk(voucher.id, {
      include: [{ model: GlVoucherLine, as: 'lines' }],
    });
    return res.status(201).json({ success: true, data: full, message: '전표가 저장되었습니다.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || '전표 저장 실패' });
  }
};

export const submitVoucher = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = scopeWhere(req);
    const { id } = req.params;
    const voucher = await (GlVoucher as any).findOne({ where: { id, tenant_id: tenantId, company_id: companyId, is_active: true } });
    if (!voucher) return res.status(404).json({ success: false, message: '전표를 찾을 수 없습니다.' });
    await voucher.update({ status: 'review_required', submitted_by: req.user.id, submitted_at: new Date() });
    await logAudit(voucher.id, 'submitted', req.user.id);
    return res.json({ success: true, data: voucher });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const approveVoucherEntry = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = scopeWhere(req);
    const { id } = req.params;
    const voucher = await (GlVoucher as any).findOne({ where: { id, tenant_id: tenantId, company_id: companyId, is_active: true } });
    if (!voucher) return res.status(404).json({ success: false, message: '전표를 찾을 수 없습니다.' });
    await voucher.update({ status: 'approved', approved_by_user: req.user.id, approved_at: new Date() });
    await logAudit(voucher.id, 'approved', req.user.id);
    return res.json({ success: true, data: voucher });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const rejectVoucherEntry = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = scopeWhere(req);
    const { id } = req.params;
    const { reason } = req.body || {};
    const voucher = await (GlVoucher as any).findOne({ where: { id, tenant_id: tenantId, company_id: companyId, is_active: true } });
    if (!voucher) return res.status(404).json({ success: false, message: '전표를 찾을 수 없습니다.' });
    await voucher.update({ status: 'rejected', rejected_by: req.user.id, rejected_at: new Date(), rejection_reason: reason || null });
    await logAudit(voucher.id, 'rejected', req.user.id, { reason });
    return res.json({ success: true, data: voucher });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getNextVoucherNumber = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = scopeWhere(req);
    const voucherTypeId = Number(req.query.voucherTypeId);
    const voucherDate = String(req.query.voucherDate || new Date().toISOString().slice(0, 10));
    if (!voucherTypeId) return res.status(400).json({ success: false, message: 'voucherTypeId가 필요합니다.' });
    const no = await generateVoucherNumber({ tenantId, companyId, voucherTypeId, voucherDate });
    return res.json({ success: true, data: { voucherNo: no } });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
