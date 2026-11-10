'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TABLE \"work_board_cards\" ADD COLUMN IF NOT EXISTS \"attachments\" JSONB DEFAULT '[]'::jsonb;"
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE "work_board_cards" DROP COLUMN IF EXISTS "attachments";'
    );
  },
};
