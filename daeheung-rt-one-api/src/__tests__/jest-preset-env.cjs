/**
 * Jest가 어떤 테스트 파일보다 먼저 로드됩니다.
 * `config/env` / `config/database` import 시점에 DB·JWT가 있어야 합니다.
 */
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://mvs:mvs@127.0.0.1:5432/mvs_jest_placeholder';
}
if (!process.env.JWT_SECRET || String(process.env.JWT_SECRET).length < 32) {
  process.env.JWT_SECRET = 'jest-jwt-secret-do-not-use-in-production-32chars';
}
if (!process.env.CORS_ORIGIN) {
  process.env.CORS_ORIGIN = 'http://localhost:3000';
}
