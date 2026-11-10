import { Transaction } from 'sequelize';
import { Project, ProjectActivity, ProjectTask } from '../models';

export async function logProjectActivity(params: {
  tenant_id: number;
  company_id: number;
  project_id: number;
  task_id?: number | null;
  actor_id?: number | null;
  event_type: string;
  metadata?: Record<string, unknown> | null;
  transaction?: Transaction;
}) {
  return (ProjectActivity as any).create(
    {
      tenant_id: params.tenant_id,
      company_id: params.company_id,
      project_id: params.project_id,
      task_id: params.task_id ?? null,
      actor_id: params.actor_id ?? null,
      event_type: params.event_type,
      metadata: params.metadata ?? null,
    },
    { transaction: params.transaction }
  );
}

/** Completed / Active(non-cancelled) × 100 — cancelled 제외 */
export async function recalculateProjectProgress(projectId: number, transaction?: Transaction) {
  const tasks = await (ProjectTask as any).findAll({
    where: { project_id: projectId, is_active: true },
    attributes: ['status'],
    transaction,
  });
  const active = tasks.filter((t: any) => String(t.status) !== 'cancelled');
  const completed = active.filter((t: any) => String(t.status) === 'completed');
  const progress = active.length === 0 ? 0 : Math.round((completed.length / active.length) * 100);
  await (Project as any).update({ progress }, { where: { id: projectId }, transaction });
  return {
    progress,
    total: active.length,
    completed: completed.length,
    todo: active.filter((t: any) => t.status === 'todo').length,
    in_progress: active.filter((t: any) => t.status === 'in_progress').length,
    blocked: active.filter((t: any) => t.status === 'blocked').length,
    overdue: 0,
  };
}

export const TASK_STATUSES = ['todo', 'in_progress', 'blocked', 'completed', 'cancelled'] as const;
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export const SCHEDULE_TYPES = ['milestone', 'meeting', 'work', 'deadline', 'other'] as const;

export function normalizeTaskStatus(value: unknown): string {
  const raw = String(value || 'todo').trim().toLowerCase();
  return (TASK_STATUSES as readonly string[]).includes(raw) ? raw : 'todo';
}

export function normalizeTaskPriority(value: unknown): string {
  const raw = String(value || 'medium').trim().toLowerCase();
  if (raw === 'normal') return 'medium';
  return (TASK_PRIORITIES as readonly string[]).includes(raw) ? raw : 'medium';
}

export function normalizeScheduleType(value: unknown): string {
  const raw = String(value || 'work').trim().toLowerCase();
  return (SCHEDULE_TYPES as readonly string[]).includes(raw) ? raw : 'work';
}

export function canEditWorkspace(role: string | undefined, asAdmin: boolean): boolean {
  if (asAdmin) return true;
  return role === 'owner' || role === 'manager' || role === 'member';
}

export function canManageWorkspace(role: string | undefined, asAdmin: boolean): boolean {
  if (asAdmin) return true;
  return role === 'owner' || role === 'manager';
}

/** 타임라인 막대용 기본 팔레트 — 서로 구분되는 색 */
export const PROJECT_TASK_COLORS = [
  '#5B9BD5',
  '#70AD47',
  '#ED7D31',
  '#00B0F0',
  '#FFC000',
  '#C55A11',
  '#548235',
  '#2F5496',
  '#00B050',
  '#7030A0',
  '#C00000',
  '#7F7F7F',
  '#385723',
  '#833C0C',
  '#1F4E79',
] as const;

export function normalizeTaskColor(value: unknown): string | null {
  if (value == null || value === '') return null;
  const raw = String(value).trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(raw)) return null;
  return raw;
}

export async function pickUniqueTaskColor(
  projectId: number,
  preferred?: unknown,
  transaction?: Transaction
): Promise<string> {
  const preferredColor = normalizeTaskColor(preferred);
  if (preferredColor) return preferredColor;

  const rows = await (ProjectTask as any).findAll({
    where: { project_id: projectId, is_active: true },
    attributes: ['color'],
    transaction,
  });

  const used = new Set<string>();
  for (let i = 0; i < rows.length; i += 1) {
    const normalized = normalizeTaskColor(rows[i]?.color);
    if (normalized) used.add(normalized);
  }

  for (let i = 0; i < PROJECT_TASK_COLORS.length; i += 1) {
    const candidate = PROJECT_TASK_COLORS[i];
    if (!used.has(candidate)) return candidate;
  }

  // 팔레트가 모두 사용 중이면 사용 횟수가 가장 적은 색
  let best: string = PROJECT_TASK_COLORS[0];
  let bestCount = Number.MAX_SAFE_INTEGER;
  for (let i = 0; i < PROJECT_TASK_COLORS.length; i += 1) {
    const candidate = PROJECT_TASK_COLORS[i];
    let count = 0;
    const usedList = Array.from(used.values());
    for (let j = 0; j < usedList.length; j += 1) {
      if (usedList[j] === candidate) count += 1;
    }
    if (count < bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}
