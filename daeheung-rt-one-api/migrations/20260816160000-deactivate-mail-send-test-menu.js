'use strict';

/**
 * 「메일 발송 테스트」 단독 메뉴 비활성 — SMTP 테스트는 시스템 설정 내 팝업으로 통합
 * (업무 메뉴 soft-delete: is_active=false)
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET is_active = false,
          updated_at = NOW()
      WHERE route = '/basic-info/mail-send-test'
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET is_active = true,
          updated_at = NOW()
      WHERE route = '/basic-info/mail-send-test'
    `);
  }
};
