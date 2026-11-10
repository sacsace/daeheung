import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';
import fs from 'fs';
import path from 'path';

const createPartnersTable = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ 데이터베이스 연결 성공\n');
    console.log('🔧 파트너 테이블 생성 중...\n');

    // 1. business_type ENUM 타입 생성
    console.log('📝 business_type ENUM 타입 생성 중...');
    try {
      await sequelize.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'partner_business_type') THEN
            CREATE TYPE partner_business_type AS ENUM ('partner', 'customer', 'other');
          END IF;
        END $$;
      `, { type: QueryTypes.RAW });
      console.log('✅ business_type ENUM 타입 생성 완료\n');
    } catch (error: any) {
      console.log('⚠️  ENUM 타입 생성 중 오류 (이미 존재할 수 있음):', error.message);
    }

    // 2. status ENUM 타입 생성
    console.log('📝 status ENUM 타입 생성 중...');
    try {
      await sequelize.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'partner_status') THEN
            CREATE TYPE partner_status AS ENUM ('active', 'inactive', 'suspended');
          END IF;
        END $$;
      `, { type: QueryTypes.RAW });
      console.log('✅ status ENUM 타입 생성 완료\n');
    } catch (error: any) {
      console.log('⚠️  ENUM 타입 생성 중 오류 (이미 존재할 수 있음):', error.message);
    }

    // 3. partners 테이블 생성
    console.log('📝 partners 테이블 생성 중...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS partners (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id),
        company_id INTEGER NOT NULL REFERENCES companies(id),
        company_name VARCHAR(200) NOT NULL,
        business_number VARCHAR(50) NOT NULL,
        pan_number VARCHAR(50),
        representative VARCHAR(100),
        business_type partner_business_type NOT NULL DEFAULT 'partner',
        industry VARCHAR(100),
        address TEXT,
        phone VARCHAR(20),
        email VARCHAR(255) NOT NULL,
        website VARCHAR(255),
        bank_name VARCHAR(100),
        account_number VARCHAR(50),
        contract_start_date DATE,
        contract_end_date DATE,
        status partner_status NOT NULL DEFAULT 'active',
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `, { type: QueryTypes.RAW });
    console.log('✅ partners 테이블 생성 완료\n');

    // 4. partner_gst_numbers 테이블 생성
    console.log('📝 partner_gst_numbers 테이블 생성 중...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS partner_gst_numbers (
        id SERIAL PRIMARY KEY,
        partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
        gst_number VARCHAR(50) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `, { type: QueryTypes.RAW });
    console.log('✅ partner_gst_numbers 테이블 생성 완료\n');

    // 5. 인덱스 생성
    console.log('📝 인덱스 생성 중...');
    const indexes = [
      { name: 'idx_partner_gst_numbers_partner_id', sql: 'CREATE INDEX IF NOT EXISTS idx_partner_gst_numbers_partner_id ON partner_gst_numbers(partner_id);' },
      { name: 'idx_partner_gst_numbers_gst_number', sql: 'CREATE INDEX IF NOT EXISTS idx_partner_gst_numbers_gst_number ON partner_gst_numbers(gst_number);' },
      { name: 'idx_partners_tenant_id', sql: 'CREATE INDEX IF NOT EXISTS idx_partners_tenant_id ON partners(tenant_id);' },
      { name: 'idx_partners_company_id', sql: 'CREATE INDEX IF NOT EXISTS idx_partners_company_id ON partners(company_id);' },
      { name: 'idx_partners_status', sql: 'CREATE INDEX IF NOT EXISTS idx_partners_status ON partners(status);' }
    ];

    for (const index of indexes) {
      try {
        await sequelize.query(index.sql, { type: QueryTypes.RAW });
        console.log(`  ✓ ${index.name} 인덱스 생성 완료`);
      } catch (error: any) {
        console.log(`  ⚠️  ${index.name} 인덱스 생성 중 오류:`, error.message);
      }
    }
    console.log('');

    // 6. 테이블 확인
    console.log('🔍 생성된 테이블 확인 중...\n');
    const [partnersTable] = await sequelize.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'partners'
      ) as exists;
    `, { type: QueryTypes.SELECT }) as any[];

    const [gstTable] = await sequelize.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'partner_gst_numbers'
      ) as exists;
    `, { type: QueryTypes.SELECT }) as any[];

    if (partnersTable && partnersTable.exists) {
      console.log('✅ partners 테이블이 성공적으로 생성되었습니다.');
    } else {
      console.log('❌ partners 테이블 생성 실패');
    }

    if (gstTable && gstTable.exists) {
      console.log('✅ partner_gst_numbers 테이블이 성공적으로 생성되었습니다.');
    } else {
      console.log('❌ partner_gst_numbers 테이블 생성 실패');
    }

    console.log('\n✅ 파트너 테이블 생성 완료!');
    await sequelize.close();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    console.error(error);
    await sequelize.close();
    process.exit(1);
  }
};

createPartnersTable();


















