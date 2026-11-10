#!/usr/bin/env node

const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// 데이터베이스 설정
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: 'postgres', // 먼저 postgres 데이터베이스에 연결
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  logging: console.log
});

async function setupDatabase() {
  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await sequelize.authenticate();
    console.log('✅ Connected to PostgreSQL');

    const dbName = process.env.DB_NAME || 'daeheung_rt_one';
    const dbUser = process.env.DB_USER || 'daeheung_rt_one';
    const dbPassword = process.env.DB_PASSWORD;
    if (dbName === 'mvs' || dbUser === 'mvs_user') {
      throw new Error('MSV 데이터베이스는 이 스크립트에서 만들거나 바꾸지 않습니다.');
    }
    if (!dbPassword) {
      throw new Error('DB_PASSWORD가 없습니다.');
    }

    console.log(`\n📊 Creating database ${dbName}...`);
    await sequelize.query(`CREATE DATABASE ${dbName}`, { raw: true }).catch(err => {
      if (err.message.includes('already exists')) {
        console.log(`   Database ${dbName} already exists`);
      } else {
        throw err;
      }
    });

    console.log(`\n👤 Creating user ${dbUser}...`);
    await sequelize.query(`CREATE USER ${dbUser} WITH PASSWORD '${dbPassword.replace(/'/g, "''")}'`, { raw: true }).catch(err => {
      if (err.message.includes('already exists')) {
        console.log(`   User ${dbUser} already exists`);
      } else {
        throw err;
      }
    });

    console.log('\n🔑 Granting privileges...');
    await sequelize.query(`GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${dbUser}`, { raw: true });
    await sequelize.query(`ALTER DATABASE ${dbName} OWNER TO ${dbUser}`, { raw: true }).catch(() => {
      // Ignore if already owned
    });

    console.log('\n✅ Database setup completed!');
    console.log('\n📋 Next step: Run migrations');
    console.log('   npm run db:migrate');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Database setup failed:', error.message);
    console.error('\n💡 Manual setup instructions:');
    console.error('   1. Connect to PostgreSQL as superuser');
    console.error('   2. CREATE DATABASE daeheung_rt_one;');
    console.error('   3. CREATE USER daeheung_rt_one WITH PASSWORD from .env;');
    console.error('   4. GRANT ALL PRIVILEGES ON DATABASE daeheung_rt_one TO daeheung_rt_one;');
    process.exit(1);
  }
}

setupDatabase();

