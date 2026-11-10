/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

/** 출고 관련 메뉴 한글명을 "출고 관리"로 통일하고, 구 경로(/inventory/movement) 라벨도 맞춤 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET
        name_ko = '출고 관리',
        name_en = 'Stock Out',
        description = CASE
          WHEN TRIM(COALESCE(description, '')) = '' THEN '바코드 출고'
          ELSE description
        END,
        updated_at = NOW()
      WHERE route IN ('/inventory/stock-out', '/inventory/movement')
    `);
  },

  async down() {
    // 이전 라벨 값이 테넌트마다 달라 복구하지 않음
  }
};
