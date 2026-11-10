/**
 * 로컬(개발) DB에서 departments JSON 추출
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
  process.argv.find((a) => a.endsWith('.json')) || join(__dirname, '..', 'data', 'departments-dev-export.json')
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
  const [departments] = await sequelize.query(
    `SELECT id, tenant_id, company_id, name, code, parent_id, manager_id, description, is_active
     FROM departments WHERE tenant_id = $1 ORDER BY id`,
    { bind: [tenantId] }
  );

  const payload = { exported_at: new Date().toISOString(), tenant_id: tenantId, departments };
  mkdirSync(join(outPath, '..'), { recursive: true });
  writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`📦 부서 ${departments.length}건 → ${outPath}`);
  await sequelize.close();
}

main().catch((err) => {
  console.error('❌ export-departments 실패:', err.message);
  process.exit(1);
});
