'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('attendances');

    if (!table.is_active) {
      await queryInterface.addColumn('attendances', 'is_active', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('attendances');

    if (table.is_active) {
      await queryInterface.removeColumn('attendances', 'is_active');
    }
  }
};
