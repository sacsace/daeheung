import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

async function checkAndAddApprovalsTable() {
  try {
    console.log('📋 approvals 테이블 확인 중...');

    // 테이블 존재 여부 확인
    const tableExists = await sequelize.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'approvals'
      );`,
      { type: QueryTypes.SELECT }
    );

    const exists = (tableExists[0] as any).exists;

    if (exists) {
      console.log('✅ approvals 테이블이 이미 존재합니다.');
      return;
    }

    console.log('⚠️  approvals 테이블이 없습니다. 생성 중...');

    // ENUM 타입 생성
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_approvals_type" AS ENUM('expense', 'vacation', 'purchase', 'contract', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_approvals_status" AS ENUM('draft', 'submitted', 'in_review', 'approved', 'rejected', 'cancelled');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_approvals_priority" AS ENUM('low', 'medium', 'high', 'urgent');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // approvals 테이블 생성
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS approvals (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        document_id VARCHAR(100) NOT NULL UNIQUE,
        title VARCHAR(255) NOT NULL,
        type "enum_approvals_type" NOT NULL,
        category VARCHAR(100) NOT NULL,
        amount DECIMAL(15, 2),
        requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        attachments JSONB,
        status "enum_approvals_status" NOT NULL DEFAULT 'draft',
        priority "enum_approvals_priority" NOT NULL DEFAULT 'medium',
        current_approver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        approval_flow JSONB DEFAULT '[]'::jsonb,
        due_date DATE,
        comments JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 인덱스 생성
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS approvals_tenant_company_idx ON approvals(tenant_id, company_id);
      CREATE INDEX IF NOT EXISTS approvals_requester_id_idx ON approvals(requester_id);
      CREATE INDEX IF NOT EXISTS approvals_current_approver_id_idx ON approvals(current_approver_id);
      CREATE INDEX IF NOT EXISTS approvals_status_idx ON approvals(status);
      CREATE INDEX IF NOT EXISTS approvals_type_idx ON approvals(type);
      CREATE INDEX IF NOT EXISTS approvals_priority_idx ON approvals(priority);
      CREATE INDEX IF NOT EXISTS approvals_due_date_idx ON approvals(due_date);
      CREATE UNIQUE INDEX IF NOT EXISTS approvals_document_id_unique ON approvals(document_id);
    `);

    console.log('✅ approvals 테이블이 성공적으로 생성되었습니다.');
  } catch (error: any) {
    console.error('❌ approvals 테이블 생성 오류:', error.message);
    if (error.original) {
      console.error('원본 오류:', error.original);
    }
    throw error;
  }
}

// 스크립트 직접 실행
if (require.main === module) {
  checkAndAddApprovalsTable()
    .then(() => {
      console.log('✅ 스크립트 실행 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 스크립트 실행 실패:', error);
      process.exit(1);
    });
}

export default checkAndAddApprovalsTable;

