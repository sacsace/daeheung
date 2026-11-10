import dotenv from 'dotenv';
import path from 'path';

// .env 파일 로드
dotenv.config({ path: path.join(__dirname, '../.env') });

import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

const fixBusinessNumberLength = async () => {
  try {
    console.log('🔌 데이터베이스 연결 중...');
    console.log('DB_HOST:', process.env.DB_HOST);
    console.log('DB_NAME:', process.env.DB_NAME);
    await sequelize.authenticate();
    console.log('✅ 데이터베이스 연결 성공\n');

    // 1. 현재 컬럼 정보 확인
    console.log('📋 현재 business_number 컬럼 정보:');
    const [currentInfo] = await sequelize.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'companies' 
      AND column_name = 'business_number';
    `, { type: QueryTypes.SELECT }) as any[];

    if (currentInfo) {
      console.log(`  컬럼명: ${currentInfo.column_name}`);
      console.log(`  데이터 타입: ${currentInfo.data_type}`);
      console.log(`  최대 길이: ${currentInfo.character_maximum_length || 'unlimited'}`);
      console.log(`  NULL 허용: ${currentInfo.is_nullable}\n`);
    } else {
      console.log('  ⚠️ business_number 컬럼을 찾을 수 없습니다.\n');
      return;
    }

    // 2. business_number 컬럼 길이 변경
    if (currentInfo.character_maximum_length && currentInfo.character_maximum_length < 50) {
      console.log(`🔧 business_number 컬럼 길이 변경: ${currentInfo.character_maximum_length} -> 50`);
      await sequelize.query(`
        ALTER TABLE companies 
        ALTER COLUMN business_number TYPE VARCHAR(50);
      `, { type: QueryTypes.RAW });
      console.log('✅ business_number 컬럼 길이 변경 완료\n');
    } else {
      console.log(`✓ business_number 컬럼 길이가 이미 충분함 (${currentInfo.character_maximum_length || 'unlimited'})\n`);
    }

    // 3. 변경 후 확인
    console.log('📋 변경 후 business_number 컬럼 정보:');
    const [updatedInfo] = await sequelize.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'companies' 
      AND column_name = 'business_number';
    `, { type: QueryTypes.SELECT }) as any[];

    if (updatedInfo) {
      console.log(`  컬럼명: ${updatedInfo.column_name}`);
      console.log(`  데이터 타입: ${updatedInfo.data_type}`);
      console.log(`  최대 길이: ${updatedInfo.character_maximum_length || 'unlimited'}`);
      console.log(`  NULL 허용: ${updatedInfo.is_nullable}\n`);
    }

    console.log('✅ 완료');
  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    if (error.code) {
      console.error('   오류 코드:', error.code);
    }
    if (error.code === '22001') {
      console.error('   데이터가 너무 길어서 변경할 수 없습니다. 먼저 데이터를 확인하세요.');
    }
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
};

fixBusinessNumberLength();

