'use strict';

/** 지출결의서 메뉴명 보정 (매출→매입/매출 이동 마이그레이션 보완) */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET
        name_ko = '지출결의서',
        name_en = 'Expense',
        updated_at = NOW()
      WHERE route = '/accounting/expense'
        AND (name_ko IS DISTINCT FROM '지출결의서' OR name_en IS DISTINCT FROM 'Expense')
    `);
  },

  async down() {
    // no-op: previous display name varied by environment
  },
};
