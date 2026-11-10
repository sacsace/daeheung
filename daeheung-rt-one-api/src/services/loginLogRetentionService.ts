import { Op } from 'sequelize';
import LoginLog from '../models/LoginLog';

/** 로그인·활동 감사 로그 보관 기간. 업무/마스터 데이터에는 적용하지 않는다. */
export const LOGIN_LOG_RETENTION_DAYS = 120;
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;

let timer: NodeJS.Timeout | null = null;
let running = false;

export async function cleanupExpiredLoginLogs(): Promise<number> {
  if (running) return 0;
  running = true;
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - LOGIN_LOG_RETENTION_DAYS);

    const removed = await (LoginLog as any).destroy({
      where: { logged_at: { [Op.lt]: cutoff } },
    });
    if (removed > 0) {
      console.info(
        `login log retention: removed ${removed} record(s) older than ${LOGIN_LOG_RETENTION_DAYS} days`
      );
    }
    return Number(removed) || 0;
  } catch (error) {
    console.error('login log retention cleanup failed:', error);
    return 0;
  } finally {
    running = false;
  }
}

/** 서버 시작 시 한 번 정리하고 이후 24시간마다 실행한다. */
export function startLoginLogRetentionScheduler(): void {
  if (timer) return;
  void cleanupExpiredLoginLogs();
  timer = setInterval(() => void cleanupExpiredLoginLogs(), RUN_INTERVAL_MS);
  timer.unref();
}
