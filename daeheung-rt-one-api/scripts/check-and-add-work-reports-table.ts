import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

async function checkAndAddWorkReportsTable() {
  try {
    console.log('📋 work_reports 테이블 확인 중...');
    const tableExists = await sequelize.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'work_reports'
      );`,
      { type: QueryTypes.SELECT }
    );

    const exists = (tableExists[0] as any).exists;

    if (exists) {
      console.log('✅ work_reports 테이블이 이미 존재합니다.');
      
      // is_active 컬럼 존재 확인
      const columnExists = await sequelize.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'work_reports'
          AND column_name = 'is_active'
        );`,
        { type: QueryTypes.SELECT }
      );

      if ((columnExists[0] as any).exists) {
        console.log('✅ work_reports 테이블에 is_active 컬럼이 이미 존재합니다.');
      } else {
        console.log('⚠️  is_active 컬럼이 없습니다. 추가 중...');
        await sequelize.query(`
          ALTER TABLE work_reports
          ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
        `);
        console.log('✅ is_active 컬럼이 추가되었습니다.');
      }
      return;
    }

    console.log('⚠️  work_reports 테이블이 없습니다. 생성 중...');

    // ENUM 타입 생성
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_work_reports_type" AS ENUM('daily', 'weekly', 'monthly', 'project', 'incident', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_work_reports_status" AS ENUM('draft', 'submitted', 'reviewed', 'approved', 'rejected');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_work_reports_priority" AS ENUM('low', 'medium', 'high', 'urgent');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // work_reports 테이블 생성
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS work_reports (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        report_id VARCHAR(100) NOT NULL UNIQUE,
        title VARCHAR(255) NOT NULL,
        type "enum_work_reports_type" NOT NULL,
        category VARCHAR(100) NOT NULL,
        author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        summary TEXT NOT NULL,
        achievements JSONB DEFAULT '[]',
        challenges JSONB DEFAULT '[]',
        next_steps JSONB DEFAULT '[]',
        attachments JSONB DEFAULT '[]',
        status "enum_work_reports_status" NOT NULL DEFAULT 'draft',
        priority "enum_work_reports_priority" NOT NULL DEFAULT 'medium',
        report_date DATE NOT NULL,
        due_date DATE,
        reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        review_comment TEXT,
        reviewed_at TIMESTAMP WITH TIME ZONE,
        tags JSONB DEFAULT '[]',
        is_public BOOLEAN NOT NULL DEFAULT false,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 인덱스 생성
    await sequelize.query(`CREATE INDEX IF NOT EXISTS work_reports_tenant_company_idx ON work_reports(tenant_id, company_id);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS work_reports_report_id_idx ON work_reports(report_id);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS work_reports_author_id_idx ON work_reports(author_id);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS work_reports_status_idx ON work_reports(status);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS work_reports_report_date_idx ON work_reports(report_date);`);

    console.log('✅ work_reports 테이블이 생성되었습니다.');
  } catch (error: any) {
    console.error('❌ work_reports 테이블 생성 실패:', error);
    throw error;
  } finally {
    // sequelize.close(); // 스크립트가 종료될 때만 닫도록
  }
}

checkAndAddWorkReportsTable();



