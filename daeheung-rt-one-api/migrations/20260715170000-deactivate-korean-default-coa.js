'use strict';

/**
 * Tally 임포트 계정만 사용: 한글 기본(시스템) 계정과목은 목록에서 제거.
 * is_system=true 행을 soft-delete (전표 FK 보존).
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE gl_accounts
      SET is_active = false,
          updated_at = NOW()
      WHERE is_system = true
        AND is_active = true
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE gl_accounts
      SET is_active = true,
          updated_at = NOW()
      WHERE is_system = true
        AND is_active = false
    `);
  },
};
