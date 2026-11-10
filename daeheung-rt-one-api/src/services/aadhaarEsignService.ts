/**
 * Aadhaar eSign ASP 연동 어댑터
 *
 * mode:
 * - mock: 개발/데모용. OTP 시뮬레이션으로 서명 완료
 * - live: 실제 ASP HTTP API (AADHAAR_ESIGN_ASP_BASE_URL 등 필요)
 *
 * ASP 후보 (계약 후 구체 endpoint 매핑):
 * - eMudhra, NSDL e-Gov, C-DAC / licensed eSign ASP
 */
import crypto from 'crypto';
import { env } from '../config/env';

export type AadhaarEsignMode = 'mock' | 'live';

export type InitiateAspInput = {
  contractId: number;
  sessionToken: string;
  documentHash: string;
  signerName: string;
  aadhaarLast4: string;
  returnUrl: string;
  companyId?: number | null;
};

export type InitiateAspResult = {
  provider: string;
  aspTxnId: string;
  redirectUrl: string | null;
  /** mock 모드에서 FE가 OTP 입력 UI를 띄울지 */
  requiresMockOtp: boolean;
  raw?: Record<string, unknown>;
};

export type CompleteAspInput = {
  aspTxnId: string;
  sessionToken: string;
  mockOtp?: string;
  callbackPayload?: Record<string, unknown>;
};

export type CompleteAspResult = {
  success: boolean;
  aspTxnId: string;
  certificateRef?: string;
  signedHash?: string;
  errorCode?: string;
  errorMessage?: string;
  raw?: Record<string, unknown>;
};

export function getAadhaarEsignMode(): AadhaarEsignMode {
  const mode = String(env.AADHAAR_ESIGN_MODE || process.env.AADHAAR_ESIGN_MODE || 'mock')
    .trim()
    .toLowerCase();
  return mode === 'live' ? 'live' : 'mock';
}

export function getAadhaarEsignProviderName(): string {
  const named = String(env.AADHAAR_ESIGN_PROVIDER || process.env.AADHAAR_ESIGN_PROVIDER || '').trim();
  if (named) return named;
  return getAadhaarEsignMode() === 'live' ? 'generic_asp' : 'mock';
}

function requireLiveConfig() {
  const baseUrl = String(env.AADHAAR_ESIGN_ASP_BASE_URL || process.env.AADHAAR_ESIGN_ASP_BASE_URL || '').trim();
  const apiKey = String(env.AADHAAR_ESIGN_ASP_API_KEY || process.env.AADHAAR_ESIGN_ASP_API_KEY || '').trim();
  if (!baseUrl || !apiKey) {
    throw new Error(
      'Aadhaar eSign live 모드에는 AADHAAR_ESIGN_ASP_BASE_URL / AADHAAR_ESIGN_ASP_API_KEY 설정이 필요합니다.'
    );
  }
  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    apiKey,
    initiatePath: String(
      env.AADHAAR_ESIGN_ASP_INITIATE_PATH ||
        process.env.AADHAAR_ESIGN_ASP_INITIATE_PATH ||
        '/esign/initiate'
    ),
    statusPath: String(
      env.AADHAAR_ESIGN_ASP_STATUS_PATH || process.env.AADHAAR_ESIGN_ASP_STATUS_PATH || '/esign/status'
    ),
    timeoutMs: Number(env.AADHAAR_ESIGN_ASP_TIMEOUT_MS || process.env.AADHAAR_ESIGN_ASP_TIMEOUT_MS || 60000),
  };
}

export async function initiateAspEsign(input: InitiateAspInput): Promise<InitiateAspResult> {
  const mode = getAadhaarEsignMode();
  const provider = getAadhaarEsignProviderName();

  if (mode === 'mock') {
    const aspTxnId = `MOCK-TXN-${input.contractId}-${Date.now()}`;
    return {
      provider,
      aspTxnId,
      redirectUrl: null,
      requiresMockOtp: true,
      raw: { mode: 'mock', note: 'Simulated ASP session. Use any 6-digit OTP to complete.' },
    };
  }

  const cfg = requireLiveConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const res = await fetch(`${cfg.baseUrl}${cfg.initiatePath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
        'X-Api-Key': cfg.apiKey,
      },
      body: JSON.stringify({
        reference_id: input.sessionToken,
        contract_id: input.contractId,
        document_hash: input.documentHash,
        signer_name: input.signerName,
        aadhaar_last4: input.aadhaarLast4,
        return_url: input.returnUrl,
        company_id: input.companyId ?? undefined,
      }),
      signal: controller.signal,
    });
    const raw = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok) {
      throw new Error(raw?.message || raw?.error || `ASP initiate failed (${res.status})`);
    }
    const aspTxnId = String(raw.txn_id || raw.transaction_id || raw.asp_txn_id || '').trim();
    const redirectUrl = String(raw.redirect_url || raw.auth_url || raw.url || '').trim();
    if (!aspTxnId || !redirectUrl) {
      throw new Error('ASP initiate 응답에 txn_id/redirect_url 이 없습니다. ASP 매핑을 확인하세요.');
    }
    return {
      provider,
      aspTxnId,
      redirectUrl,
      requiresMockOtp: false,
      raw,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function completeAspEsign(input: CompleteAspInput): Promise<CompleteAspResult> {
  const mode = getAadhaarEsignMode();

  if (mode === 'mock') {
    const otp = String(input.mockOtp || '').trim();
    if (!/^\d{6}$/.test(otp)) {
      return {
        success: false,
        aspTxnId: input.aspTxnId,
        errorCode: 'INVALID_OTP',
        errorMessage: 'Mock OTP는 6자리 숫자여야 합니다.',
      };
    }
    return {
      success: true,
      aspTxnId: input.aspTxnId,
      certificateRef: `MOCK-CERT-${otp}`,
      signedHash: crypto.createHash('sha256').update(`${input.sessionToken}:${otp}`).digest('hex'),
      raw: { mode: 'mock', otp_used: true },
    };
  }

  const cfg = requireLiveConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const res = await fetch(`${cfg.baseUrl}${cfg.statusPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
        'X-Api-Key': cfg.apiKey,
      },
      body: JSON.stringify({
        txn_id: input.aspTxnId,
        reference_id: input.sessionToken,
        callback: input.callbackPayload || undefined,
      }),
      signal: controller.signal,
    });
    const raw = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok) {
      return {
        success: false,
        aspTxnId: input.aspTxnId,
        errorCode: String(raw?.code || res.status),
        errorMessage: String(raw?.message || raw?.error || 'ASP status check failed'),
        raw,
      };
    }
    const status = String(raw.status || raw.result || '').toLowerCase();
    const ok = ['success', 'completed', 'signed', 'ok'].includes(status) || raw.success === true;
    if (!ok) {
      return {
        success: false,
        aspTxnId: input.aspTxnId,
        errorCode: String(raw?.code || 'NOT_COMPLETED'),
        errorMessage: String(raw?.message || 'ASP 서명이 아직 완료되지 않았습니다.'),
        raw,
      };
    }
    return {
      success: true,
      aspTxnId: input.aspTxnId,
      certificateRef: String(raw.certificate_ref || raw.certificate_id || ''),
      signedHash: String(raw.signed_hash || raw.document_hash || ''),
      raw,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function buildDocumentHash(parts: Array<string | number | null | undefined>): string {
  return crypto.createHash('sha256').update(parts.map((p) => String(p ?? '')).join('|')).digest('hex');
}

export function createSessionToken(): string {
  return crypto.randomBytes(24).toString('hex');
}
