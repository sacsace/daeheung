'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_auto_vouchers_status" AS ENUM(
          'uploaded',
          'ocr_completed',
          'ai_classified',
          'draft',
          'review_required',
          'approved',
          'posted',
          'rejected',
          'cancelled'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.createTable('auto_vouchers', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
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
      voucher_code: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      source_doc_type: { type: Sequelize.STRING(60), allowNull: false },
      source_file_name: { type: Sequelize.STRING(255), allowNull: false },
      source_file_path: { type: Sequelize.STRING(500), allowNull: true },
      source_file_mime: { type: Sequelize.STRING(120), allowNull: true },
      ocr_data: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      ai_analysis: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      duplicate_check: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      suggested_lines: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      final_lines: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      transaction_date: { type: Sequelize.DATEONLY, allowNull: true },
      invoice_number: { type: Sequelize.STRING(120), allowNull: true },
      counterparty_name: { type: Sequelize.STRING(255), allowNull: true },
      narration: { type: Sequelize.TEXT, allowNull: true },
      currency: { type: Sequelize.STRING(12), allowNull: false, defaultValue: 'INR' },
      total_debit: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      total_credit: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      confidence_score: { type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
      status: {
        type: Sequelize.ENUM(
          'uploaded',
          'ocr_completed',
          'ai_classified',
          'draft',
          'review_required',
          'approved',
          'posted',
          'rejected',
          'cancelled'
        ),
        allowNull: false,
        defaultValue: 'uploaded',
      },
      review_notes: { type: Sequelize.TEXT, allowNull: true },
      approved_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      approved_at: { type: Sequelize.DATE, allowNull: true },
      posted_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      posted_at: { type: Sequelize.DATE, allowNull: true },
      rejected_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      rejected_at: { type: Sequelize.DATE, allowNull: true },
      rejection_reason: { type: Sequelize.TEXT, allowNull: true },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.createTable('auto_voucher_rules', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
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
      keyword: { type: Sequelize.STRING(120), allowNull: false },
      doc_type: { type: Sequelize.STRING(60), allowNull: true },
      transaction_type: { type: Sequelize.STRING(60), allowNull: false, defaultValue: 'expense' },
      debit_account: { type: Sequelize.STRING(120), allowNull: false },
      credit_account: { type: Sequelize.STRING(120), allowNull: false },
      tax_account: { type: Sequelize.STRING(120), allowNull: true },
      confidence_boost: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 10 },
      reason_template: { type: Sequelize.STRING(255), allowNull: true },
      priority: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 100 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.createTable('auto_voucher_audit_logs', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
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
      auto_voucher_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'auto_vouchers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      action: { type: Sequelize.STRING(80), allowNull: false },
      actor_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      before_data: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      after_data: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      metadata: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('auto_vouchers', ['tenant_id', 'company_id'], {
      name: 'auto_vouchers_tenant_company_idx',
    });
    await queryInterface.addIndex('auto_vouchers', ['status'], {
      name: 'auto_vouchers_status_idx',
    });
    await queryInterface.addIndex('auto_vouchers', ['transaction_date'], {
      name: 'auto_vouchers_txn_date_idx',
    });
    await queryInterface.addIndex('auto_vouchers', ['invoice_number'], {
      name: 'auto_vouchers_invoice_number_idx',
    });
    await queryInterface.addIndex('auto_voucher_rules', ['tenant_id', 'company_id', 'is_active'], {
      name: 'auto_voucher_rules_scope_idx',
    });
    await queryInterface.addIndex('auto_voucher_audit_logs', ['auto_voucher_id', 'created_at'], {
      name: 'auto_voucher_audit_logs_voucher_created_idx',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('auto_voucher_audit_logs');
    await queryInterface.dropTable('auto_voucher_rules');
    await queryInterface.dropTable('auto_vouchers');
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_auto_vouchers_status";`);
  },
};
