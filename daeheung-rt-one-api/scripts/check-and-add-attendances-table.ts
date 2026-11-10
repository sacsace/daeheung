import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

async function checkAndAddAttendancesTable() {
  try {
    console.log('📋 attendances 테이블 확인 중...');

    // 테이블 존재 여부 확인
    const tableExists = await sequelize.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'attendances'
      );`,
      { type: QueryTypes.SELECT }
    );

    const exists = (tableExists[0] as any).exists;

    if (exists) {
      console.log('✅ attendances 테이블이 이미 존재합니다.');
      return;
    }

    console.log('⚠️  attendances 테이블이 없습니다. 생성 중...');

    // ENUM 타입 생성
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_attendances_status" AS ENUM('normal', 'late', 'early', 'overtime', 'absent');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // attendances 테이블 생성
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS attendances (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        check_in TIMESTAMP,
        check_out TIMESTAMP,
        work_hours DECIMAL(5, 2),
        status "enum_attendances_status" NOT NULL DEFAULT 'normal',
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT attendances_user_date_unique UNIQUE (user_id, date)
      );
    `);

    // 인덱스 생성
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS attendances_tenant_company_idx ON attendances(tenant_id, company_id);
      CREATE INDEX IF NOT EXISTS attendances_user_id_idx ON attendances(user_id);
      CREATE INDEX IF NOT EXISTS attendances_date_idx ON attendances(date);
    `);

    console.log('✅ attendances 테이블이 성공적으로 생성되었습니다.');
  } catch (error: any) {
    console.error('❌ attendances 테이블 생성 오류:', error.message);
    if (error.original) {
      console.error('원본 오류:', error.original);
    }
    throw error;
  }
}

// 스크립트 직접 실행
if (require.main === module) {
  checkAndAddAttendancesTable()
    .then(() => {
      console.log('✅ 스크립트 실행 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 스크립트 실행 실패:', error);
      process.exit(1);
    });
}

export default checkAndAddAttendancesTable;





