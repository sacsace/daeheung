// 시스템 상수 정의
export const SYSTEM_CONSTANTS = {
  // 기본 설정
  DEFAULT_PORT: 3500,
  DEFAULT_DB_PORT: 5432,
  DEFAULT_CORS_ORIGIN: ['http://localhost:3000'],
  
  // 데이터베이스 설정
  DB_POOL: {
    MAX: 10,
    MIN: 0,
    ACQUIRE: 30000,
    IDLE: 10000
  },
  
  // Rate Limiting
  RATE_LIMIT: {
    WINDOW_MS: 1 * 60 * 1000, // 1분
    MAX_REQUESTS: 1000
  },
  
  // 재시도 설정
  RETRY: {
    MAX_RETRIES: 5,
    BASE_DELAY: 5000
  },
  
  // 파일 업로드
  UPLOAD: {
    MAX_FILE_SIZE: '10mb',
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
  },
  
  // 세션 설정 (express-session 등에서 사용 시 env 필수 — 코드에 기본 시크릿 없음)
  SESSION: {
    SECRET: process.env.SESSION_SECRET || '',
    MAX_AGE: 24 * 60 * 60 * 1000 // 24시간
  },

  // JWT는 반드시 환경 변수로만 설정 (validateEnv에서 길이 검증)
  JWT: {
    SECRET: process.env.JWT_SECRET || '',
    EXPIRES_IN: '24h'
  }
};

// 샘플 데이터 상수
export const SAMPLE_DATA = {
  USERS: {
    DEVELOPER: '김개발',
    FRONTEND: '이프론트', 
    BACKEND: '박백엔드',
    MARKETING: '최마케팅'
  },
  COMPANIES: {
    ABC: 'ABC 회사',
    XYZ: 'XYZ 기업',
    DEF: 'DEF 주식회사',
    MVS: 'MVS Solutions',
    MINSUB: 'Minsub Ventures Private Limited',
  },
  DEPARTMENTS: {
    DEVELOPMENT: '개발팀',
    MARKETING: '마케팅팀',
    SALES: '영업팀',
    HR: '인사팀'
  },
  POSITIONS: {
    TEAM_LEAD: '팀장',
    DEVELOPER: '개발자',
    MANAGER: '매니저',
    DIRECTOR: '이사'
  }
};

// 환경별 설정
export const ENV_CONFIG = {
  development: {
    DB_HOST: 'localhost',
    DB_PORT: 5432,
    CORS_ORIGIN: 'http://localhost:3000',
    LOG_LEVEL: 'debug'
  },
  production: {
    DB_HOST: process.env.DB_HOST,
    DB_PORT: parseInt(process.env.DB_PORT || '5432'),
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    LOG_LEVEL: 'info'
  },
  test: {
    DB_HOST: 'localhost',
    DB_PORT: 5433,
    CORS_ORIGIN: 'http://localhost:3000',
    LOG_LEVEL: 'error'
  }
};
