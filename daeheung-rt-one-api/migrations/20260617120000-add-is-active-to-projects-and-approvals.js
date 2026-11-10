'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = ['projects', 'approvals'];

    for (const tableName of tables) {
      const table = await queryInterface.describeTable(tableName);

      if (!table.is_active) {
        await queryInterface.addColumn(tableName, 'is_active', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        });
      }
    }
  },

  async down(queryInterface) {
    for (const tableName of ['approvals', 'projects']) {
      const table = await queryInterface.describeTable(tableName);

      if (table.is_active) {
        await queryInterface.removeColumn(tableName, 'is_active');
      }
    }
  }
};
