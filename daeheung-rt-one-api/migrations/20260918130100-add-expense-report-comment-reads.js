'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TABLE \"expense_reports\" ADD COLUMN IF NOT EXISTS \"comment_reads\" JSONB DEFAULT '{}'::jsonb;"
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE "expense_reports" DROP COLUMN IF EXISTS "comment_reads";'
    );
  },
};
