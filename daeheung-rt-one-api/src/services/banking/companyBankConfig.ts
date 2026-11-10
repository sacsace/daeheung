import { env } from '../../config/env';

export type BankProvider = 'icici' | 'kotak';

export const BANK_API_KEY_MASK = '********';

export type BankProviderCredentials = {
  apiUrl?: string;
  apiKey?: string;
  transferPath?: string;
};

export type CompanyBankTransferSettings = {
  defaultProvider?: BankProvider | '';
  icici?: BankProviderCredentials;
  kotak?: BankProviderCredentials;
};

const isMaskedOrEmpty = (value: unknown): boolean => {
  if (value == null) return true;
  const s = String(value).trim();
  if (!s) return true;
  if (s === BANK_API_KEY_MASK) return true;
  return /^\*+$/.test(s);
};

export const getCompanyBankTransferSettings = (
  companyOrSettings: any
): CompanyBankTransferSettings => {
  const settings =
    companyOrSettings?.settings && typeof companyOrSettings.settings === 'object'
      ? companyOrSettings.settings
      : companyOrSettings && typeof companyOrSettings === 'object' && !companyOrSettings.id
        ? companyOrSettings
        : {};
  const bank = settings?.bank_transfer;
  if (!bank || typeof bank !== 'object') return {};
  return bank as CompanyBankTransferSettings;
};

export const resolveBankProviderConfig = (
  provider: BankProvider,
  companySettings?: CompanyBankTransferSettings | null
): { apiUrl: string; apiKey: string; transferPath: string } => {
  const fromCompany =
    provider === 'icici' ? companySettings?.icici : companySettings?.kotak;

  if (provider === 'icici') {
    return {
      apiUrl: String(fromCompany?.apiUrl || env.ICICI_API_URL || '').trim(),
      apiKey: String(fromCompany?.apiKey || env.ICICI_API_KEY || '').trim(),
      transferPath: String(
        fromCompany?.transferPath || env.ICICI_TRANSFER_PATH || '/transfers'
      ).trim() || '/transfers'
    };
  }

  return {
    apiUrl: String(fromCompany?.apiUrl || env.KOTAK_API_URL || '').trim(),
    apiKey: String(fromCompany?.apiKey || env.KOTAK_API_KEY || '').trim(),
    transferPath: String(
      fromCompany?.transferPath || env.KOTAK_TRANSFER_PATH || '/transfers'
    ).trim() || '/transfers'
  };
};

export const mergeBankTransferSettings = (
  existing: CompanyBankTransferSettings | undefined,
  incoming: CompanyBankTransferSettings | undefined
): CompanyBankTransferSettings => {
  const prev = existing && typeof existing === 'object' ? existing : {};
  const next = incoming && typeof incoming === 'object' ? incoming : {};

  const mergeProvider = (
    prevCred?: BankProviderCredentials,
    nextCred?: BankProviderCredentials
  ): BankProviderCredentials | undefined => {
    if (nextCred === undefined) return prevCred;
    if (nextCred === null) return undefined;
    const merged: BankProviderCredentials = {
      ...(prevCred || {}),
      ...nextCred
    };
    if (isMaskedOrEmpty(nextCred.apiKey)) {
      if (prevCred?.apiKey) merged.apiKey = prevCred.apiKey;
      else delete merged.apiKey;
    }
    return merged;
  };

  return {
    defaultProvider:
      next.defaultProvider !== undefined ? next.defaultProvider : prev.defaultProvider,
    icici: mergeProvider(prev.icici, next.icici),
    kotak: mergeProvider(prev.kotak, next.kotak)
  };
};

/** API 응답용: apiKey는 마스킹하고 설정 여부만 노출 */
export const maskBankTransferSettingsForApi = (
  settings: any
): any => {
  if (!settings || typeof settings !== 'object') return settings || {};
  const cloned = { ...settings };
  const bank = cloned.bank_transfer;
  if (!bank || typeof bank !== 'object') return cloned;

  const maskProvider = (cred?: BankProviderCredentials) => {
    if (!cred || typeof cred !== 'object') return cred;
    const hasKey = Boolean(String(cred.apiKey || '').trim());
    return {
      apiUrl: cred.apiUrl || '',
      transferPath: cred.transferPath || '',
      apiKey: hasKey ? BANK_API_KEY_MASK : '',
      apiKeySet: hasKey
    };
  };

  cloned.bank_transfer = {
    defaultProvider: bank.defaultProvider || '',
    icici: maskProvider(bank.icici),
    kotak: maskProvider(bank.kotak)
  };
  return cloned;
};
