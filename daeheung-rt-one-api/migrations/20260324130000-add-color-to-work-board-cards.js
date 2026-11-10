'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('work_board_cards', 'color', {
      type: Sequelize.STRING(7),
      allowNull: true
    });
    await queryInterface.addIndex('work_board_cards', ['color']);
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('work_board_cards', ['color']);
    await queryInterface.removeColumn('work_board_cards', 'color');
  }
};
