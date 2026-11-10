import type { PayrollGridRow } from './payrollGridTypes';
import { computeProfessionalTaxByState } from './indianProfessionalTax';
import { toProperCaseInput } from '../../../utils/textCase';
import {
  evaluatePayrollColumnFormula,
} from './payrollColumnFormula';
import {
  loadPayrollColumnPrefs,
  type PayrollCustomColumn,
} from './payrollColumnPrefs';
import {
  DEFAULT_SALARY_RATIOS,
  isSystemConstantId,
  loadPayrollSalaryRatios,
  splitPackageByRatios,
  type PayrollSalaryRatios,
} from './payrollSalaryRatios';
import {
  DEFAULT_OT_RATE_FORMULA,
  loadPayrollOtRateFormula,
  type PayrollOtRateFormula,
} from './payrollOtRateFormula';

export type { PayrollSalaryRatios };
export { DEFAULT_SALARY_RATIOS, loadPayrollSalaryRatios, splitPackageByRatios };
export type { PayrollOtRateFormula };
export { DEFAULT_OT_RATE_FORMULA, loadPayrollOtRateFormula };

export type PayrollRecalcContext = {
  /** 회사 등록 주 GST code (예: 29) */
  companyStateCode?: string | null;
  /** YYYY-MM */
  payrollMonth?: string | null;
  /** 회사별 상수·컬럼 설정용 */
  companyId?: string | number | null;
  /** 적용 중인 상수 % (있으면 localStorage보다 우선) */
  salaryRatios?: PayrollSalaryRatios;
  /** OT 요율 산식 (하루 시간·배수). 없으면 companyId localStorage */
  otRateFormula?: PayrollOtRateFormula;
  /** 해당 급여월 기본 직원 수 — 10명 초과일 때만 ESIC 자동 적용 */
  payrollEmployeeCount?: number | null;
};

function resolveOtRateFormula(ctx: PayrollRecalcContext = {}): PayrollOtRateFormula {
  if (ctx.otRateFormula) return ctx.otRateFormula;
  return loadPayrollOtRateFormula(ctx.companyId);
}

/** ESIC: 지급합계(Q) ≤ 21,000 이면 Q×0.75% / Q×3.25%, 초과 시 0 */
export const ESIC_SUM_CEILING_INR = 21000;
export const ESIC_EMPLOYEE_RATE = 0.0075;
export const ESIC_EMPLOYER_RATE = 0.0325;
/** 기본 직원이 이 인원을 넘어야(>10) ESIC 자동 적용 */
export const ESIC_MIN_EMPLOYEE_COUNT = 10;

export function isEsicApplicableByHeadcount(employeeCount?: number | null): boolean {
  if (employeeCount == null || !Number.isFinite(Number(employeeCount))) return true;
  return Number(employeeCount) > ESIC_MIN_EMPLOYEE_COUNT;
}

/** ESIC 직원 = IF(지급합계>21,000, 0, 지급합계×0.75%) — 엑셀 Q4 */
export function computeEsicEmployeeFromSumTotal(
  sumTotal: number,
  ceiling = ESIC_SUM_CEILING_INR,
  employeeCount?: number | null
): number {
  if (!isEsicApplicableByHeadcount(employeeCount)) return 0;
  const gross = Math.max(0, num(sumTotal));
  if (gross > ceiling) return 0;
  return roundInr(gross * ESIC_EMPLOYEE_RATE);
}

export function computeEsicContributions(
  sumTotal: number,
  ceiling = ESIC_SUM_CEILING_INR,
  employeeCount?: number | null
): { esic_employee: number; esic_employer: number; applicable: boolean } {
  if (!isEsicApplicableByHeadcount(employeeCount)) {
    return { esic_employee: 0, esic_employer: 0, applicable: false };
  }
  const gross = Math.max(0, num(sumTotal));
  if (gross > ceiling) {
    return { esic_employee: 0, esic_employer: 0, applicable: false };
  }
  return {
    esic_employee: roundInr(gross * ESIC_EMPLOYEE_RATE),
    esic_employer: roundInr(gross * ESIC_EMPLOYER_RATE),
    applicable: true
  };
}

const PF_BASIC_RATE = 0.12;
/** PF 상한액 (cap_1800 모드). 표기·계산 모두 이 값 사용 */
const PF_CAP_INR = 3000;
const LEGACY_DAY_SHIFT_RATE_INR = 50;

function num(v: unknown, fallback = 0): number {
  if (v === '' || v === null || v === undefined) return fallback;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

/** 인도 루피 정수 내림 (소수점 이하 제거) */
export function roundInr(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.floor(n);
}

/** 근무일수 = 월 총일 − 무급휴가 (0 ~ 월 총일로 클램프, 소수 1자리) */
export function derivedDaysWorkedFromCalendarAndUnpaid(
  totalDayOfMonth: unknown,
  unpaidLeave: unknown
): number {
  const calendarDays = Math.max(1, num(totalDayOfMonth) || 30);
  const unpaid = roundUnpaidLeave(num(unpaidLeave));
  const raw = calendarDays - unpaid;
  return Math.min(Math.max(0, roundUnpaidLeave(raw)), calendarDays);
}

/** 일용직(일당) — HeresNow/근태 실근무일을 근무일수로 유지 */
export function isDailySalaryBasisRow(
  row: Pick<PayrollGridRow, 'employment_salary_basis' | 'employment_type'> | null | undefined
): boolean {
  if (!row) return false;
  if (String(row.employment_salary_basis || '').trim() === 'daily') return true;
  return String(row.employment_type || '').trim().toLowerCase() === 'daily';
}

/** 일용직 근무일 — 저장된 실근무일(근태)을 우선, 없으면 0 */
export function resolveDailyDaysWorked(
  totalDayOfMonth: unknown,
  daysWorked: unknown
): number {
  const calendarDays = Math.max(1, num(totalDayOfMonth) || 30);
  const worked = roundUnpaidLeave(num(daysWorked));
  return Math.min(Math.max(0, worked), calendarDays);
}

const DEFAULT_FIXED_REST_DAYS = 4;

/**
 * 서비스 직군: 정기 휴무일(기본 4일)은 항상 지급일에 가산.
 * 근무일 표시는 다른 직군과 동일(달력−무급).
 * 예) 무급4·근무26 → 지급30(전액) / 무급0·근무30 → 지급34(+4일)
 */
export function fixedRestExtraPaidDays(
  _unpaidLeave: unknown,
  fixedRestDays: unknown = DEFAULT_FIXED_REST_DAYS
): number {
  const rest = Math.floor(num(fixedRestDays) || DEFAULT_FIXED_REST_DAYS);
  return Math.max(0, rest);
}

export function fixedRestPayDays(
  totalDayOfMonth: unknown,
  unpaidLeave: unknown,
  fixedRestDays: unknown = DEFAULT_FIXED_REST_DAYS
): number {
  const worked = derivedDaysWorkedFromCalendarAndUnpaid(totalDayOfMonth, unpaidLeave);
  return worked + fixedRestExtraPaidDays(unpaidLeave, fixedRestDays);
}

export function derivedDaysWorkedString(totalDayOfMonth: unknown, unpaidLeave: unknown): string {
  const n = derivedDaysWorkedFromCalendarAndUnpaid(totalDayOfMonth, unpaidLeave);
  return String(n);
}

/** 정규직 등 월급 OT/Rate = 기본급 / 26 / 하루시간 × 배수 */
export function defaultOtRateFromBasic(
  basicSalary: number,
  formula: PayrollOtRateFormula = DEFAULT_OT_RATE_FORMULA
): number {
  const basic = Math.max(0, num(basicSalary));
  if (basic <= 0) return 0;
  const hours = formula.hoursPerDay > 0 ? formula.hoursPerDay : DEFAULT_OT_RATE_FORMULA.hoursPerDay;
  const mult = formula.multiplier > 0 ? formula.multiplier : DEFAULT_OT_RATE_FORMULA.multiplier;
  return roundInr((basic / 26 / hours) * mult);
}

/** @deprecated 설정값 hoursPerDay 사용 — 호환용 기본 9 */
export const DAILY_STANDARD_WORK_HOURS = DEFAULT_OT_RATE_FORMULA.hoursPerDay;

/** 일용직 OT/Rate = 일당 / 하루시간 × 배수 */
export function defaultOtRateFromDailyWage(
  dailyWage: number,
  formula: PayrollOtRateFormula = DEFAULT_OT_RATE_FORMULA
): number {
  const daily = Math.max(0, num(dailyWage));
  if (daily <= 0) return 0;
  const hours = formula.hoursPerDay > 0 ? formula.hoursPerDay : DEFAULT_OT_RATE_FORMULA.hoursPerDay;
  const mult = formula.multiplier > 0 ? formula.multiplier : DEFAULT_OT_RATE_FORMULA.multiplier;
  return roundInr((daily / hours) * mult);
}

function splitSalaryComponentsFromTotal(
  totalSalary: number,
  ratios?: PayrollSalaryRatios
): {
  basic: number;
  hra: number;
  other: number;
} {
  const m = splitPackageByRatios(totalSalary, ratios || loadPayrollSalaryRatios());
  return {
    basic: m.basic_salary ?? 0,
    hra: m.house_rent_allowance ?? 0,
    other: m.other_allowance ?? 0,
  };
}

function readConstantPartsMap(row: PayrollGridRow): Record<string, number> {
  const raw = row.constant_parts && typeof row.constant_parts === 'object' ? row.constant_parts : {};
  const out: Record<string, number> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (isSystemConstantId(key)) continue;
    out[key] = Math.max(0, num(val));
  }
  return out;
}

function sumActiveConstantParts(
  row: PayrollGridRow,
  ratios: PayrollSalaryRatios
): {
  basic: number;
  hra: number;
  other: number;
  constant_parts: Record<string, number>;
  packageSum: number;
} {
  const constant_parts: Record<string, number> = {};
  let basic = 0;
  let hra = 0;
  let other = 0;
  let packageSum = 0;
  const existingExtra = readConstantPartsMap(row);
  for (const part of ratios.parts) {
    let amount = 0;
    if (part.id === 'basic_salary') amount = Math.max(0, num(row.basic_salary));
    else if (part.id === 'house_rent_allowance') amount = Math.max(0, num(row.house_rent_allowance));
    else if (part.id === 'other_allowance') amount = Math.max(0, num(row.other_allowance));
    else amount = Math.max(0, num(existingExtra[part.id]));

    if (part.id === 'basic_salary') basic = amount;
    else if (part.id === 'house_rent_allowance') hra = amount;
    else if (part.id === 'other_allowance') other = amount;
    else constant_parts[part.id] = amount;
    packageSum += amount;
  }
  return { basic, hra, other, constant_parts, packageSum };
}

function applySplitMapToComponents(
  split: Record<string, number>,
  ratios: PayrollSalaryRatios
): {
  basic: number;
  hra: number;
  other: number;
  constant_parts: Record<string, number>;
} {
  const constant_parts: Record<string, number> = {};
  let basic = 0;
  let hra = 0;
  let other = 0;
  for (const part of ratios.parts) {
    const amount = Math.max(0, num(split[part.id]));
    if (part.id === 'basic_salary') basic = amount;
    else if (part.id === 'house_rent_allowance') hra = amount;
    else if (part.id === 'other_allowance') other = amount;
    else constant_parts[part.id] = amount;
  }
  return { basic, hra, other, constant_parts };
}

function computeOvertimePay(
  row: Pick<PayrollGridRow, 'ot_rate' | 'day_ot_hour'>
): number {
  const rate = Math.max(0, num(row.ot_rate));
  const dayHours = Math.max(0, num(row.day_ot_hour));
  return roundInr(dayHours * rate);
}

function computeOtPayParts(otRate: number, dayHours: number): {
  day_ot_pay: number;
  night_ot_pay: number;
} {
  const rate = Math.max(0, num(otRate));
  const dayH = Math.max(0, num(dayHours));
  return {
    day_ot_pay: roundInr(dayH * rate),
    night_ot_pay: 0
  };
}

function mergeOtHours(day: unknown, night: unknown): number {
  return roundOtHour(Math.max(0, num(day)) + Math.max(0, num(night)));
}

/** 인사정보 OT 적용 대상 여부 (기본: 미적용). 직원 프로필을 extra_fields 스냅샷보다 우선 */
export function isOtEligible(
  extra?: Record<string, unknown> | null,
  employee?: Record<string, unknown> | null
): boolean {
  const parse = (value: unknown): boolean | null => {
    if (value === true || value === 'true' || value === 1 || value === '1') return true;
    if (value === false || value === 'false' || value === 0 || value === '0') return false;
    return null;
  };
  // 인사정보(현재 설정)가 급여 생성 당시 extra 스냅샷보다 우선
  const fromEmployee = employee ? parse(employee.ot_eligible) : null;
  if (fromEmployee !== null) return fromEmployee;
  const fromExtra = extra ? parse(extra.ot_eligible) : null;
  if (fromExtra !== null) return fromExtra;
  return false;
}

/** 인사정보 PT 적용 여부 (기본: 적용). 회사 GST 주 기준으로 자동 계산 */
export function isPtEligible(
  extra?: Record<string, unknown> | null,
  employee?: Record<string, unknown> | null
): boolean {
  const parse = (value: unknown): boolean | null => {
    if (value === true || value === 'true' || value === 1 || value === '1') return true;
    if (value === false || value === 'false' || value === 0 || value === '0') return false;
    return null;
  };
  const fromEmployee = employee ? parse(employee.pt_eligible) : null;
  if (fromEmployee !== null) return fromEmployee;
  const fromExtra = extra ? parse(extra.pt_eligible) : null;
  if (fromExtra !== null) return fromExtra;
  return true;
}

/** extra_fields 수동 입력 플래그 */
export function isManualOverrideFlag(
  extra: Record<string, unknown> | null | undefined,
  key: string
): boolean {
  if (!extra) return false;
  const v = extra[key];
  return v === true || v === 'true' || v === 1 || v === '1';
}

/** 수동 OT 입력 플래그 (extra_fields.ot_manual) */
export function isOtManualOverride(extra?: Record<string, unknown> | null): boolean {
  return isManualOverrideFlag(extra, 'ot_manual');
}

/** OT 적용: 대상이거나, 미대상이어도 수동 입력이 있으면 true */
export function shouldApplyOtPay(otEligible: boolean, otManual: boolean): boolean {
  return otEligible || otManual;
}

/** extra_fields → OT Rate / OT 시간 */
function resolveOtInputsFromExtra(
  x: Record<string, unknown>,
  basic: number,
  overtimePayFromApi: number,
  otEligible = false,
  otManual = false,
  formula: PayrollOtRateFormula = DEFAULT_OT_RATE_FORMULA
): { ot_rate: number; day_ot_hour: number; night_ot_hour: number } {
  const isDaily = isDailySalaryBasisRow({
    employment_salary_basis: String(x.employment_salary_basis || ''),
    employment_type: String(x.employment_type || ''),
  });
  const defaultRateForBasic = (amount: number) =>
    amount > 0
      ? isDaily
        ? defaultOtRateFromDailyWage(amount, formula)
        : defaultOtRateFromBasic(amount, formula)
      : 0;
  const defaultRate = defaultRateForBasic(basic);
  const rateManual = isManualOverrideFlag(x, 'ot_rate_manual');
  const storedManualRate = Math.max(0, Math.floor(num(x.ot_rate)));

  // 미적용: 자동(근태) OT는 무시. 수동 입력이 있을 때만 day_ot_hour 사용.
  if (!otEligible) {
    if (!otManual) {
      return {
        ot_rate: rateManual ? storedManualRate : defaultRate,
        day_ot_hour: 0,
        night_ot_hour: 0,
      };
    }
    let otRate = rateManual ? storedManualRate : num(x.ot_rate);
    if (!rateManual && otRate <= 0) otRate = defaultRate;
    return {
      ot_rate: otRate,
      day_ot_hour: mergeOtHours(x.day_ot_hour, x.night_ot_hour),
      night_ot_hour: 0,
    };
  }

  const hasHourFields =
    Object.prototype.hasOwnProperty.call(x, 'day_ot_hour') ||
    Object.prototype.hasOwnProperty.call(x, 'night_ot_hour') ||
    Object.prototype.hasOwnProperty.call(x, 'ot_rate');

  if (hasHourFields) {
    let otRate = rateManual ? storedManualRate : num(x.ot_rate);
    if (!rateManual && otRate <= 0 && basic > 0) {
      otRate = defaultRateForBasic(basic);
    }
    return {
      ot_rate: otRate,
      day_ot_hour: mergeOtHours(x.day_ot_hour, x.night_ot_hour),
      night_ot_hour: 0
    };
  }

  const hasAttendanceOt =
    Object.prototype.hasOwnProperty.call(x, 'attendance_day_ot_hours') ||
    Object.prototype.hasOwnProperty.call(x, 'attendance_night_ot_hours');
  if (hasAttendanceOt) {
    let otRate = num(x.ot_rate);
    if (otRate <= 0 && basic > 0) {
      otRate = defaultRateForBasic(basic);
    }
    return {
      ot_rate: otRate,
      day_ot_hour: mergeOtHours(x.attendance_day_ot_hours, x.attendance_night_ot_hours),
      night_ot_hour: 0
    };
  }

  const attendanceOtTotal = num(x.attendance_overtime_hours);
  if (attendanceOtTotal > 0) {
    let otRate = num(x.ot_rate);
    if (otRate <= 0 && basic > 0) {
      otRate = defaultRateForBasic(basic);
    }
    return {
      ot_rate: otRate,
      day_ot_hour: roundOtHour(attendanceOtTotal),
      night_ot_hour: 0
    };
  }

  const hasAmountFields =
    Object.prototype.hasOwnProperty.call(x, 'day_ot') ||
    Object.prototype.hasOwnProperty.call(x, 'night_ot');
  if (hasAmountFields) {
    let otRate = num(x.ot_rate);
    if (otRate <= 0 && basic > 0) {
      otRate = defaultRateForBasic(basic);
    }
    const dayAmt = Math.max(0, num(x.day_ot));
    const nightAmt = Math.max(0, num(x.night_ot));
    if (otRate > 0) {
      return {
        ot_rate: otRate,
        day_ot_hour: roundOtHour((dayAmt + nightAmt) / otRate),
        night_ot_hour: 0
      };
    }
    return { ot_rate: 0, day_ot_hour: 0, night_ot_hour: 0 };
  }

  const otHour = num(x.ot_hour);
  let otRate = num(x.ot_rate);
  const dayShift = num(x.day_shift);
  const nightShift = num(x.night_shift);
  const hasLegacy =
    otHour > 0 ||
    otRate > 0 ||
    dayShift > 0 ||
    nightShift > 0 ||
    Object.prototype.hasOwnProperty.call(x, 'ot_hour') ||
    Object.prototype.hasOwnProperty.call(x, 'ot_rate') ||
    Object.prototype.hasOwnProperty.call(x, 'day_shift') ||
    Object.prototype.hasOwnProperty.call(x, 'night_shift');

  if (hasLegacy) {
    if (otRate <= 0 && basic > 0) {
      otRate = defaultRateForBasic(basic);
    }
    const dayAmt = roundInr(otHour * otRate + dayShift * LEGACY_DAY_SHIFT_RATE_INR);
    const nightAmt = Math.max(0, nightShift);
    if (otRate > 0) {
      return {
        ot_rate: otRate,
        day_ot_hour: roundOtHour((dayAmt + nightAmt) / otRate),
        night_ot_hour: 0
      };
    }
    return { ot_rate: 0, day_ot_hour: 0, night_ot_hour: 0 };
  }

  const apiOt = Math.max(0, num(overtimePayFromApi));
  return {
    ot_rate: defaultRate,
    day_ot_hour: defaultRate > 0 ? roundOtHour(apiOt / defaultRate) : 0,
    night_ot_hour: 0
  };
}

export type PfMode = 'basic_12pct' | 'gross_6pct' | 'epf_12pct_half';

/** PF 계산 방식 (인사정보). 기본 cap_1800 */
export type UserPfCalcMode = 'cap_1800' | 'basic_12pct' | 'total_12pct' | 'none';

/** PF 직원·사업주 — 모드별 산정 */
export function computePfContributions(
  basicSalary: number,
  mode: UserPfCalcMode | boolean = 'cap_1800',
  totalSalary = 0
): { pf_employee: number; pf_employer: number } {
  const resolved: UserPfCalcMode =
    mode === true || mode === 'cap_1800'
      ? 'cap_1800'
      : mode === false || mode === 'basic_12pct'
        ? 'basic_12pct'
        : mode === 'total_12pct'
          ? 'total_12pct'
          : mode === 'none'
            ? 'none'
            : 'cap_1800';
  if (resolved === 'none') {
    return { pf_employee: 0, pf_employer: 0 };
  }
  if (resolved === 'total_12pct') {
    // 총급여×12% 를 직원·사업주가 반반 (각 6%)
    const totalPf = Math.round(Math.max(0, num(totalSalary)) * PF_BASIC_RATE);
    const pf_employee = Math.round(totalPf / 2);
    const pf_employer = totalPf - pf_employee;
    return { pf_employee, pf_employer };
  }
  const basic = Math.max(0, num(basicSalary));
  const raw = basic * PF_BASIC_RATE;
  const amount = Math.round(resolved === 'cap_1800' ? Math.min(raw, PF_CAP_INR) : raw);
  return { pf_employee: amount, pf_employer: amount };
}

/** 인사정보 PF 계산 방식 (기본 cap_1800). 직원 프로필을 extra 스냅샷보다 우선 */
export function resolvePfCalcMode(
  extra?: Record<string, unknown> | null,
  employee?: Record<string, unknown> | null
): UserPfCalcMode {
  const parse = (value: unknown): UserPfCalcMode | null => {
    if (value === false || value === 'false' || value === 0 || value === '0') return 'basic_12pct';
    if (value === true || value === 'true' || value === 1 || value === '1') return 'cap_1800';
    const s = String(value ?? '').trim();
    if (s === 'cap_1800' || s === 'basic_12pct' || s === 'total_12pct' || s === 'none') return s;
    return null;
  };
  const fromEmployee = employee
    ? parse(employee.pf_calc_mode ?? employee.pf_cap_1800)
    : null;
  if (fromEmployee !== null) return fromEmployee;
  const fromExtra = extra ? parse(extra.pf_calc_mode ?? extra.pf_cap_1800) : null;
  if (fromExtra !== null) return fromExtra;
  return 'cap_1800';
}

/** @deprecated resolvePfCalcMode 사용 */
export function isPfCap1800(
  extra?: Record<string, unknown> | null,
  employee?: Record<string, unknown> | null
): boolean {
  return resolvePfCalcMode(extra, employee) === 'cap_1800';
}

function resolvePfModeFromExtra(x: Record<string, unknown>): PfMode {
  const raw = String(x.indian_pf_mode ?? '').trim();
  if (raw === 'gross_6pct') return 'gross_6pct';
  if (raw === 'epf_12pct_half') return 'epf_12pct_half';
  return 'basic_12pct';
}

/**
 * 엑셀 Salary Details 시트 기준 재계산
 * - Total Salary = Basic 50% + HRA 30% + Other Allowance 20%
 * - Sum Total = (근무일 × Total Salary / 월총일) + OT + Extra Allowance
 * - OT Rate = Basic Salary ÷ 26 ÷ 8 × 2
 * - OT = 주간 OT시간 × OT Rate
 * - PF(직원·사업주) = ROUND(MIN(Basic Salary × 12%, 3,000), 0) — 인사정보에서 상한 해제 시 12%만 적용 (pf_manual 시 유지)
 * - ESIC(직원) = IF(지급합계>21,000, 0, 지급합계×0.75%)
 * - TDS = 신규 세제 LET 수식… / 12 (tds_manual 시 유지)
 * - PT = 지급합계 > 25,000 일 때만 주별 슬랩(또는 200) 적용, 이하이면 0 (pt_manual 시 유지)
 * - Net = Sum Total − PF(직원) − ESIC(직원) − TDS − PT − 선지급
 */
function slabTax(taxable: number, cap: number, floor: number, rate: number): number {
  return Math.max(0, Math.min(taxable, cap) - floor) * rate;
}

/**
 * 엑셀 LET TDS — AB4 = 월 지급 합계(sum_total)
 * ROUND(TaxAfterRelief * 1.04 / 12, 0)
 */
export function computeMonthlyTdsFromSumTotal(monthlySumTotal: number): number {
  const monthly = Math.max(0, num(monthlySumTotal));
  if (monthly <= 0) return 0;

  const annual = monthly * 12;
  const taxable = Math.max(0, annual - 75000);

  const baseTax =
    slabTax(taxable, 800000, 400000, 0.05) +
    slabTax(taxable, 1200000, 800000, 0.1) +
    slabTax(taxable, 1600000, 1200000, 0.15) +
    slabTax(taxable, 2000000, 1600000, 0.2) +
    slabTax(taxable, 2400000, 2000000, 0.25) +
    Math.max(0, taxable - 2400000) * 0.3;

  const taxAfterRebate = taxable <= 1200000 ? 0 : baseTax;

  let taxAfterRelief = taxAfterRebate;
  if (taxable > 1200000 && taxAfterRebate * 1.04 > taxable - 1200000) {
    taxAfterRelief = (taxable - 1200000) / 1.04;
  }

  return Math.round((taxAfterRelief * 1.04) / 12);
}

export type PayrollRecalcOptions = {
  /**
   * true: 급여 합계 셀을 편집한 경우.
   * 합계 전체를 저장된 % 비율로 상수 항목에 분배.
   */
  preferTotalSplit?: boolean;
  /** 분배에 사용할 비율 (미지정 시 localStorage) */
  salaryRatios?: PayrollSalaryRatios;
};

/** 셀 편집 후: 합계만 바뀌었으면 preferTotalSplit */
export function shouldPreferTotalSplit(
  oldRow: PayrollGridRow,
  newRow: PayrollGridRow
): boolean {
  const totalChanged = num(oldRow.total_salary) !== num(newRow.total_salary);
  if (!totalChanged) return false;
  const oldExtra = readConstantPartsMap(oldRow);
  const newExtra = readConstantPartsMap(newRow);
  const extraKeys: string[] = Object.keys(oldExtra);
  const newKeys = Object.keys(newExtra);
  for (let i = 0; i < newKeys.length; i += 1) {
    if (extraKeys.indexOf(newKeys[i]) < 0) extraKeys.push(newKeys[i]);
  }
  let extraChanged = false;
  for (let i = 0; i < extraKeys.length; i += 1) {
    const k = extraKeys[i];
    if (num(oldExtra[k]) !== num(newExtra[k])) {
      extraChanged = true;
      break;
    }
  }
  const componentChanged =
    num(oldRow.basic_salary) !== num(newRow.basic_salary) ||
    num(oldRow.house_rent_allowance) !== num(newRow.house_rent_allowance) ||
    num(oldRow.other_allowance) !== num(newRow.other_allowance) ||
    extraChanged;
  return !componentChanged;
}

export function applySalaryRatiosToRow(
  row: PayrollGridRow,
  ratios: PayrollSalaryRatios,
  ctx: PayrollRecalcContext = {}
): PayrollGridRow {
  const totalSalaryInput = num(row.total_salary);
  const current = sumActiveConstantParts(row, ratios);
  const packageBase = totalSalaryInput > 0 ? totalSalaryInput : current.packageSum;
  const split = splitPackageByRatios(packageBase, ratios);
  const applied = applySplitMapToComponents(split, ratios);
  return recalculatePayrollRow(
    {
      ...row,
      basic_salary: applied.basic,
      house_rent_allowance: applied.hra,
      other_allowance: applied.other,
      constant_parts: applied.constant_parts,
      food_allowance: 0,
      total_salary: packageBase,
    },
    ctx,
    { preferTotalSplit: false, salaryRatios: ratios }
  );
}

function isCountFormulaColumn(col: PayrollCustomColumn): boolean {
  return col.inputMode === 'count' && Boolean(String(col.formula || '').trim());
}

/** 커스텀 수당 — count+formula 컬럼은 횟수→금액 변환 */
export function resolveCustomAllowanceAmounts(
  row: Pick<PayrollGridRow, 'custom_allowances' | 'custom_allowance_inputs'>,
  customColumns: PayrollCustomColumn[]
): {
  custom_allowances: Record<string, number>;
  custom_allowance_inputs: Record<string, number>;
  customSum: number;
} {
  const rawInputs =
    row.custom_allowance_inputs && typeof row.custom_allowance_inputs === 'object'
      ? row.custom_allowance_inputs
      : {};
  const rawAmounts =
    row.custom_allowances && typeof row.custom_allowances === 'object'
      ? row.custom_allowances
      : {};

  const custom_allowance_inputs: Record<string, number> = {};
  const custom_allowances: Record<string, number> = {};
  let customSum = 0;

  for (const col of customColumns) {
    if (isCountFormulaColumn(col)) {
      const inputN = Math.max(0, num(rawInputs[col.id] ?? rawAmounts[col.id]));
      custom_allowance_inputs[col.id] = inputN;
      const amount = evaluatePayrollColumnFormula(col.formula, inputN);
      custom_allowances[col.id] = amount;
      customSum += amount;
    }
  }

  for (const col of customColumns) {
    if (isCountFormulaColumn(col)) continue;
    const amount = Math.max(0, num(rawAmounts[col.id]));
    custom_allowances[col.id] = amount;
    customSum += amount;
  }

  for (const [key, val] of Object.entries(rawAmounts)) {
    if (Object.prototype.hasOwnProperty.call(custom_allowances, key)) continue;
    const amount = Math.max(0, num(val));
    custom_allowances[key] = amount;
    customSum += amount;
  }

  for (const [key, val] of Object.entries(rawInputs)) {
    if (Object.prototype.hasOwnProperty.call(custom_allowance_inputs, key)) continue;
    custom_allowance_inputs[key] = Math.max(0, num(val));
  }

  return { custom_allowances, custom_allowance_inputs, customSum };
}

export function recalculatePayrollRow(
  row: PayrollGridRow,
  ctx: PayrollRecalcContext = {},
  opts: PayrollRecalcOptions = {}
): PayrollGridRow {
  const ratios =
    opts.salaryRatios ||
    ctx.salaryRatios ||
    loadPayrollSalaryRatios(ctx.companyId);
  const columnPrefs = loadPayrollColumnPrefs(ctx.companyId);
  const { custom_allowances: customAllowances, custom_allowance_inputs, customSum } =
    resolveCustomAllowanceAmounts(row, columnPrefs.customColumns);
  const totalSalaryInput = num(row.total_salary);
  const rowSalaryBasis = String(row.employment_salary_basis || '').trim();
  const isDaily = rowSalaryBasis === 'daily' || isDailySalaryBasisRow(row);
  const isFixedRest = rowSalaryBasis === 'fixed_rest_monthly';

  let basic: number;
  let hra: number;
  let otherAllowance: number;
  let constant_parts: Record<string, number>;

  if (isDaily) {
    // 일용직: 급여 합계 = 일당. 기본급에만 두고 HRA·상수 분해 없음.
    const dailyRate = Math.max(0, roundInr(totalSalaryInput > 0 ? totalSalaryInput : num(row.basic_salary)));
    basic = dailyRate;
    hra = 0;
    otherAllowance = 0;
    constant_parts = {};
  } else if (opts.preferTotalSplit && totalSalaryInput > 0) {
    const packageBase = Math.max(0, roundInr(totalSalaryInput));
    const split = splitPackageByRatios(packageBase, ratios);
    const applied = applySplitMapToComponents(split, ratios);
    basic = applied.basic;
    hra = applied.hra;
    otherAllowance = applied.other;
    constant_parts = applied.constant_parts;
  } else {
    const current = sumActiveConstantParts(row, ratios);
    basic = current.basic;
    hra = current.hra;
    otherAllowance = current.other;
    constant_parts = current.constant_parts;
  }

  // 급여 합계 = 상수 영역(기본급·주거·기타·추가 상수) 금액의 합. 식대 컬럼/추가수당 제외.
  const foodAllowance = 0;
  const packageSum = roundInr(
    basic + hra + otherAllowance + Object.values(constant_parts).reduce((s, v) => s + num(v), 0)
  );
  const totalSalary = packageSum;

  const calendarDays = Math.max(1, num(row.total_day_of_month) || 30);
  const fixedRestDays =
    row.fixed_rest_days != null && Number.isFinite(num(row.fixed_rest_days))
      ? Math.floor(num(row.fixed_rest_days))
      : DEFAULT_FIXED_REST_DAYS;
  // 일용직: HeresNow/근태 실근무일 유지. 그 외·서비스: 표시 근무일 = 월총일 − 무급휴가
  let worked: number;
  let unpaidNormalized: number;
  if (isDaily) {
    worked = resolveDailyDaysWorked(row.total_day_of_month, row.days_worked);
    unpaidNormalized = roundUnpaidLeave(calendarDays - worked);
  } else {
    unpaidNormalized = roundUnpaidLeave(num(row.unpaid_leave));
    worked = derivedDaysWorkedFromCalendarAndUnpaid(row.total_day_of_month, unpaidNormalized);
  }
  const days_worked = String(worked);
  const unpaid_leave = String(unpaidNormalized);

  // 일용직: OT Rate = 일당 / 하루시간 × 배수. 월급: 기본급 / 26 / 하루시간 × 배수.
  const otFormula = resolveOtRateFormula(ctx);
  const defaultOtRate = isDaily
    ? defaultOtRateFromDailyWage(totalSalary, otFormula)
    : basic > 0
      ? defaultOtRateFromBasic(basic, otFormula)
      : 0;
  const otRateManual = Boolean(row.ot_rate_manual);
  const otRate = otRateManual ? Math.max(0, Math.floor(num(row.ot_rate))) : defaultOtRate;
  const otEligible = row.ot_eligible === true;
  const otManual = Boolean(row.ot_manual);
  const applyOt = shouldApplyOtPay(otEligible, otManual);
  const dayOtHour = applyOt ? roundOtHour(num(row.day_ot_hour)) : 0;
  const overtime = computeOvertimePay({
    ot_rate: otRate,
    day_ot_hour: dayOtHour
  });
  const transport = 0;
  // 일용직: 일당 × 근무일. 서비스: 무급 0이면 +4일 지급. 그 외는 월급 비례.
  const payDays = isFixedRest
    ? fixedRestPayDays(row.total_day_of_month, unpaidNormalized, fixedRestDays)
    : worked;
  const proratedPackage = isDaily
    ? roundInr(totalSalary * worked)
    : roundInr((totalSalary * payDays) / calendarDays);
  const sum_total = roundInr(proratedPackage + overtime + transport + customSum);

  const pfCalcMode = row.pf_calc_mode ?? 'cap_1800';
  const pfManual = Boolean(row.pf_manual);
  let pfEmployeeStr: string;
  let pfEmployerStr: string;
  if (pfManual) {
    const pfEmployee = Math.max(0, Math.floor(num(row.pf_employee)));
    pfEmployeeStr = String(pfEmployee);
    // 사측 PF는 직원 PF와 동일 매칭 (수동 입력 시에도 동일 규칙)
    pfEmployerStr = String(pfEmployee);
  } else {
    // 일용직 PF: 기본분=일당×근무일, 패키지=일당×달력일(월 환산)
    const pfBasic = isDaily ? proratedPackage : basic;
    const pfPackage = isDaily ? roundInr(totalSalary * calendarDays) : totalSalary;
    const pf = computePfContributions(pfBasic, pfCalcMode, pfPackage);
    pfEmployeeStr = String(pf.pf_employee);
    pfEmployerStr = String(pf.pf_employer);
  }

  const esicManual = Boolean(row.esic_manual);
  let esicEmployeeStr: string;
  let esicEmployerStr: string;
  if (esicManual) {
    esicEmployeeStr = String(Math.max(0, Math.floor(num(row.esic_employee))));
    esicEmployerStr = String(Math.max(0, Math.floor(num(row.esic_employer))));
  } else {
    const esic = computeEsicContributions(sum_total, ESIC_SUM_CEILING_INR, ctx.payrollEmployeeCount);
    esicEmployeeStr = String(esic.esic_employee);
    esicEmployerStr = String(esic.esic_employer);
  }

  const esicE = num(esicEmployeeStr);
  const tdsManual = Boolean(row.tds_manual);
  const tds = tdsManual
    ? Math.max(0, Math.floor(num(row.tds)))
    : computeMonthlyTdsFromSumTotal(sum_total);
  const ptEligible = row.pt_eligible !== false;
  const ptManual = Boolean(row.pt_manual);
  const pt = ptManual
    ? Math.max(0, Math.floor(num(row.pt)))
    : ptEligible
      ? computeProfessionalTaxByState({
          grossMonthly: sum_total,
          stateCode: ctx.companyStateCode,
          payrollMonth: ctx.payrollMonth ?? row.working_month,
        })
      : 0;
  const other = Math.max(0, num(row.deduct_this_month));
  const net_salary_payable = roundInr(sum_total - num(pfEmployeeStr) - esicE - tds - pt - other);

  return {
    ...row,
    basic_salary: basic,
    house_rent_allowance: hra,
    other_allowance: otherAllowance,
    food_allowance: foodAllowance,
    constant_parts,
    custom_allowances: customAllowances,
    custom_allowance_inputs,
    total_salary: totalSalary,
    unpaid_leave,
    days_worked,
    employment_salary_basis: isDaily
      ? 'daily'
      : isFixedRest
        ? 'fixed_rest_monthly'
        : row.employment_salary_basis,
    fixed_rest_days: isFixedRest ? fixedRestDays : row.fixed_rest_days,
    ot_rate: otRate,
    day_ot_hour: dayOtHour,
    night_ot_hour: 0,
    ot_eligible: otEligible,
    ot_manual: otManual && dayOtHour > 0,
    ot_rate_manual: otRateManual,
    overtime,
    transport_allowance: 0,
    sum_total,
    pf_calc_mode: pfCalcMode,
    pf_manual: pfManual,
    pf_employee: pfEmployeeStr,
    pf_employer: pfEmployerStr,
    esic_manual: esicManual,
    esic_employee: esicEmployeeStr,
    esic_employer: esicEmployerStr,
    tds_manual: tdsManual,
    tds,
    pt_manual: ptManual,
    pt: String(pt),
    pt_eligible: ptEligible,
    deduct_this_month: other,
    net_salary_payable
  };
}

/** 표시용 천 단위 콤마 — 정수 내림 */
export function formatNumberDisplay(value: unknown): string {
  if (value === '' || value === null || value === undefined) return '';
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
  if (!Number.isFinite(n)) return String(value ?? '');
  return Math.floor(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export function formatMaybeNumericString(value: unknown): string {
  if (value === '' || value === null || value === undefined) return '';
  const n = parseFloat(String(value).replace(/,/g, ''));
  if (Number.isFinite(n)) {
    return Math.floor(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }
  return String(value);
}

function stripCommaField(s: string): string {
  return String(s).replace(/,/g, '').trim();
}

/** OT 시간 — 소수점 이하 1자리 */
export function roundOtHour(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, n) * 10) / 10;
}

/** 무급휴가·근무일수 — 소수점 이하 1자리 */
export function roundUnpaidLeave(n: number): number {
  return roundOtHour(n);
}

export function formatOtHourDisplay(value: unknown): string {
  if (value === '' || value === null || value === undefined) return '';
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
  if (!Number.isFinite(n)) return String(value ?? '');
  return roundOtHour(n).toLocaleString('en-IN', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
}

export function formatUnpaidLeaveDisplay(value: unknown): string {
  return formatOtHourDisplay(value);
}

export const otHourEditProps = {
  type: 'number' as const,
  valueFormatter: (value: unknown) => formatOtHourDisplay(value),
  valueParser: (value: unknown) => {
    if (value === '' || value == null) return 0;
    const n = parseFloat(String(value).replace(/,/g, ''));
    return Number.isFinite(n) ? roundOtHour(n) : 0;
  }
};

export const unpaidLeaveEditProps = {
  type: 'number' as const,
  valueFormatter: (value: unknown) => formatUnpaidLeaveDisplay(value),
  valueParser: (value: unknown) => {
    if (value === '' || value == null) return 0;
    const n = parseFloat(String(value).replace(/,/g, ''));
    return Number.isFinite(n) ? roundUnpaidLeave(n) : 0;
  }
};

export const countEditProps = {
  type: 'number' as const,
  valueFormatter: (value: unknown) => {
    if (value === '' || value == null) return '0';
    const n = parseFloat(String(value).replace(/,/g, ''));
    if (!Number.isFinite(n)) return '0';
    return String(Math.max(0, Math.floor(n)));
  },
  valueParser: (value: unknown) => {
    if (value === '' || value == null) return 0;
    const n = parseFloat(String(value).replace(/,/g, ''));
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  },
};

export const numberEditProps = {
  type: 'number' as const,
  valueFormatter: (value: unknown) => formatNumberDisplay(value),
  valueParser: (value: unknown) => {
    if (value === '' || value == null) return 0;
    const n = parseFloat(String(value).replace(/,/g, ''));
    return Number.isFinite(n) ? Math.floor(n) : 0;
  }
};

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function ex(p: Record<string, unknown> | null | undefined, key: string): string {
  if (!p || typeof p !== 'object') return '';
  return str((p as Record<string, unknown>)[key]);
}

/** 입사일 ~ 급여 근무월 말일 기준 근속 개월수 (입사일이 근무월 이후면 0) */
export function computeTenureMonths(joiningDateStr: string, workingMonthYm: string): number {
  const j = String(joiningDateStr || '')
    .trim()
    .split('T')[0];
  const wm = String(workingMonthYm || '').trim();
  if (!j || !wm) return 0;
  const jd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(j);
  const pm = /^(\d{4})-(\d{2})$/.exec(wm);
  if (!jd || !pm) return 0;
  const jy = parseInt(jd[1], 10);
  const jmo = parseInt(jd[2], 10) - 1;
  const jDay = parseInt(jd[3], 10);
  const py = parseInt(pm[1], 10);
  const pmo = parseInt(pm[2], 10) - 1;
  const periodEnd = new Date(py, pmo + 1, 0);
  const join = new Date(jy, jmo, jDay);
  if (join > periodEnd) return 0;
  let months =
    (periodEnd.getFullYear() - join.getFullYear()) * 12 + (periodEnd.getMonth() - join.getMonth());
  if (periodEnd.getDate() < join.getDate()) months -= 1;
  return Math.max(0, months);
}

export function payrollRecordToGridRow(
  p: any,
  index: number,
  ctx: PayrollRecalcContext = {}
): PayrollGridRow {
  const x = (p.extra_fields && typeof p.extra_fields === 'object' ? p.extra_fields : {}) as Record<
    string,
    unknown
  >;
  const emp = p.employee || {};
  const joining =
    ex(x, 'joining_date') || (emp.hire_date ? String(emp.hire_date).split('T')[0] : '');
  const workingMonth = ex(x, 'working_month') || str(p.payroll_period);

  const ratios = loadPayrollSalaryRatios(ctx.companyId);
  const constRaw = x.constant_parts;
  const constant_parts: Record<string, number> = {};
  if (constRaw && typeof constRaw === 'object' && !Array.isArray(constRaw)) {
    for (const [key, val] of Object.entries(constRaw as Record<string, unknown>)) {
      if (isSystemConstantId(key)) continue;
      constant_parts[key] = Math.max(0, num(val));
    }
  }

  /**
   * 급여 생성 시 DB basic_salary = 패키지 전체(프로필/계약 급여).
   * 일용직은 basic_salary = 일당(하루 금액). 상수 % 분해하지 않는다.
   * extra에 상수 분해(total_salary / HRA / 기타 / constant_parts)가 있으면 그 값을 쓰고,
   * 없으면 패키지 전체를 회사 상수 %로 분배한다.
   */
  const packageFromDb = num(p.basic_salary);
  const salaryBasisEarly = String(ex(x, 'employment_salary_basis') || '').trim();
  const isDailyRow = salaryBasisEarly === 'daily';
  const dailyWageFromExtra = num(ex(x, 'daily_wage'));
  const storedTotal = num(ex(x, 'total_salary'));
  const hraInitial = num(ex(x, 'house_rent_allowance'));
  let otherAllowance = num(ex(x, 'other_allowance'));
  const legacyFood = Math.max(0, num(ex(x, 'food_allowance')));
  if (legacyFood > 0) otherAllowance = roundInr(otherAllowance + legacyFood);

  const hasSavedBreakdown =
    storedTotal > 0 ||
    hraInitial > 0 ||
    otherAllowance > 0 ||
    Object.keys(constant_parts).length > 0;

  let basic: number;
  let hra: number;
  let totalSalary: number;

  if (isDailyRow) {
    // 일용직: 금액 필드 = 일당. HRA·기타 상수 분해 없음.
    const dailyRate =
      dailyWageFromExtra > 0 ? dailyWageFromExtra : packageFromDb > 0 ? packageFromDb : storedTotal;
    basic = dailyRate;
    hra = 0;
    otherAllowance = 0;
    totalSalary = dailyRate;
    for (const key of Object.keys(constant_parts)) delete constant_parts[key];
  } else if (!hasSavedBreakdown && packageFromDb > 0) {
    // 신규/미분해: DB basic_salary = 패키지 전체 → 상수 %로 분배. 급여 합계 = 패키지.
    totalSalary = packageFromDb;
    const split = splitPackageByRatios(totalSalary, ratios);
    const applied = applySplitMapToComponents(split, ratios);
    basic = applied.basic;
    hra = applied.hra;
    otherAllowance = applied.other;
    Object.assign(constant_parts, applied.constant_parts);
  } else {
    // 이미 상수 분해가 저장된 경우: 급여 합계 = 상수 항목 합
    basic = packageFromDb;
    hra = hraInitial;
    const partsSum = roundInr(
      basic +
        hra +
        otherAllowance +
        Object.values(constant_parts).reduce((s, v) => s + num(v), 0)
    );
    totalSalary = partsSum > 0 ? partsSum : storedTotal > 0 ? storedTotal : packageFromDb;
  }

  const foodAllowance = 0;

  const otEligible = isOtEligible(x, emp);
  const otManual = isOtManualOverride(x);
  const otRateManual = isManualOverrideFlag(x, 'ot_rate_manual');
  const ptEligible = isPtEligible(x, emp);
  const pfManual = isManualOverrideFlag(x, 'pf_manual');
  const tdsManual = isManualOverrideFlag(x, 'tds_manual');
  const ptManual = isManualOverrideFlag(x, 'pt_manual');
  const esicManual = isManualOverrideFlag(x, 'esic_manual');
  const pfCalcMode = resolvePfCalcMode(x, emp);
  const { ot_rate: otRateInitial, day_ot_hour: dayOtHour } = resolveOtInputsFromExtra(
    x,
    basic,
    num(p.overtime_pay),
    otEligible,
    otManual,
    resolveOtRateFormula(ctx)
  );
  const transport = num(ex(x, 'transport_allowance'));
  const indianPfMode = resolvePfModeFromExtra(x);
  const customRaw = x.custom_allowances;
  const custom_allowances: Record<string, number> = {};
  if (customRaw && typeof customRaw === 'object' && !Array.isArray(customRaw)) {
    for (const [key, val] of Object.entries(customRaw as Record<string, unknown>)) {
      custom_allowances[key] = Math.max(0, num(val));
    }
  }
  const customInputsRaw = x.custom_allowance_inputs;
  const custom_allowance_inputs: Record<string, number> = {};
  if (customInputsRaw && typeof customInputsRaw === 'object' && !Array.isArray(customInputsRaw)) {
    for (const [key, val] of Object.entries(customInputsRaw as Record<string, unknown>)) {
      custom_allowance_inputs[key] = Math.max(0, num(val));
    }
  }

  const advance = num(p.deductions);
  const salaryBasis = String(ex(x, 'employment_salary_basis') || '').trim();
  const isFixedRestRow = salaryBasis === 'fixed_rest_monthly';
  const fixedRestFromExtra = Math.floor(num(ex(x, 'fixed_rest_days')));
  const fixedRestDays =
    Number.isFinite(fixedRestFromExtra) && fixedRestFromExtra >= 0
      ? fixedRestFromExtra
      : DEFAULT_FIXED_REST_DAYS;
  const employmentType = String(
    ex(x, 'employment_type') || (emp as any).employment_type || ''
  ).trim();
  const isDailyForDays =
    isDailyRow || salaryBasis === 'daily' || employmentType.toLowerCase() === 'daily';
  const storedDaysWorkedRaw = ex(x, 'days_worked');
  const initialDaysWorked = isDailyForDays
    ? String(
        resolveDailyDaysWorked(
          ex(x, 'total_day_of_month'),
          storedDaysWorkedRaw !== '' ? storedDaysWorkedRaw : 0
        )
      )
    : derivedDaysWorkedString(ex(x, 'total_day_of_month'), ex(x, 'unpaid_leave'));
  const initialUnpaidLeave = isDailyForDays
    ? String(
        roundUnpaidLeave(
          Math.max(1, num(ex(x, 'total_day_of_month')) || 30) - num(initialDaysWorked)
        )
      )
    : ex(x, 'unpaid_leave');

  const row: PayrollGridRow = {
    id: p.id,
    row_no: index + 1,
    emp_id: String(ex(x, 'emp_id') || str(emp.employee_number) || '').trim().toUpperCase(),
    bank_account: ex(x, 'bank_account'),
    ifsc: ex(x, 'ifsc'),
    bank_name: toProperCaseInput(ex(x, 'bank_name')),
    employee_email: str(emp.email),
    department: toProperCaseInput(ex(x, 'department') || str(emp.department)),
    employee_name: toProperCaseInput(ex(x, 'employee_name') || str(emp.username)),
    position: toProperCaseInput(ex(x, 'position') || str(emp.position)),
    birth_date: ex(x, 'birth_date') || (emp.birth_date ? String(emp.birth_date).split('T')[0] : ''),
    joining_date: joining,
    employment_type: employmentType,
    working_month: workingMonth,
    basic_salary: basic,
    house_rent_allowance: hra,
    other_allowance: otherAllowance,
    food_allowance: foodAllowance,
    constant_parts,
    custom_allowances,
    custom_allowance_inputs,
    total_salary: totalSalary,
    total_day_of_month: ex(x, 'total_day_of_month'),
    unpaid_leave: initialUnpaidLeave,
    days_worked: initialDaysWorked,
    employment_salary_basis: salaryBasis || (isDailyForDays ? 'daily' : undefined),
    fixed_rest_days: isFixedRestRow ? fixedRestDays : undefined,
    ot_rate: otRateInitial,
    day_ot_hour: dayOtHour,
    night_ot_hour: 0,
    ot_eligible: otEligible,
    ot_manual: otManual && dayOtHour > 0,
    ot_rate_manual: otRateManual,
    pt_eligible: ptEligible,
    pf_manual: pfManual,
    tds_manual: tdsManual,
    pt_manual: ptManual,
    esic_manual: esicManual,
    transport_allowance: transport,
    overtime: 0,
    sum_total: num(p.gross_salary),
    indian_pf_mode: indianPfMode,
    pf_calc_mode: pfCalcMode,
    pf_employee: ex(x, 'pf_employee'),
    pf_employer: ex(x, 'pf_employer'),
    esic_employee: ex(x, 'esic_employee'),
    esic_employer: ex(x, 'esic_employer'),
    tds: num(p.tax_amount),
    pt: ex(x, 'pt'),
    deduct_this_month: advance,
    net_salary_payable: num(p.net_salary),
    actions: ''
  };

  return recalculatePayrollRow(row, ctx);
}

export function gridRowToPayload(
  row: PayrollGridRow,
  ctx: PayrollRecalcContext = {}
): Record<string, unknown> {
  const recalculated = recalculatePayrollRow(row, ctx, {
    salaryRatios: ctx.salaryRatios,
  });
  const otPay = computeOtPayParts(
    recalculated.ot_rate,
    recalculated.day_ot_hour
  );
  const extra_fields = {
    emp_id: recalculated.emp_id,
    bank_account: recalculated.bank_account,
    ifsc: recalculated.ifsc,
    bank_name: recalculated.bank_name,
    department: recalculated.department,
    employee_name: recalculated.employee_name,
    position: recalculated.position,
    birth_date: recalculated.birth_date,
    joining_date: recalculated.joining_date,
    employment_type: recalculated.employment_type || '',
    working_month: recalculated.working_month,
    house_rent_allowance: recalculated.house_rent_allowance,
    other_allowance: recalculated.other_allowance,
    food_allowance: recalculated.food_allowance,
    constant_parts: recalculated.constant_parts || {},
    custom_allowances: recalculated.custom_allowances || {},
    custom_allowance_inputs: recalculated.custom_allowance_inputs || {},
    total_salary: recalculated.total_salary,
    total_day_of_month: stripCommaField(recalculated.total_day_of_month),
    unpaid_leave: stripCommaField(recalculated.unpaid_leave),
    days_worked: stripCommaField(recalculated.days_worked),
    employment_salary_basis: recalculated.employment_salary_basis || '',
    ...(recalculated.employment_salary_basis === 'daily' ||
    String(recalculated.employment_type || '').toLowerCase() === 'daily'
      ? {
          daily_wage: String(recalculated.total_salary),
          prorated_basic: String(
            roundInr(
              num(recalculated.total_salary) *
                resolveDailyDaysWorked(
                  recalculated.total_day_of_month,
                  recalculated.days_worked
                )
            )
          ),
        }
      : {}),
    ...(recalculated.employment_salary_basis === 'fixed_rest_monthly'
      ? {
          fixed_rest_days: String(
            recalculated.fixed_rest_days != null
              ? recalculated.fixed_rest_days
              : DEFAULT_FIXED_REST_DAYS
          ),
          extra_working_days: String(
            fixedRestExtraPaidDays(
              recalculated.unpaid_leave,
              recalculated.fixed_rest_days
            )
          ),
          pay_days: String(
            fixedRestPayDays(
              recalculated.total_day_of_month,
              recalculated.unpaid_leave,
              recalculated.fixed_rest_days
            )
          ),
        }
      : {}),
    ot_rate: recalculated.ot_rate,
    day_ot_hour: recalculated.day_ot_hour,
    night_ot_hour: 0,
    ot_eligible: recalculated.ot_eligible === true,
    ot_manual: Boolean(recalculated.ot_manual),
    ot_rate_manual: Boolean(recalculated.ot_rate_manual),
    pt_eligible: recalculated.pt_eligible !== false,
    pf_manual: Boolean(recalculated.pf_manual),
    tds_manual: Boolean(recalculated.tds_manual),
    pt_manual: Boolean(recalculated.pt_manual),
    esic_manual: Boolean(recalculated.esic_manual),
    pf_calc_mode: recalculated.pf_calc_mode ?? 'cap_1800',
    day_ot: otPay.day_ot_pay,
    night_ot: 0,
    transport_allowance: recalculated.transport_allowance,
    pf_employee: recalculated.pf_employee,
    pf_employer: recalculated.pf_employer,
    esic_employee: recalculated.esic_employee,
    esic_employer: recalculated.esic_employer,
    pt: recalculated.pt,
    indian_pf_mode: recalculated.indian_pf_mode ?? 'basic_12pct'
  };

  return {
    payroll_period: String(recalculated.working_month || '').trim() || undefined,
    basic_salary: num(recalculated.basic_salary),
    overtime_pay: num(recalculated.overtime),
    allowances:
      num(recalculated.house_rent_allowance) +
      num(recalculated.other_allowance) +
      Object.values(recalculated.constant_parts || {}).reduce((s, v) => s + num(v), 0) +
      Object.values(recalculated.custom_allowances || {}).reduce((s, v) => s + num(v), 0) +
      num(recalculated.transport_allowance),
    gross_salary: num(recalculated.sum_total),
    net_salary: num(recalculated.net_salary_payable),
    tax_amount: num(recalculated.tds),
    deductions: num(recalculated.deduct_this_month),
    extra_fields
  };
}

function comparePayrollGridText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/** 급여 그리드 기본 정렬: 사번 → 부서 → 입사일 (오름차순) */
export function sortPayrollGridRowsDefault(rows: PayrollGridRow[]): PayrollGridRow[] {
  const sorted = [...rows].sort((a, b) => {
    const byEmp = comparePayrollGridText(String(a.emp_id ?? ''), String(b.emp_id ?? ''));
    if (byEmp !== 0) return byEmp;
    const byDept = comparePayrollGridText(String(a.department ?? ''), String(b.department ?? ''));
    if (byDept !== 0) return byDept;
    return comparePayrollGridText(String(a.joining_date ?? ''), String(b.joining_date ?? ''));
  });
  return sorted.map((row, index) => ({ ...row, row_no: index + 1 }));
}
