/**
 * 개발 DB → JSON 메뉴·권한보내기
 * 사용: node scripts/export-menus.cjs [출력경로] [--tenant=1]
 */

const { Sequelize } = require('sequelize');
const { writeFileSync, mkdirSync } = require('fs');
const { join, resolve } = require('path');
const { config } = require('dotenv');
const { getPostgresDialectOptions } = require('./postgres-dialect-options.cjs');

const envDev = join(__dirname, '..', 'env.development');
config({ path: envDev, override: false });
config({ path: join(__dirname, '..', '.env'), override: false });
config({ path: join(__dirname, '..', '..', '.env'), override: false });

const tenantId = Number(process.argv.find((a) => a.startsWith('--tenant='))?.split('=')[1] || 1);
const outArg = process.argv.find((a) => !a.startsWith('--') && a.endsWith('.json'));
const outPath = resolve(outArg || join(__dirname, '..', 'data', 'menus-dev-export.json'));

const databaseUrl = process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL;
const sequelize = databaseUrl
  ? new Sequelize(databaseUrl, {
      logging: false,
      dialect: 'postgres',
      dialectOptions: getPostgresDialectOptions(databaseUrl),
    })
  : new Sequelize({
      dialect: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || 'daeheung_rt_one',
      username: process.env.DB_USER || 'daeheung_rt_one',
      password: process.env.DB_PASSWORD || '',
      logging: false,
    });

async function main() {
  await sequelize.authenticate();
  console.log('✅ 소스 DB 연결');

  const [menus] = await sequelize.query(
    `SELECT id, tenant_id, parent_id, name_ko, name_en, route, icon, "order", level,
            is_active, description, created_at, updated_at
     FROM menus WHERE tenant_id = $1 ORDER BY "order", id`,
    { bind: [tenantId] }
  );

  const [permissions] = await sequelize.query(
    `SELECT up.user_id, u.userid, up.menu_id, m.route AS menu_route,
            up.can_view, up.can_create, up.can_edit, up.can_delete
     FROM user_permissions up
     JOIN menus m ON m.id = up.menu_id
     JOIN users u ON u.id = up.user_id
     WHERE m.tenant_id = $1
     ORDER BY u.userid, m.route`,
    { bind: [tenantId] }
  );

  const payload = {
    exported_at: new Date().toISOString(),
    tenant_id: tenantId,
    menus,
    permissions,
  };

  mkdirSync(join(outPath, '..'), { recursive: true });
  writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`📦 메뉴 ${menus.length}건, 권한 ${permissions.length}건 → ${outPath}`);
  await sequelize.close();
}

main().catch((err) => {
  console.error('❌ export 실패:', err.message);
  process.exit(1);
});
