'use strict';

/**
 * 「시스템관리」(/system) soft-deactivate — 라우트·하위 메뉴 없음
 * (실제 설정은 기본정보관리 > 시스템 설정 / 메뉴 권한으로 대체됨)
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET is_active = false, updated_at = NOW()
      WHERE route = '/system' AND parent_id IS NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET is_active = true, updated_at = NOW()
      WHERE route = '/system' AND parent_id IS NULL
    `);
  },
};
