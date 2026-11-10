import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

const createGstTable = async () => {
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

    if (tableCheck && tableCheck.exists) {
      console.log('✅ company_gst_numbers 테이블이 이미 존재합니다.');
      await sequelize.close();
      return;
    }

    console.log('📝 company_gst_numbers 테이블 생성 중...\n');

    // 테이블 생성
    await sequelize.query(`
      CREATE TABLE company_gst_numbers (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        gst_number VARCHAR(50) NOT NULL,
        state_code VARCHAR(10),
        registration_date DATE,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, { type: QueryTypes.RAW });

    console.log('✅ 테이블 생성 완료\n');

    // 인덱스 생성
    console.log('📝 인덱스 생성 중...\n');
    await sequelize.query(`
      CREATE INDEX idx_company_gst_numbers_company_id ON company_gst_numbers(company_id);
    `, { type: QueryTypes.RAW });
    console.log('✅ company_id 인덱스 생성 완료');

    await sequelize.query(`
      CREATE INDEX idx_company_gst_numbers_gst_number ON company_gst_numbers(gst_number);
    `, { type: QueryTypes.RAW });
    console.log('✅ gst_number 인덱스 생성 완료\n');

    // 테이블 구조 확인
    const columns = await sequelize.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'company_gst_numbers'
      ORDER BY ordinal_position;
    `, { type: QueryTypes.SELECT }) as any[];

    console.log('📋 생성된 테이블 구조:');
    console.log('─'.repeat(80));
    columns.forEach((col: any) => {
      const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      console.log(`  ${col.column_name.padEnd(25)} ${(col.data_type + length).padEnd(20)} ${nullable}${defaultVal}`);
    });
    console.log('─'.repeat(80));

    console.log('\n✅ company_gst_numbers 테이블 생성 완료!');
  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    if (error.code === '42P01') {
      console.error('   참조 테이블(companies)이 존재하지 않습니다.');
    } else if (error.code === '42P16') {
      console.error('   외래 키 제약 조건 오류가 발생했습니다.');
    }
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
};

createGstTable();























