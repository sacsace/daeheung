import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

async function checkAndAddPerformancesTable() {
  try {
    console.log('📋 performances 테이블 확인 중...');

    // 테이블 존재 여부 확인
    const tableExists = await sequelize.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'performances'
      );`,
      { type: QueryTypes.SELECT }
    );

    const exists = (tableExists[0] as any).exists;

    if (exists) {
      console.log('✅ performances 테이블이 이미 존재합니다.');
      return;
    }

    console.log('⚠️  performances 테이블이 없습니다. 생성 중...');

    // 성과 상태 ENUM 타입 생성 (모델과 일치)
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_performances_status" AS ENUM('draft', 'submitted', 'reviewed', 'approved', 'finalized');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // performances 테이블 생성
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS performances (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        review_period VARCHAR(50) NOT NULL,
        overall_rating DECIMAL(3, 2) NOT NULL DEFAULT 0,
        goals JSONB NOT NULL DEFAULT '[]'::jsonb,
        competencies JSONB NOT NULL DEFAULT '[]'::jsonb,
        strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
        improvements JSONB NOT NULL DEFAULT '[]'::jsonb,
        manager_comment TEXT NOT NULL,
        employee_comment TEXT,
        status "enum_performances_status" NOT NULL DEFAULT 'draft',
        reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 인덱스 생성
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS performances_tenant_company_idx ON performances(tenant_id, company_id);
      CREATE INDEX IF NOT EXISTS performances_user_id_idx ON performances(user_id);
      CREATE INDEX IF NOT EXISTS performances_status_idx ON performances(status);
      CREATE INDEX IF NOT EXISTS performances_review_period_idx ON performances(review_period);
      CREATE INDEX IF NOT EXISTS performances_reviewed_by_idx ON performances(reviewed_by);
    `);

    console.log('✅ performances 테이블이 성공적으로 생성되었습니다.');
  } catch (error: any) {
    console.error('❌ performances 테이블 생성 오류:', error.message);
    if (error.original) {
      console.error('원본 오류:', error.original);
    }
    throw error;
  }
}

// 스크립트 직접 실행
if (require.main === module) {
  checkAndAddPerformancesTable()
    .then(() => {
      console.log('✅ 스크립트 실행 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 스크립트 실행 실패:', error);
      process.exit(1);
    });
}

export default checkAndAddPerformancesTable;

