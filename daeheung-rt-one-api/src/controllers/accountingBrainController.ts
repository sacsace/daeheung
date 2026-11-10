import { Response } from 'express';
import { RequestWithUser } from '../types';
import { resolveCompanyScope } from '../utils/companyScope';
import {
  answerAccountingQuestion,
  listBrainAudits,
  recommendFromExpense,
  recommendFromInvoice,
  recommendVoucher,
  recordLearningCorrection,
} from '../services/accountingBrainService';

/**
 * Accounting Brain HTTP API
 * Recommend / explain / learn only.
 * Never posts to GL.
 */
export const brainRecommend = async (req: RequestWithUser, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }
    const { tenantId, companyId } = resolveCompanyScope(req);
    const body = req.body || {};

    const recommendation = await recommendVoucher({
      tenantId,
      companyId,
      userId: req.user.id,
      financialYearId: body.financialYearId ? Number(body.financialYearId) : null,
      source: String(body.source || 'api'),
      description: body.description ? String(body.description) : undefined,
      sourceDocType: body.sourceDocType ? String(body.sourceDocType) : undefined,
      vendorName: body.vendorName ? String(body.vendorName) : undefined,
      customerName: body.customerName ? String(body.customerName) : undefined,
      invoiceNumber: body.invoiceNumber ? String(body.invoiceNumber) : undefined,
      amount: body.amount != null ? Number(body.amount) : undefined,
      currency: body.currency ? String(body.currency) : undefined,
      transactionDate: body.transactionDate ? String(body.transactionDate) : undefined,
      gstin: body.gstin ? String(body.gstin) : undefined,
      ocrText: body.ocrText ? String(body.ocrText) : undefined,
      narration: body.narration ? String(body.narration) : undefined,
    });

    return res.json({
      success: true,
      data: recommendation,
      message: 'Recommendation generated. No voucher was posted.',
    });
  } catch (error: any) {
    console.error('[AccountingBrain] recommend error:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Accounting Brain recommendation failed',
    });
  }
};

export const brainAsk = async (req: RequestWithUser, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }
    const { tenantId, companyId } = resolveCompanyScope(req);
    const question = String(req.body?.question || '').trim();
    if (!question) {
      return res.status(400).json({ success: false, message: 'question is required' });
    }

    const data = await answerAccountingQuestion({
      tenantId,
      companyId,
      userId: req.user.id,
      question,
    });

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('[AccountingBrain] ask error:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Accounting Brain Q&A failed',
    });
  }
};

export const brainLearn = async (req: RequestWithUser, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }
    const { tenantId, companyId } = resolveCompanyScope(req);
    const body = req.body || {};
    const fieldName = String(body.fieldName || '').trim();
    const afterValue = String(body.afterValue || '').trim();
    if (!fieldName || !afterValue) {
      return res.status(400).json({
        success: false,
        message: 'fieldName and afterValue are required',
      });
    }

    const row = await recordLearningCorrection({
      tenantId,
      companyId,
      userId: req.user.id,
      sourceType: body.sourceType ? String(body.sourceType) : 'manual',
      sourceId: body.sourceId != null ? Number(body.sourceId) : undefined,
      counterpartyName: body.counterpartyName ? String(body.counterpartyName) : undefined,
      keyword: body.keyword ? String(body.keyword) : undefined,
      docType: body.docType ? String(body.docType) : undefined,
      fieldName,
      beforeValue: body.beforeValue != null ? String(body.beforeValue) : undefined,
      afterValue,
      recommendationSnapshot: body.recommendationSnapshot || {},
    });

    return res.json({
      success: true,
      data: row,
      message: 'Correction stored for future recommendations. No voucher was posted.',
    });
  } catch (error: any) {
    console.error('[AccountingBrain] learn error:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to store learning correction',
    });
  }
};

export const brainRecommendFromInvoice = async (req: RequestWithUser, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }
    const { tenantId, companyId } = resolveCompanyScope(req);
    const invoiceId = Number(req.params.id);
    if (!invoiceId) {
      return res.status(400).json({ success: false, message: 'invoice id required' });
    }
    const data = await recommendFromInvoice({
      tenantId,
      companyId,
      userId: req.user.id,
      invoiceId,
    });
    return res.json({
      success: true,
      data,
      message: 'Invoice analyzed. Recommendation only — no voucher posted.',
    });
  } catch (error: any) {
    const status = String(error?.message || '').includes('not found') ? 404 : 500;
    return res.status(status).json({
      success: false,
      message: error?.message || 'Invoice recommendation failed',
    });
  }
};

export const brainRecommendFromExpense = async (req: RequestWithUser, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }
    const { tenantId, companyId } = resolveCompanyScope(req);
    const expenseId = Number(req.params.id);
    if (!expenseId) {
      return res.status(400).json({ success: false, message: 'expense id required' });
    }
    const data = await recommendFromExpense({
      tenantId,
      companyId,
      userId: req.user.id,
      expenseId,
    });
    return res.json({
      success: true,
      data,
      message: 'Expense analyzed. Recommendation only — no voucher posted.',
    });
  } catch (error: any) {
    const status = String(error?.message || '').includes('not found') ? 404 : 500;
    return res.status(status).json({
      success: false,
      message: error?.message || 'Expense recommendation failed',
    });
  }
};

export const brainListAudits = async (req: RequestWithUser, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }
    const { tenantId, companyId } = resolveCompanyScope(req);
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const data = await listBrainAudits({ tenantId, companyId, limit });
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to load brain audit logs',
    });
  }
};
