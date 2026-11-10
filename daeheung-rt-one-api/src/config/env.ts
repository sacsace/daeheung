import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { ENV_CONFIG, SYSTEM_CONSTANTS } from './constants';

/** 로컬 .env 로드 — Railway(RAILWAY_ENVIRONMENT)는 Variables만 사용 */
const loadEnvFiles = () => {
  if (process.env.RAILWAY_ENVIRONMENT) {
    return;
  }

  const envDir = path.resolve(__dirname, '../..');
  const apiEnv = path.join(envDir, '.env');
  if (fs.existsSync(apiEnv)) {
    // 프로젝트 .env가 Windows 사용자 환경의 DB_NAME=mvs 보다 우선한다.
    config({ path: apiEnv, override: true });
  }
};

loadEnvFiles();

// 필수 환경 변수 검증
// Railway에서는 DATABASE_URL을 사용하므로, DATABASE_URL이 있으면 개별 DB 환경 변수는 선택사항
const hasDatabaseUrl = !!process.env.DATABASE_URL;
const requiredEnvVars = [
  'DB_HOST',
  'DB_NAME', 
  'DB_USER',
  'DB_PASSWORD'
];

if (!hasDatabaseUrl) {
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ 필수 환경 변수가 누락되었습니다:', missingVars.join(', '));
    console.error('💡 .env 파일을 확인하거나 환경 변수를 설정해주세요.');
    console.error('💡 또는 Railway 환경에서는 DATABASE_URL을 설정해주세요.');
    process.exit(1);
  }
} else {
  // Railway: DATABASE_URL 사용
}

// 환경별 설정 가져오기
const currentEnv = process.env.NODE_ENV || 'development';
const envConfig = ENV_CONFIG[currentEnv as keyof typeof ENV_CONFIG];

const redisUrl = process.env.REDIS_URL;
let redisHost = process.env.REDIS_HOST;
let redisPort = process.env.REDIS_PORT;
let redisPassword = process.env.REDIS_PASSWORD;

if (redisUrl) {
  try {
    const parsedRedisUrl = new URL(redisUrl);
    if (!redisHost) {
      redisHost = parsedRedisUrl.hostname;
    }
    if (!redisPort) {
      redisPort = parsedRedisUrl.port || '6379';
    }
    if (!redisPassword && parsedRedisUrl.password) {
      redisPassword = parsedRedisUrl.password;
    }
  } catch (error) {
    console.warn('⚠️  REDIS_URL 파싱 실패:', error);
  }
}

// 환경 변수 검증 및 기본값 설정
export const env = {
  // 서버 설정
  NODE_ENV: currentEnv,
  PORT: parseInt(process.env.PORT || SYSTEM_CONSTANTS.DEFAULT_PORT.toString()),
  
  // 데이터베이스 설정
  DB_HOST: process.env.DB_HOST || envConfig.DB_HOST,
  DB_PORT: parseInt(process.env.DB_PORT || envConfig.DB_PORT.toString()),
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  
  // CORS 설정
  CORS_ORIGIN: process.env.CORS_ORIGIN || envConfig.CORS_ORIGIN,
  
  // 보안 설정 — 시크릿은 코드 기본값 없음 (.env / 호스팅 환경 변수 필수)
  JWT_SECRET: process.env.JWT_SECRET || '',
  SESSION_SECRET: process.env.SESSION_SECRET || '',
  
  // 외부 서비스
  REDIS_HOST: redisHost || 'localhost',
  REDIS_PORT: parseInt(redisPort || '6379'),
  REDIS_PASSWORD: redisPassword,
  
  // 로깅
  LOG_LEVEL: process.env.LOG_LEVEL || envConfig.LOG_LEVEL,
  
  // 파일 업로드 (실제 해석은 getUploadRoot — Railway 볼륨/tmp 회피 포함)
  UPLOAD_PATH: process.env.UPLOAD_PATH || './uploads',
  MAX_FILE_SIZE: process.env.MAX_FILE_SIZE || SYSTEM_CONSTANTS.UPLOAD.MAX_FILE_SIZE,
  
  // 알림 설정
  EMAIL_HOST: process.env.EMAIL_HOST,
  EMAIL_PORT: parseInt(process.env.EMAIL_PORT || '587'),
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  
  // SMS 설정
  SMS_API_KEY: process.env.SMS_API_KEY,
  SMS_API_SECRET: process.env.SMS_API_SECRET,
  
  // AI 서비스
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,

  // 은행 송금 API
  ICICI_API_URL: process.env.ICICI_API_URL,
  ICICI_API_KEY: process.env.ICICI_API_KEY,
  ICICI_TRANSFER_PATH: process.env.ICICI_TRANSFER_PATH || '/transfers',
  KOTAK_API_URL: process.env.KOTAK_API_URL,
  KOTAK_API_KEY: process.env.KOTAK_API_KEY,
  KOTAK_TRANSFER_PATH: process.env.KOTAK_TRANSFER_PATH || '/transfers',
  DEFAULT_BANK_PROVIDER: process.env.DEFAULT_BANK_PROVIDER,

  /** 인도 GST e-invoice IRP — mock | live (GSP URL 설정 시) */
  GST_IRP_MODE: process.env.GST_IRP_MODE || 'mock',
  GST_GSP_BASE_URL: process.env.GST_GSP_BASE_URL || '',
  GST_GSP_IRP_PATH: process.env.GST_GSP_IRP_PATH || '/einvoice/generate',
  GST_GSP_AUTH_HEADER: process.env.GST_GSP_AUTH_HEADER || '',
  GST_GSP_AUTH_VALUE: process.env.GST_GSP_AUTH_VALUE || '',
  GST_GSP_TIMEOUT_MS: parseInt(process.env.GST_GSP_TIMEOUT_MS || '60000', 10),

  /** Aadhaar eSign ASP — mock | live */
  AADHAAR_ESIGN_MODE: process.env.AADHAAR_ESIGN_MODE || 'mock',
  AADHAAR_ESIGN_PROVIDER: process.env.AADHAAR_ESIGN_PROVIDER || '',
  AADHAAR_ESIGN_ASP_BASE_URL: process.env.AADHAAR_ESIGN_ASP_BASE_URL || '',
  AADHAAR_ESIGN_ASP_API_KEY: process.env.AADHAAR_ESIGN_ASP_API_KEY || '',
  AADHAAR_ESIGN_ASP_INITIATE_PATH: process.env.AADHAAR_ESIGN_ASP_INITIATE_PATH || '/esign/initiate',
  AADHAAR_ESIGN_ASP_STATUS_PATH: process.env.AADHAAR_ESIGN_ASP_STATUS_PATH || '/esign/status',
  AADHAAR_ESIGN_ASP_TIMEOUT_MS: parseInt(process.env.AADHAAR_ESIGN_ASP_TIMEOUT_MS || '60000', 10),

  /** 인도 GST E-Way Bill — mock | live (GSP가 NIC E-Way API와 연동된 엔드포인트) */
  GST_EWAY_MODE: process.env.GST_EWAY_MODE || 'mock',
  /** 비어 있으면 GST_GSP_BASE_URL 사용 */
  GST_GSP_EWAY_BASE_URL: process.env.GST_GSP_EWAY_BASE_URL || '',
  GST_GSP_EWAY_PATH: process.env.GST_GSP_EWAY_PATH || '/ewaybill/generate',

  /** HeresNow ↔ MVS 근태 연동 (반드시 https://www.heresnow.in — apex는 API 없음) */
  HERESNOW_API_BASE_URL: process.env.HERESNOW_API_BASE_URL || 'https://www.heresnow.in',
  MVS_INTEGRATION_API_KEY: process.env.MVS_INTEGRATION_API_KEY || process.env.HERESNOW_INTEGRATION_API_KEY || '',
  INTEGRATION_DISPATCH_SECRET: process.env.INTEGRATION_DISPATCH_SECRET || '',
  MVS_WEBHOOK_BEARER: process.env.MVS_WEBHOOK_BEARER || '',
  
  // 모니터링
  HEALTH_CHECK_INTERVAL: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
  HEALTH_CHECK_TIMEOUT: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000')
};

// 환경 변수 검증 함수
export const validateEnv = () => {
  const errors: string[] = [];
  
  // 포트 번호 검증
  if (env.PORT < 1 || env.PORT > 65535) {
    errors.push('PORT는 1-65535 범위여야 합니다.');
  }
  
  // 데이터베이스 포트 검증
  if (env.DB_PORT < 1 || env.DB_PORT > 65535) {
    errors.push('DB_PORT는 1-65535 범위여야 합니다.');
  }
  
  // JWT 시크릿 검증 (Railway·로컬 모두 동일 기준)
  if (!process.env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET 환경 변수를 32자 이상으로 설정하세요. (Railway Variables / .env)');
  }

  if (env.NODE_ENV === 'production') {
    if (!env.CORS_ORIGIN) {
      errors.push('프로덕션 환경에서는 CORS_ORIGIN을 반드시 설정해야 합니다.');
    }
    if (env.CORS_ORIGIN === 'http://localhost:3000') {
      errors.push('프로덕션 환경에서는 CORS_ORIGIN을 localhost로 설정하면 안됩니다.');
    }
  }
  
  if (errors.length > 0) {
    console.error('❌ 환경 변수 검증 실패:');
    errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }
};

// 환경 정보 출력
export const printEnvInfo = () => {
  console.log('🔧 환경 설정 정보:');
  console.log(`  - 환경: ${env.NODE_ENV}`);
  console.log(`  - 포트: ${env.PORT}`);
  console.log(`  - DB 호스트: ${env.DB_HOST}:${env.DB_PORT}`);
  console.log(`  - DB 이름: ${env.DB_NAME} (${env.DB_USER})`);
  console.log(`  - CORS Origin: ${env.CORS_ORIGIN}`);
  console.log(`  - 로그 레벨: ${env.LOG_LEVEL}`);
};
