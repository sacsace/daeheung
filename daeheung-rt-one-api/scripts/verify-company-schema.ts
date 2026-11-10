import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

/**
 * Company 테이블 스키마 검증 스크립트
 * 모델과 실제 데이터베이스 스키마를 비교하여 불일치 사항을 확인합니다.
 */

interface ColumnInfo {
  column_name: string;
  data_type: string;
  character_maximum_length: number | null;
  is_nullable: string;
  column_default: string | null;
}

const expectedColumns = [
  { name: 'id', type: 'integer', nullable: false },
  { name: 'tenant_id', type: 'integer', nullable: false },
  { name: 'name', type: 'character varying', maxLength: 255, nullable: false },
  { name: 'business_number', type: 'character varying', maxLength: 50, nullable: false },
  { name: 'ceo_name', type: 'character varying', maxLength: 100, nullable: true },
  { name: 'address', type: 'text', nullable: true },
  { name: 'phone', type: 'character varying', maxLength: 50, nullable: true },
  { name: 'email', type: 'character varying', maxLength: 100, nullable: true },
  { name: 'website', type: 'character varying', maxLength: 100, nullable: true },
  { name: 'industry', type: 'character varying', maxLength: 100, nullable: true },
  { name: 'employee_count', type: 'integer', nullable: false },
  { name: 'subscription_plan', type: 'character varying', maxLength: 50, nullable: false },
  { name: 'subscription_status', type: 'character varying', maxLength: 20, nullable: false },
  { name: 'status', type: 'USER-DEFINED', nullable: false }, // ENUM
  { name: 'company_logo', type: 'bytea', nullable: true },
  { name: 'company_seal', type: 'bytea', nullable: true },
  { name: 'ceo_signature', type: 'bytea', nullable: true },
  { name: 'account_holder_name', type: 'character varying', maxLength: 255, nullable: true },
  { name: 'bank_name', type: 'character varying', maxLength: 100, nullable: true },
  { name: 'bank_address', type: 'text', nullable: true },
  { name: 'account_number', type: 'character varying', maxLength: 50, nullable: true },
  { name: 'ifsc_code', type: 'character varying', maxLength: 11, nullable: true },
  { name: 'swift_code', type: 'character varying', maxLength: 11, nullable: true },
  { name: 'msme_number', type: 'character varying', maxLength: 50, nullable: true },
  { name: 'iec_number', type: 'character varying', maxLength: 50, nullable: true },
  { name: 'pan_number', type: 'character varying', maxLength: 50, nullable: true },
  { name: 'login_period_start', type: 'date', nullable: true },
  { name: 'login_period_end', type: 'date', nullable: true },
  { name: 'login_time_start', type: 'time without time zone', nullable: false },
  { name: 'login_time_end', type: 'time without time zone', nullable: false },
  { name: 'timezone', type: 'character varying', maxLength: 50, nullable: false },
  { name: 'settings', type: 'jsonb', nullable: false },
  { name: 'created_at', type: 'timestamp with time zone', nullable: true },
  { name: 'updated_at', type: 'timestamp with time zone', nullable: true },
];

async function verifyCompanySchema() {
  try {
    console.log('🔍 Company 테이블 스키마 검증 시작...\n');
    await sequelize.authenticate();
    console.log('✅ 데이터베이스 연결 성공\n');

    // 1. 테이블 존재 여부 확인
    const [tableCheck] = await sequelize.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'companies'
      ) as exists;
    `, { type: QueryTypes.SELECT }) as any[];

    if (!tableCheck?.exists) {
      console.log('❌ companies 테이블이 존재하지 않습니다.');
      await sequelize.close();
      return;
    }

    console.log('✅ companies 테이블 존재 확인\n');

    // 2. 실제 컬럼 정보 조회
    const actualColumns = await sequelize.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'companies'
      ORDER BY ordinal_position;
    `, { type: QueryTypes.SELECT }) as ColumnInfo[];

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 실제 데이터베이스 컬럼 목록');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    actualColumns.forEach((col, index) => {
      const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
      console.log(`${(index + 1).toString().padStart(2, ' ')}. ${col.column_name.padEnd(25)} ${(col.data_type + length).padEnd(30)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    console.log('');

    // 3. 예상 컬럼과 실제 컬럼 비교
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 컬럼 일치 여부 확인');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const actualColumnNames = actualColumns.map(col => col.column_name);
    const missingColumns: string[] = [];
    const extraColumns: string[] = [];
    const mismatchedColumns: Array<{ name: string; issue: string }> = [];

    // 누락된 컬럼 확인
    expectedColumns.forEach(expected => {
      if (!actualColumnNames.includes(expected.name)) {
        missingColumns.push(expected.name);
      } else {
        const actual = actualColumns.find(col => col.column_name === expected.name);
        if (actual) {
          // 타입 확인 (ENUM은 USER-DEFINED로 표시됨)
          if (expected.type === 'USER-DEFINED' && actual.data_type !== 'USER-DEFINED') {
            // ENUM 타입 확인
            const enumCheck = await sequelize.query(`
              SELECT EXISTS (
                SELECT 1 FROM pg_type 
                WHERE typname = 'company_status_enum'
              ) as exists;
            `, { type: QueryTypes.SELECT }) as any[];
            
            if (!enumCheck[0]?.exists) {
              mismatchedColumns.push({
                name: expected.name,
                issue: `타입 불일치: 예상 ENUM, 실제 ${actual.data_type}`
              });
            }
          }
          
          // NULL 허용 여부 확인
          const expectedNullable = expected.nullable ? 'YES' : 'NO';
          if (actual.is_nullable !== expectedNullable) {
            mismatchedColumns.push({
              name: expected.name,
              issue: `NULL 허용 불일치: 예상 ${expectedNullable}, 실제 ${actual.is_nullable}`
            });
          }
        }
      }
    });

    // 추가된 컬럼 확인
    actualColumnNames.forEach(actualName => {
      if (!expectedColumns.find(exp => exp.name === actualName)) {
        extraColumns.push(actualName);
      }
    });

    // 결과 출력
    if (missingColumns.length > 0) {
      console.log('❌ 누락된 컬럼:');
      missingColumns.forEach(col => console.log(`   - ${col}`));
      console.log('');
    }

    if (extraColumns.length > 0) {
      console.log('⚠️  추가된 컬럼 (모델에 없음):');
      extraColumns.forEach(col => console.log(`   - ${col}`));
      console.log('');
    }

    if (mismatchedColumns.length > 0) {
      console.log('⚠️  불일치하는 컬럼:');
      mismatchedColumns.forEach(col => console.log(`   - ${col.name}: ${col.issue}`));
      console.log('');
    }

    if (missingColumns.length === 0 && extraColumns.length === 0 && mismatchedColumns.length === 0) {
      console.log('✅ 모든 컬럼이 일치합니다!');
      console.log('');
    }

    // 4. 요약
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 검증 요약');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`예상 컬럼 수: ${expectedColumns.length}`);
    console.log(`실제 컬럼 수: ${actualColumns.length}`);
    console.log(`누락된 컬럼: ${missingColumns.length}개`);
    console.log(`추가된 컬럼: ${extraColumns.length}개`);
    console.log(`불일치 컬럼: ${mismatchedColumns.length}개`);
    console.log('');

  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    console.error(error.stack);
  } finally {
    await sequelize.close();
  }
}

verifyCompanySchema();

