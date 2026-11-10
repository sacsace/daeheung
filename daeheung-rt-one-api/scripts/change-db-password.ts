#!/usr/bin/env ts-node

/**
 * Daeheung R&T One 데이터베이스 비밀번호 변경 스크립트
 * 
 * 사용법:
 *   ts-node scripts/change-db-password.ts
 * 
 * 또는 환경 변수로 기존 비밀번호 설정:
 *   OLD_PASSWORD=old_password ts-node scripts/change-db-password.ts
 */

import { Sequelize } from 'sequelize';
import { config } from 'dotenv';
import path from 'path';

// 환경 변수 로드
config({ path: path.join(__dirname, '..', '.env') });

const DB_USER = process.env.DB_USER || 'daeheung_rt_one';
const OLD_PASSWORD = process.env.OLD_PASSWORD || '';
const NEW_PASSWORD = process.env.NEW_PASSWORD || '';

async function changePassword() {
  try {
    if (DB_USER === 'mvs_user' || (process.env.DB_NAME || '') === 'mvs') {
      throw new Error('MSV 데이터베이스 계정은 이 스크립트에서 바꾸지 않습니다.');
    }
    if (!OLD_PASSWORD || !NEW_PASSWORD) {
      throw new Error('OLD_PASSWORD와 NEW_PASSWORD 환경 변수가 필요합니다.');
    }
    console.log('🔐 데이터베이스 비밀번호 변경 시작...\n');

    const sequelize = new Sequelize({
      dialect: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: 'postgres',
      username: DB_USER,
      password: OLD_PASSWORD,
      logging: false
    });

    console.log('🔌 데이터베이스에 연결 중...');
    await sequelize.authenticate();
    console.log('✅ 데이터베이스 연결 성공\n');

    // 비밀번호 변경
    console.log(`🔄 비밀번호 변경 중: ${OLD_PASSWORD} → ${NEW_PASSWORD}...`);
    await sequelize.query(`ALTER USER ${DB_USER} WITH PASSWORD '${NEW_PASSWORD.replace(/'/g, "''")}'`, { raw: true });
    console.log('✅ 비밀번호 변경 완료!\n');

    // 새 비밀번호로 재연결 테스트
    console.log('🧪 새 비밀번호로 연결 테스트 중...');
    const testSequelize = new Sequelize({
      dialect: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'daeheung_rt_one',
      username: DB_USER,
      password: NEW_PASSWORD,
      logging: false
    });

    await testSequelize.authenticate();
    console.log('✅ 새 비밀번호로 연결 성공!\n');

    await sequelize.close();
    await testSequelize.close();

    console.log('🎉 데이터베이스 비밀번호 변경이 완료되었습니다.');
    console.log('\n📋 다음 단계:');
    console.log('   1. .env 파일의 DB_PASSWORD를 새 비밀번호로 업데이트하세요.');
    console.log('   2. 애플리케이션을 재시작하세요.');
    
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ 비밀번호 변경 실패:', error.message);
    
    if (error.message.includes('password authentication failed')) {
      console.error('\n💡 기존 비밀번호가 맞지 않습니다.');
      console.error('   환경 변수로 기존 비밀번호를 지정하세요:');
      console.error('   OLD_PASSWORD=기존비밀번호 ts-node scripts/change-db-password.ts');
    } else if (error.message.includes('permission denied')) {
      console.error('\n💡 권한이 없습니다. postgres 사용자로 실행하세요:');
      console.error('   psql -U postgres -c "ALTER USER daeheung_rt_one WITH PASSWORD \'...\';"');
    }
    
    process.exit(1);
  }
}

changePassword();
