'use strict';

/** @param {import('sequelize').QueryInterface} queryInterface */
/** @param {import('sequelize').Sequelize} Sequelize */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('work_reports', 'cc_user_ids', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: []
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('work_reports', 'cc_user_ids');
  }
};
