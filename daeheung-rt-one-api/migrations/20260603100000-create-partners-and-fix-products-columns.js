'use strict';

/**
 * 운영 DB에 partners 테이블이 없어 products.partner_id 마이그레이션이 적용되지 않은 경우를 보정합니다.
 */
module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;

    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_partners_business_type" AS ENUM('partner', 'customer', 'customer_partner', 'other');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_partners_status" AS ENUM('active', 'inactive', 'suspended');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS partners (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON UPDATE CASCADE ON DELETE CASCADE,
        company_name VARCHAR(200) NOT NULL,
        business_number VARCHAR(50) NOT NULL,
        pan_number VARCHAR(50),
        representative VARCHAR(100),
        business_type "enum_partners_business_type" NOT NULL DEFAULT 'partner',
        industry VARCHAR(100),
        address TEXT,
        phone VARCHAR(20),
        email VARCHAR(255) NOT NULL,
        website VARCHAR(255),
        bank_name VARCHAR(100),
        account_number VARCHAR(50),
        bank_ifsc VARCHAR(50),
        account_holder VARCHAR(120),
        contract_start_date DATE,
        contract_end_date DATE,
        status "enum_partners_status" NOT NULL DEFAULT 'active',
        notes TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);

    await sequelize.query(`
      ALTER TABLE partners
        ADD COLUMN IF NOT EXISTS bank_ifsc VARCHAR(50),
        ADD COLUMN IF NOT EXISTS account_holder VARCHAR(120),
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
    `);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS partner_gst_numbers (
        id SERIAL PRIMARY KEY,
        partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
        gst_number VARCHAR(50) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);

    await sequelize.query(`
      ALTER TABLE partner_gst_numbers
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_partners_tenant_id ON partners(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_partners_company_id ON partners(company_id);
      CREATE INDEX IF NOT EXISTS idx_partners_status ON partners(status);
      CREATE INDEX IF NOT EXISTS idx_partner_gst_numbers_partner_id ON partner_gst_numbers(partner_id);
      CREATE INDEX IF NOT EXISTS idx_partner_gst_numbers_gst_number ON partner_gst_numbers(gst_number);
    `);

    await sequelize.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
      ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier VARCHAR(200);
      ALTER TABLE products ADD COLUMN IF NOT EXISTS location VARCHAR(200);
      ALTER TABLE products ADD COLUMN IF NOT EXISTS partner_id INTEGER;
    `);

    await sequelize.query(`
      DO $$ BEGIN
        ALTER TABLE products
          ADD CONSTRAINT products_partner_id_fkey
          FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS products_partner_id_idx ON products(partner_id);
    `);
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.query(`ALTER TABLE products DROP COLUMN IF EXISTS partner_id;`);
    await sequelize.query(`DROP TABLE IF EXISTS partner_gst_numbers;`);
    await sequelize.query(`DROP TABLE IF EXISTS partners;`);
  },
};
