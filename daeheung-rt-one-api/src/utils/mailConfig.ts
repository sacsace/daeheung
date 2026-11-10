import { env } from '../config/env';
import SMTPTransport = require('nodemailer/lib/smtp-transport');
import { parseSettingsBlob } from './settingsBlob';

export type MailTransportResolved = {
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string };
  /** nodemailer sendMail `from` — 문자열 또는 "Name <email>" */
  from: string;
};

/** nodemailer `createTransport` 옵션 — Gmail(587 STARTTLS) 등에 맞춤 */
export function buildNodemailerTransportOptions(mailOpts: MailTransportResolved): SMTPTransport.Options {
  const opt: SMTPTransport.Options = {
    host: mailOpts.host,
    port: mailOpts.port,
    secure: mailOpts.secure,
    auth: mailOpts.auth
  };

  // 587·2525: STARTTLS — requireTLS로 업그레이드 유도(Gmail 포함)
  if (!mailOpts.secure && (mailOpts.port === 587 || mailOpts.port === 2525)) {
    opt.requireTLS = true;
  }

  const hostLower = mailOpts.host.toLowerCase();
  if (hostLower.includes('gmail.com')) {
    opt.tls = { minVersion: 'TLSv1.2' };
  }

  return opt;
}

/** DB JSON / 일부 드라이버에서 문자열로 올 때 대비 */
function parseCompanySettings(settings: unknown): Record<string, unknown> | undefined {
  if (settings == null) return undefined;
  const parsed = parseSettingsBlob(settings);
  return Object.keys(parsed).length ? parsed : undefined;
}

/**
 * 포트와 implicit TLS(`secure`) 일치.
 * - 465: 처음부터 TLS → secure true
 * - 587·25·2525: 평문 후 STARTTLS → secure false (여기서 secure true 쓰면 OpenSSL `wrong version number` 발생 가능)
 */
export function resolveSmtpSecure(port: number, rawSecure?: boolean): boolean {
  if (port === 465) return true;
  if (port === 587 || port === 25 || port === 2525) return false;
  return rawSecure === true;
}

type MailServerRaw = {
  host?: string;
  port?: number | string;
  secure?: boolean;
  authUser?: string;
  authPass?: string;
  fromEmail?: string;
  fromName?: string;
};

/**
 * Gmail 앱 비밀번호는 UI에 `xxxx xxxx xxxx xxxx`로 표시됨.
 * 공백이 들어가면 535 BadCredentials가 나는 경우가 있어 제거한다.
 */
export function normalizeSmtpPassword(pass: string): string {
  return String(pass || '').replace(/\s+/g, '').trim();
}

/**
 * `settings.mailServer` 한 덩어리에서 SMTP 연결 정보 해석.
 * 비밀번호가 비어 있으면 호스트·계정이 서버 환경변수(EMAIL_*)와 같을 때만 env 비밀번호 사용.
 */
function resolveMailServerRecord(raw: MailServerRaw | undefined): MailTransportResolved | null {
  if (!raw?.host || !raw.authUser) return null;
  const host = String(raw.host).trim();
  const authUser = String(raw.authUser).trim();
  if (!host || !authUser) return null;

  let pass = raw.authPass != null ? normalizeSmtpPassword(String(raw.authPass)) : '';
  if (
    !pass &&
    env.EMAIL_HOST &&
    env.EMAIL_USER &&
    env.EMAIL_PASS &&
    authUser === String(env.EMAIL_USER).trim() &&
    host === String(env.EMAIL_HOST).trim()
  ) {
    pass = normalizeSmtpPassword(env.EMAIL_PASS);
  }
  if (!pass) return null;

  const port = Math.max(1, Number(raw.port) || env.EMAIL_PORT || 587);
  const secure = resolveSmtpSecure(port, raw.secure);
  const addr = (raw.fromEmail || authUser).trim();
  const name = (raw.fromName || '').trim();
  const from = name ? `${name} <${addr}>` : addr;
  return {
    host,
    port,
    secure,
    auth: { user: authUser, pass },
    from
  };
}

function mailServerFromSettingsBlob(settings: unknown): MailTransportResolved | null {
  const parsed = parseCompanySettings(settings);
  const raw = parsed?.mailServer as MailServerRaw | undefined;
  return resolveMailServerRecord(raw);
}

/**
 * 회사 시스템 설정(`Company.settings.mailServer`) → 환경변수 EMAIL_* 순으로 SMTP 해석.
 */
export function getSystemMailTransportOptions(
  company: { settings?: unknown } | null | undefined
): MailTransportResolved | null {
  const fromCompany = mailServerFromSettingsBlob(company?.settings);
  if (fromCompany) return fromCompany;

  if (env.EMAIL_HOST && env.EMAIL_USER && env.EMAIL_PASS) {
    const port = env.EMAIL_PORT || 587;
    return {
      host: env.EMAIL_HOST,
      port,
      secure: resolveSmtpSecure(port, undefined),
      auth: { user: env.EMAIL_USER, pass: normalizeSmtpPassword(env.EMAIL_PASS) },
      from: env.EMAIL_USER
    };
  }

  return null;
}

/**
 * SMTP 해석: 회사 → (선택) 사용자 개인 SMTP → 환경변수.
 * 업무 알림 등에서 회사 SMTP가 없을 때 발신자 개인 SMTP를 폴백으로 사용한다.
 */
export function getResolvedMailTransportOptions(
  company: { settings?: unknown } | null | undefined,
  user?: { settings?: unknown; email?: string | null; username?: string | null } | null | undefined
): MailTransportResolved | null {
  const candidates = listMailTransportCandidates(company, user ? [user] : []);
  return candidates[0] || null;
}

function transportKey(t: MailTransportResolved): string {
  return `${t.host}|${t.port}|${t.auth.user}|${t.from}`.toLowerCase();
}

/**
 * 회사 → 사용자(들) 개인 SMTP → 환경변수 순 후보 목록 (중복 제거).
 * 인증 실패 시 다음 후보로 넘어갈 때 사용.
 */
export function listMailTransportCandidates(
  company: { settings?: unknown } | null | undefined,
  users: Array<{ settings?: unknown } | null | undefined> = []
): MailTransportResolved[] {
  const out: MailTransportResolved[] = [];
  const seen = new Set<string>();
  const push = (t: MailTransportResolved | null) => {
    if (!t) return;
    const key = transportKey(t);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };

  push(mailServerFromSettingsBlob(company?.settings));
  for (const u of users) {
    push(mailServerFromSettingsBlob(u?.settings));
  }
  // 회사 SMTP가 있어도 env는 마지막 폴백으로 포함 (회사 비번 오류 대비)
  if (env.EMAIL_HOST && env.EMAIL_USER && env.EMAIL_PASS) {
    const port = env.EMAIL_PORT || 587;
    push({
      host: env.EMAIL_HOST,
      port,
      secure: resolveSmtpSecure(port, undefined),
      auth: { user: env.EMAIL_USER, pass: normalizeSmtpPassword(env.EMAIL_PASS) },
      from: env.EMAIL_USER,
    });
  }
  return out;
}
