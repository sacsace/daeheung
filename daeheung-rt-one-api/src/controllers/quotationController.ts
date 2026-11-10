import { Response } from 'express';
import nodemailer from 'nodemailer';
import { RequestWithUser } from '../types';
import { Quotation, Customer, User, Company } from '../models';
import { Op, QueryTypes } from 'sequelize';
import sequelize from '../config/database';
import { buildNodemailerTransportOptions, getResolvedMailTransportOptions } from '../utils/mailConfig';
import {
  bilingualSubject,
  buildBilingualHtml,
  buildBilingualText,
  escapeHtml
} from '../utils/mailBilingual';
import {
  buildQuotationPdfBuffer,
  getCompanyAbbreviationForMail,
  stripLegalEntitySuffixesForSubject,
  toTitleCaseWords
} from '../utils/quotationMailPdf';
import { isParseEmailRecipientsFailure, parseEmailRecipientsList } from '../utils/emailRecipients';
import { pushNotification } from './notificationController';
import SocketService from '../services/socketService';

/**
 * DB 전역 유니크(quotation_number) 기준 다음 번호 — 비활성(목록 숨김) 건 포함해 중복 방지
 * GET /quotations/next-number?year=2026
 */
export const suggestNextQuotationNumber = async (req: RequestWithUser, res: Response) => {
  try {
    const yearParam = req.query.year;
    const year =
      yearParam !== undefined && yearParam !== ''
        ? parseInt(String(yearParam), 10)
        : new Date().getFullYear();

    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ success: false, message: 'year가 올바르지 않습니다.' });
    }

    const rows = await (Quotation as any).findAll({
      attributes: ['quotation_number'],
      where: {
        quotation_number: { [Op.iLike]: `QUO-${year}-%` }
      },
      raw: true
    });

    let maxSeq = 0;
    const re = new RegExp(`^QUO-${year}-(\\d+)$`, 'i');
    for (const r of rows) {
      const qn = String((r as { quotation_number?: string }).quotation_number || '');
      const m = qn.match(re);
      if (m) {
        const n = parseInt(m[1], 10);
        if (!Number.isNaN(n)) maxSeq = Math.max(maxSeq, n);
      }
    }

    const nextSeq = String(maxSeq + 1).padStart(3, '0');
    const quotation_number = `QUO-${year}-${nextSeq}`;

    res.json({ success: true, data: { quotation_number } });
  } catch (error: any) {
    console.error('견적서 번호 채번 오류:', error);
    res.status(500).json({
      success: false,
      message: '견적서 번호를 생성하는 중 오류가 발생했습니다.'
    });
  }
};

// 견적서 목록 조회
export const getQuotations = async (req: RequestWithUser, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userRole = req.user?.role;
    const { customer_id, status, start_date, end_date, company_id } = req.query;

    const whereClause: any = {};
    
    // root나 audit 권한이면 모든 견적서 조회 가능, 아니면 자신의 회사 견적서만
    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
    } else {
      // root는 company_id 쿼리 파라미터로 회사별 필터링 가능
      if (userRole === 'root' && company_id) {
        whereClause.company_id = parseInt(company_id as string);
      } else if (userRole === 'root') {
        // root가 company_id를 지정하지 않으면 모든 회사 조회
      } else {
        // audit는 모든 회사 조회 가능
        if (tenantId) whereClause.tenant_id = tenantId;
        if (companyId) whereClause.company_id = companyId;
      }
    }

    if (customer_id) {
      whereClause.customer_id = customer_id;
    }

    if (status) {
      whereClause.status = status;
    }

    if (start_date && end_date) {
      whereClause.created_at = {
        [Op.between]: [start_date, end_date]
      };
    }

    // 활성화된 견적서만 조회
    whereClause.is_active = true;

    const quotations = await (Quotation as any).findAll({
      where: whereClause,
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'email', 'phone'],
          required: false
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'email'],
          required: false
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'username', 'email'],
          required: false
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: quotations
    });
  } catch (error: any) {
    console.error('견적서 목록 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '견적서 목록 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 작성자별 견적 집계 — 역량 평가 시 반려 건 등 참고용.
 * 행은 소프트 삭제만 하므로(물리 삭제 없음) 과거 반려·승인 실적이 DB에 남습니다.
 */
export const getQuotationCreatorMetrics = async (req: RequestWithUser, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userRole = req.user?.role;
    const company_id = req.query.company_id;

    if (userRole !== 'root' && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '견적 집계는 관리자(root/admin)만 조회할 수 있습니다.'
      });
    }

    const repl: Record<string, unknown> = {};
    const parts: string[] = [];

    // 위에서 root | admin 만 통과 — 감사(audit) 등 다른 역할 분기 불필요
    if (userRole === 'admin') {
      repl.tenantId = tenantId;
      repl.companyId = companyId;
      parts.push('q.tenant_id = :tenantId AND q.company_id = :companyId');
    } else if (userRole === 'root' && company_id) {
      repl.companyId = parseInt(String(company_id), 10);
      parts.push('q.company_id = :companyId');
    } else if (userRole === 'root') {
      /* root + company_id 없음: 전체 합산 */
    }

    const scopeSql = parts.length ? parts.join(' AND ') : '1=1';

    const rows = await sequelize.query(
      `
      SELECT
        q.created_by AS "userId",
        u.username AS "username",
        u.email AS "email",
        COUNT(*) FILTER (WHERE q.is_active = true) AS "activeTotal",
        COUNT(*) FILTER (WHERE q.is_active = true AND q.status = 'pending_approval') AS "pendingApproval",
        COUNT(*) FILTER (WHERE q.is_active = true AND q.status = 'accepted') AS "accepted",
        COUNT(*) FILTER (WHERE q.is_active = true AND q.status = 'sent') AS "sent",
        COUNT(*) FILTER (WHERE q.status = 'rejected') AS "rejected",
        COUNT(*) FILTER (WHERE q.is_active = true AND q.status = 'draft') AS "draft",
        COUNT(*) FILTER (WHERE q.is_active = true AND q.status = 'expired') AS "expired",
        COUNT(*) FILTER (WHERE q.is_active = false) AS "hiddenFromList"
      FROM quotations q
      LEFT JOIN users u ON u.id = q.created_by
      WHERE ${scopeSql}
      GROUP BY q.created_by, u.username, u.email
      ORDER BY u.username NULLS LAST
      `,
      { replacements: repl, type: QueryTypes.SELECT }
    );

    res.json({
      success: true,
      data: rows,
      meta: {
        description:
          'rejected는 목록 숨김 여부와 관계없이 반려 이력을 모두 집계합니다. 작성자(created_by) 기준입니다.'
      }
    });
  } catch (error: any) {
    console.error('견적 작성자 KPI 오류:', error);
    res.status(500).json({
      success: false,
      message: '견적 집계 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 견적서 상세 조회
export const getQuotation = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userRole = req.user?.role;

    const whereClause: any = { id };
    
    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
    }

    // 활성화된 견적서만 조회
    whereClause.is_active = true;

    const quotation = await (Quotation as any).findOne({
      where: whereClause,
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'email', 'phone', 'address'],
          required: false
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'email'],
          required: false
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'username', 'email'],
          required: false
        }
      ]
    });

    if (!quotation) {
      return res.status(404).json({ 
        success: false, 
        message: '견적서를 찾을 수 없습니다.' 
      });
    }

    res.json({ success: true, data: quotation });
  } catch (error: any) {
    console.error('견적서 상세 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '견적서 상세 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/** 동일 회사 소속 사용자인지 확인 */
async function assertUserInCompany(
  userId: number,
  tenantId: number | undefined,
  companyId: number | undefined
): Promise<boolean> {
  const u = await (User as any).findOne({
    where: { id: userId, tenant_id: tenantId, company_id: companyId },
    attributes: ['id']
  });
  return !!u;
}

/** DB/요청에서 온 items를 배열로 */
function normalizeQuotationItems(items: unknown): unknown[] {
  if (Array.isArray(items)) return items;
  if (typeof items === 'string') {
    try {
      const p = JSON.parse(items);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** PostgreSQL DECIMAL(15,2) — 절대값은 10^13 미만 */
const QUOTATION_DECIMAL_MAX = 9999999999999.99;

function isWithinQuotationMoneyLimit(value: unknown): boolean {
  const n = Number(value);
  if (!Number.isFinite(n)) return false;
  return Math.abs(n) <= QUOTATION_DECIMAL_MAX;
}

function isNumericOverflowError(error: unknown): boolean {
  const e = error as { original?: { code?: string }; parent?: { code?: string } };
  return (e?.original?.code ?? e?.parent?.code) === '22003';
}

function validateQuotationAmounts(payload: {
  subtotal?: unknown;
  tax_amount?: unknown;
  discount?: unknown;
  total_amount?: unknown;
  items?: unknown;
}): string | null {
  const totals: Array<[string, unknown]> = [
    ['소계', payload.subtotal],
    ['세액', payload.tax_amount],
    ['할인', payload.discount],
    ['합계', payload.total_amount],
  ];
  for (const [label, value] of totals) {
    if (value !== undefined && value !== null && !isWithinQuotationMoneyLimit(value)) {
      return `금액(${label})이 저장 가능한 최대값(9,999,999,999,999.99)을 초과했습니다. 수량·단가를 확인하세요.`;
    }
  }

  const rows = normalizeQuotationItems(payload.items);
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] as Record<string, unknown>;
    const qty = Number(row.quantity);
    const unitPrice = Number(row.unitPrice ?? row.unit_price);
    if (Number.isFinite(qty) && Number.isFinite(unitPrice) && !isWithinQuotationMoneyLimit(qty * unitPrice)) {
      return `품목 ${i + 1}의 수량×단가가 저장 가능한 최대값(9,999,999,999,999.99)을 초과했습니다.`;
    }
    const lineTotal = Number(row.finalPrice ?? row.totalPrice ?? row.total_price);
    if (Number.isFinite(lineTotal) && !isWithinQuotationMoneyLimit(lineTotal)) {
      return `품목 ${i + 1} 금액이 저장 가능한 최대값(9,999,999,999,999.99)을 초과했습니다.`;
    }
  }
  return null;
}

/** 품목별 수량·단가 필수 (API 직접 호출 대비) */
function validateQuotationLineItems(items: unknown): string | null {
  const rows = normalizeQuotationItems(items);
  if (rows.length === 0) {
    return '품목이 하나 이상 필요합니다.';
  }
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const qty = Number(r.quantity);
    const up = Number(r.unitPrice ?? r.unit_price);
    if (!Number.isFinite(qty) || qty < 1) {
      return '각 품목의 수량(QTY)은 1 이상이어야 합니다.';
    }
    if (!Number.isFinite(up) || up <= 0) {
      return '각 품목의 단가(Unit Price)는 0보다 커야 합니다.';
    }
  }
  return null;
}

// 견적서 생성
export const createQuotation = async (req: RequestWithUser, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.id;
    const { quotation_number, customer_id, customer_name, customer_email, customer_phone, 
            customer_address, customer_gst, items, subtotal, tax_rate, tax_amount, discount, total_amount, 
            currency, valid_until, notes, terms, approver_user_id, status: bodyStatus } = req.body;

    const qn = String(quotation_number ?? '').trim();
    if (!qn || !customer_name || !items || total_amount === undefined || total_amount === null) {
      return res.status(400).json({ 
        success: false, 
        message: '필수 필드가 누락되었습니다.' 
      });
    }

    if (!approver_user_id) {
      return res.status(400).json({
        success: false,
        message: '승인자를 지정해야 합니다.'
      });
    }

    const okApprover = await assertUserInCompany(Number(approver_user_id), tenantId, companyId);
    if (!okApprover) {
      return res.status(400).json({
        success: false,
        message: '승인자를 찾을 수 없거나 같은 회사 소속이 아닙니다.'
      });
    }

    // quotation_number: DB 유니크 전역 — 회사별이 아닌 동일 문자열 전체에서 중복 불가
    const existing = await (Quotation as any).findOne({
      where: { quotation_number: qn }
    });

    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: '이미 존재하는 견적서 번호입니다.' 
      });
    }

    const initialStatus =
      bodyStatus === 'draft' ? 'draft' : 'pending_approval';

    const itemsPayload = Array.isArray(items) ? items : [];

    const lineErr = validateQuotationLineItems(itemsPayload);
    if (lineErr) {
      return res.status(400).json({ success: false, message: lineErr });
    }

    const amountErr = validateQuotationAmounts({
      subtotal,
      tax_amount,
      discount,
      total_amount,
      items: itemsPayload,
    });
    if (amountErr) {
      return res.status(400).json({ success: false, message: amountErr });
    }

    let resolvedCustomerEmail: string | null = null;
    if (customer_email !== undefined && customer_email !== null && String(customer_email).trim() !== '') {
      const pr = parseEmailRecipientsList(String(customer_email));
      if (isParseEmailRecipientsFailure(pr)) {
        return res.status(400).json({ success: false, message: pr.message });
      }
      resolvedCustomerEmail = pr.emails.length ? pr.emails.join(', ') : null;
    }

    const quotation = await (Quotation as any).create({
      tenant_id: tenantId,
      company_id: companyId,
      is_active: true,
      quotation_number: qn,
      customer_id: customer_id || null,
      customer_name,
      customer_email: resolvedCustomerEmail,
      customer_phone: customer_phone || null,
      customer_address: customer_address || null,
      customer_gst: customer_gst ? String(customer_gst).trim() || null : null,
      items: itemsPayload,
      subtotal: subtotal || 0,
      tax_rate: tax_rate || 0,
      tax_amount: tax_amount || 0,
      discount: discount || 0,
      total_amount,
      currency: currency || 'KRW',
      valid_until: valid_until || null,
      status: initialStatus,
      approver_user_id: Number(approver_user_id),
      approved_at: null,
      notes: notes || null,
      terms: terms || null,
      created_by: userId
    });

    // 관련 정보 포함하여 반환
    const quotationWithRelations = await (Quotation as any).findByPk(quotation.id, {
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'email', 'phone'],
          required: false
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'email'],
          required: false
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'username', 'email'],
          required: false
        }
      ]
    });

    if (initialStatus === 'pending_approval') {
      const creatorName =
        (quotationWithRelations as any)?.creator?.username || req.user?.username || '작성자';
      const socketService = (req as any).socketService as SocketService | undefined;
      pushNotification(
        {
          title: '견적서 승인 요청',
          message: `${creatorName}님이 견적서 ${qn} 승인을 요청했습니다.`,
          type: 'info',
          target_type: 'user',
          target_id: Number(approver_user_id),
          tenant_id: tenantId,
          company_id: companyId,
          sender_user_id: userId,
          data: {
            feature: 'quotation',
            quotation_id: quotation.id,
            quotation_number: qn,
            href: '/work/quotation',
            title_en: 'Quotation Approval Request',
            message_en: `${creatorName} requested approval for quotation ${qn}.`
          }
        },
        socketService
      );
    }

    res.status(201).json({
      success: true, 
      data: quotationWithRelations 
    });
  } catch (error: any) {
    console.error('견적서 생성 오류:', error);
    if (error?.name === 'SequelizeUniqueConstraintError' || error?.parent?.code === '23505') {
      return res.status(400).json({
        success: false,
        message: '이미 존재하는 견적서 번호입니다.'
      });
    }
    res.status(500).json({ 
      success: false, 
      message: '견적서 생성 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 견적서 수정
export const updateQuotation = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userRole = req.user?.role;
    const { customer_id, customer_name, customer_email, customer_phone, customer_address,
            customer_gst, items, subtotal, tax_rate, tax_amount, discount, total_amount, currency, 
            valid_until, status, notes, terms, approver_user_id } = req.body;

    const whereClause: any = { id, is_active: true };
    
    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
    }

    const quotation = await (Quotation as any).findOne({
      where: whereClause
    });

    if (!quotation) {
      return res.status(404).json({ 
        success: false, 
        message: '견적서를 찾을 수 없습니다.' 
      });
    }

    /** 반려·만료·취소는 수정 불가. 승인·발송은 설명/만료일/품목만 제한 수정 */
    const currentStatus = String(quotation.status);
    const fullyLocked = ['rejected', 'expired', 'cancelled'].includes(currentStatus);
    const partialEditable = currentStatus === 'accepted' || currentStatus === 'sent';

    if (fullyLocked) {
      return res.status(400).json({
        success: false,
        message: '반려·만료된 견적서는 수정할 수 없습니다.'
      });
    }

    if (partialEditable) {
      const itemsPayload =
        items !== undefined ? (Array.isArray(items) ? items : quotation.items) : quotation.items;
      const lineErr = validateQuotationLineItems(itemsPayload);
      if (lineErr) {
        return res.status(400).json({ success: false, message: lineErr });
      }

      const amountErr = validateQuotationAmounts({
        subtotal: subtotal !== undefined ? subtotal : quotation.subtotal,
        tax_amount: tax_amount !== undefined ? tax_amount : quotation.tax_amount,
        discount: discount !== undefined ? discount : quotation.discount,
        total_amount: total_amount !== undefined ? total_amount : quotation.total_amount,
        items: itemsPayload,
      });
      if (amountErr) {
        return res.status(400).json({ success: false, message: amountErr });
      }

      // 고객(받는 회사) 정보는 유지 — 요청 값 무시. 수정 시 재승인 필요
      let nextApproverId = quotation.approver_user_id;
      if (approver_user_id !== undefined && approver_user_id !== null) {
        const ok = await assertUserInCompany(Number(approver_user_id), tenantId, companyId);
        if (!ok) {
          return res.status(400).json({
            success: false,
            message: '승인자를 찾을 수 없거나 같은 회사 소속이 아닙니다.'
          });
        }
        nextApproverId = Number(approver_user_id);
      }

      await quotation.update({
        items: itemsPayload,
        subtotal: subtotal !== undefined ? subtotal : quotation.subtotal,
        tax_rate: tax_rate !== undefined ? tax_rate : quotation.tax_rate,
        tax_amount: tax_amount !== undefined ? tax_amount : quotation.tax_amount,
        discount: discount !== undefined ? discount : quotation.discount,
        total_amount: total_amount !== undefined ? total_amount : quotation.total_amount,
        valid_until: valid_until !== undefined ? valid_until : quotation.valid_until,
        notes: notes !== undefined ? notes : quotation.notes,
        approver_user_id: nextApproverId,
        status: 'pending_approval',
        rejection_reason: null
      });

      const quotationWithRelations = await (Quotation as any).findByPk(quotation.id, {
        include: [
          {
            model: Customer,
            as: 'customer',
            attributes: ['id', 'name', 'email', 'phone'],
            required: false
          },
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'username', 'email'],
            required: false
          },
          {
            model: User,
            as: 'approver',
            attributes: ['id', 'username', 'email'],
            required: false
          }
        ]
      });

      return res.json({
        success: true,
        data: quotationWithRelations
      });
    }

    if (approver_user_id !== undefined && approver_user_id !== null) {
      const ok = await assertUserInCompany(Number(approver_user_id), tenantId, companyId);
      if (!ok) {
        return res.status(400).json({
          success: false,
          message: '승인자를 찾을 수 없거나 같은 회사 소속이 아닙니다.'
        });
      }
    }

    const itemsPayload =
      items !== undefined ? (Array.isArray(items) ? items : quotation.items) : quotation.items;

    const lineErr = validateQuotationLineItems(itemsPayload);
    if (lineErr) {
      return res.status(400).json({ success: false, message: lineErr });
    }

    const amountErr = validateQuotationAmounts({
      subtotal: subtotal !== undefined ? subtotal : quotation.subtotal,
      tax_amount: tax_amount !== undefined ? tax_amount : quotation.tax_amount,
      discount: discount !== undefined ? discount : quotation.discount,
      total_amount: total_amount !== undefined ? total_amount : quotation.total_amount,
      items: itemsPayload,
    });
    if (amountErr) {
      return res.status(400).json({ success: false, message: amountErr });
    }

    let resolvedUpdateEmail: string | null | undefined = undefined;
    if (customer_email !== undefined) {
      const raw = String(customer_email ?? '').trim();
      if (!raw) {
        resolvedUpdateEmail = null;
      } else {
        const pr = parseEmailRecipientsList(raw);
        if (isParseEmailRecipientsFailure(pr)) {
          return res.status(400).json({ success: false, message: pr.message });
        }
        resolvedUpdateEmail = pr.emails.length ? pr.emails.join(', ') : null;
      }
    }

    await quotation.update({
      customer_id: customer_id !== undefined ? customer_id : quotation.customer_id,
      customer_name: customer_name !== undefined ? customer_name : quotation.customer_name,
      customer_email:
        resolvedUpdateEmail !== undefined ? resolvedUpdateEmail : quotation.customer_email,
      customer_phone: customer_phone !== undefined ? customer_phone : quotation.customer_phone,
      customer_address: customer_address !== undefined ? customer_address : quotation.customer_address,
      customer_gst:
        customer_gst !== undefined
          ? (customer_gst ? String(customer_gst).trim() || null : null)
          : quotation.customer_gst,
      items: itemsPayload,
      subtotal: subtotal !== undefined ? subtotal : quotation.subtotal,
      tax_rate: tax_rate !== undefined ? tax_rate : quotation.tax_rate,
      tax_amount: tax_amount !== undefined ? tax_amount : quotation.tax_amount,
      discount: discount !== undefined ? discount : quotation.discount,
      total_amount: total_amount !== undefined ? total_amount : quotation.total_amount,
      currency: currency !== undefined ? currency : quotation.currency,
      valid_until: valid_until !== undefined ? valid_until : quotation.valid_until,
      status: status !== undefined ? status : quotation.status,
      notes: notes !== undefined ? notes : quotation.notes,
      terms: terms !== undefined ? terms : quotation.terms,
      approver_user_id:
        approver_user_id !== undefined && approver_user_id !== null
          ? Number(approver_user_id)
          : quotation.approver_user_id
    });

    // 관련 정보 포함하여 반환
    const quotationWithRelations = await (Quotation as any).findByPk(quotation.id, {
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'email', 'phone'],
          required: false
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'email'],
          required: false
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'username', 'email'],
          required: false
        }
      ]
    });

    res.json({ 
      success: true, 
      data: quotationWithRelations 
    });
    return;
  } catch (error: any) {
    console.error('견적서 수정 오류:', error);
    if (isNumericOverflowError(error)) {
      return res.status(400).json({
        success: false,
        message: '금액이 저장 가능한 최대값(9,999,999,999,999.99)을 초과했습니다. 수량·단가를 확인하세요.',
      });
    }
    res.status(500).json({ 
      success: false, 
      message: '견적서 수정 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 견적서 삭제
export const deleteQuotation = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    const whereClause: any = { id, is_active: true };

    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
    }

    const quotation = await (Quotation as any).findOne({
      where: whereClause
    });

    if (!quotation) {
      return res.status(404).json({ 
        success: false, 
        message: '견적서를 찾을 수 없습니다.' 
      });
    }

    // 소프트 삭제만 수행 — 물리 삭제(DELETE) 없음. 감사·역량 평가용 데이터는 DB에 유지
    await quotation.update({
      is_active: false,
      deleted_at: new Date(),
      deleted_by: userId ?? null
    });

    res.json({ 
      success: true, 
      message: '견적서가 목록에서 숨겨졌습니다. 데이터는 보존됩니다.' 
    });
  } catch (error: any) {
    console.error('견적서 삭제 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '견적서 삭제 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 견적서 전송 (승인 완료·이미 발송됨 건 재발송 포함 → 메일 발송 후 상태는 sent)
export const sendQuotation = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.id;

    const quotation = await (Quotation as any).findOne({
      where: {
        id,
        tenant_id: tenantId,
        company_id: companyId,
        is_active: true,
        status: { [Op.in]: ['accepted', 'sent'] }
      }
    });

    if (!quotation) {
      return res.status(404).json({ 
        success: false, 
        message: '견적서를 찾을 수 없습니다. 승인된 견적서만 이메일로 보낼 수 있습니다.' 
      });
    }

    const recipientParse = parseEmailRecipientsList(String(quotation.customer_email || ''));
    if (isParseEmailRecipientsFailure(recipientParse)) {
      return res.status(400).json({
        success: false,
        message: recipientParse.message
      });
    }
    const toAddresses = recipientParse.emails;
    if (toAddresses.length === 0) {
      return res.status(400).json({
        success: false,
        message: '고객 이메일이 없습니다. 견적서에 고객 이메일을 입력한 뒤 다시 시도하세요.'
      });
    }

    const companyRow = companyId
      ? await (Company as any).findByPk(companyId, { attributes: ['id', 'tenant_id', 'name', 'settings'] })
      : null;

    if (!companyRow) {
      return res.status(404).json({
        success: false,
        message: '회사 정보를 찾을 수 없습니다.'
      });
    }
    if (tenantId != null && Number(companyRow.tenant_id) !== Number(tenantId)) {
      return res.status(403).json({
        success: false,
        message: '권한이 없습니다.'
      });
    }

    const senderRow =
      userId != null
        ? await User.findOne({
            where: { id: userId, tenant_id: tenantId, company_id: companyId },
            attributes: ['id', 'settings']
          })
        : null;

    const mailOpts = getResolvedMailTransportOptions(companyRow, senderRow);
    if (!mailOpts) {
      return res.status(503).json({
        success: false,
        message:
          '메일 서버가 설정되지 않았습니다. 시스템 설정 > 보내는 메일 서버(SMTP)에 호스트·포트·계정·비밀번호를 저장하거나, 서버 환경변수(EMAIL_HOST, EMAIL_USER, EMAIL_PASS)를 설정하세요.'
      });
    }

    const qn = escapeHtml(String(quotation.quotation_number || ''));
    const cnameFull = escapeHtml(String(quotation.customer_name || ''));
    const total = Number(quotation.total_amount) || 0;
    const cur = String(quotation.currency || 'KRW');
    const validUntil = quotation.valid_until
      ? String(quotation.valid_until).split('T')[0]
      : '—';

    const settings = (companyRow as any)?.settings || {};
    const abbrev = getCompanyAbbreviationForMail(settings, String((companyRow as any)?.name || ''));
    const customerShort = stripLegalEntitySuffixesForSubject(String(quotation.customer_name || ''));
    const customerInSubject = toTitleCaseWords(customerShort) || 'Customer';

    const subject = bilingualSubject(
      `[${abbrev}] Quotation attached (${customerInSubject})`,
      `[${abbrev}] Quotation attached (${customerInSubject})`
    );

    const bodyEn = [
      'Dear Customer,',
      '',
      'Please find our quotation in PDF attached for your review.',
      '',
      `Customer: ${quotation.customer_name}`,
      `Quotation no.: ${quotation.quotation_number}`,
      `Total amount: ${cur} ${total.toLocaleString('en-IN')}`,
      `Valid until: ${validUntil}`,
      '',
      'If you have any questions or need a revised offer, please reply to this email.'
    ].join('\n');

    const summaryTable = `
      <table cellpadding="8" style="border-collapse:collapse;border:1px solid #ccc;margin:12px 0;">
        <tr><td style="border:1px solid #ccc;"><b>Customer</b></td><td style="border:1px solid #ccc;">${cnameFull}</td></tr>
        <tr><td style="border:1px solid #ccc;"><b>Quotation no.</b></td><td style="border:1px solid #ccc;">${qn}</td></tr>
        <tr><td style="border:1px solid #ccc;"><b>Total amount</b></td><td style="border:1px solid #ccc;">${cur} ${total.toLocaleString('en-IN')}</td></tr>
        <tr><td style="border:1px solid #ccc;"><b>Valid until</b></td><td style="border:1px solid #ccc;">${escapeHtml(validUntil)}</td></tr>
      </table>
    `;

    const html = buildBilingualHtml({
      titleKo: 'Quotation Sent',
      titleEn: 'Quotation Sent',
      bodyKo: bodyEn,
      bodyEn,
      bodyHtmlEn: `<p style="margin:0 0 8px;">Dear Customer,</p><p style="margin:0 0 8px;">Please find our quotation in PDF attached for your review.</p>${summaryTable}<p>If you have any questions or need a revised offer, please reply to this email.</p>`,
      footerEn: 'This message was sent automatically from the MVS system.'
    });

    const text = buildBilingualText({
      titleKo: 'Quotation Sent',
      titleEn: 'Quotation Sent',
      bodyKo: bodyEn,
      bodyEn,
      footerEn: 'This message was sent automatically from the MVS system.'
    });

    /** Gmail 등은 전체 메시지 약 25MB 제한 — 첨부 PDF는 여유 있게 18MB 이하 권장 */
    const MAX_CLIENT_PDF_BYTES = 18 * 1024 * 1024;
    const rawB64 = req.body && typeof (req.body as any).pdfBase64 === 'string' ? String((req.body as any).pdfBase64).trim() : '';
    let pdfBuffer: Buffer;

    if (rawB64.length > 0) {
      let decoded: Buffer;
      try {
        decoded = Buffer.from(rawB64, 'base64');
      } catch {
        return res.status(400).json({
          success: false,
          message: '첨부 PDF 데이터 형식이 올바르지 않습니다.'
        });
      }
      if (decoded.length === 0) {
        return res.status(400).json({
          success: false,
          message: '첨부 PDF 데이터가 비어 있습니다. 화면에서 다시 생성한 뒤 보내 주세요.'
        });
      }
      if (decoded.slice(0, 4).toString('ascii') !== '%PDF') {
        return res.status(400).json({
          success: false,
          message: '첨부 파일이 유효한 PDF가 아닙니다.'
        });
      }
      if (decoded.length > MAX_CLIENT_PDF_BYTES) {
        return res.status(400).json({
          success: false,
          message: `첨부 PDF가 너무 큽니다(최대 ${Math.floor(MAX_CLIENT_PDF_BYTES / (1024 * 1024))}MB). 화면을 줄이거나 해상도를 낮춘 뒤 다시 시도해 주세요.`
        });
      }
      pdfBuffer = decoded;
    } else {
      pdfBuffer = await buildQuotationPdfBuffer({
        quotation_number: String(quotation.quotation_number || ''),
        customer_name: String(quotation.customer_name || ''),
        customer_email: quotation.customer_email,
        customer_phone: quotation.customer_phone,
        customer_address: quotation.customer_address,
        customer_gst: quotation.customer_gst,
        items: quotation.items,
        subtotal: Number(quotation.subtotal) || 0,
        tax_rate: Number(quotation.tax_rate) || 0,
        tax_amount: Number(quotation.tax_amount) || 0,
        discount: Number(quotation.discount) || 0,
        total_amount: Number(quotation.total_amount) || 0,
        currency: cur,
        valid_until: quotation.valid_until,
        notes: quotation.notes,
        terms: quotation.terms,
        created_at: (quotation as any).created_at ?? (quotation as any).createdAt
      });
    }

    const safeFileBase = String(quotation.quotation_number || 'quotation').replace(/[^\w.-]+/g, '_');
    const pdfFileName = `Quotation-${safeFileBase}.pdf`;

    const transporter = nodemailer.createTransport(buildNodemailerTransportOptions(mailOpts));

    await transporter.sendMail({
      from: mailOpts.from,
      to: toAddresses,
      subject,
      text,
      html,
      attachments: [
        {
          filename: pdfFileName,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    });

    await quotation.update({
      status: 'sent'
    });

    const quotationWithRelations = await (Quotation as any).findByPk(quotation.id, {
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'email', 'phone'],
          required: false
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'email'],
          required: false
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'username', 'email'],
          required: false
        }
      ]
    });

    res.json({ 
      success: true, 
      data: quotationWithRelations 
    });
  } catch (error: any) {
    console.error('견적서 전송 오류:', error);
    const resp = typeof error?.response === 'string' ? error.response : '';
    const isOversizeMail =
      error?.responseCode === 552 ||
      /552|message size|MaxSizeError/i.test(String(resp)) ||
      /552|message size|MaxSizeError/i.test(String(error?.message ?? ''));
    if (isOversizeMail) {
      return res.status(413).json({
        success: false,
        message:
          '메일 전체 크기가 Gmail 등 수신 서버 제한(약 25MB)을 초과했습니다. 견적 내용을 줄이거나, 클라이언트에서 PDF 용량이 줄어든 뒤 다시 보내 주세요.'
      });
    }
    res.status(500).json({
      success: false,
      message: '견적서 전송 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/** 견적서 승인 (지정된 승인자만) */
export const approveQuotation = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const whereClause: any = { id, is_active: true };
    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
    }
    const quotation = await (Quotation as any).findOne({ where: whereClause });

    if (!quotation) {
      return res.status(404).json({ success: false, message: '견적서를 찾을 수 없습니다.' });
    }

    if (quotation.status !== 'pending_approval') {
      return res.status(400).json({ success: false, message: '승인 대기 상태의 견적서만 승인할 수 있습니다.' });
    }

    const isApprover = Number(quotation.approver_user_id) === Number(userId);
    const isAdmin = userRole === 'root' || userRole === 'admin';
    if (!isApprover && !isAdmin) {
      return res.status(403).json({ success: false, message: '지정된 승인자만 승인할 수 있습니다.' });
    }

    await quotation.update({
      status: 'accepted',
      approved_at: new Date()
    });

    const quotationWithRelations = await (Quotation as any).findByPk(quotation.id, {
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'email', 'phone'], required: false },
        { model: User, as: 'creator', attributes: ['id', 'username', 'email'], required: false },
        { model: User, as: 'approver', attributes: ['id', 'username', 'email'], required: false }
      ]
    });

    res.json({ success: true, data: quotationWithRelations });
  } catch (error: any) {
    console.error('견적서 승인 오류:', error);
    res.status(500).json({
      success: false,
      message: '견적서 승인 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/** 견적서 반려 */
export const rejectQuotation = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const whereClause: any = { id, is_active: true };
    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
    }
    const quotation = await (Quotation as any).findOne({ where: whereClause });

    if (!quotation) {
      return res.status(404).json({ success: false, message: '견적서를 찾을 수 없습니다.' });
    }

    if (quotation.status !== 'pending_approval') {
      return res.status(400).json({ success: false, message: '승인 대기 상태의 견적서만 반려할 수 있습니다.' });
    }

    const isApprover = Number(quotation.approver_user_id) === Number(userId);
    const isAdmin = userRole === 'root' || userRole === 'admin';
    if (!isApprover && !isAdmin) {
      return res.status(403).json({ success: false, message: '지정된 승인자만 반려할 수 있습니다.' });
    }

    const reasonRaw = String((req.body as any)?.reason ?? '').trim();

    await quotation.update({
      status: 'rejected',
      approved_at: null,
      rejection_reason: reasonRaw
    });

    const quotationWithRelations = await (Quotation as any).findByPk(quotation.id, {
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'email', 'phone'], required: false },
        { model: User, as: 'creator', attributes: ['id', 'username', 'email'], required: false },
        { model: User, as: 'approver', attributes: ['id', 'username', 'email'], required: false }
      ]
    });

    res.json({ success: true, data: quotationWithRelations });
  } catch (error: any) {
    console.error('견적서 반려 오류:', error);
    res.status(500).json({
      success: false,
      message: '견적서 반려 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

