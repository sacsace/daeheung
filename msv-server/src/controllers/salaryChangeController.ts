import { Op } from 'sequelize';
import { User, SalaryChangeRequest } from '../models';

export function normalizeSalaryAmount(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

export function salariesEqual(left: unknown, right: unknown): boolean {
  return normalizeSalaryAmount(left) === normalizeSalaryAmount(right);
}

function displayName(user: { username?: string; userid?: string } | null | undefined): string {
  return String(user?.username || user?.userid || '').trim();
}

function mapChangeRow(row: any) {
  const json = row.toJSON ? row.toJSON() : row;
  return {
    id: json.id,
    user_id: json.user_id,
    employee_name: displayName(json.employee),
    previous_salary: normalizeSalaryAmount(json.previous_salary),
    requested_salary: normalizeSalaryAmount(json.requested_salary),
    status: json.status,
    requested_by: json.requested_by,
    requester_name: displayName(json.requester),
    approver_id: json.approver_id,
    approver_name: displayName(json.approver),
    decided_by: json.decided_by,
    decider_name: displayName(json.decider),
    decided_at: json.decided_at,
    rejection_reason: json.rejection_reason || '',
    created_at: json.created_at,
  };
}

const changeIncludes = [
  { model: User, as: 'employee', attributes: ['id', 'username', 'userid'] },
  { model: User, as: 'requester', attributes: ['id', 'username', 'userid'] },
  { model: User, as: 'approver', attributes: ['id', 'username', 'userid'] },
  { model: User, as: 'decider', attributes: ['id', 'username', 'userid'] },
];

export async function listSalaryApprovers(companyId: number, tenantId: number, requesterId: number) {
  const rows = await (User as any).findAll({
    where: {
      tenant_id: tenantId,
      status: 'active',
      id: { [Op.ne]: requesterId },
      [Op.or]: [
        { company_id: companyId, role: { [Op.in]: ['admin', 'root'] } },
        { company_id: companyId, is_payment_officer: true },
        { role: 'root' },
      ],
    },
    attributes: ['id', 'username', 'userid', 'role', 'is_payment_officer'],
    order: [['username', 'ASC']],
  });
  return rows.map((row: any) => ({
    id: row.id,
    name: displayName(row),
    role: row.role,
    is_payment_officer: Boolean(row.is_payment_officer),
  }));
}

export async function isEligibleSalaryApprover(
  approverId: number,
  companyId: number,
  tenantId: number,
  requesterId: number
) {
  if (!Number.isFinite(approverId) || approverId <= 0 || approverId === requesterId) return false;
  const approver = await (User as any).findOne({
    where: { id: approverId, tenant_id: tenantId, status: 'active' },
    attributes: ['id', 'company_id', 'role', 'is_payment_officer'],
  });
  if (!approver) return false;
  if (String(approver.role) === 'root') return true;
  if (Number(approver.company_id) !== Number(companyId)) return false;
  return String(approver.role) === 'admin' || Boolean(approver.is_payment_officer);
}

export async function recordInitialSalary(user: {
  id: number;
  tenant_id: number;
  company_id: number;
  salary?: unknown;
}, actorId: number) {
  const amount = normalizeSalaryAmount(user.salary);
  if (amount == null) return;
  await (SalaryChangeRequest as any).create({
    tenant_id: user.tenant_id,
    company_id: user.company_id,
    user_id: user.id,
    previous_salary: null,
    requested_salary: amount,
    status: 'approved',
    requested_by: actorId,
    approver_id: actorId,
    decided_by: actorId,
    decided_at: new Date(),
  });
}

export async function queueSalaryChange(input: {
  user: { id: number; tenant_id: number; company_id: number; salary?: unknown };
  actorId: number;
  nextSalary: number | null;
  approverId: number;
}) {
  const previous = normalizeSalaryAmount(input.user.salary);
  await (SalaryChangeRequest as any).update(
    { status: 'cancelled', decided_at: new Date(), decided_by: input.actorId },
    { where: { user_id: input.user.id, status: 'pending' } }
  );
  return (SalaryChangeRequest as any).create({
    tenant_id: input.user.tenant_id,
    company_id: input.user.company_id,
    user_id: input.user.id,
    previous_salary: previous,
    requested_salary: input.nextSalary,
    status: 'pending',
    requested_by: input.actorId,
    approver_id: input.approverId,
  });
}

export async function listSalaryHistory(userId: number, tenantId: number, companyId?: number) {
  const where: Record<string, unknown> = { user_id: userId, tenant_id: tenantId };
  if (companyId) where.company_id = companyId;
  const rows = await (SalaryChangeRequest as any).findAll({
    where,
    include: changeIncludes,
    order: [['created_at', 'DESC']],
  });
  return rows.map(mapChangeRow);
}

export async function listPendingSalaryChanges(actor: { id: number; role: string; tenant_id: number; company_id: number }) {
  const where: Record<string, unknown> = { tenant_id: actor.tenant_id, status: 'pending' };
  if (actor.role !== 'root') {
    where.approver_id = actor.id;
    where.company_id = actor.company_id;
  }
  const rows = await (SalaryChangeRequest as any).findAll({
    where,
    include: changeIncludes,
    order: [['created_at', 'ASC']],
  });
  return rows.map(mapChangeRow);
}

export async function decideSalaryChange(input: {
  changeId: number;
  actor: { id: number; role: string; tenant_id: number };
  action: 'approve' | 'reject';
  reason?: string;
}) {
  const row = await (SalaryChangeRequest as any).findOne({
    where: { id: input.changeId, tenant_id: input.actor.tenant_id, status: 'pending' },
  });
  if (!row) return { ok: false as const, status: 404, message: '승인 대기 중인 급여 변경이 없습니다.' };
  const isAssignee = Number(row.approver_id) === Number(input.actor.id);
  const isRoot = input.actor.role === 'root';
  if (!isAssignee && !isRoot) {
    return { ok: false as const, status: 403, message: '이 급여 변경은 지정된 담당자만 승인할 수 있습니다.' };
  }
  if (Number(row.requested_by) === Number(input.actor.id) && !isRoot) {
    return { ok: false as const, status: 403, message: '본인이 요청한 급여 변경은 승인할 수 없습니다.' };
  }

  if (input.action === 'approve') {
    const employee = await (User as any).findByPk(row.user_id);
    if (!employee) return { ok: false as const, status: 404, message: '사용자를 찾을 수 없습니다.' };
    await employee.update({ salary: normalizeSalaryAmount(row.requested_salary) });
    await row.update({
      status: 'approved',
      decided_by: input.actor.id,
      decided_at: new Date(),
      rejection_reason: null,
    });
  } else {
    await row.update({
      status: 'rejected',
      decided_by: input.actor.id,
      decided_at: new Date(),
      rejection_reason: String(input.reason || '').trim().slice(0, 500) || null,
    });
  }

  const fresh = await (SalaryChangeRequest as any).findByPk(row.id, { include: changeIncludes });
  return { ok: true as const, data: mapChangeRow(fresh) };
}
