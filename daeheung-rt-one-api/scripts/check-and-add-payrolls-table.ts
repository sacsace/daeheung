import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

async function checkAndAddPayrollsTable() {
  try {
    console.log('📋 payrolls 테이블 확인 중...');

    // 테이블 존재 여부 확인
    const tableExists = await sequelize.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'payrolls'
      );`,
      { type: QueryTypes.SELECT }
    );

    const exists = (tableExists[0] as any).exists;

    if (exists) {
      console.log('✅ payrolls 테이블이 이미 존재합니다.');
      return;
    }

    console.log('⚠️  payrolls 테이블이 없습니다. 생성 중...');

    // payrolls 테이블 생성
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS payrolls (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        payroll_period VARCHAR(20) NOT NULL,
        basic_salary DECIMAL(15, 2) NOT NULL DEFAULT 0,
        overtime_pay DECIMAL(15, 2) NOT NULL DEFAULT 0,
        bonus DECIMAL(15, 2) NOT NULL DEFAULT 0,
        allowances DECIMAL(15, 2) NOT NULL DEFAULT 0,
        deductions DECIMAL(15, 2) NOT NULL DEFAULT 0,
        gross_salary DECIMAL(15, 2) NOT NULL DEFAULT 0,
        net_salary DECIMAL(15, 2) NOT NULL DEFAULT 0,
        tax_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        payment_date DATE,
        created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 인덱스 생성
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS payrolls_tenant_company_idx ON payrolls(tenant_id, company_id);
      CREATE INDEX IF NOT EXISTS payrolls_employee_id_idx ON payrolls(employee_id);
      CREATE INDEX IF NOT EXISTS payrolls_payroll_period_idx ON payrolls(payroll_period);
      CREATE INDEX IF NOT EXISTS payrolls_status_idx ON payrolls(status);
      CREATE INDEX IF NOT EXISTS payrolls_created_by_idx ON payrolls(created_by);
    `);

    console.log('✅ payrolls 테이블이 성공적으로 생성되었습니다.');
  } catch (error: any) {
    console.error('❌ payrolls 테이블 생성 오류:', error.message);
    if (error.original) {
      console.error('원본 오류:', error.original);
    }
    throw error;
  }
}

// 스크립트 직접 실행
if (require.main === module) {
  checkAndAddPayrollsTable()
    .then(() => {
      console.log('✅ 스크립트 실행 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 스크립트 실행 실패:', error);
      process.exit(1);
    });
}

export default checkAndAddPayrollsTable;





