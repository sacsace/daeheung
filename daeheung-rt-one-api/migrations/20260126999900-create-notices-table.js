'use strict';

/** notices 테이블 (스크립트 create-notices-table.ts 와 동일 스키마) */
module.exports = {
  async up(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'notices'
      ) AS exists;
    `);
    if (rows[0]?.exists) {
      console.log('notices 테이블 이미 존재 — 건너뜀');
      return;
    }

    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_notices_category" AS ENUM('general', 'urgent', 'maintenance', 'policy', 'event');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_notices_priority" AS ENUM('low', 'medium', 'high', 'urgent');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_notices_status" AS ENUM('draft', 'published', 'archived');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_notices_target_audience" AS ENUM('all', 'employees', 'managers', 'specific');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS notices (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        category "enum_notices_category" NOT NULL DEFAULT 'general',
        priority "enum_notices_priority" NOT NULL DEFAULT 'medium',
        status "enum_notices_status" NOT NULL DEFAULT 'draft',
        is_public BOOLEAN NOT NULL DEFAULT true,
        target_audience "enum_notices_target_audience" NOT NULL DEFAULT 'all',
        author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        published_at TIMESTAMP WITH TIME ZONE,
        expires_at TIMESTAMP WITH TIME ZONE,
        attachments TEXT,
        read_count INTEGER NOT NULL DEFAULT 0,
        views INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryInterface.sequelize.query(`CREATE INDEX IF NOT EXISTS notices_tenant_company_idx ON notices(tenant_id, company_id);`);
    await queryInterface.sequelize.query(`CREATE INDEX IF NOT EXISTS notices_author_id_idx ON notices(author_id);`);
    await queryInterface.sequelize.query(`CREATE INDEX IF NOT EXISTS notices_status_idx ON notices(status);`);
    await queryInterface.sequelize.query(`CREATE INDEX IF NOT EXISTS notices_category_idx ON notices(category);`);
    await queryInterface.sequelize.query(`CREATE INDEX IF NOT EXISTS notices_priority_idx ON notices(priority);`);
    await queryInterface.sequelize.query(`CREATE INDEX IF NOT EXISTS notices_created_at_idx ON notices(created_at);`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS notices;');
  },
};
