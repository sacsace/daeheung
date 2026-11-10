export type MailServerForm = {
  host: string;
  port: number;
  secure: boolean;
  authUser: string;
  authPass: string;
  authPassConfigured: boolean;
  fromEmail: string;
  fromName: string;
};

export const EMPTY_MAIL_SERVER: MailServerForm = {
  host: '',
  port: 587,
  secure: false,
  authUser: '',
  authPass: '',
  authPassConfigured: false,
  fromEmail: '',
  fromName: '',
};

export const MAIL_PASS_MASK = '••••••••••••';

export function applyGmailSmtpPreset(prev: MailServerForm): MailServerForm {
  return {
    ...prev,
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
  };
}

export function syncMailPortSecure(
  prev: MailServerForm,
  key: keyof MailServerForm,
  value: string | number | boolean
): MailServerForm {
  const next = { ...prev, [key]: value } as MailServerForm;
  if (key === 'port') {
    const p = Number(value) || 587;
    next.port = p;
    if (p === 465) next.secure = true;
    else if (p === 587 || p === 2525 || p === 25) next.secure = false;
  }
  return next;
}
