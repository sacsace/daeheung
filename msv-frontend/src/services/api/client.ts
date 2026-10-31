import axios from 'axios';
import { useErrorStore } from '../../store/errorStore';
import {
  createEmptyListAxiosResponse,
  isCollectionListGet,
  isGetWithoutResponse,
  isNotificationFeedGet,
} from '../../utils/listApi';
import {
  extendScrollHold,
  holdScrollPosition,
  isScrollHoldActive,
} from '../../utils/preserveScroll';

const isMutatingHttpMethod = (method?: string): boolean => {
  const m = String(method || 'get').toLowerCase();
  return m === 'post' || m === 'put' || m === 'patch' || m === 'delete';
};

// API Base URL 동적 설정
// - 프로덕션(Railway 등): 빌드 시 주입된 REACT_APP_API_URL 최우선. 없으면 동일 오리진 /api (리버스 프록시·같은 서비스용).
// - 개발: LAN IPv4 / 단일 호스트명은 REACT_APP_API_URL보다 우선(백엔드 :5000).
// - 그다음 REACT_APP_API_URL, localhost:5000/api
const getApiBaseUrl = (): string => {
  const normalizeApiUrl = (raw: string) => {
    const trimmed = raw.trim().replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  };

  // 프로덕션: API가 별도 Railway 서비스인 경우 빌드 변수 필수에 가깝게 처리
  if (process.env.NODE_ENV === 'production') {
    const fromEnv = process.env.REACT_APP_API_URL?.trim();
    if (fromEnv) {
      return normalizeApiUrl(fromEnv);
    }
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin.replace(/\/+$/, '')}/api`;
    }
  }

  if (typeof window !== 'undefined') {
    const { hostname } = window.location;

    // 1) IPv4 (예: 192.168.x.x) — env의 localhost보다 항상 먼저
    if (hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      return `http://${hostname}:5000/api`;
    }

    // 2) 개발: http://PC이름:3000 형태 (점 없는 단일 호스트명)
    if (process.env.NODE_ENV === 'development' && !hostname.includes('.')) {
      if (hostname !== 'localhost' && hostname !== '::1') {
        return `http://${hostname}:5000/api`;
      }
    }
  }

  if (process.env.REACT_APP_API_URL) {
    const envApiUrl = process.env.REACT_APP_API_URL.trim();
    const localhostMatch = envApiUrl.match(/^https?:\/\/(localhost|127\.0\.0\.1)(?::(\d+))?(\/api)?\/?$/);
    const envPort = localhostMatch?.[2];

    if (envPort && envPort !== '5000') {
      return 'http://localhost:5000/api';
    }

    return normalizeApiUrl(envApiUrl);
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;

    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return 'http://localhost:5000/api';
    }

    const apiPort = port ? `:${port}` : '';
    return `${protocol}//${hostname}${apiPort}/api`;
  }

  return 'http://localhost:5000/api';
};

const API_BASE_URL = getApiBaseUrl();
const AUTH_STORAGE_KEY = 'mvs-auth-storage';

/** 인증 스냅샷은 localStorage 대신 sessionStorage (탭 단위, 서버 데이터와 혼동 방지) */
const authStorage = {
  getItem: (key: string) => (typeof window !== 'undefined' ? window.sessionStorage.getItem(key) : null),
  setItem: (key: string, value: string) => {
    if (typeof window !== 'undefined') window.sessionStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(key);
  }
};
const SESSION_WARNING_MS = 30 * 1000; // 30초
const SESSION_CHECK_INTERVAL_MS = 5 * 1000; // 5초
const SESSION_VALIDITY_POLL_MS = 5 * 1000; // 다른 기기 로그인 안내 폴링 (헤더 감지도 병행)
const SESSION_SUPERSEDED_CODE = 'SESSION_SUPERSEDED';
const LOGIN_NOTICE_STORAGE_KEY = 'mvs_login_notice_version';
const LOGIN_NOTICE_HEADER = 'x-mvs-login-notice-version';

/** 동일 429 안내가 errorStore에 반복 적재되지 않도록 */
let lastRateLimitNoticeAt = 0;
const RATE_LIMIT_NOTICE_COOLDOWN_MS = 60 * 1000;
const REFRESH_COOLDOWN_MS = 10 * 1000; // 10초
const ACTIVITY_REFRESH_WINDOW_MS = 2 * 60 * 1000; // 만료 2분 전부터 활동 기반 연장
const ACTIVITY_RECENT_WINDOW_MS = 5 * 60 * 1000; // 최근 5분 활동은 "사용 중"으로 간주
const ACTIVE_SESSION_REFRESH_COOLDOWN_MS = 3 * 60 * 1000; // 사용 중일 때 3분마다 선제 갱신
const CRITICAL_REFRESH_WINDOW_MS = SESSION_WARNING_MS; // 만료 임계 구간(30초)에서는 쿨다운 무시

// API Base URL을 export하여 다른 컴포넌트에서도 사용 가능하도록 함
export { getApiBaseUrl, API_BASE_URL };

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let expiryWarningShownForToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let lastRefreshAt = 0;
let lastUserActivityAt = Date.now();
let sessionSupersededHandled = false;
let loginElsewhereNoticeShownForVersion: number | null = null;
const isUserRecentlyActive = () => Date.now() - lastUserActivityAt <= ACTIVITY_RECENT_WINDOW_MS;

export const setStoredLoginNoticeVersion = (version: number | null | undefined) => {
  if (typeof window === 'undefined') return;
  const n = Number(version);
  if (!Number.isFinite(n) || n < 0) {
    window.sessionStorage.removeItem(LOGIN_NOTICE_STORAGE_KEY);
    loginElsewhereNoticeShownForVersion = null;
    return;
  }
  window.sessionStorage.setItem(LOGIN_NOTICE_STORAGE_KEY, String(Math.floor(n)));
  loginElsewhereNoticeShownForVersion = Math.floor(n);
};

/** 로그아웃 시 호출 — 다음 로그인에서 자기 로그인 팝업이 뜨지 않도록 */
export const clearStoredLoginNoticeVersion = () => {
  setStoredLoginNoticeVersion(null);
};

const getStoredLoginNoticeVersion = (): number | null => {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(LOGIN_NOTICE_STORAGE_KEY);
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.floor(n) : null;
};

const tAuth = (key: string, fallback: string) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const i18nMod = require('../../locales/i18n');
    const i18n = i18nMod?.default || i18nMod;
    const translated = i18n?.t?.(`auth.${key}`);
    if (typeof translated === 'string' && translated && translated !== `auth.${key}`) {
      return translated;
    }
  } catch {
    /* ignore */
  }
  return fallback;
};

const readStoredAuthToken = (): { raw: string; parsed: any; token: string } | null => {
  try {
    const raw = authStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const token = parsed?.state?.token;
    if (!token || typeof token !== 'string') return null;
    return { raw, parsed, token };
  } catch {
    return null;
  }
};

export const getAuthTokenFromStorage = (): string | null => readStoredAuthToken()?.token ?? null;

const updateStoredAuthToken = (token: string) => {
  try {
    const raw = authStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed?.state) return;
    parsed.state.token = token;
    authStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
};

const clearAuthAndRedirectLogin = () => {
  authStorage.removeItem(AUTH_STORAGE_KEY);
  if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
    window.location.href = '/login';
  }
};

/** 비밀번호 변경 등으로 session_version 이 바뀐 경우 — 강제 로그아웃 */
const handleSessionSuperseded = () => {
  if (sessionSupersededHandled) return;
  if (window.location.pathname === '/login' || window.location.pathname === '/') return;
  sessionSupersededHandled = true;
  authStorage.removeItem(AUTH_STORAGE_KEY);
  window.sessionStorage.removeItem(LOGIN_NOTICE_STORAGE_KEY);
  useErrorStore.getState().showError(
    tAuth('sessionSupersededTitle', '세션 종료'),
    tAuth(
      'sessionSupersededMessage',
      '비밀번호 변경 등으로 세션이 만료되어 다시 로그인해 주세요.'
    ),
    undefined,
    'warning',
    '/login'
  );
};

const isLoginPagePath = () => {
  if (typeof window === 'undefined') return true;
  const path = window.location.pathname;
  return path === '/login' || path === '/';
};

/** 서버 loginNoticeVersion 과 로컬 기준값 비교 — 상승 시에만 팝업 */
const applyLoginNoticeVersion = (serverVersionRaw: unknown) => {
  const serverVersion = Number(serverVersionRaw);
  if (!Number.isFinite(serverVersion) || serverVersion < 0) return;

  const localNotice = getStoredLoginNoticeVersion();
  // 최초 동기화(로그인 직후·새로고침): 기준값만 맞추고 팝업 없음
  if (localNotice == null) {
    setStoredLoginNoticeVersion(serverVersion);
    return;
  }
  if (serverVersion > localNotice) {
    handleLoginElsewhereNotice(serverVersion);
  }
};

/** 다른 곳에서 로그인 — 세션은 유지하고 안내 팝업만 */
const handleLoginElsewhereNotice = (serverVersion: number) => {
  if (isLoginPagePath()) return;
  if (loginElsewhereNoticeShownForVersion === serverVersion) return;
  loginElsewhereNoticeShownForVersion = serverVersion;
  setStoredLoginNoticeVersion(serverVersion);
  useErrorStore.getState().showError(
    tAuth('loginElsewhereTitle', '다른 곳에서 로그인'),
    tAuth(
      'loginElsewhereMessage',
      '다른 기기 또는 브라우저에서 동일한 계정으로 로그인했습니다. 현재 세션은 유지됩니다.'
    ),
    undefined,
    'warning'
  );
};

const readLoginNoticeHeader = (headers: any): number | null => {
  if (!headers) return null;
  const raw =
    headers[LOGIN_NOTICE_HEADER] ??
    headers['X-MVS-Login-Notice-Version'] ??
    (typeof headers.get === 'function' ? headers.get(LOGIN_NOTICE_HEADER) : null);
  if (raw == null || raw === '') return null;
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isFinite(n) ? Math.floor(n) : null;
};

const isAuthBypassEndpoint = (url?: string) => {
  if (!url) return false;
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/webauthn/login/') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/session') ||
    url.includes('/auth/logout')
  );
};

const showSessionExpiryWarning = (token: string) => {
  // 사용자가 최근에 활동 중이면 경고 대신 자동 연장 흐름에 맡긴다.
  if (isUserRecentlyActive()) return;
  if (expiryWarningShownForToken === token) return;
  expiryWarningShownForToken = token;
  const errorStore = useErrorStore.getState();
  errorStore.showNotification('세션이 30초 후 만료됩니다. 작업을 계속하면 자동으로 연장됩니다.', 'warning');
};

const shouldSkipSessionRefresh = (config: any) =>
  config?.headers?.['x-skip-session-refresh'] === 'true';

const isSessionSupersededError = (error: any) =>
  error?.response?.data?.code === SESSION_SUPERSEDED_CODE;

const requestSessionRefresh = async (currentToken: string): Promise<string | null> => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await api.post(
        '/auth/refresh',
        {},
        {
          headers: {
            Authorization: `Bearer ${currentToken}`,
            'x-skip-session-refresh': 'true',
            'x-skip-error-popup': 'true'
          }
        }
      );
      const refreshedToken = response?.data?.data?.token;
      if (typeof refreshedToken === 'string' && refreshedToken.length > 0) {
        updateStoredAuthToken(refreshedToken);
        expiryWarningShownForToken = null;
        return refreshedToken;
      }
      return null;
    } catch (error) {
      if (isSessionSupersededError(error)) {
        handleSessionSuperseded();
      }
      return null;
    } finally {
      lastRefreshAt = Date.now();
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

const markUserActivity = () => {
  lastUserActivityAt = Date.now();
};

const maybeRefreshSessionByActivity = async () => {
  const storedAuth = readStoredAuthToken();
  if (!storedAuth?.token) return;

  const expirationTime = getTokenExpiration(storedAuth.token);
  if (!expirationTime) return;

  const now = Date.now();
  const remainingTime = expirationTime - now;
  if (remainingTime <= 0) {
    clearAuthAndRedirectLogin();
    return;
  }

  const isNearExpiry = remainingTime <= ACTIVITY_REFRESH_WINDOW_MS;
  const isRecentlyActive = now - lastUserActivityAt <= ACTIVITY_RECENT_WINDOW_MS;
  const nearExpiryRefreshTooSoon = now - lastRefreshAt < REFRESH_COOLDOWN_MS;
  const activeSessionRefreshTooSoon = now - lastRefreshAt < ACTIVE_SESSION_REFRESH_COOLDOWN_MS;

  // 1) 만료 임박: 빠르게 연장 시도
  // 2) 사용 중: 만료 임박이 아니어도 주기적으로 선제 연장
  if (isNearExpiry) {
    const isCriticalExpiry = remainingTime <= CRITICAL_REFRESH_WINDOW_MS;
    if (!isCriticalExpiry && nearExpiryRefreshTooSoon) return;
  } else {
    if (!isRecentlyActive || activeSessionRefreshTooSoon) return;
  }

  const refreshedToken = await requestSessionRefresh(storedAuth.token);
  if (!refreshedToken && remainingTime <= SESSION_WARNING_MS) {
    showSessionExpiryWarning(storedAuth.token);
  }
};

// 요청 인터셉터
api.interceptors.request.use(
  async (config) => {
    // 수정·삭제는 요청 시작 시점부터 스크롤 고정 (로딩 UI로 높이 붕괴 대비)
    if (isMutatingHttpMethod(config.method)) {
      holdScrollPosition(1200);
    }

    // FormData 업로드 시 Content-Type을 비워 브라우저가 boundary 포함 multipart를 설정하게 함
    // (multipart/form-data를 boundary 없이 넣거나 application/json이 남으면 multer가 파일을 못 받음)
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      const headers = config.headers as any;
      if (headers) {
        if (typeof headers.set === 'function') {
          // AxiosHeaders: false → Content-Type 헤더 생략
          headers.set('Content-Type', false);
        } else if (typeof headers.delete === 'function') {
          headers.delete('Content-Type');
          headers.delete('content-type');
        } else {
          delete headers['Content-Type'];
          delete headers['content-type'];
          if (headers.common) {
            delete headers.common['Content-Type'];
            delete headers.common['content-type'];
          }
          if (headers.post) {
            delete headers.post['Content-Type'];
            delete headers.post['content-type'];
          }
        }
      }
    }

    const storedAuth = readStoredAuthToken();
    if (storedAuth?.token) {
      let activeToken = storedAuth.token;
      const skipRefresh = shouldSkipSessionRefresh(config);
      const expirationTime = getTokenExpiration(activeToken);

      if (expirationTime) {
        const remainingTime = expirationTime - Date.now();
        if (remainingTime <= 0) {
          clearAuthAndRedirectLogin();
          return Promise.reject(new Error('세션이 만료되었습니다.'));
        }

        if (remainingTime <= SESSION_WARNING_MS && !isUserRecentlyActive()) {
          showSessionExpiryWarning(activeToken);
        } else {
          expiryWarningShownForToken = null;
        }

        const isCriticalExpiry = remainingTime <= CRITICAL_REFRESH_WINDOW_MS;
        const shouldRefresh =
          !skipRefresh &&
          !isAuthBypassEndpoint(config.url) &&
          (isCriticalExpiry || Date.now() - lastRefreshAt >= REFRESH_COOLDOWN_MS);

        if (shouldRefresh) {
          const refreshedToken = await requestSessionRefresh(activeToken);
          if (refreshedToken) {
            activeToken = refreshedToken;
          }
        }
      }

      config.headers.Authorization = `Bearer ${activeToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

const decodeJwtPayload = (token: string): any | null => {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payloadPart = parts[1];
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

// JWT 토큰 만료 시간 추출 함수
const getTokenExpiration = (token: string): number | null => {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return null;
  return payload.exp * 1000; // exp는 초 단위이므로 밀리초로 변환
};

// 세션 타임아웃 체크 및 자동 로그아웃
const checkSessionTimeout = () => {
  try {
    const storedAuth = readStoredAuthToken();
    if (!storedAuth?.token) return;

    const expirationTime = getTokenExpiration(storedAuth.token);
    if (!expirationTime) return;

    const timeUntilExpiry = expirationTime - Date.now();

    if (timeUntilExpiry <= 0) {
      clearAuthAndRedirectLogin();
      return;
    }

    if (timeUntilExpiry <= SESSION_WARNING_MS) {
      if (!isUserRecentlyActive()) {
        showSessionExpiryWarning(storedAuth.token);
      } else {
        expiryWarningShownForToken = null;
      }
      // API 호출이 없는 화면에서도 "실사용 중"이면 세션을 자동 연장
      if (isUserRecentlyActive()) {
        void maybeRefreshSessionByActivity();
      }
    } else {
      expiryWarningShownForToken = null;
    }
  } catch {
    /* ignore */
  }
};

/** 서버에 현재 세션이 유효한지 확인 + 다른 기기 로그인 안내 */
const pollSessionValidity = async () => {
  try {
    const storedAuth = readStoredAuthToken();
    if (!storedAuth?.token) return;
    if (isLoginPagePath()) return;

    const response = await api.get('/auth/session', {
      headers: {
        Authorization: `Bearer ${storedAuth.token}`,
        'x-skip-session-refresh': 'true',
        'x-skip-error-popup': 'true',
      },
    });
    const payload = response?.data?.data || {};
    const fromBody = payload.loginNoticeVersion;
    const fromHeader = readLoginNoticeHeader(response?.headers);
    applyLoginNoticeVersion(fromBody ?? fromHeader);
  } catch (error) {
    if (isSessionSupersededError(error)) {
      handleSessionSuperseded();
    }
  }
};

// 주기적으로 세션 타임아웃 체크 (5초마다)
setInterval(checkSessionTimeout, SESSION_CHECK_INTERVAL_MS);
setInterval(() => {
  void pollSessionValidity();
}, SESSION_VALIDITY_POLL_MS);
// 모듈 로드 직후 1회 — 첫 폴링 주기까지 기다리지 않음
if (typeof window !== 'undefined') {
  window.setTimeout(() => {
    void pollSessionValidity();
  }, 800);
}

if (typeof window !== 'undefined') {
  const activityEvents: Array<keyof WindowEventMap> = [
    'click',
    'keydown',
    'mousemove',
    'scroll',
    'touchstart',
    'focus'
  ];

  const onActivity = () => {
    markUserActivity();
    void maybeRefreshSessionByActivity();
  };

  activityEvents.forEach((eventName) => {
    window.addEventListener(eventName, onActivity, { passive: true });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      onActivity();
      void pollSessionValidity();
    }
  });

  window.addEventListener('focus', () => {
    void pollSessionValidity();
  });
}

// 응답 인터셉터
api.interceptors.response.use(
  (response) => {
    const url = String(response?.config?.url || '');
    // 로그인 응답은 Login.tsx 가 기준값을 먼저 저장 — 여기서 비교하면 레이스 발생
    if (!url.includes('/auth/login') && !url.includes('/auth/webauthn/login')) {
      const notice = readLoginNoticeHeader(response?.headers);
      if (notice != null) {
        applyLoginNoticeVersion(notice);
      }
    }
    return response;
  },
  async (error) => {
    const skipErrorPopup =
      error.config?.headers?.['x-skip-error-popup'] === 'true' ||
      isNotificationFeedGet(error.config) ||
      (typeof error.config?.url === 'string' && /\/hr\/attendances\/(today|check-in|check-out)/.test(error.config.url));

    // 인증 오류 처리 (401, 403)
    // 로그인 API 호출 시에는 리다이렉트하지 않음 (로그인 페이지에서 오류 메시지 표시)
    const isLoginEndpoint =
      error.config?.url?.includes('/auth/login') ||
      error.config?.url?.includes('/auth/webauthn/login/');

    if (isSessionSupersededError(error)) {
      handleSessionSuperseded();
      return Promise.reject(error);
    }
    
    if (error.response?.status === 401 || error.response?.status === 403) {
      // 로그인 API가 아닌 경우에만 리다이렉트 처리
      if (!isLoginEndpoint) {
        const isUnauthorized = error.response?.status === 401;
        const canRetryWithRefresh =
          isUnauthorized &&
          !shouldSkipSessionRefresh(error.config) &&
          !isAuthBypassEndpoint(error.config?.url) &&
          !error.config?._retry;

        if (canRetryWithRefresh) {
          const storedAuth = readStoredAuthToken();
          if (storedAuth?.token) {
            const refreshedToken = await requestSessionRefresh(storedAuth.token);
            if (refreshedToken) {
              error.config._retry = true;
              error.config.headers = {
                ...(error.config.headers || {}),
                Authorization: `Bearer ${refreshedToken}`
              };
              return api.request(error.config);
            }
          }
        }

        // MVS 세션 무효만 강제 로그아웃.
        // HeresNow 등 외부 연동 실패가 HTTP 401 로 오면 세션과 무관하므로 로그아웃하지 않음.
        const errPayload = error.response?.data;
        const errMessage = String(errPayload?.message || '');
        const errCode = String(errPayload?.code || '');
        const isMvsSessionInvalid =
          errCode === SESSION_SUPERSEDED_CODE ||
          errMessage === '유효하지 않은 토큰입니다.' ||
          errMessage === '액세스 토큰이 필요합니다.' ||
          errMessage === '인증이 필요합니다.' ||
          errMessage === '유효하지 않은 사용자입니다.' ||
          (error.response?.status === 401 &&
            !errCode.startsWith('HERESNOW_') &&
            !String(error.config?.url || '').includes('/heresnow/'));

        if (isMvsSessionInvalid) {
          authStorage.removeItem('mvs-auth-storage');
          if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
            window.location.href = '/login';
          }
          return Promise.reject(error);
        }
      }
    }

    // 알림 폴링 GET 실패(네트워크·서버 오류 포함) — 팝업 없이 빈 목록
    if (isNotificationFeedGet(error.config)) {
      return Promise.resolve(createEmptyListAxiosResponse(error.config));
    }

    // GET + 서버 무응답(네트워크 단절) — Header 회사정보·폴링 등, 모달·errorStore 적재 생략
    if (!skipErrorPopup && isGetWithoutResponse(error)) {
      return Promise.reject(error);
    }

    // 목록 조회 GET 실패 시 서버 오류 모달 대신 빈 목록으로 처리
    const listFetchStatus = error.response?.status;
    if (
      isCollectionListGet(error.config) &&
      (listFetchStatus === 404 ||
        listFetchStatus === 429 ||
        (listFetchStatus != null && listFetchStatus >= 500))
    ) {
      return Promise.resolve(createEmptyListAxiosResponse(error.config));
    }

    // 429 Rate Limit — 1분에 한 번만 안내 (errorStore 100건 누적 방지)
    if (!skipErrorPopup && error.response?.status === 429) {
      const now = Date.now();
      if (now - lastRateLimitNoticeAt >= RATE_LIMIT_NOTICE_COOLDOWN_MS) {
        lastRateLimitNoticeAt = now;
        const errorStore = useErrorStore.getState();
        errorStore.showError(
          '요청 한도 초과',
          '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.',
          undefined,
          'warning'
        );
      }
      return Promise.reject(error);
    }

    // 일반 에러 처리 - 팝업으로 표시
    // 인증 오류가 아니고, 로그인 API가 아닌 경우에만 팝업 표시
    if (!skipErrorPopup && error.response?.status !== 401 && error.response?.status !== 403 && !isLoginEndpoint) {
      const errorStore = useErrorStore.getState();
      const errorMessage = error.response?.data?.message || error.message || '알 수 없는 오류가 발생했습니다.';
      const errorTitle = getErrorTitle(error.response?.status);
      const status = error.response?.status;

      // 400 검증 오류(중복 휴가 등)는 모달 대신 알림(Snackbar)으로 표시
      if (status === 400) {
        errorStore.showNotification(errorMessage, 'warning');
      } else {
        errorStore.showError(
          errorTitle,
          errorMessage,
          process.env.NODE_ENV === 'development' ? getErrorDetails(error) : undefined,
          getErrorType(status)
        );
      }
    }

    return Promise.reject(error);
  }
);

// 에러 상태 코드에 따른 제목 반환
function getErrorTitle(status?: number): string {
  switch (status) {
    case 400:
      return '요청 오류';
    case 404:
      return '찾을 수 없음';
    case 500:
    case 502:
    case 503:
      return '서버 오류';
    case 504:
      return '시간 초과';
    default:
      return '오류 발생';
  }
}

// 에러 상태 코드에 따른 타입 반환
function getErrorType(status?: number): 'error' | 'warning' | 'info' {
  if (!status) return 'error';
  if (status >= 500) return 'error';
  if (status >= 400) return 'warning';
  return 'info';
}

// 개발 환경에서만 상세 정보 반환
function getErrorDetails(error: any): string {
  const details: string[] = [];
  
  if (error.config) {
    details.push(`URL: ${error.config.method?.toUpperCase()} ${error.config.url}`);
  }
  
  if (error.response) {
    details.push(`Status: ${error.response.status}`);
    if (error.response.data) {
      details.push(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
  
  if (error.stack) {
    details.push(`Stack: ${error.stack}`);
  }
  
  return details.join('\n\n');
}

export { api };
