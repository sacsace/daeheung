import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

async function checkAndAddVacationsTable() {
  try {
    console.log('📋 vacations 테이블 확인 중...');

    // 테이블 존재 여부 확인
    const tableExists = await sequelize.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'vacations'
      );`,
      { type: QueryTypes.SELECT }
    );

    const exists = (tableExists[0] as any).exists;

    if (exists) {
      console.log('✅ vacations 테이블이 이미 존재합니다.');
      return;
    }

    console.log('⚠️  vacations 테이블이 없습니다. 생성 중...');

    // 휴가 타입 ENUM 생성 (모델과 일치)
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_vacations_vacation_type" AS ENUM('annual', 'sick', 'personal', 'study', 'maternity', 'paternity');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_vacations_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // vacations 테이블 생성
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS vacations (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        vacation_type "enum_vacations_vacation_type" NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        days INTEGER NOT NULL,
        reason TEXT,
        status "enum_vacations_status" NOT NULL DEFAULT 'pending',
        applied_date DATE NOT NULL DEFAULT CURRENT_DATE,
        approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        approved_date DATE,
        rejection_reason TEXT,
        attachments TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 인덱스 생성
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS vacations_tenant_company_idx ON vacations(tenant_id, company_id);
      CREATE INDEX IF NOT EXISTS vacations_user_id_idx ON vacations(user_id);
      CREATE INDEX IF NOT EXISTS vacations_status_idx ON vacations(status);
      CREATE INDEX IF NOT EXISTS vacations_vacation_type_idx ON vacations(vacation_type);
      CREATE INDEX IF NOT EXISTS vacations_start_date_idx ON vacations(start_date);
      CREATE INDEX IF NOT EXISTS vacations_end_date_idx ON vacations(end_date);
      CREATE INDEX IF NOT EXISTS vacations_approved_by_idx ON vacations(approved_by);
    `);

    console.log('✅ vacations 테이블이 성공적으로 생성되었습니다.');
  } catch (error: any) {
    console.error('❌ vacations 테이블 생성 오류:', error.message);
    if (error.original) {
      console.error('원본 오류:', error.original);
    }
    throw error;
  }
}

// 스크립트 직접 실행
if (require.main === module) {
  checkAndAddVacationsTable()
    .then(() => {
      console.log('✅ 스크립트 실행 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 스크립트 실행 실패:', error);
      process.exit(1);
    });
}

export default checkAndAddVacationsTable;

