import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

async function createNoticesTable() {
  try {
    console.log('📋 notices 테이블 확인 중...');
    const tableExists = await sequelize.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'notices'
      );`,
      { type: QueryTypes.SELECT }
    );

    const exists = (tableExists[0] as any).exists;

    if (exists) {
      console.log('✅ notices 테이블이 이미 존재합니다.');
      return;
    }

    console.log('⚠️  notices 테이블이 없습니다. 생성 중...');

    // ENUM 타입 생성
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_notices_category" AS ENUM('general', 'urgent', 'maintenance', 'policy', 'event');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_notices_priority" AS ENUM('low', 'medium', 'high', 'urgent');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_notices_status" AS ENUM('draft', 'published', 'archived');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_notices_target_audience" AS ENUM('all', 'employees', 'managers', 'specific');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // notices 테이블 생성
    await sequelize.query(`
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

    // 인덱스 생성
    await sequelize.query(`CREATE INDEX IF NOT EXISTS notices_tenant_company_idx ON notices(tenant_id, company_id);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS notices_author_id_idx ON notices(author_id);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS notices_status_idx ON notices(status);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS notices_category_idx ON notices(category);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS notices_priority_idx ON notices(priority);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS notices_created_at_idx ON notices(created_at);`);

    console.log('✅ notices 테이블이 생성되었습니다.');
  } catch (error: any) {
    console.error('❌ notices 테이블 생성 실패:', error);
    throw error;
  }
}

// 스크립트 직접 실행
if (require.main === module) {
  createNoticesTable()
    .then(() => {
      console.log('✅ 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 오류:', error);
      process.exit(1);
    });
}

export default createNoticesTable;



