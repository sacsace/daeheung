'use strict';

/**
 * 고객 정보(/customers/info) → 기본정보(/basic-info) 하위로 이동
 */
module.exports = {
  async up(queryInterface) {
    const [tenants] = await queryInterface.sequelize.query(`
      SELECT DISTINCT tenant_id FROM menus
      WHERE route IN ('/basic-info', '/customers/info', '/sales')
    `);

    for (const { tenant_id: tenantId } of tenants) {
      const [[basicParent]] = await queryInterface.sequelize.query(
        `SELECT id FROM menus
         WHERE tenant_id = $1 AND route = '/basic-info' AND parent_id IS NULL AND is_active = true
         LIMIT 1`,
        { bind: [tenantId] }
      );
      if (!basicParent?.id) continue;

      // 기본정보 하위: 회사 → 파트너 → 고객 → 조직도 → …
      const basicOrder = [
        ['/basic-info/company', 1],
        ['/basic-info/partners', 2],
        ['/customers/info', 3],
        ['/basic-info/organization', 4],
        ['/basic-info/menu-permissions', 5],
        ['/basic-info/login-info', 6],
        ['/basic-info/system-settings', 7],
        ['/basic-info/mail-send-test', 8],
      ];

      for (const [route, order] of basicOrder) {
        if (route === '/customers/info') {
          await queryInterface.sequelize.query(
            `
            UPDATE menus
            SET parent_id = $1, "order" = $2, level = 2, is_active = true, updated_at = NOW()
            WHERE tenant_id = $3 AND route = $4
            `,
            { bind: [basicParent.id, order, tenantId, route] }
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

      // 매입/매출 하위 순번 (고객정보 제외)
      const salesOrder = [
        ['/accounting/quotation', 1],
        ['/accounting/e-invoice', 2],
        ['/accounting/invoice', 3],
        ['/accounting/expense', 4],
        ['/accounting/statistics', 5],
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
    const [tenants] = await queryInterface.sequelize.query(`
      SELECT DISTINCT tenant_id FROM menus
      WHERE route IN ('/sales', '/customers/info', '/basic-info')
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
        SET parent_id = $1, "order" = 1, level = 2, updated_at = NOW()
        WHERE tenant_id = $2 AND route = '/customers/info'
        `,
        { bind: [salesParent.id, tenantId] }
      );

      const basicOrder = [
        ['/basic-info/company', 1],
        ['/basic-info/partners', 2],
        ['/basic-info/organization', 3],
        ['/basic-info/menu-permissions', 4],
        ['/basic-info/login-info', 5],
        ['/basic-info/system-settings', 6],
        ['/basic-info/mail-send-test', 7],
      ];
      for (const [route, order] of basicOrder) {
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
        ['/accounting/e-invoice', 3],
        ['/accounting/invoice', 4],
        ['/accounting/expense', 5],
        ['/accounting/statistics', 6],
      ];
      for (const [route, order] of salesOrder) {
        await queryInterface.sequelize.query(
          `
          UPDATE menus SET "order" = $1, updated_at = NOW()
          WHERE tenant_id = $2 AND route = $3 AND is_active = true
          `,
          { bind: [order, tenantId, route] }
        );
      }
    }
  },
};
