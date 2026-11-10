import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

const syncCompanyColumns = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ 데이터베이스 연결 성공\n');
    console.log('🔧 회사 테이블 컬럼 동기화 중...\n');

    // 모델에 정의된 필드들 (코드 기준)
    const requiredColumns = [
      { name: 'bank_address', type: 'TEXT', nullable: true },
      { name: 'swift_code', type: 'VARCHAR(11)', nullable: true },
      { name: 'msme_number', type: 'VARCHAR(50)', nullable: true },
      { name: 'iec_number', type: 'VARCHAR(50)', nullable: true },
      { name: 'pan_number', type: 'VARCHAR(50)', nullable: true }
    ];

    // 각 컬럼 확인 및 추가
    for (const column of requiredColumns) {
      try {
        const [checkResult] = await sequelize.query(`
          SELECT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'companies' 
            AND column_name = '${column.name}'
          ) as exists;
        `, { type: QueryTypes.SELECT }) as any[];

        if (!checkResult.exists) {
          console.log(`📝 ${column.name} 컬럼 추가 중...`);
          await sequelize.query(`
            ALTER TABLE companies 
            ADD COLUMN ${column.name} ${column.type}${column.nullable ? '' : ' NOT NULL'};
          `, { type: QueryTypes.RAW });
          console.log(`✅ ${column.name} 컬럼 추가 완료`);
        } else {
          console.log(`✓ ${column.name} 컬럼 이미 존재함`);
        }
      } catch (error: any) {
        console.error(`❌ ${column.name} 컬럼 처리 중 오류:`, error.message);
      }
    }

    // company_gst_numbers 테이블 확인 및 생성
    try {
      const [tableCheck] = await sequelize.query(`
        SELECT EXISTS (
          SELECT 1 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'company_gst_numbers'
        ) as exists;
      `, { type: QueryTypes.SELECT }) as any[];

      if (!tableCheck.exists) {
        console.log('\n📝 company_gst_numbers 테이블 생성 중...');
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

        // 인덱스 생성
        await sequelize.query(`
          CREATE INDEX idx_company_gst_numbers_company_id ON company_gst_numbers(company_id);
          CREATE INDEX idx_company_gst_numbers_gst_number ON company_gst_numbers(gst_number);
        `, { type: QueryTypes.RAW });
        console.log('✅ company_gst_numbers 테이블 생성 완료');
      } else {
        console.log('\n✓ company_gst_numbers 테이블 이미 존재함');
      }
    } catch (error: any) {
      console.error('❌ company_gst_numbers 테이블 처리 중 오류:', error.message);
    }

    // 이미지 컬럼 타입 확인 (BYTEA로 변경 필요)
    try {
      const imageColumns = ['company_logo', 'company_seal', 'ceo_signature'];
      for (const col of imageColumns) {
        const [colInfo] = await sequelize.query(`
          SELECT data_type 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'companies' 
          AND column_name = '${col}';
        `, { type: QueryTypes.SELECT }) as any[];

        if (colInfo && colInfo.data_type) {
          if (colInfo.data_type !== 'bytea') {
            console.log(`📝 ${col} 컬럼 타입을 BYTEA로 변경 중...`);
            try {
              await sequelize.query(`
                ALTER TABLE companies 
                ALTER COLUMN ${col} TYPE BYTEA USING ${col}::bytea;
              `, { type: QueryTypes.RAW });
              console.log(`✅ ${col} 컬럼 타입 변경 완료`);
            } catch (err: any) {
              console.log(`⚠️ ${col} 컬럼 타입 변경 실패: ${err.message}`);
            }
          } else {
            console.log(`✓ ${col} 컬럼 타입이 이미 BYTEA임`);
          }
        }
      }
    } catch (error: any) {
      console.log('⚠️ 이미지 컬럼 타입 확인 중 오류:', error.message);
    }

    console.log('\n✅ 모든 컬럼 동기화 완료');
  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
};

syncCompanyColumns();




















