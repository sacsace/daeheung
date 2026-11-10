/**
 * Railway/프로덕션용 마이그레이션 (ts-node 불필요)
 * DATABASE_URL 환경 변수 사용
 */

const { Sequelize } = require('sequelize');
const { readdirSync } = require('fs');
const { join, resolve } = require('path');
const { config } = require('dotenv');
const { getPostgresDialectOptions } = require('./postgres-dialect-options.cjs');

config({ path: resolve(__dirname, '../.env') });
config({ path: resolve(__dirname, '../../.env'), override: false });

const DATABASE_URL = process.env.DATABASE_URL;
const migrationSqlLogging = process.env.MIGRATION_SQL_LOG === '1' ? console.log : false;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL 환경 변수가 설정되지 않았습니다.');
  console.error('💡 Railway 환경에서는 DATABASE_URL이 자동으로 설정됩니다.');
  process.exit(1);
}

const sequelize = new Sequelize(DATABASE_URL, {
  logging: migrationSqlLogging,
  dialect: 'postgres',
  dialectOptions: getPostgresDialectOptions(DATABASE_URL),
});

const MISSING_TABLE_ERROR =
  /No description found|relation .* does not exist|table .* does not exist/i;

const ALREADY_APPLIED_ERROR =
  /already exists|이미 있습니다|duplicate key|duplicate_object/i;

const ALREADY_APPLIED_CODES = new Set(['42P07', '42701', '42710']);

function isMissingTableError(error) {
  const msg = String(error?.message || '');
  return MISSING_TABLE_ERROR.test(msg) && !ALREADY_APPLIED_ERROR.test(msg);
}

function isAlreadyAppliedError(error) {
  const msg = String(error?.message || '');
  const code = error?.parent?.code || error?.original?.code;
  return ALREADY_APPLIED_ERROR.test(msg) || ALREADY_APPLIED_CODES.has(code);
}

async function markMigrationExecuted(file) {
  const migrationName = file.replace('.js', '');
  await sequelize.query(
    'INSERT INTO "SequelizeMeta" (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
    { bind: [migrationName] }
  );
}

const PRIORITY_MIGRATIONS = [
  '20251004202050-create-users-table.js',
  '20251004202639-create-all-tables.js',
];

function sortMigrationFiles(allFiles) {
  const createMigrations = allFiles
    .filter((f) => /create-/i.test(f) && !PRIORITY_MIGRATIONS.includes(f))
    .sort();
  const otherMigrations = allFiles
    .filter((f) => !PRIORITY_MIGRATIONS.includes(f) && !createMigrations.includes(f))
    .sort();

  return [
    ...PRIORITY_MIGRATIONS.filter((f) => allFiles.includes(f)),
    ...createMigrations,
    ...otherMigrations,
  ];
}

async function authenticateWithRetry(maxRetries = 8) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await sequelize.authenticate();
      return;
    } catch (error) {
      console.error(`DB 연결 실패 (${attempt}/${maxRetries}):`, error.message);
      if (attempt >= maxRetries) throw error;
      const waitMs = 5000 * attempt;
      console.log(`${waitMs}ms 후 재시도...`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}

async function getExecutedNames() {
  const [executedMigrations] = await sequelize.query(
    'SELECT name FROM "SequelizeMeta" ORDER BY name'
  );
  return executedMigrations.map((m) => m.name);
}

async function runMigrations() {
  const startedAt = Date.now();
  try {
    console.log('🔌 데이터베이스 연결 중...');
    await authenticateWithRetry();
    console.log('✅ 데이터베이스 연결 성공\n');

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "SequelizeMeta" (
        name VARCHAR(255) NOT NULL PRIMARY KEY
      );
    `);

    const migrationsPath = join(__dirname, '..', 'migrations');
    const allFiles = readdirSync(migrationsPath)
      .filter((file) => file.endsWith('.js'))
      .sort();
    const migrationFiles = sortMigrationFiles(allFiles);

    console.log(`📋 발견된 마이그레이션 파일: ${migrationFiles.length}개\n`);

    const maxPasses = 12;
    let totalRan = 0;

    for (let pass = 1; pass <= maxPasses; pass++) {
      const executedNames = await getExecutedNames();
      const pendingMigrations = migrationFiles.filter(
        (file) => !executedNames.includes(file.replace('.js', ''))
      );

      if (pendingMigrations.length === 0) {
        console.log('\n✅ 모든 마이그레이션이 이미 실행되었습니다.');
        break;
      }

      console.log(`\n🔄 패스 ${pass}/${maxPasses} — 실행 대기: ${pendingMigrations.length}개\n`);

      let ranThisPass = 0;
      let skippedThisPass = 0;

      for (const file of pendingMigrations) {
        try {
          console.log(`📦 실행 중: ${file}...`);
          const migration = require(join(migrationsPath, file));

          if (!migration.up) {
            console.log(`   ⚠️  up 함수가 없습니다: ${file}\n`);
            continue;
          }

          await migration.up(sequelize.getQueryInterface(), Sequelize);

          const migrationName = file.replace('.js', '');
          await sequelize.query(
            'INSERT INTO "SequelizeMeta" (name) VALUES ($1)',
            { bind: [migrationName] }
          );

          console.log(`   ✅ 완료: ${file}\n`);
          ranThisPass++;
          totalRan++;
        } catch (error) {
          if (isAlreadyAppliedError(error)) {
            await markMigrationExecuted(file);
            console.log(`   ⏭️  이미 적용됨 — 메타만 기록: ${file}`);
            console.log(`   ${error.message}\n`);
            ranThisPass++;
            totalRan++;
            continue;
          }
          if (isMissingTableError(error)) {
            console.log(`   ⏭️  의존 테이블 없음 — 다음 패스에서 재시도: ${file}`);
            console.log(`   ${error.message}\n`);
            skippedThisPass++;
            continue;
          }
          console.error(`   ❌ 오류: ${file}`);
          console.error(`   ${error.message}\n`);
          throw error;
        }
      }

      if (ranThisPass === 0) {
        const executedAfterPass = await getExecutedNames();
        const remaining = migrationFiles.filter(
          (file) => !executedAfterPass.includes(file.replace('.js', ''))
        );
        if (remaining.length > 0) {
          console.warn(
            `\n⚠️  ${remaining.length}개 마이그레이션이 테이블 부재로 건너뛰어졌습니다 (로그인에는 영향 없을 수 있음):`
          );
          remaining.slice(0, 10).forEach((f) => console.warn(`   - ${f}`));
          if (remaining.length > 10) {
            console.warn(`   ... 외 ${remaining.length - 10}개`);
          }
        }
        break;
      }

      console.log(
        `패스 ${pass} 완료 — 실행 ${ranThisPass}개, 건너뜀 ${skippedThisPass}개 (누적 실행 ${totalRan}개)`
      );
    }

    const finalExecuted = await getExecutedNames();
    const stillPending = migrationFiles.filter(
      (file) => !finalExecuted.includes(file.replace('.js', ''))
    );

    if (stillPending.length > 0) {
      console.log(`\nℹ️  미적용 마이그레이션 ${stillPending.length}개 (선택적 스키마)`);
    } else {
      console.log('\n🎉 모든 마이그레이션이 성공적으로 실행되었습니다!');
    }
    console.log(`⏱️ 마이그레이션 총 소요시간: ${Date.now() - startedAt}ms`);

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 마이그레이션 실행 실패:', error.message);
    console.error(error);
    await sequelize.close();
    process.exit(1);
  }
}

runMigrations();
