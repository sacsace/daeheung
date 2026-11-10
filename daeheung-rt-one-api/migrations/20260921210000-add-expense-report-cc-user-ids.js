'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('expense_reports').catch(() => null);
    if (!table) return;
    if (!table.cc_user_ids) {
      await queryInterface.addColumn('expense_reports', 'cc_user_ids', {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('expense_reports').catch(() => null);
    if (!table || !table.cc_user_ids) return;
    await queryInterface.removeColumn('expense_reports', 'cc_user_ids');
  },
};
