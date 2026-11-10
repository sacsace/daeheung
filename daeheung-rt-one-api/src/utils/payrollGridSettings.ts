/** companies.settings.payroll.grid — 급여 그리드 컬럼·상수 % (회사 공유) */

const MAX_CUSTOM_COLUMNS = 30;
const MAX_ORDER_FIELDS = 80;
const MAX_FORMULA_LEN = 120;

export type StoredPayrollCustomColumn = {
  id: string;
  label: string;
  inputMode?: 'amount' | 'count';
  formula?: string;
};

export type StoredPayrollColumnPrefs = {
  order: string[];
  customColumns: StoredPayrollCustomColumn[];
};

export type StoredPayrollConstantPart = {
  id: string;
  label: string;
  pct: number;
};

export type StoredPayrollSalaryRatios = {
  parts: StoredPayrollConstantPart[];
};

export type StoredPayrollOtRateFormula = {
  hoursPerDay: number;
  multiplier: number;
};

export type StoredPayrollGridSettings = {
  columnPrefs: StoredPayrollColumnPrefs;
  salaryRatios: StoredPayrollSalaryRatios;
  otRateFormula?: StoredPayrollOtRateFormula;
  updatedAt?: string;
};

function slugSafeId(raw: unknown, fallback: string): string {
  const s = String(raw ?? '')
    .trim()
    .slice(0, 48);
  return s || fallback;
}

export function normalizeStoredCustomColumns(raw: unknown): StoredPayrollCustomColumn[] {
  if (!Array.isArray(raw)) return [];
  const out: StoredPayrollCustomColumn[] = [];
  for (const item of raw.slice(0, MAX_CUSTOM_COLUMNS)) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = slugSafeId(row.id, '');
    const label = String(row.label ?? '').trim().slice(0, 80);
    if (!id || !label) continue;
    const inputMode = row.inputMode === 'count' ? 'count' : 'amount';
    const formula =
      inputMode === 'count'
        ? String(row.formula ?? '')
            .trim()
            .slice(0, MAX_FORMULA_LEN)
        : undefined;
    out.push({
      id,
      label,
      inputMode,
      ...(formula ? { formula } : {}),
    });
  }
  return out;
}

export function normalizeStoredColumnPrefs(raw: unknown): StoredPayrollColumnPrefs {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const order = Array.isArray(obj.order)
    ? obj.order
        .map((f) => String(f).trim())
        .filter(
          (f) =>
            Boolean(f) &&
            f !== 'food_allowance' &&
            f !== 'transport_allowance' &&
            f.length <= 64
        )
        .slice(0, MAX_ORDER_FIELDS)
    : [];
  return {
    order,
    customColumns: normalizeStoredCustomColumns(obj.customColumns),
  };
}

export function normalizeStoredSalaryRatios(raw: unknown): StoredPayrollSalaryRatios {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const partsRaw = Array.isArray(obj.parts) ? obj.parts : [];
  const parts: StoredPayrollConstantPart[] = [];
  for (const item of partsRaw.slice(0, 20)) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = slugSafeId(row.id, '');
    const label = String(row.label ?? '').trim().slice(0, 80);
    const pct = Math.max(0, Math.min(100, Number(row.pct) || 0));
    if (!id || !label) continue;
    parts.push({ id, label, pct });
  }
  return { parts };
}

export function normalizeStoredOtRateFormula(raw: unknown): StoredPayrollOtRateFormula {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const hoursRaw = Number(obj.hoursPerDay);
  const multRaw = Number(obj.multiplier);
  const hoursPerDay =
    Number.isFinite(hoursRaw) && hoursRaw > 0 ? Math.min(24, Math.max(0.01, hoursRaw)) : 9;
  const multiplier =
    Number.isFinite(multRaw) && multRaw > 0 ? Math.min(100, Math.max(0.01, multRaw)) : 2;
  return { hoursPerDay, multiplier };
}

export function readPayrollGridSettingsFromCompanySettings(
  settings: unknown
): StoredPayrollGridSettings | null {
  if (!settings || typeof settings !== 'object') return null;
  const payroll = (settings as Record<string, unknown>).payroll;
  if (!payroll || typeof payroll !== 'object') return null;
  const grid = (payroll as Record<string, unknown>).grid;
  if (!grid || typeof grid !== 'object') return null;
  const g = grid as Record<string, unknown>;
  const columnPrefs = normalizeStoredColumnPrefs(g.columnPrefs);
  const salaryRatios = normalizeStoredSalaryRatios(g.salaryRatios);
  const hasOtFormula = g.otRateFormula != null && typeof g.otRateFormula === 'object';
  const otRateFormula = hasOtFormula
    ? normalizeStoredOtRateFormula(g.otRateFormula)
    : undefined;
  const hasColumns = columnPrefs.customColumns.length > 0 || columnPrefs.order.length > 0;
  const hasRatios = salaryRatios.parts.length > 0;
  if (!hasColumns && !hasRatios && !hasOtFormula) return null;
  return {
    columnPrefs,
    salaryRatios,
    ...(otRateFormula ? { otRateFormula } : {}),
    updatedAt: g.updatedAt ? String(g.updatedAt) : undefined,
  };
}

export function buildPayrollGridSettingsPatch(body: unknown): StoredPayrollGridSettings {
  const obj = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const hasOt =
    Object.prototype.hasOwnProperty.call(obj, 'otRateFormula') && obj.otRateFormula != null;
  return {
    columnPrefs: normalizeStoredColumnPrefs(obj.columnPrefs),
    salaryRatios: normalizeStoredSalaryRatios(obj.salaryRatios),
    ...(hasOt ? { otRateFormula: normalizeStoredOtRateFormula(obj.otRateFormula) } : {}),
    updatedAt: new Date().toISOString(),
  };
}

export function mergePayrollGridIntoCompanySettings(
  settings: unknown,
  grid: StoredPayrollGridSettings
): Record<string, unknown> {
  const base =
    settings && typeof settings === 'object' ? { ...(settings as Record<string, unknown>) } : {};
  const payroll =
    base.payroll && typeof base.payroll === 'object'
      ? { ...(base.payroll as Record<string, unknown>) }
      : {};
  const prev = readPayrollGridSettingsFromCompanySettings(settings);
  const mergedGrid: StoredPayrollGridSettings = {
    ...grid,
    otRateFormula: grid.otRateFormula ?? prev?.otRateFormula,
  };
  return {
    ...base,
    payroll: {
      ...payroll,
      grid: mergedGrid,
    },
  };
}

export function isPayrollGridSettingsEmpty(grid: StoredPayrollGridSettings): boolean {
  return (
    grid.columnPrefs.customColumns.length === 0 &&
    grid.salaryRatios.parts.length === 0 &&
    grid.otRateFormula == null
  );
}
