'use strict';

/** 계정과목 전용 메뉴 복원 */
module.exports = {
  async up(queryInterface) {
    const [parents] = await queryInterface.sequelize.query(`
      SELECT id, tenant_id FROM menus WHERE route = '/accounting' AND parent_id IS NULL AND is_active = true
    `);

    for (const parent of parents) {
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM menus WHERE tenant_id = $1 AND route = '/accounting/chart-of-accounts' LIMIT 1`,
        { bind: [parent.tenant_id] }
      );

      let chartId = existing[0]?.id;
      if (!chartId) {
        const [inserted] = await queryInterface.sequelize.query(
          `
          INSERT INTO menus (
            tenant_id, parent_id, name_ko, name_en, route, icon, "order", level, is_active, description, created_at, updated_at
          ) VALUES ($1, $2, '계정과목', 'Chart of Accounts', '/accounting/chart-of-accounts', 'account_tree', 3, 2, true, '회사별 계정과목 등록·수정·삭제', NOW(), NOW())
          RETURNING id
          `,
          { bind: [parent.tenant_id, parent.id] }
        );
        chartId = inserted[0].id;
      } else {
        await queryInterface.sequelize.query(
          `
          UPDATE menus
          SET is_active = true, name_ko = '계정과목', name_en = 'Chart of Accounts',
              icon = 'account_tree', "order" = 3, level = 2,
              description = '회사별 계정과목 등록·수정·삭제', updated_at = NOW()
          WHERE id = $1
          `,
          { bind: [chartId] }
        );
      }

      const reorder = [
        ['/accounting/basic-info', 1],
        ['/accounting/books', 2],
        ['/accounting/chart-of-accounts', 3],
        ['/accounting/auto-voucher', 4],
        ['/accounting/expense', 5],
        ['/accounting/budget', 6],
        ['/accounting/assets', 7],
        ['/accounting/statistics', 8],
      ];
      for (const [route, order] of reorder) {
        await queryInterface.sequelize.query(
          `UPDATE menus SET "order" = $1, updated_at = NOW() WHERE tenant_id = $2 AND route = $3`,
          { bind: [order, parent.tenant_id, route] }
        );
      }

      const [booksMenus] = await queryInterface.sequelize.query(
        `SELECT id FROM menus WHERE tenant_id = $1 AND route = '/accounting/books' LIMIT 1`,
        { bind: [parent.tenant_id] }
      );
      const booksId = booksMenus[0]?.id;
      if (booksId && chartId) {
        await queryInterface.sequelize.query(
          `
          INSERT INTO user_permissions (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
          SELECT DISTINCT u.user_id, $1::int, true, u.can_create, u.can_edit, u.can_delete, NOW(), NOW()
          FROM user_permissions u
          WHERE u.menu_id = $2::int
            AND u.can_view = true
            AND NOT EXISTS (SELECT 1 FROM user_permissions p WHERE p.user_id = u.user_id AND p.menu_id = $1::int)
          `,
          { bind: [chartId, booksId] }
        );
      }
    }
  },

  async down(queryInterface) {
    const [parents] = await queryInterface.sequelize.query(`
      SELECT id, tenant_id FROM menus WHERE route = '/accounting' AND parent_id IS NULL
    `);
    for (const parent of parents) {
      await queryInterface.sequelize.query(
        `UPDATE menus SET is_active = false, updated_at = NOW() WHERE tenant_id = $1 AND route = '/accounting/chart-of-accounts'`,
        { bind: [parent.tenant_id] }
      );
    }
  },
};
