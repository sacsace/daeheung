/** 인증 미들웨어용 단기 메모리 캐시 — 요청마다 DB 조회 부담 감소 */

type CacheEntry<T> = { value: T; expiresAt: number };

const USER_TTL_MS = Number(process.env.AUTH_USER_CACHE_TTL_MS || 60_000);
const COMPANY_TTL_MS = Number(process.env.AUTH_COMPANY_CACHE_TTL_MS || 120_000);

const userCache = new Map<number, CacheEntry<Record<string, unknown>>>();
const companyCache = new Map<number, CacheEntry<Record<string, unknown>>>();

function getFromCache<T>(map: Map<number, CacheEntry<T>>, id: number): T | null {
  const entry = map.get(id);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    map.delete(id);
    return null;
  }
  return entry.value;
}

function setInCache<T>(map: Map<number, CacheEntry<T>>, id: number, value: T, ttlMs: number) {
  map.set(id, { value, expiresAt: Date.now() + ttlMs });
}

export function getCachedAuthUser(userId: number) {
  return getFromCache(userCache, userId);
}

export function setCachedAuthUser(userId: number, user: Record<string, unknown>) {
  setInCache(userCache, userId, user, USER_TTL_MS);
}

export function invalidateAuthUser(userId?: number) {
  if (userId != null) userCache.delete(userId);
  else userCache.clear();
}

export function getCachedAuthCompany(companyId: number) {
  return getFromCache(companyCache, companyId);
}

export function setCachedAuthCompany(companyId: number, company: Record<string, unknown>) {
  setInCache(companyCache, companyId, company, COMPANY_TTL_MS);
}
