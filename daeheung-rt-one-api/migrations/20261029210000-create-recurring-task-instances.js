'use strict';

/**
 * 정기 업무 3단계: 기간별 인스턴스 (고객사 × 템플릿 × period)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = tables
      .map((t) => (typeof t === 'string' ? t : t.tableName || t.name || ''))
      .map((s) => String(s).toLowerCase());

    if (!names.includes('recurring_task_instances')) {
      await queryInterface.createTable('recurring_task_instances', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        tenant_id: { type: Sequelize.INTEGER, allowNull: false },
        company_id: { type: Sequelize.INTEGER, allowNull: false },
        board_id: { type: Sequelize.INTEGER, allowNull: false },
        template_id: { type: Sequelize.INTEGER, allowNull: false },
        customer_id: { type: Sequelize.INTEGER, allowNull: false },
        period: { type: Sequelize.STRING(7), allowNull: false },
        period_start: { type: Sequelize.DATEONLY, allowNull: false },
        period_end: { type: Sequelize.DATEONLY, allowNull: false },
        due_date: { type: Sequelize.DATEONLY, allowNull: true },
        status: {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: 'PENDING',
        },
        assigned_user_id: { type: Sequelize.INTEGER, allowNull: true },
        reviewer_user_id: { type: Sequelize.INTEGER, allowNull: true },
        completed_by: { type: Sequelize.INTEGER, allowNull: true },
        completed_at: { type: Sequelize.DATE, allowNull: true },
        verified_by: { type: Sequelize.INTEGER, allowNull: true },
        verified_at: { type: Sequelize.DATE, allowNull: true },
        notes: { type: Sequelize.TEXT, allowNull: true },
        created_by: { type: Sequelize.INTEGER, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      });
      await queryInterface.addIndex(
        'recurring_task_instances',
        ['board_id', 'template_id', 'customer_id', 'period'],
        { name: 'rti_board_template_customer_period_uq', unique: true }
      );
      await queryInterface.addIndex('recurring_task_instances', ['board_id', 'period', 'status'], {
        name: 'rti_board_period_status_idx',
      });
      await queryInterface.addIndex('recurring_task_instances', ['assigned_user_id'], {
        name: 'rti_assignee_idx',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('recurring_task_instances');
  },
};
