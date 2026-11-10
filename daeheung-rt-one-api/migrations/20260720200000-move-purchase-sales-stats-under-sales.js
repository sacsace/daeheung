'use strict';

/**
 * 회계 통계 → 매입/매출 통계
 * - 메뉴명 변경
 * - 매출 관리(/sales) 하위로 이동 (인보이스·지출결의서 기반, Tally 무관)
 */
module.exports = {
  async up(queryInterface) {
    const [tenants] = await queryInterface.sequelize.query(`
      SELECT DISTINCT tenant_id FROM menus
      WHERE route IN ('/sales', '/accounting/statistics')
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
        SET
          parent_id = $1,
          "order" = 7,
          level = 2,
          name_ko = '매입/매출 통계',
          name_en = 'Purchase/Sales Stats',
          icon = 'assessment',
          is_active = true,
          updated_at = NOW()
        WHERE tenant_id = $2
          AND route = '/accounting/statistics'
          AND is_active = true
        `,
        { bind: [salesParent.id, tenantId] }
      );
    }

    // tenant 없이 남은 행도 이름만 보정
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET
        name_ko = '매입/매출 통계',
        name_en = 'Purchase/Sales Stats',
        updated_at = NOW()
      WHERE route = '/accounting/statistics'
        AND (name_ko IS DISTINCT FROM '매입/매출 통계' OR name_en IS DISTINCT FROM 'Purchase/Sales Stats')
    `);
  },

  async down(queryInterface) {
    const [tenants] = await queryInterface.sequelize.query(`
      SELECT DISTINCT tenant_id FROM menus
      WHERE route IN ('/accounting', '/accounting/statistics')
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
          "order" = 11,
          level = 2,
          name_ko = '회계 통계',
          name_en = 'Statistics',
          updated_at = NOW()
        WHERE tenant_id = $2
          AND route = '/accounting/statistics'
        `,
        { bind: [accountingParent.id, tenantId] }
      );
    }
  },
};
