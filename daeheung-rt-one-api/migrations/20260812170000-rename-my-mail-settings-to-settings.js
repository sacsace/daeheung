'use strict';

/** 「내 정보·업무」하위: 메일 설정 → 설정 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET name_ko = '설정',
          name_en = 'Settings',
          description = '설정',
          updated_at = NOW()
      WHERE route = '/my/mail-settings'
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET name_ko = '메일 설정',
          name_en = 'Mail Settings',
          description = '메일 설정',
          updated_at = NOW()
      WHERE route = '/my/mail-settings'
    `);
  },
};
