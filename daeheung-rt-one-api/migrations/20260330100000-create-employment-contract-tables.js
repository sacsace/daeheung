'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('employment_contract_templates', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'tenants', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      company_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'companies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      name: { type: Sequelize.STRING(150), allowNull: false },
      contract_type: { type: Sequelize.STRING(50), allowNull: false, defaultValue: 'regular' },
      language: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'ko' },
      version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      content_html: { type: Sequelize.TEXT, allowNull: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') }
    });
    await queryInterface.addIndex('employment_contract_templates', ['tenant_id', 'company_id']);

    await queryInterface.createTable('employment_contracts', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'tenants', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      company_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'companies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      employee_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      template_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'employment_contract_templates', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      title: { type: Sequelize.STRING(200), allowNull: false },
      contract_type: { type: Sequelize.STRING(50), allowNull: false, defaultValue: 'regular' },
      status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'draft' },
      start_date: { type: Sequelize.DATEONLY, allowNull: false },
      end_date: { type: Sequelize.DATEONLY, allowNull: false },
      salary: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      work_location: { type: Sequelize.STRING(200), allowNull: true },
      working_hours: { type: Sequelize.STRING(100), allowNull: true },
      probation_months: { type: Sequelize.INTEGER, allowNull: true },
      pdf_url: { type: Sequelize.TEXT, allowNull: true },
      hash_sha256: { type: Sequelize.STRING(128), allowNull: true },
      company_signed_at: { type: Sequelize.DATE, allowNull: true },
      employee_signed_at: { type: Sequelize.DATE, allowNull: true },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') }
    });
    await queryInterface.addIndex('employment_contracts', ['tenant_id', 'company_id']);
    await queryInterface.addIndex('employment_contracts', ['employee_id']);
    await queryInterface.addIndex('employment_contracts', ['status']);
    await queryInterface.addIndex('employment_contracts', ['end_date']);

    await queryInterface.createTable('employment_contract_signatures', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      contract_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'employment_contracts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      signer_type: { type: Sequelize.STRING(20), allowNull: false },
      signer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      signed_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      sign_ip: { type: Sequelize.STRING(64), allowNull: true },
      sign_method: { type: Sequelize.STRING(50), allowNull: true, defaultValue: 'internal_ack' },
      signature_data: { type: Sequelize.TEXT, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') }
    });
    await queryInterface.addIndex('employment_contract_signatures', ['contract_id']);
    await queryInterface.addIndex('employment_contract_signatures', ['signer_id']);

    await queryInterface.createTable('employment_contract_audit_logs', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      contract_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'employment_contracts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'tenants', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      company_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'companies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      actor_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      actor_role: { type: Sequelize.STRING(30), allowNull: true },
      action: { type: Sequelize.STRING(100), allowNull: false },
      details: { type: Sequelize.JSONB, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') }
    });
    await queryInterface.addIndex('employment_contract_audit_logs', ['tenant_id', 'company_id']);
    await queryInterface.addIndex('employment_contract_audit_logs', ['contract_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('employment_contract_audit_logs');
    await queryInterface.dropTable('employment_contract_signatures');
    await queryInterface.dropTable('employment_contracts');
    await queryInterface.dropTable('employment_contract_templates');
  }
};

