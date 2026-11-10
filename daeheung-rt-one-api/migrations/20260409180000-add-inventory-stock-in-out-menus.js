/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

/** 재고 관리 하위: 입고 관리 · 출고 관리 메뉴 */
module.exports = {
  async up(queryInterface) {
    const [parents] = await queryInterface.sequelize.query(`
      SELECT id, tenant_id
      FROM menus
      WHERE route = '/inventory' AND parent_id IS NULL
    `);

    for (const row of parents) {
      const parentId = row.id;
      const tenantId = row.tenant_id;

      const routes = [
        {
          route: '/inventory/stock-in',
          name_ko: '입고 관리',
          name_en: 'Stock In',
          icon: 'move_to_inbox',
          description: '바코드 입고'
        },
        {
          route: '/inventory/stock-out',
          name_ko: '출고 관리',
          name_en: 'Stock Out',
          icon: 'qr_code_scanner',
          description: '바코드 출고'
        }
      ];

      for (const menu of routes) {
        const [existing] = await queryInterface.sequelize.query(
          `SELECT id FROM menus WHERE tenant_id = $1 AND route = $2`,
          { bind: [tenantId, menu.route] }
        );
        if (existing.length > 0) continue;

        const [orderRows] = await queryInterface.sequelize.query(
          `SELECT COALESCE(MAX("order"), 0) AS max_order FROM menus WHERE tenant_id = $1 AND parent_id = $2`,
          { bind: [tenantId, parentId] }
        );
        const nextOrder = Number(orderRows?.[0]?.max_order ?? 0) + 1;

        await queryInterface.sequelize.query(
          `
          INSERT INTO menus (
            tenant_id, parent_id, name_ko, name_en, route, icon, "order", level, is_active, description, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, 1, true, $8, NOW(), NOW()
          )
          `,
          {
            bind: [
              tenantId,
              parentId,
              menu.name_ko,
              menu.name_en,
              menu.route,
              menu.icon,
              nextOrder,
              menu.description
            ]
          }
        );
      }

      const [newMenuRows] = await queryInterface.sequelize.query(
        `SELECT id FROM menus WHERE tenant_id = $1 AND route IN ('/inventory/stock-in', '/inventory/stock-out')`,
        { bind: [tenantId] }
      );
      for (const m of newMenuRows) {
        const menuId = m.id;
        await queryInterface.sequelize.query(
          `
          INSERT INTO user_permissions (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
          SELECT u.id, $1, true, true, true, false, NOW(), NOW()
          FROM users u
          WHERE u.tenant_id = $2 AND u.role = 'admin'
          AND NOT EXISTS (
            SELECT 1 FROM user_permissions p WHERE p.user_id = u.id AND p.menu_id = $1
          )
          `,
          { bind: [menuId, tenantId] }
        );
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM user_permissions WHERE menu_id IN (
        SELECT id FROM menus WHERE route IN ('/inventory/stock-in', '/inventory/stock-out')
      )
    `);
    await queryInterface.sequelize.query(`
      DELETE FROM menus WHERE route IN ('/inventory/stock-in', '/inventory/stock-out')
    `);
  }
};
