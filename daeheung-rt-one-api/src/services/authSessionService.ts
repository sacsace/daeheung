import jwt, { SignOptions } from 'jsonwebtoken';
import { DRT_NOTIFIER_CLIENT } from '../constants/authClients';

export type AuthTokenUser = {
  id: number;
  userid: string;
  role: string;
  tenant_id: number;
  company_id?: number | null;
  session_version?: number | null;
};

/**
 * 웹·알람 앱 모두 현재 session_version 으로 서명 (웹 동시 로그인 허용).
 * 알람 앱은 client claim 을 추가한다.
 */
export function buildAuthTokenClaims(
  user: AuthTokenUser,
  options: { isNotifier: boolean; sessionVersion: number }
): Record<string, unknown> {
  const claims: Record<string, unknown> = {
    userId: user.id,
    userid: user.userid,
    role: user.role,
    tenantId: user.tenant_id,
    companyId: user.company_id,
    sv: options.sessionVersion,
  };
  if (options.isNotifier) {
    claims.client = DRT_NOTIFIER_CLIENT;
  }
  return claims;
}

export function signAuthToken(
  claims: Record<string, unknown>,
  jwtSecret: string,
  expiresInSeconds: number
): string {
  const signOptions: SignOptions = { expiresIn: expiresInSeconds };
  return jwt.sign(claims, jwtSecret, signOptions);
}

export function nextWebSessionVersion(current: number): number {
  const n = Number(current);
  return (Number.isFinite(n) ? Math.floor(n) : 0) + 1;
}
