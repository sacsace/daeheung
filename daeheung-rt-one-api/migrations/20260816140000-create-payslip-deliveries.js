'use strict';

/**
 * 엑셀 업로드 발송 시 MVS 사용자와 매칭된 급여 명세서 보관
 * (엑셀 원본은 저장하지 않음 — PDF + 메타만)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payslip_deliveries', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
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
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      payroll_period: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: '',
      },
      employee_name: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      recipient_email: {
        type: Sequelize.STRING(254),
        allowNull: false,
      },
      emp_id: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      net_salary: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      pdf_path: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      pdf_url: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      sent_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      sent_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('payslip_deliveries', ['tenant_id', 'company_id', 'user_id'], {
      name: 'payslip_deliveries_tenant_company_user_idx',
    });
    await queryInterface.addIndex(
      'payslip_deliveries',
      ['tenant_id', 'company_id', 'user_id', 'payroll_period'],
      {
        name: 'payslip_deliveries_user_period_unique',
        unique: true,
        where: { is_active: true },
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('payslip_deliveries');
  },
};
