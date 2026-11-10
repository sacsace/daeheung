import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

async function checkAndAddInvoicesTable() {
  try {
    console.log('🔍 invoices 테이블 존재 여부 확인 중...');

    // 테이블 존재 여부 확인
    const [tableCheck] = await sequelize.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'invoices'
      ) as exists;
    `, { type: QueryTypes.SELECT }) as any[];

    const tableExists = tableCheck?.exists || (tableCheck as any)?.exists;

    if (tableExists) {
      console.log('✅ invoices 테이블이 이미 존재합니다.');
      
      // is_active 컬럼 존재 여부 확인
      const [columnCheck] = await sequelize.query(`
        SELECT EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'invoices'
          AND column_name = 'is_active'
        ) as exists;
      `, { type: QueryTypes.SELECT }) as any[];

      const columnExists = columnCheck?.exists || (columnCheck as any)?.exists;

      if (!columnExists) {
        console.log('📝 is_active 컬럼 추가 중...');
        await sequelize.query(`
          ALTER TABLE invoices 
          ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
        `);
        console.log('✅ is_active 컬럼 추가 완료');
      } else {
        console.log('✅ is_active 컬럼이 이미 존재합니다.');
      }

      return;
    }

    console.log('📝 invoices 테이블 생성 중...');

    // invoices 테이블 생성
    await sequelize.query(`
      CREATE TABLE invoices (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        invoice_number VARCHAR(50) NOT NULL UNIQUE,
        invoice_date DATE NOT NULL,
        due_date DATE NOT NULL,
        subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
        tax_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
        total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
        payment_method VARCHAR(50),
        payment_date DATE,
        notes TEXT,
        created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 인덱스 생성
    await sequelize.query(`
      CREATE INDEX idx_invoices_tenant_id ON invoices(tenant_id);
      CREATE INDEX idx_invoices_company_id ON invoices(company_id);
      CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
      CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);
      CREATE INDEX idx_invoices_status ON invoices(status);
      CREATE INDEX idx_invoices_payment_status ON invoices(payment_status);
      CREATE INDEX idx_invoices_invoice_date ON invoices(invoice_date);
      CREATE INDEX idx_invoices_created_by ON invoices(created_by);
      CREATE INDEX idx_invoices_is_active ON invoices(is_active);
      CREATE INDEX idx_invoices_tenant_company ON invoices(tenant_id, company_id);
      CREATE INDEX idx_invoices_company_status ON invoices(company_id, status);
    `);

    console.log('✅ invoices 테이블 생성 완료');

    // invoice_items 테이블 생성
    console.log('📝 invoice_items 테이블 생성 중...');

    const [itemsTableCheck] = await sequelize.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'invoice_items'
      ) as exists;
    `, { type: QueryTypes.SELECT }) as any[];

    const itemsTableExists = itemsTableCheck?.exists || (itemsTableCheck as any)?.exists;

    if (!itemsTableExists) {
      await sequelize.query(`
        CREATE TABLE invoice_items (
          id SERIAL PRIMARY KEY,
          invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
          item_name VARCHAR(200) NOT NULL,
          description TEXT,
          quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
          unit_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
          total_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
          tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
          tax_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // invoice_items 인덱스 생성
      await sequelize.query(`
        CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
        CREATE INDEX idx_invoice_items_item_name ON invoice_items(item_name);
      `);

      console.log('✅ invoice_items 테이블 생성 완료');
    } else {
      console.log('✅ invoice_items 테이블이 이미 존재합니다.');
    }

    console.log('✅ 모든 작업 완료!');
  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    console.error('상세 오류:', error);
    throw error;
  }
}

// 스크립트 실행
checkAndAddInvoicesTable()
  .then(() => {
    console.log('✅ 스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 스크립트 실행 실패:', error);
    process.exit(1);
  });





