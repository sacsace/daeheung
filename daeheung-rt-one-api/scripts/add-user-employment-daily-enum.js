#!/usr/bin/env node
/**
 * users.employment_type PostgreSQL ENUM에 'daily'(일용직) 값이 없을 때 추가합니다.
 *
 * 오류: user_employment_type_enum 열거형의 입력 값이 잘못됨: "daily"
 *
 * 사용:
 *   node scripts/add-user-employment-daily-enum.js
 *
 * 권한 오류 시 postgres 슈퍼유저로:
 *   $env:DB_USER="postgres"; $env:DB_PASSWORD="..."; node scripts/add-user-employment-daily-enum.js
 */

const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbConfig = {
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || process.env.DB_DATABASE || 'daeheung_rt_one',
  username: process.env.DB_USER || process.env.DB_USERNAME || 'daeheung_rt_one',
  password: process.env.DB_PASSWORD || '',
  logging: false
};

async function main() {
  const sequelize = new Sequelize(dbConfig);
  try {
    await sequelize.authenticate();
    console.log('✅ DB 연결 성공');

    const [cols] = await sequelize.query(`
      SELECT udt_name AS name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'employment_type'
    `);
    const typeName = cols?.[0]?.name;
    if (!typeName) {
      console.error('❌ public.users.employment_type 컬럼을 찾을 수 없습니다.');
      process.exit(1);
    }
    if (!/^[a-zA-Z0-9_]+$/.test(String(typeName))) {
      console.error('❌ 잘못된 ENUM 타입 이름:', typeName);
      process.exit(1);
    }

    const safeType = String(typeName);
    for (const label of ['daily', 'service']) {
      await sequelize.query(`
        DO $$
        DECLARE
          typ CONSTANT text := '${safeType.replace(/'/g, "''")}';
          lab CONSTANT text := '${label}';
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'public'
              AND t.typname = typ
              AND e.enumlabel = lab
          ) THEN
            EXECUTE format('ALTER TYPE %I.%I ADD VALUE %L', 'public', typ, lab);
            RAISE NOTICE 'Added enum value: % to %', lab, typ;
          ELSE
            RAISE NOTICE 'Enum value % already exists on %', lab, typ;
          END IF;
        END
        $$;
      `);
    }

    console.log(`✅ ENUM "${safeType}" 에 'daily'/'service' 확인/추가 완료`);
    console.log('   (이미 있었으면 변경 없음)');
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    if (error.message && /소유|permission|must be owner/i.test(error.message)) {
      console.error('\n❌ 권한 오류: ENUM 타입을 변경할 수 없습니다.');
      console.error('💡 postgres 슈퍼유저로 실행하거나, psql에서 다음을 실행하세요:');
      console.error('   ALTER TYPE public.user_employment_type_enum ADD VALUE \'daily\';');
      console.error('   (타입 이름은 DB마다 다를 수 있음 — information_schema.columns 의 udt_name 확인)');
    } else {
      console.error('\n❌ 오류:', error.message);
    }
    try {
      await sequelize.close();
    } catch (_) {}
    process.exit(1);
  }
}

main();
