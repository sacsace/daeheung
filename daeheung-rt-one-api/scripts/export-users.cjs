/**
 * 로컬(개발) DB에서 사용자 JSON 추출
 * DATABASE_URL 또는 env.development DB_* 사용
 */
const { Sequelize } = require('sequelize');
const { writeFileSync, mkdirSync } = require('fs');
const { join, resolve } = require('path');
const { config } = require('dotenv');
const { getPostgresDialectOptions } = require('./postgres-dialect-options.cjs');

config({ path: resolve(__dirname, '..', 'env.development') });
config();

const tenantId = Number(process.argv.find((a) => a.startsWith('--tenant='))?.split('=')[1] || 1);
const outPath = resolve(
  process.argv.find((a) => a.endsWith('.json')) || join(__dirname, '..', 'data', 'users-dev-export.json')
);

function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const name = process.env.DB_NAME || 'daeheung_rt_one';
  const user = process.env.DB_USER || 'daeheung_rt_one';
  const pass = encodeURIComponent(process.env.DB_PASSWORD || '');
  return `postgresql://${user}:${pass}@${host}:${port}/${name}`;
}

const sequelize = new Sequelize(buildDatabaseUrl(), {
  logging: false,
  dialect: 'postgres',
  dialectOptions: getPostgresDialectOptions(buildDatabaseUrl()),
});

async function main() {
  await sequelize.authenticate();

  const [users] = await sequelize.query(
    `SELECT id, tenant_id, company_id, userid, username, email, password_hash, role,
            department, department_id, position, status, employee_number, phone,
            hire_date, employment_type, is_payment_officer, settings
     FROM users WHERE tenant_id = $1 ORDER BY id`,
    { bind: [tenantId] }
  );

  const payload = {
    exported_at: new Date().toISOString(),
    tenant_id: tenantId,
    users,
  };

  mkdirSync(join(outPath, '..'), { recursive: true });
  writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`📦 사용자 ${users.length}건 → ${outPath}`);
  await sequelize.close();
}

main().catch((err) => {
  console.error('❌ export-users 실패:', err.message);
  process.exit(1);
});
