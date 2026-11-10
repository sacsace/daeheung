'use strict';

/** 회계 관리: 계정과목·전표·장부·시산표 메뉴 추가 */
module.exports = {
  async up(queryInterface) {
    const newMenus = [
      { route: '/accounting/chart-of-accounts', name_ko: '계정과목', name_en: 'Chart of Accounts', icon: 'account_tree', order: 2 },
      { route: '/accounting/vouchers', name_ko: '전표관리', name_en: 'Voucher Management', icon: 'receipt_long', order: 4 },
      { route: '/accounting/ledger', name_ko: '장부', name_en: 'Account Ledger', icon: 'menu_book', order: 5 },
      { route: '/accounting/trial-balance', name_ko: '시산표', name_en: 'Trial Balance', icon: 'balance', order: 6 },
    ];

    const reorder = [
      ['/accounting/basic-info', 1],
      ['/accounting/chart-of-accounts', 2],
      ['/accounting/auto-voucher', 3],
      ['/accounting/vouchers', 4],
      ['/accounting/ledger', 5],
      ['/accounting/trial-balance', 6],
      ['/accounting/expense', 7],
      ['/accounting/budget', 8],
      ['/accounting/assets', 9],
      ['/accounting/statistics', 10],
    ];

    const [parents] = await queryInterface.sequelize.query(`
      SELECT id, tenant_id FROM menus WHERE route = '/accounting' AND parent_id IS NULL AND is_active = true
    `);

    for (const parent of parents) {
      for (const menu of newMenus) {
        const [existing] = await queryInterface.sequelize.query(
          `SELECT id FROM menus WHERE tenant_id = $1 AND route = $2 LIMIT 1`,
          { bind: [parent.tenant_id, menu.route] }
        );
        if (existing.length > 0) continue;

        await queryInterface.sequelize.query(
          `
          INSERT INTO menus (
            tenant_id, parent_id, name_ko, name_en, route, icon, "order", level, is_active, description, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 2, true, NULL, NOW(), NOW())
          `,
          {
            bind: [
              parent.tenant_id,
              parent.id,
              menu.name_ko,
              menu.name_en,
              menu.route,
              menu.icon,
              menu.order,
            ],
          }
        );
      }

      for (const [route, order] of reorder) {
        await queryInterface.sequelize.query(
          `
          UPDATE menus SET "order" = $1, updated_at = NOW()
          WHERE tenant_id = $2 AND parent_id = $3 AND route = $4
          `,
          { bind: [order, parent.tenant_id, parent.id, route] }
        );
      }

      const [accountingMenus] = await queryInterface.sequelize.query(
        `SELECT id, route FROM menus WHERE tenant_id = $1 AND parent_id = $2 AND is_active = true`,
        { bind: [parent.tenant_id, parent.id] }
      );
      const accountingParentPerm = (
        await queryInterface.sequelize.query(
          `SELECT user_id, can_view, can_create, can_edit, can_delete FROM user_permissions WHERE menu_id = $1`,
          { bind: [parent.id] }
        )
      )[0];

      for (const m of accountingMenus) {
        for (const perm of accountingParentPerm) {
          await queryInterface.sequelize.query(
            `
            INSERT INTO user_permissions (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
            SELECT $1, $2, $3, $4, $5, $6, NOW(), NOW()
            WHERE NOT EXISTS (
              SELECT 1 FROM user_permissions p WHERE p.user_id = $1 AND p.menu_id = $2
            )
            `,
            {
              bind: [perm.user_id, m.id, perm.can_view, perm.can_create, perm.can_edit, perm.can_delete],
            }
          );
        }
      }
    }
  },

  async down(queryInterface) {
    const routes = [
      '/accounting/chart-of-accounts',
      '/accounting/vouchers',
      '/accounting/ledger',
      '/accounting/trial-balance',
    ];
    await queryInterface.sequelize.query(`
      DELETE FROM user_permissions WHERE menu_id IN (SELECT id FROM menus WHERE route IN (${routes.map((r) => `'${r}'`).join(',')}))
    `);
    await queryInterface.sequelize.query(`
      DELETE FROM menus WHERE route IN (${routes.map((r) => `'${r}'`).join(',')})
    `);
  },
};
