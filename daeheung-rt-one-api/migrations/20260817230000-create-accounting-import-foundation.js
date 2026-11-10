'use strict';

/**
 * SAP 등 외부 회계 Import의 공통 기반.
 * 아직 파일 파싱·전표 변환을 수행하지 않으며, 재시도/검증/매핑 이력을 보존할 데이터 구조만 추가한다.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;

    await sequelize.query(`
      DO $$ BEGIN
        ALTER TYPE "enum_gl_vouchers_source_type" ADD VALUE IF NOT EXISTS 'sap_import';
        ALTER TYPE "enum_gl_vouchers_source_type" ADD VALUE IF NOT EXISTS 'tally_import';
        ALTER TYPE "enum_gl_vouchers_source_type" ADD VALUE IF NOT EXISTS 'bank_import';
        ALTER TYPE "enum_gl_vouchers_source_type" ADD VALUE IF NOT EXISTS 'ocr';
        ALTER TYPE "enum_gl_vouchers_source_type" ADD VALUE IF NOT EXISTS 'api';
      EXCEPTION WHEN undefined_object THEN null; END $$;
    `);

    const [voucherColumns] = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'gl_vouchers' AND column_name = 'source_correlation_id'
    `);
    if (!voucherColumns.length) {
      await queryInterface.addColumn('gl_vouchers', 'source_correlation_id', {
        type: Sequelize.STRING(80),
        allowNull: true,
      });
      await queryInterface.addIndex(
        'gl_vouchers',
        ['tenant_id', 'company_id', 'source_type', 'source_correlation_id'],
        { name: 'gl_vouchers_source_correlation_idx' }
      );
    }

    await queryInterface.createTable('ac_import_templates', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      tenant_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'tenants', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      company_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'companies', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      source_system: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'sap' },
      name: { type: Sequelize.STRING(120), allowNull: false },
      file_format: { type: Sequelize.STRING(10), allowNull: false },
      sheet_name: { type: Sequelize.STRING(120), allowNull: true },
      header_row_number: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      column_mapping: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      document_group_keys: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: ['companyCode', 'fiscalYear', 'documentNumber'],
      },
      amount_mode: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'separate_columns' },
      debit_credit_config: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      updated_by: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('ac_import_batches', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      tenant_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'tenants', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      company_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'companies', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      financial_year_id: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'ac_financial_years', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      template_id: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'ac_import_templates', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      source_system: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'sap' },
      source_company_code: { type: Sequelize.STRING(50), allowNull: true },
      file_name: { type: Sequelize.STRING(255), allowNull: false },
      file_path: { type: Sequelize.STRING(500), allowNull: true },
      file_mime_type: { type: Sequelize.STRING(120), allowNull: true },
      file_size_bytes: { type: Sequelize.BIGINT, allowNull: true },
      file_sha256: { type: Sequelize.STRING(64), allowNull: false },
      status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'uploaded' },
      total_rows: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      total_documents: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      valid_documents: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      warning_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      error_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      mapping_required_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      converted_documents: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      started_at: { type: Sequelize.DATE, allowNull: true },
      completed_at: { type: Sequelize.DATE, allowNull: true },
      cancelled_at: { type: Sequelize.DATE, allowNull: true },
      failure_detail: { type: Sequelize.JSONB, allowNull: true },
      created_by: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      updated_by: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('ac_import_source_documents', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      tenant_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'tenants', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      company_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'companies', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      source_system: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'sap' },
      source_company_code: { type: Sequelize.STRING(50), allowNull: false },
      fiscal_year: { type: Sequelize.STRING(20), allowNull: false },
      source_document_number: { type: Sequelize.STRING(80), allowNull: false },
      source_document_key: { type: Sequelize.STRING(255), allowNull: false },
      source_posting_date: { type: Sequelize.DATEONLY, allowNull: true },
      raw_document: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      normalized_document: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      latest_file_sha256: { type: Sequelize.STRING(64), allowNull: true },
      status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'parsed' },
      voucher_id: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'gl_vouchers', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      source_correlation_id: { type: Sequelize.STRING(80), allowNull: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('ac_import_batch_documents', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      batch_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'ac_import_batches', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      source_document_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'ac_import_source_documents', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      first_row_number: { type: Sequelize.INTEGER, allowNull: true },
      row_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'parsed' },
      validation_summary: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      override_values: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      source_fields: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('ac_import_mappings', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      tenant_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'tenants', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      company_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'companies', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      source_system: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'sap' },
      mapping_type: { type: Sequelize.STRING(30), allowNull: false },
      source_code: { type: Sequelize.STRING(120), allowNull: true },
      source_name: { type: Sequelize.STRING(255), allowNull: true },
      normalized_source_value: { type: Sequelize.STRING(255), allowNull: true },
      target_account_id: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'gl_accounts', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      target_partner_id: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'partners', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      target_gst_code_id: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'ac_gst_codes', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'suggested' },
      confidence_score: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      mapping_source: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'system' },
      reason: { type: Sequelize.TEXT, allowNull: true },
      approved_by: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      approved_at: { type: Sequelize.DATE, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      updated_by: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('ac_import_issues', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      batch_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'ac_import_batches', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      source_document_id: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'ac_import_source_documents', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      row_number: { type: Sequelize.INTEGER, allowNull: true },
      code: { type: Sequelize.STRING(100), allowNull: false },
      severity: { type: Sequelize.STRING(10), allowNull: false },
      field_name: { type: Sequelize.STRING(100), allowNull: true },
      source_value: { type: Sequelize.TEXT, allowNull: true },
      message: { type: Sequelize.TEXT, allowNull: false },
      suggested_action: { type: Sequelize.TEXT, allowNull: true },
      is_resolved: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      resolved_by: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      resolved_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('ac_import_templates', ['tenant_id', 'company_id', 'source_system', 'is_active'], {
      name: 'ac_import_templates_scope_active_idx',
    });
    await queryInterface.addIndex('ac_import_batches', ['tenant_id', 'company_id', 'file_sha256'], {
      name: 'ac_import_batches_scope_file_hash_idx',
    });
    await queryInterface.addIndex('ac_import_batches', ['tenant_id', 'company_id', 'status', 'created_at'], {
      name: 'ac_import_batches_scope_status_idx',
    });
    await queryInterface.addIndex(
      'ac_import_source_documents',
      ['tenant_id', 'company_id', 'source_system', 'source_document_key'],
      { unique: true, name: 'ac_import_source_documents_idempotency_uq' }
    );
    await queryInterface.addIndex('ac_import_source_documents', ['tenant_id', 'company_id', 'status', 'source_posting_date'], {
      name: 'ac_import_source_documents_scope_status_date_idx',
    });
    await queryInterface.addIndex('ac_import_batch_documents', ['batch_id', 'source_document_id'], {
      unique: true, name: 'ac_import_batch_documents_batch_source_uq',
    });
    await queryInterface.addIndex(
      'ac_import_mappings',
      ['tenant_id', 'company_id', 'source_system', 'mapping_type', 'source_code', 'is_active'],
      { name: 'ac_import_mappings_code_lookup_idx' }
    );
    await queryInterface.addIndex(
      'ac_import_mappings',
      ['tenant_id', 'company_id', 'source_system', 'mapping_type', 'normalized_source_value', 'is_active'],
      { name: 'ac_import_mappings_normalized_lookup_idx' }
    );
    await queryInterface.addIndex('ac_import_issues', ['batch_id', 'severity', 'is_resolved'], {
      name: 'ac_import_issues_batch_severity_idx',
    });
    await queryInterface.addIndex('ac_import_issues', ['source_document_id'], {
      name: 'ac_import_issues_source_document_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ac_import_issues');
    await queryInterface.dropTable('ac_import_mappings');
    await queryInterface.dropTable('ac_import_batch_documents');
    await queryInterface.dropTable('ac_import_source_documents');
    await queryInterface.dropTable('ac_import_batches');
    await queryInterface.dropTable('ac_import_templates');
    try {
      await queryInterface.removeIndex('gl_vouchers', 'gl_vouchers_source_correlation_idx');
      await queryInterface.removeColumn('gl_vouchers', 'source_correlation_id');
    } catch (_) {
      // 기존 운영 데이터 안전을 위해 rollback 시 이미 제거된 확장은 무시한다.
    }
  },
};
