/**
 * 메일·알림 딥링크용 — 동일 앱 내부 경로만 허용.
 * 외부 URL·프로토콜 상대(`//…`)·javascript: 등은 거부한다.
 */
export function safeInternalPath(raw: unknown, fallback = '/dashboard'): string {
  if (typeof raw !== 'string') return fallback;
  let decoded = raw.trim();
  try {
    decoded = decodeURIComponent(decoded).trim();
  } catch {
    /* keep raw trim */
  }
  if (!decoded.startsWith('/')) return fallback;
  if (decoded.startsWith('//')) return fallback;
  if (decoded.includes('://')) return fallback;
  if (/[\u0000-\u001F]/.test(decoded)) return fallback;
  return decoded || fallback;
}

/** `/login?redirect=` 쿼리에서 복원 */
export function redirectFromSearchParams(
  search: string,
  fallback = '/dashboard'
): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return safeInternalPath(params.get('redirect'), fallback);
}
