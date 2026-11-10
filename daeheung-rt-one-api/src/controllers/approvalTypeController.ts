import { Response } from 'express';
import { RequestWithUser } from '../types';
import ApprovalType, { DEFAULT_APPROVAL_TYPES, RETIRED_DEFAULT_APPROVAL_CODES } from '../models/ApprovalType';

function resolveScope(req: RequestWithUser) {
  const tenantId = req.user?.tenant_id;
  const companyId = req.user?.company_id;
  const userRole = req.user?.role;
  const queryCompanyId = req.query.company_id
    ? parseInt(String(req.query.company_id), 10)
    : undefined;
  const bodyCompanyId = (req.body as any)?.company_id
    ? parseInt(String((req.body as any).company_id), 10)
    : undefined;

  let effectiveCompanyId = companyId;
  if ((userRole === 'root' || userRole === 'audit') && (queryCompanyId || bodyCompanyId)) {
    effectiveCompanyId = queryCompanyId || bodyCompanyId;
  }

  return { tenantId, companyId: effectiveCompanyId, userRole };
}

async function ensureDefaultTypes(tenantId: number, companyId: number) {
  const existing = await ApprovalType.findAll({
    where: { tenant_id: tenantId, company_id: companyId },
  });
  const byCode = new Map(existing.map((r) => [r.code, r]));

  // 구 기본 유형(휴가신청)은 기본에서 제외·비활성
  for (const retired of RETIRED_DEFAULT_APPROVAL_CODES) {
    const row = byCode.get(retired);
    if (!row) continue;
    if (row.is_active || row.is_system) {
      await row.update({ is_active: false, is_system: false });
    }
  }

  for (const def of DEFAULT_APPROVAL_TYPES) {
    const row = byCode.get(def.code);
    if (!row) {
      await ApprovalType.create({
        tenant_id: tenantId,
        company_id: companyId,
        code: def.code,
        name: def.name,
        sort_order: def.sort_order,
        is_system: true,
        is_active: true,
      });
      continue;
    }
    // 기본 유형은 활성·시스템 플래그·정렬 유지 (이름은 사용자가 바꾼 경우 유지)
    const patch: any = {};
    if (!row.is_active) patch.is_active = true;
    if (!row.is_system) patch.is_system = true;
    if (row.sort_order !== def.sort_order) patch.sort_order = def.sort_order;
    if (Object.keys(patch).length > 0) await row.update(patch);
  }
}

function slugifyCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

export const getApprovalTypes = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId, userRole } = resolveScope(req);
    if (!tenantId || !companyId) {
      return res.status(400).json({ success: false, message: '테넌트/회사 정보가 필요합니다.' });
    }
    if (userRole !== 'root' && userRole !== 'audit' && req.user?.company_id !== companyId) {
      return res.status(403).json({ success: false, message: '권한이 없습니다.' });
    }

    await ensureDefaultTypes(tenantId, companyId);

    const includeInactive = String(req.query.include_inactive || '') === '1';
    const where: any = { tenant_id: tenantId, company_id: companyId };
    if (!includeInactive) where.is_active = true;

    const rows = await ApprovalType.findAll({
      where,
      order: [
        ['sort_order', 'ASC'],
        ['id', 'ASC'],
      ],
    });
    return res.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('결재 유형 목록 오류:', error);
    return res.status(500).json({
      success: false,
      message: '결재 유형 목록을 불러오지 못했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const createApprovalType = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = resolveScope(req);
    if (!tenantId || !companyId) {
      return res.status(400).json({ success: false, message: '테넌트/회사 정보가 필요합니다.' });
    }

    const name = String(req.body?.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: '유형명을 입력하세요.' });
    }

    let code = slugifyCode(req.body?.code || name);
    if (!code) code = `type_${Date.now()}`;

    const dup = await ApprovalType.findOne({
      where: { tenant_id: tenantId, company_id: companyId, code },
    });
    if (dup) {
      if (!dup.is_active) {
        await dup.update({ is_active: true, name, sort_order: Number(req.body?.sort_order) || dup.sort_order });
        return res.status(201).json({ success: true, data: dup });
      }
      return res.status(409).json({ success: false, message: '이미 존재하는 유형 코드입니다.' });
    }

    const maxOrder = (await ApprovalType.max('sort_order', {
      where: { tenant_id: tenantId, company_id: companyId, is_active: true },
    })) as number | null;

    const row = await ApprovalType.create({
      tenant_id: tenantId,
      company_id: companyId,
      code,
      name,
      sort_order: Number.isFinite(Number(req.body?.sort_order))
        ? Number(req.body.sort_order)
        : (maxOrder ?? -1) + 1,
      is_system: false,
      is_active: true,
    });
    return res.status(201).json({ success: true, data: row });
  } catch (error: any) {
    console.error('결재 유형 생성 오류:', error);
    return res.status(500).json({
      success: false,
      message: '결재 유형 생성에 실패했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const updateApprovalType = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = resolveScope(req);
    const id = parseInt(String(req.params.id), 10);
    const row = await ApprovalType.findOne({
      where: { id, tenant_id: tenantId, company_id: companyId, is_active: true },
    });
    if (!row) {
      return res.status(404).json({ success: false, message: '유형을 찾을 수 없습니다.' });
    }

    const patch: any = {};
    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ success: false, message: '유형명을 입력하세요.' });
      patch.name = name;
    }
    if (req.body?.sort_order !== undefined && Number.isFinite(Number(req.body.sort_order))) {
      patch.sort_order = Number(req.body.sort_order);
    }
    // code는 시스템/기존 문서 참조를 위해 변경 불가
    await row.update(patch);
    return res.json({ success: true, data: row });
  } catch (error: any) {
    console.error('결재 유형 수정 오류:', error);
    return res.status(500).json({
      success: false,
      message: '결재 유형 수정에 실패했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const deleteApprovalType = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = resolveScope(req);
    const id = parseInt(String(req.params.id), 10);
    const row = await ApprovalType.findOne({
      where: { id, tenant_id: tenantId, company_id: companyId, is_active: true },
    });
    if (!row) {
      return res.status(404).json({ success: false, message: '유형을 찾을 수 없습니다.' });
    }
    if (row.is_system) {
      return res.status(400).json({ success: false, message: '기본 유형은 삭제할 수 없습니다. 이름만 수정하세요.' });
    }

    await row.update({ is_active: false });
    return res.json({ success: true, message: '유형이 비활성화되었습니다.' });
  } catch (error: any) {
    console.error('결재 유형 삭제 오류:', error);
    return res.status(500).json({
      success: false,
      message: '결재 유형 삭제에 실패했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
