import { Op, Transaction } from 'sequelize';
import { Project, ProjectMember, User } from '../models';
import type { ProjectMemberRole } from '../models/ProjectMember';
import sequelize from '../config/database';

export const PROJECT_MEMBER_ROLES: ProjectMemberRole[] = ['owner', 'manager', 'member', 'viewer'];

export const PROJECT_STATUS = ['planning', 'in_progress', 'on_hold', 'completed', 'cancelled'] as const;
export const PROJECT_PRIORITY = ['low', 'medium', 'high', 'urgent'] as const;

type AuthUser = {
  id: number;
  role?: string;
  tenant_id?: number;
  company_id?: number;
};

export function isSystemProjectAdmin(user?: AuthUser | null): boolean {
  const role = String(user?.role || '');
  return role === 'root' || role === 'audit';
}

export function normalizeProjectStatus(value: unknown): string {
  const raw = String(value || 'planning').trim().toLowerCase();
  if (raw === 'normal') return 'medium';
  return (PROJECT_STATUS as readonly string[]).includes(raw) ? raw : 'planning';
}

export function normalizeProjectPriority(value: unknown): string {
  const raw = String(value || 'medium').trim().toLowerCase();
  if (raw === 'normal') return 'medium';
  return (PROJECT_PRIORITY as readonly string[]).includes(raw) ? raw : 'medium';
}

export function normalizeMemberRole(value: unknown): ProjectMemberRole {
  const raw = String(value || 'member').trim().toLowerCase();
  if (raw === 'owner' || raw === 'manager' || raw === 'member' || raw === 'viewer') return raw;
  return 'member';
}

/** PROJ-000001 형식 — tenant+company 범위에서 다음 번호 */
export async function generateProjectCode(
  tenantId: number,
  companyId: number,
  transaction?: Transaction
): Promise<string> {
  // 트랜잭션 단위 회사별 채번 잠금 (빈 테이블에서도 동시 생성 충돌 방지)
  const lockKey = (Math.abs(tenantId * 1_000_003 + companyId) % 2147483647) || 1;
  await sequelize.query(`SELECT pg_advisory_xact_lock(:lockKey)`, {
    replacements: { lockKey },
    transaction,
  });

  const [rows] = await sequelize.query(
    `
    SELECT COALESCE(
      MAX(CAST(SUBSTRING(project_code FROM 6) AS INTEGER)),
      0
    ) AS max_num
    FROM projects
    WHERE tenant_id = :tenantId
      AND company_id = :companyId
      AND project_code ~ '^PROJ-[0-9]+$'
    `,
    {
      replacements: { tenantId, companyId },
      transaction,
    }
  );
  const maxNum = Array.isArray(rows) && rows[0] ? Number((rows[0] as any).max_num || 0) : 0;
  const next = Number.isFinite(maxNum) ? maxNum + 1 : 1;
  return `PROJ-${String(next).padStart(6, '0')}`;
}

export async function findActiveMembership(projectId: number, userId: number) {
  return (ProjectMember as any).findOne({
    where: {
      project_id: projectId,
      user_id: userId,
      is_active: true,
      status: 'active',
    },
  });
}

export async function userCanAccessProject(
  project: { id: number; tenant_id: number; company_id: number },
  user: AuthUser
): Promise<{ ok: boolean; membership: any | null; asAdmin: boolean }> {
  if (isSystemProjectAdmin(user)) {
    return { ok: true, membership: null, asAdmin: true };
  }
  const membership = await findActiveMembership(project.id, user.id);
  return { ok: Boolean(membership), membership, asAdmin: false };
}

export function canManageMembers(role: string | undefined, asAdmin: boolean): boolean {
  if (asAdmin) return true;
  return role === 'owner' || role === 'manager';
}

export function canEditProject(role: string | undefined, asAdmin: boolean): boolean {
  if (asAdmin) return true;
  return role === 'owner' || role === 'manager';
}

export async function listAccessibleProjectIds(user: AuthUser): Promise<number[] | 'all'> {
  if (isSystemProjectAdmin(user)) return 'all';
  const rows = await (ProjectMember as any).findAll({
    attributes: ['project_id'],
    where: {
      user_id: user.id,
      is_active: true,
      status: 'active',
      ...(user.tenant_id != null ? { tenant_id: user.tenant_id } : {}),
      ...(user.company_id != null ? { company_id: user.company_id } : {}),
    },
  });
  return rows.map((r: any) => Number(r.project_id)).filter((id: number) => id > 0);
}

export async function ensureProjectMember(
  params: {
    tenant_id: number;
    company_id: number;
    project_id: number;
    user_id: number;
    role: ProjectMemberRole;
    invited_by: number;
  },
  transaction?: Transaction
) {
  const existing = await (ProjectMember as any).findOne({
    where: {
      project_id: params.project_id,
      user_id: params.user_id,
    },
    paranoid: false,
    transaction,
  });

  if (existing) {
    if (existing.deleted_at) {
      await existing.restore({ transaction });
    }
    const nextRole =
      params.role === 'owner' || existing.role === 'owner' ? 'owner' : params.role;
    await existing.update(
      {
        role: nextRole,
        status: 'active',
        is_active: true,
        invited_by: params.invited_by,
        invited_at: existing.invited_at || new Date(),
        joined_at: existing.joined_at || new Date(),
      },
      { transaction }
    );
    return existing;
  }

  return (ProjectMember as any).create(
    {
      tenant_id: params.tenant_id,
      company_id: params.company_id,
      project_id: params.project_id,
      user_id: params.user_id,
      role: params.role,
      status: 'active',
      invited_by: params.invited_by,
      invited_at: new Date(),
      joined_at: new Date(),
      is_active: true,
    },
    { transaction }
  );
}

export async function getProjectWithAccessOrThrow(
  projectId: number,
  user: AuthUser
): Promise<{ project: any; membership: any | null; asAdmin: boolean }> {
  const where: any = { id: projectId, is_active: true };
  if (!isSystemProjectAdmin(user)) {
    if (user.tenant_id != null) where.tenant_id = user.tenant_id;
    if (user.company_id != null) where.company_id = user.company_id;
  } else if (user.role === 'audit' && user.tenant_id != null) {
    where.tenant_id = user.tenant_id;
  }

  const project = await (Project as any).findOne({
    where,
    include: [
      {
        model: User,
        as: 'manager',
        attributes: ['id', 'username', 'email', 'department', 'position', 'phone'],
      },
    ],
  });

  if (!project) {
    const err: any = new Error('프로젝트를 찾을 수 없습니다.');
    err.status = 404;
    throw err;
  }

  const access = await userCanAccessProject(project, user);
  if (!access.ok) {
    const err: any = new Error('이 프로젝트에 접근할 권한이 없습니다.');
    err.status = 403;
    throw err;
  }

  return { project, membership: access.membership, asAdmin: access.asAdmin };
}

export { Op };
