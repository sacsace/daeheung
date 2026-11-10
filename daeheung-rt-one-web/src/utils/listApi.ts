import type { InternalAxiosRequestConfig } from 'axios';

const NON_LIST_GET_SUFFIX =
  /\/(?:export|sample|download|next-number|today|check-in|check-out|health|status|preview|mail|pdf|chart|stats|summary|inbox|unread-count|me|profile|permissions|refresh|payslips\/\d+\/download)(?:\/|\?|$)/i;

/** 헤더/알림 페이지 백그라운드 폴링 — 실패 시 팝업 없이 빈 목록 처리 */
export const isNotificationFeedGet = (
  config?: InternalAxiosRequestConfig | { method?: string; url?: string }
) => {
  if (config?.method?.toLowerCase() !== 'get') return false;
  const url = String(config?.url || '');
  return /\/notifications(?:\/inbox)?(?:\?|$)/.test(url);
};

/** 목록 조회용 GET인지 판별 (단건·다운로드·인증 등 제외) */
export const isCollectionListGet = (config?: InternalAxiosRequestConfig | { method?: string; url?: string }) => {
  const method = config?.method?.toLowerCase();
  if (method !== 'get') return false;

  const url = String(config?.url || '').replace(/^\//, '');
  if (!url) return false;
  if (url.startsWith('auth/')) return false;
  if (/\/\d+(?:\?|$)/.test(url)) return false;
  if (NON_LIST_GET_SUFFIX.test(url)) return false;
  if (/payroll-bonuses(?:\?|$)/.test(url)) return false;
  if (/^notifications(?:\/|$)/.test(url)) return false;

  return true;
};

export const createEmptyListAxiosResponse = (config: InternalAxiosRequestConfig) => ({
  data: { success: true, data: [] },
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

/** 서버 응답 없이 끊긴 GET (백엔드 미기동·CORS·타임아웃 등) */
export const isGetWithoutResponse = (
  error: { response?: unknown; config?: { method?: string } }
) => error.config?.method?.toLowerCase() === 'get' && error.response == null;
