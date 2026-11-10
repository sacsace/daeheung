'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('vacations');

    if (!table.is_active) {
      await queryInterface.addColumn('vacations', 'is_active', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('vacations');

    if (table.is_active) {
      await queryInterface.removeColumn('vacations', 'is_active');
    }
  }
};
