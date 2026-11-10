import { Response } from 'express';
import { Op } from 'sequelize';
import { GlAccount, GlVoucher, GlVoucherLine } from '../models';
import { RequestWithUser } from '../types';
import {
  assertBalanced,
  createGlVoucherWithLines,
  ensureDefaultChartOfAccounts,
  postVoucherToLedger,
} from '../services/glPostingService';
import { resolveCompanyScope } from '../utils/companyScope';
import { toSentenceCase } from '../utils/textCase';

const parseAmount = (value: unknown) => {
  if (value == null) return 0;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Tally에서 가져온 계정과목만 (수동/한글 기본 COA 제외) */
const tallyAccountWhereExtra = {
  [Op.or]: [
    { code: { [Op.iLike]: 'TLY%' } },
    { search_aliases: { [Op.iLike]: '%guid:%' } },
  ],
};

const BOOK_VOUCHER_STATUSES = ['draft', 'posted', 'approved', 'review_required'] as const;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const parseIsoDateQuery = (value: unknown): { ok: true; value?: string } | { ok: false } => {
  if (value == null || value === '') return { ok: true, value: undefined };
  const text = String(value).trim().slice(0, 10);
  if (!ISO_DATE_RE.test(text)) return { ok: false };
  return { ok: true, value: text };
};

type LedgerMovement = {
  accountId: number;
  debit: number;
  credit: number;
  periodDebit: number;
  periodCredit: number;
};

/**
 * 전표 라인을 계정별로 한 번에 합산한다.
 * 기존에는 계정 수만큼 전표 라인을 조회(N+1)해 재무제표가 느려졌다.
 */
const getLedgerMovements = async (params: {
  tenantId: number;
  companyId: number;
  from?: string;
  to?: string;
  /** voucher_date < before (기간 시작 전 이동) */
  before?: string;
  accountId?: number;
  natures?: string[];
  /** from~to 기간 합계를 같은 스캔에서 추가로 계산 */
  periodFrom?: string;
  tallyOnly?: boolean;
  postedOnly?: boolean;
  bookStatuses?: boolean;
}): Promise<Map<number, LedgerMovement>> => {
  const replacements: Record<string, unknown> = {
    tenantId: params.tenantId,
    companyId: params.companyId,
  };
  const clauses = [
    'v.tenant_id = :tenantId',
    'v.company_id = :companyId',
    'v.is_active = true',
  ];

  if (params.tallyOnly) {
    clauses.push("v.input_mode = 'tally_import'");
    clauses.push("v.status IN ('draft', 'posted', 'approved', 'review_required')");
  } else if (params.postedOnly) {
    clauses.push("v.status = 'posted'");
  } else {
    clauses.push("v.status IN ('draft', 'posted', 'approved', 'review_required')");
  }
  if (params.from) {
    clauses.push('v.voucher_date >= :from');
    replacements.from = params.from;
  }
  if (params.to) {
    clauses.push('v.voucher_date <= :to');
    replacements.to = params.to;
  }
  if (params.before) {
    clauses.push('v.voucher_date < :before');
    replacements.before = params.before;
  }
  if (params.accountId) {
    clauses.push('l.account_id = :accountId');
    replacements.accountId = params.accountId;
  }

  const joinAccount = Boolean(params.natures?.length);
  if (joinAccount && params.natures?.length) {
    clauses.push('a.tenant_id = :tenantId');
    clauses.push('a.company_id = :companyId');
    clauses.push('a.nature IN (:natures)');
    replacements.natures = params.natures;
  }

  const periodSelect = params.periodFrom
    ? `,
       COALESCE(SUM(CASE WHEN v.voucher_date >= :periodFrom THEN l.debit ELSE 0 END), 0) AS "periodDebit",
       COALESCE(SUM(CASE WHEN v.voucher_date >= :periodFrom THEN l.credit ELSE 0 END), 0) AS "periodCredit"`
    : '';
  if (params.periodFrom) replacements.periodFrom = params.periodFrom;

  const [rows] = await (GlVoucherLine as any).sequelize.query(
    `SELECT
       l.account_id AS "accountId",
       COALESCE(SUM(l.debit), 0) AS debit,
       COALESCE(SUM(l.credit), 0) AS credit
       ${periodSelect}
     FROM gl_voucher_lines l
     INNER JOIN gl_vouchers v ON v.id = l.voucher_id
     ${joinAccount ? 'INNER JOIN gl_accounts a ON a.id = l.account_id' : ''}
     WHERE ${clauses.join(' AND ')}
     GROUP BY l.account_id`,
    { replacements }
  );

  return new Map(
    (rows as any[]).map((row) => {
      const accountId = Number(row.accountId);
      const debit = parseAmount(row.debit);
      const credit = parseAmount(row.credit);
      return [
        accountId,
        {
          accountId,
          debit,
          credit,
          periodDebit: params.periodFrom ? parseAmount(row.periodDebit) : debit,
          periodCredit: params.periodFrom ? parseAmount(row.periodCredit) : credit,
        },
      ];
    })
  );
};

const buildAccountTree = (rows: any[]) => {
  const map = new Map<number, any>();
  rows.forEach((row) => map.set(row.id, { ...row.toJSON(), children: [] }));
  const roots: any[] = [];
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id).children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
};

export const seedGlAccounts = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = resolveCompanyScope(req);
    const { id: userId } = req.user;
    const result = await ensureDefaultChartOfAccounts({
      tenantId,
      companyId,
      userId,
    });
    return res.json({
      success: true,
      data: result,
      message: '계정과목은 Tally 임포트로 등록합니다. 한글 기본 계정과목 자동 생성은 사용하지 않습니다.',
    });
  } catch (error: any) {
    console.error('계정과목 시드 오류:', error);
    return res.status(500).json({ success: false, message: error.message || '계정과목 생성에 실패했습니다.' });
  }
};

export const getGlAccounts = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = resolveCompanyScope(req);
    const tree = String(req.query.tree || '') === 'true';
    const ledgerOnly = String(req.query.ledgerOnly || '') === 'true';

    const where: any = { tenant_id: tenantId, company_id: companyId, is_active: true };
    if (ledgerOnly) where.account_type = 'ledger';

    const rows = await (GlAccount as any).findAll({
      where,
      attributes: [
        'id',
        'parent_id',
        'code',
        'name',
        'name_en',
        'account_type',
        'nature',
        'opening_balance',
        'current_balance',
        'account_group',
        'is_cash_or_bank',
        'is_ar_ap',
      ],
      order: [
        ['code', 'ASC'],
        ['id', 'ASC'],
      ],
    });

    return res.json({
      success: true,
      data: tree ? buildAccountTree(rows) : rows,
    });
  } catch (error: any) {
    console.error('계정과목 조회 오류:', error);
    return res.status(500).json({ success: false, message: '계정과목 조회에 실패했습니다.' });
  }
};

export const createGlAccount = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = resolveCompanyScope(req);
    const { id: userId, role } = req.user;
    if (!(role === 'root' || role === 'admin')) {
      return res.status(403).json({ success: false, message: '계정과목 등록 권한이 없습니다.' });
    }

    const code = String(req.body?.code || '').trim();
    const name = toSentenceCase(req.body?.name);
    if (!code || !name) {
      return res.status(400).json({ success: false, message: '계정코드와 계정명은 필수입니다.' });
    }

    const created = await (GlAccount as any).create({
      tenant_id: tenantId,
      company_id: companyId,
      parent_id: req.body?.parentId ?? null,
      code,
      name,
      name_en: req.body?.nameEn ? toSentenceCase(req.body.nameEn) : null,
      account_type: req.body?.accountType === 'group' ? 'group' : 'ledger',
      nature: req.body?.nature || 'expense',
      opening_balance: parseAmount(req.body?.openingBalance),
      current_balance: parseAmount(req.body?.openingBalance),
      is_system: false,
      is_active: true,
      created_by: userId,
      updated_by: userId,
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    console.error('계정과목 생성 오류:', error);
    const status = String(error.message || '').includes('unique') ? 409 : 500;
    return res.status(status).json({ success: false, message: error.message || '계정과목 생성에 실패했습니다.' });
  }
};

export const updateGlAccount = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const { tenantId, companyId } = resolveCompanyScope(req);
    const { id: userId, role } = req.user;
    if (!(role === 'root' || role === 'admin')) {
      return res.status(403).json({ success: false, message: '계정과목 수정 권한이 없습니다.' });
    }

    const row = await (GlAccount as any).findOne({
      where: { id, tenant_id: tenantId, company_id: companyId, is_active: true },
    });
    if (!row) return res.status(404).json({ success: false, message: '계정과목을 찾을 수 없습니다.' });

    const opening = req.body?.openingBalance != null ? parseAmount(req.body.openingBalance) : parseAmount(row.opening_balance);
    await row.update({
      parent_id: req.body?.parentId ?? row.parent_id,
      code: req.body?.code != null ? String(req.body.code).trim() : row.code,
      name: req.body?.name != null ? toSentenceCase(req.body.name) : row.name,
      name_en: req.body?.nameEn != null ? (String(req.body.nameEn).trim() ? toSentenceCase(req.body.nameEn) : null) : row.name_en,
      account_type: req.body?.accountType === 'group' ? 'group' : row.account_type,
      nature: req.body?.nature || row.nature,
      opening_balance: opening,
      current_balance: req.body?.openingBalance != null ? opening : row.current_balance,
      updated_by: userId,
    });

    return res.json({ success: true, data: row });
  } catch (error: any) {
    console.error('계정과목 수정 오류:', error);
    return res.status(500).json({ success: false, message: error.message || '계정과목 수정에 실패했습니다.' });
  }
};

export const deleteGlAccount = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const { tenantId, companyId } = resolveCompanyScope(req);
    const { id: userId, role } = req.user;
    if (!(role === 'root' || role === 'admin')) {
      return res.status(403).json({ success: false, message: '계정과목 삭제 권한이 없습니다.' });
    }

    const row = await (GlAccount as any).findOne({
      where: { id, tenant_id: tenantId, company_id: companyId, is_active: true },
    });
    if (!row) return res.status(404).json({ success: false, message: '계정과목을 찾을 수 없습니다.' });
    const childCount = await (GlAccount as any).count({
      where: { parent_id: row.id, tenant_id: tenantId, company_id: companyId, is_active: true },
    });
    if (childCount > 0) {
      return res.status(400).json({ success: false, message: '하위 계정이 있어 삭제할 수 없습니다.' });
    }

    const lineCount = await (GlVoucherLine as any).count({
      where: { account_id: row.id },
    });
    if (lineCount > 0) {
      return res.status(400).json({ success: false, message: '전표에 사용된 계정과목은 삭제할 수 없습니다.' });
    }

    await row.update({ is_active: false, updated_by: userId });
    return res.json({ success: true, message: '계정과목이 삭제되었습니다.' });
  } catch (error: any) {
    console.error('계정과목 삭제 오류:', error);
    return res.status(500).json({ success: false, message: error.message || '계정과목 삭제에 실패했습니다.' });
  }
};

export const getGlVouchers = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = resolveCompanyScope(req);
    const status = req.query.status ? String(req.query.status) : undefined;
    const fromParsed = parseIsoDateQuery(req.query.from);
    const toParsed = parseIsoDateQuery(req.query.to);
    if (!fromParsed.ok || !toParsed.ok) {
      return res.status(400).json({ success: false, message: '조회 기간 형식이 올바르지 않습니다.' });
    }
    const from = fromParsed.value;
    const to = toParsed.value;

    const where: any = { tenant_id: tenantId, company_id: companyId, is_active: true };
    if (status) where.status = status;
    if (from || to) {
      where.voucher_date = {};
      if (from) where.voucher_date[Op.gte] = from;
      if (to) where.voucher_date[Op.lte] = to;
    }

    const rows = await (GlVoucher as any).findAll({
      where,
      attributes: [
        'id',
        'voucher_no',
        'voucher_type',
        'voucher_date',
        'narration',
        'status',
        'total_debit',
        'total_credit',
        'input_mode',
        'source_type',
      ],
      order: [
        ['voucher_date', 'DESC'],
        ['id', 'DESC'],
      ],
      limit: Math.min(Number(req.query.limit) || 200, 500),
    });

    return res.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('전표 목록 조회 오류:', error);
    return res.status(500).json({ success: false, message: '전표 목록 조회에 실패했습니다.' });
  }
};

export const getGlVoucherById = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const { tenantId, companyId } = resolveCompanyScope(req);
    const voucherId = Number(id);
    if (!Number.isFinite(voucherId) || voucherId <= 0) {
      return res.status(400).json({ success: false, message: '전표 ID가 올바르지 않습니다.' });
    }
    const row = await (GlVoucher as any).findOne({
      where: { id: voucherId, tenant_id: tenantId, company_id: companyId, is_active: true },
      attributes: [
        'id',
        'voucher_no',
        'voucher_type',
        'voucher_date',
        'narration',
        'status',
        'total_debit',
        'total_credit',
        'input_mode',
        'source_type',
        'currency_code',
      ],
      include: [
        {
          model: GlVoucherLine,
          as: 'lines',
          required: false,
          attributes: [
            'id',
            'voucher_id',
            'line_no',
            'account_id',
            'account_name',
            'debit',
            'credit',
            'narration',
          ],
        },
      ],
      order: [[{ model: GlVoucherLine, as: 'lines' }, 'line_no', 'ASC']],
    });
    if (!row) return res.status(404).json({ success: false, message: '전표를 찾을 수 없습니다.' });
    return res.json({ success: true, data: row });
  } catch (error: any) {
    console.error('전표 상세 조회 오류:', error);
    return res.status(500).json({ success: false, message: '전표 상세 조회에 실패했습니다.' });
  }
};

export const createGlVoucher = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = resolveCompanyScope(req);
    const { id: userId } = req.user;
    const lines = Array.isArray(req.body?.lines) ? req.body.lines : [];
    if (!lines.length) {
      return res.status(400).json({ success: false, message: '전표 라인이 필요합니다.' });
    }

    const voucher = await createGlVoucherWithLines({
      tenantId,
      companyId,
      userId,
      voucherType: req.body?.voucherType,
      voucherDate: req.body?.voucherDate || new Date().toISOString().slice(0, 10),
      narration: req.body?.narration,
      lines,
      sourceType: 'manual',
      postImmediately: Boolean(req.body?.postImmediately),
    });

    const detail = await (GlVoucher as any).findOne({
      where: { id: voucher.id },
      include: [{ model: GlVoucherLine, as: 'lines' }],
    });

    return res.status(201).json({ success: true, data: detail });
  } catch (error: any) {
    console.error('전표 생성 오류:', error);
    if (String(error.message || '').includes('복식부기')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: '전표 생성에 실패했습니다.' });
  }
};

export const postGlVoucher = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const { tenantId, companyId } = resolveCompanyScope(req);
    const { id: userId, role } = req.user;
    const voucherId = Number(id);
    if (!Number.isFinite(voucherId) || voucherId <= 0) {
      return res.status(400).json({ success: false, message: '전표 ID가 올바르지 않습니다.' });
    }
    if (!(role === 'root' || role === 'admin')) {
      return res.status(403).json({ success: false, message: '장부 반영 권한이 없습니다.' });
    }

    await postVoucherToLedger({ voucherId, tenantId, companyId, userId });
    const detail = await (GlVoucher as any).findOne({
      where: { id: voucherId, tenant_id: tenantId, company_id: companyId },
      include: [{ model: GlVoucherLine, as: 'lines' }],
    });
    return res.json({ success: true, data: detail, message: '장부에 반영되었습니다.' });
  } catch (error: any) {
    console.error('전표 장부 반영 오류:', error);
    if (String(error.message || '').includes('이미')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: '장부 반영에 실패했습니다.' });
  }
};

/** Post all (or selected) draft vouchers for the company */
export const bulkPostGlVouchers = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = resolveCompanyScope(req);
    const { id: userId, role } = req.user;
    if (!(role === 'root' || role === 'admin')) {
      return res.status(403).json({ success: false, message: '장부 반영 권한이 없습니다.' });
    }

    const idsRaw = Array.isArray(req.body?.ids) ? req.body.ids : null;
    const where: any = {
      tenant_id: tenantId,
      company_id: companyId,
      status: 'draft',
      is_active: true,
    };
    if (idsRaw && idsRaw.length > 0) {
      where.id = { [Op.in]: idsRaw.map((v: unknown) => Number(v)).filter((n: number) => Number.isFinite(n) && n > 0) };
    }

    const drafts = await (GlVoucher as any).findAll({
      where,
      order: [['voucher_date', 'ASC'], ['id', 'ASC']],
      attributes: ['id', 'voucher_no'],
    });

    if (!drafts.length) {
      return res.json({
        success: true,
        message: '반영할 임시 전표가 없습니다.',
        data: { posted: 0, failed: 0, failures: [] },
      });
    }

    const failures: Array<{ id: number; voucherNo: string; message: string }> = [];
    let posted = 0;

    for (const row of drafts) {
      try {
        await postVoucherToLedger({
          voucherId: Number(row.id),
          tenantId,
          companyId,
          userId,
        });
        posted += 1;
      } catch (err: any) {
        failures.push({
          id: Number(row.id),
          voucherNo: String(row.voucher_no || ''),
          message: err?.message || '반영 실패',
        });
      }
    }

    return res.json({
      success: true,
      message: `임시 전표 ${posted}건이 장부에 반영되었습니다.${failures.length ? ` (실패 ${failures.length}건)` : ''}`,
      data: {
        posted,
        failed: failures.length,
        failures: failures.slice(0, 50),
      },
    });
  } catch (error: any) {
    console.error('전표 일괄 장부 반영 오류:', error);
    return res.status(500).json({ success: false, message: '일괄 장부 반영에 실패했습니다.' });
  }
};

export const getAccountLedger = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = resolveCompanyScope(req);
    const accountId = Number(req.query.accountId);
    const fromParsed = parseIsoDateQuery(req.query.from);
    const toParsed = parseIsoDateQuery(req.query.to);
    if (!fromParsed.ok || !toParsed.ok) {
      return res.status(400).json({ success: false, message: '조회 기간 형식이 올바르지 않습니다.' });
    }
    const from = fromParsed.value;
    const to = toParsed.value;

    if (!Number.isFinite(accountId) || accountId <= 0) {
      return res.status(400).json({ success: false, message: 'accountId가 필요합니다.' });
    }

    const account = await (GlAccount as any).findOne({
      where: { id: accountId, tenant_id: tenantId, company_id: companyId, is_active: true },
      attributes: ['id', 'code', 'name', 'name_en', 'nature', 'opening_balance', 'current_balance'],
    });
    if (!account) return res.status(404).json({ success: false, message: '계정과목을 찾을 수 없습니다.' });

    const applyDelta = (nature: string, debit: number, credit: number) =>
      nature === 'asset' || nature === 'expense' ? debit - credit : credit - debit;

    let opening = parseAmount(account.opening_balance);
    if (from) {
      const prior = await getLedgerMovements({
        tenantId,
        companyId,
        accountId,
        before: from,
      });
      const movement = prior.get(accountId);
      opening = Number(
        (
          opening +
          applyDelta(String(account.nature), movement?.debit || 0, movement?.credit || 0)
        ).toFixed(2)
      );
    }

    const voucherWhere: any = {
      tenant_id: tenantId,
      company_id: companyId,
      is_active: true,
      status: { [Op.in]: [...BOOK_VOUCHER_STATUSES] },
    };
    if (from || to) {
      voucherWhere.voucher_date = {};
      if (from) voucherWhere.voucher_date[Op.gte] = from;
      if (to) voucherWhere.voucher_date[Op.lte] = to;
    }

    const lines = await (GlVoucherLine as any).findAll({
      where: { account_id: accountId },
      attributes: ['id', 'voucher_id', 'line_no', 'debit', 'credit', 'narration'],
      include: [
        {
          model: GlVoucher,
          as: 'voucher',
          required: true,
          attributes: ['id', 'voucher_no', 'voucher_date', 'narration', 'status'],
          where: voucherWhere,
        },
      ],
      order: [
        [{ model: GlVoucher, as: 'voucher' }, 'voucher_date', 'ASC'],
        [{ model: GlVoucher, as: 'voucher' }, 'id', 'ASC'],
        ['line_no', 'ASC'],
      ],
    });

    let running = opening;
    const entries = lines.map((line: any) => {
      const debit = parseAmount(line.debit);
      const credit = parseAmount(line.credit);
      running = Number((running + applyDelta(String(account.nature), debit, credit)).toFixed(2));
      return {
        id: line.id,
        voucherId: line.voucher_id,
        voucherNo: line.voucher?.voucher_no,
        voucherDate: line.voucher?.voucher_date,
        narration: line.narration || line.voucher?.narration,
        debit,
        credit,
        runningBalance: running,
      };
    });

    return res.json({
      success: true,
      data: {
        account: {
          id: account.id,
          code: account.code,
          name: account.name,
          name_en: account.name_en,
          nature: account.nature,
        },
        openingBalance: opening,
        currentBalance: parseAmount(account.current_balance),
        entries,
        closingBalance: running,
      },
    });
  } catch (error: any) {
    console.error('장부 조회 오류:', error);
    return res.status(500).json({ success: false, message: '장부 조회에 실패했습니다.' });
  }
};

export const getTrialBalance = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = resolveCompanyScope(req);
    const fromParsed = parseIsoDateQuery(req.query.from);
    const toParsed = parseIsoDateQuery(req.query.to);
    if (!fromParsed.ok || !toParsed.ok) {
      return res.status(400).json({ success: false, message: '조회 기간 형식이 올바르지 않습니다.' });
    }
    const from = fromParsed.value;
    const to = toParsed.value;

    const tallyOnly = req.query.tallyOnly === '1' || req.query.tallyOnly === 'true';
    const accounts = await (GlAccount as any).findAll({
      where: {
        tenant_id: tenantId,
        company_id: companyId,
        is_active: true,
        account_type: 'ledger',
        ...(tallyOnly ? tallyAccountWhereExtra : {}),
      },
      attributes: ['id', 'code', 'name', 'name_en', 'nature', 'current_balance'],
      order: [['code', 'ASC']],
    });

    const movements = await getLedgerMovements({
      tenantId,
      companyId,
      from,
      to,
      tallyOnly: tallyOnly || undefined,
      postedOnly: tallyOnly ? undefined : true,
    });

    const rows = [];
    let totalDebit = 0;
    let totalCredit = 0;

    for (const account of accounts) {
      const movement = movements.get(Number(account.id));
      const debit = movement?.debit || 0;
      const credit = movement?.credit || 0;
      if (debit === 0 && credit === 0) {
        if (tallyOnly || parseAmount(account.current_balance) === 0) continue;
      }
      totalDebit += debit;
      totalCredit += credit;
      rows.push({
        accountId: account.id,
        code: account.code,
        name: account.name,
        nameEn: account.name_en,
        nature: account.nature,
        debit: Number(debit.toFixed(2)),
        credit: Number(credit.toFixed(2)),
        balance: Number(parseAmount(account.current_balance).toFixed(2)),
      });
    }

    return res.json({
      success: true,
      data: {
        rows,
        totalDebit: Number(totalDebit.toFixed(2)),
        totalCredit: Number(totalCredit.toFixed(2)),
      },
    });
  } catch (error: any) {
    console.error('시산표 조회 오류:', error);
    return res.status(500).json({ success: false, message: '시산표 조회에 실패했습니다.' });
  }
};

/** 손익계산서 — 기간 내 수익·비용 계정 집계 */
export const getProfitAndLoss = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = resolveCompanyScope(req);
    const fromParsed = parseIsoDateQuery(req.query.from);
    const toParsed = parseIsoDateQuery(req.query.to);
    if (!fromParsed.ok || !toParsed.ok) {
      return res.status(400).json({ success: false, message: '조회 기간 형식이 올바르지 않습니다.' });
    }
    const from = fromParsed.value;
    const to = toParsed.value;

    const accounts = await (GlAccount as any).findAll({
      where: {
        tenant_id: tenantId,
        company_id: companyId,
        is_active: true,
        account_type: 'ledger',
        nature: { [Op.in]: ['income', 'expense'] },
        ...tallyAccountWhereExtra,
      },
      attributes: ['id', 'code', 'name', 'name_en', 'nature'],
      order: [['code', 'ASC']],
    });

    const movements = await getLedgerMovements({
      tenantId,
      companyId,
      from,
      to,
      tallyOnly: true,
      natures: ['income', 'expense'],
    });

    const incomeRows: any[] = [];
    const expenseRows: any[] = [];
    let totalIncome = 0;
    let totalExpense = 0;

    for (const account of accounts) {
      const movement = movements.get(Number(account.id));
      const debit = movement?.debit || 0;
      const credit = movement?.credit || 0;

      const row = {
        accountId: account.id,
        code: account.code,
        name: account.name,
        nameEn: account.name_en,
        nature: account.nature,
        debit: Number(debit.toFixed(2)),
        credit: Number(credit.toFixed(2)),
      };

      if (account.nature === 'income') {
        const amount = Number((credit - debit).toFixed(2));
        if (amount === 0) continue;
        totalIncome += amount;
        incomeRows.push({ ...row, amount });
      } else {
        const amount = Number((debit - credit).toFixed(2));
        if (amount === 0) continue;
        totalExpense += amount;
        expenseRows.push({ ...row, amount });
      }
    }

    incomeRows.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    expenseRows.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

    totalIncome = Number(totalIncome.toFixed(2));
    totalExpense = Number(totalExpense.toFixed(2));
    const netProfit = Number((totalIncome - totalExpense).toFixed(2));

    return res.json({
      success: true,
      data: {
        from: from || null,
        to: to || null,
        incomeRows,
        expenseRows,
        totalIncome,
        totalExpense,
        netProfit,
        grossProfit: totalIncome,
        source: 'tally_import',
      },
    });
  } catch (error: any) {
    console.error('손익계산서 조회 오류:', error);
    return res.status(500).json({ success: false, message: '손익계산서 조회에 실패했습니다.' });
  }
};

export const getBalanceSheet = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = resolveCompanyScope(req);
    const asOfParsed = parseIsoDateQuery(req.query.asOf);
    const fromParsed = parseIsoDateQuery(req.query.from);
    if (!asOfParsed.ok || !fromParsed.ok) {
      return res.status(400).json({ success: false, message: '조회 기간 형식이 올바르지 않습니다.' });
    }
    const asOf = asOfParsed.value;
    const from = fromParsed.value;

    const accounts = await (GlAccount as any).findAll({
      where: {
        tenant_id: tenantId,
        company_id: companyId,
        is_active: true,
        account_type: 'ledger',
        nature: { [Op.in]: ['asset', 'liability', 'equity', 'income', 'expense'] },
        ...tallyAccountWhereExtra,
      },
      attributes: ['id', 'code', 'name', 'name_en', 'nature', 'opening_balance'],
      order: [['code', 'ASC']],
    });

    const movements = await getLedgerMovements({
      tenantId,
      companyId,
      to: asOf,
      tallyOnly: true,
      periodFrom: from,
    });

    const applyDelta = (nature: string, debit: number, credit: number) =>
      nature === 'asset' || nature === 'expense' ? debit - credit : credit - debit;

    const assetRows: any[] = [];
    const liabilityRows: any[] = [];
    const equityRows: any[] = [];
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let periodIncome = 0;
    let periodExpense = 0;

    for (const account of accounts) {
      const movement = movements.get(Number(account.id));
      const debit = movement?.debit || 0;
      const credit = movement?.credit || 0;
      const nature = String(account.nature);

      if (nature === 'income' || nature === 'expense') {
        const periodDebit = movement?.periodDebit || 0;
        const periodCredit = movement?.periodCredit || 0;
        if (nature === 'income') periodIncome += periodCredit - periodDebit;
        else periodExpense += periodDebit - periodCredit;
        continue;
      }

      const opening = parseAmount(account.opening_balance);
      const amount = Number((opening + applyDelta(nature, debit, credit)).toFixed(2));
      if (amount === 0) continue;

      const rowBase = {
        accountId: account.id,
        code: account.code,
        name: account.name,
        nameEn: account.name_en,
        nature,
        debit: Number(debit.toFixed(2)),
        credit: Number(credit.toFixed(2)),
        opening: Number(opening.toFixed(2)),
        amount,
      };

      if (nature === 'asset') {
        totalAssets += amount;
        assetRows.push(rowBase);
      } else if (nature === 'liability') {
        totalLiabilities += amount;
        liabilityRows.push(rowBase);
      } else {
        totalEquity += amount;
        equityRows.push(rowBase);
      }
    }

    const netProfit = Number((periodIncome - periodExpense).toFixed(2));
    if (netProfit !== 0) {
      equityRows.push({
        accountId: 0,
        code: 'PL',
        name: 'Current Period Profit/(Loss)',
        nameEn: 'Current Period Profit/(Loss)',
        nature: 'equity',
        debit: 0,
        credit: 0,
        opening: 0,
        amount: netProfit,
        synthetic: true,
      });
      totalEquity += netProfit;
    }

    totalAssets = Number(totalAssets.toFixed(2));
    totalLiabilities = Number(totalLiabilities.toFixed(2));
    totalEquity = Number(totalEquity.toFixed(2));
    const totalLiabilitiesAndEquity = Number((totalLiabilities + totalEquity).toFixed(2));
    const balanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) <= 0.05;

    return res.json({
      success: true,
      data: {
        asOf: asOf || null,
        from: from || null,
        assetRows,
        liabilityRows,
        equityRows,
        totalAssets,
        totalLiabilities,
        totalEquity,
        totalLiabilitiesAndEquity,
        netProfit,
        balanced,
        draftCount: 0,
        source: 'tally_import',
      },
    });
  } catch (error: any) {
    console.error('재무상태표 조회 오류:', error);
    return res.status(500).json({ success: false, message: '재무상태표 조회에 실패했습니다.' });
  }
};

export const validateGlVoucherLines = async (req: RequestWithUser, res: Response) => {
  try {
    const lines = Array.isArray(req.body?.lines) ? req.body.lines : [];
    const totals = assertBalanced(lines);
    return res.json({ success: true, data: totals });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
