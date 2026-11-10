import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

(async () => {
  try {
    console.log('🔌 데이터베이스 연결 중...');
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
      process.exit(0);
    }

    console.log('📝 company_gst_numbers 테이블 생성 중...');

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

    console.log('✅ 테이블 생성 완료');

    // 인덱스 생성
    await sequelize.query(`
      CREATE INDEX idx_company_gst_numbers_company_id ON company_gst_numbers(company_id);
      CREATE INDEX idx_company_gst_numbers_gst_number ON company_gst_numbers(gst_number);
    `, { type: QueryTypes.RAW });

    console.log('✅ 인덱스 생성 완료');
    console.log('\n✅ company_gst_numbers 테이블 생성 완료!');

    await sequelize.close();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    if (error.code) {
      console.error('   오류 코드:', error.code);
    }
    await sequelize.close();
    process.exit(1);
  }
})();























