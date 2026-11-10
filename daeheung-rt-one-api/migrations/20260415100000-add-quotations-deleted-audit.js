'use strict';

/** 견적서 소프트 삭제 감사: 삭제 시각·삭제 실행 사용자 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = 'quotations';
    const desc = await queryInterface.describeTable(table);
    if (!desc.deleted_at) {
      await queryInterface.addColumn(table, 'deleted_at', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
    if (!desc.deleted_by) {
      await queryInterface.addColumn(table, 'deleted_by', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }
  },

  down: async (queryInterface) => {
    const table = 'quotations';
    const desc = await queryInterface.describeTable(table);
    if (desc.deleted_by) await queryInterface.removeColumn(table, 'deleted_by');
    if (desc.deleted_at) await queryInterface.removeColumn(table, 'deleted_at');
  }
};
