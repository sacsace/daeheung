import nodemailer from 'nodemailer';
import { User } from '../models';
import {
  buildNodemailerTransportOptions,
  getResolvedMailTransportOptions,
  normalizeSmtpPassword,
  resolveSmtpSecure,
} from '../utils/mailConfig';
import { parseSettingsBlob } from '../utils/settingsBlob';

export type MailServerPatch = {
  host?: string;
  port?: number | string;
  secure?: boolean;
  authUser?: string;
  authPass?: string;
  fromEmail?: string;
  fromName?: string;
};

const emptySafe = () => ({
  host: '',
  port: 587,
  secure: false,
  authUser: '',
  fromEmail: '',
  fromName: '',
  authPassConfigured: false,
});

async function findScopedUser(params: {
  userId: number;
  tenantId?: number | null;
  companyId?: number | null;
}) {
  const where: Record<string, unknown> = { id: params.userId };
  if (params.tenantId != null) where.tenant_id = params.tenantId;
  if (params.companyId != null) where.company_id = params.companyId;
  return User.findOne({
    where,
    attributes: ['id', 'settings', 'email', 'username', 'tenant_id', 'company_id'],
  });
}

export async function getUserMailServerSafe(params: {
  userId: number;
  tenantId?: number | null;
  companyId?: number | null;
}) {
  const user = await findScopedUser(params);
  if (!user) return null;
  const settings = parseSettingsBlob((user as any).settings);
  const mail = (settings.mailServer || {}) as Record<string, unknown>;
  return {
    ...emptySafe(),
    host: mail.host != null ? String(mail.host).trim() : '',
    port: Number(mail.port) || 587,
    secure: Boolean(mail.secure),
    authUser: mail.authUser != null ? String(mail.authUser).trim() : '',
    authPass: mail.authPass != null ? String(mail.authPass) : '',
    fromEmail: mail.fromEmail != null ? String(mail.fromEmail).trim() : '',
    fromName: mail.fromName != null ? String(mail.fromName).trim() : '',
    authPassConfigured: Boolean(mail.authPass && String(mail.authPass).trim()),
  };
}

export async function patchUserMailServer(params: {
  userId: number;
  tenantId?: number | null;
  companyId?: number | null;
  patch: MailServerPatch;
}) {
  const user = await findScopedUser(params);
  if (!user) return null;

  const settings = parseSettingsBlob((user as any).settings);
  const prev = (settings.mailServer || {}) as Record<string, unknown>;
  const inc = params.patch;
  const passwordUnchanged = !inc.authPass || String(inc.authPass).trim() === '';
  const port = Math.max(1, Number(inc.port) || Number(prev.port) || 587);

  const nextMail = {
    host: inc.host != null ? String(inc.host).trim() : String(prev.host || '').trim(),
    port,
    secure: resolveSmtpSecure(
      port,
      inc.secure != null ? Boolean(inc.secure) : Boolean(prev.secure)
    ),
    authUser:
      inc.authUser != null ? String(inc.authUser).trim() : String(prev.authUser || '').trim(),
    authPass: passwordUnchanged
      ? normalizeSmtpPassword(String(prev.authPass || ''))
      : normalizeSmtpPassword(String(inc.authPass)),
    fromEmail:
      inc.fromEmail != null ? String(inc.fromEmail).trim() : String(prev.fromEmail || '').trim(),
    fromName:
      inc.fromName != null ? String(inc.fromName).trim() : String(prev.fromName || '').trim(),
  };

  settings.mailServer = nextMail;
  await (user as any).update({ settings });

  return {
    ...nextMail,
    authPassConfigured: Boolean(nextMail.authPass),
  };
}

export async function sendUserMailServerTest(params: {
  userId: number;
  tenantId?: number | null;
  companyId?: number | null;
  to: string;
}) {
  const to = String(params.to || '').trim();
  if (!to) {
    const err: any = new Error('수신 이메일을 입력하세요.');
    err.status = 400;
    throw err;
  }

  const user = await findScopedUser(params);
  if (!user) return null;

  const mailOpts = getResolvedMailTransportOptions(null, user);
  if (!mailOpts) {
    const err: any = new Error('SMTP 호스트·계정·비밀번호를 먼저 저장하세요.');
    err.status = 400;
    throw err;
  }

  const transporter = nodemailer.createTransport(buildNodemailerTransportOptions(mailOpts));
  await transporter.sendMail({
    from: mailOpts.from,
    to,
    subject: '[MVS] SMTP test',
    text: 'Your personal SMTP settings work.',
    html: '<p>Your personal SMTP settings work.</p>',
  });
  return true;
}
