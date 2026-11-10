import LoginLog from '../models/LoginLog';
import sequelize from '../config/database';
import { DataTypes } from 'sequelize';

export type ActivityEventType =
  | 'login'
  | 'logout'
  | 'delete'
  | 'create'
  | 'update'
  | 'security';

export type ActivityLogInput = {
  tenant_id?: number | null;
  company_id?: number | null;
  user_id?: number | null;
  userid?: string | null;
  status?: 'success' | 'failure';
  event_type?: ActivityEventType;
  reason?: string | null;
  resource?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
};

let schemaEnsured = false;

const ensureActivityLogSchema = async () => {
  if (schemaEnsured) return;
  const qi = sequelize.getQueryInterface();
  let table: Record<string, unknown> | null = null;
  try {
    table = (await qi.describeTable('login_logs')) as Record<string, unknown>;
  } catch {
    schemaEnsured = true;
    return;
  }
  if (!table.event_type) {
    await qi.addColumn('login_logs', 'event_type', {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'login',
    });
  }
  if (!table.resource) {
    await qi.addColumn('login_logs', 'resource', {
      type: DataTypes.STRING(120),
      allowNull: true,
    });
  }
  schemaEnsured = true;
};

const clip = (value: string | null | undefined, max: number) => {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
};

/**
 * 감사 로그 기록 — 요청 경로를 막지 않도록 fire-and-forget 사용.
 * 실패해도 본 업무 API에는 영향 없음.
 */
export const recordActivityLog = (input: ActivityLogInput): void => {
  void (async () => {
    try {
      await ensureActivityLogSchema();
      await (LoginLog as any).create({
        tenant_id: input.tenant_id ?? null,
        company_id: input.company_id ?? null,
        user_id: input.user_id ?? null,
        userid: clip(input.userid, 100),
        status: input.status === 'failure' ? 'failure' : 'success',
        event_type: input.event_type || 'login',
        reason: clip(input.reason, 255),
        resource: clip(input.resource, 120),
        ip_address: clip(input.ip_address, 64),
        user_agent: clip(input.user_agent, 500),
        logged_at: new Date(),
      });
    } catch (error) {
      console.error('activity log write skipped:', error);
    }
  })();
};

/** DELETE /api/.../resource/:id → resource:id */
export const resourceFromApiPath = (path: string): string => {
  const clean = String(path || '')
    .replace(/^\/api\/?/, '')
    .replace(/\?.*$/, '')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '');
  if (!clean) return 'unknown';
  const parts = clean.split('/');
  if (parts.length >= 2 && /^\d+$/.test(parts[parts.length - 1])) {
    const id = parts[parts.length - 1];
    const name = parts[parts.length - 2];
    return clip(`${name}:${id}`, 120) || 'unknown';
  }
  return clip(parts.slice(0, 3).join('/'), 120) || 'unknown';
};

export default { recordActivityLog, resourceFromApiPath };
