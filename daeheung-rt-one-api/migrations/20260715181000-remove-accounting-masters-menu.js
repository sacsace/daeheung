'use strict';

/**
 * 회계 마스터 관리 메뉴 비활성화 (Tally 중심 — UI 불필요)
 */

const ACTIVE_ORDER = [
  ['/accounting/tally-import', 1],
  ['/accounting/books', 2],
  ['/accounting/expense', 3],
  ['/accounting/assets', 4],
  ['/accounting/profit-and-loss', 5],
  ['/accounting/balance-sheet', 6],
  ['/accounting/statistics', 7],
];

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET is_active = false, "order" = 91, updated_at = NOW()
      WHERE route = '/accounting/settings/masters'
    `);

    for (const [route, order] of ACTIVE_ORDER) {
      await queryInterface.sequelize.query(
        `UPDATE menus SET "order" = $1, is_active = true, updated_at = NOW()
         WHERE route = $2 AND is_active = true`,
        { bind: [order, route] }
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET is_active = true, "order" = 8, updated_at = NOW()
      WHERE route = '/accounting/settings/masters'
    `);
  },
};
