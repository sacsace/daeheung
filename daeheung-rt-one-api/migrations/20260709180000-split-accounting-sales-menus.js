'use strict';

/**
 * 회계관리 / 고객관리 메뉴를 「회계 관리」「매출 관리」로 재구성
 * - 매출 관리(/sales): 고객·계약·견적·세금계산서·운송장
 * - 회계 관리(/accounting): 기본정보·전표입력·지출·예산·자산·통계
 */
module.exports = {
  async up(queryInterface) {
    const SALES_CHILD_ROUTES = [
      { route: '/customers/info', order: 1 },
      { route: '/customers/contracts', order: 2 },
      { route: '/accounting/quotation', order: 3 },
      { route: '/accounting/e-invoice', order: 4 },
      { route: '/accounting/invoice', order: 5 },
      { route: '/accounting/eway-bill', order: 6 },
    ];

    const ACCOUNTING_CHILD_ROUTES = [
      { route: '/accounting/basic-info', order: 1 },
      { route: '/accounting/auto-voucher', order: 2, insert: true },
      { route: '/accounting/expense', order: 3 },
      { route: '/accounting/budget', order: 4 },
      { route: '/accounting/assets', order: 5 },
      { route: '/accounting/statistics', order: 6 },
    ];

    const [tenants] = await queryInterface.sequelize.query(`
      SELECT DISTINCT tenant_id FROM menus WHERE route IN ('/accounting', '/customers')
    `);

    for (const { tenant_id: tenantId } of tenants) {
      const [[accountingParent]] = await queryInterface.sequelize.query(
        `SELECT id FROM menus WHERE tenant_id = $1 AND route = '/accounting' AND parent_id IS NULL LIMIT 1`,
        { bind: [tenantId] }
      );
      if (!accountingParent?.id) continue;

      await queryInterface.sequelize.query(
        `
        UPDATE menus
        SET name_ko = '회계 관리', name_en = 'Accounting Management', updated_at = NOW()
        WHERE id = $1
        `,
        { bind: [accountingParent.id] }
      );

      let [[salesParent]] = await queryInterface.sequelize.query(
        `SELECT id FROM menus WHERE tenant_id = $1 AND route = '/sales' AND parent_id IS NULL LIMIT 1`,
        { bind: [tenantId] }
      );

      if (!salesParent?.id) {
        const [[customersParent]] = await queryInterface.sequelize.query(
          `SELECT id, "order", icon FROM menus WHERE tenant_id = $1 AND route = '/customers' AND parent_id IS NULL LIMIT 1`,
          { bind: [tenantId] }
        );

        const salesOrder = customersParent?.order ?? 5;

        const [inserted] = await queryInterface.sequelize.query(
          `
          INSERT INTO menus (
            tenant_id, parent_id, name_ko, name_en, route, icon, "order", level, is_active, description, created_at, updated_at
          ) VALUES (
            $1, NULL, '매출 관리', 'Sales Management', '/sales', 'trending_up', $2, 1, true, NULL, NOW(), NOW()
          )
          RETURNING id
          `,
          { bind: [tenantId, salesOrder] }
        );
        salesParent = { id: inserted[0].id };
      } else {
        await queryInterface.sequelize.query(
          `
          UPDATE menus
          SET name_ko = '매출 관리', name_en = 'Sales Management', icon = 'trending_up', is_active = true, updated_at = NOW()
          WHERE id = $1
          `,
          { bind: [salesParent.id] }
        );
      }

      const salesParentId = salesParent.id;
      const accountingParentId = accountingParent.id;

      for (const child of SALES_CHILD_ROUTES) {
        await queryInterface.sequelize.query(
          `
          UPDATE menus
          SET parent_id = $1, "order" = $2, level = 2, updated_at = NOW()
          WHERE tenant_id = $3 AND route = $4
          `,
          { bind: [salesParentId, child.order, tenantId, child.route] }
        );
      }

      for (const child of ACCOUNTING_CHILD_ROUTES) {
        if (child.insert) {
          const [existing] = await queryInterface.sequelize.query(
            `SELECT id FROM menus WHERE tenant_id = $1 AND route = $2 LIMIT 1`,
            { bind: [tenantId, child.route] }
          );
          if (existing.length === 0) {
            await queryInterface.sequelize.query(
              `
              INSERT INTO menus (
                tenant_id, parent_id, name_ko, name_en, route, icon, "order", level, is_active, description, created_at, updated_at
              ) VALUES (
                $1, $2, '전표입력', 'AI Auto Voucher', $3, 'receipt_long', $4, 2, true, 'AI 자동 전표 입력', NOW(), NOW()
              )
              `,
              { bind: [tenantId, accountingParentId, child.route, child.order] }
            );
          } else {
            await queryInterface.sequelize.query(
              `
              UPDATE menus
              SET parent_id = $1, "order" = $2, level = 2, is_active = true, updated_at = NOW()
              WHERE tenant_id = $3 AND route = $4
              `,
              { bind: [accountingParentId, child.order, tenantId, child.route] }
            );
          }
          continue;
        }

        await queryInterface.sequelize.query(
          `
          UPDATE menus
          SET parent_id = $1, "order" = $2, level = 2, updated_at = NOW()
          WHERE tenant_id = $3 AND route = $4
          `,
          { bind: [accountingParentId, child.order, tenantId, child.route] }
        );
      }

      await queryInterface.sequelize.query(
        `
        UPDATE menus
        SET is_active = false, updated_at = NOW()
        WHERE tenant_id = $1 AND route = '/customers' AND parent_id IS NULL
        `,
        { bind: [tenantId] }
      );

      const [[customersMenu]] = await queryInterface.sequelize.query(
        `SELECT id FROM menus WHERE tenant_id = $1 AND route = '/customers' AND parent_id IS NULL LIMIT 1`,
        { bind: [tenantId] }
      );

      if (customersMenu?.id) {
        await queryInterface.sequelize.query(
          `
          INSERT INTO user_permissions (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
          SELECT u.user_id, $1, u.can_view, u.can_create, u.can_edit, u.can_delete, NOW(), NOW()
          FROM user_permissions u
          WHERE u.menu_id = $2
            AND NOT EXISTS (
              SELECT 1 FROM user_permissions p
              WHERE p.user_id = u.user_id AND p.menu_id = $1
            )
          `,
          { bind: [salesParentId, customersMenu.id] }
        );
      }

      const salesChildIds = (
        await queryInterface.sequelize.query(
          `
          SELECT id FROM menus
          WHERE tenant_id = $1
            AND route IN (
              '/customers/info', '/customers/contracts',
              '/accounting/quotation', '/accounting/e-invoice', '/accounting/invoice', '/accounting/eway-bill'
            )
          `,
          { bind: [tenantId] }
        )
      )[0].map((row) => row.id);

      if (salesChildIds.length > 0) {
        await queryInterface.sequelize.query(
          `
          INSERT INTO user_permissions (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
          SELECT DISTINCT u.user_id, $1::int, true, u.can_create, u.can_edit, u.can_delete, NOW(), NOW()
          FROM user_permissions u
          WHERE u.menu_id = ANY($2::int[])
            AND u.can_view = true
            AND NOT EXISTS (
              SELECT 1 FROM user_permissions p
              WHERE p.user_id = u.user_id AND p.menu_id = $1::int
            )
          `,
          { bind: [salesParentId, salesChildIds] }
        );
      }
    }
  },

  async down(queryInterface) {
    const [tenants] = await queryInterface.sequelize.query(`
      SELECT DISTINCT tenant_id FROM menus WHERE route IN ('/accounting', '/sales', '/customers')
    `);

    for (const { tenant_id: tenantId } of tenants) {
      const [[accountingParent]] = await queryInterface.sequelize.query(
        `SELECT id FROM menus WHERE tenant_id = $1 AND route = '/accounting' AND parent_id IS NULL LIMIT 1`,
        { bind: [tenantId] }
      );
      const [[customersParent]] = await queryInterface.sequelize.query(
        `SELECT id FROM menus WHERE tenant_id = $1 AND route = '/customers' AND parent_id IS NULL LIMIT 1`,
        { bind: [tenantId] }
      );

      if (accountingParent?.id) {
        await queryInterface.sequelize.query(
          `
          UPDATE menus SET name_ko = '회계관리', updated_at = NOW() WHERE id = $1
          `,
          { bind: [accountingParent.id] }
        );

        const restoreAccounting = [
          ['/accounting/basic-info', 1],
          ['/accounting/quotation', 2],
          ['/accounting/e-invoice', 3],
          ['/accounting/invoice', 4],
          ['/accounting/eway-bill', 5],
          ['/accounting/expense', 6],
          ['/accounting/budget', 7],
          ['/accounting/assets', 8],
          ['/accounting/statistics', 9],
        ];
        for (const [route, order] of restoreAccounting) {
          await queryInterface.sequelize.query(
            `UPDATE menus SET parent_id = $1, "order" = $2, updated_at = NOW() WHERE tenant_id = $3 AND route = $4`,
            { bind: [accountingParent.id, order, tenantId, route] }
          );
        }
      }

      if (customersParent?.id) {
        await queryInterface.sequelize.query(
          `UPDATE menus SET is_active = true, updated_at = NOW() WHERE id = $1`,
          { bind: [customersParent.id] }
        );
        for (const [route, order] of [
          ['/customers/info', 1],
          ['/customers/contracts', 2],
        ]) {
          await queryInterface.sequelize.query(
            `UPDATE menus SET parent_id = $1, "order" = $2, updated_at = NOW() WHERE tenant_id = $3 AND route = $4`,
            { bind: [customersParent.id, order, tenantId, route] }
          );
        }
      }

      await queryInterface.sequelize.query(
        `UPDATE menus SET is_active = false, updated_at = NOW() WHERE tenant_id = $1 AND route = '/sales' AND parent_id IS NULL`,
        { bind: [tenantId] }
      );
    }
  },
};
