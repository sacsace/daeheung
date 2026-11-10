'use strict';

/** 정기 업무 인스턴스 첨부(JSON) */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'recurring_task_instances';
    const tables = await queryInterface.showAllTables();
    const names = tables
      .map((t) => (typeof t === 'string' ? t : t.tableName || t.name || ''))
      .map((s) => String(s).toLowerCase());
    if (!names.includes(table)) return;

    const desc = await queryInterface.describeTable(table);
    if (!desc.attachments) {
      await queryInterface.addColumn(table, 'attachments', {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      });
    }
  },

  async down(queryInterface) {
    const table = 'recurring_task_instances';
    const tables = await queryInterface.showAllTables();
    const names = tables
      .map((t) => (typeof t === 'string' ? t : t.tableName || t.name || ''))
      .map((s) => String(s).toLowerCase());
    if (!names.includes(table)) return;
    const desc = await queryInterface.describeTable(table);
    if (desc.attachments) {
      await queryInterface.removeColumn(table, 'attachments');
    }
  },
};
