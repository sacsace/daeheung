/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Skip if partners table does not exist in this DB
    const [rows] = await queryInterface.sequelize.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'partners'
      ) AS exists;
    `);
    if (!rows?.[0]?.exists) {
      return;
    }

    // Add new enum value 'customer_partner' to partners.business_type
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_partners_business_type" AS ENUM('partner', 'customer', 'customer_partner', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "partners" ALTER COLUMN "business_type" DROP DEFAULT;
      ALTER TABLE "partners" ALTER COLUMN "business_type"
        TYPE "enum_partners_business_type"
        USING "business_type"::text::"enum_partners_business_type";
      ALTER TABLE "partners" ALTER COLUMN "business_type" SET DEFAULT 'partner';
      ALTER TABLE "partners" ALTER COLUMN "business_type" SET NOT NULL;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    const [rows] = await queryInterface.sequelize.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'partners'
      ) AS exists;
    `);
    if (!rows?.[0]?.exists) {
      return;
    }

    // Revert to previous enum definition
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_partners_business_type_legacy" AS ENUM('partner', 'customer', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "partners" ALTER COLUMN "business_type" DROP DEFAULT;
      ALTER TABLE "partners" ALTER COLUMN "business_type"
        TYPE "enum_partners_business_type_legacy"
        USING "business_type"::text::"enum_partners_business_type_legacy";
      ALTER TABLE "partners" ALTER COLUMN "business_type" SET DEFAULT 'partner';
      ALTER TABLE "partners" ALTER COLUMN "business_type" SET NOT NULL;
    `);
  }
};
