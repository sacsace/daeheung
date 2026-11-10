/**
 * 인도 급여(EPF / ESI / PT / TDS) 추정 로직
 *
 * Sum Total(Gross): 시트 기준 (기본급 / 월 총일) × 근무일 + 연장 + 상여.
 *
 * PF 모드
 * - basic_12pct(기본): ROUND(MIN(Basic×12%, 상한), 0) — 엑셀 K9
 * - gross_6pct: Sum Total × 6% = 직원·고용주 각각
 * - epf_12pct_half: Gross×50%×12%, 상한(PF_CAP_INR=3000) 옵션
 *
 * ESI: 기본 직원 수 >10 이고 지급합계(Q)≤21,000 일 때 적용.
 *      직원 Q×0.75% / 사업주 Q×3.25%. 인원·상한 미충족 시 0.
 * PT: Gross≥25,000 → 200(설정 가능).
 * TDS: 구 세제 간이 추정(그리드에서 수정 가능).
 */

import { computeProfessionalTaxByState } from '../utils/indianProfessionalTax';

export type PfMode = 'basic_12pct' | 'gross_6pct' | 'epf_12pct_half';

export type UserPfCalcMode = 'cap_1800' | 'basic_12pct' | 'total_12pct' | 'none';

export type IndianStatutoryOptions = {
  /** AD="A" 에 해당: PF/ESI/PT 적용 (false면 모두 0) */
  statutoryApplicable?: boolean;
  /** PF 산출 방식. 기본 gross_6pct(참고 급여 시트) */
  pfMode?: PfMode;
  /** epf_12pct_half 일 때만: true면 min(50%×Gross×12%, PF_CAP_INR) */
  pfCapAt1800?: boolean;
  /** 인사정보 PF 계산 방식 (basic_12pct 시트 모드에서 사용) */
  pfCalcMode?: UserPfCalcMode;
  /** 총급여(패키지) — total_12pct 산정용. 생략 시 basicSalary/gross */
  totalSalary?: number;
  /** ESI: 지급합계(Q)가 이 금액을 초과하면 면제. 기본 21000 */
  esiBasicCeiling?: number;
  /** ESI: 기본 직원 수. 이 값이 있으면 10명 초과일 때만 ESI 적용 */
  esiEmployeeCount?: number;
  /** @deprecated 주별 PT 사용 — registeredStateCode 권장 */
  ptGrossThreshold?: number;
  /** @deprecated 주별 PT 사용 — registeredStateCode 권장 */
  ptAmount?: number;
  /** 회사 등록 주 GST state code (예: 29 Karnataka) */
  registeredStateCode?: string | null;
  /** YYYY-MM — Maharashtra 2월 PT 특례 */
  payrollMonth?: string | null;
  /** PT 적용 여부 (인사정보). false면 PT 0 */
  ptEligible?: boolean;
  /** TDS 자동 추정 사용 여부 (false면 0) */
  estimateTds?: boolean;
  /** 월 기본급(L) — ESI 면제(L>21000) 판단. 생략 시 Gross로 간주 */
  basicSalary?: number;
};

const DEFAULTS = {
  statutoryApplicable: true,
  pfMode: 'basic_12pct' as PfMode,
  pfCapAt1800: true,
  esiBasicCeiling: 21000,
  ptGrossThreshold: 25000,
  ptAmount: 200,
  estimateTds: true
} as const;

function rupee(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Sum Total = (월 기본급 / 해당 월 총일) × 근무일 + 연장 + 상여
 * 월급제(정규직·계약직 등): 근태 행이 없으면 근무일=월 총일로 간주(전액 지급). 일용직은 computeDailyWorkerSumTotal 사용.
 */
export function computeProratedSumTotal(
  monthlyBasic: number,
  overtimePay: number,
  bonus: number,
  calendarDaysInMonth: number,
  daysWorkedFromAttendance: number,
  attendanceRecordCount: number
): { sumTotal: number; proratedBasic: number; effectiveDaysWorked: number } {
  const cd = Math.max(1, calendarDaysInMonth);
  const worked =
    attendanceRecordCount === 0 ? cd : Math.min(Math.max(0, daysWorkedFromAttendance), cd);
  const proratedBasic = rupee((monthlyBasic * worked) / cd);
  const sumTotal = rupee(proratedBasic + overtimePay + bonus);
  return { sumTotal, proratedBasic, effectiveDaysWorked: worked };
}

/**
 * 일용직(daily): 프로필/계약 급여를 일당으로 보고 Sum Total = 일당 × 근무일 + 연장 + 상여
 * 해당 급여월 근태 행이 하나도 없으면 실근무 0일로 보아 일당·기본분 0(결근 전액 미지급).
 */
export function computeDailyWorkerSumTotal(
  dailyWage: number,
  overtimePay: number,
  bonus: number,
  calendarDaysInMonth: number,
  daysWorkedFromAttendance: number,
  attendanceRecordCount: number
): { sumTotal: number; proratedBasic: number; effectiveDaysWorked: number } {
  const cd = Math.max(1, calendarDaysInMonth);
  const worked =
    attendanceRecordCount === 0 ? 0 : Math.min(Math.max(0, daysWorkedFromAttendance), cd);
  const d = Math.max(0, dailyWage);
  const proratedBasic = rupee(d * worked);
  const sumTotal = rupee(proratedBasic + overtimePay + bonus);
  return { sumTotal, proratedBasic, effectiveDaysWorked: worked };
}

/** Gross의 50%를 기본급(EPF 산정 기준으로 쓰이는 비율)으로 둠 */
export function epfWageBase(gross: number): number {
  return rupee(gross * 0.5);
}

/** PF 상한액 (cap_1800 모드). DB 모드키는 호환을 위해 cap_1800 유지 */
export const PF_CAP_INR = 3000;

/** 직원 PF: 12% × (Gross×50%). 상한 적용 시 최대 PF_CAP_INR 루피 */
export function computePfEmployeeEpfHalf(gross: number, pfCapAt1800: boolean): number {
  const raw = rupee(epfWageBase(gross) * 0.12);
  if (pfCapAt1800) return rupee(Math.min(raw, PF_CAP_INR));
  return raw;
}

export function computePfEmployerMatchEmployee(pfEmployee: number): number {
  return rupee(pfEmployee);
}

/** PF 직원·사업주 = ROUND(MIN(Basic × 12%, 상한), 0). capAt1800=false면 상한 없이 12% */
export function computePfFromBasicSalary(
  basicSalary: number,
  pfCapAt1800 = true
): { pf_employee: number; pf_employer: number } {
  const basic = Math.max(0, basicSalary);
  const raw = basic * 0.12;
  const amount = Math.round(pfCapAt1800 ? Math.min(raw, PF_CAP_INR) : raw);
  return { pf_employee: amount, pf_employer: amount };
}

export function normalizeUserPfCalcMode(raw: unknown): UserPfCalcMode {
  if (raw === false || raw === 0 || raw === '0' || raw === 'false') return 'basic_12pct';
  const s = String(raw ?? '').trim();
  if (s === 'basic_12pct' || s === 'total_12pct' || s === 'cap_1800' || s === 'none') return s;
  return 'cap_1800';
}

/** 인사정보 PF 계산: 상한(PF_CAP_INR) / 기본급 12% / 총급여 12%(직원·사업주 각 50%) / 없음 */
export function computePfFromCalcMode(
  basicSalary: number,
  totalSalary: number,
  mode: UserPfCalcMode = 'cap_1800'
): { pf_employee: number; pf_employer: number } {
  if (mode === 'none') {
    return { pf_employee: 0, pf_employer: 0 };
  }
  if (mode === 'total_12pct') {
    // 총급여×12% 를 직원·사업주가 반반 (각 6%)
    const totalPf = Math.round(Math.max(0, totalSalary) * 0.12);
    const pf_employee = Math.round(totalPf / 2);
    const pf_employer = totalPf - pf_employee;
    return { pf_employee, pf_employer };
  }
  return computePfFromBasicSalary(basicSalary, mode !== 'basic_12pct');
}

/** 참고 시트: PF 직원·고용주 각각 Sum Total의 6% */
export function computePfSixPercentOfGross(gross: number): { pf_employee: number; pf_employer: number } {
  const x = rupee(gross * 0.06);
  return { pf_employee: x, pf_employer: x };
}

/** ESI 자동 적용 최소 인원(초과해야 적용) */
export const ESI_MIN_EMPLOYEE_COUNT = 10;

export function isEsiApplicableByHeadcount(employeeCount?: number | null): boolean {
  if (employeeCount == null || !Number.isFinite(Number(employeeCount))) return true;
  return Number(employeeCount) > ESI_MIN_EMPLOYEE_COUNT;
}

/** ESIC 직원 = IF(인원≤10 또는 Q>21,000, 0, Q×0.75%) */
export function computeEsiEmployee(
  gross: number,
  esiSumCeiling = 21000,
  employeeCount?: number | null
): number {
  if (!isEsiApplicableByHeadcount(employeeCount)) return 0;
  if (gross > esiSumCeiling) return 0;
  return rupee(gross * 0.0075);
}

/** ESIC 사업주 = IF(인원≤10 또는 Q>21,000, 0, Q×3.25%) */
export function computeEsiEmployer(
  gross: number,
  esiSumCeiling = 21000,
  employeeCount?: number | null
): number {
  if (!isEsiApplicableByHeadcount(employeeCount)) return 0;
  if (gross > esiSumCeiling) return 0;
  return rupee(gross * 0.0325);
}

export function computePt(gross: number, threshold: number, ptAmount: number): number {
  // 지급합계가 threshold를 초과할 때만 PT (기본 threshold 25,000)
  if (gross > threshold) return rupee(ptAmount);
  return 0;
}

/**
 * 구 세제(old regime) 연간 세액 추정(표준공제 5만만 반영, 80C 등 미반영).
 * 과세소득 구간(루피): 0–2.5L, 2.5–5L @5%, 5–10L @20%, 10L+ @30%
 * 87A 등 리베이트는 생략 → 실제보다 과대 추정될 수 있음.
 */
export function computeAnnualIncomeTaxOldRegimeSimplified(annualTaxableIncome: number): number {
  const t = annualTaxableIncome;
  let tax = 0;
  if (t <= 250000) tax = 0;
  else if (t <= 500000) tax = (t - 250000) * 0.05;
  else if (t <= 1000000) tax = 12500 + (t - 500000) * 0.2;
  else tax = 112500 + (t - 1000000) * 0.3;
  tax = Math.max(0, tax);
  const cess = tax * 0.04;
  return Math.round(tax + cess);
}

/** 월 급여만으로 연 환산 → 표준공제 5만 후 월평균 TDS 추정 */
export function computeMonthlyTdsEstimateOldRegime(monthlyGross: number): number {
  if (monthlyGross <= 0) return 0;
  const annualGross = monthlyGross * 12;
  const taxable = Math.max(0, annualGross - 50000);
  const annualTax = computeAnnualIncomeTaxOldRegimeSimplified(taxable);
  return Math.max(0, Math.round(annualTax / 12));
}

function slabTaxNewRegime(taxable: number, cap: number, floor: number, rate: number): number {
  return Math.max(0, Math.min(taxable, cap) - floor) * rate;
}

/**
 * 신규 세제 LET TDS — 월 지급 합계(sum_total) 기준
 * 표준공제 75,000 · 87A 리베이트(과세≤12L) · 한계완화 · 4% cess
 */
export function computeMonthlyTdsFromSumTotal(monthlySumTotal: number): number {
  const monthly = Math.max(0, monthlySumTotal);
  if (monthly <= 0) return 0;

  const annual = monthly * 12;
  const taxable = Math.max(0, annual - 75000);

  const baseTax =
    slabTaxNewRegime(taxable, 800000, 400000, 0.05) +
    slabTaxNewRegime(taxable, 1200000, 800000, 0.1) +
    slabTaxNewRegime(taxable, 1600000, 1200000, 0.15) +
    slabTaxNewRegime(taxable, 2000000, 1600000, 0.2) +
    slabTaxNewRegime(taxable, 2400000, 2000000, 0.25) +
    Math.max(0, taxable - 2400000) * 0.3;

  const taxAfterRebate = taxable <= 1200000 ? 0 : baseTax;

  let taxAfterRelief = taxAfterRebate;
  if (taxable > 1200000 && taxAfterRebate * 1.04 > taxable - 1200000) {
    taxAfterRelief = (taxable - 1200000) / 1.04;
  }

  return Math.round((taxAfterRelief * 1.04) / 12);
}

export type IndianDeductionBreakdown = {
  gross: number;
  /** 급여 기본급(L) — ESI 면제 판단에 사용 */
  basic_for_esi: number;
  pf_employee: number;
  pf_employer: number;
  esic_employee: number;
  esic_employer: number;
  pt: number;
  tds: number;
  totalEmployeeDeductions: number;
  net_payable: number;
  month_total_cost: number;
};

/**
 * @param gross 합계(Sum Total / Q)
 * @param basicSalary 월 기본급(L) — ESI 에서 L>21000 면제 판단. 미전달 시 gross와 동일하게 처리(보수적).
 */
export function computeIndianStatutoryPayroll(
  gross: number,
  options: IndianStatutoryOptions = {}
): IndianDeductionBreakdown {
  const o = { ...DEFAULTS, ...options };
  const basicForEsi =
    o.basicSalary != null && Number.isFinite(o.basicSalary) ? rupee(o.basicSalary as number) : gross;
  let pf_employee = 0;
  let pf_employer = 0;
  let esic_employee = 0;
  let esic_employer = 0;
  let pt = 0;
  let tds = 0;

  if (o.statutoryApplicable) {
    const mode = o.pfMode ?? DEFAULTS.pfMode;
    const basicForPf =
      o.basicSalary != null && Number.isFinite(o.basicSalary) ? rupee(o.basicSalary as number) : epfWageBase(gross);

    if (mode === 'basic_12pct') {
      const totalForPf =
        o.totalSalary != null && Number.isFinite(o.totalSalary)
          ? rupee(o.totalSalary as number)
          : basicForPf;
      const calcMode =
        o.pfCalcMode ??
        (o.pfCapAt1800 === false ? 'basic_12pct' : 'cap_1800');
      const pf = computePfFromCalcMode(basicForPf, totalForPf, calcMode);
      pf_employee = pf.pf_employee;
      pf_employer = pf.pf_employer;
    } else if (mode === 'gross_6pct') {
      const p6 = computePfSixPercentOfGross(gross);
      pf_employee = p6.pf_employee;
      pf_employer = p6.pf_employer;
    } else {
      pf_employee = computePfEmployeeEpfHalf(gross, o.pfCapAt1800);
      pf_employer = computePfEmployerMatchEmployee(pf_employee);
    }
    esic_employee = computeEsiEmployee(gross, o.esiBasicCeiling, o.esiEmployeeCount);
    esic_employer = computeEsiEmployer(gross, o.esiBasicCeiling, o.esiEmployeeCount);
    if (o.ptEligible !== false) {
      pt = computeProfessionalTaxByState({
        grossMonthly: gross,
        stateCode: o.registeredStateCode,
        payrollMonth: o.payrollMonth
      });
      if (pt === 0 && !o.registeredStateCode) {
        pt = computePt(gross, o.ptGrossThreshold, o.ptAmount);
      }
    }
    tds = o.estimateTds ? computeMonthlyTdsFromSumTotal(gross) : 0;
  }

  const totalEmployeeDeductions = rupee(pf_employee + esic_employee + tds + pt);
  const net_payable = rupee(gross - totalEmployeeDeductions);
  const month_total_cost = rupee(gross + pf_employer + esic_employer);

  return {
    gross: rupee(gross),
    basic_for_esi: basicForEsi,
    pf_employee,
    pf_employer,
    esic_employee,
    esic_employer,
    pt,
    tds,
    totalEmployeeDeductions,
    net_payable,
    month_total_cost
  };
}

function fmtInr(n: number): string {
  return Number.isFinite(n) ? String(rupee(n)) : '0';
}

export function breakdownToExtraFields(b: IndianDeductionBreakdown): Record<string, string> {
  return {
    pf_employee: fmtInr(b.pf_employee),
    pf_employer: fmtInr(b.pf_employer),
    esic_employee: fmtInr(b.esic_employee),
    esic_employer: fmtInr(b.esic_employer),
    pt: fmtInr(b.pt),
    month_total_cost: fmtInr(b.month_total_cost)
  };
}
