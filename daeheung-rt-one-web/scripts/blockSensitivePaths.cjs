/**
 * 스캐너가 SPA catch-all(200 + index.html)을 민감 파일 노출로 오인하지 않도록
 * 알려진 민감·레거시 경로를 404로 차단한다.
 */

/** 경로 접두 매칭 (소문자). `/.env` 는 별도 처리(/.env.example 등). */
const BLOCKED_PREFIXES = [
  '/.git',
  '/.svn',
  '/.hg',
  '/.bzr',
  '/.aws',
  '/.docker',
  '/.vscode',
  '/.idea',
  '/wp-admin',
  '/wp-content',
  '/wp-includes',
  '/wp-json',
  '/xmlrpc.php',
  '/phpmyadmin',
  '/pma',
  '/adminer',
  '/server-status',
  '/server-info',
  '/actuator',
  '/graphql',
  '/graphiql',
];

const BLOCKED_EXACT = new Set([
  '/phpinfo.php',
  '/info.php',
  '/test.php',
  '/phpinfo',
  '/elmah.axd',
  '/trace.axd',
  '/web.config',
  '/crossdomain.xml',
  '/clientaccesspolicy.xml',
  '/composer.json',
  '/composer.lock',
  '/package.json',
  '/package-lock.json',
  '/yarn.lock',
  '/pnpm-lock.yaml',
  '/.gitignore',
  '/.gitattributes',
  '/.ds_store',
  '/thumbs.db',
  '/desktop.ini',
  '/readme.md',
  '/readme.txt',
  '/readme',
  '/license',
  '/license.md',
  '/changelog.md',
  '/config.json',
  '/config.js',
  '/config.yml',
  '/config.yaml',
  '/config.xml',
  '/settings.json',
  '/appsettings.json',
  '/backup.zip',
  '/backup.tar',
  '/backup.tar.gz',
  '/backup.sql',
  '/dump.zip',
  '/dump.sql',
  '/db.zip',
  '/database.zip',
  '/site.zip',
  '/www.zip',
  '/src.zip',
  '/dist.zip',
  '/.env.example',
  '/.env.local',
  '/.env.production',
  '/.env.development',
  '/graphql',
  '/graphiql',
]);

/** /.well-known/security.txt 는 허용 — 그 외 well-known 민감 경로만 차단할 때 사용 */
const ALLOWED_EXACT = new Set(['/.well-known/security.txt']);

const BLOCKED_SUFFIXES = [
  '.php',
  '.asp',
  '.aspx',
  '.axd',
  '.bak',
  '.sql',
  '.sqlite',
  '.env',
];

/**
 * @param {string} rawPath
 * @returns {boolean}
 */
function isBlockedSensitivePath(rawPath) {
  const pathOnly = String(rawPath || '')
    .split('?')[0]
    .split('#')[0]
    .toLowerCase();
  if (!pathOnly || pathOnly === '/') return false;
  if (ALLOWED_EXACT.has(pathOnly)) return false;

  if (BLOCKED_EXACT.has(pathOnly)) return true;

  // /.env, /.env.*, /.env/...
  if (pathOnly === '/.env' || pathOnly.startsWith('/.env.') || pathOnly.startsWith('/.env/')) {
    return true;
  }

  for (const prefix of BLOCKED_PREFIXES) {
    if (pathOnly === prefix || pathOnly.startsWith(`${prefix}/`)) return true;
  }

  if (pathOnly.startsWith('/wp-json')) return true;

  for (const suffix of BLOCKED_SUFFIXES) {
    if (pathOnly.endsWith(suffix)) return true;
  }

  // 루트 근처 흔한 백업 아카이브 이름
  if (/^\/(backup|dump|db|database|site|www|src|dist|html|public)(\.|[-_]).*\.(zip|tar|gz|tgz|rar|7z)$/.test(pathOnly)) {
    return true;
  }

  return false;
}

/**
 * Express middleware — 민감 경로 404
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function blockSensitivePaths(req, res, next) {
  if (isBlockedSensitivePath(req.path || req.url)) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(404).type('text/plain').send('Not Found');
  }
  return next();
}

module.exports = {
  isBlockedSensitivePath,
  blockSensitivePaths,
  BLOCKED_PREFIXES,
  BLOCKED_EXACT,
};
