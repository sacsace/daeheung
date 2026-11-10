/** 사용자 추가 급여 컬럼 — 횟수(n) 기반 산술식 */

const FORMULA_ALLOWED = /^[\d\s+\-*/().n]+$/;
const NUMERIC_EXPR = /^[\d\s+\-*/().]+$/;

export function normalizePayrollColumnFormula(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function isValidPayrollColumnFormula(formula: unknown): boolean {
  const normalized = normalizePayrollColumnFormula(formula);
  if (!normalized) return false;
  if (!FORMULA_ALLOWED.test(normalized)) return false;
  if (!/\bn\b/.test(normalized)) return false;
  try {
    evaluatePayrollColumnFormula(normalized, 1);
    return true;
  } catch {
    return false;
  }
}

/** n = 사용자가 그리드에 입력한 횟수. 예: n * 100 */
export function evaluatePayrollColumnFormula(formula: unknown, n: number): number {
  const normalized = normalizePayrollColumnFormula(formula);
  if (!normalized) return 0;
  if (!FORMULA_ALLOWED.test(normalized)) return 0;

  const count = Math.max(0, Number.isFinite(n) ? n : 0);
  const expr = normalized.replace(/\bn\b/g, `(${count})`);
  if (!NUMERIC_EXPR.test(expr)) return 0;

  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr});`)();
    if (!Number.isFinite(result)) return 0;
    return Math.max(0, Math.round(result));
  } catch {
    return 0;
  }
}

export function formatPayrollColumnFormulaHint(formula: unknown): string {
  const normalized = normalizePayrollColumnFormula(formula);
  return normalized || '';
}
