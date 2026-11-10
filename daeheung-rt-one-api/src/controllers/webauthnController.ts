import { Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import { AuthRequest } from '../types';
import { User, Company } from '../models';
import WebAuthnCredential from '../models/WebAuthnCredential';
import { invalidateAuthUser } from '../utils/authCache';
import { referenceCacheGet, referenceCacheSet, referenceCacheDel } from '../utils/redisCache';
import { recordActivityLog } from '../services/activityLogService';
import { ensureLoginNoticeVersionColumn } from '../utils/ensureLoginNoticeVersion';

const RP_NAME = process.env.WEBAUTHN_RP_NAME || 'MVS';
const CHALLENGE_TTL_SEC = 300;
const DEFAULT_SESSION_TIMEOUT_MINUTES = 600;
const MIN_SESSION_TIMEOUT_MINUTES = 5;
const MAX_SESSION_TIMEOUT_MINUTES = 24 * 60;

const normalizeSessionTimeoutMinutes = (value: unknown): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) return DEFAULT_SESSION_TIMEOUT_MINUTES;
  const rounded = Math.floor(num);
  if (rounded < MIN_SESSION_TIMEOUT_MINUTES) return MIN_SESSION_TIMEOUT_MINUTES;
  if (rounded > MAX_SESSION_TIMEOUT_MINUTES) return MAX_SESSION_TIMEOUT_MINUTES;
  return rounded;
};
/** 사용자당 활성 생체 로그인 기기 최대 개수 */
export const MAX_WEBAUTHN_CREDENTIALS_PER_USER = 4;

const toBase64Url = (buf: Uint8Array | Buffer | ArrayBuffer): string => {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf as Uint8Array);
  return b.toString('base64url');
};

const fromBase64Url = (value: string): Uint8Array =>
  new Uint8Array(Buffer.from(value, 'base64url'));

const getClientIp = (req: Request): string | null => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0]).trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
};

const resolveRpId = (req: Request): string => {
  const fromEnv = process.env.WEBAUTHN_RP_ID?.trim();
  if (fromEnv) return fromEnv;
  const origin = String(req.headers.origin || '');
  try {
    if (origin) return new URL(origin).hostname;
  } catch {
    /* ignore */
  }
  const host = String(req.headers.host || '').split(':')[0];
  return host || 'localhost';
};

const resolveOrigins = (req: Request): string[] => {
  const list = new Set<string>();
  const origin = String(req.headers.origin || '').trim();
  if (origin) list.add(origin);
  const frontend = process.env.FRONTEND_URL?.trim() || process.env.CORS_ORIGIN?.trim();
  if (frontend) {
    frontend.split(',').forEach((o) => {
      const v = o.trim().replace(/\/+$/, '');
      if (v) list.add(v);
    });
  }
  if (list.size === 0) {
    list.add('http://localhost:3000');
  }
  return Array.from(list);
};

const challengeKey = (kind: 'reg' | 'auth', id: string | number) =>
  `webauthn:${kind}:${id}`;

const saveChallenge = async (kind: 'reg' | 'auth', id: string | number, challenge: string) => {
  await referenceCacheSet(challengeKey(kind, id), challenge, CHALLENGE_TTL_SEC);
};

const takeChallenge = async (kind: 'reg' | 'auth', id: string | number) => {
  const key = challengeKey(kind, id);
  const value = await referenceCacheGet(key);
  if (value) await referenceCacheDel(key);
  return value;
};

const issueLoginToken = async (user: any, req: Request, reason: string | null) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET_MISSING');
  }

  let sessionTimeoutMinutes = DEFAULT_SESSION_TIMEOUT_MINUTES;
  try {
    if (user.company_id) {
      const company = await (Company as any).findOne({
        where: { id: user.company_id, tenant_id: user.tenant_id },
        attributes: ['settings'],
      });
      if (company?.settings?.security?.sessionTimeout != null) {
        sessionTimeoutMinutes = normalizeSessionTimeoutMinutes(company.settings.security.sessionTimeout);
      }
    }
  } catch {
    /* default */
  }

  await ensureLoginNoticeVersionColumn();
  const tokenSv = Number(user.session_version ?? 0);
  await user.update({ last_login: new Date() });
  await user.increment('login_notice_version', { by: 1 });
  await user.reload({ attributes: ['login_notice_version'] });
  const nextNotice = Number((user as any).login_notice_version ?? 0);
  invalidateAuthUser(user.id);

  const token = jwt.sign(
    {
      userId: user.id,
      userid: user.userid,
      role: user.role,
      tenantId: user.tenant_id,
      companyId: user.company_id,
      sv: tokenSv,
    },
    jwtSecret,
    { expiresIn: sessionTimeoutMinutes * 60 } as SignOptions
  );

  recordActivityLog({
    tenant_id: user.tenant_id,
    company_id: user.company_id,
    user_id: user.id,
    userid: user.userid,
    status: 'success',
    event_type: 'login',
    reason: reason || 'webauthn_login',
    ip_address: getClientIp(req),
    user_agent: req.get('user-agent') || null,
  });

  return {
    token,
    user: {
      id: user.id,
      userid: user.userid,
      username: user.username,
      email: user.email,
      role: user.role,
      department: user.department,
      position: user.position,
      tenant_id: user.tenant_id,
      company_id: user.company_id,
      is_payment_officer: user.is_payment_officer,
      avatar_url: user.avatar_url || null,
    },
    loginNoticeVersion: nextNotice,
    sessionReplaced: false,
  };
};

/** 등록 옵션 발급 (로그인 필요) */
export const webauthnRegisterOptions = async (req: AuthRequest, res: Response) => {
  try {
    const authUser = req.user!;
    const user = await User.findByPk(authUser.id);
    if (!user || user.status !== 'active') {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }

    const existing = await WebAuthnCredential.findAll({
      where: { user_id: user.id, is_active: true },
    });

    if (existing.length >= MAX_WEBAUTHN_CREDENTIALS_PER_USER) {
      return res.status(400).json({
        success: false,
        message: `생체 로그인 기기는 최대 ${MAX_WEBAUTHN_CREDENTIALS_PER_USER}개까지 등록할 수 있습니다. 사용하지 않는 기기를 삭제한 뒤 다시 시도하세요.`,
        code: 'WEBAUTHN_DEVICE_LIMIT',
        max: MAX_WEBAUTHN_CREDENTIALS_PER_USER,
        count: existing.length,
      });
    }

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: resolveRpId(req),
      userName: user.userid,
      userDisplayName: user.username || user.userid,
      userID: new TextEncoder().encode(String(user.id)) as any,
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'preferred',
        userVerification: 'required',
      },
      excludeCredentials: existing.map((c) => ({
        id: c.credential_id,
        transports: (c.transports || undefined) as AuthenticatorTransportFuture[] | undefined,
      })),
    });

    await saveChallenge('reg', user.id, options.challenge);
    return res.json({ success: true, data: options });
  } catch (error: any) {
    console.error('webauthnRegisterOptions:', error);
    return res.status(500).json({
      success: false,
      message: '생체 로그인 등록 옵션을 만들지 못했습니다.',
    });
  }
};

/** 등록 검증·저장 */
export const webauthnRegisterVerify = async (req: AuthRequest, res: Response) => {
  try {
    const authUser = req.user!;
    const user = await User.findByPk(authUser.id);
    if (!user || user.status !== 'active') {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }

    const expectedChallenge = await takeChallenge('reg', user.id);
    if (!expectedChallenge) {
      return res.status(400).json({ success: false, message: '등록 세션이 만료되었습니다. 다시 시도하세요.' });
    }

    const origins = resolveOrigins(req);
    const verification = await verifyRegistrationResponse({
      response: req.body?.credential || req.body,
      expectedChallenge,
      expectedOrigin: origins,
      expectedRPID: resolveRpId(req),
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ success: false, message: '생체 인증 등록에 실패했습니다.' });
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo as any;
    const credentialID: string =
      typeof credential.id === 'string' ? credential.id : toBase64Url(credential.id);
    const publicKey = toBase64Url(credential.publicKey);
    const counter = Number(credential.counter || 0);
    const transports = credential.transports || req.body?.credential?.response?.transports || null;
    const deviceName =
      String(req.body?.deviceName || '').trim().slice(0, 120) ||
      (req.get('user-agent') || '').slice(0, 80) ||
      'Device';

    const existing = await WebAuthnCredential.findOne({
      where: { credential_id: credentialID },
    });
    if (existing) {
      if (existing.user_id !== user.id) {
        return res.status(409).json({ success: false, message: '이미 다른 계정에 등록된 기기입니다.' });
      }
      existing.public_key = publicKey;
      existing.counter = counter;
      existing.transports = transports;
      existing.device_name = deviceName;
      existing.backed_up = Boolean(credentialBackedUp);
      existing.is_active = true;
      await existing.save();
    } else {
      const activeCount = await WebAuthnCredential.count({
        where: { user_id: user.id, is_active: true },
      });
      if (activeCount >= MAX_WEBAUTHN_CREDENTIALS_PER_USER) {
        return res.status(400).json({
          success: false,
          message: `생체 로그인 기기는 최대 ${MAX_WEBAUTHN_CREDENTIALS_PER_USER}개까지 등록할 수 있습니다. 사용하지 않는 기기를 삭제한 뒤 다시 시도하세요.`,
          code: 'WEBAUTHN_DEVICE_LIMIT',
          max: MAX_WEBAUTHN_CREDENTIALS_PER_USER,
          count: activeCount,
        });
      }
      await WebAuthnCredential.create({
        user_id: user.id,
        tenant_id: user.tenant_id,
        company_id: user.company_id,
        credential_id: credentialID,
        public_key: publicKey,
        counter,
        transports,
        device_name: deviceName,
        backed_up: Boolean(credentialBackedUp),
        is_active: true,
      });
    }

    recordActivityLog({
      tenant_id: user.tenant_id,
      company_id: user.company_id,
      user_id: user.id,
      userid: user.userid,
      status: 'success',
      event_type: 'security',
      reason: 'webauthn_registered',
      resource: `webauthn:${credentialDeviceType || 'platform'}`,
      ip_address: getClientIp(req),
      user_agent: req.get('user-agent') || null,
    });

    return res.json({ success: true, message: '생체 로그인이 등록되었습니다.' });
  } catch (error: any) {
    console.error('webauthnRegisterVerify:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || '생체 로그인 등록 검증에 실패했습니다.',
    });
  }
};

/** 로그인 옵션 (userid 기준) */
export const webauthnLoginOptions = async (req: Request, res: Response) => {
  try {
    const userid = String(req.body?.userid || '').trim();
    if (!userid) {
      return res.status(400).json({ success: false, message: '사용자 ID를 입력하세요.' });
    }

    const user = await User.findOne({ where: { userid, status: 'active' } as any });
    if (!user) {
      // 계정 존재 여부 enumeration 완화 — 빈 allowCredentials로 진행하지 않고 일반 오류
      return res.status(400).json({
        success: false,
        message: '등록된 생체 로그인이 없거나 사용자를 찾을 수 없습니다.',
      });
    }

    const creds = await WebAuthnCredential.findAll({
      where: { user_id: user.id, is_active: true },
    });
    if (creds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '이 계정에 등록된 생체 로그인이 없습니다. 먼저 로그인 후 등록하세요.',
      });
    }

    const options = await generateAuthenticationOptions({
      rpID: resolveRpId(req),
      userVerification: 'required',
      allowCredentials: creds.map((c) => ({
        id: c.credential_id,
        transports: (c.transports || undefined) as AuthenticatorTransportFuture[] | undefined,
      })),
    });

    await saveChallenge('auth', user.userid, options.challenge);
    return res.json({ success: true, data: options });
  } catch (error: any) {
    console.error('webauthnLoginOptions:', error);
    return res.status(500).json({
      success: false,
      message: '생체 로그인 옵션을 만들지 못했습니다.',
    });
  }
};

/** 로그인 검증 */
export const webauthnLoginVerify = async (req: Request, res: Response) => {
  try {
    const userid = String(req.body?.userid || '').trim();
    const credential = req.body?.credential || req.body;
    if (!userid || !credential) {
      return res.status(400).json({ success: false, message: '잘못된 요청입니다.' });
    }

    const user = await User.findOne({ where: { userid, status: 'active' } as any });
    if (!user) {
      return res.status(401).json({ success: false, message: '인증에 실패했습니다.' });
    }

    const expectedChallenge = await takeChallenge('auth', user.userid);
    if (!expectedChallenge) {
      return res.status(400).json({ success: false, message: '로그인 세션이 만료되었습니다. 다시 시도하세요.' });
    }

    const credId = String(credential.id || '');
    const stored = await WebAuthnCredential.findOne({
      where: { user_id: user.id, credential_id: credId, is_active: true },
    });
    if (!stored) {
      return res.status(401).json({ success: false, message: '등록되지 않은 기기입니다.' });
    }

    const origins = resolveOrigins(req);
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: origins,
      expectedRPID: resolveRpId(req),
      credential: {
        id: stored.credential_id,
        publicKey: fromBase64Url(stored.public_key) as any,
        counter: Number(stored.counter || 0),
        transports: (stored.transports || undefined) as AuthenticatorTransportFuture[] | undefined,
      },
      requireUserVerification: true,
    });

    if (!verification.verified) {
      recordActivityLog({
        tenant_id: user.tenant_id,
        company_id: user.company_id,
        user_id: user.id,
        userid: user.userid,
        status: 'failure',
        event_type: 'security',
        reason: 'webauthn_verify_failed',
        ip_address: getClientIp(req),
        user_agent: req.get('user-agent') || null,
      });
      return res.status(401).json({ success: false, message: '생체 인증에 실패했습니다.' });
    }

    const newCounter = Number(verification.authenticationInfo?.newCounter ?? stored.counter);
    stored.counter = newCounter;
    stored.last_used_at = new Date();
    await stored.save();

    const data = await issueLoginToken(user, req, 'webauthn_login');
    return res.json({ success: true, data, message: '로그인 성공' });
  } catch (error: any) {
    console.error('webauthnLoginVerify:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || '생체 로그인 검증에 실패했습니다.',
    });
  }
};

/** 등록 기기 목록 */
export const webauthnListCredentials = async (req: AuthRequest, res: Response) => {
  try {
    const rows = await WebAuthnCredential.findAll({
      where: { user_id: req.user!.id, is_active: true },
      order: [['created_at', 'DESC']],
      attributes: ['id', 'device_name', 'backed_up', 'last_used_at', 'created_at', 'transports'],
    });
    return res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        deviceName: r.device_name,
        backedUp: r.backed_up,
        lastUsedAt: r.last_used_at,
        createdAt: r.created_at,
        transports: r.transports,
      })),
    });
  } catch (error: any) {
    console.error('webauthnListCredentials:', error);
    return res.status(500).json({ success: false, message: '기기 목록을 불러오지 못했습니다.' });
  }
};

/** 등록 기기 삭제(소프트) */
export const webauthnDeleteCredential = async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: '잘못된 요청입니다.' });
    }
    const row = await WebAuthnCredential.findOne({
      where: { id, user_id: req.user!.id, is_active: true },
    });
    if (!row) {
      return res.status(404).json({ success: false, message: '기기를 찾을 수 없습니다.' });
    }
    row.is_active = false;
    await row.save();
    recordActivityLog({
      tenant_id: req.user!.tenant_id,
      company_id: req.user!.company_id,
      user_id: req.user!.id,
      userid: (req.user as any).userid || null,
      status: 'success',
      event_type: 'security',
      reason: 'webauthn_removed',
      resource: `webauthn:${id}`,
      ip_address: getClientIp(req),
      user_agent: req.get('user-agent') || null,
    });
    return res.json({ success: true });
  } catch (error: any) {
    console.error('webauthnDeleteCredential:', error);
    return res.status(500).json({ success: false, message: '기기 삭제에 실패했습니다.' });
  }
};
