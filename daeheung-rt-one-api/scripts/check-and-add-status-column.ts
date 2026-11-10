import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

async function checkAndAddStatusColumn() {
  try {
    console.log('🔍 companies 테이블에 status 컬럼 확인 중...\n');

    // 1. status 컬럼 존재 여부 확인
    const columnCheck = await sequelize.query(
      `SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'companies'
        AND column_name = 'status';`,
      { type: QueryTypes.SELECT }
    ) as any[];

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1. status 컬럼 존재 여부 확인');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (columnCheck.length > 0) {
      console.log('✅ status 컬럼이 이미 존재합니다.');
      console.log('컬럼 정보:');
      columnCheck.forEach((col: any) => {
        console.log(`  - 타입: ${col.data_type}`);
        console.log(`  - Nullable: ${col.is_nullable}`);
        console.log(`  - 기본값: ${col.column_default || '(없음)'}`);
      });
      console.log('');
    } else {
      console.log('❌ status 컬럼이 없습니다. 추가합니다...\n');
      
      // 2. status 컬럼 추가
      try {
        // 먼저 컬럼 추가
        await sequelize.query(`
          ALTER TABLE companies 
          ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';
        `);
        
        console.log('✅ status 컬럼이 추가되었습니다.');
        
        // 기존 데이터가 있으면 모두 'active'로 설정
        const updateResult = await sequelize.query(`
          UPDATE companies 
          SET status = 'active' 
          WHERE status IS NULL OR status = '';
        `);
        
        console.log('✅ 기존 데이터의 status를 "active"로 설정했습니다.');
        
        // CHECK 제약조건 추가 시도 (PostgreSQL)
        try {
          await sequelize.query(`
            ALTER TABLE companies 
            ADD CONSTRAINT companies_status_check 
            CHECK (status IN ('active', 'inactive', 'suspended'));
          `);
          console.log('✅ status 제약조건이 추가되었습니다.');
        } catch (constraintError: any) {
          // 제약조건이 이미 있거나 실패해도 계속 진행
          if (constraintError.message.includes('already exists')) {
            console.log('ℹ️  제약조건이 이미 존재합니다.');
          } else {
            console.log('⚠️  제약조건 추가는 선택사항입니다. 계속 진행합니다.');
          }
        }
        
        // 추가 후 다시 확인
        const verifyCheck = await sequelize.query(
          `SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public' 
            AND table_name = 'companies'
            AND column_name = 'status';`,
          { type: QueryTypes.SELECT }
        ) as any[];
        
        if (verifyCheck.length > 0) {
          console.log('\n✅ status 컬럼 추가 확인 완료:');
          verifyCheck.forEach((col: any) => {
            console.log(`  - 타입: ${col.data_type}`);
            console.log(`  - Nullable: ${col.is_nullable}`);
            console.log(`  - 기본값: ${col.column_default || '(없음)'}`);
          });
        }
        
      } catch (error: any) {
        console.error('❌ status 컬럼 추가 중 오류 발생:', error.message);
        throw error;
      }
    }

    // 3. 현재 companies 테이블의 status 값 분포 확인
    try {
      const statusDistribution = await sequelize.query(
        `SELECT 
          status,
          COUNT(*) as count
        FROM companies
        GROUP BY status
        ORDER BY count DESC;`,
        { type: QueryTypes.SELECT }
      ) as any[];

      if (statusDistribution.length > 0) {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('2. status 값 분포');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        statusDistribution.forEach((stat: any) => {
          console.log(`  ${stat.status || '(null)'}: ${stat.count}개`);
        });
      }
    } catch (error: any) {
      console.log('⚠️  status 값 분포 확인 중 오류 (무시 가능):', error.message);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 작업 완료');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ companies 테이블에 status 컬럼이 준비되었습니다.');
    console.log('');

  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

checkAndAddStatusColumn();
