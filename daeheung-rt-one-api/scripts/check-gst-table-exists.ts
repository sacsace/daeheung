import { sequelize } from '../src/models';
import { QueryTypes } from 'sequelize';

const checkGstTable = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ 데이터베이스 연결 성공\n');

    // 1. 테이블 존재 여부 확인
    console.log('🔍 company_gst_numbers 테이블 존재 여부 확인 중...\n');
    const [tableCheck] = await sequelize.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'company_gst_numbers'
      ) as exists;
    `, { type: QueryTypes.SELECT }) as any[];

    if (tableCheck && tableCheck.exists) {
      console.log('✅ company_gst_numbers 테이블이 존재합니다.\n');
      
      // 2. 테이블 구조 확인
      console.log('📋 테이블 구조:');
      console.log('─'.repeat(80));
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

      columns.forEach((col: any) => {
        const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        console.log(`  ${col.column_name.padEnd(25)} ${(col.data_type + length).padEnd(20)} ${nullable}${defaultVal}`);
      });

      // 3. 인덱스 확인
      console.log('\n📊 인덱스:');
      console.log('─'.repeat(80));
      const indexes = await sequelize.query(`
        SELECT 
          indexname,
          indexdef
        FROM pg_indexes
        WHERE schemaname = 'public' 
        AND tablename = 'company_gst_numbers';
      `, { type: QueryTypes.SELECT }) as any[];

      if (indexes.length > 0) {
        indexes.forEach((idx: any) => {
          console.log(`  ${idx.indexname}`);
          console.log(`    ${idx.indexdef}`);
        });
      } else {
        console.log('  인덱스 없음');
      }

      // 4. 데이터 확인
      console.log('\n📦 저장된 데이터:');
      console.log('─'.repeat(80));
      const data = await sequelize.query(`
        SELECT 
          id,
          company_id,
          gst_number,
          state_code,
          registration_date,
          status,
          created_at,
          updated_at
        FROM company_gst_numbers
        ORDER BY id;
      `, { type: QueryTypes.SELECT }) as any[];

      if (data.length > 0) {
        console.log(`총 ${data.length}개의 GST 번호가 저장되어 있습니다:\n`);
        data.forEach((row: any) => {
          console.log(`  ID: ${row.id}, Company ID: ${row.company_id}, GST: ${row.gst_number}, Status: ${row.status}`);
        });
      } else {
        console.log('  저장된 데이터가 없습니다.');
      }

    } else {
      console.log('❌ company_gst_numbers 테이블이 존재하지 않습니다.\n');
      console.log('📝 테이블을 생성하려면 다음 SQL을 실행하세요:\n');
      console.log(`
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

CREATE INDEX idx_company_gst_numbers_company_id ON company_gst_numbers(company_id);
CREATE INDEX idx_company_gst_numbers_gst_number ON company_gst_numbers(gst_number);
      `);
    }

    console.log('\n✅ 확인 완료');
  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
};

checkGstTable();























