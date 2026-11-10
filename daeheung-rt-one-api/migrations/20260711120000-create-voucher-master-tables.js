'use strict';

/** 전표 입력 마스터 테이블 + gl_vouchers/lines/accounts 확장 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        ALTER TYPE "enum_gl_vouchers_status" ADD VALUE IF NOT EXISTS 'review_required';
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        ALTER TYPE "enum_gl_vouchers_status" ADD VALUE IF NOT EXISTS 'approved';
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        ALTER TYPE "enum_gl_vouchers_status" ADD VALUE IF NOT EXISTS 'rejected';
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        ALTER TYPE "enum_gl_vouchers_status" ADD VALUE IF NOT EXISTS 'reversed';
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryInterface.createTable('ac_financial_years', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
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
      name: { type: Sequelize.STRING(50), allowNull: false },
      start_date: { type: Sequelize.DATEONLY, allowNull: false },
      end_date: { type: Sequelize.DATEONLY, allowNull: false },
      is_open: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('ac_voucher_types', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      tenant_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'tenants', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      company_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'companies', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      code: { type: Sequelize.STRING(20), allowNull: false },
      name_ko: { type: Sequelize.STRING(100), allowNull: false },
      name_en: { type: Sequelize.STRING(100), allowNull: true },
      prefix: { type: Sequelize.STRING(20), allowNull: false },
      category: { type: Sequelize.STRING(30), allowNull: false },
      icon: { type: Sequelize.STRING(50), allowNull: true },
      legacy_type: { type: Sequelize.STRING(20), allowNull: true },
      requires_party: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      requires_attachment: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      requires_narration: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      approval_required: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('ac_gst_codes', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      tenant_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'tenants', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      company_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'companies', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      code: { type: Sequelize.STRING(30), allowNull: false },
      name: { type: Sequelize.STRING(100), allowNull: false },
      rate: { type: Sequelize.DECIMAL(8, 4), allowNull: false, defaultValue: 0 },
      tax_type: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'cgst_sgst' },
      cgst_rate: { type: Sequelize.DECIMAL(8, 4), allowNull: false, defaultValue: 0 },
      sgst_rate: { type: Sequelize.DECIMAL(8, 4), allowNull: false, defaultValue: 0 },
      igst_rate: { type: Sequelize.DECIMAL(8, 4), allowNull: false, defaultValue: 0 },
      cess_rate: { type: Sequelize.DECIMAL(8, 4), allowNull: false, defaultValue: 0 },
      io_type: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'input' },
      input_account_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'gl_accounts', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      output_account_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'gl_accounts', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      effective_from: { type: Sequelize.DATEONLY, allowNull: true },
      effective_to: { type: Sequelize.DATEONLY, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('ac_tds_codes', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      tenant_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'tenants', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      company_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'companies', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      section: { type: Sequelize.STRING(20), allowNull: false },
      description: { type: Sequelize.STRING(255), allowNull: true },
      individual_rate: { type: Sequelize.DECIMAL(8, 4), allowNull: false, defaultValue: 0 },
      company_rate: { type: Sequelize.DECIMAL(8, 4), allowNull: false, defaultValue: 0 },
      no_pan_rate: { type: Sequelize.DECIMAL(8, 4), allowNull: false, defaultValue: 0 },
      threshold_amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      payable_account_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'gl_accounts', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      effective_from: { type: Sequelize.DATEONLY, allowNull: true },
      effective_to: { type: Sequelize.DATEONLY, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('ac_bank_accounts', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      tenant_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'tenants', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      company_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'companies', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      bank_name: { type: Sequelize.STRING(100), allowNull: false },
      account_name: { type: Sequelize.STRING(100), allowNull: false },
      account_number: { type: Sequelize.STRING(50), allowNull: true },
      ifsc: { type: Sequelize.STRING(20), allowNull: true },
      branch_name: { type: Sequelize.STRING(100), allowNull: true },
      currency: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'INR' },
      ledger_account_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'gl_accounts', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      opening_balance: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('ac_transaction_items', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      tenant_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'tenants', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      company_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'companies', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      code: { type: Sequelize.STRING(30), allowNull: false },
      name_ko: { type: Sequelize.STRING(100), allowNull: false },
      name_en: { type: Sequelize.STRING(100), allowNull: true },
      keywords: { type: Sequelize.TEXT, allowNull: true },
      voucher_type_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'ac_voucher_types', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      debit_account_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'gl_accounts', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      credit_account_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'gl_accounts', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      default_gst_code_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'ac_gst_codes', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      default_tds_code_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'ac_tds_codes', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      party_required: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      attachment_required: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('ac_voucher_audit_logs', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      voucher_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'gl_vouchers', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      action: { type: Sequelize.STRING(50), allowNull: false },
      field_name: { type: Sequelize.STRING(100), allowNull: true },
      old_value: { type: Sequelize.TEXT, allowNull: true },
      new_value: { type: Sequelize.TEXT, allowNull: true },
      meta: { type: Sequelize.JSONB, allowNull: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    const glAccountCols = [
      ['search_aliases', { type: Sequelize.TEXT, allowNull: true }],
      ['account_group', { type: Sequelize.STRING(100), allowNull: true }],
      ['is_cash_or_bank', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false }],
      ['is_ar_ap', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false }],
      ['party_required', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false }],
    ];
    for (const [name, def] of glAccountCols) {
      const [cols] = await queryInterface.sequelize.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'gl_accounts' AND column_name = '${name}'`
      );
      if (!cols.length) await queryInterface.addColumn('gl_accounts', name, def);
    }

    const glVoucherCols = [
      ['party_id', { type: Sequelize.INTEGER, allowNull: true, references: { model: 'partners', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' }],
      ['voucher_type_id', { type: Sequelize.INTEGER, allowNull: true, references: { model: 'ac_voucher_types', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' }],
      ['financial_year_id', { type: Sequelize.INTEGER, allowNull: true, references: { model: 'ac_financial_years', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' }],
      ['posting_date', { type: Sequelize.DATEONLY, allowNull: true }],
      ['invoice_number', { type: Sequelize.STRING(50), allowNull: true }],
      ['invoice_date', { type: Sequelize.DATEONLY, allowNull: true }],
      ['input_mode', { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'simple' }],
      ['currency_code', { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'INR' }],
      ['exchange_rate', { type: Sequelize.DECIMAL(15, 6), allowNull: false, defaultValue: 1 }],
      ['amount_details', { type: Sequelize.JSONB, allowNull: true }],
      ['submitted_by', { type: Sequelize.INTEGER, allowNull: true, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' }],
      ['approved_by_user', { type: Sequelize.INTEGER, allowNull: true, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' }],
      ['rejected_by', { type: Sequelize.INTEGER, allowNull: true, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' }],
      ['submitted_at', { type: Sequelize.DATE, allowNull: true }],
      ['approved_at', { type: Sequelize.DATE, allowNull: true }],
      ['rejected_at', { type: Sequelize.DATE, allowNull: true }],
      ['rejection_reason', { type: Sequelize.TEXT, allowNull: true }],
      ['reversed_voucher_id', { type: Sequelize.INTEGER, allowNull: true, references: { model: 'gl_vouchers', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' }],
      ['reversal_reason', { type: Sequelize.TEXT, allowNull: true }],
    ];
    for (const [name, def] of glVoucherCols) {
      const [cols] = await queryInterface.sequelize.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'gl_vouchers' AND column_name = '${name}'`
      );
      if (!cols.length) await queryInterface.addColumn('gl_vouchers', name, def);
    }

    const glLineCols = [
      ['party_id', { type: Sequelize.INTEGER, allowNull: true, references: { model: 'partners', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' }],
      ['gst_code_id', { type: Sequelize.INTEGER, allowNull: true, references: { model: 'ac_gst_codes', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' }],
      ['tds_code_id', { type: Sequelize.INTEGER, allowNull: true, references: { model: 'ac_tds_codes', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' }],
      ['transaction_item_id', { type: Sequelize.INTEGER, allowNull: true, references: { model: 'ac_transaction_items', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' }],
      ['taxable_amount', { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 }],
      ['tax_amount', { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 }],
      ['line_category', { type: Sequelize.STRING(30), allowNull: true }],
    ];
    for (const [name, def] of glLineCols) {
      const [cols] = await queryInterface.sequelize.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'gl_voucher_lines' AND column_name = '${name}'`
      );
      if (!cols.length) await queryInterface.addColumn('gl_voucher_lines', name, def);
    }

    await queryInterface.addIndex('ac_voucher_types', ['tenant_id', 'company_id', 'code'], { unique: true, name: 'ac_voucher_types_scope_code_uq' });
    await queryInterface.addIndex('ac_transaction_items', ['tenant_id', 'company_id', 'code'], { unique: true, name: 'ac_transaction_items_scope_code_uq' });
    await queryInterface.addIndex('ac_gst_codes', ['tenant_id', 'company_id', 'code'], { unique: true, name: 'ac_gst_codes_scope_code_uq' });
    await queryInterface.addIndex('ac_tds_codes', ['tenant_id', 'company_id', 'section'], { unique: true, name: 'ac_tds_codes_scope_section_uq' });
    await queryInterface.addIndex('ac_bank_accounts', ['tenant_id', 'company_id', 'account_number'], { name: 'ac_bank_accounts_scope_idx' });
    await queryInterface.addIndex('ac_financial_years', ['tenant_id', 'company_id', 'start_date'], { name: 'ac_financial_years_scope_idx' });
    await queryInterface.addIndex('ac_voucher_audit_logs', ['voucher_id', 'created_at'], { name: 'ac_voucher_audit_logs_voucher_idx' });
  },

  async down(queryInterface) {
    const dropCols = async (table, cols) => {
      for (const col of cols) {
        try { await queryInterface.removeColumn(table, col); } catch (_) { /* ignore */ }
      }
    };
    await dropCols('gl_voucher_lines', ['party_id', 'gst_code_id', 'tds_code_id', 'transaction_item_id', 'taxable_amount', 'tax_amount', 'line_category']);
    await dropCols('gl_vouchers', [
      'party_id', 'voucher_type_id', 'financial_year_id', 'posting_date', 'invoice_number', 'invoice_date',
      'input_mode', 'currency_code', 'exchange_rate', 'amount_details', 'submitted_by', 'approved_by_user',
      'rejected_by', 'submitted_at', 'approved_at', 'rejected_at', 'rejection_reason', 'reversed_voucher_id', 'reversal_reason',
    ]);
    await dropCols('gl_accounts', ['search_aliases', 'account_group', 'is_cash_or_bank', 'is_ar_ap', 'party_required']);
    await queryInterface.dropTable('ac_voucher_audit_logs');
    await queryInterface.dropTable('ac_transaction_items');
    await queryInterface.dropTable('ac_bank_accounts');
    await queryInterface.dropTable('ac_tds_codes');
    await queryInterface.dropTable('ac_gst_codes');
    await queryInterface.dropTable('ac_voucher_types');
    await queryInterface.dropTable('ac_financial_years');
  },
};
