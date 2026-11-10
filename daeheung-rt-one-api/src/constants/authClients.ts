/**
 * Auth client kinds — 웹과 알람(트레이) 앱 세션을 분리한다.
 * - 웹↔웹: 동시 로그인 허용 (login_notice_version으로 안내만)
 * - 알람 앱: 웹 세션을 끊지 않으며, API 스코프는 알림/세션으로 제한
 */
export const DRT_NOTIFIER_CLIENT = 'drt_notifier';
const NOTIFIER_CLIENTS = new Set([DRT_NOTIFIER_CLIENT, 'mvs_notifier']);

export function isMvsNotifierClient(client?: string | null): boolean {
  return NOTIFIER_CLIENTS.has(String(client || '').trim().toLowerCase());
}

type RequestLike = {
  body?: { client?: unknown };
  get?: (name: string) => string | undefined;
  headers?: Record<string, string | string[] | undefined>;
  originalUrl?: string;
  baseUrl?: string;
  path?: string;
};

function headerValue(req: RequestLike, name: string): string {
  if (typeof req.get === 'function') {
    return String(req.get(name) || '');
  }
  const raw = req.headers?.[name.toLowerCase()] ?? req.headers?.[name];
  if (Array.isArray(raw)) return String(raw[0] || '');
  return String(raw || '');
}

/** body.client / X-DRT-Client / User-Agent 로 알람 앱 로그인·요청 판별 */
export function resolveIsNotifierAuth(req: RequestLike): boolean {
  if (isMvsNotifierClient(typeof req.body?.client === 'string' ? req.body.client : null)) {
    return true;
  }
  if (isMvsNotifierClient(headerValue(req, 'x-drt-client')) || isMvsNotifierClient(headerValue(req, 'x-mvs-client'))) {
    return true;
  }
  const ua = headerValue(req, 'user-agent');
  return /Daeheung-RT-One-Notifier/i.test(ua);
}

/** 알람 앱 JWT로 허용하는 API 경로 (읽기·세션만) */
export function isNotifierApiPathAllowed(req: RequestLike & { method?: string }): boolean {
  const method = String(req.method || 'GET').toUpperCase();
  const raw = String(req.originalUrl || `${req.baseUrl || ''}${req.path || ''}` || '');
  const path = raw.split('?')[0];

  if (method === 'GET' && (path === '/api/auth/session' || path === '/api/auth/profile')) {
    return true;
  }
  if (method === 'POST' && (path === '/api/auth/refresh' || path === '/api/auth/logout')) {
    return true;
  }
  // 트레이 폴링: 알림 목록만 (발송·수정·삭제·inbox 제외)
  if (method === 'GET' && path === '/api/notifications') {
    return true;
  }
  return false;
}
