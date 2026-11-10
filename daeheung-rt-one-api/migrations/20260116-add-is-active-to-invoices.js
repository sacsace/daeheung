/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add is_active to invoices if missing
    await queryInterface.sequelize.query(`
      ALTER TABLE "invoices"
      ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
    `);

    // Add is_active to invoice_items if missing
    await queryInterface.sequelize.query(`
      ALTER TABLE "invoice_items"
      ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "invoice_items"
      DROP COLUMN IF EXISTS "is_active";
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "invoices"
      DROP COLUMN IF EXISTS "is_active";
    `);
  }
};
