import { sequelize } from '../src/models';
import { QueryTypes } from 'sequelize';

const checkAndAddUserHrColumns = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ 데이터베이스 연결 성공\n');
    console.log('🔧 사용자 테이블 인사관리 컬럼 확인 및 추가 중...\n');

    // 추가할 컬럼 목록
    const columns = [
      {
        name: 'employee_number',
        type: 'VARCHAR(50)',
        nullable: true
      },
      {
        name: 'birth_date',
        type: 'DATE',
        nullable: true
      },
      {
        name: 'gender',
        type: 'VARCHAR(10)',
        nullable: true,
        enum: ['male', 'female', 'other']
      },
      {
        name: 'phone',
        type: 'VARCHAR(50)',
        nullable: true
      },
      {
        name: 'address',
        type: 'TEXT',
        nullable: true
      },
      {
        name: 'emergency_contact',
        type: 'VARCHAR(100)',
        nullable: true
      },
      {
        name: 'emergency_phone',
        type: 'VARCHAR(50)',
        nullable: true
      },
      {
        name: 'hire_date',
        type: 'DATE',
        nullable: true
      },
      {
        name: 'employment_type',
        type: 'VARCHAR(20)',
        nullable: true,
        enum: ['fulltime', 'contract', 'parttime', 'intern', 'daily']
      },
      {
        name: 'salary',
        type: 'DECIMAL(15, 2)',
        nullable: true
      }
    ];

    // gender ENUM 타입 확인 및 생성
    try {
      const genderEnumCheck = await sequelize.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'user_gender_enum'
        ) as exists;
      `, { type: QueryTypes.SELECT }) as any[];

      if (!genderEnumCheck[0]?.exists) {
        await sequelize.query(`
          CREATE TYPE user_gender_enum AS ENUM ('male', 'female', 'other');
        `, { type: QueryTypes.RAW });
        console.log('✅ user_gender_enum 타입 생성 완료');
      } else {
        console.log('✓ user_gender_enum 타입 이미 존재함');
      }
    } catch (error: any) {
      console.error('❌ gender ENUM 타입 처리 중 오류:', error.message);
    }

    // employment_type ENUM 타입 확인 및 생성
    try {
      const employmentEnumCheck = await sequelize.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'user_employment_type_enum'
        ) as exists;
      `, { type: QueryTypes.SELECT }) as any[];

      if (!employmentEnumCheck[0]?.exists) {
        await sequelize.query(`
          CREATE TYPE user_employment_type_enum AS ENUM ('fulltime', 'contract', 'parttime', 'intern', 'daily');
        `, { type: QueryTypes.RAW });
        console.log('✅ user_employment_type_enum 타입 생성 완료');
      } else {
        console.log('✓ user_employment_type_enum 타입 이미 존재함');
        try {
          await sequelize.query(`
            DO $$ BEGIN
              ALTER TYPE user_employment_type_enum ADD VALUE 'daily';
            EXCEPTION
              WHEN duplicate_object THEN NULL;
            END $$;
          `, { type: QueryTypes.RAW });
          console.log('✓ user_employment_type_enum 에 daily 라벨 확인');
        } catch (e: any) {
          console.warn('⚠ user_employment_type_enum daily 추가 생략(이미 있거나 권한 없음):', e?.message);
        }
      }
    } catch (error: any) {
      console.error('❌ employment_type ENUM 타입 처리 중 오류:', error.message);
    }

    // 각 컬럼 확인 및 추가
    for (const column of columns) {
      try {
        const columnCheck = await sequelize.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = '${column.name}'
        `, { type: QueryTypes.SELECT });

        if ((columnCheck as any[]).length === 0) {
          console.log(`📝 ${column.name} 컬럼 추가 중...`);
          
          let sqlType = column.type;
          
          // ENUM 타입 처리
          if (column.name === 'gender' && column.enum) {
            sqlType = 'user_gender_enum';
          } else if (column.name === 'employment_type' && column.enum) {
            sqlType = 'user_employment_type_enum';
          }

          const nullable = column.nullable ? '' : 'NOT NULL';
          
          await sequelize.query(`
            ALTER TABLE users 
            ADD COLUMN ${column.name} ${sqlType} ${nullable};
          `, { type: QueryTypes.RAW });
          
          console.log(`✅ ${column.name} 컬럼 추가 완료`);
        } else {
          console.log(`✓ ${column.name} 컬럼 이미 존재함`);
        }
      } catch (error: any) {
        console.error(`❌ ${column.name} 컬럼 처리 중 오류:`, error.message);
      }
    }

    // employee_number 인덱스 확인 및 추가
    try {
      const indexCheck = await sequelize.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'users' 
        AND indexname = 'users_employee_number_idx'
      `, { type: QueryTypes.SELECT });

      if ((indexCheck as any[]).length === 0) {
        console.log('📝 employee_number 인덱스 추가 중...');
        await sequelize.query(`
          CREATE INDEX users_employee_number_idx ON users(employee_number);
        `, { type: QueryTypes.RAW });
        console.log('✅ employee_number 인덱스 추가 완료');
      } else {
        console.log('✓ employee_number 인덱스 이미 존재함');
      }
    } catch (error: any) {
      console.error('❌ 인덱스 처리 중 오류:', error.message);
    }

    console.log('\n✅ 사용자 테이블 인사관리 컬럼 확인 및 추가 완료');
    await sequelize.close();
  } catch (error: any) {
    console.error('❌ 오류 발생:', error);
    await sequelize.close();
    process.exit(1);
  }
};

checkAndAddUserHrColumns();







