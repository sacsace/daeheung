import { API_BASE_URL, getAuthTokenFromStorage } from '../services/api/client';

/** API 베이스에서 /api 접미사 제거 (정적 파일 호스트) */
export const getApiOrigin = (): string => API_BASE_URL.replace(/\/api\/?$/, '');

/**
 * 인증이 필요한 /uploads URL 생성 (img·a 태그용 access_token 쿼리)
 * @param path `/uploads/...` 또는 `product-images/foo.jpg`
 */
export const getUploadUrl = (path?: string | null): string => {
  if (!path || typeof path !== 'string') return '';
  const trimmed = path.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;

  const normalized = trimmed.startsWith('http')
    ? trimmed
    : trimmed.startsWith('/uploads/')
      ? trimmed
      : `/uploads/${trimmed.replace(/^\/+/, '')}`;

  if (normalized.startsWith('http')) return normalized;

  const encoded = normalized
    .split('/')
    .map((seg, idx) => {
      if (idx === 0 || !seg) return seg;
      try {
        return encodeURIComponent(decodeURIComponent(seg));
      } catch {
        return encodeURIComponent(seg);
      }
    })
    .join('/');

  const origin = getApiOrigin();
  const base = `${origin}${encoded}`;
  const token = getAuthTokenFromStorage();
  if (!token) return base;

  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}access_token=${encodeURIComponent(token)}`;
};

const fileNameFromUrl = (url: string, fallback = 'image') => {
  try {
    const path = decodeURIComponent(url.split('?')[0] || '');
    const base = path.split('/').pop() || '';
    return base.trim() || fallback;
  } catch {
    return fallback;
  }
};

/** 업로드 경로 → 절대 URL (쿼리 토큰 없이, fetch Authorization용) */
export const getUploadAbsoluteUrl = (pathOrUrl?: string | null): string => {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return '';
  const raw = pathOrUrl.trim();
  if (!raw) return '';
  if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw.split('?')[0];
  const normalized = raw.startsWith('/uploads/')
    ? raw
    : `/uploads/${raw.replace(/^\/+/, '')}`;
  const encoded = normalized
    .split('/')
    .map((seg, idx) => {
      if (idx === 0 || !seg) return seg;
      try {
        return encodeURIComponent(decodeURIComponent(seg));
      } catch {
        return encodeURIComponent(seg);
      }
    })
    .join('/');
  return `${getApiOrigin()}${encoded}`;
};

/**
 * 인증이 필요한 업로드 파일을 blob object URL로 로드.
 * 호출측에서 URL.revokeObjectURL 로 해제해야 함.
 */
export const fetchUploadObjectUrl = async (
  pathOrUrl?: string | null,
  opts?: { forceMime?: string }
): Promise<string> => {
  const raw = String(pathOrUrl || '').trim();
  if (!raw) throw new Error('empty upload path');
  if (raw.startsWith('blob:') || raw.startsWith('data:')) return raw;

  const absolute = getUploadAbsoluteUrl(raw);
  const token = getAuthTokenFromStorage();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(absolute, {
    headers,
    credentials: 'include',
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`upload fetch ${res.status}`);

  const buffer = await res.arrayBuffer();
  if (!buffer.byteLength) throw new Error('empty upload body');

  if (opts?.forceMime === 'application/pdf') {
    const head = new Uint8Array(buffer, 0, Math.min(5, buffer.byteLength));
    const isPdf =
      head.length >= 4 &&
      head[0] === 0x25 && // %
      head[1] === 0x50 && // P
      head[2] === 0x44 && // D
      head[3] === 0x46; // F
    if (!isPdf) throw new Error('not a pdf');
    return URL.createObjectURL(new Blob([buffer], { type: 'application/pdf' }));
  }

  let blob = new Blob([buffer], {
    type: opts?.forceMime || res.headers.get('content-type') || undefined,
  });
  if (opts?.forceMime && blob.type !== opts.forceMime) {
    blob = new Blob([buffer], { type: opts.forceMime });
  }
  return URL.createObjectURL(blob);
};

/** 인증 포함 업로드 파일을 로컬에 저장 */
export const downloadUploadFile = async (pathOrUrl?: string | null, filename?: string) => {
  const url =
    pathOrUrl && (pathOrUrl.startsWith('http') || pathOrUrl.startsWith('blob:') || pathOrUrl.startsWith('data:'))
      ? pathOrUrl
      : getUploadUrl(pathOrUrl);
  if (!url) return;
  const suggested = (filename || fileNameFromUrl(url)).replace(/[\\/:*?"<>|]/g, '_') || 'image';
  try {
    const objectUrl = await fetchUploadObjectUrl(pathOrUrl);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = suggested;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

/** 제품 이미지·미디어 경로 — getUploadUrl 별칭 */
export const resolveMediaUrl = getUploadUrl;
