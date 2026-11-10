/**
 * JSON 부서 → 대상 DB upsert (name+company_id 기준, id 재매핑)
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
    join(__dirname, '..', 'data', 'departments-dev-export.json')
);

if (!existsSync(inPath)) {
  console.log('ℹ️  부서 JSON 없음 — 건너뜀');
  process.exit(0);
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
const departments = payload.departments || [];

async function upsertDepartment(dept) {
  const companyId = dept.company_id || 1;
  const [existing] = await sequelize.query(
    `SELECT id FROM departments WHERE tenant_id = $1::int AND company_id = $2::int AND name = $3::varchar LIMIT 1`,
    { bind: [tenantId, companyId, dept.name] }
  );

  if (existing.length) {
    await sequelize.query(
      `UPDATE departments SET code = $2, parent_id = $3, manager_id = $4, description = $5,
              is_active = $6, updated_at = NOW()
       WHERE id = $1::int`,
      {
        bind: [
          existing[0].id,
          dept.code ?? null,
          dept.parent_id ?? null,
          dept.manager_id ?? null,
          dept.description ?? null,
          dept.is_active !== false,
        ],
      }
    );
    return existing[0].id;
  }

  const [inserted] = await sequelize.query(
    `INSERT INTO departments (tenant_id, company_id, name, code, parent_id, manager_id, description, is_active, created_at, updated_at)
     VALUES ($1::int, $2::int, $3::varchar, $4::varchar, $5::int, $6::int, $7::text, $8::boolean, NOW(), NOW())
     RETURNING id`,
    {
      bind: [
        tenantId,
        companyId,
        dept.name,
        dept.code ?? null,
        dept.parent_id ?? null,
        dept.manager_id ?? null,
        dept.description ?? null,
        dept.is_active !== false,
      ],
    }
  );
  return inserted[0].id;
}

async function main() {
  await sequelize.authenticate();
  console.log(`📥 departments import: ${inPath} → tenant ${tenantId}`);

  for (const dept of departments) {
    const id = await upsertDepartment(dept);
    console.log(`  ✓ ${dept.name} → id ${id}`);
  }

  console.log(`🎉 부서 ${departments.length}건 반영 완료`);
  await sequelize.close();
}

main().catch((err) => {
  console.error('❌ import-departments 실패:', err.message);
  process.exit(1);
});
