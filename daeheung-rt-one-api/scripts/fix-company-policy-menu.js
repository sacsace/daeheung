const { Client } = require('pg');

const c = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'daeheung_rt_one',
  user: process.env.DB_USER || 'daeheung_rt_one',
  password: process.env.DB_PASSWORD || 'Korean@2026',
});

(async () => {
  await c.connect();
  const menu = await c.query(
    `SELECT id, name_ko, route, parent_id, "order", is_active
     FROM menus WHERE route = '/my/company-policies'`
  );
  console.log('menu', menu.rows);

  const meta = await c.query(
    `SELECT name FROM "SequelizeMeta" WHERE name LIKE '%company-policies%'`
  );
  console.log('meta', meta.rows);

  const tables = await c.query(
    `SELECT to_regclass('public.company_policies') AS policies,
            to_regclass('public.company_policy_revisions') AS revisions`
  );
  console.log('tables', tables.rows[0]);

  // grant permissions if menu exists
  if (menu.rows[0]) {
    const menuId = menu.rows[0].id;
    const grant = await c.query(
      `INSERT INTO user_permissions (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
       SELECT DISTINCT up.user_id, $1::integer, true, false, false, false, NOW(), NOW()
       FROM user_permissions up
       JOIN menus m ON m.id = up.menu_id
       JOIN users u ON u.id = up.user_id
       WHERE m.route IN (
         '/my', '/dashboard', '/my/personal-info', '/my/attendance', '/my/leave',
         '/my/payslips', '/my/contracts', '/my/notices', '/my/work-list', '/my/mail-settings'
       )
         AND up.can_view = true
         AND NOT EXISTS (
           SELECT 1 FROM user_permissions x WHERE x.user_id = up.user_id AND x.menu_id = $1::integer
         )
       RETURNING user_id`,
      [menuId]
    );
    console.log('granted_view', grant.rowCount);

    const adminGrant = await c.query(
      `UPDATE user_permissions up
       SET can_edit = true, can_create = true, updated_at = NOW()
       FROM users u
       WHERE up.user_id = u.id
         AND up.menu_id = $1::integer
         AND u.role IN ('admin', 'root')
       RETURNING up.user_id`,
      [menuId]
    );
    console.log('granted_edit_admin', adminGrant.rowCount);

    // ensure SequelizeMeta has migration if tables exist
    if (tables.rows[0].policies) {
      await c.query(
        `INSERT INTO "SequelizeMeta" (name)
         SELECT '20260906120000-create-company-policies.js'
         WHERE NOT EXISTS (
           SELECT 1 FROM "SequelizeMeta" WHERE name = '20260906120000-create-company-policies.js'
         )`
      );
      console.log('meta ensured');
    }
  }

  await c.end();
})().catch(async (e) => {
  console.error(e);
  try { await c.end(); } catch {}
  process.exit(1);
});
