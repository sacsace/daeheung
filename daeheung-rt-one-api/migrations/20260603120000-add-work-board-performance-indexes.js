'use strict';

/** 업무 보드·대시보드 집계 쿼리 성능 인덱스 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_work_board_members_user_id
      ON work_board_members(user_id);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_work_board_cards_assignee_user_id
      ON work_board_cards(assignee_user_id);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_work_board_cards_list_id
      ON work_board_cards(list_id);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_work_board_lists_board_id
      ON work_board_lists(board_id);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_work_board_lists_board_id;`);
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_work_board_cards_list_id;`);
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_work_board_cards_assignee_user_id;`);
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_work_board_members_user_id;`);
  },
};
