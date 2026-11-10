import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

const createGstTableIndexes = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ 데이터베이스 연결 성공\n');

    // 테이블 존재 여부 확인
    const [tableCheck] = await sequelize.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'company_gst_numbers'
      ) as exists;
    `, { type: QueryTypes.SELECT }) as any[];

    if (!tableCheck || !tableCheck.exists) {
      console.log('❌ company_gst_numbers 테이블이 존재하지 않습니다.');
      console.log('   먼저 테이블을 생성해주세요.');
      await sequelize.close();
      process.exit(1);
    }

    console.log('📊 company_gst_numbers 테이블 인덱스 구성 중...\n');

    // 기존 인덱스 확인
    const existingIndexes = await sequelize.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public' 
      AND tablename = 'company_gst_numbers';
    `, { type: QueryTypes.SELECT }) as any[];

    const existingIndexNames = existingIndexes.map((idx: any) => idx.indexname);
    console.log('기존 인덱스:', existingIndexNames.length > 0 ? existingIndexNames.join(', ') : '없음\n');

    // 1. company_id 인덱스 (외래 키, 조회 성능 향상)
    if (!existingIndexNames.includes('idx_company_gst_numbers_company_id')) {
      console.log('📝 company_id 인덱스 생성 중...');
      await sequelize.query(`
        CREATE INDEX idx_company_gst_numbers_company_id 
        ON company_gst_numbers(company_id);
      `, { type: QueryTypes.RAW });
      console.log('✅ company_id 인덱스 생성 완료\n');
    } else {
      console.log('✓ company_id 인덱스 이미 존재함\n');
    }

    // 2. gst_number 인덱스 (고유성 검증 및 조회 성능 향상)
    if (!existingIndexNames.includes('idx_company_gst_numbers_gst_number')) {
      console.log('📝 gst_number 인덱스 생성 중...');
      await sequelize.query(`
        CREATE INDEX idx_company_gst_numbers_gst_number 
        ON company_gst_numbers(gst_number);
      `, { type: QueryTypes.RAW });
      console.log('✅ gst_number 인덱스 생성 완료\n');
    } else {
      console.log('✓ gst_number 인덱스 이미 존재함\n');
    }

    // 3. status 인덱스 (활성/비활성 조회 성능 향상)
    if (!existingIndexNames.includes('idx_company_gst_numbers_status')) {
      console.log('📝 status 인덱스 생성 중...');
      await sequelize.query(`
        CREATE INDEX idx_company_gst_numbers_status 
        ON company_gst_numbers(status);
      `, { type: QueryTypes.RAW });
      console.log('✅ status 인덱스 생성 완료\n');
    } else {
      console.log('✓ status 인덱스 이미 존재함\n');
    }

    // 4. 복합 인덱스: company_id + status (특정 회사의 활성 GST 번호 조회)
    if (!existingIndexNames.includes('idx_company_gst_numbers_company_status')) {
      console.log('📝 company_id + status 복합 인덱스 생성 중...');
      await sequelize.query(`
        CREATE INDEX idx_company_gst_numbers_company_status 
        ON company_gst_numbers(company_id, status);
      `, { type: QueryTypes.RAW });
      console.log('✅ company_id + status 복합 인덱스 생성 완료\n');
    } else {
      console.log('✓ company_id + status 복합 인덱스 이미 존재함\n');
    }

    // 5. gst_number 고유 인덱스 (중복 방지)
    try {
      if (!existingIndexNames.includes('idx_company_gst_numbers_gst_number_unique')) {
        console.log('📝 gst_number 고유 인덱스 생성 중...');
        await sequelize.query(`
          CREATE UNIQUE INDEX idx_company_gst_numbers_gst_number_unique 
          ON company_gst_numbers(gst_number);
        `, { type: QueryTypes.RAW });
        console.log('✅ gst_number 고유 인덱스 생성 완료\n');
      } else {
        console.log('✓ gst_number 고유 인덱스 이미 존재함\n');
      }
    } catch (error: any) {
      if (error.code === '42P07') {
        console.log('⚠️ gst_number 고유 인덱스가 이미 존재하거나 중복 데이터가 있어 생성할 수 없습니다.\n');
      } else {
        console.log('⚠️ gst_number 고유 인덱스 생성 실패:', error.message, '\n');
      }
    }

    // 최종 인덱스 목록 확인
    const finalIndexes = await sequelize.query(`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' 
      AND tablename = 'company_gst_numbers'
      ORDER BY indexname;
    `, { type: QueryTypes.SELECT }) as any[];

    console.log('📋 최종 인덱스 목록:');
    console.log('─'.repeat(80));
    finalIndexes.forEach((idx: any) => {
      console.log(`  ${idx.indexname}`);
      console.log(`    ${idx.indexdef}`);
    });
    console.log('─'.repeat(80));

    console.log('\n✅ 인덱스 구성 완료!');
  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    if (error.code) {
      console.error('   오류 코드:', error.code);
    }
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
};

createGstTableIndexes();























