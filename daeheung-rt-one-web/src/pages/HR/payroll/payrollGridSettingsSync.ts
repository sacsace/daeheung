import { payrollService } from '../../../services/api';
import {
  loadPayrollColumnPrefs,
  PAYROLL_DEFAULT_COLUMN_ORDER,
  savePayrollColumnPrefs,
  type PayrollColumnPrefs,
  type PayrollCustomColumn,
  type PayrollCustomColumnInputMode,
} from './payrollColumnPrefs';
import {
  DEFAULT_SALARY_RATIOS,
  loadPayrollSalaryRatios,
  normalizeSalaryRatios,
  savePayrollSalaryRatios,
  type PayrollSalaryRatios,
} from './payrollSalaryRatios';
import {
  DEFAULT_OT_RATE_FORMULA,
  loadPayrollOtRateFormula,
  normalizeOtRateFormula,
  savePayrollOtRateFormula,
  type PayrollOtRateFormula,
} from './payrollOtRateFormula';

export type PayrollGridSettingsBundle = {
  columnPrefs: PayrollColumnPrefs;
  salaryRatios: PayrollSalaryRatios;
  otRateFormula: PayrollOtRateFormula;
};

function mapCustomColumns(raw: unknown): PayrollCustomColumn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => {
      const row = c as Record<string, unknown>;
      const inputMode: PayrollCustomColumnInputMode =
        row.inputMode === 'count' ? 'count' : 'amount';
      const formula = inputMode === 'count' ? String(row.formula ?? '').trim() : undefined;
      return {
        id: String(row.id ?? '').trim(),
        label: String(row.label ?? '').trim(),
        inputMode,
        ...(formula ? { formula } : {}),
      };
    })
    .filter((c) => c.id && c.label);
}

function normalizeServerColumnPrefs(raw: unknown): PayrollColumnPrefs | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const customColumns = mapCustomColumns(obj.customColumns);
  const order = Array.isArray(obj.order)
    ? obj.order
        .map((f) => String(f))
        .filter((f) => Boolean(f) && f !== 'food_allowance' && f !== 'transport_allowance')
    : [...PAYROLL_DEFAULT_COLUMN_ORDER];
  if (customColumns.length === 0 && order.length === 0) return null;
  return { order: order.length ? order : [...PAYROLL_DEFAULT_COLUMN_ORDER], customColumns };
}

function normalizeServerSalaryRatios(raw: unknown): PayrollSalaryRatios | null {
  if (!raw || typeof raw !== 'object') return null;
  const parts = (raw as Record<string, unknown>).parts;
  if (!Array.isArray(parts) || parts.length === 0) return null;
  return normalizeSalaryRatios({
    parts: parts.map((p) => {
      const row = p as Record<string, unknown>;
      return {
        id: String(row.id ?? '').trim(),
        label: String(row.label ?? '').trim(),
        pct: Number(row.pct) || 0,
      };
    }),
  });
}

function normalizeServerOtRateFormula(raw: unknown): PayrollOtRateFormula | null {
  if (!raw || typeof raw !== 'object') return null;
  return normalizeOtRateFormula(raw);
}

function localHasGridSettings(
  columnPrefs: PayrollColumnPrefs,
  salaryRatios: PayrollSalaryRatios,
  otRateFormula: PayrollOtRateFormula
): boolean {
  const ratiosDiffer =
    JSON.stringify(salaryRatios.parts) !== JSON.stringify(DEFAULT_SALARY_RATIOS.parts);
  const otDiffer =
    otRateFormula.hoursPerDay !== DEFAULT_OT_RATE_FORMULA.hoursPerDay ||
    otRateFormula.multiplier !== DEFAULT_OT_RATE_FORMULA.multiplier;
  return columnPrefs.customColumns.length > 0 || ratiosDiffer || otDiffer;
}

/** 서버 → localStorage 동기화. 서버 비어 있고 로컬만 있으면 서버로 업로드 */
export async function syncPayrollGridSettingsFromServer(
  companyId?: string | number | null
): Promise<PayrollGridSettingsBundle> {
  const localPrefs = loadPayrollColumnPrefs(companyId);
  const localRatios = loadPayrollSalaryRatios(companyId);
  const localOt = loadPayrollOtRateFormula(companyId);

  try {
    const res = await payrollService.getPayrollGridSettings(
      companyId != null ? { company_id: Number(companyId) } : undefined
    );
    const data = res?.success ? res.data : null;
    const serverPrefs = data?.columnPrefs ? normalizeServerColumnPrefs(data.columnPrefs) : null;
    const serverRatios = data?.salaryRatios
      ? normalizeServerSalaryRatios(data.salaryRatios)
      : null;
    const serverOt = data?.otRateFormula
      ? normalizeServerOtRateFormula(data.otRateFormula)
      : null;

    if (serverPrefs || serverRatios || serverOt) {
      const columnPrefs = serverPrefs || localPrefs;
      const salaryRatios = serverRatios || localRatios;
      const otRateFormula = serverOt || localOt;
      savePayrollColumnPrefs(columnPrefs, companyId);
      savePayrollSalaryRatios(salaryRatios, companyId);
      savePayrollOtRateFormula(otRateFormula, companyId);
      return { columnPrefs, salaryRatios, otRateFormula };
    }

    if (localHasGridSettings(localPrefs, localRatios, localOt)) {
      await savePayrollGridSettingsToServer(companyId, {
        columnPrefs: localPrefs,
        salaryRatios: localRatios,
        otRateFormula: localOt,
      });
    }
  } catch {
    /* 오프라인·구버전 API — localStorage 유지 */
  }

  return { columnPrefs: localPrefs, salaryRatios: localRatios, otRateFormula: localOt };
}

export async function savePayrollGridSettingsToServer(
  companyId: string | number | null | undefined,
  bundle: PayrollGridSettingsBundle
): Promise<void> {
  if (companyId == null || String(companyId).trim() === '') return;
  try {
    await payrollService.updatePayrollGridSettings({
      company_id: Number(companyId),
      columnPrefs: bundle.columnPrefs,
      salaryRatios: bundle.salaryRatios,
      otRateFormula: bundle.otRateFormula,
    });
  } catch (e) {
    console.warn('payroll grid settings save failed', e);
  }
}

export async function persistPayrollGridSettings(
  companyId: string | number | null | undefined,
  patch: Partial<PayrollGridSettingsBundle>
): Promise<void> {
  const columnPrefs = patch.columnPrefs ?? loadPayrollColumnPrefs(companyId);
  const salaryRatios = patch.salaryRatios ?? loadPayrollSalaryRatios(companyId);
  const otRateFormula = patch.otRateFormula ?? loadPayrollOtRateFormula(companyId);
  savePayrollColumnPrefs(columnPrefs, companyId);
  savePayrollSalaryRatios(salaryRatios, companyId);
  savePayrollOtRateFormula(otRateFormula, companyId);
  await savePayrollGridSettingsToServer(companyId, {
    columnPrefs,
    salaryRatios,
    otRateFormula,
  });
}
