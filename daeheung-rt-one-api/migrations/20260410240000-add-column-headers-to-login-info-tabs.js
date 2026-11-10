'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('login_info_tabs');
    if (!table.column_headers) {
      await queryInterface.addColumn('login_info_tabs', 'column_headers', {
        type: Sequelize.JSON,
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('login_info_tabs');
    if (table.column_headers) {
      await queryInterface.removeColumn('login_info_tabs', 'column_headers');
    }
  }
};
