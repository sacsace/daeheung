'use strict';

/** @param {import('sequelize').QueryInterface} queryInterface */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'payroll_bonuses';
    try {
      await queryInterface.describeTable(table);
      return;
    } catch {
      // create below
    }

    await queryInterface.createTable(table, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'tenants', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      company_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'companies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      employee_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      fiscal_year: { type: Sequelize.STRING(9), allowNull: false },
      installments_per_year: { type: Sequelize.INTEGER, allowNull: false },
      installment: { type: Sequelize.INTEGER, allowNull: false },
      months_worked: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      monthly_salary: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      rate_percent: { type: Sequelize.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
      amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      status: {
        type: Sequelize.ENUM('registered', 'paid'),
        allowNull: false,
        defaultValue: 'registered',
      },
      paid_at: { type: Sequelize.DATE, allowNull: true },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addIndex(
      table,
      ['tenant_id', 'company_id', 'employee_id', 'fiscal_year', 'installment'],
      { unique: true, name: 'payroll_bonuses_employee_fy_installment_uq' }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('payroll_bonuses');
  },
};
