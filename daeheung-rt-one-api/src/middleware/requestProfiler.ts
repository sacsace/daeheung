import type { NextFunction, Request, Response } from 'express';

const SLOW_REQUEST_THRESHOLD_MS = Number(process.env.SLOW_REQUEST_THRESHOLD_MS || 800);
const VERY_SLOW_REQUEST_THRESHOLD_MS = Number(process.env.VERY_SLOW_REQUEST_THRESHOLD_MS || 2000);

const SKIP_PATH_PREFIXES = ['/health', '/api/health', '/uploads', '/static'];

function shouldSkip(path: string): boolean {
  return SKIP_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * 운영 환경에서 느린 API를 식별하기 위한 경량 프로파일러.
 * - 기본 800ms 이상 요청만 로그
 * - 2000ms 이상은 warn 레벨로 강조
 */
export function requestProfiler(req: Request, res: Response, next: NextFunction): void {
  if (shouldSkip(req.path)) {
    next();
    return;
  }

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    if (elapsedMs < SLOW_REQUEST_THRESHOLD_MS) {
      return;
    }

    const logPayload = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Math.round(elapsedMs),
      contentLength: Number(res.getHeader('content-length') || 0),
    };

    if (elapsedMs >= VERY_SLOW_REQUEST_THRESHOLD_MS) {
      console.warn('🐢 very_slow_request', logPayload);
      return;
    }

    console.log('🐢 slow_request', logPayload);
  });

  next();
}

