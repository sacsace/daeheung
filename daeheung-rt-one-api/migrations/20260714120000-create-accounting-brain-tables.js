'use strict';

/**
 * Accounting Brain:
 * - audit logs (prompt / rules / recommendation / user approval trail)
 * - learning corrections (accountant edits → future recommendations)
 * NEVER stores posting credentials; posting remains in GL engine only.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('accounting_brain_audit_logs', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      tenant_id: { type: Sequelize.INTEGER, allowNull: false },
      company_id: { type: Sequelize.INTEGER, allowNull: false },
      financial_year_id: { type: Sequelize.INTEGER, allowNull: true },
      user_id: { type: Sequelize.INTEGER, allowNull: true },
      request_id: { type: Sequelize.STRING(64), allowNull: false },
      action: { type: Sequelize.STRING(40), allowNull: false },
      source: { type: Sequelize.STRING(40), allowNull: true },
      prompt: { type: Sequelize.TEXT, allowNull: true },
      retrieved_context: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      applied_rules: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      recommendation: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      confidence_score: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      validation_result: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      user_changes: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      approval: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('accounting_brain_audit_logs', ['tenant_id', 'company_id', 'created_at'], {
      name: 'idx_brain_audit_tenant_company_created',
    });
    await queryInterface.addIndex('accounting_brain_audit_logs', ['request_id'], {
      name: 'idx_brain_audit_request_id',
    });

    await queryInterface.createTable('ai_learning_corrections', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      tenant_id: { type: Sequelize.INTEGER, allowNull: false },
      company_id: { type: Sequelize.INTEGER, allowNull: false },
      user_id: { type: Sequelize.INTEGER, allowNull: true },
      source_type: { type: Sequelize.STRING(40), allowNull: false, defaultValue: 'auto_voucher' },
      source_id: { type: Sequelize.INTEGER, allowNull: true },
      counterparty_name: { type: Sequelize.STRING(255), allowNull: true },
      keyword: { type: Sequelize.STRING(120), allowNull: true },
      doc_type: { type: Sequelize.STRING(40), allowNull: true },
      field_name: { type: Sequelize.STRING(60), allowNull: false },
      before_value: { type: Sequelize.TEXT, allowNull: true },
      after_value: { type: Sequelize.TEXT, allowNull: true },
      recommendation_snapshot: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('ai_learning_corrections', ['tenant_id', 'company_id', 'is_active'], {
      name: 'idx_ai_learning_tenant_company_active',
    });
    await queryInterface.addIndex('ai_learning_corrections', ['tenant_id', 'company_id', 'keyword'], {
      name: 'idx_ai_learning_keyword',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ai_learning_corrections');
    await queryInterface.dropTable('accounting_brain_audit_logs');
  },
};
