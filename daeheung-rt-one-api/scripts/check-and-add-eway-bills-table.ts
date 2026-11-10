import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

async function checkAndAddEWayBillsTable() {
  try {
    console.log('📋 eway_bills 테이블 확인 중...');
    const tableExists = await sequelize.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'eway_bills'
      );`,
      { type: QueryTypes.SELECT }
    );

    const exists = (tableExists[0] as any).exists;

    if (exists) {
      console.log('✅ eway_bills 테이블이 이미 존재합니다.');
      
      // is_active 컬럼 존재 확인
      const columnExists = await sequelize.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'eway_bills'
          AND column_name = 'is_active'
        );`,
        { type: QueryTypes.SELECT }
      );

      if ((columnExists[0] as any).exists) {
        console.log('✅ eway_bills 테이블에 is_active 컬럼이 이미 존재합니다.');
      } else {
        console.log('⚠️  is_active 컬럼이 없습니다. 추가 중...');
        await sequelize.query(`
          ALTER TABLE eway_bills
          ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
        `);
        console.log('✅ is_active 컬럼이 추가되었습니다.');
      }
      return;
    }

    console.log('⚠️  eway_bills 테이블이 없습니다. 생성 중...');

    // ENUM 타입 생성
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_eway_bills_supply_type" AS ENUM('outward', 'inward');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_eway_bills_document_type" AS ENUM('invoice', 'credit_note', 'debit_note', 'bill_of_supply');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_eway_bills_transport_mode" AS ENUM('road', 'rail', 'air', 'ship');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_eway_bills_status" AS ENUM('draft', 'generated', 'active', 'expired', 'cancelled', 'rejected');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // eway_bills 테이블 생성
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS eway_bills (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        eway_bill_number VARCHAR(50) NOT NULL UNIQUE,
        invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
        invoice_number VARCHAR(100) NOT NULL,
        invoice_date DATE NOT NULL,
        supply_type "enum_eway_bills_supply_type" NOT NULL,
        sub_supply_type VARCHAR(100),
        document_type "enum_eway_bills_document_type" NOT NULL DEFAULT 'invoice',
        document_number VARCHAR(100) NOT NULL,
        document_date DATE NOT NULL,
        from_gstin VARCHAR(15) NOT NULL,
        from_name VARCHAR(255) NOT NULL,
        from_address TEXT NOT NULL,
        from_pincode VARCHAR(10) NOT NULL,
        from_state VARCHAR(100) NOT NULL,
        from_state_code INTEGER NOT NULL,
        to_gstin VARCHAR(15),
        to_name VARCHAR(255) NOT NULL,
        to_address TEXT NOT NULL,
        to_pincode VARCHAR(10) NOT NULL,
        to_state VARCHAR(100) NOT NULL,
        to_state_code INTEGER NOT NULL,
        transport_mode "enum_eway_bills_transport_mode" NOT NULL DEFAULT 'road',
        vehicle_number VARCHAR(50),
        vehicle_type VARCHAR(50),
        transporter_id VARCHAR(100),
        transporter_name VARCHAR(255),
        transporter_gstin VARCHAR(15),
        transporter_doc_number VARCHAR(100),
        transporter_doc_date DATE,
        distance DECIMAL(10, 2),
        total_value DECIMAL(15, 2) NOT NULL DEFAULT 0,
        total_tax_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
        total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
        status "enum_eway_bills_status" NOT NULL DEFAULT 'draft',
        generated_at TIMESTAMP WITH TIME ZONE,
        valid_until TIMESTAMP WITH TIME ZONE,
        cancelled_at TIMESTAMP WITH TIME ZONE,
        cancellation_reason TEXT,
        generated_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        notes TEXT,
        qr_code TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 인덱스 생성
    await sequelize.query(`CREATE INDEX IF NOT EXISTS eway_bills_tenant_company_idx ON eway_bills(tenant_id, company_id);`);
    await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS eway_bills_eway_bill_number_idx ON eway_bills(eway_bill_number);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS eway_bills_invoice_id_idx ON eway_bills(invoice_id);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS eway_bills_invoice_number_idx ON eway_bills(invoice_number);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS eway_bills_status_idx ON eway_bills(status);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS eway_bills_generated_at_idx ON eway_bills(generated_at);`);

    // eway_bill_items 테이블 생성
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS eway_bill_items (
        id SERIAL PRIMARY KEY,
        eway_bill_id INTEGER NOT NULL REFERENCES eway_bills(id) ON DELETE CASCADE,
        item_name VARCHAR(255) NOT NULL,
        hsn_code VARCHAR(20) NOT NULL,
        quantity DECIMAL(15, 3) NOT NULL DEFAULT 0,
        unit VARCHAR(20) NOT NULL DEFAULT 'PCS',
        unit_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
        total_value DECIMAL(15, 2) NOT NULL DEFAULT 0,
        cgst_rate DECIMAL(5, 2),
        cgst_amount DECIMAL(15, 2) DEFAULT 0,
        sgst_rate DECIMAL(5, 2),
        sgst_amount DECIMAL(15, 2) DEFAULT 0,
        igst_rate DECIMAL(5, 2),
        igst_amount DECIMAL(15, 2) DEFAULT 0,
        cess_rate DECIMAL(5, 2),
        cess_amount DECIMAL(15, 2) DEFAULT 0,
        total_tax_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
        total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await sequelize.query(`CREATE INDEX IF NOT EXISTS eway_bill_items_eway_bill_id_idx ON eway_bill_items(eway_bill_id);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS eway_bill_items_hsn_code_idx ON eway_bill_items(hsn_code);`);

    console.log('✅ eway_bills 테이블이 생성되었습니다.');
  } catch (error: any) {
    console.error('❌ eway_bills 테이블 생성 실패:', error);
    throw error;
  } finally {
    // sequelize.close(); // 스크립트가 종료될 때만 닫도록
  }
}

checkAndAddEWayBillsTable();



