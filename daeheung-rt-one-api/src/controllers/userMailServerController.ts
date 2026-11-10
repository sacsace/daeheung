import { Response } from 'express';
import { AuthRequest } from '../types';
import {
  getUserMailServerSafe,
  patchUserMailServer,
  sendUserMailServerTest,
} from '../services/userMailServerService';

const scope = (req: AuthRequest) => ({
  userId: req.user!.id,
  tenantId: req.user!.tenant_id,
  companyId: req.user!.company_id,
});

/** GET /users/me/mail-server */
export const getMyMailServer = async (req: AuthRequest, res: Response) => {
  try {
    const data = await getUserMailServerSafe(scope(req));
    if (!data) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }
    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('getMyMailServer:', error);
    return res.status(500).json({ success: false, message: '메일 설정을 불러오지 못했습니다.' });
  }
};

/** PATCH /users/me/mail-server */
export const patchMyMailServer = async (req: AuthRequest, res: Response) => {
  try {
    const data = await patchUserMailServer({
      ...scope(req),
      patch: (req.body?.mailServer || req.body || {}) as Record<string, unknown>,
    });
    if (!data) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }
    return res.json({
      success: true,
      message: '메일 서버 설정이 저장되었습니다.',
      data,
    });
  } catch (error: any) {
    console.error('patchMyMailServer:', error);
    return res.status(500).json({ success: false, message: '메일 설정을 저장하지 못했습니다.' });
  }
};

/** POST /users/me/mail-server/test */
export const testMyMailServer = async (req: AuthRequest, res: Response) => {
  try {
    const ok = await sendUserMailServerTest({
      ...scope(req),
      to: String(req.body?.to || ''),
    });
    if (!ok) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }
    return res.json({ success: true, message: '테스트 메일을 발송했습니다.' });
  } catch (error: any) {
    const status = Number(error?.status) || 500;
    console.error('testMyMailServer:', error);
    return res.status(status).json({
      success: false,
      message: error?.message || '테스트 메일 발송에 실패했습니다.',
    });
  }
};
