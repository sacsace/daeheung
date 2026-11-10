import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

async function checkAndAddProjectsTable() {
  try {
    console.log('📋 projects 테이블 확인 중...');

    // 테이블 존재 여부 확인
    const tableExists = await sequelize.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'projects'
      );`,
      { type: QueryTypes.SELECT }
    );

    const exists = (tableExists[0] as any).exists;

    if (exists) {
      console.log('✅ projects 테이블이 이미 존재합니다.');
      return;
    }

    console.log('⚠️  projects 테이블이 없습니다. 생성 중...');

    // projects 테이블 생성
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
        project_code VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'planning',
        priority VARCHAR(20) NOT NULL DEFAULT 'medium',
        start_date DATE NOT NULL,
        end_date DATE,
        budget DECIMAL(15, 2) NOT NULL DEFAULT 0,
        actual_cost DECIMAL(15, 2) NOT NULL DEFAULT 0,
        progress INTEGER NOT NULL DEFAULT 0,
        project_manager INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 인덱스 생성
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS projects_tenant_company_idx ON projects(tenant_id, company_id);
      CREATE INDEX IF NOT EXISTS projects_customer_id_idx ON projects(customer_id);
      CREATE INDEX IF NOT EXISTS projects_project_code_idx ON projects(project_code);
      CREATE INDEX IF NOT EXISTS projects_status_idx ON projects(status);
      CREATE INDEX IF NOT EXISTS projects_priority_idx ON projects(priority);
      CREATE INDEX IF NOT EXISTS projects_project_manager_idx ON projects(project_manager);
      CREATE INDEX IF NOT EXISTS projects_created_by_idx ON projects(created_by);
      CREATE INDEX IF NOT EXISTS projects_start_date_idx ON projects(start_date);
    `);

    console.log('✅ projects 테이블이 성공적으로 생성되었습니다.');
  } catch (error: any) {
    console.error('❌ projects 테이블 생성 오류:', error.message);
    if (error.original) {
      console.error('원본 오류:', error.original);
    }
    throw error;
  }
}

// 스크립트 직접 실행
if (require.main === module) {
  checkAndAddProjectsTable()
    .then(() => {
      console.log('✅ 스크립트 실행 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 스크립트 실행 실패:', error);
      process.exit(1);
    });
}

export default checkAndAddProjectsTable;





