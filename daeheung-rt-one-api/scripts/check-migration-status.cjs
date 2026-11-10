/**
 * DB 마이그레이션 적용 상태 점검
 * 사용: DATABASE_URL=... node scripts/check-migration-status.cjs
 */
const { Sequelize } = require('sequelize');
const { readdirSync } = require('fs');
const { join, resolve } = require('path');
const { config } = require('dotenv');
const { getPostgresDialectOptions } = require('./postgres-dialect-options.cjs');

config({ path: resolve(__dirname, '../.env') });
config({ path: resolve(__dirname, '../../.env'), override: false });

const DATABASE_URL = process.env.DATABASE_URL;

const CRITICAL_COLUMNS = [
  { table: 'attendances', column: 'is_active' },
  { table: 'vacations', column: 'is_active' },
  { table: 'invoices', column: 'is_active' },
  { table: 'quotations', column: 'is_active' },
  { table: 'work_board_cards', column: 'completed_at' },
  { table: 'projects', column: 'is_active' },
  { table: 'approvals', column: 'is_active' },
  { table: 'users', column: 'is_payment_officer' },
  { table: 'users', column: 'department_id' },
];

const OPTIONAL_TABLES = ['company_gst_numbers'];

async function main() {
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL이 필요합니다.');
    process.exit(1);
  }

  const sequelize = new Sequelize(DATABASE_URL, {
    logging: false,
    dialect: 'postgres',
    dialectOptions: getPostgresDialectOptions(DATABASE_URL),
  });

  try {
    await sequelize.authenticate();
    console.log('✅ DB 연결 성공\n');

    const migrationsPath = join(__dirname, '..', 'migrations');
    const allFiles = readdirSync(migrationsPath)
      .filter((f) => f.endsWith('.js'))
      .sort();

    let executedNames = [];
    try {
      const [rows] = await sequelize.query('SELECT name FROM "SequelizeMeta" ORDER BY name');
      executedNames = rows.map((r) => r.name);
    } catch {
      console.warn('⚠️ SequelizeMeta 테이블 없음 — 마이그레이션이 한 번도 실행되지 않았을 수 있습니다.\n');
    }

    const pending = allFiles.filter((f) => !executedNames.includes(f.replace('.js', '')));

    console.log(`📋 마이그레이션 파일: ${allFiles.length}개`);
    console.log(`✅ SequelizeMeta 기록: ${executedNames.length}개`);
    console.log(`⏳ 미적용: ${pending.length}개\n`);

    if (pending.length === 0) {
      console.log('🎉 모든 마이그레이션이 SequelizeMeta에 기록되어 있습니다.\n');
    } else {
      console.log('--- 미적용 마이그레이션 목록 ---');
      for (const file of pending) {
        console.log(`  - ${file}`);
      }
      console.log('');
    }

    console.log('--- 핵심 컬럼 존재 여부 ---');
    for (const { table, column } of CRITICAL_COLUMNS) {
      const [rows] = await sequelize.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
        { bind: [table, column] }
      );
      const ok = rows.length > 0;
      console.log(`  ${ok ? '✅' : '❌'} ${table}.${column}`);
    }

    console.log('\n--- 선택적 테이블 (없어도 핵심 기능 가능) ---');
    for (const table of OPTIONAL_TABLES) {
      const [rows] = await sequelize.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1`,
        { bind: [table] }
      );
      const ok = rows.length > 0;
      console.log(`  ${ok ? '✅' : '⏭️ '} ${table}${ok ? '' : ' (없음 — GST 기능·성능 인덱스 마이그레이션만 영향)'}`);
    }

    if (pending.includes('20260602120000-add-performance-indexes.js')) {
      console.log('\nℹ️  20260602120000-add-performance-indexes.js');
      console.log('   → company_gst_numbers 테이블 없으면 스킵됩니다. users 인덱스는 별도 적용 가능.');
    }

    console.log('\n--- Railway Console에서 재확인 ---');
    console.log('  cd /app && node scripts/check-migration-status.cjs');
  } finally {
    await sequelize.close();
  }
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
