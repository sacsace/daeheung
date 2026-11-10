import { sequelize } from '../src/models';
import { QueryTypes } from 'sequelize';

// 모든 테이블에 is_active 컬럼 추가
const addIsActiveToAllTables = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ 데이터베이스 연결 성공\n');

    // 주요 테이블 목록 (users, companies는 status 필드가 있으므로 제외 가능)
    const tables = [
      'projects',
      'products',
      'inventory_transactions',
      'invoices',
      'invoice_items',
      'quotations',
      'vacations',
      'performances',
      'payrolls',
      'attendances',
      'work_statistics',
      'approvals',
      'work_reports',
      'room_bookings',
      'partners',
      'partner_gst_numbers',
      'customers',
      'sales_opportunities',
      'contracts',
      'support_tickets',
      'support_responses',
      'menus',
      'user_permissions',
      'company_gst_numbers'
    ];

    for (const table of tables) {
      try {
        // 테이블 존재 확인
        const [tableExists] = await sequelize.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = '${table}'
          );
        `, { type: QueryTypes.SELECT });

        if (!(tableExists as any).exists) {
          console.log(`⏭️  ${table} 테이블이 존재하지 않습니다. 건너뜁니다.`);
          continue;
        }

        // is_active 컬럼 존재 확인
        const [columnExists] = await sequelize.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = '${table}' 
            AND column_name = 'is_active'
          );
        `, { type: QueryTypes.SELECT });

        if ((columnExists as any).exists) {
          console.log(`✅ ${table} 테이블에 is_active 컬럼이 이미 존재합니다.`);
          continue;
        }

        // is_active 컬럼 추가
        await sequelize.query(`
          ALTER TABLE ${table} 
          ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
        `);

        // 인덱스 추가 (성능 향상)
        await sequelize.query(`
          CREATE INDEX IF NOT EXISTS ${table}_is_active_idx ON ${table}(is_active);
        `);

        console.log(`✅ ${table} 테이블에 is_active 컬럼이 추가되었습니다.`);
      } catch (error: any) {
        console.error(`❌ ${table} 테이블 처리 중 오류:`, error.message);
      }
    }

    console.log('\n✅ 모든 테이블 처리 완료\n');
  } catch (error: any) {
    console.error('❌ 스크립트 실행 실패:', error);
  } finally {
    await sequelize.close();
  }
};

addIsActiveToAllTables();





