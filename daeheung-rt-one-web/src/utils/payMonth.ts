/**
 * 급여월을 `YYYY-MM`으로 통일 (서버 `normalizePayrollPeriodInput`와 동일 규칙).
 */
export function normalizePayMonth(period: string | null | undefined): string | null {
  if (period == null) return null;
  const s = String(period).trim();
  const m = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/.exec(s);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (month < 1 || month > 12) return null;
  if (m[3] !== undefined) {
    const day = parseInt(m[3], 10);
    const dim = new Date(year, month, 0).getDate();
    if (day < 1 || day > dim) return null;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** 오늘 기준 이번 달 `YYYY-MM` */
export function currentPayMonthYm(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** 오늘 기준 지난 달 `YYYY-MM` */
export function lastPayMonthYm(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** `YYYY-MM`을 deltaMonths만큼 이동 (예: -1 → 이전달) */
export function shiftPayMonthYm(
  ym: string | null | undefined,
  deltaMonths: number
): string | null {
  const n = normalizePayMonth(ym);
  if (!n) return null;
  const year = parseInt(n.slice(0, 4), 10);
  const month = parseInt(n.slice(5, 7), 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  const d = new Date(year, month - 1 + deltaMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** `YYYY-MM`이 오늘 기준 이번 달보다 이후(미래 월)이면 true */
export function isPayMonthAfterCurrent(ym: string | null | undefined): boolean {
  const n = normalizePayMonth(ym);
  if (!n) return false;
  return n > currentPayMonthYm();
}

/** UI용 급여월 라벨 (en: October 2026, ko: 2026년 10월) */
export function formatPayMonthLabel(
  ym: string | null | undefined,
  language: string = 'en'
): string {
  const n = normalizePayMonth(ym);
  if (!n) return String(ym || '').trim();
  const year = parseInt(n.slice(0, 4), 10);
  const month = parseInt(n.slice(5, 7), 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return n;
  if (String(language).toLowerCase().startsWith('ko')) {
    return `${year}년 ${month}월`;
  }
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}
