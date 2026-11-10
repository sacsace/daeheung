'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_gl_accounts_nature" AS ENUM('asset', 'liability', 'income', 'expense', 'equity');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_gl_accounts_account_type" AS ENUM('group', 'ledger');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_gl_vouchers_voucher_type" AS ENUM('journal', 'payment', 'receipt', 'contra', 'sales', 'purchase');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_gl_vouchers_status" AS ENUM('draft', 'posted', 'cancelled');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_gl_vouchers_source_type" AS ENUM('manual', 'auto_voucher');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryInterface.createTable('gl_accounts', {
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
      parent_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'gl_accounts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      code: { type: Sequelize.STRING(30), allowNull: false },
      name: { type: Sequelize.STRING(255), allowNull: false },
      name_en: { type: Sequelize.STRING(255), allowNull: true },
      account_type: {
        type: Sequelize.ENUM('group', 'ledger'),
        allowNull: false,
        defaultValue: 'ledger',
      },
      nature: {
        type: Sequelize.ENUM('asset', 'liability', 'income', 'expense', 'equity'),
        allowNull: false,
      },
      opening_balance: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      current_balance: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      is_system: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
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
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('gl_vouchers', {
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
      voucher_no: { type: Sequelize.STRING(50), allowNull: false },
      voucher_type: {
        type: Sequelize.ENUM('journal', 'payment', 'receipt', 'contra', 'sales', 'purchase'),
        allowNull: false,
        defaultValue: 'journal',
      },
      voucher_date: { type: Sequelize.DATEONLY, allowNull: false },
      narration: { type: Sequelize.TEXT, allowNull: true },
      status: {
        type: Sequelize.ENUM('draft', 'posted', 'cancelled'),
        allowNull: false,
        defaultValue: 'draft',
      },
      source_type: {
        type: Sequelize.ENUM('manual', 'auto_voucher'),
        allowNull: true,
      },
      source_id: { type: Sequelize.INTEGER, allowNull: true },
      total_debit: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      total_credit: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      posted_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      posted_at: { type: Sequelize.DATE, allowNull: true },
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
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('gl_voucher_lines', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      voucher_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'gl_vouchers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      account_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'gl_accounts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      line_no: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      account_name: { type: Sequelize.STRING(255), allowNull: false },
      debit: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      credit: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      narration: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('gl_accounts', ['tenant_id', 'company_id', 'code'], {
      unique: true,
      name: 'gl_accounts_tenant_company_code_uq',
    });
    await queryInterface.addIndex('gl_accounts', ['tenant_id', 'company_id', 'is_active'], {
      name: 'gl_accounts_scope_active_idx',
    });
    await queryInterface.addIndex('gl_vouchers', ['tenant_id', 'company_id', 'voucher_no'], {
      unique: true,
      name: 'gl_vouchers_tenant_company_no_uq',
    });
    await queryInterface.addIndex('gl_vouchers', ['tenant_id', 'company_id', 'voucher_date'], {
      name: 'gl_vouchers_scope_date_idx',
    });
    await queryInterface.addIndex('gl_vouchers', ['source_type', 'source_id'], {
      name: 'gl_vouchers_source_idx',
    });
    await queryInterface.addIndex('gl_voucher_lines', ['voucher_id', 'line_no'], {
      name: 'gl_voucher_lines_voucher_line_idx',
    });
    await queryInterface.addIndex('gl_voucher_lines', ['account_id'], {
      name: 'gl_voucher_lines_account_idx',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('gl_voucher_lines');
    await queryInterface.dropTable('gl_vouchers');
    await queryInterface.dropTable('gl_accounts');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_gl_vouchers_source_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_gl_vouchers_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_gl_vouchers_voucher_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_gl_accounts_account_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_gl_accounts_nature";');
  },
};
