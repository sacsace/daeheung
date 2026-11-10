'use strict';

/** invoices: 내부 결재(승인자·승인일·결재 상태) */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = 'invoices';
    const desc = await queryInterface.describeTable(table);

    if (!desc.approver_user_id) {
      await queryInterface.addColumn(table, 'approver_user_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }
    if (!desc.approved_at) {
      await queryInterface.addColumn(table, 'approved_at', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
    if (!desc.approval_status) {
      await queryInterface.addColumn(table, 'approval_status', {
        type: Sequelize.STRING(32),
        allowNull: true
      });
    }

    const indexes = await queryInterface.showIndex(table);
    const hasIdx = indexes.some((i) => i.name === 'invoices_approver_user_id_idx');
    if (!hasIdx) {
      await queryInterface.addIndex(table, ['approver_user_id'], {
        name: 'invoices_approver_user_id_idx'
      });
    }
  },

  down: async (queryInterface) => {
    const table = 'invoices';
    try {
      await queryInterface.removeIndex(table, 'invoices_approver_user_id_idx');
    } catch (_) {}
    const desc = await queryInterface.describeTable(table);
    if (desc.approval_status) await queryInterface.removeColumn(table, 'approval_status');
    if (desc.approved_at) await queryInterface.removeColumn(table, 'approved_at');
    if (desc.approver_user_id) await queryInterface.removeColumn(table, 'approver_user_id');
  }
};
