import axios from 'axios';
import { BankTransferPayload, iciciTransfer } from './icici';
import { kotakTransfer } from './kotak';
import {
  CompanyBankTransferSettings,
  resolveBankProviderConfig,
  BANK_API_KEY_MASK
} from './companyBankConfig';

export type BankProvider = 'icici' | 'kotak';

export {
  getCompanyBankTransferSettings,
  maskBankTransferSettingsForApi,
  mergeBankTransferSettings,
  resolveBankProviderConfig,
  BANK_API_KEY_MASK
} from './companyBankConfig';
export type { CompanyBankTransferSettings } from './companyBankConfig';

export const transferToBank = async (
  provider: BankProvider,
  payload: BankTransferPayload,
  companySettings?: CompanyBankTransferSettings | null
) => {
  const config = resolveBankProviderConfig(provider, companySettings);
  if (provider === 'icici') {
    return iciciTransfer(payload, config);
  }
  if (provider === 'kotak') {
    return kotakTransfer(payload, config);
  }
  throw new Error('지원하지 않는 은행입니다.');
};

const isMaskedApiKey = (value: unknown): boolean => {
  if (value == null) return true;
  const s = String(value).trim();
  if (!s) return true;
  if (s === BANK_API_KEY_MASK) return true;
  return /^\*+$/.test(s);
};

/** 실제 송금 없이 URL·API Key 도달 여부만 확인 */
export const testBankApiConnection = async (params: {
  provider: BankProvider;
  companySettings?: CompanyBankTransferSettings | null;
  override?: { apiUrl?: string; apiKey?: string; transferPath?: string };
}) => {
  const { provider, companySettings, override } = params;
  const resolved = resolveBankProviderConfig(provider, companySettings);
  const apiUrl = String(override?.apiUrl || resolved.apiUrl || '').trim();
  const transferPath =
    String(override?.transferPath || resolved.transferPath || '/transfers').trim() ||
    '/transfers';
  const apiKey = isMaskedApiKey(override?.apiKey)
    ? resolved.apiKey
    : String(override?.apiKey || '').trim();

  if (!apiUrl) {
    throw new Error('API URL을 입력하세요.');
  }
  if (!apiKey) {
    throw new Error('API Key를 입력하거나 저장 후 다시 테스트하세요.');
  }

  let parsed: URL;
  try {
    parsed = new URL(apiUrl);
  } catch {
    throw new Error('API URL 형식이 올바르지 않습니다.');
  }
  if (!/^https?:$/i.test(parsed.protocol)) {
    throw new Error('API URL은 http 또는 https여야 합니다.');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey
  };
  const base = apiUrl.replace(/\/$/, '');
  const path = transferPath.startsWith('/') ? transferPath : `/${transferPath}`;

  let baseStatus: number | null = null;
  try {
    const baseRes = await axios.get(base, {
      headers,
      timeout: 10000,
      validateStatus: () => true
    });
    baseStatus = baseRes.status;
  } catch (err: any) {
    const code = err?.code || '';
    const msg = err?.message || String(err);
    if (code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'ECONNABORTED') {
      throw new Error(`서버에 연결할 수 없습니다. (${code || msg})`);
    }
  }

  let pathStatus: number | null = null;
  try {
    const pathRes = await axios.get(`${base}${path}`, {
      headers,
      timeout: 10000,
      validateStatus: () => true,
      params: { ping: 1 }
    });
    pathStatus = pathRes.status;
  } catch (err: any) {
    const code = err?.code || '';
    if (!baseStatus && (code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'ECONNABORTED')) {
      throw new Error(`Transfer Path에 연결할 수 없습니다. (${code})`);
    }
  }

  if (baseStatus == null && pathStatus == null) {
    throw new Error('은행 API에 응답이 없습니다. URL·네트워크를 확인하세요.');
  }

  const status = pathStatus ?? baseStatus!;
  return {
    ok: true,
    provider,
    apiUrl: base,
    transferPath: path,
    httpStatus: status,
    reachable: true,
    message:
      status >= 200 && status < 500
        ? `연결 성공 (HTTP ${status}). 엔드포인트가 응답했습니다.`
        : `서버는 응답했으나 상태 코드가 ${status} 입니다. URL/Key를 확인하세요.`
  };
};
