/** `useTranslation().t` — i18next 버전별 TFunction export 차이 회피 */
export type I18nTranslate = (key: string, options?: Record<string, unknown>) => string;

export function hasDetailValue(value: unknown): boolean {
  if (value == null) return false;
  const text = String(value).trim();
  return text.length > 0 && text !== '-' && text !== '—';
}

/** 전화: 숫자만 (인도 시외번호+국번 등 최대 15자리) */
export function normalizePhoneDigits(raw: string): string {
  return String(raw ?? '')
    .replace(/\D/g, '')
    .slice(0, 15);
}

/** 표시: 3자리 공백 4자리 공백 나머지 (예: 020 6719 1900) */
export function formatPhoneDisplay(digitsOnly: string): string {
  const d = normalizePhoneDigits(digitsOnly);
  if (!d) return '';
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 7)} ${d.slice(7)}`;
}

export function normalizeBankAccountDigits(raw: string): string {
  return String(raw ?? '')
    .replace(/\D/g, '')
    .slice(0, 20);
}

export function formatBankAccountDisplay(digitsOnly: string): string {
  const d = normalizeBankAccountDigits(digitsOnly);
  if (!d) return '';
  const parts: string[] = [];
  for (let i = 0; i < d.length; i += 4) parts.push(d.slice(i, i + 4));
  return parts.join(' ');
}

/** 입력값에 숫자·공백 외 문자가 있는지 (붙여넣기/스크립트 검증용) */
export function hasNonDigitInput(raw: string): boolean {
  return /[^\d\s]/.test(String(raw ?? ''));
}

export function normalizeEmailLower(raw: string): string {
  return String(raw ?? '').trim().toLowerCase();
}

export function normalizeIfsc(raw: string): string {
  return String(raw ?? '')
    .replace(/\s/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 11);
}

export function formatIfscDisplay(stored: string): string {
  const s = normalizeIfsc(stored);
  if (!s) return '';
  const parts: string[] = [];
  for (let i = 0; i < s.length; i += 4) parts.push(s.slice(i, i + 4));
  return parts.join(' ');
}

export function getGenderLabel(t: I18nTranslate, g: string | undefined): string {
  switch (g) {
    case 'male':
      return t('userManagement.genderMale');
    case 'female':
      return t('userManagement.genderFemale');
    case 'other':
      return t('userManagement.genderOther');
    default:
      return '';
  }
}

export function getEmploymentTypeLabel(t: I18nTranslate, type: string | undefined): string {
  switch (type) {
    case 'fulltime':
      return t('userManagement.empFulltime');
    case 'daily':
      return t('userManagement.empDaily');
    case 'service':
      return t('userManagement.empService');
    case 'contract':
      return t('userManagement.empContract');
    case 'parttime':
      return t('userManagement.empParttime');
    case 'intern':
      return t('userManagement.empIntern');
    default:
      return '';
  }
}

export function getRoleLabel(t: I18nTranslate, role: string | undefined): string {
  switch (role) {
    case 'root':
      return t('userManagement.roleRoot');
    case 'admin':
      return t('userManagement.roleAdmin');
    case 'user':
      return t('userManagement.roleUser');
    case 'audit':
      return t('userManagement.roleAudit');
    default:
      return role || '';
  }
}

export function getStatusLabel(t: I18nTranslate, status: string | undefined): string {
  switch (status) {
    case 'active':
      return t('userManagement.statusActive');
    case 'inactive':
      return t('userManagement.statusInactive');
    case 'suspended':
      return t('userManagement.statusSuspended');
    default:
      return status || '';
  }
}
