import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

async function checkAndFixProjectsTable() {
  try {
    console.log('📋 projects 테이블 컬럼 확인 중...');

    // 모든 필요한 컬럼 목록
    const requiredColumns = [
      { name: 'project_code', type: 'VARCHAR(50)', nullable: false, unique: true, default: null },
      { name: 'name', type: 'VARCHAR(200)', nullable: false, unique: false, default: null },
      { name: 'description', type: 'TEXT', nullable: true, unique: false, default: null },
      { name: 'status', type: 'VARCHAR(20)', nullable: false, unique: false, default: "'planning'" },
      { name: 'priority', type: 'VARCHAR(20)', nullable: false, unique: false, default: "'medium'" },
      { name: 'start_date', type: 'DATE', nullable: false, unique: false, default: null },
      { name: 'end_date', type: 'DATE', nullable: true, unique: false, default: null },
      { name: 'budget', type: 'DECIMAL(15, 2)', nullable: false, unique: false, default: '0' },
      { name: 'actual_cost', type: 'DECIMAL(15, 2)', nullable: false, unique: false, default: '0' },
      { name: 'progress', type: 'INTEGER', nullable: false, unique: false, default: '0' },
      { name: 'project_manager', type: 'INTEGER', nullable: false, unique: false, default: null, reference: 'users(id)' },
      { name: 'created_by', type: 'INTEGER', nullable: false, unique: false, default: null, reference: 'users(id)' },
    ];

    // 각 컬럼 확인 및 추가
    for (const col of requiredColumns) {
      const columnExists = await sequelize.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'projects' 
          AND column_name = '${col.name}'
        );`,
        { type: QueryTypes.SELECT }
      );

      const exists = (columnExists[0] as any).exists;

      if (exists) {
        console.log(`✅ ${col.name} 컬럼이 이미 존재합니다.`);
      } else {
        console.log(`⚠️  ${col.name} 컬럼이 없습니다. 추가 중...`);
        
        let alterQuery = `ALTER TABLE projects ADD COLUMN ${col.name} ${col.type}`;
        
        if (col.reference) {
          alterQuery += ` REFERENCES ${col.reference} ON DELETE CASCADE`;
        }
        
        // 먼저 NULL 허용으로 추가
        await sequelize.query(alterQuery);

        // 기본값이 있으면 설정
        if (col.default !== null) {
          await sequelize.query(`
            UPDATE projects 
            SET ${col.name} = ${col.default} 
            WHERE ${col.name} IS NULL;
          `);
        } else if (!col.nullable && col.name === 'project_manager') {
          // project_manager는 created_by로 설정
          await sequelize.query(`
            UPDATE projects 
            SET ${col.name} = created_by 
            WHERE ${col.name} IS NULL AND created_by IS NOT NULL;
          `);
          await sequelize.query(`
            UPDATE projects 
            SET ${col.name} = 1 
            WHERE ${col.name} IS NULL;
          `);
        } else if (!col.nullable && col.name === 'created_by') {
          // created_by는 기본 사용자 ID로 설정
          await sequelize.query(`
            UPDATE projects 
            SET ${col.name} = 1 
            WHERE ${col.name} IS NULL;
          `);
        } else if (!col.nullable && col.name === 'project_code') {
          // project_code는 자동 생성
          await sequelize.query(`
            UPDATE projects 
            SET ${col.name} = 'PROJ-' || LPAD(id::text, 6, '0')
            WHERE ${col.name} IS NULL;
          `);
        } else if (!col.nullable && col.name === 'name') {
          // name은 기본값 설정
          await sequelize.query(`
            UPDATE projects 
            SET ${col.name} = '프로젝트 ' || id
            WHERE ${col.name} IS NULL;
          `);
        } else if (!col.nullable && col.name === 'start_date') {
          // start_date는 현재 날짜로 설정
          await sequelize.query(`
            UPDATE projects 
            SET ${col.name} = CURRENT_DATE
            WHERE ${col.name} IS NULL;
          `);
        }

        // NOT NULL 제약 조건 추가
        if (!col.nullable) {
          await sequelize.query(`
            ALTER TABLE projects 
            ALTER COLUMN ${col.name} SET NOT NULL;
          `);
        }

        // UNIQUE 제약 조건 추가
        if (col.unique) {
          await sequelize.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS projects_${col.name}_unique ON projects(${col.name});
          `);
        }

        console.log(`✅ ${col.name} 컬럼이 추가되었습니다.`);
      }
    }

    // 인덱스 확인 및 추가
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS projects_project_manager_idx ON projects(project_manager);
      CREATE INDEX IF NOT EXISTS projects_created_by_idx ON projects(created_by);
      CREATE INDEX IF NOT EXISTS projects_project_code_idx ON projects(project_code);
      CREATE INDEX IF NOT EXISTS projects_status_idx ON projects(status);
      CREATE INDEX IF NOT EXISTS projects_priority_idx ON projects(priority);
      CREATE INDEX IF NOT EXISTS projects_start_date_idx ON projects(start_date);
    `);

    console.log('✅ projects 테이블 수정 완료');
  } catch (error: any) {
    console.error('❌ projects 테이블 수정 오류:', error.message);
    if (error.original) {
      console.error('원본 오류:', error.original);
    }
    throw error;
  }
}

// 스크립트 직접 실행
if (require.main === module) {
  checkAndFixProjectsTable()
    .then(() => {
      console.log('✅ 스크립트 실행 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 스크립트 실행 실패:', error);
      process.exit(1);
    });
}

export default checkAndFixProjectsTable;
