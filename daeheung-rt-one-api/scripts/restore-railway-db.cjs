/**
 * Railway(또는 임의 원격) PostgreSQL에 로컬 덤프를 복원합니다.
 *
 * 사전 요구: PostgreSQL 클라이언트 도구가 PATH에 있어야 합니다 (pg_restore, psql).
 *
 * 사용:
 *   set DATABASE_URL=postgresql://...   (PowerShell: $env:DATABASE_URL="...")
 *   cd daeheung-rt-one-api
 *   node scripts/restore-railway-db.cjs
 *   node scripts/restore-railway-db.cjs ..\backup\daeheung-rt-one-db.dump
 *   node scripts/restore-railway-db.cjs ..\backup\daeheung-rt-one-db.dump --clean
 *
 * --clean : 기존 객체를 제거한 뒤 복원(데이터·스키마 덮어씀). 운영 DB에서는 신중히 사용.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const databaseUrl = process.env.DATABASE_URL;
const args = process.argv.slice(2);
const clean = args.includes('--clean');
const positional = args.filter((a) => a !== '--clean');
const defaultDump = path.join(__dirname, '..', '..', 'backup', 'daeheung-rt-one-db.dump');
const dumpPath = path.resolve(positional[0] || defaultDump);

function which(cmd) {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  return r.status === 0;
}

function main() {
  if (!databaseUrl || typeof databaseUrl !== 'string' || !databaseUrl.trim()) {
    console.error('❌ DATABASE_URL 환경 변수가 없습니다.');
    console.error('   Railway Postgres → Variables 에서 복사한 연결 문자열을 설정하세요.');
    process.exit(1);
  }

  if (!fs.existsSync(dumpPath)) {
    console.error('❌ 덤프 파일이 없습니다:', dumpPath);
    console.error('   예: backup/daeheung-rt-one-db.dump 또는 pg_dump -Fc 로 만든 파일');
    process.exit(1);
  }

  const ext = path.extname(dumpPath).toLowerCase();
  const isPlainSql = ext === '.sql';

  if (isPlainSql) {
    if (!which('psql')) {
      console.error('❌ psql 을 찾을 수 없습니다. PostgreSQL 클라이언트를 설치하고 PATH에 추가하세요.');
      process.exit(1);
    }
    console.log('📥 psql 로 SQL 파일 복원:', dumpPath);
    const r = spawnSync('psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-f', dumpPath], {
      stdio: 'inherit',
      env: process.env,
    });
    process.exit(r.status ?? 1);
    return;
  }

  if (!which('pg_restore')) {
    console.error('❌ pg_restore 를 찾을 수 없습니다. PostgreSQL 클라이언트를 설치하고 PATH에 추가하세요.');
    console.error('   https://www.postgresql.org/download/windows/');
    process.exit(1);
  }

  const pgArgs = ['--verbose', '--no-owner', '--no-acl', '-d', databaseUrl.trim()];
  if (clean) {
    console.warn('⚠️  --clean: 기존 DB 객체를 삭제한 뒤 복원합니다.');
    pgArgs.push('--clean');
    pgArgs.push('--if-exists');
  }
  pgArgs.push(dumpPath);

  console.log('📥 pg_restore 로 복원:', dumpPath);
  const r = spawnSync('pg_restore', pgArgs, { stdio: 'inherit', env: process.env });
  process.exit(r.status ?? 1);
}

main();
