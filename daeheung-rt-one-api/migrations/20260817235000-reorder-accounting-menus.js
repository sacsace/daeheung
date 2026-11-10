'use strict';

/**
 * 회계관리 하위 메뉴 순서 정리
 * 1–2 데이터 불러오기 → 3 장부 → 4 자산 → 5–6 재무제표 → 7–8 세금
 */
const ACTIVE_ORDER = [
  ['/accounting/tally-import', 1],
  ['/accounting/sap-import', 2],
  ['/accounting/books', 3],
  ['/accounting/assets', 4],
  ['/accounting/profit-and-loss', 5],
  ['/accounting/balance-sheet', 6],
  ['/accounting/corporate-tax', 7],
  ['/accounting/advance-tax', 8],
  ['/accounting/expense', 9],
  ['/accounting/statistics', 10],
];

module.exports = {
  async up(queryInterface) {
    for (const [route, order] of ACTIVE_ORDER) {
      await queryInterface.sequelize.query(
        `UPDATE menus
         SET "order" = $1, updated_at = NOW()
         WHERE route = $2 AND is_active = true`,
        { bind: [order, route] }
      );
    }

    await queryInterface.sequelize.query(`
      UPDATE menus
      SET icon = 'upload_file', updated_at = NOW()
      WHERE route = '/accounting/sap-import' AND is_active = true
    `);
  },

  async down(queryInterface) {
    const previous = [
      ['/accounting/tally-import', 1],
      ['/accounting/books', 2],
      ['/accounting/sap-import', 2],
      ['/accounting/assets', 5],
      ['/accounting/profit-and-loss', 6],
      ['/accounting/balance-sheet', 7],
      ['/accounting/corporate-tax', 7],
      ['/accounting/advance-tax', 8],
    ];
    for (const [route, order] of previous) {
      await queryInterface.sequelize.query(
        `UPDATE menus SET "order" = $1, updated_at = NOW() WHERE route = $2`,
        { bind: [order, route] }
      );
    }
  },
};
