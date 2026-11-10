import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

async function addStatusColumnToCompanies() {
  try {
    console.log('🔍 companies 테이블에 status 컬럼 확인 및 추가 중...\n');

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
      
      // 기존 데이터 확인
      const dataCheck = await sequelize.query(
        `SELECT status, COUNT(*) as count
        FROM companies
        GROUP BY status
        ORDER BY count DESC;`,
        { type: QueryTypes.SELECT }
      ) as any[];

      if (dataCheck.length > 0) {
        console.log('현재 status 값 분포:');
        dataCheck.forEach((row: any) => {
          console.log(`  - ${row.status || '(null)'}: ${row.count}개`);
        });
      } else {
        console.log('  (데이터 없음)');
      }
      console.log('');
      
      await sequelize.close();
      return;
    }

    console.log('❌ status 컬럼이 없습니다. 추가를 진행합니다...\n');

    // 2. status 컬럼 추가
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('2. status 컬럼 추가');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 컬럼 추가
    await sequelize.query(`
      ALTER TABLE companies 
      ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';
    `);

    console.log('✅ status 컬럼이 추가되었습니다.');

    // 기존 데이터를 'active'로 업데이트
    const updateResult = await sequelize.query(`
      UPDATE companies 
      SET status = 'active' 
      WHERE status IS NULL OR status = '';
    `);

    console.log('✅ 기존 데이터를 \'active\'로 설정했습니다.');

    // CHECK 제약조건 추가 시도 (PostgreSQL)
    try {
      await sequelize.query(`
        ALTER TABLE companies 
        ADD CONSTRAINT companies_status_check 
        CHECK (status IN ('active', 'inactive', 'suspended'));
      `);
      console.log('✅ status 값 제약조건이 추가되었습니다.');
    } catch (error: any) {
      console.log('ℹ️  제약조건 추가는 선택사항입니다. (이미 존재하거나 다른 이유로 실패)');
    }

    console.log('');

    // 3. 추가 결과 확인
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('3. 추가 결과 확인');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const verifyCheck = await sequelize.query(
      `SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'companies'
        AND column_name = 'status';`,
      { type: QueryTypes.SELECT }
    ) as any[];

    if (verifyCheck.length > 0) {
      console.log('✅ status 컬럼이 성공적으로 추가되었습니다!');
      verifyCheck.forEach((col: any) => {
        console.log(`  - 타입: ${col.data_type}`);
        console.log(`  - Nullable: ${col.is_nullable}`);
        console.log(`  - 기본값: ${col.column_default || '(없음)'}`);
      });
    } else {
      console.log('❌ status 컬럼 추가에 실패했습니다.');
    }

    // 데이터 확인
    const dataCheck = await sequelize.query(
      `SELECT status, COUNT(*) as count
      FROM companies
      GROUP BY status
      ORDER BY count DESC;`,
      { type: QueryTypes.SELECT }
    ) as any[];

    if (dataCheck.length > 0) {
      console.log('\n현재 status 값 분포:');
      dataCheck.forEach((row: any) => {
        console.log(`  - ${row.status || '(null)'}: ${row.count}개`);
      });
    }

    console.log('');

  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

addStatusColumnToCompanies();











