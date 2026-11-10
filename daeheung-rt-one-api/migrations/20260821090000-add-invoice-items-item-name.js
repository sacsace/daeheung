'use strict';

/**
 * invoice_items: Sequelize 모델과 운영 스키마 정합.
 * - 초기 create-all-tables 에는 description/product_id 만 있고 item_name·세율 컬럼이 없음
 * - 앱은 item_name 을 SELECT 하므로 운영에서 "column items.item_name does not exist" 발생
 */
module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;

    await sequelize.query(`
      ALTER TABLE "invoice_items"
        ADD COLUMN IF NOT EXISTS "item_name" VARCHAR(200),
        ADD COLUMN IF NOT EXISTS "tax_rate" DECIMAL(5, 2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "tax_amount" DECIMAL(15, 2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true
    `);

    // 기존 행: description → item_name 백필
    await sequelize.query(`
      UPDATE "invoice_items"
      SET "item_name" = COALESCE(
        NULLIF(TRIM("description"), ''),
        'Item'
      )
      WHERE "item_name" IS NULL OR TRIM("item_name") = ''
    `);

    await sequelize.query(`
      ALTER TABLE "invoice_items"
        ALTER COLUMN "item_name" SET DEFAULT 'Item'
    `);

    // NOT NULL 강제 (남은 NULL 이 없을 때만)
    await sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'invoice_items'
            AND column_name = 'item_name'
            AND is_nullable = 'YES'
        ) THEN
          UPDATE "invoice_items" SET "item_name" = 'Item' WHERE "item_name" IS NULL;
          ALTER TABLE "invoice_items" ALTER COLUMN "item_name" SET NOT NULL;
        END IF;
      END $$;
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_invoice_items_item_name"
      ON "invoice_items" ("item_name")
    `);
  },

  async down(queryInterface) {
    const sequelize = queryInterface.sequelize;
    await sequelize.query(`DROP INDEX IF EXISTS "idx_invoice_items_item_name"`);
    await sequelize.query(`
      ALTER TABLE "invoice_items"
        DROP COLUMN IF EXISTS "item_name"
    `);
    // tax_rate / tax_amount / is_active 는 다른 마이그레이션·모델과 공유될 수 있어 down 에서 제거하지 않음
  },
};
