import { Response } from 'express';
import { Op } from 'sequelize';
import { RequestWithUser } from '../types';
import { WorkAssignee, WorkAssigneeItem } from '../models';
import sequelize from '../config/database';
import { resolveAssignedClientScope } from '../services/workAssigneeScope';

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

  return { tenantId, companyId: effectiveCompanyId, userRole, userId: req.user?.id };
}

async function findAssigneeInScope(id: number, tenantId?: number, companyId?: number) {
  const where: any = { id, is_active: true };
  if (tenantId != null) where.tenant_id = tenantId;
  if (companyId != null) where.company_id = companyId;
  return WorkAssignee.findOne({ where });
}

async function renumberAssignees(tenantId: number, companyId: number) {
  const rows = await WorkAssignee.findAll({
    where: { tenant_id: tenantId, company_id: companyId, is_active: true },
    order: [
      ['sort_order', 'ASC'],
      ['id', 'ASC'],
    ],
  });
  await Promise.all(rows.map((row, index) => row.update({ sort_order: index })));
}

async function renumberItems(assigneeId: number) {
  const rows = await WorkAssigneeItem.findAll({
    where: { assignee_id: assigneeId, is_active: true },
    order: [
      ['sort_order', 'ASC'],
      ['id', 'ASC'],
    ],
  });
  await Promise.all(rows.map((row, index) => row.update({ sort_order: index })));
}

/** 동일 회사(테넌트) 내 담당 고객사명 중복 여부 (대소문자/공백 무시) */
async function findDuplicateClientAssignment(params: {
  tenantId?: number;
  companyId?: number;
  name: string;
  excludeItemId?: number;
}) {
  const { tenantId, companyId, name, excludeItemId } = params;
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;

  const assigneeWhere: any = { is_active: true };
  if (tenantId != null) assigneeWhere.tenant_id = tenantId;
  if (companyId != null) assigneeWhere.company_id = companyId;

  const assignees = await WorkAssignee.findAll({
    where: assigneeWhere,
    attributes: ['id', 'name'],
  });
  if (assignees.length === 0) return null;

  const assigneeIds = assignees.map((a) => a.id);
  const items = await WorkAssigneeItem.findAll({
    where: {
      assignee_id: { [Op.in]: assigneeIds },
      is_active: true,
      ...(excludeItemId != null ? { id: { [Op.ne]: excludeItemId } } : {}),
    },
    attributes: ['id', 'name', 'assignee_id'],
  });

  const hit = items.find((item) => String(item.name || '').trim().toLowerCase() === normalized);
  if (!hit) return null;
  const owner = assignees.find((a) => a.id === hit.assignee_id);
  return { item: hit, assigneeName: owner?.name || '' };
}

/** 담당자 + 담당 회사 전체 조회 */
export const getWorkAssigneeList = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId, userRole } = resolveScope(req);
    if (!tenantId && userRole !== 'root') {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }

    const where: any = { is_active: true };
    if (tenantId != null && userRole !== 'root') where.tenant_id = tenantId;
    if (companyId != null) where.company_id = companyId;
    if (userRole === 'root' && tenantId != null) where.tenant_id = tenantId;

    const assignees = await WorkAssignee.findAll({
      where,
      include: [
        {
          model: WorkAssigneeItem,
          as: 'items',
          required: false,
          separate: true,
          where: { is_active: true },
          order: [
            ['sort_order', 'ASC'],
            ['id', 'ASC'],
          ],
        },
      ],
      order: [
        ['sort_order', 'ASC'],
        ['id', 'ASC'],
      ],
    });

    return res.json({ success: true, data: assignees });
  } catch (error: any) {
    console.error('업무 담당 리스트 조회 오류:', error);
    return res.status(500).json({
      success: false,
      message: '업무 담당 리스트 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/** 담당자 추가 */
export const createWorkAssignee = async (req: RequestWithUser, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const { tenantId, companyId, userId } = resolveScope(req);
    if (!tenantId || !companyId) {
      await t.rollback();
      return res.status(400).json({ success: false, message: '테넌트/회사 정보가 필요합니다.' });
    }

    const name = String(req.body?.name || '').trim();
    if (!name) {
      await t.rollback();
      return res.status(400).json({ success: false, message: '담당자 이름을 입력하세요.' });
    }

    const maxOrder = (await WorkAssignee.max('sort_order', {
      where: { tenant_id: tenantId, company_id: companyId, is_active: true },
      transaction: t,
    })) as number | null;

    const linkedUserId = Number(req.body?.user_id);
    const assignee = await WorkAssignee.create(
      {
        tenant_id: tenantId,
        company_id: companyId,
        user_id: Number.isFinite(linkedUserId) && linkedUserId > 0 ? linkedUserId : null,
        name,
        title: req.body?.title != null ? String(req.body.title).trim() || null : null,
        email: req.body?.email != null ? String(req.body.email).trim() || null : null,
        sort_order: (maxOrder ?? -1) + 1,
        is_active: true,
        created_by: userId ?? null,
      },
      { transaction: t }
    );

    await t.commit();
    return res.status(201).json({ success: true, data: { ...assignee.toJSON(), items: [] } });
  } catch (error: any) {
    await t.rollback();
    console.error('담당자 추가 오류:', error);
    return res.status(500).json({
      success: false,
      message: '담당자 추가 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/** 담당자 수정 */
export const updateWorkAssignee = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = resolveScope(req);
    const id = parseInt(String(req.params.id), 10);
    const assignee = await findAssigneeInScope(id, tenantId, companyId);
    if (!assignee) {
      return res.status(404).json({ success: false, message: '담당자를 찾을 수 없습니다.' });
    }

    const patch: any = {};
    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) {
        return res.status(400).json({ success: false, message: '담당자 이름을 입력하세요.' });
      }
      patch.name = name;
    }
    if (req.body?.title !== undefined) {
      patch.title = String(req.body.title).trim() || null;
    }
    if (req.body?.email !== undefined) {
      patch.email = String(req.body.email).trim() || null;
    }
    if (req.body?.user_id !== undefined) {
      const linkedUserId = Number(req.body.user_id);
      patch.user_id = Number.isFinite(linkedUserId) && linkedUserId > 0 ? linkedUserId : null;
    }

    await assignee.update(patch);
    return res.json({ success: true, data: assignee });
  } catch (error: any) {
    console.error('담당자 수정 오류:', error);
    return res.status(500).json({
      success: false,
      message: '담당자 수정 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/** 담당자 삭제 (소프트 + 항목 삭제) */
export const deleteWorkAssignee = async (req: RequestWithUser, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const { tenantId, companyId } = resolveScope(req);
    const id = parseInt(String(req.params.id), 10);
    const assignee = await findAssigneeInScope(id, tenantId, companyId);
    if (!assignee) {
      await t.rollback();
      return res.status(404).json({ success: false, message: '담당자를 찾을 수 없습니다.' });
    }

    await WorkAssigneeItem.update(
      { is_active: false },
      { where: { assignee_id: id, is_active: true }, transaction: t }
    );
    await assignee.update({ is_active: false }, { transaction: t });
    await t.commit();
    await renumberAssignees(assignee.tenant_id, assignee.company_id);
    return res.json({ success: true, message: '담당자가 삭제되었습니다.' });
  } catch (error: any) {
    await t.rollback();
    console.error('담당자 삭제 오류:', error);
    return res.status(500).json({
      success: false,
      message: '담당자 삭제 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/** 담당자 컬럼 순서 변경 */
export const moveWorkAssignee = async (req: RequestWithUser, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const { tenantId, companyId } = resolveScope(req);
    if (!tenantId || !companyId) {
      await t.rollback();
      return res.status(400).json({ success: false, message: '테넌트/회사 정보가 필요합니다.' });
    }

    const id = parseInt(String(req.params.id), 10);
    const targetIndex = parseInt(String(req.body?.index), 10);
    if (Number.isNaN(targetIndex) || targetIndex < 0) {
      await t.rollback();
      return res.status(400).json({ success: false, message: '유효한 순서를 지정하세요.' });
    }

    const rows = await WorkAssignee.findAll({
      where: { tenant_id: tenantId, company_id: companyId, is_active: true },
      order: [
        ['sort_order', 'ASC'],
        ['id', 'ASC'],
      ],
      transaction: t,
    });

    const fromIndex = rows.findIndex((r) => r.id === id);
    if (fromIndex < 0) {
      await t.rollback();
      return res.status(404).json({ success: false, message: '담당자를 찾을 수 없습니다.' });
    }

    const [moved] = rows.splice(fromIndex, 1);
    const toIndex = Math.min(targetIndex, rows.length);
    rows.splice(toIndex, 0, moved);
    await Promise.all(rows.map((row, index) => row.update({ sort_order: index }, { transaction: t })));
    await t.commit();
    return res.json({ success: true, data: { id, index: toIndex } });
  } catch (error: any) {
    await t.rollback();
    console.error('담당자 이동 오류:', error);
    return res.status(500).json({
      success: false,
      message: '담당자 순서 변경 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/** 담당 회사(항목) 추가 */
export const createWorkAssigneeItem = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = resolveScope(req);
    const assigneeId = parseInt(String(req.params.assigneeId), 10);
    const assignee = await findAssigneeInScope(assigneeId, tenantId, companyId);
    if (!assignee) {
      return res.status(404).json({ success: false, message: '담당자를 찾을 수 없습니다.' });
    }

    const name = String(req.body?.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: '회사명을 입력하세요.' });
    }

    const duplicate = await findDuplicateClientAssignment({
      tenantId: assignee.tenant_id,
      companyId: assignee.company_id,
      name,
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: `이미 "${duplicate.assigneeName || '다른 담당자'}"에게 등록된 고객사입니다.`,
      });
    }

    const maxOrder = (await WorkAssigneeItem.max('sort_order', {
      where: { assignee_id: assigneeId, is_active: true },
    })) as number | null;

    const partnerIdRaw = Number(req.body?.partner_id);
    const item = await WorkAssigneeItem.create({
      assignee_id: assigneeId,
      partner_id: Number.isFinite(partnerIdRaw) && partnerIdRaw > 0 ? partnerIdRaw : null,
      name,
      note: req.body?.note != null ? String(req.body.note).trim() || null : null,
      is_highlighted: Boolean(req.body?.is_highlighted),
      sort_order: (maxOrder ?? -1) + 1,
      is_active: true,
    });

    return res.status(201).json({ success: true, data: item });
  } catch (error: any) {
    console.error('담당 회사 추가 오류:', error);
    return res.status(500).json({
      success: false,
      message: '담당 회사 추가 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/** 담당 회사 수정 */
export const updateWorkAssigneeItem = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = resolveScope(req);
    const id = parseInt(String(req.params.id), 10);
    const item = await WorkAssigneeItem.findByPk(id);
    if (!item || item.is_active === false) {
      return res.status(404).json({ success: false, message: '항목을 찾을 수 없습니다.' });
    }

    const assignee = await findAssigneeInScope(item.assignee_id, tenantId, companyId);
    if (!assignee) {
      return res.status(404).json({ success: false, message: '항목을 찾을 수 없습니다.' });
    }

    const patch: any = {};
    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) {
        return res.status(400).json({ success: false, message: '회사명을 입력하세요.' });
      }
      const duplicate = await findDuplicateClientAssignment({
        tenantId: assignee.tenant_id,
        companyId: assignee.company_id,
        name,
        excludeItemId: item.id,
      });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: `이미 "${duplicate.assigneeName || '다른 담당자'}"에게 등록된 고객사입니다.`,
        });
      }
      patch.name = name;
    }
    if (req.body?.partner_id !== undefined) {
      const partnerIdRaw = Number(req.body.partner_id);
      patch.partner_id = Number.isFinite(partnerIdRaw) && partnerIdRaw > 0 ? partnerIdRaw : null;
    }
    if (req.body?.note !== undefined) {
      patch.note = String(req.body.note).trim() || null;
    }
    if (req.body?.is_highlighted !== undefined) {
      patch.is_highlighted = Boolean(req.body.is_highlighted);
    }

    await item.update(patch);
    return res.json({ success: true, data: item });
  } catch (error: any) {
    console.error('담당 회사 수정 오류:', error);
    return res.status(500).json({
      success: false,
      message: '담당 회사 수정 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/** 담당 회사 삭제 */
export const deleteWorkAssigneeItem = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = resolveScope(req);
    const id = parseInt(String(req.params.id), 10);
    const item = await WorkAssigneeItem.findByPk(id);
    if (!item || item.is_active === false) {
      return res.status(404).json({ success: false, message: '항목을 찾을 수 없습니다.' });
    }

    const assignee = await findAssigneeInScope(item.assignee_id, tenantId, companyId);
    if (!assignee) {
      return res.status(404).json({ success: false, message: '항목을 찾을 수 없습니다.' });
    }

    const assigneeId = item.assignee_id;
    await item.update({ is_active: false });
    await renumberItems(assigneeId);
    return res.json({ success: true, message: '항목이 삭제되었습니다.' });
  } catch (error: any) {
    console.error('담당 회사 삭제 오류:', error);
    return res.status(500).json({
      success: false,
      message: '담당 회사 삭제 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * 담당 회사 이동
 * body: { assignee_id, index }
 */
export const moveWorkAssigneeItem = async (req: RequestWithUser, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const { tenantId, companyId } = resolveScope(req);
    const id = parseInt(String(req.params.id), 10);
    const targetAssigneeId = parseInt(String(req.body?.assignee_id), 10);
    const targetIndex = parseInt(String(req.body?.index), 10);

    if (Number.isNaN(targetAssigneeId) || Number.isNaN(targetIndex) || targetIndex < 0) {
      await t.rollback();
      return res.status(400).json({ success: false, message: '이동 대상이 올바르지 않습니다.' });
    }

    const item = await WorkAssigneeItem.findByPk(id, { transaction: t });
    if (!item || item.is_active === false) {
      await t.rollback();
      return res.status(404).json({ success: false, message: '항목을 찾을 수 없습니다.' });
    }

    const sourceAssignee = await findAssigneeInScope(item.assignee_id, tenantId, companyId);
    const targetAssignee = await findAssigneeInScope(targetAssigneeId, tenantId, companyId);
    if (!sourceAssignee || !targetAssignee) {
      await t.rollback();
      return res.status(404).json({ success: false, message: '담당자를 찾을 수 없습니다.' });
    }

    const sourceId = item.assignee_id;
    const sameColumn = sourceId === targetAssigneeId;

    if (sameColumn) {
      const rows = await WorkAssigneeItem.findAll({
        where: { assignee_id: sourceId, is_active: true },
        order: [
          ['sort_order', 'ASC'],
          ['id', 'ASC'],
        ],
        transaction: t,
      });
      const fromIndex = rows.findIndex((r) => r.id === id);
      if (fromIndex < 0) {
        await t.rollback();
        return res.status(404).json({ success: false, message: '항목을 찾을 수 없습니다.' });
      }
      const [moved] = rows.splice(fromIndex, 1);
      const toIndex = Math.min(targetIndex, rows.length);
      rows.splice(toIndex, 0, moved);
      await Promise.all(rows.map((row, index) => row.update({ sort_order: index }, { transaction: t })));
      await t.commit();
      return res.json({ success: true, data: { id, assignee_id: sourceId, index: toIndex } });
    }

    // 다른 담당자로 이동
    const sourceRows = await WorkAssigneeItem.findAll({
      where: { assignee_id: sourceId, is_active: true, id: { [Op.ne]: id } },
      order: [
        ['sort_order', 'ASC'],
        ['id', 'ASC'],
      ],
      transaction: t,
    });
    await Promise.all(
      sourceRows.map((row, index) => row.update({ sort_order: index }, { transaction: t }))
    );

    const targetRows = await WorkAssigneeItem.findAll({
      where: { assignee_id: targetAssigneeId, is_active: true },
      order: [
        ['sort_order', 'ASC'],
        ['id', 'ASC'],
      ],
      transaction: t,
    });
    const toIndex = Math.min(targetIndex, targetRows.length);
    targetRows.splice(toIndex, 0, item);
    await item.update({ assignee_id: targetAssigneeId, sort_order: toIndex }, { transaction: t });
    await Promise.all(
      targetRows.map((row, index) =>
        row.id === item.id
          ? Promise.resolve()
          : row.update({ sort_order: index }, { transaction: t })
      )
    );
    // 최종 정렬 보정
    await Promise.all(
      targetRows.map((row, index) => row.update({ sort_order: index, assignee_id: targetAssigneeId }, { transaction: t }))
    );

    await t.commit();
    return res.json({
      success: true,
      data: { id, assignee_id: targetAssigneeId, index: toIndex },
    });
  } catch (error: any) {
    await t.rollback();
    console.error('담당 회사 이동 오류:', error);
    return res.status(500).json({
      success: false,
      message: '담당 회사 이동 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/** 내 고객사 리스트 배정 범위 (매출/매입/지출 필터용) */
export const getMyAssignedClientScope = async (req: RequestWithUser, res: Response) => {
  try {
    const scope = await resolveAssignedClientScope(req.user);
    return res.json({
      success: true,
      data: {
        enforced: scope.enforced,
        partner_ids: scope.partnerIds,
        customer_ids: scope.customerIds,
        partner_names: scope.partnerNamesNormalized,
      },
    });
  } catch (error: any) {
    console.error('내 고객사 배정 범위 조회 오류:', error);
    return res.status(500).json({
      success: false,
      message: '고객사 배정 범위 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
