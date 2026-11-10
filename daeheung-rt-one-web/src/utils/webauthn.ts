import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import { api } from '../services/api';

const LAST_USERID_KEY = 'mvs_last_userid';

export const getRememberedUserid = (): string => {
  try {
    return localStorage.getItem(LAST_USERID_KEY) || '';
  } catch {
    return '';
  }
};

export const rememberUserid = (userid: string) => {
  try {
    const v = String(userid || '').trim();
    if (v) localStorage.setItem(LAST_USERID_KEY, v);
  } catch {
    /* ignore */
  }
};

/** 스마트폰·태블릿 UA 감지 (참고용). 생체 로그인 가능 여부는 canUsePlatformPasskey 사용. */
export const isMobileOrTabletDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)) {
    return true;
  }
  if (/iPad|Tablet/i.test(ua)) return true;
  // iPadOS 13+ 는 Macintosh UA + 터치
  if (
    (/Macintosh|Mac OS X/i.test(ua) || navigator.platform === 'MacIntel') &&
    Number(navigator.maxTouchPoints || 0) > 1
  ) {
    return true;
  }
  return false;
};

/** PC(Windows Hello·Touch ID 등) 포함, 플랫폼 생체 인증기가 있으면 true */
export const canUsePlatformPasskey = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  if (!window.isSecureContext && window.location.hostname !== 'localhost') return false;
  if (!browserSupportsWebAuthn()) return false;
  try {
    return await platformAuthenticatorIsAvailable();
  } catch {
    return false;
  }
};

export const registerPlatformPasskey = async (deviceName?: string) => {
  const optionsRes = await api.post(
    '/auth/webauthn/register/options',
    {},
    { headers: { 'x-skip-error-popup': 'true' } }
  );
  if (!optionsRes.data?.success || !optionsRes.data?.data) {
    throw new Error(optionsRes.data?.message || '등록 옵션을 받지 못했습니다.');
  }
  const attestation = await startRegistration({ optionsJSON: optionsRes.data.data });
  const verifyRes = await api.post(
    '/auth/webauthn/register/verify',
    {
      credential: attestation,
      deviceName:
        deviceName ||
        (typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 80) : 'Device'),
    },
    { headers: { 'x-skip-error-popup': 'true' } }
  );
  if (!verifyRes.data?.success) {
    throw new Error(verifyRes.data?.message || '생체 로그인 등록에 실패했습니다.');
  }
  return verifyRes.data;
};

export const loginWithPlatformPasskey = async (userid: string) => {
  const id = String(userid || '').trim();
  if (!id) throw new Error('사용자 ID를 입력하세요.');

  const optionsRes = await api.post(
    '/auth/webauthn/login/options',
    { userid: id },
    { headers: { 'x-skip-error-popup': 'true' } }
  );
  if (!optionsRes.data?.success || !optionsRes.data?.data) {
    throw new Error(optionsRes.data?.message || '생체 로그인 옵션을 받지 못했습니다.');
  }
  const assertion = await startAuthentication({ optionsJSON: optionsRes.data.data });
  const verifyRes = await api.post(
    '/auth/webauthn/login/verify',
    { userid: id, credential: assertion },
    { headers: { 'x-skip-error-popup': 'true' } }
  );
  if (!verifyRes.data?.success || !verifyRes.data?.data) {
    throw new Error(verifyRes.data?.message || '생체 로그인에 실패했습니다.');
  }
  return verifyRes.data.data as {
    token: string;
    user: any;
    loginNoticeVersion?: number;
  };
};

export const listPasskeyCredentials = async () => {
  const res = await api.get('/auth/webauthn/credentials', {
    headers: { 'x-skip-error-popup': 'true' },
  });
  if (!res.data?.success) throw new Error(res.data?.message || '목록을 불러오지 못했습니다.');
  return (res.data.data || []) as Array<{
    id: number;
    deviceName?: string | null;
    backedUp?: boolean;
    lastUsedAt?: string | null;
    createdAt?: string;
  }>;
};

export const deletePasskeyCredential = async (id: number) => {
  const res = await api.delete(`/auth/webauthn/credentials/${id}`, {
    headers: { 'x-skip-error-popup': 'true' },
  });
  if (!res.data?.success) throw new Error(res.data?.message || '삭제에 실패했습니다.');
};
