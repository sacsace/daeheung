'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('work_board_card_comments');
    if (table.parent_id) return;

    await queryInterface.addColumn('work_board_card_comments', 'parent_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'work_board_card_comments', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
    await queryInterface.addIndex('work_board_card_comments', ['parent_id'], {
      name: 'work_board_card_comments_parent_id_idx'
    });
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable('work_board_card_comments');
    if (!table.parent_id) return;
    await queryInterface.removeIndex('work_board_card_comments', 'work_board_card_comments_parent_id_idx').catch(() => {});
    await queryInterface.removeColumn('work_board_card_comments', 'parent_id');
  }
};
