import { Response } from 'express';
import { Op } from 'sequelize';
import { AuthRequest } from '../types';
import { Department, User } from '../models';
import sequelize from '../config/database';

/** 구 DB에 departments 스키마가 불완전할 때 런타임 보정 (마이그레이션과 동일) */
async function ensureDepartmentColumns(): Promise<void> {
  try {
    await sequelize.query(`
      ALTER TABLE "departments"
      ADD COLUMN IF NOT EXISTS "code" VARCHAR(50);
    `);
    await sequelize.query(`
      ALTER TABLE "departments"
      ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
    `);
    await sequelize.query(`
      ALTER TABLE "departments"
      ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
    `);
    await sequelize.query(`
      ALTER TABLE "departments"
      ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
    `);
    await sequelize.query(`
      ALTER TABLE "departments"
      ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
    `);
    // company_id: 없으면 추가 후 백필(마이그레이션 전 런타임 방어)
    const [cols] = await sequelize.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'departments' AND column_name = 'company_id'
    `);
    if (!(cols as any[]).length) {
      await sequelize.query(`
        ALTER TABLE "departments"
        ADD COLUMN "company_id" INTEGER REFERENCES companies(id) ON UPDATE CASCADE ON DELETE CASCADE;
      `);
      await sequelize.query(`
        UPDATE departments d
        SET company_id = sub.cid
        FROM (
          SELECT t.id AS tid, MIN(c.id) AS cid
          FROM tenants t
          JOIN companies c ON c.tenant_id = t.id
          GROUP BY t.id
        ) sub
        WHERE d.tenant_id = sub.tid AND d.company_id IS NULL
      `);
      await sequelize.query(`DELETE FROM departments WHERE company_id IS NULL`);
      await sequelize.query(`
        ALTER TABLE "departments" ALTER COLUMN "company_id" SET NOT NULL;
      `);
    }
  } catch (e) {
    console.warn('[department] ensureDepartmentColumns:', e);
  }
}

/** root/audit는 query·body의 company_id, 그 외는 JWT company_id */
function resolveCompanyId(req: AuthRequest, source: 'query' | 'body' | 'either' = 'either'): number | null {
  const role = req.user?.role;
  const jwtCompanyId = req.user?.company_id != null ? Number(req.user.company_id) : NaN;

  if (role === 'root' || role === 'audit') {
    const raw =
      source === 'query'
        ? req.query.company_id
        : source === 'body'
          ? (req.body as any)?.company_id
          : (req.query.company_id ?? (req.body as any)?.company_id);
    if (raw === undefined || raw === null || String(raw).trim() === '') {
      return Number.isFinite(jwtCompanyId) ? jwtCompanyId : null;
    }
    const id = parseInt(String(raw), 10);
    return Number.isFinite(id) ? id : null;
  }

  return Number.isFinite(jwtCompanyId) ? jwtCompanyId : null;
}

/** 사용자 저장 시 department_id → 부서명 반영 (회사 일치 검증) */
export async function resolveDepartmentFieldsForUser(
  tenantId: number,
  departmentId: unknown,
  companyId?: number | null
): Promise<
  | { kind: 'skip' }
  | { kind: 'ok'; department_id: number | null; department: string | null }
  | { kind: 'err'; message: string }
> {
  if (departmentId === undefined) return { kind: 'skip' };
  if (departmentId === null || departmentId === '') {
    return { kind: 'ok', department_id: null, department: null };
  }
  const id = typeof departmentId === 'number' ? departmentId : parseInt(String(departmentId), 10);
  if (!Number.isFinite(id)) {
    return { kind: 'err', message: '부서 ID가 올바르지 않습니다.' };
  }
  await ensureDepartmentColumns();
  const where: Record<string, unknown> = { id, tenant_id: tenantId, is_active: true };
  if (companyId != null && Number.isFinite(Number(companyId))) {
    where.company_id = Number(companyId);
  }
  const dept = await Department.findOne({ where });
  if (!dept) {
    return { kind: 'err', message: '선택한 부서를 찾을 수 없습니다.' };
  }
  return { kind: 'ok', department_id: dept.id, department: dept.name };
}

function normalizeMasterName(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** Excel·레거시 문자열 부서명 → department_id 매칭 (회사 스코프) */
export async function resolveDepartmentFieldsByName(
  tenantId: number,
  departmentName: unknown,
  companyId?: number | null
): Promise<
  | { kind: 'skip' }
  | { kind: 'ok'; department_id: number | null; department: string | null }
  | { kind: 'text_only'; department: string | null }
> {
  if (departmentName === undefined) return { kind: 'skip' };
  const raw = String(departmentName ?? '').trim();
  if (!raw) {
    return { kind: 'ok', department_id: null, department: null };
  }

  await ensureDepartmentColumns();
  const where: Record<string, unknown> = { tenant_id: tenantId, is_active: true };
  if (companyId != null && Number.isFinite(Number(companyId))) {
    where.company_id = Number(companyId);
  }

  const rows = await Department.findAll({ where });
  const target = normalizeMasterName(raw);
  const matched = rows.find((row) => normalizeMasterName(row.name) === target);
  if (matched) {
    return { kind: 'ok', department_id: matched.id, department: matched.name };
  }
  return { kind: 'text_only', department: raw };
}

export async function listDepartments(req: AuthRequest, res: Response) {
  try {
    await ensureDepartmentColumns();
    const tenantId = req.user!.tenant_id;
    const companyId = resolveCompanyId(req, 'query');
    if (companyId == null) {
      return res.status(400).json({ success: false, message: '회사를 선택해주세요.' });
    }

    const includeInactive =
      req.query.include_inactive === '1' || String(req.query.include_inactive).toLowerCase() === 'true';
    const where: Record<string, unknown> = { tenant_id: tenantId, company_id: companyId };
    if (!includeInactive) {
      where.is_active = true;
    }
    const rows = await Department.findAll({
      where,
      order: [
        ['sort_order', 'ASC'],
        ['name', 'ASC'],
      ],
    });
    res.json({ success: true, data: rows.map((r) => r.toJSON()) });
  } catch (e: any) {
    console.error('listDepartments', e);
    res.status(500).json({ success: false, message: '부서 목록을 불러오지 못했습니다.' });
  }
}

export async function createDepartment(req: AuthRequest, res: Response) {
  try {
    await ensureDepartmentColumns();
    const tenantId = req.user!.tenant_id;
    const companyId = resolveCompanyId(req, 'body');
    if (companyId == null) {
      return res.status(400).json({ success: false, message: '회사를 선택해주세요.' });
    }

    const name = String(req.body?.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: '부서명을 입력해주세요.' });
    }
    const code = req.body?.code != null ? String(req.body.code).trim() || null : null;
    const sort_order =
      req.body?.sort_order !== undefined && req.body?.sort_order !== ''
        ? parseInt(String(req.body.sort_order), 10)
        : 0;

    const dup = await Department.findOne({ where: { tenant_id: tenantId, company_id: companyId, name } });
    if (dup) {
      return res.status(409).json({ success: false, message: '같은 이름의 부서가 이미 있습니다.' });
    }

    const row = await Department.create({
      tenant_id: tenantId,
      company_id: companyId,
      name,
      code,
      sort_order: Number.isFinite(sort_order) ? sort_order : 0,
      is_active: req.body?.is_active !== false,
    });
    res.status(201).json({ success: true, data: row.toJSON() });
  } catch (e: any) {
    console.error('createDepartment', e);
    res.status(500).json({ success: false, message: '부서를 추가하지 못했습니다.' });
  }
}

export async function updateDepartment(req: AuthRequest, res: Response) {
  try {
    await ensureDepartmentColumns();
    const tenantId = req.user!.tenant_id;
    const companyId = resolveCompanyId(req, 'either');
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: '잘못된 요청입니다.' });
    }

    const where: Record<string, unknown> = { id, tenant_id: tenantId };
    if (companyId != null) where.company_id = companyId;

    const row = await Department.findOne({ where });
    if (!row) {
      return res.status(404).json({ success: false, message: '부서를 찾을 수 없습니다.' });
    }

    const name = req.body?.name !== undefined ? String(req.body.name).trim() : row.name;
    if (!name) {
      return res.status(400).json({ success: false, message: '부서명을 입력해주세요.' });
    }
    if (name !== row.name) {
      const dup = await Department.findOne({
        where: {
          tenant_id: tenantId,
          company_id: row.company_id,
          name,
          id: { [Op.ne]: id },
        },
      });
      if (dup) {
        return res.status(409).json({ success: false, message: '같은 이름의 부서가 이미 있습니다.' });
      }
    }

    if (req.body?.name !== undefined) row.name = name;
    if (req.body?.code !== undefined) row.code = String(req.body.code).trim() || null;
    if (req.body?.sort_order !== undefined) {
      const s = parseInt(String(req.body.sort_order), 10);
      row.sort_order = Number.isFinite(s) ? s : 0;
    }
    if (req.body?.is_active !== undefined) row.is_active = Boolean(req.body.is_active);

    await row.save();

    await User.update(
      { department: row.name },
      { where: { department_id: id, tenant_id: tenantId, company_id: row.company_id } }
    );

    const fresh = await Department.findByPk(id);
    res.json({ success: true, data: fresh?.toJSON() });
  } catch (e: any) {
    console.error('updateDepartment', e);
    res.status(500).json({ success: false, message: '부서를 수정하지 못했습니다.' });
  }
}

export async function deleteDepartment(req: AuthRequest, res: Response) {
  try {
    await ensureDepartmentColumns();
    const tenantId = req.user!.tenant_id;
    const companyId = resolveCompanyId(req, 'query');
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: '잘못된 요청입니다.' });
    }

    const where: Record<string, unknown> = { id, tenant_id: tenantId };
    if (companyId != null) where.company_id = companyId;

    const row = await Department.findOne({ where });
    if (!row) {
      return res.status(404).json({ success: false, message: '부서를 찾을 수 없습니다.' });
    }

    const cnt = await User.count({
      where: { department_id: id, tenant_id: tenantId, company_id: row.company_id },
    });
    if (cnt > 0) {
      return res.status(400).json({
        success: false,
        message: `이 부서에 소속된 사용자가 ${cnt}명 있어 삭제할 수 없습니다.`,
      });
    }

    await row.destroy();
    res.json({ success: true, message: '삭제되었습니다.' });
  } catch (e: any) {
    console.error('deleteDepartment', e);
    res.status(500).json({ success: false, message: '부서를 삭제하지 못했습니다.' });
  }
}
