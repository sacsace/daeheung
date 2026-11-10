'use strict';

/** 회계 관리: 재무상태표 메뉴 추가 */
module.exports = {
  async up(queryInterface) {
    const [parents] = await queryInterface.sequelize.query(`
      SELECT id, tenant_id FROM menus WHERE route = '/accounting' AND parent_id IS NULL AND is_active = true
    `);

    for (const parent of parents) {
      const menu = {
        route: '/accounting/balance-sheet',
        name_ko: '재무상태표',
        name_en: 'Balance Sheet',
        icon: 'account_balance',
        order: 7,
        description: '자산·부채·자본 재무상태표',
      };

      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM menus WHERE tenant_id = $1 AND route = $2 LIMIT 1`,
        { bind: [parent.tenant_id, menu.route] }
      );

      let menuId = existing[0]?.id;
      if (!menuId) {
        const [inserted] = await queryInterface.sequelize.query(
          `INSERT INTO menus (tenant_id, parent_id, name_ko, name_en, route, icon, "order", level, is_active, description, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 2, true, $8, NOW(), NOW())
           RETURNING id`,
          {
            bind: [
              parent.tenant_id,
              parent.id,
              menu.name_ko,
              menu.name_en,
              menu.route,
              menu.icon,
              menu.order,
              menu.description,
            ],
          }
        );
        menuId = inserted[0].id;
      } else {
        await queryInterface.sequelize.query(
          `UPDATE menus SET name_ko = $1, name_en = $2, icon = $3, "order" = $4, description = $5, is_active = true, updated_at = NOW() WHERE id = $6`,
          {
            bind: [menu.name_ko, menu.name_en, menu.icon, menu.order, menu.description, menuId],
          }
        );
      }

      const [accountingParentPerm] = await queryInterface.sequelize.query(
        `SELECT user_id, can_view, can_create, can_edit, can_delete FROM user_permissions WHERE menu_id = $1`,
        { bind: [parent.id] }
      );

      for (const perm of accountingParentPerm) {
        await queryInterface.sequelize.query(
          `INSERT INTO user_permissions (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
           SELECT $1, $2, $3, $4, $5, $6, NOW(), NOW()
           WHERE NOT EXISTS (SELECT 1 FROM user_permissions p WHERE p.user_id = $1 AND p.menu_id = $2)`,
          {
            bind: [perm.user_id, menuId, perm.can_view, perm.can_create, perm.can_edit, perm.can_delete],
          }
        );
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM user_permissions WHERE menu_id IN (SELECT id FROM menus WHERE route = '/accounting/balance-sheet')
    `);
    await queryInterface.sequelize.query(`
      UPDATE menus SET is_active = false, updated_at = NOW() WHERE route = '/accounting/balance-sheet'
    `);
  },
};
