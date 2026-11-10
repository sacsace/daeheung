'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('expense_reports', 'approval_id', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.addColumn('expense_reports', 'payment_request_status', {
      type: Sequelize.STRING(30),
      allowNull: true,
      defaultValue: 'not_requested'
    });
    await queryInterface.addColumn('expense_reports', 'payment_requested_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await queryInterface.addColumn('expense_reports', 'payment_requested_by', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.addColumn('expense_reports', 'payment_completed_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await queryInterface.addColumn('expense_reports', 'payment_completed_by', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.addColumn('expense_reports', 'bank_transfer_provider', {
      type: Sequelize.STRING(20),
      allowNull: true
    });
    await queryInterface.addColumn('expense_reports', 'bank_transfer_status', {
      type: Sequelize.STRING(30),
      allowNull: true
    });
    await queryInterface.addColumn('expense_reports', 'bank_transfer_reference', {
      type: Sequelize.STRING(100),
      allowNull: true
    });
    await queryInterface.addColumn('expense_reports', 'bank_transfer_error', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.addColumn('expense_reports', 'bank_transfer_payload', {
      type: Sequelize.JSONB,
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('expense_reports', 'bank_transfer_payload');
    await queryInterface.removeColumn('expense_reports', 'bank_transfer_error');
    await queryInterface.removeColumn('expense_reports', 'bank_transfer_reference');
    await queryInterface.removeColumn('expense_reports', 'bank_transfer_status');
    await queryInterface.removeColumn('expense_reports', 'bank_transfer_provider');
    await queryInterface.removeColumn('expense_reports', 'payment_completed_by');
    await queryInterface.removeColumn('expense_reports', 'payment_completed_at');
    await queryInterface.removeColumn('expense_reports', 'payment_requested_by');
    await queryInterface.removeColumn('expense_reports', 'payment_requested_at');
    await queryInterface.removeColumn('expense_reports', 'payment_request_status');
    await queryInterface.removeColumn('expense_reports', 'approval_id');
  }
};
