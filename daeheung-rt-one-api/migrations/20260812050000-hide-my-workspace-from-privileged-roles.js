'use strict';

/** root/admin/audit 의 「내 업무」메뉴 권한 제거 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM user_permissions
      WHERE menu_id IN (
        SELECT id FROM menus WHERE route = '/my' OR route LIKE '/my/%'
      )
      AND user_id IN (
        SELECT id FROM users WHERE role IN ('root', 'admin', 'audit')
      )
    `);
  },

  async down() {
    // 권한 복구는 하지 않음 (관리자용 메뉴가 아님)
  },
};
