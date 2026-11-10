import { sequelize } from '../src/models';
import { QueryTypes } from 'sequelize';

const checkGstTable = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ 데이터베이스 연결 성공\n');
    console.log('🔍 GST 테이블 확인 중...\n');

    // 1. company_gst_numbers 테이블 존재 여부 확인
    try {
      const [tableExists] = await sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'company_gst_numbers'
        );
      `, { type: QueryTypes.SELECT }) as any[];

      if (tableExists && tableExists.exists) {
        console.log('✅ company_gst_numbers 테이블이 존재합니다.');
      } else {
        console.log('❌ company_gst_numbers 테이블이 존재하지 않습니다.');
        console.log('📝 테이블을 생성하시겠습니까?');
        return;
      }
    } catch (error: any) {
      console.log('⚠️ 테이블 확인 중 오류:', error.message);
      return;
    }

    // 2. 테이블 구조 확인
    try {
      const columns = await sequelize.query(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = 'company_gst_numbers'
        ORDER BY ordinal_position;
      `, { type: QueryTypes.SELECT }) as any[];

      console.log('\n📋 테이블 구조:');
      console.log('─'.repeat(80));
      columns.forEach((col: any) => {
        const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        console.log(`  ${col.column_name.padEnd(25)} ${(col.data_type + length).padEnd(20)} ${nullable}${defaultVal}`);
      });
      console.log('─'.repeat(80));
    } catch (error: any) {
      console.log('⚠️ 테이블 구조 확인 중 오류:', error.message);
    }

    // 3. 인덱스 확인
    try {
      const indexes = await sequelize.query(`
        SELECT 
          indexname,
          indexdef
        FROM pg_indexes
        WHERE tablename = 'company_gst_numbers';
      `, { type: QueryTypes.SELECT }) as any[];

      if (indexes && indexes.length > 0) {
        console.log('\n📊 인덱스:');
        indexes.forEach((idx: any) => {
          console.log(`  - ${idx.indexname}`);
        });
      } else {
        console.log('\n⚠️ 인덱스가 없습니다.');
      }
    } catch (error: any) {
      console.log('⚠️ 인덱스 확인 중 오류:', error.message);
    }

    // 4. 데이터 개수 확인
    try {
      const result = await sequelize.query(`
        SELECT COUNT(*) as count FROM company_gst_numbers;
      `, { type: QueryTypes.SELECT }) as any[];

      const count = result && result[0] ? result[0].count : 0;
      console.log(`\n📈 저장된 GST 번호 개수: ${count}개`);
    } catch (error: any) {
      console.log('⚠️ 데이터 개수 확인 중 오류:', error.message);
    }

    // 5. 외래 키 제약 조건 확인
    try {
      const constraints = await sequelize.query(`
        SELECT
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        LEFT JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.table_name = 'company_gst_numbers';
      `, { type: QueryTypes.SELECT }) as any[];

      if (constraints && constraints.length > 0) {
        console.log('\n🔗 제약 조건:');
        constraints.forEach((constraint: any) => {
          if (constraint.constraint_type === 'FOREIGN KEY') {
            console.log(`  - ${constraint.constraint_name}: ${constraint.column_name} -> ${constraint.foreign_table_name}.${constraint.foreign_column_name}`);
          } else {
            console.log(`  - ${constraint.constraint_name}: ${constraint.constraint_type}`);
          }
        });
      }
    } catch (error: any) {
      console.log('⚠️ 제약 조건 확인 중 오류:', error.message);
    }

    console.log('\n✅ 확인 완료!');
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    await sequelize.close();
  }
};

checkGstTable();

