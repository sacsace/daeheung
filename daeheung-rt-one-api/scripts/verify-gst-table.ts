import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

(async () => {
  try {
    console.log('🔌 데이터베이스 연결 중...');
    await sequelize.authenticate();
    console.log('✅ 데이터베이스 연결 성공\n');

    // 테이블 존재 여부 확인
    const [result] = await sequelize.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'company_gst_numbers'
      ) as exists;
    `, { type: QueryTypes.SELECT }) as any[];

    if (result && result.exists) {
      console.log('✅ company_gst_numbers 테이블이 존재합니다.\n');
      
      // 테이블 구조 확인
      const columns = await sequelize.query(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'company_gst_numbers'
        ORDER BY ordinal_position;
      `, { type: QueryTypes.SELECT }) as any[];

      console.log('📋 테이블 구조:');
      columns.forEach((col: any) => {
        const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
        console.log(`  - ${col.column_name}: ${col.data_type}${length} (${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
      });

      // 데이터 개수 확인
      const [countResult] = await sequelize.query(`
        SELECT COUNT(*) as count FROM company_gst_numbers;
      `, { type: QueryTypes.SELECT }) as any[];
      
      console.log(`\n📊 저장된 데이터: ${countResult.count}개`);
    } else {
      console.log('❌ company_gst_numbers 테이블이 존재하지 않습니다.');
      console.log('\n📝 테이블을 생성하려면 다음 명령어를 실행하세요:');
      console.log('   npm run db:sync:company-columns');
      console.log('\n또는 SQL 파일을 직접 실행하세요:');
      console.log('   daeheung-rt-one-api/scripts/sync-company-columns.sql');
    }

    await sequelize.close();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ 오류:', error.message);
    process.exit(1);
  }
})();























