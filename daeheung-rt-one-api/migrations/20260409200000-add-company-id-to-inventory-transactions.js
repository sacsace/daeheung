/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

/** inventory_transactions.company_id — 모델·재고 보고서 쿼리와 일치 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE inventory_transactions
      ADD COLUMN IF NOT EXISTS company_id INTEGER;
    `);

    await queryInterface.sequelize.query(`
      UPDATE inventory_transactions it
      SET company_id = p.company_id
      FROM products p
      WHERE it.product_id = p.id AND it.company_id IS NULL;
    `);

    await queryInterface.sequelize.query(`
      UPDATE inventory_transactions it
      SET company_id = (SELECT MIN(c.id) FROM companies c WHERE c.tenant_id = it.tenant_id)
      WHERE it.company_id IS NULL AND it.tenant_id IS NOT NULL;
    `);

    await queryInterface.sequelize.query(`
      UPDATE inventory_transactions
      SET company_id = (SELECT MIN(id) FROM companies)
      WHERE company_id IS NULL;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE inventory_transactions
      ALTER COLUMN company_id SET NOT NULL;
    `).catch(() => {});

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'inventory_transactions_company_id_fkey'
        ) THEN
          ALTER TABLE inventory_transactions
          ADD CONSTRAINT inventory_transactions_company_id_fkey
          FOREIGN KEY (company_id) REFERENCES companies(id);
        END IF;
      END $$;
    `).catch(() => {});
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE inventory_transactions DROP CONSTRAINT IF EXISTS inventory_transactions_company_id_fkey;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE inventory_transactions DROP COLUMN IF EXISTS company_id;
    `);
  }
};
