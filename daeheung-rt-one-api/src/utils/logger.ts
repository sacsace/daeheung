import winston from 'winston';
import path from 'path';

const logLevel = process.env.LOG_LEVEL || 'info';
const logFile = process.env.LOG_FILE || './logs/app.log';

// 로그 포맷 정의
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// 콘솔 포맷 (개발 환경용)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta, null, 2)}`;
    }
    return msg;
  })
);

// Winston 로거 생성
export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: 'mvs-server' },
  transports: [
    // 파일 로그 (모든 레벨)
    new winston.transports.File({
      filename: path.join(logFile, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // 파일 로그 (모든 레벨)
    new winston.transports.File({
      filename: path.join(logFile, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// 개발 환경에서는 콘솔에도 출력
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// 프로덕션 환경에서는 에러만 콘솔에 출력
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.Console({
    level: 'error',
    format: consoleFormat
  }));
}

// 로거 레벨 변경 함수
export const setLogLevel = (level: string): void => {
  logger.level = level;
};

// 로그 레벨 확인
export const getLogLevel = (): string => {
  return logger.level;
};
