import axios from 'axios';
import { env } from '../../config/env';
import { BankTransferPayload, BankTransferConfig } from './icici';

export const kotakTransfer = async (
  payload: BankTransferPayload,
  config?: Partial<BankTransferConfig> | null
) => {
  const apiUrl = String(config?.apiUrl || env.KOTAK_API_URL || '').trim();
  const transferPath = String(
    config?.transferPath || env.KOTAK_TRANSFER_PATH || '/transfers'
  ).trim() || '/transfers';
  const apiKey = String(config?.apiKey || env.KOTAK_API_KEY || '').trim();

  if (!apiUrl) {
    throw new Error('Kotak API URL이 설정되지 않았습니다. 회사 관리에서 등록하세요.');
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
