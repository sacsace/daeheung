'use strict';

/** 고객관리: 영업 기회(/customers/sales) 메뉴 제거 및 하위 순번 정리 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM user_permissions
      WHERE menu_id IN (SELECT id FROM menus WHERE route = '/customers/sales')
    `);
    await queryInterface.sequelize.query(`
      DELETE FROM menus WHERE route = '/customers/sales'
    `);

    await queryInterface.sequelize.query(`
      UPDATE menus
      SET
        "order" = CASE route
          WHEN '/customers/info' THEN 1
          WHEN '/customers/contracts' THEN 2
          WHEN '/customers/support' THEN 3
        END,
        updated_at = NOW()
      WHERE route IN ('/customers/info', '/customers/contracts', '/customers/support')
    `);
  },

  async down() {}
};
