import { Request, Response, NextFunction } from 'express';
import { recordActivityLog, resourceFromApiPath } from '../services/activityLogService';

const SKIP_PREFIXES = [
  '/api/health',
  '/api/login-info/logs',
  '/uploads',
  '/socket.io',
];

const shouldSkip = (path: string) =>
  SKIP_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

/**
 * 삭제(DELETE) 성공 시 감사 로그를 비동기로 남긴다.
 * res.on('finish') 이후 기록하므로 응답 지연이 없다.
 */
export const activityLogMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const method = String(req.method || '').toUpperCase();
  if (method !== 'DELETE') {
    return next();
  }

  const path = String(req.originalUrl || req.url || '');
  if (shouldSkip(path.split('?')[0])) {
    return next();
  }

  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    const user = (req as any).user;
    // 인증 전 DELETE는 거의 없으나, 있으면 최소 정보만
    recordActivityLog({
      tenant_id: user?.tenant_id ?? null,
      company_id: user?.company_id ?? null,
      user_id: user?.id ?? null,
      userid: user?.userid ?? user?.email ?? null,
      status: 'success',
      event_type: 'delete',
      reason: 'resource_deleted',
      resource: resourceFromApiPath(path),
      ip_address: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null,
      user_agent: req.get('user-agent') || null,
    });
  });

  return next();
};

export default activityLogMiddleware;
