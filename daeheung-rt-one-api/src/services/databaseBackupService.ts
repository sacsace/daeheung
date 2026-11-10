import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';
import { getUploadRoot } from '../utils/uploadPath';

export type DatabaseBackupFile = {
  filename: string;
  size: number;
  createdAt: string;
};

type DbConnection = {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
};

const BACKUP_FILENAME_RX = /^mvs_backup_[\dT\-Z]+\.dump$/;

function getDbConnection(): DbConnection {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    return {
      host: url.hostname,
      port: url.port || '5432',
      database: url.pathname.replace(/^\//, ''),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
    };
  }

  if (!env.DB_NAME || !env.DB_USER || !env.DB_PASSWORD) {
    throw new Error('데이터베이스 연결 정보가 없습니다. DATABASE_URL 또는 DB_* 환경 변수를 확인하세요.');
  }

  return {
    host: env.DB_HOST,
    port: String(env.DB_PORT),
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
  };
}

export function getBackupRootDir(): string {
  return process.env.BACKUP_PATH || path.join(getUploadRoot(), 'db-backups');
}

export function getTenantBackupDir(tenantId: number): string {
  return path.join(getBackupRootDir(), String(tenantId));
}

function resolvePgDumpCommand(): string {
  if (process.env.PG_DUMP_PATH?.trim()) {
    return process.env.PG_DUMP_PATH.trim();
  }
  return process.platform === 'win32' ? 'pg_dump.exe' : 'pg_dump';
}

async function runPgDump(outputFile: string): Promise<void> {
  const conn = getDbConnection();
  const pgDump = resolvePgDumpCommand();
  const args = [
    '-Fc',
    '-h',
    conn.host,
    '-p',
    conn.port,
    '-U',
    conn.user,
    '-d',
    conn.database,
    '-f',
    outputFile,
  ];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(pgDump, args, {
      env: {
        ...process.env,
        PGPASSWORD: conn.password,
      },
      windowsHide: true,
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', (error) => {
      reject(
        new Error(
          `pg_dump 실행 실패: ${error.message}. PostgreSQL 클라이언트(pg_dump) 설치 여부를 확인하세요.`
        )
      );
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `pg_dump가 종료 코드 ${code}로 실패했습니다.`));
    });
  });
}

export function sanitizeBackupFilename(filename: string): string | null {
  const base = path.basename(filename);
  return BACKUP_FILENAME_RX.test(base) ? base : null;
}

export function resolveBackupFilePath(tenantId: number, filename: string): string | null {
  const safeName = sanitizeBackupFilename(filename);
  if (!safeName) return null;
  const fullPath = path.join(getTenantBackupDir(tenantId), safeName);
  const resolved = path.resolve(fullPath);
  const tenantDir = path.resolve(getTenantBackupDir(tenantId));
  if (!resolved.startsWith(tenantDir + path.sep)) {
    return null;
  }
  if (!fs.existsSync(resolved)) {
    return null;
  }
  return resolved;
}

export function listDatabaseBackups(tenantId: number): DatabaseBackupFile[] {
  const dir = getTenantBackupDir(tenantId);
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter((name) => BACKUP_FILENAME_RX.test(name))
    .map((filename) => {
      const fullPath = path.join(dir, filename);
      const stat = fs.statSync(fullPath);
      return {
        filename,
        size: stat.size,
        createdAt: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function cleanupOldBackups(tenantId: number, retentionDays: number): number {
  const days = Number.isFinite(retentionDays) && retentionDays > 0 ? Math.floor(retentionDays) : 30;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const dir = getTenantBackupDir(tenantId);
  if (!fs.existsSync(dir)) {
    return 0;
  }

  let removed = 0;
  for (const filename of fs.readdirSync(dir)) {
    if (!BACKUP_FILENAME_RX.test(filename)) continue;
    const fullPath = path.join(dir, filename);
    const stat = fs.statSync(fullPath);
    if (stat.mtimeMs < cutoff) {
      fs.unlinkSync(fullPath);
      removed += 1;
    }
  }
  return removed;
}

export async function createDatabaseBackup(tenantId: number): Promise<DatabaseBackupFile> {
  const dir = getTenantBackupDir(tenantId);
  fs.mkdirSync(dir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `mvs_backup_${timestamp}.dump`;
  const outputFile = path.join(dir, filename);

  await runPgDump(outputFile);

  const stat = fs.statSync(outputFile);
  return {
    filename,
    size: stat.size,
    createdAt: stat.mtime.toISOString(),
  };
}
