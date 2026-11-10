import { Response } from 'express';
import { Op } from 'sequelize';
import { AuthRequest } from '../types';
import { Position, User } from '../models';
import sequelize from '../config/database';

/** 회사별 기본 직책 (상위 → 하위). 목록이 비어 있을 때만 시드 */
const DEFAULT_POSITIONS: Array<{ name: string; sort_order: number }> = [
  { name: '대표이사', sort_order: 1 },
  { name: '부대표', sort_order: 2 },
  { name: '전무', sort_order: 3 },
  { name: '상무', sort_order: 4 },
  { name: '이사', sort_order: 5 },
  { name: '부장', sort_order: 6 },
  { name: '차장', sort_order: 7 },
  { name: '과장', sort_order: 8 },
  { name: '대리', sort_order: 9 },
  { name: '주임', sort_order: 10 },
  { name: '사원', sort_order: 11 },
];

async function ensureDefaultPositions(tenantId: number, companyId: number): Promise<void> {
  const existing = await Position.findAll({
    where: { tenant_id: tenantId, company_id: companyId },
  });
  const existingNames = new Set(existing.map((r) => r.name));
  const missing = DEFAULT_POSITIONS.filter((p) => !existingNames.has(p.name));
  const onlyDefaults =
    existing.length > 0 &&
    existing.every((r) => DEFAULT_POSITIONS.some((d) => d.name === r.name));

  if (existing.length === 0) {
    try {
      await Position.bulkCreate(
        DEFAULT_POSITIONS.map((p) => ({
          tenant_id: tenantId,
          company_id: companyId,
          name: p.name,
          sort_order: p.sort_order,
          is_active: true,
        })),
        { ignoreDuplicates: true }
      );
    } catch (e) {
      const msg = String((e as any)?.message || e);
      if (!/unique|duplicate|already exists/i.test(msg)) throw e;
    }
    return;
  }

  // 기본 직책만 있는 회사: 빠진 항목 보완 + 순서 재정렬
  if (!onlyDefaults || missing.length === 0) return;

  try {
    await Position.bulkCreate(
      missing.map((p) => ({
        tenant_id: tenantId,
        company_id: companyId,
        name: p.name,
        sort_order: p.sort_order,
        is_active: true,
      })),
      { ignoreDuplicates: true }
    );
    await Promise.all(
      DEFAULT_POSITIONS.map((p) =>
        Position.update(
          { sort_order: p.sort_order },
          { where: { tenant_id: tenantId, company_id: companyId, name: p.name } }
        )
      )
    );
  } catch (e) {
    const msg = String((e as any)?.message || e);
    if (!/unique|duplicate|already exists/i.test(msg)) throw e;
  }
}

/** 구 DB에 positions 테이블/컬럼이 없을 때 런타임 보정 */
async function ensurePositionSchema(): Promise<void> {
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "positions" (
        "id" SERIAL PRIMARY KEY,
        "tenant_id" INTEGER NOT NULL REFERENCES "tenants"("id") ON UPDATE CASCADE ON DELETE CASCADE,
        "company_id" INTEGER NOT NULL REFERENCES "companies"("id") ON UPDATE CASCADE ON DELETE CASCADE,
        "name" VARCHAR(200) NOT NULL,
        "code" VARCHAR(50),
        "sort_order" INTEGER NOT NULL DEFAULT 0,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 기존 테이블에 누락 컬럼 보정 (CREATE IF NOT EXISTS는 컬럼을 추가하지 않음)
    await sequelize.query(`
      ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "code" VARCHAR(50);
    `);
    await sequelize.query(`
      ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
    `);
    await sequelize.query(`
      ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
    `);
    await sequelize.query(`
      ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
    `);
    await sequelize.query(`
      ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
    `);

    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "positions_tenant_company_name_unique"
      ON "positions" ("tenant_id", "company_id", "name");
    `);

    const [userCols] = await sequelize.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'position_id'
    `);
    if (!(userCols as any[]).length) {
      await sequelize.query(`
        ALTER TABLE "users"
        ADD COLUMN "position_id" INTEGER REFERENCES "positions"("id")
        ON UPDATE CASCADE ON DELETE SET NULL;
      `);
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS "users_position_id_idx" ON "users" ("position_id");
      `);
    }
  } catch (e) {
    console.warn('[position] ensurePositionSchema:', e);
  }
}

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

/** 사용자 저장 시 position_id → 직책명 반영 */
export async function resolvePositionFieldsForUser(
  tenantId: number,
  positionId: unknown,
  companyId?: number | null
): Promise<
  | { kind: 'skip' }
  | { kind: 'ok'; position_id: number | null; position: string | null }
  | { kind: 'err'; message: string }
> {
  if (positionId === undefined) return { kind: 'skip' };
  if (positionId === null || positionId === '') {
    return { kind: 'ok', position_id: null, position: null };
  }
  const id = typeof positionId === 'number' ? positionId : parseInt(String(positionId), 10);
  if (!Number.isFinite(id)) {
    return { kind: 'err', message: '직책 ID가 올바르지 않습니다.' };
  }
  await ensurePositionSchema();
  const where: Record<string, unknown> = { id, tenant_id: tenantId, is_active: true };
  if (companyId != null && Number.isFinite(Number(companyId))) {
    where.company_id = Number(companyId);
  }
  const row = await Position.findOne({ where });
  if (!row) {
    return { kind: 'err', message: '선택한 직책을 찾을 수 없습니다.' };
  }
  return { kind: 'ok', position_id: row.id, position: row.name };
}

function normalizeMasterName(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** Excel·레거시 문자열 직책명 → position_id 매칭 (회사 스코프) */
export async function resolvePositionFieldsByName(
  tenantId: number,
  positionName: unknown,
  companyId?: number | null
): Promise<
  | { kind: 'skip' }
  | { kind: 'ok'; position_id: number | null; position: string | null }
  | { kind: 'text_only'; position: string | null }
> {
  if (positionName === undefined) return { kind: 'skip' };
  const raw = String(positionName ?? '').trim();
  if (!raw) {
    return { kind: 'ok', position_id: null, position: null };
  }

  await ensurePositionSchema();
  const where: Record<string, unknown> = { tenant_id: tenantId, is_active: true };
  if (companyId != null && Number.isFinite(Number(companyId))) {
    where.company_id = Number(companyId);
  }

  const rows = await Position.findAll({ where });
  const target = normalizeMasterName(raw);
  const matched = rows.find((row) => normalizeMasterName(row.name) === target);
  if (matched) {
    return { kind: 'ok', position_id: matched.id, position: matched.name };
  }
  return { kind: 'text_only', position: raw };
}

export async function listPositions(req: AuthRequest, res: Response) {
  try {
    await ensurePositionSchema();
    const tenantId = req.user!.tenant_id;
    const companyId = resolveCompanyId(req, 'query');
    if (companyId == null) {
      return res.status(400).json({ success: false, message: '회사를 선택해주세요.' });
    }

    await ensureDefaultPositions(tenantId, companyId);

    const includeInactive =
      req.query.include_inactive === '1' || String(req.query.include_inactive).toLowerCase() === 'true';
    const where: Record<string, unknown> = { tenant_id: tenantId, company_id: companyId };
    if (!includeInactive) {
      where.is_active = true;
    }
    const rows = await Position.findAll({
      where,
      order: [
        ['sort_order', 'ASC'],
        ['name', 'ASC'],
      ],
    });
    res.json({ success: true, data: rows.map((r) => r.toJSON()) });
  } catch (e: any) {
    console.error('listPositions', e);
    res.status(500).json({ success: false, message: '직책 목록을 불러오지 못했습니다.' });
  }
}

export async function createPosition(req: AuthRequest, res: Response) {
  try {
    await ensurePositionSchema();
    const tenantId = req.user!.tenant_id;
    const companyId = resolveCompanyId(req, 'body');
    if (companyId == null) {
      return res.status(400).json({ success: false, message: '회사를 선택해주세요.' });
    }

    const name = String(req.body?.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: '직책명을 입력해주세요.' });
    }
    const code = req.body?.code != null ? String(req.body.code).trim() || null : null;
    const sort_order =
      req.body?.sort_order !== undefined && req.body?.sort_order !== ''
        ? parseInt(String(req.body.sort_order), 10)
        : 0;

    const dup = await Position.findOne({ where: { tenant_id: tenantId, company_id: companyId, name } });
    if (dup) {
      return res.status(409).json({ success: false, message: '같은 이름의 직책이 이미 있습니다.' });
    }

    const row = await Position.create({
      tenant_id: tenantId,
      company_id: companyId,
      name,
      code,
      sort_order: Number.isFinite(sort_order) ? sort_order : 0,
      is_active: req.body?.is_active !== false,
    });
    res.status(201).json({ success: true, data: row.toJSON() });
  } catch (e: any) {
    console.error('createPosition', e);
    res.status(500).json({ success: false, message: '직책을 추가하지 못했습니다.' });
  }
}

export async function updatePosition(req: AuthRequest, res: Response) {
  try {
    await ensurePositionSchema();
    const tenantId = req.user!.tenant_id;
    const companyId = resolveCompanyId(req, 'either');
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: '잘못된 요청입니다.' });
    }

    const where: Record<string, unknown> = { id, tenant_id: tenantId };
    if (companyId != null) where.company_id = companyId;

    const row = await Position.findOne({ where });
    if (!row) {
      return res.status(404).json({ success: false, message: '직책을 찾을 수 없습니다.' });
    }

    const name = req.body?.name !== undefined ? String(req.body.name).trim() : row.name;
    if (!name) {
      return res.status(400).json({ success: false, message: '직책명을 입력해주세요.' });
    }
    if (name !== row.name) {
      const dup = await Position.findOne({
        where: {
          tenant_id: tenantId,
          company_id: row.company_id,
          name,
          id: { [Op.ne]: id },
        },
      });
      if (dup) {
        return res.status(409).json({ success: false, message: '같은 이름의 직책이 이미 있습니다.' });
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
      { position: row.name },
      { where: { position_id: id, tenant_id: tenantId, company_id: row.company_id } }
    );

    const fresh = await Position.findByPk(id);
    res.json({ success: true, data: fresh?.toJSON() });
  } catch (e: any) {
    console.error('updatePosition', e);
    res.status(500).json({ success: false, message: '직책을 수정하지 못했습니다.' });
  }
}

export async function deletePosition(req: AuthRequest, res: Response) {
  try {
    await ensurePositionSchema();
    const tenantId = req.user!.tenant_id;
    const companyId = resolveCompanyId(req, 'query');
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: '잘못된 요청입니다.' });
    }

    const where: Record<string, unknown> = { id, tenant_id: tenantId };
    if (companyId != null) where.company_id = companyId;

    const row = await Position.findOne({ where });
    if (!row) {
      return res.status(404).json({ success: false, message: '직책을 찾을 수 없습니다.' });
    }

    const cnt = await User.count({
      where: { position_id: id, tenant_id: tenantId, company_id: row.company_id },
    });
    if (cnt > 0) {
      return res.status(400).json({
        success: false,
        message: `이 직책에 배정된 사용자가 ${cnt}명 있어 삭제할 수 없습니다.`,
      });
    }

    await row.destroy();
    res.json({ success: true, message: '삭제되었습니다.' });
  } catch (e: any) {
    console.error('deletePosition', e);
    res.status(500).json({ success: false, message: '직책을 삭제하지 못했습니다.' });
  }
}
