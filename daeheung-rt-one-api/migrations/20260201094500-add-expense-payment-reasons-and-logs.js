'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TABLE \"expense_reports\" " +
        "ADD COLUMN IF NOT EXISTS \"payment_approved_reason\" TEXT, " +
        "ADD COLUMN IF NOT EXISTS \"payment_approved_at\" TIMESTAMP WITH TIME ZONE, " +
        "ADD COLUMN IF NOT EXISTS \"payment_approved_by\" INTEGER, " +
        "ADD COLUMN IF NOT EXISTS \"payment_rejected_reason\" TEXT, " +
        "ADD COLUMN IF NOT EXISTS \"payment_rejected_at\" TIMESTAMP WITH TIME ZONE, " +
        "ADD COLUMN IF NOT EXISTS \"payment_rejected_by\" INTEGER, " +
        "ADD COLUMN IF NOT EXISTS \"bank_transfer_logs\" JSONB DEFAULT '[]'::jsonb;"
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TABLE \"expense_reports\" " +
        "DROP COLUMN IF EXISTS \"payment_approved_reason\", " +
        "DROP COLUMN IF EXISTS \"payment_approved_at\", " +
        "DROP COLUMN IF EXISTS \"payment_approved_by\", " +
        "DROP COLUMN IF EXISTS \"payment_rejected_reason\", " +
        "DROP COLUMN IF EXISTS \"payment_rejected_at\", " +
        "DROP COLUMN IF EXISTS \"payment_rejected_by\", " +
        "DROP COLUMN IF EXISTS \"bank_transfer_logs\";"
    );
  }
};
