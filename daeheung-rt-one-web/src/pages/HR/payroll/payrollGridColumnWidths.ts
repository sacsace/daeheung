import type { GridColDef } from '@mui/x-data-grid';
import type { PayrollGridRow } from './payrollGridTypes';

const STORAGE_KEY = 'mvs.payrollGrid.columnWidths.v1';

function storageKey(companyId?: string | number | null): string {
  const id = String(companyId ?? '').trim();
  return id ? `${STORAGE_KEY}.company.${id}` : STORAGE_KEY;
}

export function defaultPayrollColumnWidth(col: GridColDef<PayrollGridRow>): number {
  if (typeof col.width === 'number') return col.width;
  if (typeof col.minWidth === 'number') return col.minWidth;
  return 100;
}

export function loadPayrollColumnWidths(
  companyId?: string | number | null
): Record<string, number> {
  try {
    const raw = localStorage.getItem(storageKey(companyId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [field, value] of Object.entries(parsed)) {
      const n = Number(value);
      if (field && Number.isFinite(n) && n >= 48) out[field] = Math.round(n);
    }
    return out;
  } catch {
    return {};
  }
}

export function savePayrollColumnWidths(
  widths: Record<string, number>,
  companyId?: string | number | null
): void {
  localStorage.setItem(storageKey(companyId), JSON.stringify(widths));
}

export function resolvePayrollColumnWidth(
  col: GridColDef<PayrollGridRow>,
  stored: Record<string, number>
): number {
  const field = col.field;
  const saved = stored[field];
  if (typeof saved === 'number' && saved >= 48) return saved;
  return defaultPayrollColumnWidth(col);
}

export function sumPayrollColumnWidths(cols: GridColDef<PayrollGridRow>[]): number {
  return cols.reduce((sum, col) => sum + (Number(col.width) || defaultPayrollColumnWidth(col)), 0);
}
