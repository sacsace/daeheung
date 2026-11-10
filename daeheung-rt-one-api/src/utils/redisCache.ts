/**
 * Redis 선택 캐시 — 미설정·연결 실패 시 메모리 폴백 (참조 데이터 API용)
 */
import { createClient } from 'redis';

const REFERENCE_CACHE_TTL_SEC = Number(process.env.REFERENCE_CACHE_TTL_SEC || 300);

type MemoryEntry = { value: string; expiresAt: number };

type RedisCacheClient = ReturnType<typeof createClient>;

let client: RedisCacheClient | null = null;
let redisReady = false;
const memoryStore = new Map<string, MemoryEntry>();

export function isRedisCacheReady() {
  return redisReady;
}

export async function initRedisCache(): Promise<boolean> {
  const url = process.env.REDIS_URL;
  if (!url) {
    return false;
  }

  try {
    const redis = createClient({ url });
    redis.on('error', (err) => {
      console.warn('Redis cache error:', err?.message || err);
      redisReady = false;
    });
    await redis.connect();
    client = redis;
    redisReady = true;
    console.log('✅ Redis 참조 캐시 연결됨');
    return true;
  } catch (error: any) {
    console.warn('⚠️ Redis 미사용 — 메모리 캐시 폴백:', error?.message || error);
    redisReady = false;
    client = null;
    return false;
  }
}

export async function referenceCacheGet(key: string): Promise<string | null> {
  if (redisReady && client) {
    try {
      const value = await client.get(key);
      if (value != null) return value;
    } catch {
      /* memory fallback */
    }
  }

  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

export async function referenceCacheSet(
  key: string,
  value: string,
  ttlSec = REFERENCE_CACHE_TTL_SEC
): Promise<void> {
  if (redisReady && client) {
    try {
      await client.setEx(key, ttlSec, value);
      return;
    } catch {
      /* memory fallback */
    }
  }

  memoryStore.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
}

export async function referenceCacheDel(pattern: string): Promise<void> {
  if (redisReady && client) {
    try {
      const keys = await client.keys(pattern);
      if (keys.length > 0) await client.del(keys);
    } catch {
      /* ignore */
    }
  }

  if (pattern.includes('*')) {
    const prefix = pattern.replace(/\*+$/, '');
    for (const key of memoryStore.keys()) {
      if (key.startsWith(prefix)) memoryStore.delete(key);
    }
    return;
  }
  memoryStore.delete(pattern);
}

export function buildReferenceCacheKey(parts: Array<string | number | undefined | null>): string {
  return parts.filter((p) => p != null && p !== '').join(':');
}
