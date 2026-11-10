'use strict';

/** /communication 상위 메뉴 표기: 소식 → 알람 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET name_ko = '알람',
          name_en = 'Alarms',
          description = '알람 및 알림',
          updated_at = NOW()
      WHERE route = '/communication' AND parent_id IS NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET name_ko = '소식',
          name_en = 'Updates',
          description = '소식 및 알림',
          updated_at = NOW()
      WHERE route = '/communication' AND parent_id IS NULL
    `);
  },
};
