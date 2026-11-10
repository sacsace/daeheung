/** 회사별 근무형태 → 급여 계산 옵션 (Company.settings.hr.employmentTypePay) */

export const EMPLOYMENT_TYPE_CODES = [
  'fulltime',
  'daily',
  'service',
  'contract',
  'parttime',
  'intern',
] as const;

export type EmploymentTypeCode = (typeof EMPLOYMENT_TYPE_CODES)[number];

/**
 * 급여 필드 의미:
 * - monthly: 월급여 (달력일 비례 또는 전액)
 * - daily: 일당
 * - fixed_rest_monthly: 서비스 직군 Fixed Rest-Day Monthly Salary
 */
export type EmploymentSalaryBasis = 'monthly' | 'daily' | 'fixed_rest_monthly';

/** 해당 급여월 근태 기록이 없을 때 */
export type EmploymentNoAttendancePolicy = 'full_month' | 'zero';

/** Fixed Rest-Day: 매월 정기 휴무일 수 (기본 4일) */
export const DEFAULT_FIXED_REST_DAYS = 4;

export type EmploymentTypePayConfig = {
  code: EmploymentTypeCode;
  /** 사용자 폼·목록에 표시 */
  isActive: boolean;
  salaryBasis: EmploymentSalaryBasis;
  noAttendance: EmploymentNoAttendancePolicy;
  /** 월급여일 때 근무일/달력일 비례 (일당·fixed_rest 이면 무시) */
  prorateByAttendance: boolean;
  /** fixed_rest_monthly 전용 정기 휴무일 수 */
  fixedRestDays: number;
};

export type StoredEmploymentTypePaySettings = {
  types: EmploymentTypePayConfig[];
  updatedAt?: string;
};

function isEmploymentTypeCode(v: unknown): v is EmploymentTypeCode {
  return typeof v === 'string' && (EMPLOYMENT_TYPE_CODES as readonly string[]).includes(v);
}

function normalizeFixedRestDays(raw: unknown, fallback = DEFAULT_FIXED_REST_DAYS): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 0 || n > 15) return fallback;
  return n;
}

export function defaultEmploymentTypePayConfig(code: EmploymentTypeCode): EmploymentTypePayConfig {
  if (code === 'daily') {
    return {
      code,
      isActive: true,
      salaryBasis: 'daily',
      noAttendance: 'zero',
      prorateByAttendance: false,
      fixedRestDays: DEFAULT_FIXED_REST_DAYS,
    };
  }
  if (code === 'service') {
    return {
      code,
      isActive: true,
      salaryBasis: 'fixed_rest_monthly',
      noAttendance: 'full_month',
      prorateByAttendance: false,
      fixedRestDays: DEFAULT_FIXED_REST_DAYS,
    };
  }
  return {
    code,
    isActive: true,
    salaryBasis: 'monthly',
    noAttendance: 'full_month',
    prorateByAttendance: true,
    fixedRestDays: DEFAULT_FIXED_REST_DAYS,
  };
}

export function defaultEmploymentTypePaySettings(): StoredEmploymentTypePaySettings {
  return {
    types: EMPLOYMENT_TYPE_CODES.map((code) => defaultEmploymentTypePayConfig(code)),
  };
}

function normalizeSalaryBasis(
  raw: unknown,
  def: EmploymentSalaryBasis
): EmploymentSalaryBasis {
  if (raw === 'daily' || raw === 'monthly' || raw === 'fixed_rest_monthly') return raw;
  return def;
}

function normalizeOne(raw: unknown, fallbackCode: EmploymentTypeCode): EmploymentTypePayConfig {
  const base = defaultEmploymentTypePayConfig(fallbackCode);
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;
  const code = isEmploymentTypeCode(o.code) ? o.code : fallbackCode;
  const def = defaultEmploymentTypePayConfig(code);
  const salaryBasis = normalizeSalaryBasis(o.salaryBasis, def.salaryBasis);
  const noAttendance =
    o.noAttendance === 'zero' || o.noAttendance === 'full_month' ? o.noAttendance : def.noAttendance;
  const fixedRestDays = normalizeFixedRestDays(o.fixedRestDays, def.fixedRestDays);

  let prorateByAttendance: boolean;
  if (salaryBasis === 'daily' || salaryBasis === 'fixed_rest_monthly') {
    prorateByAttendance = false;
  } else if (o.prorateByAttendance === false) {
    prorateByAttendance = false;
  } else {
    prorateByAttendance = true;
  }

  return {
    code,
    isActive: o.isActive === false ? false : true,
    salaryBasis,
    noAttendance,
    prorateByAttendance,
    fixedRestDays,
  };
}

export function normalizeEmploymentTypePaySettings(raw: unknown): StoredEmploymentTypePaySettings {
  const byCode = new Map<EmploymentTypeCode, EmploymentTypePayConfig>();
  const list =
    raw && typeof raw === 'object' && Array.isArray((raw as any).types)
      ? ((raw as any).types as unknown[])
      : Array.isArray(raw)
        ? raw
        : [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const code = (item as any).code;
    if (!isEmploymentTypeCode(code)) continue;
    byCode.set(code, normalizeOne(item, code));
  }
  return {
    types: EMPLOYMENT_TYPE_CODES.map(
      (code) => byCode.get(code) || defaultEmploymentTypePayConfig(code)
    ),
    updatedAt:
      raw && typeof raw === 'object' && (raw as any).updatedAt
        ? String((raw as any).updatedAt)
        : undefined,
  };
}

export function readEmploymentTypePayFromCompanySettings(
  settings: unknown
): StoredEmploymentTypePaySettings {
  if (!settings || typeof settings !== 'object') return defaultEmploymentTypePaySettings();
  const hr = (settings as Record<string, unknown>).hr;
  if (!hr || typeof hr !== 'object') return defaultEmploymentTypePaySettings();
  const stored = (hr as Record<string, unknown>).employmentTypePay;
  if (!stored) return defaultEmploymentTypePaySettings();
  return normalizeEmploymentTypePaySettings(stored);
}

export function mergeEmploymentTypePayIntoCompanySettings(
  settings: unknown,
  pay: StoredEmploymentTypePaySettings
): Record<string, unknown> {
  const base =
    settings && typeof settings === 'object' ? { ...(settings as Record<string, unknown>) } : {};
  const hr =
    base.hr && typeof base.hr === 'object' ? { ...(base.hr as Record<string, unknown>) } : {};
  return {
    ...base,
    hr: {
      ...hr,
      employmentTypePay: {
        ...normalizeEmploymentTypePaySettings(pay),
        updatedAt: new Date().toISOString(),
      },
    },
  };
}

export function resolveEmploymentTypePayConfig(
  settings: unknown,
  employmentType: unknown
): EmploymentTypePayConfig {
  const code = isEmploymentTypeCode(String(employmentType || '').toLowerCase())
    ? (String(employmentType).toLowerCase() as EmploymentTypeCode)
    : 'fulltime';
  const all = readEmploymentTypePayFromCompanySettings(settings);
  return all.types.find((t) => t.code === code) || defaultEmploymentTypePayConfig(code);
}

function rupee(n: number): number {
  return Math.round(Math.max(0, Number(n) || 0));
}

/**
 * 서비스 직군(Fixed Rest-Day):
 * - 표시 근무일 = 달력일 − 무급휴가 (다른 직군과 동일)
 * - 지급일 = 근무일 + 정기 휴무일(기본 4일) 항상 가산
 *   · 무급 4·근무 26 → 지급일 30 → 월급 전액
 *   · 무급 0·근무 30 → 지급일 34 → 월급 + 4일분
 *   · 무급 5·근무 25 → 지급일 29 → 1일 감액
 */
export function computeFixedRestPayDays(
  calendarDaysInMonth: number,
  unpaidLeave: number,
  fixedRestDays: number = DEFAULT_FIXED_REST_DAYS
): {
  daysWorked: number;
  unpaidLeave: number;
  extraPaidDays: number;
  payDays: number;
  fixedRestDays: number;
} {
  const cd = Math.max(1, calendarDaysInMonth);
  const restDays = normalizeFixedRestDays(fixedRestDays, DEFAULT_FIXED_REST_DAYS);
  const unpaid = Math.min(Math.max(0, Number(unpaidLeave) || 0), cd);
  const daysWorked = Math.max(0, cd - unpaid);
  const extraPaidDays = restDays;
  return {
    daysWorked,
    unpaidLeave: unpaid,
    extraPaidDays,
    payDays: daysWorked + extraPaidDays,
    fixedRestDays: restDays,
  };
}

export type EmploymentPaySumResult = {
  sumTotal: number;
  proratedBasic: number;
  effectiveDaysWorked: number;
  /** fixed_rest_monthly 전용 메타 */
  unpaidLeave?: number;
  fixedRestDays?: number;
  extraWorkingDays?: number;
  restDayExtraPay?: number;
  payDays?: number;
};

/**
 * 근무형태 급여 옵션에 따른 Sum Total / 기본분 / 유효 근무일.
 * - daily: 급여=일당 → 일당×유효일 + OT + 상여
 * - monthly: 급여=월급 → (비례 시) 월급×근무일/달력일 + OT + 상여
 * - fixed_rest_monthly: 근무일=달력−무급(표시 동일). 지급일=근무일+정기휴무(기본 4).
 *   지급액 = 월급 × (근무일+정기휴무) ÷ 달력일 + OT + 상여
 *
 * @param unpaidLeaveFromAttendance 무급/결근 일수 (fixed_rest 시 사용, 생략 시 근태로 추정)
 */
export function computeEmploymentPaySumTotal(
  payCfg: EmploymentTypePayConfig,
  salaryAmount: number,
  overtimePay: number,
  bonus: number,
  calendarDaysInMonth: number,
  daysWorkedFromAttendance: number,
  attendanceRecordCount: number,
  unpaidLeaveFromAttendance?: number
): EmploymentPaySumResult {
  const cd = Math.max(1, calendarDaysInMonth);
  const ot = Math.max(0, overtimePay);
  const bon = Math.max(0, bonus);
  const amount = Math.max(0, salaryAmount);

  if (payCfg.salaryBasis === 'fixed_rest_monthly') {
    const restDays = normalizeFixedRestDays(payCfg.fixedRestDays, DEFAULT_FIXED_REST_DAYS);

    let unpaid: number;
    if (attendanceRecordCount === 0) {
      unpaid = payCfg.noAttendance === 'zero' ? cd : 0;
    } else if (unpaidLeaveFromAttendance != null && Number.isFinite(Number(unpaidLeaveFromAttendance))) {
      unpaid = Math.min(Math.max(0, Number(unpaidLeaveFromAttendance)), cd);
    } else {
      // 폴백: 근무일 미달분을 무급으로 간주
      unpaid = Math.max(0, cd - Math.min(Math.max(0, daysWorkedFromAttendance), cd));
    }

    const fr = computeFixedRestPayDays(cd, unpaid, restDays);
    const dailyRate = amount / cd;
    const restDayExtraPay = rupee(dailyRate * fr.extraPaidDays);
    const proratedBasic = rupee((amount * fr.payDays) / cd);

    return {
      sumTotal: rupee(proratedBasic + ot + bon),
      proratedBasic,
      effectiveDaysWorked: fr.daysWorked,
      unpaidLeave: fr.unpaidLeave,
      fixedRestDays: fr.fixedRestDays,
      extraWorkingDays: fr.extraPaidDays,
      restDayExtraPay,
      payDays: fr.payDays,
    };
  }

  let worked: number;
  if (attendanceRecordCount === 0) {
    worked = payCfg.noAttendance === 'zero' ? 0 : cd;
  } else {
    worked = Math.min(Math.max(0, daysWorkedFromAttendance), cd);
  }

  if (payCfg.salaryBasis === 'daily') {
    const proratedBasic = rupee(amount * worked);
    // 무급 = 월총일 − 실근무일 (HeresNow 출근일만 있어도 그리드 표시와 일치)
    return {
      sumTotal: rupee(proratedBasic + ot + bon),
      proratedBasic,
      effectiveDaysWorked: worked,
      unpaidLeave: Math.max(0, cd - worked),
    };
  }

  // monthly
  if (!payCfg.prorateByAttendance) {
    if (attendanceRecordCount === 0 && payCfg.noAttendance === 'zero') {
      return { sumTotal: rupee(ot + bon), proratedBasic: 0, effectiveDaysWorked: 0 };
    }
    const proratedBasic = rupee(amount);
    return {
      sumTotal: rupee(proratedBasic + ot + bon),
      proratedBasic,
      effectiveDaysWorked: attendanceRecordCount === 0 ? cd : worked,
    };
  }

  const proratedBasic = rupee((amount * worked) / cd);
  return {
    sumTotal: rupee(proratedBasic + ot + bon),
    proratedBasic,
    effectiveDaysWorked: worked,
  };
}
