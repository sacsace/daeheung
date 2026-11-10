import { Op } from 'sequelize';
import EmploymentContract from '../models/EmploymentContract';
import Attendance from '../models/Attendance';
import { summarizeAttendanceOt, type AttendanceOtRow } from '../utils/attendanceOtCalculation';

/** 한국 통상적으로 월 소정근로시간 209시간(주 40시간 기준) — 시간당 급여 환산용 */
export const MONTHLY_STANDARD_HOURS = 209;

export type PeriodBounds = {
  start: string;
  end: string;
  year: number;
  month: number;
  daysInMonth: number;
};

/**
 * 급여월 문자열을 `YYYY-MM`으로 통일합니다.
 * `2026-3`, `2026-03-01`, `2026-03-01T00:00:00.000Z` 등에서 앞부분 연·월만 사용합니다.
 */
export function normalizePayrollPeriodInput(period: string): string | null {
  const s = String(period ?? '').trim();
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

/** DB에 `YYYY-MM` 또는 `YYYY-MM-DD`로 저장된 행을 같은 근무월로 조회할 때 사용 */
export function sameMonthPayrollPeriodWhere(normalizedYm: string) {
  return {
    [Op.or]: [
      { payroll_period: normalizedYm },
      { payroll_period: { [Op.like]: `${normalizedYm}-%` } }
    ]
  };
}

/** payroll_period 형식: YYYY-MM */
export function parsePayrollPeriod(period: string): PeriodBounds | null {
  const m = /^(\d{4})-(\d{2})$/.exec(String(period).trim());
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (month < 1 || month > 12) return null;
  const daysInMonth = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, '0');
  const start = `${year}-${mm}-01`;
  const end = `${year}-${mm}-${String(daysInMonth).padStart(2, '0')}`;
  return { start, end, year, month, daysInMonth };
}

/** true = 급여 근무월이 서버 달력 기준 이번 달보다 이후(미래 월) */
export function isPayrollPeriodAfterCurrentMonth(
  payrollPeriodYm: string,
  now: Date = new Date()
): boolean {
  const norm = normalizePayrollPeriodInput(payrollPeriodYm);
  if (!norm) return false;
  const bounds = parsePayrollPeriod(norm);
  if (!bounds) return false;
  const cy = now.getFullYear();
  const cm = now.getMonth() + 1;
  if (bounds.year > cy) return true;
  if (bounds.year === cy && bounds.month > cm) return true;
  return false;
}

/** 급여 기간과 겹치는 전자근로계약 1건 (서명 완료·유효 상태 우선) */
export async function findEffectiveEmploymentContract(
  tenantId: number,
  companyId: number,
  employeeId: number,
  bounds: PeriodBounds
) {
  const row = await (EmploymentContract as any).findOne({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      employee_id: employeeId,
      status: { [Op.in]: ['signed', 'active'] },
      start_date: { [Op.lte]: bounds.end },
      end_date: { [Op.gte]: bounds.start }
    },
    order: [
      ['employee_signed_at', 'DESC'],
      ['start_date', 'DESC']
    ]
  });
  return row;
}

export function computeBonusFromContract(basicSalary: number, contract: { bonus_type?: string | null; bonus_value?: unknown } | null): number {
  if (!contract) return 0;
  const t = String(contract.bonus_type || '').toLowerCase();
  const v = parseFloat(String(contract.bonus_value ?? 0)) || 0;
  if (t === 'percent') return Math.round(basicSalary * (v / 100) * 100) / 100;
  if (t === 'fixed') return Math.round(v * 100) / 100;
  return 0;
}

export async function aggregateAttendanceForPeriod(
  tenantId: number,
  companyId: number,
  userId: number,
  bounds: PeriodBounds
) {
  const rows = await (Attendance as any).findAll({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      user_id: userId,
      date: { [Op.between]: [bounds.start, bounds.end] },
      is_active: true
    },
    attributes: [
      'date',
      'work_hours',
      'status',
      'check_in',
      'check_out',
      'check_in_client_time',
      'check_out_client_time'
    ]
  });

  const mapped: AttendanceOtRow[] = rows.map((r: any) => ({
    date: r.get('date'),
    work_hours: r.get('work_hours'),
    status: r.get('status'),
    check_in: r.get('check_in'),
    check_out: r.get('check_out'),
    check_in_client_time: r.get('check_in_client_time'),
    check_out_client_time: r.get('check_out_client_time')
  }));

  return summarizeAttendanceOt(mapped);
}

/** 연장근로 가산임금: 시간당 통상임금 × 연장시간 × 1.5 (통상임금 = 월 기본급 / 209) */
export function computeOvertimePay(basicSalary: number, overtimeHours: number): number {
  if (overtimeHours <= 0 || basicSalary <= 0) return 0;
  const hourly = basicSalary / MONTHLY_STANDARD_HOURS;
  const pay = overtimeHours * hourly * 1.5;
  return Math.round(pay * 100) / 100;
}
