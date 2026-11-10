'use strict';

/**
 * 단독 시스템(Daeheung R&T One).
 * tenant_id / company_id 와 회사 법적 상호는 유지한다.
 * 배포 모드를 기록하고, 플레이스홀더 테넌트명만 제품명으로 바꾼다.
 */
module.exports = {
  async up(queryInterface) {
    const [cols] = await queryInterface.sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'system_settings'
    `);
    const names = new Set((cols || []).map((row) => row.column_name));

    if (!names.size) {
      await queryInterface.sequelize.query(`
        CREATE TABLE system_settings (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER,
          company_id INTEGER,
          setting_key VARCHAR(100) NOT NULL,
          setting_value TEXT,
          setting_type VARCHAR(30) NOT NULL DEFAULT 'string',
          description TEXT,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
    }

    await queryInterface.sequelize.query(`
      INSERT INTO system_settings (
        tenant_id, company_id, setting_key, setting_value, setting_type, description, is_active, created_at, updated_at
      )
      SELECT
        (SELECT MIN(id) FROM tenants),
        NULL,
        'deployment_mode',
        'standalone',
        'string',
        'Daeheung R&T One standalone deployment',
        TRUE,
        NOW(),
        NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM system_settings WHERE setting_key = 'deployment_mode'
      );
    `);

    await queryInterface.sequelize.query(`
      INSERT INTO system_settings (
        tenant_id, company_id, setting_key, setting_value, setting_type, description, is_active, created_at, updated_at
      )
      SELECT
        (SELECT MIN(id) FROM tenants),
        NULL,
        'product_name',
        'Daeheung R&T One',
        'string',
        'Product name',
        TRUE,
        NOW(),
        NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM system_settings WHERE setting_key = 'product_name'
      );
    `);

    await queryInterface.sequelize.query(`
      UPDATE system_settings
      SET setting_value = 'standalone',
          updated_at = NOW()
      WHERE setting_key = 'deployment_mode';
    `);

    await queryInterface.sequelize.query(`
      UPDATE system_settings
      SET setting_value = 'Daeheung R&T One',
          updated_at = NOW()
      WHERE setting_key = 'product_name';
    `);

    await queryInterface.sequelize.query(`
      UPDATE tenants
      SET max_companies = 1
      WHERE max_companies IS DISTINCT FROM 1;
    `);

    await queryInterface.sequelize.query(`
      UPDATE tenants
      SET name = 'Daeheung R&T One'
      WHERE name IN ('Default Tenant', 'MVS Solutions', 'MVS', 'MVS 3.0 Solutions')
         OR name ILIKE 'MVS%';
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM system_settings
      WHERE setting_key IN ('deployment_mode', 'product_name');
    `);
  },
};
