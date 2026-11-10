/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

/** support_tickets: 모델(SupportTicket)과 DB 스키마 정렬 — category, last_response_at, company_id */
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "support_tickets"
      ADD COLUMN IF NOT EXISTS "category" VARCHAR(50) NOT NULL DEFAULT 'general',
      ADD COLUMN IF NOT EXISTS "last_response_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "company_id" INTEGER REFERENCES "companies"("id");
    `);

    await queryInterface.sequelize.query(`
      UPDATE "support_tickets" st
      SET "company_id" = c."id"
      FROM (
        SELECT MIN("id") AS "id" FROM "companies"
      ) c
      WHERE st."company_id" IS NULL AND c."id" IS NOT NULL;
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "support_tickets"
      DROP COLUMN IF EXISTS "company_id",
      DROP COLUMN IF EXISTS "last_response_at",
      DROP COLUMN IF EXISTS "category";
    `);
  }
};
