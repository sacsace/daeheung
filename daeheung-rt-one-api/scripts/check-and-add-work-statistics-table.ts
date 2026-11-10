import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

async function checkAndAddWorkStatisticsTable() {
  try {
    console.log('📋 work_statistics 테이블 확인 중...');

    // 테이블 존재 여부 확인
    const tableExists = await sequelize.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'work_statistics'
      );`,
      { type: QueryTypes.SELECT }
    );

    const exists = (tableExists[0] as any).exists;

    if (exists) {
      console.log('✅ work_statistics 테이블이 이미 존재합니다.');
      return;
    }

    console.log('⚠️  work_statistics 테이블이 없습니다. 생성 중...');

    // work_statistics 테이블 생성
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS work_statistics (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        period VARCHAR(50) NOT NULL,
        total_hours DECIMAL(10, 2) NOT NULL DEFAULT 0,
        productive_hours DECIMAL(10, 2) NOT NULL DEFAULT 0,
        tasks_completed INTEGER NOT NULL DEFAULT 0,
        tasks_assigned INTEGER NOT NULL DEFAULT 0,
        efficiency DECIMAL(5, 2) NOT NULL DEFAULT 0,
        productivity DECIMAL(5, 2) NOT NULL DEFAULT 0,
        attendance_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
        overtime_hours DECIMAL(10, 2) NOT NULL DEFAULT 0,
        break_time DECIMAL(10, 2) NOT NULL DEFAULT 0,
        focus_time DECIMAL(10, 2) NOT NULL DEFAULT 0,
        meeting_time DECIMAL(10, 2) NOT NULL DEFAULT 0,
        code_review_time DECIMAL(10, 2) NOT NULL DEFAULT 0,
        testing_time DECIMAL(10, 2) NOT NULL DEFAULT 0,
        documentation_time DECIMAL(10, 2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 인덱스 생성
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS work_statistics_tenant_company_idx ON work_statistics(tenant_id, company_id);
      CREATE INDEX IF NOT EXISTS work_statistics_user_id_idx ON work_statistics(user_id);
      CREATE INDEX IF NOT EXISTS work_statistics_period_idx ON work_statistics(period);
      CREATE UNIQUE INDEX IF NOT EXISTS work_statistics_user_period_unique ON work_statistics(user_id, period);
    `);

    console.log('✅ work_statistics 테이블이 성공적으로 생성되었습니다.');
  } catch (error: any) {
    console.error('❌ work_statistics 테이블 생성 오류:', error.message);
    if (error.original) {
      console.error('원본 오류:', error.original);
    }
    throw error;
  }
}

// 스크립트 직접 실행
if (require.main === module) {
  checkAndAddWorkStatisticsTable()
    .then(() => {
      console.log('✅ 스크립트 실행 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 스크립트 실행 실패:', error);
      process.exit(1);
    });
}

export default checkAndAddWorkStatisticsTable;

