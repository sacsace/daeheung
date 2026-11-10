import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import { AuthRequest } from '../types';
import { SESSION_SUPERSEDED_CODE } from './auth';
import { isMvsNotifierClient } from '../constants/authClients';

/** /uploads 정적 파일 — JWT 필요 (쿼리 access_token 또는 Authorization 헤더) */
export const authenticateUploadAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const headerToken = req.headers.authorization?.split(' ')[1];
  const queryToken = typeof req.query.access_token === 'string' ? req.query.access_token : undefined;
  const token = headerToken || queryToken;

  if (!token) {
    return res.status(401).json({ success: false, message: '파일 접근에 인증이 필요합니다.' });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return res.status(500).json({ success: false, message: '서버 JWT 설정이 누락되었습니다.' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as { userId?: number; sv?: number; client?: string };
    if (!decoded?.userId) {
      return res.status(403).json({ success: false, message: '유효하지 않은 토큰입니다.' });
    }

    const user = await (User as any).findByPk(decoded.userId, {
      attributes: ['id', 'status', 'session_version'],
    });
    if (!user || user.status !== 'active') {
      return res.status(401).json({ success: false, message: '유효하지 않은 사용자입니다.' });
    }

    const tokenSv = Number(decoded.sv ?? 0);
    if (isMvsNotifierClient(decoded.client)) {
      return res.status(403).json({
        success: false,
        message: '알람 앱 토큰으로는 파일에 접근할 수 없습니다.',
      });
    }
    if (Number(user.session_version ?? 0) !== tokenSv) {
      return res.status(401).json({
        success: false,
        message: '다른 곳에서 동일한 계정으로 로그인되어 현재 세션이 종료되었습니다.',
        code: SESSION_SUPERSEDED_CODE,
      });
    }

    req.user = { id: decoded.userId } as AuthRequest['user'];
    return next();
  } catch {
    return res.status(403).json({ success: false, message: '유효하지 않은 토큰입니다.' });
  }
};
