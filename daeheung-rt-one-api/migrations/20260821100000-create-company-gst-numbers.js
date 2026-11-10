'use strict';

/**
 * company_gst_numbers: 모델·회사 직렬화에서 사용하지만
 * Sequelize 마이그레이션으로 생성된 적이 없어 운영에서
 * "relation company_gst_numbers does not exist" 발생.
 */
module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "company_gst_numbers" (
        "id" SERIAL PRIMARY KEY,
        "company_id" INTEGER NOT NULL
          REFERENCES "companies"("id") ON DELETE CASCADE,
        "gst_number" VARCHAR(50) NOT NULL,
        "state_code" VARCHAR(10),
        "registration_date" DATE,
        "status" VARCHAR(20) NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_company_gst_numbers_company_id"
        ON "company_gst_numbers" ("company_id")
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_company_gst_numbers_gst_number"
        ON "company_gst_numbers" ("gst_number")
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_company_gst_numbers_status"
        ON "company_gst_numbers" ("status")
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_company_gst_numbers_company_status"
        ON "company_gst_numbers" ("company_id", "status")
    `);
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_company_gst_numbers_gst_number_unique"
        ON "company_gst_numbers" ("gst_number")
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS "company_gst_numbers"
    `);
  },
};
