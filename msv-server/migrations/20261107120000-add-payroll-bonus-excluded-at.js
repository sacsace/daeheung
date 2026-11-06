'use strict';

/** @param {import('sequelize').QueryInterface} queryInterface */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('payroll_bonuses');
    if (table.excluded_at) return;
    await queryInterface.addColumn('payroll_bonuses', 'excluded_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('payroll_bonuses');
    if (!table.excluded_at) return;
    await queryInterface.removeColumn('payroll_bonuses', 'excluded_at');
  },
};
