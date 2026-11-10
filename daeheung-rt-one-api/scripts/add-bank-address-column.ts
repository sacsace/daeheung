import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

const addBankAddressColumn = async () => {
  try {
    console.log('🔌 데이터베이스 연결 시도 중...');
    await sequelize.authenticate();
    console.log('✅ 데이터베이스 연결 성공\n');

    // bank_address 컬럼 존재 여부 확인
    const [checkResult] = await sequelize.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'companies' 
        AND column_name = 'bank_address'
      ) as exists;
    `, { type: QueryTypes.SELECT }) as any[];

    if (!checkResult.exists) {
      console.log('📝 bank_address 컬럼 추가 중...');
      await sequelize.query(`
        ALTER TABLE companies 
        ADD COLUMN bank_address TEXT;
      `, { type: QueryTypes.RAW });
      console.log('✅ bank_address 컬럼 추가 완료');
    } else {
      console.log('✓ bank_address 컬럼이 이미 존재합니다');
    }

    // 확인
    const [verifyResult] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'companies' 
      AND column_name = 'bank_address';
    `, { type: QueryTypes.SELECT }) as any[];

    if (verifyResult) {
      console.log('\n📋 컬럼 정보:');
      console.log(`  컬럼명: ${verifyResult.column_name}`);
      console.log(`  데이터 타입: ${verifyResult.data_type}`);
      console.log(`  NULL 허용: ${verifyResult.is_nullable}`);
    }

    console.log('\n✅ 작업 완료');
  } catch (error: any) {
    console.error('\n❌ 오류 발생:', error.message);
    if (error.stack) {
      console.error('스택 트레이스:', error.stack);
    }
    process.exit(1);
  } finally {
    try {
      await sequelize.close();
      console.log('데이터베이스 연결 종료');
    } catch (e) {
      // 무시
    }
  }
};

addBankAddressColumn();

