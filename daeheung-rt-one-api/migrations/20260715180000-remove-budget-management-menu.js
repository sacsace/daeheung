'use strict';

/**
 * 예산 관리 메뉴 비활성화 및 회계 하위 메뉴 순서 재정렬
 */

const ACTIVE_ORDER = [
  ['/accounting/tally-import', 1],
  ['/accounting/books', 2],
  ['/accounting/expense', 3],
  ['/accounting/assets', 4],
  ['/accounting/profit-and-loss', 5],
  ['/accounting/balance-sheet', 6],
  ['/accounting/statistics', 7],
  ['/accounting/settings/masters', 8],
];

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET is_active = false, "order" = 90, updated_at = NOW()
      WHERE route = '/accounting/budget'
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
      SET is_active = true, "order" = 4, updated_at = NOW()
      WHERE route = '/accounting/budget'
    `);

    const restore = [
      ['/accounting/tally-import', 1],
      ['/accounting/books', 2],
      ['/accounting/expense', 3],
      ['/accounting/budget', 4],
      ['/accounting/assets', 5],
      ['/accounting/profit-and-loss', 6],
      ['/accounting/balance-sheet', 7],
      ['/accounting/statistics', 8],
      ['/accounting/settings/masters', 9],
    ];

    for (const [route, order] of restore) {
      await queryInterface.sequelize.query(
        `UPDATE menus SET "order" = $1, updated_at = NOW() WHERE route = $2`,
        { bind: [order, route] }
      );
    }
  },
};
