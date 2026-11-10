import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

const fixCompanyColumnLengths = async () => {
  try {
    console.log('🔌 데이터베이스 연결 중...');
    await sequelize.authenticate();
    console.log('✅ 데이터베이스 연결 성공\n');
    console.log('🔧 companies 테이블 컬럼 길이 수정 중...\n');

    // 모델에 정의된 필드 길이와 DB 컬럼 길이 비교
    const columnUpdates = [
      { name: 'business_number', newLength: 50, currentType: 'VARCHAR' },
      { name: 'phone', newLength: 50, currentType: 'VARCHAR' },
      { name: 'subscription_status', newLength: 50, currentType: 'VARCHAR' },
      { name: 'subscription_plan', newLength: 50, currentType: 'VARCHAR' },
      { name: 'name', newLength: 255, currentType: 'VARCHAR' },
      { name: 'ceo_name', newLength: 100, currentType: 'VARCHAR' },
      { name: 'email', newLength: 255, currentType: 'VARCHAR' },
      { name: 'website', newLength: 255, currentType: 'VARCHAR' },
      { name: 'industry', newLength: 100, currentType: 'VARCHAR' }
    ];

    for (const column of columnUpdates) {
      try {
        // 현재 컬럼 정보 확인
        const [colInfo] = await sequelize.query(`
          SELECT 
            data_type,
            character_maximum_length
          FROM information_schema.columns
          WHERE table_schema = 'public' 
          AND table_name = 'companies' 
          AND column_name = '${column.name}';
        `, { type: QueryTypes.SELECT }) as any[];

        if (colInfo) {
          const currentLength = colInfo.character_maximum_length;
          if (currentLength && currentLength < column.newLength) {
            console.log(`📝 ${column.name} 컬럼 길이 변경: ${currentLength} -> ${column.newLength}`);
            await sequelize.query(`
              ALTER TABLE companies 
              ALTER COLUMN ${column.name} TYPE VARCHAR(${column.newLength});
            `, { type: QueryTypes.RAW });
            console.log(`✅ ${column.name} 컬럼 길이 변경 완료\n`);
          } else if (!currentLength || currentLength >= column.newLength) {
            console.log(`✓ ${column.name} 컬럼 길이가 이미 충분함 (${currentLength || 'unlimited'})\n`);
          }
        } else {
          console.log(`⚠️ ${column.name} 컬럼을 찾을 수 없습니다.\n`);
        }
      } catch (error: any) {
        console.error(`❌ ${column.name} 컬럼 처리 중 오류:`, error.message);
        if (error.code === '22001') {
          console.error(`   데이터가 너무 길어서 변경할 수 없습니다. 먼저 데이터를 확인하세요.`);
        }
      }
    }

    // 최종 확인
    console.log('\n📋 최종 컬럼 정보:');
    console.log('─'.repeat(80));
    const allColumns = await sequelize.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'companies'
      AND data_type = 'character varying'
      ORDER BY column_name;
    `, { type: QueryTypes.SELECT }) as any[];

    allColumns.forEach((col: any) => {
      const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
      console.log(`  ${col.column_name.padEnd(30)} ${col.data_type}${length}`);
    });
    console.log('─'.repeat(80));

    console.log('\n✅ 컬럼 길이 수정 완료');
  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    if (error.code) {
      console.error('   오류 코드:', error.code);
    }
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
};

fixCompanyColumnLengths();

