'use strict';

/** 메뉴·페이지 표기: Tally 임포트 → Tally Data 불러오기 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET
        name_ko = 'Tally Data 불러오기',
        name_en = 'Load Tally Data',
        updated_at = NOW()
      WHERE route = '/accounting/tally-import'
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET
        name_ko = 'Tally 임포트',
        name_en = 'Tally Import',
        updated_at = NOW()
      WHERE route = '/accounting/tally-import'
    `);
  },
};
