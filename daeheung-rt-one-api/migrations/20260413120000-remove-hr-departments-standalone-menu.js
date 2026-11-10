'use strict';

/** 부서 관리는 사용자 계정 관리(/hr/users) 탭으로 통합 — 단독 메뉴 제거 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM user_permissions WHERE menu_id IN (
        SELECT id FROM menus WHERE route = '/hr/departments'
      );
    `);
    await queryInterface.sequelize.query(`
      DELETE FROM menus WHERE route = '/hr/departments';
    `);
  },

  async down() {
    // 복구는 20260412102000-add-hr-departments-menu.js 를 참고해 수동 삽입
  }
};
