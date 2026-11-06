/** 인도 회계연도: 4월 1일 ~ 다음 해 3월 31일 */

export type FiscalYear = {
  label: string;
  startYear: number;
  start: string;
  end: string;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function ymd(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function fiscalYearFromStartYear(startYear: number): FiscalYear {
  return {
    startYear,
    label: `${startYear}-${startYear + 1}`,
    start: ymd(startYear, 4, 1),
    end: ymd(startYear + 1, 3, 31),
  };
}

export function currentFiscalStartYear(ref = new Date()) {
  const month = ref.getMonth() + 1;
  return month >= 4 ? ref.getFullYear() : ref.getFullYear() - 1;
}

export function listFiscalYears(ref = new Date(), count = 4): FiscalYear[] {
  const start = currentFiscalStartYear(ref);
  return Array.from({ length: count }, (_, i) => fiscalYearFromStartYear(start - i));
}

export function parseFiscalYearLabel(label: string): FiscalYear | null {
  const match = /^(\d{4})-(\d{4})$/.exec(label.trim());
  if (!match) return null;
  const startYear = Number(match[1]);
  const endYear = Number(match[2]);
  if (endYear !== startYear + 1) return null;
  return fiscalYearFromStartYear(startYear);
}

/** 회계연도와 겹친 달 수. 입사월·현재월을 포함하고 최대 12. */
export function monthsWorkedInFiscalYear(
  hireDate: string | null | undefined,
  fy: FiscalYear,
  asOf = new Date()
) {
  if (!hireDate) return 0;
  const hire = hireDate.slice(0, 10);
  const today = ymd(asOf.getFullYear(), asOf.getMonth() + 1, asOf.getDate());
  const rangeStart = hire > fy.start ? hire : fy.start;
  const rangeEnd = today < fy.end ? today : fy.end;
  if (rangeStart > rangeEnd) return 0;
  const [sy, sm] = rangeStart.split('-').map(Number);
  const [ey, em] = rangeEnd.split('-').map(Number);
  const months = (ey - sy) * 12 + (em - sm) + 1;
  return Math.max(0, Math.min(12, months));
}

/**
 * 12개월이면 월급 100%.
 * 연 1회는 그 금액 전액, 연 2회는 회차마다 50%.
 */
export function bonusPaymentAmount(
  monthlySalary: number,
  months: number,
  installmentsPerYear: 1 | 2
) {
  const annual = monthlySalary * (months / 12);
  const share = installmentsPerYear === 2 ? 0.5 : 1;
  return Math.round(annual * share);
}
