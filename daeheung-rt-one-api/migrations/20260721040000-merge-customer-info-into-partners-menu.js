'use strict';

/**
 * - Rename 파트너 업체 관리 → 파트너 업체/고객 관리
 * - Deactivate 고객 정보 (/customers/info) — merged into partners page
 * - Reorder 기본정보 children after removal
 */
module.exports = {
  async up(queryInterface) {
    const [tenants] = await queryInterface.sequelize.query(`
      SELECT DISTINCT tenant_id FROM menus
      WHERE route IN ('/basic-info', '/basic-info/partners', '/customers/info')
    `);

    for (const { tenant_id: tenantId } of tenants) {
      await queryInterface.sequelize.query(
        `
        UPDATE menus
        SET name_ko = '파트너 업체/고객 관리',
            name_en = 'Partners / Customers',
            description = '파트너 업체 및 고객 정보 통합 관리',
            updated_at = NOW()
        WHERE tenant_id = $1 AND route = '/basic-info/partners'
        `,
        { bind: [tenantId] }
      );

      await queryInterface.sequelize.query(
        `
        UPDATE menus
        SET is_active = false, "order" = 90, updated_at = NOW()
        WHERE tenant_id = $1 AND route = '/customers/info'
        `,
        { bind: [tenantId] }
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
      WHERE route IN ('/basic-info', '/basic-info/partners', '/customers/info')
    `);

    for (const { tenant_id: tenantId } of tenants) {
      await queryInterface.sequelize.query(
        `
        UPDATE menus
        SET name_ko = '파트너 업체 관리',
            name_en = 'Partners',
            updated_at = NOW()
        WHERE tenant_id = $1 AND route = '/basic-info/partners'
        `,
        { bind: [tenantId] }
      );

      const [[basicParent]] = await queryInterface.sequelize.query(
        `SELECT id FROM menus
         WHERE tenant_id = $1 AND route = '/basic-info' AND parent_id IS NULL AND is_active = true
         LIMIT 1`,
        { bind: [tenantId] }
      );
      if (!basicParent?.id) continue;

      await queryInterface.sequelize.query(
        `
        UPDATE menus
        SET is_active = true, parent_id = $1, "order" = 3, level = 2, updated_at = NOW()
        WHERE tenant_id = $2 AND route = '/customers/info'
        `,
        { bind: [basicParent.id, tenantId] }
      );

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
};
