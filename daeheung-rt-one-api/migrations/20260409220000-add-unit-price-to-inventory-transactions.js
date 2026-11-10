/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

/**
 * inventory_transactions — Sequelize 모델은 unit_price / total_amount 사용.
 * 초기 스키마는 unit_cost / total_cost 만 있음 → 컬럼 추가 및 기존 값 이관.
 */
module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;

    await sequelize.query(`
      ALTER TABLE inventory_transactions
      ADD COLUMN IF NOT EXISTS unit_price DECIMAL(15,2);
    `);
    await sequelize.query(`
      ALTER TABLE inventory_transactions
      ADD COLUMN IF NOT EXISTS total_amount DECIMAL(15,2);
    `);

    await sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'inventory_transactions' AND column_name = 'unit_cost'
        ) THEN
          UPDATE inventory_transactions SET unit_price = COALESCE(unit_cost, 0) WHERE unit_price IS NULL;
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'inventory_transactions' AND column_name = 'total_cost'
        ) THEN
          UPDATE inventory_transactions SET total_amount = COALESCE(total_cost, 0) WHERE total_amount IS NULL;
        END IF;
      END $$;
    `);

    await sequelize.query(`
      UPDATE inventory_transactions SET unit_price = 0 WHERE unit_price IS NULL;
    `);
    await sequelize.query(`
      UPDATE inventory_transactions SET total_amount = 0 WHERE total_amount IS NULL;
    `);

    await sequelize.query(`
      ALTER TABLE inventory_transactions ALTER COLUMN unit_price SET DEFAULT 0;
    `).catch(() => {});
    await sequelize.query(`
      ALTER TABLE inventory_transactions ALTER COLUMN total_amount SET DEFAULT 0;
    `).catch(() => {});
    await sequelize.query(`
      ALTER TABLE inventory_transactions ALTER COLUMN unit_price SET NOT NULL;
    `).catch(() => {});
    await sequelize.query(`
      ALTER TABLE inventory_transactions ALTER COLUMN total_amount SET NOT NULL;
    `).catch(() => {});
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE inventory_transactions DROP COLUMN IF EXISTS unit_price;
    `).catch(() => {});
    await queryInterface.sequelize.query(`
      ALTER TABLE inventory_transactions DROP COLUMN IF EXISTS total_amount;
    `).catch(() => {});
  }
};
