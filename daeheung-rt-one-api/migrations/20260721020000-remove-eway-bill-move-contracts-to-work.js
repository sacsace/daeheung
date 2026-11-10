'use strict';

/**
 * - 전자운송장(/accounting/eway-bill) 메뉴 삭제
 * - 계약 관리(/customers/contracts) → 업무 관리(/work) 하위로 이동
 * - 매입/매출·업무 하위 순번 정리
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM user_permissions
      WHERE menu_id IN (SELECT id FROM menus WHERE route = '/accounting/eway-bill')
    `);
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET is_active = false, updated_at = NOW()
      WHERE route = '/accounting/eway-bill'
    `);

    const [tenants] = await queryInterface.sequelize.query(`
      SELECT DISTINCT tenant_id FROM menus
      WHERE route IN ('/work', '/sales', '/customers/contracts')
    `);

    for (const { tenant_id: tenantId } of tenants) {
      const [[workParent]] = await queryInterface.sequelize.query(
        `SELECT id FROM menus
         WHERE tenant_id = $1 AND route = '/work' AND parent_id IS NULL AND is_active = true
         LIMIT 1`,
        { bind: [tenantId] }
      );
      if (!workParent?.id) continue;

      // 업무 관리 하위 순번: 프로젝트 → 계약 → 전자결재 → 보고서 → 통계
      const workOrder = [
        ['/work/projects', 1],
        ['/customers/contracts', 2],
        ['/work/approval', 3],
        ['/work/reports', 4],
        ['/work/statistics', 5],
      ];

      for (const [route, order] of workOrder) {
        if (route === '/customers/contracts') {
          await queryInterface.sequelize.query(
            `
            UPDATE menus
            SET parent_id = $1, "order" = $2, level = 2, is_active = true, updated_at = NOW()
            WHERE tenant_id = $3 AND route = $4
            `,
            { bind: [workParent.id, order, tenantId, route] }
          );
        } else {
          await queryInterface.sequelize.query(
            `
            UPDATE menus
            SET "order" = $1, updated_at = NOW()
            WHERE tenant_id = $2 AND route = $3 AND is_active = true
            `,
            { bind: [order, tenantId, route] }
          );
        }
      }

      // 매입/매출 하위 순번 (전자운송장·계약 제외)
      const salesOrder = [
        ['/customers/info', 1],
        ['/accounting/quotation', 2],
        ['/accounting/e-invoice', 3],
        ['/accounting/invoice', 4],
        ['/accounting/expense', 5],
        ['/accounting/statistics', 6],
      ];
      for (const [route, order] of salesOrder) {
        await queryInterface.sequelize.query(
          `
          UPDATE menus
          SET "order" = $1, updated_at = NOW()
          WHERE tenant_id = $2 AND route = $3 AND is_active = true
          `,
          { bind: [order, tenantId, route] }
        );
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET is_active = true, updated_at = NOW()
      WHERE route = '/accounting/eway-bill'
    `);

    const [tenants] = await queryInterface.sequelize.query(`
      SELECT DISTINCT tenant_id FROM menus
      WHERE route IN ('/sales', '/work', '/customers/contracts')
    `);

    for (const { tenant_id: tenantId } of tenants) {
      const [[salesParent]] = await queryInterface.sequelize.query(
        `SELECT id FROM menus
         WHERE tenant_id = $1 AND route = '/sales' AND parent_id IS NULL AND is_active = true
         LIMIT 1`,
        { bind: [tenantId] }
      );
      if (!salesParent?.id) continue;

      await queryInterface.sequelize.query(
        `
        UPDATE menus
        SET parent_id = $1, "order" = 3, level = 2, updated_at = NOW()
        WHERE tenant_id = $2 AND route = '/customers/contracts'
        `,
        { bind: [salesParent.id, tenantId] }
      );

      const workOrder = [
        ['/work/projects', 1],
        ['/work/approval', 2],
        ['/work/reports', 3],
        ['/work/statistics', 4],
      ];
      for (const [route, order] of workOrder) {
        await queryInterface.sequelize.query(
          `
          UPDATE menus SET "order" = $1, updated_at = NOW()
          WHERE tenant_id = $2 AND route = $3 AND is_active = true
          `,
          { bind: [order, tenantId, route] }
        );
      }

      const salesOrder = [
        ['/customers/info', 1],
        ['/accounting/quotation', 2],
        ['/customers/contracts', 3],
        ['/accounting/e-invoice', 4],
        ['/accounting/invoice', 5],
        ['/accounting/eway-bill', 6],
        ['/accounting/expense', 7],
        ['/accounting/statistics', 8],
      ];
      for (const [route, order] of salesOrder) {
        await queryInterface.sequelize.query(
          `
          UPDATE menus SET "order" = $1, updated_at = NOW()
          WHERE tenant_id = $2 AND route = $3
          `,
          { bind: [order, tenantId, route] }
        );
      }
    }
  },
};
