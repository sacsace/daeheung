'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('work_board_cards');
    if (!table.completed_at) {
      await queryInterface.addColumn('work_board_cards', 'completed_at', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE work_board_cards c
      SET completed_at = c.updated_at
      FROM work_board_lists l
      WHERE c.list_id = l.id
        AND c.completed_at IS NULL
        AND (
          LOWER(l.title) LIKE '%완료%'
          OR LOWER(l.title) LIKE '%done%'
          OR LOWER(l.title) LIKE '%completed%'
          OR LOWER(l.title) LIKE '%closed%'
          OR LOWER(l.title) LIKE '%종료%'
        );
    `);
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('work_board_cards');
    if (table.completed_at) {
      await queryInterface.removeColumn('work_board_cards', 'completed_at');
    }
  }
};
