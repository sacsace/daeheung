'use strict';

/**
 * 정기 업무(RECURRING) 2단계:
 * - 템플릿
 * - 보드↔고객사 연결
 * - 고객사×템플릿 담당자 배정
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name || '')).map((s) =>
      String(s).toLowerCase()
    );

    if (!names.includes('recurring_task_templates')) {
      await queryInterface.createTable('recurring_task_templates', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        tenant_id: { type: Sequelize.INTEGER, allowNull: false },
        company_id: { type: Sequelize.INTEGER, allowNull: false },
        board_id: { type: Sequelize.INTEGER, allowNull: false },
        name: { type: Sequelize.STRING(200), allowNull: false },
        code: { type: Sequelize.STRING(50), allowNull: true },
        description: { type: Sequelize.TEXT, allowNull: true },
        category: { type: Sequelize.STRING(100), allowNull: true },
        frequency: {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: 'MONTHLY',
        },
        default_priority: {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: 'medium',
        },
        default_due_day: { type: Sequelize.INTEGER, allowNull: true },
        requires_attachment: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        requires_verification: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_by: { type: Sequelize.INTEGER, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      });
      await queryInterface.addIndex('recurring_task_templates', ['board_id', 'is_active'], {
        name: 'rtt_board_active_idx',
      });
      await queryInterface.addIndex('recurring_task_templates', ['tenant_id', 'company_id'], {
        name: 'rtt_tenant_company_idx',
      });
    }

    if (!names.includes('recurring_board_clients')) {
      await queryInterface.createTable('recurring_board_clients', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        tenant_id: { type: Sequelize.INTEGER, allowNull: false },
        company_id: { type: Sequelize.INTEGER, allowNull: false },
        board_id: { type: Sequelize.INTEGER, allowNull: false },
        customer_id: { type: Sequelize.INTEGER, allowNull: false },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_by: { type: Sequelize.INTEGER, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      });
      await queryInterface.addIndex(
        'recurring_board_clients',
        ['board_id', 'customer_id'],
        { name: 'rbc_board_customer_uq', unique: true }
      );
    }

    if (!names.includes('recurring_task_assignments')) {
      await queryInterface.createTable('recurring_task_assignments', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        tenant_id: { type: Sequelize.INTEGER, allowNull: false },
        company_id: { type: Sequelize.INTEGER, allowNull: false },
        board_id: { type: Sequelize.INTEGER, allowNull: false },
        customer_id: { type: Sequelize.INTEGER, allowNull: false },
        template_id: { type: Sequelize.INTEGER, allowNull: false },
        assigned_user_id: { type: Sequelize.INTEGER, allowNull: true },
        reviewer_user_id: { type: Sequelize.INTEGER, allowNull: true },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_by: { type: Sequelize.INTEGER, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      });
      await queryInterface.addIndex(
        'recurring_task_assignments',
        ['board_id', 'customer_id', 'template_id'],
        { name: 'rta_board_customer_template_uq', unique: true }
      );
      await queryInterface.addIndex('recurring_task_assignments', ['assigned_user_id'], {
        name: 'rta_assignee_idx',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('recurring_task_assignments');
    await queryInterface.dropTable('recurring_board_clients');
    await queryInterface.dropTable('recurring_task_templates');
  },
};
