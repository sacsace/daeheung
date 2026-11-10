'use strict';

/** 견적서 반려 시 사유 저장 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = 'quotations';
    const desc = await queryInterface.describeTable(table);
    if (!desc.rejection_reason) {
      await queryInterface.addColumn(table, 'rejection_reason', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }
  },

  down: async (queryInterface) => {
    const table = 'quotations';
    const desc = await queryInterface.describeTable(table);
    if (desc.rejection_reason) {
      await queryInterface.removeColumn(table, 'rejection_reason');
    }
  }
};
