'use strict';

/**
 * - 매출 관리 → 매입/매출 관리
 * - 지출결의서 → 매입/매출 관리 하위
 * - 회계 관리 → 회계관리 (Tally)
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET
        name_ko = '매입/매출 관리',
        name_en = 'Purchase/Sales',
        updated_at = NOW()
      WHERE route = '/sales' AND parent_id IS NULL
    `);

    await queryInterface.sequelize.query(`
      UPDATE menus
      SET
        name_ko = '회계관리 (Tally)',
        name_en = 'Accounting (Tally)',
        updated_at = NOW()
      WHERE route = '/accounting' AND parent_id IS NULL
    `);

    const [tenants] = await queryInterface.sequelize.query(`
      SELECT DISTINCT tenant_id FROM menus
      WHERE route IN ('/sales', '/accounting/expense')
    `);

    for (const { tenant_id: tenantId } of tenants) {
      const [[salesParent]] = await queryInterface.sequelize.query(
        `SELECT id FROM menus
         WHERE tenant_id = $1 AND route = '/sales' AND parent_id IS NULL AND is_active = true
         LIMIT 1`,
        { bind: [tenantId] }
      );
      if (!salesParent?.id) continue;

      // 통계를 8번으로 밀고 지출결의서를 7번으로 배치
      await queryInterface.sequelize.query(
        `
        UPDATE menus
        SET "order" = 8, updated_at = NOW()
        WHERE tenant_id = $1
          AND route = '/accounting/statistics'
          AND is_active = true
        `,
        { bind: [tenantId] }
      );

      await queryInterface.sequelize.query(
        `
        UPDATE menus
        SET
          parent_id = $1,
          "order" = 7,
          level = 2,
          name_ko = '지출결의서',
          name_en = 'Expense',
          is_active = true,
          updated_at = NOW()
        WHERE tenant_id = $2
          AND route = '/accounting/expense'
          AND is_active = true
        `,
        { bind: [salesParent.id, tenantId] }
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET
        name_ko = '매출 관리',
        name_en = 'Sales Management',
        updated_at = NOW()
      WHERE route = '/sales' AND parent_id IS NULL
    `);

    await queryInterface.sequelize.query(`
      UPDATE menus
      SET
        name_ko = '회계 관리',
        name_en = 'Accounting',
        updated_at = NOW()
      WHERE route = '/accounting' AND parent_id IS NULL
    `);

    const [tenants] = await queryInterface.sequelize.query(`
      SELECT DISTINCT tenant_id FROM menus
      WHERE route IN ('/accounting', '/accounting/expense')
    `);

    for (const { tenant_id: tenantId } of tenants) {
      const [[accountingParent]] = await queryInterface.sequelize.query(
        `SELECT id FROM menus
         WHERE tenant_id = $1 AND route = '/accounting' AND parent_id IS NULL AND is_active = true
         LIMIT 1`,
        { bind: [tenantId] }
      );
      if (!accountingParent?.id) continue;

      await queryInterface.sequelize.query(
        `
        UPDATE menus
        SET
          parent_id = $1,
          "order" = 6,
          level = 2,
          updated_at = NOW()
        WHERE tenant_id = $2
          AND route = '/accounting/expense'
        `,
        { bind: [accountingParent.id, tenantId] }
      );

      await queryInterface.sequelize.query(
        `
        UPDATE menus
        SET "order" = 7, updated_at = NOW()
        WHERE tenant_id = $1
          AND route = '/accounting/statistics'
        `,
        { bind: [tenantId] }
      );
    }
  },
};
