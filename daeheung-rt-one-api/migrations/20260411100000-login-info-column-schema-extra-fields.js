'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tabs = await queryInterface.describeTable('login_info_tabs');
    if (!tabs.column_schema) {
      await queryInterface.addColumn('login_info_tabs', 'column_schema', {
        type: Sequelize.JSON,
        allowNull: true
      });
    }

    const infos = await queryInterface.describeTable('login_infos');
    if (!infos.extra_fields) {
      await queryInterface.addColumn('login_infos', 'extra_fields', {
        type: Sequelize.JSON,
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    const tabs = await queryInterface.describeTable('login_info_tabs');
    if (tabs.column_schema) {
      await queryInterface.removeColumn('login_info_tabs', 'column_schema');
    }
    const infos = await queryInterface.describeTable('login_infos');
    if (infos.extra_fields) {
      await queryInterface.removeColumn('login_infos', 'extra_fields');
    }
  }
};
