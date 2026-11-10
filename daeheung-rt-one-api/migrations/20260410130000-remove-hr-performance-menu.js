'use strict';

/** 인사관리 하위: 성과 관리 메뉴 제거 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM user_permissions
      WHERE menu_id IN (SELECT id FROM menus WHERE route = '/hr/performance')
    `);
    await queryInterface.sequelize.query(`
      DELETE FROM menus WHERE route = '/hr/performance'
    `);
  },

  async down() {}
};
