import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, Company } from '../models';
import { AuthRequest } from '../types';
import { getCachedAuthUser, setCachedAuthUser, getCachedAuthCompany, setCachedAuthCompany, invalidateAuthUser } from '../utils/authCache';
import { isMvsNotifierClient, isNotifierApiPathAllowed } from '../constants/authClients';
import { ensureLoginNoticeVersionColumn } from '../utils/ensureLoginNoticeVersion';
import { IS_STANDALONE, attachStandaloneCompany } from '../config/standalone';

const AUTH_USER_ATTRIBUTES = [
  'id',
  'userid',
  'username',
  'email',
  'role',
  'tenant_id',
  'company_id',
  'department',
  'department_id',
  'position',
  'position_id',
  'status',
  'last_login',
  'is_payment_officer',
  'session_version',
  'login_notice_version',
  'avatar_url',
] as const;

/** JWT sv와 DB session_version 불일치 — 비밀번호 변경 등으로 세션 무효화 */
export const SESSION_SUPERSEDED_CODE = 'SESSION_SUPERSEDED';

type JwtAuthClaims = {
  userId: number;
  userid?: string;
  role?: string;
  tenantId?: number;
  companyId?: number;
  sv?: number;
  client?: string;
};

const getTokenSessionVersion = (decoded: JwtAuthClaims): number => {
  const raw = decoded?.sv;
  const num = Number(raw);
  return Number.isFinite(num) ? Math.floor(num) : 0;
};

const respondSessionSuperseded = (res: Response) =>
  res.status(401).json({
    success: false,
    message: '다른 곳에서 동일한 계정으로 로그인되어 현재 세션이 종료되었습니다.',
    code: SESSION_SUPERSEDED_CODE,
  });

/**
 * 세션 버전은 매 요청 DB(PK)에서 확인 — 멀티 인스턴스 캐시 불일치 방지.
 * 프로필 필드는 단기 캐시 사용.
 * 알람(트레이) 앱 토큰은 웹 session_version 강제 종료 정책에서 제외.
 */
export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  try {
    await ensureLoginNoticeVersionColumn();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '액세스 토큰이 필요합니다.',
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({
        success: false,
        message: '서버 JWT 설정이 누락되었습니다.',
      });
    }

    const decoded = jwt.verify(token, jwtSecret) as JwtAuthClaims;
    if (!decoded?.userId) {
      return res.status(403).json({
        success: false,
        message: '유효하지 않은 토큰입니다.',
      });
    }

    const tokenSv = getTokenSessionVersion(decoded);
    const skipSessionKick = isMvsNotifierClient(decoded.client);
    (req as any).authClient = decoded.client || null;

    if (skipSessionKick && !isNotifierApiPathAllowed(req)) {
      return res.status(403).json({
        success: false,
        message: '알람 앱 토큰으로는 해당 기능을 사용할 수 없습니다.',
        code: 'NOTIFIER_SCOPE',
      });
    }

    const sessionRow = await (User as any).findByPk(decoded.userId, {
      attributes: ['id', 'status', 'session_version', 'login_notice_version'],
    });

    if (!sessionRow || sessionRow.status !== 'active') {
      invalidateAuthUser(decoded.userId);
      return res.status(401).json({
        success: false,
        message: '유효하지 않은 사용자입니다.',
      });
    }

    const dbSv = Number(sessionRow.session_version ?? 0);
    if (!skipSessionKick && dbSv !== tokenSv) {
      invalidateAuthUser(decoded.userId);
      return respondSessionSuperseded(res);
    }

    // 모든 인증 API 응답에 실어 프론트가 폴링 없이도 다른 로그인 감지
    const dbNotice = Number((sessionRow as any).login_notice_version ?? 0);
    if (Number.isFinite(dbNotice)) {
      res.setHeader('X-DRT-Login-Notice-Version', String(Math.floor(dbNotice)));
      res.setHeader('X-MVS-Login-Notice-Version', String(Math.floor(dbNotice)));
    }

    const cached = getCachedAuthUser(decoded.userId);
    if (
      cached &&
      cached.status === 'active' &&
      (skipSessionKick || Number(cached.session_version ?? 0) === tokenSv)
    ) {
      req.user = (await attachStandaloneCompany(cached)) as any;
      return next();
    }

    const user = await (User as any).findByPk(decoded.userId, {
      attributes: [...AUTH_USER_ATTRIBUTES],
    });

    if (!user || user.status !== 'active') {
      invalidateAuthUser(decoded.userId);
      return res.status(401).json({
        success: false,
        message: '유효하지 않은 사용자입니다.',
      });
    }

    if (!skipSessionKick && Number(user.session_version ?? 0) !== tokenSv) {
      invalidateAuthUser(decoded.userId);
      return respondSessionSuperseded(res);
    }

    const plain = await attachStandaloneCompany(user.toJSON ? user.toJSON() : user);
    req.user = plain;
    setCachedAuthUser(decoded.userId, plain);
    next();
  } catch (error: any) {
    return res.status(403).json({
      success: false,
      message: '유효하지 않은 토큰입니다.',
    });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '인증이 필요합니다.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: '권한이 부족합니다.',
      });
    }

    next();
  };
};

const parseCompanyIdFromRequest = (req: AuthRequest): number | null => {
  const candidates = [
    req.body?.company_id,
    req.body?.companyId,
    req.query?.company_id,
    req.query?.companyId,
  ];

  for (const raw of candidates) {
    if (raw == null || raw === '') continue;
    const value = Array.isArray(raw) ? raw[0] : raw;
    const parsed = parseInt(String(value), 10);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
};

// audit: 소속 회사는 일반 사용자와 동일하게 변경 가능, 다른 회사는 조회(GET)만 허용
export const restrictAuditToReadOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: '인증이 필요합니다.',
    });
  }

  if (req.user.role !== 'audit') {
    return next();
  }

  const readOnlyMethod = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
  if (readOnlyMethod) {
    return next();
  }

  const userCompanyId = Number(req.user.company_id);
  const targetCompanyId = parseCompanyIdFromRequest(req);

  if (
    targetCompanyId != null &&
    Number.isFinite(userCompanyId) &&
    targetCompanyId !== userCompanyId
  ) {
    return res.status(403).json({
      success: false,
      message: '다른 회사 데이터는 조회만 가능합니다.',
    });
  }

  next();
};

/** Minsub Ventures 전용 기능·메뉴 판별 (회사명 부분 일치) */
export const isMinsubCompanyName = (name?: string | null): boolean => {
  if (!name) return false;
  return name.toLowerCase().includes('minsub ventures');
};

export const requireRootOrMinsubEmployee = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: '인증이 필요합니다.',
    });
  }

  if (req.user.role === 'root' || IS_STANDALONE) {
    return next();
  }

  try {
    const cached = getCachedAuthCompany(req.user.company_id);
    if (cached) {
      if (!isMinsubCompanyName(cached.name as string)) {
        return res.status(403).json({
          success: false,
          message: '접근 권한이 없습니다.',
        });
      }
      return next();
    }

    const company = await (Company as any).findByPk(req.user.company_id, {
      attributes: ['id', 'name', 'tenant_id'],
    });

    if (!company || !isMinsubCompanyName(company.name)) {
      return res.status(403).json({
        success: false,
        message: '접근 권한이 없습니다.',
      });
    }

    setCachedAuthCompany(req.user.company_id, company.toJSON ? company.toJSON() : company);
    return next();
  } catch (error) {
    console.error('Minsub 권한 확인 오류:', error);
    return res.status(500).json({
      success: false,
      message: '권한 확인 중 오류가 발생했습니다.',
    });
  }
};
