#!/usr/bin/env node
/**
 * enum_vacations_vacation_type에 누락된 값(study, maternity, paternity) 추가
 * 
 * 권한 오류 시 postgres 슈퍼유저로 실행:
 *   DB_USER=postgres DB_PASSWORD=postgres node scripts/add-vacation-enum-values.js
 * 
 * 또는 Windows PowerShell:
 *   $env:DB_USER="postgres"; $env:DB_PASSWORD="postgres"; node scripts/add-vacation-enum-values.js
 */

const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbConfig = {
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'daeheung_rt_one',
  username: process.env.DB_USER || process.env.PG_SUPERUSER || 'daeheung_rt_one',
  password: process.env.DB_PASSWORD || process.env.PG_SUPERUSER_PASSWORD || 'Korean@2026',
  logging: false
};

async function addEnumValues() {
  const sequelize = new Sequelize(dbConfig);

  try {
    await sequelize.authenticate();
    console.log('✅ DB 연결 성공');

    const valuesToAdd = ['study', 'maternity', 'paternity'];
    for (const val of valuesToAdd) {
      await sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            WHERE t.typname = 'enum_vacations_vacation_type' AND e.enumlabel = '${val}'
          ) THEN
            ALTER TYPE "enum_vacations_vacation_type" ADD VALUE '${val}';
            RAISE NOTICE 'Added enum value: ${val}';
          ELSE
            RAISE NOTICE 'Enum value already exists: ${val}';
          END IF;
        END
        $$;
      `);
      console.log(`   ${val} 처리 완료`);
    }

    console.log('\n✅ enum_vacations_vacation_type 값 추가 완료');
    console.log('   이제 npx sequelize-cli db:migrate 를 실행하세요.');

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    if (error.message && error.message.includes('소유주')) {
      console.error('\n❌ 권한 오류: enum 타입을 변경할 수 없습니다.');
      console.error('\n💡 postgres 슈퍼유저로 실행하세요:');
      console.error('   Windows: $env:DB_USER="postgres"; $env:DB_PASSWORD="postgres"; node scripts/add-vacation-enum-values.js');
      console.error('   Linux/Mac: DB_USER=postgres DB_PASSWORD=postgres node scripts/add-vacation-enum-values.js');
      console.error('\n   또는 pgAdmin/DBeaver에서 scripts/add-vacation-enum-values.sql 실행');
    } else {
      console.error('\n❌ 오류:', error.message);
    }
    process.exit(1);
  }
}

addEnumValues();
