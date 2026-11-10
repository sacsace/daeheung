'use strict';

/** GS E&C 원가분석은 독립 앱으로 분리됨 — MVS 메뉴 soft-deactivate */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET is_active = false, updated_at = NOW()
      WHERE route = '/accounting/gs-enc-cost'
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET is_active = true, updated_at = NOW()
      WHERE route = '/accounting/gs-enc-cost'
    `);
  },
};
