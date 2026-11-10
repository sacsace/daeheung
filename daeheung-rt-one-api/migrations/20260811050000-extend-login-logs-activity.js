'use strict';

/** login_logs에 감사 이벤트 컬럼 추가 (로그인 외 삭제/로그아웃 등) */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name));
    if (!names.includes('login_logs')) return;

    const table = await queryInterface.describeTable('login_logs');
    if (!table.event_type) {
      await queryInterface.addColumn('login_logs', 'event_type', {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'login',
      });
    }
    if (!table.resource) {
      await queryInterface.addColumn('login_logs', 'resource', {
        type: Sequelize.STRING(120),
        allowNull: true,
      });
    }

    try {
      await queryInterface.addIndex('login_logs', ['tenant_id', 'logged_at'], {
        name: 'login_logs_tenant_logged_at_idx',
      });
    } catch {
      /* index may already exist */
    }
    try {
      await queryInterface.addIndex('login_logs', ['event_type'], {
        name: 'login_logs_event_type_idx',
      });
    } catch {
      /* ignore */
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name));
    if (!names.includes('login_logs')) return;
    const table = await queryInterface.describeTable('login_logs');
    if (table.resource) await queryInterface.removeColumn('login_logs', 'resource');
    if (table.event_type) await queryInterface.removeColumn('login_logs', 'event_type');
  },
};
