'use strict';

/**
 * products.partner_id — Sequelize 모델과 동기화.
 * 20260410200000 마이그레이션이 적용되지 않았거나 중간에 실패한 DB를 보정합니다.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS partner_id INTEGER;
    `);
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        ALTER TABLE products
          ADD CONSTRAINT products_partner_id_fkey
          FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS products_partner_id_idx ON products(partner_id);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS products_partner_id_idx;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE products DROP COLUMN IF EXISTS partner_id;
    `);
  },
};
