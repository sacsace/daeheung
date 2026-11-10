'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET name_ko = '업무 관리',
          name_en = 'Work Management',
          description = '업무 관리'
      WHERE route = '/work/projects' AND level = 2;
    `);
    await queryInterface.sequelize.query(`
      UPDATE menus SET icon = 'view_kanban' WHERE route = '/work/projects' AND level = 2;
    `);
  },
  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET name_ko = '프로젝트 관리',
          name_en = 'Project Management',
          description = '프로젝트 관리',
          icon = 'work'
      WHERE route = '/work/projects' AND level = 2;
    `);
  }
};
