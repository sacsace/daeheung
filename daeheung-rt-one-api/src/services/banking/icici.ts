import axios from 'axios';
import { env } from '../../config/env';

export type BankTransferPayload = {
  amount: number;
  currency: string;
  beneficiaryName: string;
  beneficiaryAccount: string;
  ifsc: string;
  bankName?: string;
  reference?: string;
  remarks?: string;
};

export type BankTransferConfig = {
  apiUrl: string;
  apiKey: string;
  transferPath: string;
};

export const iciciTransfer = async (
  payload: BankTransferPayload,
  config?: Partial<BankTransferConfig> | null
) => {
  const apiUrl = String(config?.apiUrl || env.ICICI_API_URL || '').trim();
  const transferPath = String(
    config?.transferPath || env.ICICI_TRANSFER_PATH || '/transfers'
  ).trim() || '/transfers';
  const apiKey = String(config?.apiKey || env.ICICI_API_KEY || '').trim();

  if (!apiUrl) {
    throw new Error('ICICI API URL이 설정되지 않았습니다. 회사 관리에서 등록하세요.');
  }
  const url = `${apiUrl.replace(/\/$/, '')}${transferPath.startsWith('/') ? transferPath : `/${transferPath}`}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }
  const response = await axios.post(url, payload, { headers, timeout: 20000 });
  return response.data;
};
