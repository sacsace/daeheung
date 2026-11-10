import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import path from 'path';
import { promisify } from 'util';

const router = Router();
const execAsync = promisify(exec);
const serverRoot = path.join(__dirname, '..', '..');

function isAuthorized(req: Request): boolean {
  const key = String(req.headers['x-bootstrap-key'] || '').trim();
  const secret = process.env.BOOTSTRAP_DB_KEY || '';
  if (process.env.NODE_ENV === 'production' && !secret) {
    return false;
  }
  const fallback = process.env.NODE_ENV !== 'production' ? (process.env.JWT_SECRET || '') : '';
  const effectiveSecret = secret || fallback;
  return Boolean(key && effectiveSecret && key === effectiveSecret);
}

router.post('/bootstrap-database', async (req: Request, res: Response) => {
  if (!isAuthorized(req)) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  res.setTimeout(600000);
  req.setTimeout(600000);

  const seedOnly = String(req.headers['x-seed-only'] || req.query.seedOnly || '').trim() === '1';
  const migrateOnly = String(req.headers['x-migrate-only'] || req.query.migrateOnly || '').trim() === '1';

  try {
    if (!seedOnly) {
      console.log('[bootstrap] 마이그레이션 시작...');
      const { stdout: migOut, stderr: migErr } = await execAsync('node scripts/run-migrations.cjs', {
        cwd: serverRoot,
        env: process.env,
        maxBuffer: 10 * 1024 * 1024,
      });
      if (migOut) console.log(migOut);
      if (migErr) console.error(migErr);
    } else {
      console.log('[bootstrap] x-seed-only=1 — 마이그레이션 건너뜀');
    }

    if (!migrateOnly) {
      console.log('[bootstrap] 시드 시작...');
      const { stdout: seedOut, stderr: seedErr } = await execAsync('npx ts-node scripts/seed-data.ts', {
        cwd: serverRoot,
        env: process.env,
        maxBuffer: 10 * 1024 * 1024,
      });
      if (seedOut) console.log(seedOut);
      if (seedErr) console.error(seedErr);
    } else {
      console.log('[bootstrap] x-migrate-only=1 — 시드 건너뜀');
    }

    return res.json({
      success: true,
      message: migrateOnly
        ? '마이그레이션 완료.'
        : seedOnly
          ? '시드 완료. root / admin123 로 로그인하세요.'
          : '마이그레이션·시드 완료. root / admin123 로 로그인하세요.',
    });
  } catch (error: any) {
    console.error('[bootstrap] 실패:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'bootstrap failed',
      stderr: error?.stderr?.slice?.(0, 2000),
    });
  }
});

/** 개발서버에서 추출한 menus-dev-export.json 을 운영 DB에 반영 */
router.post('/import-menus', async (req: Request, res: Response) => {
  if (!isAuthorized(req)) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  res.setTimeout(600000);
  req.setTimeout(600000);

  const jsonPath = path.join(serverRoot, 'data', 'menus-dev-export.json');
  const syncPerms = String(req.headers['x-sync-permissions'] || req.query.syncPermissions || '1').trim() !== '0';

  try {
    const args = [jsonPath, '--tenant=1'];
    if (syncPerms) args.push('--sync-permissions');

    console.log('[bootstrap] 메뉴 import 시작...', args.join(' '));
    const { stdout, stderr } = await execAsync(
      `node scripts/import-menus.cjs ${args.map((a) => JSON.stringify(a)).join(' ')}`,
      {
        cwd: serverRoot,
        env: process.env,
        maxBuffer: 10 * 1024 * 1024,
      }
    );
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);

    return res.json({
      success: true,
      message: '개발서버 메뉴 데이터가 운영 DB에 반영되었습니다.',
    });
  } catch (error: any) {
    console.error('[bootstrap] 메뉴 import 실패:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'menu import failed',
      stderr: error?.stderr?.slice?.(0, 2000),
    });
  }
});

/** 개발서버에서 추출한 departments-dev-export.json 을 운영 DB에 반영 */
router.post('/import-departments', async (req: Request, res: Response) => {
  if (!isAuthorized(req)) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  res.setTimeout(600000);
  req.setTimeout(600000);

  const jsonPath = path.join(serverRoot, 'data', 'departments-dev-export.json');

  try {
    console.log('[bootstrap] 부서 import 시작...', jsonPath);
    const { stdout, stderr } = await execAsync(
      `node scripts/import-departments.cjs ${JSON.stringify(jsonPath)} --tenant=1`,
      {
        cwd: serverRoot,
        env: process.env,
        maxBuffer: 10 * 1024 * 1024,
      }
    );
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);

    return res.json({
      success: true,
      message: '개발서버 부서 데이터가 운영 DB에 반영되었습니다.',
    });
  } catch (error: any) {
    console.error('[bootstrap] 부서 import 실패:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'department import failed',
      stderr: error?.stderr?.slice?.(0, 2000),
    });
  }
});

/** 개발서버에서 추출한 users-dev-export.json 을 운영 DB에 반영 */
router.post('/import-users', async (req: Request, res: Response) => {
  if (!isAuthorized(req)) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  res.setTimeout(600000);
  req.setTimeout(600000);

  const jsonPath = path.join(serverRoot, 'data', 'users-dev-export.json');

  try {
    console.log('[bootstrap] 사용자 import 시작...', jsonPath);
    const { stdout, stderr } = await execAsync(
      `node scripts/import-users.cjs ${JSON.stringify(jsonPath)} --tenant=1`,
      {
        cwd: serverRoot,
        env: process.env,
        maxBuffer: 10 * 1024 * 1024,
      }
    );
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);

    return res.json({
      success: true,
      message: '개발서버 사용자 데이터가 운영 DB에 반영되었습니다.',
    });
  } catch (error: any) {
    console.error('[bootstrap] 사용자 import 실패:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'user import failed',
      stderr: error?.stderr?.slice?.(0, 2000),
    });
  }
});

export default router;
