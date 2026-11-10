'use strict';

/** 공지사항 투표(익명, 1인 1표) */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name));

    if (!names.includes('notice_polls')) {
      await queryInterface.createTable('notice_polls', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        tenant_id: { type: Sequelize.INTEGER, allowNull: false },
        company_id: { type: Sequelize.INTEGER, allowNull: false },
        notice_id: { type: Sequelize.INTEGER, allowNull: false },
        question: { type: Sequelize.STRING(500), allowNull: false },
        closes_at: { type: Sequelize.DATE, allowNull: true },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await queryInterface.addIndex('notice_polls', ['notice_id'], {
        name: 'notice_polls_notice_id_uq',
        unique: true,
      });
      await queryInterface.addIndex('notice_polls', ['tenant_id', 'company_id', 'is_active'], {
        name: 'notice_polls_tenant_company_active_idx',
      });
    }

    if (!names.includes('notice_poll_options')) {
      await queryInterface.createTable('notice_poll_options', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        poll_id: { type: Sequelize.INTEGER, allowNull: false },
        label: { type: Sequelize.STRING(300), allowNull: false },
        sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await queryInterface.addIndex('notice_poll_options', ['poll_id', 'is_active'], {
        name: 'notice_poll_options_poll_active_idx',
      });
    }

    if (!names.includes('notice_poll_votes')) {
      await queryInterface.createTable('notice_poll_votes', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        tenant_id: { type: Sequelize.INTEGER, allowNull: false },
        company_id: { type: Sequelize.INTEGER, allowNull: false },
        poll_id: { type: Sequelize.INTEGER, allowNull: false },
        option_id: { type: Sequelize.INTEGER, allowNull: false },
        user_id: { type: Sequelize.INTEGER, allowNull: false },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await queryInterface.addIndex('notice_poll_votes', ['poll_id', 'user_id'], {
        name: 'notice_poll_votes_poll_user_uq',
        unique: true,
      });
      await queryInterface.addIndex('notice_poll_votes', ['poll_id', 'option_id'], {
        name: 'notice_poll_votes_poll_option_idx',
      });
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name));
    if (names.includes('notice_poll_votes')) await queryInterface.dropTable('notice_poll_votes');
    if (names.includes('notice_poll_options')) await queryInterface.dropTable('notice_poll_options');
    if (names.includes('notice_polls')) await queryInterface.dropTable('notice_polls');
  },
};
