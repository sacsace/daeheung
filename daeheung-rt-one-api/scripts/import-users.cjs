/**
 * JSON 사용자 → 대상 DB upsert (userid 기준)
 * 사용: node scripts/import-users.cjs [json경로] [--tenant=1]
 */
const { Sequelize } = require('sequelize');
const { readFileSync, existsSync } = require('fs');
const { resolve, join } = require('path');
const { config } = require('dotenv');
const { getPostgresDialectOptions } = require('./postgres-dialect-options.cjs');

config();

const tenantId = Number(process.argv.find((a) => a.startsWith('--tenant='))?.split('=')[1] || 1);
const inPath = resolve(
  process.argv.find((a) => !a.startsWith('--') && a.endsWith('.json')) ||
    join(__dirname, '..', 'data', 'users-dev-export.json')
);

if (!existsSync(inPath)) {
  console.error('❌ JSON 파일 없음:', inPath);
  process.exit(1);
}

const databaseUrl = process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ TARGET_DATABASE_URL 또는 DATABASE_URL 필요');
  process.exit(1);
}

const sequelize = new Sequelize(databaseUrl, {
  logging: console.log,
  dialect: 'postgres',
  dialectOptions: getPostgresDialectOptions(databaseUrl),
});

let raw = readFileSync(inPath, 'utf8');
if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
const payload = JSON.parse(raw);
const sourceUsers = payload.users || [];

const UPSERT_FIELDS = [
  'username', 'email', 'password_hash', 'role', 'department', 'department_id',
  'position', 'status', 'employee_number', 'phone', 'hire_date',
  'employment_type', 'is_payment_officer', 'settings',
];

async function resolveDepartmentId(departmentId, departmentName) {
  if (departmentId != null) {
    const [rows] = await sequelize.query(
      `SELECT id FROM departments WHERE id = $1::int LIMIT 1`,
      { bind: [departmentId] }
    );
    if (rows.length) return departmentId;
  }
  if (departmentName) {
    const [byName] = await sequelize.query(
      `SELECT id FROM departments WHERE tenant_id = $1::int AND name = $2::varchar LIMIT 1`,
      { bind: [tenantId, departmentName] }
    );
    if (byName.length) return byName[0].id;
  }
  return null;
}

async function upsertUser(user) {
  const [existing] = await sequelize.query(
    `SELECT id FROM users WHERE tenant_id = $1::int AND userid = $2::varchar LIMIT 1`,
    { bind: [tenantId, user.userid] }
  );

  const companyId = user.company_id || 1;
  const safeUser = {
    ...user,
    department_id: await resolveDepartmentId(user.department_id, user.department),
  };
  const values = UPSERT_FIELDS.map((f) => safeUser[f] ?? null);

  if (existing.length) {
    const setClause = UPSERT_FIELDS.map((f, i) => `${f} = $${i + 3}`).join(', ');
    await sequelize.query(
      `UPDATE users SET ${setClause}, updated_at = NOW() WHERE tenant_id = $1::int AND userid = $2::varchar`,
      { bind: [tenantId, user.userid, ...values] }
    );
    return 'updated';
  }

  const cols = ['tenant_id', 'company_id', 'userid', ...UPSERT_FIELDS];
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  await sequelize.query(
    `INSERT INTO users (${cols.join(', ')}, created_at, updated_at)
     VALUES (${placeholders}, NOW(), NOW())`,
    { bind: [tenantId, companyId, user.userid, ...values] }
  );
  return 'inserted';
}

async function main() {
  await sequelize.authenticate();
  console.log(`📥 users import: ${inPath} → tenant ${tenantId}`);

  let inserted = 0;
  let updated = 0;
  for (const user of sourceUsers) {
    const result = await upsertUser(user);
    if (result === 'inserted') inserted++;
    else updated++;
    console.log(`  ✓ ${user.userid} (${result})`);
  }

  console.log(`🎉 사용자 반영 완료 — 추가 ${inserted}, 수정 ${updated}`);
  await sequelize.close();
}

main().catch((err) => {
  console.error('❌ import-users 실패:', err.message);
  console.error(err);
  process.exit(1);
});
