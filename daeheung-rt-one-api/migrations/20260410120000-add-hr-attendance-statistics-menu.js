'use strict';

/** 인사관리 하위: 근태 통계 */
module.exports = {
  async up(queryInterface) {
    const [hrMenus] = await queryInterface.sequelize.query(`
      SELECT id, tenant_id
      FROM menus
      WHERE route = '/hr' AND level = 1
    `);

    for (const menu of hrMenus) {
      const [existing] = await queryInterface.sequelize.query(
        `
        SELECT id FROM menus
        WHERE tenant_id = $1 AND parent_id = $2 AND route = '/hr/attendance/statistics'
        `,
        { bind: [menu.tenant_id, menu.id] }
      );

      if (existing.length > 0) continue;

      const [orderRows] = await queryInterface.sequelize.query(
        `
        SELECT COALESCE(MAX("order"), 0) AS max_order
        FROM menus
        WHERE tenant_id = $1 AND parent_id = $2
        `,
        { bind: [menu.tenant_id, menu.id] }
      );

      const nextOrder = Number(orderRows?.[0]?.max_order ?? 0) + 1;

      await queryInterface.sequelize.query(
        `
        INSERT INTO menus (
          tenant_id, parent_id, name_ko, name_en, route, icon, "order", level, is_active, description, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, 2, true, $8, NOW(), NOW()
        )
        `,
        {
          bind: [
            menu.tenant_id,
            menu.id,
            '근태 통계',
            'Attendance statistics',
            '/hr/attendance/statistics',
            'assessment',
            nextOrder,
            '기간별 근태 집계'
          ]
        }
      );
    }

    const [newMenuRows] = await queryInterface.sequelize.query(`
      SELECT id, tenant_id FROM menus WHERE route = '/hr/attendance/statistics'
    `);

    for (const m of newMenuRows) {
      const menuId = m.id;
      const tenantId = m.tenant_id;
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
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM user_permissions WHERE menu_id IN (
        SELECT id FROM menus WHERE route = '/hr/attendance/statistics'
      )
    `);
    await queryInterface.sequelize.query(`
      DELETE FROM menus WHERE route = '/hr/attendance/statistics'
    `);
  }
};
