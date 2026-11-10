'use strict';

/**
 * employment_contracts: approver_id, is_active (soft-delete), rejection_reason
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('employment_contracts');

    if (!table.approver_id) {
      await queryInterface.addColumn('employment_contracts', 'approver_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
    if (!table.approved_at) {
      await queryInterface.addColumn('employment_contracts', 'approved_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
    if (!table.rejection_reason) {
      await queryInterface.addColumn('employment_contracts', 'rejection_reason', {
        type: Sequelize.STRING(500),
        allowNull: true,
      });
    }
    if (!table.is_active) {
      await queryInterface.addColumn('employment_contracts', 'is_active', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }

    await queryInterface.addIndex('employment_contracts', ['approver_id', 'status'], {
      name: 'employment_contracts_approver_status_idx',
    });
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex('employment_contracts', 'employment_contracts_approver_status_idx');
    } catch (_) {
      /* ignore */
    }
    const table = await queryInterface.describeTable('employment_contracts');
    if (table.is_active) await queryInterface.removeColumn('employment_contracts', 'is_active');
    if (table.rejection_reason) await queryInterface.removeColumn('employment_contracts', 'rejection_reason');
    if (table.approved_at) await queryInterface.removeColumn('employment_contracts', 'approved_at');
    if (table.approver_id) await queryInterface.removeColumn('employment_contracts', 'approver_id');
  },
};
