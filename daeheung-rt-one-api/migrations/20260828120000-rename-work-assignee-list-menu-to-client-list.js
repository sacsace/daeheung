'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET name_ko = '고객사 리스트',
          name_en = 'Client List',
          updated_at = NOW()
      WHERE route = '/work/assignee-list'
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET name_ko = '업무 담당 리스트',
          name_en = 'Work Assignment List',
          updated_at = NOW()
      WHERE route = '/work/assignee-list'
    `);
  },
};
