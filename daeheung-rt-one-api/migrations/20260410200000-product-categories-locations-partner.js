'use strict';

/** 제품 카테고리·보관 위치 마스터, 제품-협력업체(파트너) 연결 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS product_categories (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON UPDATE CASCADE ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE(company_id, name)
      );
    `);
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS inventory_locations (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON UPDATE CASCADE ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE(company_id, name)
      );
    `);
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

    await queryInterface.sequelize.query(`
      INSERT INTO inventory_locations (tenant_id, company_id, name, created_at, updated_at)
      SELECT c.tenant_id, c.id, '창동', NOW(), NOW()
      FROM companies c
      WHERE NOT EXISTS (
        SELECT 1 FROM inventory_locations il WHERE il.company_id = c.id AND il.name = '창동'
      );
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`ALTER TABLE products DROP COLUMN IF EXISTS partner_id;`);
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS inventory_locations;`);
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS product_categories;`);
  }
};
