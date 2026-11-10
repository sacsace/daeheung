'use strict';

/** 상위 메뉴명: 회계관리 (Tally) → 회계관리 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET
        name_ko = '회계관리',
        name_en = 'Accounting',
        updated_at = NOW()
      WHERE route = '/accounting'
        AND parent_id IS NULL
        AND (
          name_ko ILIKE '%Tally%'
          OR name_en ILIKE '%Tally%'
          OR name_ko = '회계관리 (Tally)'
        )
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET
        name_ko = '회계관리 (Tally)',
        name_en = 'Accounting (Tally)',
        updated_at = NOW()
      WHERE route = '/accounting' AND parent_id IS NULL
    `);
  },
};
