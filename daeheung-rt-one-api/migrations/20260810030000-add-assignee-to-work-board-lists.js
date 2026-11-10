'use strict';

/** @param {import('sequelize').QueryInterface} queryInterface */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('work_board_lists').catch(() => null);
    if (!table) return;
    if (!table.assignee_user_id) {
      await queryInterface.addColumn('work_board_lists', 'assignee_user_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
      await queryInterface.addIndex('work_board_lists', ['assignee_user_id'], {
        name: 'work_board_lists_assignee_user_id_idx',
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('work_board_lists').catch(() => null);
    if (!table || !table.assignee_user_id) return;
    await queryInterface.removeIndex('work_board_lists', 'work_board_lists_assignee_user_id_idx').catch(() => {});
    await queryInterface.removeColumn('work_board_lists', 'assignee_user_id');
  },
};
