import type { GridColDef } from '@mui/x-data-grid';
import type { PayrollGridRow } from './payrollGridTypes';

const MIN_COL_WIDTH = 48;
const CELL_CHAR_PX = 7.2;
const HEADER_CHAR_PX = 6.4;
const HEADER_CJK_CHAR_PX = 11;
const CELL_CJK_CHAR_PX = 7.8;
const CELL_PAD_PX = 18;
/** 헤더 좌우 여백 (정렬 화살표 없음) */
const HEADER_ICON_PAD_PX = 8;

const MAX_WIDTH: Record<string, number> = {
  emp_id: 120,
  employee_email: 260,
  employee_name: 220,
  department: 180,
  bank_account: 160,
  bank_name: 140,
  ifsc: 120,
};

function charWidthPx(ch: string, header: boolean): number {
  if (ch.charCodeAt(0) > 127) {
    return header ? HEADER_CJK_CHAR_PX : CELL_CJK_CHAR_PX;
  }
  return header ? HEADER_CHAR_PX : CELL_CHAR_PX;
}

function textLineWidth(text: string, header: boolean): number {
  let width = CELL_PAD_PX;
  for (const ch of text) {
    width += charWidthPx(ch, header);
  }
  return Math.ceil(width);
}

function headerWidth(headerName: string | undefined): number {
  const lines = String(headerName ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return MIN_COL_WIDTH;
  const maxLine = Math.max(...lines.map((line) => textLineWidth(line, true)));
  return Math.max(MIN_COL_WIDTH, maxLine + HEADER_ICON_PAD_PX);
}

function getDisplayValue(col: GridColDef<PayrollGridRow>, row: PayrollGridRow): string {
  const raw = (row as Record<string, unknown>)[col.field];
  let value: unknown = raw;
  if (col.valueGetter) {
    value = col.valueGetter(raw as never, row, col, undefined as never);
  }
  if (col.valueFormatter) {
    return String(col.valueFormatter(value as never, row, col, undefined as never) ?? '');
  }
  if (value === null || value === undefined) return '';
  return String(value);
}

function autoWidthForColumn(col: GridColDef<PayrollGridRow>, rows: PayrollGridRow[]): number {
  if (col.field === 'actions') return 56;
  if (col.field === 'row_no') {
    const maxDigits = Math.max(
      1,
      ...rows.map((row, idx) => String(row.row_no ?? idx + 1).length)
    );
    const contentW = textLineWidth(String(maxDigits), false);
    const headLine = String(col.headerName ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join(' ');
    const headW = textLineWidth(headLine, true);
    return Math.max(46, contentW + 8, headW + 8);
  }

  if (col.field === 'emp_id') {
    let width = headerWidth(col.headerName);
    for (const row of rows) {
      width = Math.max(width, textLineWidth(getDisplayValue(col, row), false));
    }
    const floor = typeof col.minWidth === 'number' ? col.minWidth : 88;
    return Math.max(floor, width + 10);
  }

  let width = headerWidth(col.headerName);
  for (const row of rows) {
    width = Math.max(width, textLineWidth(getDisplayValue(col, row), false));
  }

  const floor = typeof col.minWidth === 'number' ? col.minWidth : MIN_COL_WIDTH;
  const cap = MAX_WIDTH[col.field] ?? 200;
  return Math.min(cap, Math.max(MIN_COL_WIDTH, floor, width));
}

export function applyPayrollAutoColumnWidths(
  columns: GridColDef<PayrollGridRow>[],
  rows: PayrollGridRow[]
): GridColDef<PayrollGridRow>[] {
  return columns.map((col) => {
    const width = autoWidthForColumn(col, rows);
    const locked = col.field === 'row_no' || col.field === 'actions' || col.field === 'emp_id';
    return {
      ...col,
      flex: locked ? 0 : 1,
      width,
      minWidth: width,
      ...(locked ? { maxWidth: width } : {}),
    };
  });
}

export function sumPayrollGridWidth(cols: GridColDef<PayrollGridRow>[]): number {
  return cols.reduce((sum, col) => sum + (Number(col.width) || MIN_COL_WIDTH), 0);
}
