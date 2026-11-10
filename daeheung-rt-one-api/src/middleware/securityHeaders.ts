import { Request, Response, NextFunction } from 'express';

const isProdLike = () =>
  process.env.NODE_ENV === 'production' || process.env.FORCE_HTTPS === '1';

/**
 * Railway 등 리버스 프록시 뒤에서 HTTP 요청을 HTTPS로 301.
 * X-Forwarded-Proto 가 없을 때(내부 헬스체크)는 리다이렉트하지 않음.
 */
export const forceHttpsRedirect = (req: Request, res: Response, next: NextFunction) => {
  if (!isProdLike()) return next();
  const forwarded = req.get('x-forwarded-proto');
  if (!forwarded) return next();
  const proto = forwarded.split(',')[0].trim().toLowerCase();
  if (proto === 'https') return next();
  const host = req.get('host') || 'localhost';
  return res.redirect(301, `https://${host}${req.originalUrl}`);
};

/** API 응답용 보수적 CSP (+ 클릭재킹 frame-ancestors) */
export const buildApiContentSecurityPolicy = () =>
  [
    "default-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');

const BLOCKED_PREFIXES = [
  '/.git',
  '/.svn',
  '/.hg',
  '/.env',
  '/.aws',
  '/wp-admin',
  '/wp-content',
  '/wp-includes',
  '/wp-json',
  '/phpmyadmin',
  '/pma',
  '/server-status',
  '/server-info',
];

const BLOCKED_EXACT = new Set([
  '/phpinfo.php',
  '/info.php',
  '/test.php',
  '/phpinfo',
  '/elmah.axd',
  '/trace.axd',
  '/web.config',
  '/xmlrpc.php',
  '/composer.json',
  '/composer.lock',
]);

const BLOCKED_SUFFIXES = ['.php', '.asp', '.aspx', '.axd', '.bak', '.sql'];

export const isBlockedSensitivePath = (rawPath: string): boolean => {
  const pathOnly = String(rawPath || '')
    .split('?')[0]
    .split('#')[0]
    .toLowerCase();
  if (!pathOnly || pathOnly === '/') return false;
  if (BLOCKED_EXACT.has(pathOnly)) return true;
  if (pathOnly.startsWith('/wp-json')) return true;
  for (const prefix of BLOCKED_PREFIXES) {
    if (pathOnly === prefix || pathOnly.startsWith(`${prefix}/`)) return true;
  }
  for (const suffix of BLOCKED_SUFFIXES) {
    if (pathOnly.endsWith(suffix)) return true;
  }
  return false;
};

/**
 * SPA/API catch-all 오탐 방지: 스캐너가 탐색하는 민감 경로를 404로 차단.
 */
export const blockSensitivePaths = (req: Request, res: Response, next: NextFunction) => {
  if (isBlockedSensitivePath(req.path || req.url)) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(404).type('text/plain').send('Not Found');
  }
  return next();
};
