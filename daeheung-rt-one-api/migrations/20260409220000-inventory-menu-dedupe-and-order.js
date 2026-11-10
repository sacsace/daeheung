/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

/**
 * 재고 하위 중복 메뉴 제거(구 입출고/이동 경로) 및
 * 출고 관리 → 입고 관리 순으로 정렬, 입고 메뉴 설명·아이콘 정리
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM user_permissions
      WHERE menu_id IN (
        SELECT id FROM menus WHERE route IN ('/inventory/movement', '/inventory/transaction')
      )
    `);
    await queryInterface.sequelize.query(`
      DELETE FROM menus WHERE route IN ('/inventory/movement', '/inventory/transaction')
    `);

    await queryInterface.sequelize.query(`
      UPDATE menus
      SET
        "order" = 100,
        description = '바코드 출고',
        updated_at = NOW()
      WHERE route = '/inventory/stock-out'
    `);
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET
        "order" = 101,
        icon = 'post_add',
        description = '입고 품목 등록',
        updated_at = NOW()
      WHERE route = '/inventory/stock-in'
    `);
  },

  async down() {
    // 복구 생략
  }
};
