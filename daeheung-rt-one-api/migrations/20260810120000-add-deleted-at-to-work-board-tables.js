'use strict';

const TABLES = [
  'work_boards',
  'work_board_lists',
  'work_board_cards',
  'work_board_members',
  'work_board_card_comments'
];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    for (const table of TABLES) {
      const desc = await queryInterface.describeTable(table);
      if (!desc.deleted_at) {
        await queryInterface.addColumn(table, 'deleted_at', {
          type: Sequelize.DATE,
          allowNull: true,
          defaultValue: null
        });
      }
      try {
        await queryInterface.addIndex(table, ['deleted_at'], {
          name: `${table}_deleted_at_idx`
        });
      } catch (e) {
        // index may already exist
      }
    }
  },

  down: async (queryInterface) => {
    for (const table of TABLES) {
      try {
        await queryInterface.removeIndex(table, `${table}_deleted_at_idx`);
      } catch (e) {
        // ignore
      }
      const desc = await queryInterface.describeTable(table);
      if (desc.deleted_at) {
        await queryInterface.removeColumn(table, 'deleted_at');
      }
    }
  }
};
