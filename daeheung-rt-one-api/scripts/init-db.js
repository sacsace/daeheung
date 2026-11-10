const { initializeSampleData } = require('../dist/data/sampleData');

async function initDatabase() {
  try {
    console.log('🚀 데이터베이스 초기화 시작...');
    await initializeSampleData();
    console.log('✅ 데이터베이스 초기화 완료!');
    process.exit(0);
  } catch (error) {
    console.error('❌ 데이터베이스 초기화 실패:', error);
    process.exit(1);
  }
}

initDatabase();
