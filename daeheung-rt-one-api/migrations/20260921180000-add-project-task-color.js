'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('project_tasks');
    if (!table.color) {
      await queryInterface.addColumn('project_tasks', 'color', {
        type: Sequelize.STRING(7),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('project_tasks');
    if (table.color) {
      await queryInterface.removeColumn('project_tasks', 'color');
    }
  },
};
