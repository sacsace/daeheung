'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('assets').catch(() => null);
    if (!table) return;
    if (!table.salvage_value) {
      await queryInterface.addColumn('assets', 'salvage_value', {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('assets').catch(() => null);
    if (!table?.salvage_value) return;
    await queryInterface.removeColumn('assets', 'salvage_value');
  },
};
