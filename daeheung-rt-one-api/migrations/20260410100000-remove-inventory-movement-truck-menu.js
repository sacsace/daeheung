/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

/**
 * 구 경로 /inventory/movement — 트럭(배송) 아이콘의 중복 "출고 관리" 메뉴 제거
 * (실제 출고는 /inventory/stock-out 만 유지)
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM user_permissions
      WHERE menu_id IN (SELECT id FROM menus WHERE route = '/inventory/movement')
    `);
    await queryInterface.sequelize.query(`
      DELETE FROM menus WHERE route = '/inventory/movement'
    `);
    /* 혹시 라우트만 바뀌고 아이콘이 local_shipping 인 중복 출고 행 */
    await queryInterface.sequelize.query(`
      DELETE FROM user_permissions
      WHERE menu_id IN (
        SELECT id FROM menus
        WHERE name_ko = '출고 관리'
          AND COALESCE(icon, '') = 'local_shipping'
          AND route IS DISTINCT FROM '/inventory/stock-out'
      )
    `);
    await queryInterface.sequelize.query(`
      DELETE FROM menus
      WHERE name_ko = '출고 관리'
        AND COALESCE(icon, '') = 'local_shipping'
        AND route IS DISTINCT FROM '/inventory/stock-out'
    `);
  },

  async down() {}
};
