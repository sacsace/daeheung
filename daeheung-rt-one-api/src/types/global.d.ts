// Global type definitions for MVS Backend
// sequelize / express / socket.io 는 패키지 자체 타입(@types 또는 내장 types)을 사용한다.
// 여기서 stub로 재선언하면 생성자·Op·query 등 실제 API 타입이 깨진다.

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    PORT: string;
    DB_HOST: string;
    DB_PORT: string;
    DB_NAME: string;
    DB_USER: string;
    DB_PASSWORD: string;
    JWT_SECRET: string;
    SESSION_SECRET: string;
    CORS_ORIGIN: string;
    REDIS_HOST: string;
    REDIS_PORT: string;
    REDIS_URL?: string;
    REDIS_PASSWORD?: string;
    UPLOAD_PATH: string;
    MAX_FILE_SIZE: string;
    LOG_LEVEL: string;
    EMAIL_HOST?: string;
    EMAIL_PORT?: string;
    EMAIL_USER?: string;
    EMAIL_PASS?: string;
    SMS_API_KEY?: string;
    SMS_API_SECRET?: string;
    OPENAI_API_KEY?: string;
    HEALTH_CHECK_INTERVAL?: string;
    HEALTH_CHECK_TIMEOUT?: string;
    HTTPS?: string;
  }
}
