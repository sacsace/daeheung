import sequelize from '../config/database';

let ensured = false;

/** users.login_notice_version 컬럼이 없으면 추가 (마이그레이션 전 안전망) */
export async function ensureLoginNoticeVersionColumn(): Promise<void> {
  if (ensured) return;
  try {
    await sequelize.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS login_notice_version INTEGER NOT NULL DEFAULT 0
    `);
    ensured = true;
  } catch (error) {
    const msg = String((error as any)?.message || error || '').toLowerCase();
    if (msg.includes('duplicate') || msg.includes('already exists')) {
      ensured = true;
      return;
    }
    console.error('ensureLoginNoticeVersionColumn:', error);
  }
}
