'use strict';

/** 회계장부 단일 메뉴로 통합, 기존 4개 GL 메뉴 비활성화 */
module.exports = {
  async up(queryInterface) {
    const [parents] = await queryInterface.sequelize.query(`
      SELECT id, tenant_id FROM menus WHERE route = '/accounting' AND parent_id IS NULL AND is_active = true
    `);

    for (const parent of parents) {
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM menus WHERE tenant_id = $1 AND route = '/accounting/books' LIMIT 1`,
        { bind: [parent.tenant_id] }
      );

      let booksId = existing[0]?.id;
      if (!booksId) {
        const [inserted] = await queryInterface.sequelize.query(
          `
          INSERT INTO menus (
            tenant_id, parent_id, name_ko, name_en, route, icon, "order", level, is_active, description, created_at, updated_at
          ) VALUES ($1, $2, '회계장부', 'General Ledger', '/accounting/books', 'menu_book', 2, 2, true, '전표·장부·시산표·계정', NOW(), NOW())
          RETURNING id
          `,
          { bind: [parent.tenant_id, parent.id] }
        );
        booksId = inserted[0].id;
      } else {
        await queryInterface.sequelize.query(
          `UPDATE menus SET name_ko = '회계장부', is_active = true, "order" = 2, updated_at = NOW() WHERE id = $1`,
          { bind: [booksId] }
        );
      }

      await queryInterface.sequelize.query(
        `
        UPDATE menus SET is_active = false, updated_at = NOW()
        WHERE tenant_id = $1 AND parent_id = $2
          AND route IN (
            '/accounting/chart-of-accounts',
            '/accounting/vouchers',
            '/accounting/ledger',
            '/accounting/trial-balance'
          )
        `,
        { bind: [parent.tenant_id, parent.id] }
      );

      const reorder = [
        ['/accounting/basic-info', 1],
        ['/accounting/books', 2],
        ['/accounting/auto-voucher', 3],
        ['/accounting/expense', 4],
        ['/accounting/budget', 5],
        ['/accounting/assets', 6],
        ['/accounting/statistics', 7],
      ];
      for (const [route, order] of reorder) {
        await queryInterface.sequelize.query(
          `UPDATE menus SET "order" = $1, updated_at = NOW() WHERE tenant_id = $2 AND route = $3`,
          { bind: [order, parent.tenant_id, route] }
        );
      }

      const oldRoutes = [
        '/accounting/chart-of-accounts',
        '/accounting/vouchers',
        '/accounting/ledger',
        '/accounting/trial-balance',
      ];
      const [oldMenus] = await queryInterface.sequelize.query(
        `SELECT id FROM menus WHERE tenant_id = $1 AND route = ANY($2::varchar[])`,
        { bind: [parent.tenant_id, oldRoutes] }
      );
      const oldIds = oldMenus.map((m) => m.id);

      if (oldIds.length) {
        await queryInterface.sequelize.query(
          `
          INSERT INTO user_permissions (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
          SELECT DISTINCT u.user_id, $1::int, true, u.can_create, u.can_edit, u.can_delete, NOW(), NOW()
          FROM user_permissions u
          WHERE u.menu_id = ANY($2::int[])
            AND u.can_view = true
            AND NOT EXISTS (SELECT 1 FROM user_permissions p WHERE p.user_id = u.user_id AND p.menu_id = $1::int)
          `,
          { bind: [booksId, oldIds] }
        );
      }
    }
  },

  async down() {},
};
