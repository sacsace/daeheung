'use strict';

/**
 * Remove 고객 정보 (/customers/info) menu permanently (merged into Partners / Customers).
 * Also copy menu_permissions from the old customer menu onto partners when missing.
 */
module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;

    const [customerMenus] = await sequelize.query(`
      SELECT id, tenant_id FROM menus WHERE route = '/customers/info'
    `);

    for (const menu of customerMenus) {
      const tenantId = menu.tenant_id;
      const customerMenuId = menu.id;

      const [[partnerMenu]] = await sequelize.query(
        `SELECT id FROM menus
         WHERE tenant_id = $1 AND route = '/basic-info/partners' AND is_active = true
         LIMIT 1`,
        { bind: [tenantId] }
      );

      if (partnerMenu?.id) {
        // Ensure partner menu has at least the same role permissions as old customer menu
        await sequelize.query(
          `
          INSERT INTO menu_permissions (
            tenant_id, menu_id, role_id, can_view, can_create, can_edit, can_delete, created_at, updated_at
          )
          SELECT
            mp.tenant_id,
            $1,
            mp.role_id,
            mp.can_view,
            mp.can_create,
            mp.can_edit,
            mp.can_delete,
            NOW(),
            NOW()
          FROM menu_permissions mp
          WHERE mp.menu_id = $2
            AND NOT EXISTS (
              SELECT 1 FROM menu_permissions x
              WHERE x.menu_id = $1 AND x.role_id = mp.role_id AND x.tenant_id = mp.tenant_id
            )
          `,
          { bind: [partnerMenu.id, customerMenuId] }
        ).catch(() => undefined);

        // Copy per-user permissions onto partners when missing
        await sequelize.query(
          `
          INSERT INTO user_permissions (
            user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at
          )
          SELECT
            up.user_id,
            $1,
            up.can_view,
            up.can_create,
            up.can_edit,
            up.can_delete,
            NOW(),
            NOW()
          FROM user_permissions up
          WHERE up.menu_id = $2
            AND NOT EXISTS (
              SELECT 1 FROM user_permissions x
              WHERE x.user_id = up.user_id AND x.menu_id = $1
            )
          `,
          { bind: [partnerMenu.id, customerMenuId] }
        ).catch(() => undefined);
      }

      await sequelize.query(`DELETE FROM user_permissions WHERE menu_id = $1`, {
        bind: [customerMenuId],
      });

      await sequelize.query(`DELETE FROM menu_permissions WHERE menu_id = $1`, {
        bind: [customerMenuId],
      }).catch(() => undefined);

      await sequelize.query(`DELETE FROM menus WHERE id = $1`, {
        bind: [customerMenuId],
      });
    }

    // Rename again in case earlier migration was skipped on some envs
    await sequelize.query(`
      UPDATE menus
      SET name_ko = '파트너 업체/고객 관리',
          name_en = 'Partners / Customers',
          description = '파트너 업체 및 고객 정보 통합 관리',
          updated_at = NOW()
      WHERE route = '/basic-info/partners'
    `);
  },

  async down(queryInterface) {
    // Recreate a disabled stub only — full restore is not supported after merge
    const [tenants] = await queryInterface.sequelize.query(`
      SELECT DISTINCT tenant_id FROM menus WHERE route = '/basic-info' AND parent_id IS NULL
    `);
    for (const { tenant_id: tenantId } of tenants) {
      const [[basicParent]] = await queryInterface.sequelize.query(
        `SELECT id FROM menus
         WHERE tenant_id = $1 AND route = '/basic-info' AND parent_id IS NULL
         LIMIT 1`,
        { bind: [tenantId] }
      );
      if (!basicParent?.id) continue;

      await queryInterface.sequelize.query(
        `
        INSERT INTO menus (
          tenant_id, parent_id, name_ko, name_en, route, icon, "order", level, is_active, description, created_at, updated_at
        )
        SELECT $1, $2, '고객 정보', 'Customer Info', '/customers/info', 'people', 90, 2, false,
               'Restored stub (inactive)', NOW(), NOW()
        WHERE NOT EXISTS (
          SELECT 1 FROM menus WHERE tenant_id = $1 AND route = '/customers/info'
        )
        `,
        { bind: [tenantId, basicParent.id] }
      );
    }
  },
};
