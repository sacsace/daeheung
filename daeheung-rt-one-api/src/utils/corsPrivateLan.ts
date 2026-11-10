/**
 * 브라우저 Origin이 RFC1918 사설 IPv4(또는 localhost) 기반인지 검사.
 * LAN에서 IP로 프론트에 접속할 때 CORS 예외에 사용.
 */
export const isPrivateLanHttpOrigin = (origin: string): boolean => {
  try {
    const u = new URL(origin);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = u.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
    const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) return false;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 10) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    return false;
  } catch {
    return false;
  }
};

export const isCorsAllowLanEnabled = (): boolean => {
  const v = process.env.CORS_ALLOW_LAN;
  return v === '1' || v === 'true' || v === 'yes';
};
