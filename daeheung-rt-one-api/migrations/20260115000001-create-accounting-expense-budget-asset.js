'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_expense_reports_status" AS ENUM('draft', 'submitted', 'in_review', 'approved', 'rejected', 'paid');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_expense_reports_priority" AS ENUM('low', 'medium', 'high', 'urgent');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_budgets_status" AS ENUM('draft', 'pending', 'approved', 'active', 'completed', 'cancelled');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_budgets_type" AS ENUM('annual', 'quarterly', 'monthly', 'project');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_assets_status" AS ENUM('active', 'maintenance', 'disposed', 'lost', 'transferred');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_assets_depreciation_method" AS ENUM('straight_line', 'declining_balance', 'units_of_production');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.createTable('expense_reports', {
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
      expense_id: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      title: { type: Sequelize.STRING(255), allowNull: false },
      requester_id: { type: Sequelize.INTEGER, allowNull: false },
      requester_name: { type: Sequelize.STRING(100), allowNull: false },
      requester_department: { type: Sequelize.STRING(100), allowNull: true },
      requester_position: { type: Sequelize.STRING(100), allowNull: true },
      total_amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      currency: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'KRW' },
      purpose: { type: Sequelize.TEXT, allowNull: false },
      items: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
      status: { type: Sequelize.ENUM('draft', 'submitted', 'in_review', 'approved', 'rejected', 'paid'), allowNull: false, defaultValue: 'draft' },
      priority: { type: Sequelize.ENUM('low', 'medium', 'high', 'urgent'), allowNull: false, defaultValue: 'medium' },
      current_approver_id: { type: Sequelize.INTEGER, allowNull: true },
      approval_flow: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
      submitted_at: { type: Sequelize.DATE, allowNull: true },
      due_date: { type: Sequelize.DATEONLY, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      attachments: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') }
    });

    await queryInterface.createTable('budgets', {
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
      budget_id: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(255), allowNull: false },
      type: { type: Sequelize.ENUM('annual', 'quarterly', 'monthly', 'project'), allowNull: false },
      period: { type: Sequelize.STRING(20), allowNull: false },
      start_date: { type: Sequelize.DATEONLY, allowNull: false },
      end_date: { type: Sequelize.DATEONLY, allowNull: false },
      total_planned: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      total_actual: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      total_variance: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      variance_percentage: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
      status: { type: Sequelize.ENUM('draft', 'pending', 'approved', 'active', 'completed', 'cancelled'), allowNull: false, defaultValue: 'draft' },
      items: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
      created_by: { type: Sequelize.STRING(100), allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      approved_by: { type: Sequelize.STRING(100), allowNull: true },
      approved_at: { type: Sequelize.DATE, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') }
    });

    await queryInterface.createTable('assets', {
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
      asset_code: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(255), allowNull: false },
      category: { type: Sequelize.STRING(100), allowNull: false },
      subcategory: { type: Sequelize.STRING(100), allowNull: true },
      purchase_date: { type: Sequelize.DATEONLY, allowNull: true },
      purchase_price: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      current_value: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      depreciation_rate: { type: Sequelize.FLOAT, allowNull: true },
      accumulated_depreciation: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      location: { type: Sequelize.STRING(255), allowNull: true },
      status: { type: Sequelize.ENUM('active', 'maintenance', 'disposed', 'lost', 'transferred'), allowNull: false, defaultValue: 'active' },
      maintenance_date: { type: Sequelize.DATEONLY, allowNull: true },
      next_maintenance: { type: Sequelize.DATEONLY, allowNull: true },
      warranty_expiry: { type: Sequelize.DATEONLY, allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      vendor: { type: Sequelize.STRING(100), allowNull: true },
      serial_number: { type: Sequelize.STRING(100), allowNull: true },
      assigned_to: { type: Sequelize.STRING(100), allowNull: true },
      department: { type: Sequelize.STRING(100), allowNull: true },
      useful_life: { type: Sequelize.INTEGER, allowNull: true },
      depreciation_method: { type: Sequelize.ENUM('straight_line', 'declining_balance', 'units_of_production'), allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') }
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('assets');
    await queryInterface.dropTable('budgets');
    await queryInterface.dropTable('expense_reports');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_assets_depreciation_method";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_assets_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_budgets_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_budgets_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_expense_reports_priority";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_expense_reports_status";');
  }
};
