// Daeheung R&T One API

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import fs from 'fs';
import helmet from 'helmet';
import path from 'path';
import rateLimit from 'express-rate-limit';
// 환경 변수 로드 (env.ts에서 monorepo .env 포함 로드)
import { validateEnv, printEnvInfo } from './config/env';
import { connectDB } from './models';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import menuRoutes from './routes/menuRoutes';
import notificationRoutes from './routes/notifications';
import companyRoutes from './routes/companies';
import customerRoutes from './routes/customers';
import contractRoutes from './routes/contracts';
import supportTicketRoutes from './routes/supportTickets';
import accountingRoutes from './routes/accounting';
import inventoryRoutes from './routes/inventory';
import productionLotRoutes from './routes/productionLots';
import hrRoutes from './routes/hr';
import projectRoutes from './routes/projects';
import partnerRoutes from './routes/partners';
import systemSettingsRoutes from './routes/systemSettings';
import workRoutes from './routes/work';
import quotationRoutes from './routes/quotations';
import communicationRoutes from './routes/communication';
import companyPolicyRoutes from './routes/companyPolicies';
import aiRoutes from './routes/ai';
import loginInfoRoutes from './routes/loginInfo';
import integrationsRoutes from './routes/integrations';
import systemBootstrapRoutes from './routes/systemBootstrap';
import dashboardRoutes from './routes/dashboardRoutes';
import { authenticateToken } from './middleware/auth';
import { startAttendanceAutoCheckoutScheduler } from './controllers/attendanceController';
import SocketService from './services/socketService';
import { createServer } from 'http';
import { authenticateUploadAccess } from './middleware/uploadAuth';
import { isCorsAllowLanEnabled, isPrivateLanHttpOrigin } from './utils/corsPrivateLan';
import { initRedisCache, isRedisCacheReady } from './utils/redisCache';
import { ensureUploadRoot } from './utils/uploadPath';
import { requestProfiler } from './middleware/requestProfiler';
import { activityLogMiddleware } from './middleware/activityLogMiddleware';
import { startLoginLogRetentionScheduler } from './services/loginLogRetentionService';
import { startProjectTaskCommentReminderScheduler } from './services/projectTaskCommentReminderService';
import { startUnreadReminderScheduler } from './services/unreadReminderService';
import { startRecurringTaskGenerateScheduler } from './services/recurringTaskGenerateService';
import {
  blockSensitivePaths,
  buildApiContentSecurityPolicy,
  forceHttpsRedirect,
} from './middleware/securityHeaders';
// schedulers: attendance / login-log / project-comment / unread / recurring-generate

// 환경 변수 검증 및 출력
validateEnv();
if (process.env.NODE_ENV === 'development') {
  printEnvInfo();
}
const processBootAt = Date.now();

const app = express();
/** Railway 등 리버스 프록시 뒤에서 클라이언트 IP·Rate limit이 올바르게 동작하도록 */
if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}
app.disable('x-powered-by');

const sanitizeLogPayload = (payload: any) => {
  if (!payload || typeof payload !== 'object') return payload;
  const sensitiveKeys = ['password', 'token', 'authorization', 'jwt', 'secret', 'apiKey', 'api_key', 'password_hash'];
  const clone: any = Array.isArray(payload) ? [] : {};
  for (const [key, value] of Object.entries(payload)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      clone[key] = '***';
    } else if (value && typeof value === 'object') {
      clone[key] = sanitizeLogPayload(value);
    } else {
      clone[key] = value;
    }
  }
  return clone;
};

// Port configuration for Railway deployment
const parsedPort = Number.parseInt(process.env.PORT || '', 10);
const PORT = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3500;
const HOST = process.env.HOST || '0.0.0.0';

// Railway handles SSL automatically, so we only use HTTP server
// SSL termination is handled by Railway's load balancer
const server = createServer(app);

// 데이터베이스 연결
connectDB()
  .then(() => {
    void initRedisCache();
    startAttendanceAutoCheckoutScheduler();
    startLoginLogRetentionScheduler();
    startProjectTaskCommentReminderScheduler();
    startUnreadReminderScheduler();
    startRecurringTaskGenerateScheduler();
  })
  .catch((error) => {
    console.error('Database connection error:', error);
    console.error('Server will continue but database operations may fail.');
  });

// Socket.IO 서비스 초기화
const socketService = new SocketService(server);

// 미들웨어 설정
app.use(forceHttpsRedirect);
app.use(blockSensitivePaths);
app.use(compression({
  filter: (req, res) => {
    if (req.path === '/health' || req.path === '/api/health') return false;
    // 업로드 바이너리(이미지/PDF) 압축 시 깨지거나 불필요하게 CPU 사용
    if (req.path.startsWith('/uploads')) return false;
    return compression.filter(req, res);
  },
  threshold: 1024,
}));
/**
 * 보안 응답 헤더 (Helmet) — 취약점 스캔(HSTS/클릭재킹/MIME/Referrer/COOP 등) 대응.
 * - API CSP는 default-src none + frame-ancestors none
 * - CORP cross-origin: FE↔BE 분리 도메인에서 업로드/리소스 허용
 * - HSTS·HTTPS 리다이렉트는 production (또는 FORCE_HTTPS=1)
 */
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    frameguard: { action: 'deny' },
    noSniff: true,
    originAgentCluster: true,
    dnsPrefetchControl: { allow: false },
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    hidePoweredBy: true,
    hsts:
      process.env.NODE_ENV === 'production' || process.env.FORCE_HTTPS === '1'
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          }
        : false,
  })
);
app.use((_req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
  );
  // helmet CSP와 중복되어도 스캐너·프록시 환경에서 누락 방지
  if (!res.getHeader('Content-Security-Policy')) {
    res.setHeader('Content-Security-Policy', buildApiContentSecurityPolicy());
  }
  next();
});
// CORS 설정 - 여러 origin 허용
const getCorsOrigins = (): string[] => {
  // 환경 변수가 명시적으로 설정되어 있으면 사용
  if (process.env.CORS_ORIGIN) {
    return process.env.CORS_ORIGIN.split(',').map(origin => origin.trim());
  }

  if (process.env.NODE_ENV === 'production') {
    return [];
  }

  // 개발 환경 기본값
  return ['http://localhost:3000'];
};

const allowedOrigins = getCorsOrigins();

// CORS 설정
app.use(cors({
  origin: (origin, callback) => {
    // origin이 없는 경우 (같은 도메인 요청, 모바일 앱 등) 허용
    if (!origin) {
      return callback(null, true);
    }

    // 허용된 origin 목록에 있는지 확인
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // 개발 환경에서는 모든 origin 허용 (편의상)
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    // 프로덕션 등: CORS_ALLOW_LAN=1 이면 사설망 IP로 접속한 프론트 오리진 허용
    if (isCorsAllowLanEnabled() && isPrivateLanHttpOrigin(origin)) {
      return callback(null, true);
    }

    // 그 외의 경우 거부
    callback(new Error('CORS 정책에 의해 차단되었습니다.'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'x-skip-error-popup',
    'x-skip-session-refresh',
    'X-DRT-Client',
    'X-MVS-Client',
  ],
  // 브라우저 JS가 동시 로그인 안내 버전을 읽을 수 있게 노출
  exposedHeaders: ['X-DRT-Login-Notice-Version', 'X-MVS-Login-Notice-Version'],
}));
const REQUEST_BODY_LIMIT = process.env.REQUEST_BODY_LIMIT || '50mb';
app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: REQUEST_BODY_LIMIT }));
app.use(requestProfiler);
app.use(activityLogMiddleware);

// Rate limiting — 프로덕션은 더 엄격하게
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 300 : 1000,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // 헬스체크와 정적 파일은 제외
    return req.path === '/health' || req.path === '/api/health' || req.path.startsWith('/static');
  }
});
app.use(limiter);

/** 로그인·가입 시도만 제한. session/refresh/profile 폴링은 제외(동시 로그인 안내용) */
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: '너무 많은 로그인 시도가 발생했습니다. 잠시 후 다시 시도해주세요.',
    code: 'AUTH_RATE_LIMIT',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const path = String(req.originalUrl || req.url || '').split('?')[0];
    const isCredentialAttempt =
      /\/api\/auth\/login\/?$/.test(path) ||
      /\/api\/auth\/register\/?$/.test(path) ||
      /\/api\/auth\/webauthn\/login\//.test(path);
    return !isCredentialAttempt;
  },
});

const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 100,
  message: 'Too many upload attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// 기본 라우트
app.get('/', (req, res) => {
  res.json({
    message: 'Daeheung R&T One API',
    version: '3.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// 헬스체크 엔드포인트
app.get('/health', (req, res) => {
  const baseHealth = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    bootDurationMs: Date.now() - processBootAt,
  };

  if (process.env.NODE_ENV === 'development') {
    return res.json({
      ...baseHealth,
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development'
    });
  }

  return res.json(baseHealth);
});

// API 라우트
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
    redis: isRedisCacheReady() ? 'connected' : 'memory-fallback',
    bootDurationMs: Date.now() - processBootAt,
  });
});

app.get('/api/health/redis', (_req, res) => {
  res.json({
    success: true,
    connected: isRedisCacheReady(),
    timestamp: new Date().toISOString(),
  });
});

// SocketService를 미들웨어로 추가
app.use((req: any, res, next) => {
  req.socketService = socketService;
  next();
});

// 업로드 파일 정적 제공 (JWT 인증 필수) — 공개 URL은 /uploads, 디스크는 영구 볼륨/로컬 루트
const uploadPath = ensureUploadRoot();
try {
  const receiptsDir = path.join(uploadPath, 'expense-receipts');
  const receiptCount = fs.existsSync(receiptsDir) ? fs.readdirSync(receiptsDir).length : 0;
  console.log(
    `[uploads] serving /uploads from ${uploadPath}` +
      (process.env.RAILWAY_VOLUME_MOUNT_PATH
        ? ` (volume mount ${process.env.RAILWAY_VOLUME_MOUNT_PATH})`
        : '') +
      ` · expense-receipts=${receiptCount}`
  );
} catch (err: any) {
  console.log(
    `[uploads] serving /uploads from ${uploadPath}` +
      (process.env.RAILWAY_VOLUME_MOUNT_PATH
        ? ` (volume mount ${process.env.RAILWAY_VOLUME_MOUNT_PATH})`
        : '')
  );
  console.warn('[uploads] could not count expense-receipts:', err?.message || err);
}
app.use('/uploads', authenticateUploadAccess, express.static(uploadPath, {
  dotfiles: 'deny',
  index: false,
  redirect: false,
  fallthrough: false,
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
  setHeaders: (res, filePath) => {
    // FE(www) ↔ BE 분리 도메인에서 <img>/fetch 가 가능하도록
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    if (/\.pdf$/i.test(String(filePath || ''))) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
    }
  },
}));
// 인증은 됐지만 파일이 없을 때 명확한 404
app.use('/uploads', (_req, res) => {
  res.status(404).json({ success: false, message: '파일을 찾을 수 없습니다.' });
});

// 테스트용 API 제거 - 실제 menuRoutes에서 권한 기반으로 처리

// 업로드 엔드포인트 별도 제한
app.use('/api/work/approvals/upload', uploadLimiter);
app.use('/api/users/excel/import', uploadLimiter);
app.use('/api/partners/excel/import', uploadLimiter);
app.use('/api/login-info/import', uploadLimiter);
app.use('/api/inventory/products/excel/bulk-update', uploadLimiter);
app.use('/api/integrations/mvs/dispatch', uploadLimiter);

// 실제 API 라우트
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/support-tickets', supportTicketRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/production-lots', productionLotRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/system-settings', systemSettingsRoutes);
app.use('/api/work', workRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/communication', communicationRoutes);
app.use('/api/company-policies', companyPolicyRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/login-info', loginInfoRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/system', systemBootstrapRoutes);
app.use('/api/dashboard', authenticateToken, dashboardRoutes);

// 404 핸들러
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    path: req.originalUrl
  });
});

// 에러 핸들러
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const isMulterError = err?.name === 'MulterError';
  const isFileTooLarge = isMulterError && err?.code === 'LIMIT_FILE_SIZE';
  const isFileValidationError = typeof err?.message === 'string' && err.message.includes('허용되지 않은 파일');
  const isPayloadTooLarge =
    err?.type === 'entity.too.large' ||
    err?.status === 413 ||
    err?.statusCode === 413 ||
    err?.name === 'PayloadTooLargeError' ||
    (typeof err?.message === 'string' && err.message.toLowerCase().includes('request entity too large'));
  const statusCode = isPayloadTooLarge || isFileTooLarge
    ? 413
    : isMulterError || isFileValidationError
      ? 400
      : 500;
  const message = isFileTooLarge
    ? `업로드 파일이 너무 큽니다. Tally Export 최대 용량은 ${process.env.TALLY_IMPORT_MAX_MB || 2048}MB입니다. (.env의 TALLY_IMPORT_MAX_MB로 변경 가능)`
    : isMulterError
      ? '업로드 파일 처리 중 오류가 발생했습니다.'
      : isFileValidationError
        ? err.message
        : isPayloadTooLarge
          ? '요청 데이터가 너무 큽니다. 이미지 크기를 줄이거나 압축 후 다시 시도해주세요.'
          : 'Internal server error';

  console.error('Error:', {
    message: err?.message,
    name: err?.name,
    path: req.originalUrl,
    method: req.method,
    body: sanitizeLogPayload(req.body)
  });

  res.status(statusCode).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? err?.message : undefined
  });
});

// Server startup with error handling
server.listen(PORT, HOST, () => {
  console.log(`🚀 Daeheung R&T One API running on ${HOST}:${PORT}`);
  console.log(`📊 Health check: http://${HOST}:${PORT}/health`);
  console.log(`🌐 API base URL: http://${HOST}:${PORT}/api`);
  console.log(`🔌 WebSocket: ws://${HOST}:${PORT}`);

  // 동시 로그인 안내 컬럼 — 마이그레이션 전이어도 부팅 시 확보
  void import('./utils/ensureLoginNoticeVersion')
    .then((m) => m.ensureLoginNoticeVersionColumn())
    .catch((err) => console.error('login_notice_version ensure on boot:', err));
  
  // Railway deployment info
  if (process.env.RAILWAY_ENVIRONMENT) {
    console.log(`🚂 Railway Environment: ${process.env.RAILWAY_ENVIRONMENT}`);
    console.log(`🌍 Public URL: ${process.env.RAILWAY_PUBLIC_DOMAIN}`);
  }
}).on('error', (error: any) => {
  console.error('❌ 서버 시작 실패:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`⚠️  포트 ${PORT}가 이미 사용 중입니다.`);
  } else if (error.code === 'EACCES') {
    console.error(`⚠️  포트 ${PORT}에 대한 접근 권한이 없습니다.`);
  }
  process.exit(1);
});

// 프로세스 에러 핸들링
process.on('uncaughtException', (error) => {
  console.error('❌ 처리되지 않은 예외:', error);
  // Railway에서는 자동 재시작되므로 프로세스를 종료
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 처리되지 않은 Promise 거부:', reason);
  console.error('Promise:', promise);
  // Railway에서는 자동 재시작되므로 프로세스를 종료
  process.exit(1);
});

export default app;