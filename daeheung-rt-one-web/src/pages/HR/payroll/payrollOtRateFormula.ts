/** 급여 OT 요율 산식 — 하루 소정시간 × 배수 (사용자 입력 숫자) */

export type PayrollOtRateFormula = {
  hoursPerDay: number;
  multiplier: number;
};

/** 다이얼로그 입력용(빈 칸·소수점 입력 허용) */
export type PayrollOtRateFormulaDraft = {
  hoursPerDay: string;
  multiplier: string;
};

const STORAGE_KEY = 'mvs.payrollGrid.otRateFormula.v1';

const MIN_HOURS = 0.01;
const MAX_HOURS = 24;
const MIN_MULT = 0.01;
const MAX_MULT = 100;

function storageKey(companyId?: string | number | null): string {
  const id = String(companyId ?? '').trim();
  return id ? `${STORAGE_KEY}.company.${id}` : STORAGE_KEY;
}

/** 기본: 하루 9시간 · 시간당 2배 */
export const DEFAULT_OT_RATE_FORMULA: PayrollOtRateFormula = {
  hoursPerDay: 9,
  multiplier: 2,
};

function clampPositive(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function normalizeOtRateFormula(raw: unknown): PayrollOtRateFormula {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const hoursRaw = Number(obj.hoursPerDay);
  const multRaw = Number(obj.multiplier);
  return {
    hoursPerDay: clampPositive(
      hoursRaw,
      MIN_HOURS,
      MAX_HOURS,
      DEFAULT_OT_RATE_FORMULA.hoursPerDay
    ),
    multiplier: clampPositive(multRaw, MIN_MULT, MAX_MULT, DEFAULT_OT_RATE_FORMULA.multiplier),
  };
}

export function formulaToDraft(formula: PayrollOtRateFormula): PayrollOtRateFormulaDraft {
  const n = normalizeOtRateFormula(formula);
  return {
    hoursPerDay: String(n.hoursPerDay),
    multiplier: String(n.multiplier),
  };
}

/** 숫자·소수점만 허용. 그 외 문자는 제거. */
export function sanitizeOtNumericInput(raw: string): string {
  let s = String(raw ?? '').replace(/[^\d.]/g, '');
  const firstDot = s.indexOf('.');
  if (firstDot >= 0) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
  }
  if (s.startsWith('.')) s = `0${s}`;
  return s;
}

export function isOtRateFormulaDraftValid(draft: PayrollOtRateFormulaDraft): boolean {
  const hours = Number(draft.hoursPerDay);
  const mult = Number(draft.multiplier);
  return (
    Number.isFinite(hours) &&
    hours >= MIN_HOURS &&
    hours <= MAX_HOURS &&
    Number.isFinite(mult) &&
    mult >= MIN_MULT &&
    mult <= MAX_MULT
  );
}

export function loadPayrollOtRateFormula(
  companyId?: string | number | null
): PayrollOtRateFormula {
  try {
    const raw = localStorage.getItem(storageKey(companyId));
    if (raw) return normalizeOtRateFormula(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_OT_RATE_FORMULA };
}

export function savePayrollOtRateFormula(
  formula: PayrollOtRateFormula,
  companyId?: string | number | null
): void {
  localStorage.setItem(storageKey(companyId), JSON.stringify(normalizeOtRateFormula(formula)));
}

export function formatOtRateFormulaSummary(formula: PayrollOtRateFormula): string {
  return `${formula.hoursPerDay}h × ${formula.multiplier}`;
}
