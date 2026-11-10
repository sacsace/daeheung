'use strict';

/** 제품 단위 마스터 (개, 박스 등) */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS product_units (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON UPDATE CASCADE ON DELETE CASCADE,
        name VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE(company_id, name)
      );
    `);
    await queryInterface.sequelize.query(`
      INSERT INTO product_units (tenant_id, company_id, name, created_at, updated_at)
      SELECT c.tenant_id, c.id, '개', NOW(), NOW()
      FROM companies c
      WHERE NOT EXISTS (
        SELECT 1 FROM product_units u WHERE u.company_id = c.id AND u.name = '개'
      );
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS product_units;`);
  }
};
