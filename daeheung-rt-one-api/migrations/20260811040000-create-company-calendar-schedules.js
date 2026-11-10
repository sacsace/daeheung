'use strict';

/** 회사 공통 연간 스케줄 (모든 사용자 공유) */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name));
    if (names.includes('company_calendar_schedules')) return;

    await queryInterface.createTable('company_calendar_schedules', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      tenant_id: { type: Sequelize.INTEGER, allowNull: false },
      company_id: { type: Sequelize.INTEGER, allowNull: false },
      schedule_date: { type: Sequelize.DATEONLY, allowNull: false },
      title: { type: Sequelize.STRING(255), allowNull: false },
      is_holiday: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('company_calendar_schedules', ['tenant_id', 'company_id', 'is_active'], {
      name: 'company_calendar_schedules_scope_active_idx',
    });
    await queryInterface.addIndex('company_calendar_schedules', ['tenant_id', 'company_id', 'schedule_date'], {
      name: 'company_calendar_schedules_scope_date_idx',
    });
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name));
    if (names.includes('company_calendar_schedules')) {
      await queryInterface.dropTable('company_calendar_schedules');
    }
  },
};
