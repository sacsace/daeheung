/**
 * JSON 메뉴·권한 → 운영(또는 대상) DB 반영
 * - route 기준 upsert (id 재매핑)
 * - user_permissions는 userid + menu_route 기준 동기화
 *
 * 사용: node scripts/import-menus.cjs [json경로] [--tenant=1] [--sync-permissions]
 */

const { Sequelize } = require('sequelize');
const { readFileSync, existsSync } = require('fs');
const { resolve, join } = require('path');
const { config } = require('dotenv');
const { getPostgresDialectOptions } = require('./postgres-dialect-options.cjs');

config();

const tenantId = Number(process.argv.find((a) => a.startsWith('--tenant='))?.split('=')[1] || 1);
const syncPermissions = process.argv.includes('--sync-permissions');
const inArg = process.argv.find((a) => !a.startsWith('--') && a.endsWith('.json'));
const inPath = resolve(inArg || join(__dirname, '..', 'data', 'menus-dev-export.json'));

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
const sourceMenus = payload.menus || [];

/** 부모가 먼저 insert 되도록 정렬 */
function sortMenusForImport(menus) {
  const byRoute = new Map(menus.map((m) => [m.route, m]));
  const depth = (route) => {
    let d = 0;
    let cur = byRoute.get(route);
    const guard = new Set();
    while (cur?.parent_id != null) {
      const parent = menus.find((x) => x.id === cur.parent_id);
      if (!parent || guard.has(parent.route)) break;
      guard.add(parent.route);
      d++;
      cur = parent;
    }
    return d;
  };
  return [...menus].sort((a, b) => {
    const da = depth(a.route);
    const db = depth(b.route);
    if (da !== db) return da - db;
    return (Number(a.order) || 0) - (Number(b.order) || 0);
  });
}

async function upsertMenu(menu, routeToId) {
  let parentId = null;
  if (menu.parent_id != null) {
    const parent = sourceMenus.find((m) => m.id === menu.parent_id);
    if (parent) parentId = routeToId.get(parent.route) ?? null;
  }

  const [rows] = await sequelize.query(
    `SELECT id FROM menus WHERE tenant_id = $1::int AND route = $2::varchar LIMIT 1`,
    { bind: [tenantId, menu.route] }
  );
  const existing = rows[0];

  if (existing) {
    await sequelize.query(
      `UPDATE menus SET
         parent_id = $2::int, name_ko = $3::varchar, name_en = $4::varchar, icon = $5::varchar,
         "order" = $6::numeric, level = $7::int, is_active = $8::boolean,
         description = $9::text, updated_at = NOW()
       WHERE id = $1::int`,
      {
        bind: [
          existing.id,
          parentId,
          menu.name_ko,
          menu.name_en,
          menu.icon || '',
          menu.order ?? 0,
          menu.level ?? 0,
          menu.is_active !== false,
          menu.description || null,
        ],
      }
    );
    return existing.id;
  }

  const [inserted] = await sequelize.query(
    `INSERT INTO menus (
       tenant_id, parent_id, name_ko, name_en, route, icon, "order", level, is_active, description, created_at, updated_at
     ) VALUES ($1::int, $2::int, $3::varchar, $4::varchar, $5::varchar, $6::varchar, $7::numeric, $8::int, $9::boolean, $10::text, NOW(), NOW())
     RETURNING id`,
    {
      bind: [
        tenantId,
        parentId,
        menu.name_ko,
        menu.name_en,
        menu.route,
        menu.icon || '',
        menu.order ?? 0,
        menu.level ?? 0,
        menu.is_active !== false,
        menu.description || null,
      ],
    }
  );
  return inserted[0].id;
}

async function syncPermissionsFromExport() {
  const perms = payload.permissions || [];
  if (!perms.length) return;

  const [users] = await sequelize.query(`SELECT id, userid FROM users WHERE tenant_id = $1`, {
    bind: [tenantId],
  });
  const userByUserid = new Map(users.map((u) => [u.userid, u.id]));

  const [menus] = await sequelize.query(
    `SELECT id, route FROM menus WHERE tenant_id = $1 AND is_active = true`,
    { bind: [tenantId] }
  );
  const menuByRoute = new Map(menus.map((m) => [m.route, m.id]));

  let count = 0;
  for (const p of perms) {
    const userId = userByUserid.get(p.userid);
    const menuId = menuByRoute.get(p.menu_route);
    if (!userId || !menuId) continue;

    const [existing] = await sequelize.query(
      `SELECT id FROM user_permissions WHERE user_id = $1::int AND menu_id = $2::int`,
      { bind: [userId, menuId] }
    );

    if (existing.length) {
      await sequelize.query(
        `UPDATE user_permissions SET can_view=$3, can_create=$4, can_edit=$5, can_delete=$6, updated_at=NOW()
         WHERE user_id=$1::int AND menu_id=$2::int`,
        { bind: [userId, menuId, p.can_view, p.can_create, p.can_edit, p.can_delete] }
      );
    } else {
      await sequelize.query(
        `INSERT INTO user_permissions (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
         VALUES ($1::int, $2::int, $3::boolean, $4::boolean, $5::boolean, $6::boolean, NOW(), NOW())`,
        { bind: [userId, menuId, p.can_view, p.can_create, p.can_edit, p.can_delete] }
      );
    }
    count++;
  }
  console.log(`✅ user_permissions ${count}건 동기화`);
}

async function main() {
  await sequelize.authenticate();
  console.log(`📥 import: ${inPath} → tenant ${tenantId}`);

  const routeToId = new Map();
  const sorted = sortMenusForImport(sourceMenus);

  for (const menu of sorted) {
    const newId = await upsertMenu(menu, routeToId);
    routeToId.set(menu.route, newId);
    console.log(`  ✓ ${menu.route}`);
  }

  /** 소스에 없는 메뉴 비활성화 (삭제 대신) */
  const sourceRoutes = sourceMenus.map((m) => m.route);
  await sequelize.query(
    `UPDATE menus SET is_active = false, updated_at = NOW()
     WHERE tenant_id = $1::int AND route <> ALL($2::varchar[]) AND is_active = true`,
    { bind: [tenantId, sourceRoutes] }
  );

  if (syncPermissions) {
    await syncPermissionsFromExport();
  }

  console.log(`🎉 메뉴 ${sorted.length}건 반영 완료`);
  await sequelize.close();
}

main().catch((err) => {
  console.error('❌ import 실패:', err.message);
  console.error(err);
  process.exit(1);
});
