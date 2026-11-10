/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

/** Sequelize InventoryTransaction 모델·stockIn/stockOut/adjustStock 가 created_by 사용 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE inventory_transactions
      ADD COLUMN IF NOT EXISTS created_by INTEGER;
    `);

    await queryInterface.sequelize.query(`
      UPDATE inventory_transactions it
      SET created_by = (
        SELECT u.id FROM users u
        WHERE u.tenant_id = it.tenant_id
        ORDER BY u.id ASC
        LIMIT 1
      )
      WHERE created_by IS NULL;
    `);

    await queryInterface.sequelize.query(`
      UPDATE inventory_transactions
      SET created_by = (SELECT MIN(id) FROM users)
      WHERE created_by IS NULL;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'inventory_transactions_created_by_fkey'
        ) THEN
          ALTER TABLE inventory_transactions
          ADD CONSTRAINT inventory_transactions_created_by_fkey
          FOREIGN KEY (created_by) REFERENCES users(id);
        END IF;
      END $$;
    `).catch(() => {});

    await queryInterface.sequelize.query(`
      ALTER TABLE inventory_transactions ALTER COLUMN created_by SET NOT NULL;
    `).catch(() => {});
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE inventory_transactions DROP CONSTRAINT IF EXISTS inventory_transactions_created_by_fkey;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE inventory_transactions DROP COLUMN IF EXISTS created_by;
    `);
  }
};
