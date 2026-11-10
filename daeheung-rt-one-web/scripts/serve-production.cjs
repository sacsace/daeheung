/**
 * Railway 등에서 CRA build 정적 파일을 서빙.
 * - HTTP→HTTPS 리다이렉트 (X-Forwarded-Proto)
 * - apex(mvsystem.in) → https://www.mvsystem.in 캐노니컬 리다이렉트
 * - 보안 헤더 + CSP (리다이렉트 응답에도 적용)
 * - 민감 경로(.git, phpinfo, wp-json 등) 404 차단
 */
const path = require('path');
const express = require('express');
const { blockSensitivePaths } = require('./blockSensitivePaths.cjs');

const PORT = Number.parseInt(process.env.PORT || '3000', 10) || 3000;
const isProd = process.env.NODE_ENV === 'production' || process.env.FORCE_HTTPS === '1';
const buildDir = path.join(__dirname, '..', 'build');
const CANONICAL_HOST = String(process.env.CANONICAL_HOST || 'www.mvsystem.in')
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\//, '')
  .replace(/\/+$/, '');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

const resolveApiOrigin = () => {
  const raw =
    process.env.CSP_API_ORIGIN ||
    process.env.REACT_APP_API_URL ||
    'https://api.mvsystem.in/api';
  try {
    const withScheme = /:\/\//.test(raw) ? raw : `https://${raw}`;
    return new URL(withScheme).origin;
  } catch {
    return 'https://api.mvsystem.in';
  }
};

const buildCsp = () => {
  const apiOrigin = resolveApiOrigin();
  const extra = String(process.env.CSP_CONNECT_SRC || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const connectSrc = [
    "'self'",
    apiOrigin,
    'https://fonts.googleapis.com',
    'https://*.up.railway.app',
    'https://*.railway.app',
    ...extra,
  ].join(' ');

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    // blob: PDF 미리보기(iframe) — default-src만 있으면 blob iframe이 차단됨
    "frame-src 'self' blob:",
    `connect-src ${connectSrc}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
};

const requestIsHttps = (req) => {
  const forwarded = req.get('x-forwarded-proto');
  if (forwarded) {
    return forwarded.split(',')[0].trim().toLowerCase() === 'https';
  }
  return Boolean(req.secure);
};

const applySecurityHeaders = (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
  );
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Content-Security-Policy', buildCsp());
  // HSTS는 항상 설정(스캐너·중간 프록시가 HTTP로 들어와도 브라우저에 HTTPS 강제 신호)
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );
};

/** 보안 헤더를 리다이렉트 포함 모든 응답에 먼저 적용 */
app.use((req, res, next) => {
  applySecurityHeaders(req, res);
  next();
});

/**
 * 캐노니컬 호스트 + HTTPS 강제.
 * - Host 가 apex(mvsystem.in)면 https://www… 로 301 (HTTP 다운그레이드 방지)
 * - X-Forwarded-Proto=http 이면 https 로 301
 */
app.use((req, res, next) => {
  if (!isProd) return next();

  const hostHeader = String(req.get('host') || '')
    .split(':')[0]
    .trim()
    .toLowerCase();
  const forwarded = req.get('x-forwarded-proto');
  const proto = forwarded
    ? forwarded.split(',')[0].trim().toLowerCase()
    : requestIsHttps(req)
      ? 'https'
      : 'http';

  const apexHost = CANONICAL_HOST.replace(/^www\./, '') || 'mvsystem.in';

  // apex → https://www (캐노니컬). HTTPS→HTTP 다운그레이드 방지.
  if (hostHeader && hostHeader === apexHost && CANONICAL_HOST && hostHeader !== CANONICAL_HOST) {
    return res.redirect(301, `https://${CANONICAL_HOST}${req.originalUrl}`);
  }

  if (forwarded && proto === 'http') {
    const targetHost =
      hostHeader === apexHost && CANONICAL_HOST
        ? CANONICAL_HOST
        : hostHeader || CANONICAL_HOST || 'www.mvsystem.in';
    return res.redirect(301, `https://${targetHost}${req.originalUrl}`);
  }

  return next();
});

/** 스캔 대응: .git / phpinfo / wp-json / server-status 등 */
app.use(blockSensitivePaths);

app.get('/health', (_req, res) => {
  res.status(200).type('text/plain').send('ok');
});

/** security.txt — express.static 의 dotfile ignore 이슈를 피하기 위해 명시 라우트 */
app.get('/.well-known/security.txt', (_req, res) => {
  const filePath = path.join(buildDir, '.well-known', 'security.txt');
  res.setHeader('Cache-Control', 'no-cache');
  res.type('text/plain; charset=utf-8');
  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).type('text/plain').send('Not Found');
    }
  });
});

app.use(
  express.static(buildDir, {
    index: false,
    maxAge: '7d',
    dotfiles: 'allow',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html') || filePath.endsWith('serve.json')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(buildDir, 'index.html'), (err) => {
    if (err) {
      res.status(500).type('text/plain').send('Frontend build missing. Run npm run build.');
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(
    `[mvs-frontend] serving ${buildDir} on :${PORT} (httpsRedirect=${isProd}, canonical=${CANONICAL_HOST || 'off'})`
  );
});
