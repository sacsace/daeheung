import React from 'react';
import { GridColDef } from '@mui/x-data-grid';
import { IconButton, Link, Tooltip, Typography } from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import type { PayrollGridRow } from './payrollGridTypes';
import {
  computeTenureMonths,
  countEditProps,
  formatMaybeNumericString,
  formatNumberDisplay,
  formatUnpaidLeaveDisplay,
  numberEditProps,
  otHourEditProps,
  unpaidLeaveEditProps,
} from './payrollGridUtils';
import { getEmploymentTypeLabel } from '../../../utils/personalInfoFormat';
import { evaluatePayrollColumnFormula } from './payrollColumnFormula';
import {
  customColumnField,
  type PayrollCustomColumn,
  mergeColumnOrder,
  PAYROLL_DEFAULT_COLUMN_ORDER,
  placeConstantPartsAfterOther,
  placeCustomColumnsAfterTransport,
} from './payrollColumnPrefs';
import {
  constantPartField,
  isSystemConstantId,
  type PayrollConstantPart,
} from './payrollSalaryRatios';

const colDef = <T extends GridColDef<PayrollGridRow>>(col: T): T => col;

function appendCellClass(
  existing: GridColDef<PayrollGridRow>['cellClassName'],
  extra: string
): GridColDef<PayrollGridRow>['cellClassName'] {
  if (!existing) return extra;
  if (typeof existing === 'string') {
    return existing.includes(extra) ? existing : `${existing} ${extra}`;
  }
  return (params) => {
    const base = existing(params);
    return base.includes(extra) ? base : `${base} ${extra}`.trim();
  };
}

const LEFT_TEXT_FIELDS = new Set([
  'emp_id',
  'bank_account',
  'ifsc',
  'bank_name',
  'employee_email',
  'department',
  'employee_name',
  'employment_type',
]);

const NUMERIC_STRING_FIELDS = new Set([
  'total_day_of_month',
  'unpaid_leave',
  'days_worked',
  'pf_employee',
  'pf_employer',
  'esic_employee',
  'esic_employer',
  'pt',
]);

function payrollNumericSortComparator(v1: unknown, v2: unknown): number {
  const parse = (v: unknown) => {
    const n = parseFloat(String(v ?? '').replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  return parse(v1) - parse(v2);
}

function withPayrollGridDefaults(cols: GridColDef<PayrollGridRow>[]): GridColDef<PayrollGridRow>[] {
  return cols.map((col) => {
    const leftText = LEFT_TEXT_FIELDS.has(col.field);
    const numericStringSort =
      NUMERIC_STRING_FIELDS.has(col.field) && col.sortComparator == null
        ? { sortComparator: payrollNumericSortComparator }
        : {};
    return {
      ...col,
      sortable: col.sortable ?? true,
      ...numericStringSort,
      align: leftText ? 'left' : 'center',
      headerAlign: 'center',
      cellClassName: appendCellClass(
        col.cellClassName,
        leftText ? 'payroll-col-text-left' : 'payroll-col-center'
      ),
    };
  });
}

type PayrollTranslate = (key: string) => string;

export type PayrollGridColumnsDeps = {
  t: PayrollTranslate;
  onOpenPayslip: (row: PayrollGridRow) => void;
  handleDeleteRow: (id: number) => void;
  lockedPeriods: Set<string>;
  isRoot: boolean;
  allowCellEdit?: boolean;
  allowDelete?: boolean;
  allowOpenPayslip?: boolean;
  /** 기본급·주거·기타 셀 직접 수정 허용 */
  allowConstantsEdit?: boolean;
  /** 상수 영역 구성 (없으면 기본 3항) */
  constantParts?: PayrollConstantPart[];
  customColumns?: PayrollCustomColumn[];
  columnOrder?: string[];
};

export function buildPayrollGridColumns({
  t,
  onOpenPayslip,
  handleDeleteRow,
  lockedPeriods,
  isRoot,
  allowCellEdit = true,
  allowDelete = true,
  allowOpenPayslip = true,
  allowConstantsEdit = false,
  constantParts,
  customColumns = [],
  columnOrder,
}: PayrollGridColumnsDeps): GridColDef<PayrollGridRow>[] {
  const parts: PayrollConstantPart[] =
    constantParts && constantParts.length > 0
      ? constantParts
      : [
          { id: 'basic_salary', label: t('payrollManagement.gridColumns.basicSalary'), pct: 50 },
          {
            id: 'house_rent_allowance',
            label: t('payrollManagement.gridColumns.houseRentAllowance'),
            pct: 30,
          },
          { id: 'other_allowance', label: t('payrollManagement.gridColumns.otherAllowance'), pct: 20 },
        ];

  const constantCols: GridColDef<PayrollGridRow>[] = parts.map((part, idx) => {
    const field = constantPartField(part.id);
    const isSystem = isSystemConstantId(part.id);
    return colDef({
      field,
      headerName: part.label,
      minWidth: 72,
      editable: allowCellEdit && allowConstantsEdit,
      headerClassName:
        idx === 0 ? 'payroll-col-salary payroll-col-salary-start' : 'payroll-col-salary',
      cellClassName:
        idx === 0
          ? 'payroll-col-salary payroll-col-salary-start payroll-col-center'
          : 'payroll-col-salary payroll-col-center',
      ...numberEditProps,
      ...(isSystem
        ? {}
        : {
            valueGetter: (_value: unknown, row: PayrollGridRow) =>
              row.constant_parts?.[part.id] ?? 0,
            valueSetter: (value: unknown, row: PayrollGridRow) => {
              const n =
                typeof value === 'number'
                  ? value
                  : parseFloat(String(value ?? '').replace(/,/g, ''));
              return {
                ...row,
                constant_parts: {
                  ...(row.constant_parts || {}),
                  [part.id]: Number.isFinite(n) ? Math.max(0, n) : 0,
                },
              };
            },
          }),
    });
  });

  const customCols: GridColDef<PayrollGridRow>[] = customColumns.map((col) => {
    const isCountFormula = col.inputMode === 'count' && Boolean(String(col.formula || '').trim());
    if (isCountFormula) {
      return colDef({
        field: customColumnField(col.id),
        headerName: col.label,
        description: String(col.formula || ''),
        minWidth: 64,
        editable: allowCellEdit,
        headerClassName: 'payroll-col-extra',
        cellClassName: 'payroll-col-extra payroll-col-user-input payroll-col-center',
        ...countEditProps,
        valueGetter: (_value, row) => row.custom_allowance_inputs?.[col.id] ?? 0,
        valueSetter: (value, row) => {
          const n =
            typeof value === 'number'
              ? value
              : parseFloat(String(value ?? '').replace(/,/g, ''));
          return {
            ...row,
            custom_allowance_inputs: {
              ...(row.custom_allowance_inputs || {}),
              [col.id]: Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0,
            },
          };
        },
        renderCell: (params) => {
          const count = Math.max(0, Number(params.value) || 0);
          const amount = evaluatePayrollColumnFormula(col.formula, count);
          const title = count > 0 ? `${count} × (${col.formula}) = ${formatNumberDisplay(amount)}` : String(col.formula || '');
          return (
            <Tooltip title={title}>
              <Typography
                variant="body2"
                noWrap
                sx={{ maxWidth: '100%', fontVariantNumeric: 'tabular-nums', textAlign: 'center', width: '100%' }}
              >
                {countEditProps.valueFormatter(params.value)}
              </Typography>
            </Tooltip>
          );
        },
      });
    }

    return colDef({
      field: customColumnField(col.id),
      headerName: col.label,
      minWidth: 64,
      editable: allowCellEdit,
      headerClassName: 'payroll-col-extra',
      cellClassName: 'payroll-col-extra payroll-col-user-input payroll-col-center',
      ...numberEditProps,
      valueGetter: (_value, row) => row.custom_allowances?.[col.id] ?? 0,
      valueSetter: (value, row) => {
        const n =
          typeof value === 'number'
            ? value
            : parseFloat(String(value ?? '').replace(/,/g, ''));
        return {
          ...row,
          custom_allowances: {
            ...(row.custom_allowances || {}),
            [col.id]: Number.isFinite(n) ? Math.max(0, n) : 0,
          },
        };
      },
    });
  });

  const base: GridColDef<PayrollGridRow>[] = [
    {
      field: 'row_no',
      headerName: t('payrollManagement.gridColumns.rowNo'),
      minWidth: 46,
      headerClassName: 'payroll-col-row-no',
      editable: false,
      sortable: false,
    },
    colDef({
      field: 'emp_id',
      headerName: t('payrollManagement.gridColumns.empId'),
      minWidth: 88,
      editable: false,
      cellClassName: 'payroll-col-emp-id',
      valueGetter: (_value, row) => String(row?.emp_id ?? '').trim().toUpperCase(),
    }),
    colDef({
      field: 'bank_account',
      headerName: t('payrollManagement.gridColumns.bankAccount'),
      minWidth: 100,
      editable: allowCellEdit
    }),
    colDef({ field: 'ifsc', headerName: t('payrollManagement.gridColumns.ifsc'), minWidth: 96, editable: allowCellEdit }),
    colDef({
      field: 'bank_name',
      headerName: t('payrollManagement.gridColumns.bankName'),
      minWidth: 96,
      editable: allowCellEdit
    }),
    colDef({
      field: 'employee_email',
      headerName: t('payrollManagement.gridColumns.email'),
      minWidth: 140,
      editable: false
    }),
    colDef({
      field: 'department',
      headerName: t('payrollManagement.gridColumns.department'),
      minWidth: 100,
      editable: allowCellEdit
    }),
    colDef({
      field: 'employee_name',
      headerName: t('payrollManagement.gridColumns.employeeName'),
      minWidth: 120,
      editable: allowCellEdit,
      cellClassName: 'payroll-col-name',
      renderCell: (params) =>
        allowOpenPayslip ? (
          <Link
            component="button"
            type="button"
            underline="none"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onOpenPayslip(params.row as PayrollGridRow);
            }}
            sx={{
              cursor: 'pointer',
              font: 'inherit',
              textAlign: 'left',
              color: 'inherit',
              textDecoration: 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '100%',
              width: '100%',
              p: 0,
              minWidth: 0,
              border: 'none',
              background: 'none',
              '&:hover': {
                color: 'inherit',
                textDecoration: 'none',
              },
              '&:focus, &:focus-visible': {
                outline: 'none',
              },
            }}
          >
            {params.value}
          </Link>
        ) : (
          <Typography variant="body2" noWrap sx={{ maxWidth: '100%', width: '100%', textAlign: 'left' }}>
            {params.value}
          </Typography>
        )
    }),
    colDef({
      field: 'employment_type',
      headerName: t('payrollManagement.gridColumns.employmentType'),
      minWidth: 88,
      editable: false,
      valueGetter: (_value, row) => String(row?.employment_type ?? '').trim(),
      valueFormatter: (value: unknown) =>
        getEmploymentTypeLabel(t, String(value ?? '').trim()) || String(value ?? ''),
    }),
    colDef({
      field: 'joining_date',
      headerName: t('payrollManagement.gridColumns.joiningDate'),
      minWidth: 88,
      editable: allowCellEdit,
    }),
    colDef({
      field: 'working_month',
      headerName: t('payrollManagement.gridColumns.workingMonth'),
      minWidth: 56,
      editable: false,
      headerClassName: 'payroll-col-salary-end',
      cellClassName: 'payroll-col-salary-end',
      valueGetter: (_value, row) => computeTenureMonths(row.joining_date, row.working_month),
      valueFormatter: (value: unknown) =>
        value === '' || value === null || value === undefined ? '' : String(value)
    }),
    ...constantCols,
    colDef({
      field: 'total_salary',
      headerName: t('payrollManagement.gridColumns.totalSalary'),
      minWidth: 72,
      editable: allowCellEdit,
      headerClassName: 'payroll-col-salary-total',
      cellClassName: 'payroll-col-salary-total',
      ...numberEditProps
    }),
    colDef({
      field: 'total_day_of_month',
      headerName: t('payrollManagement.gridColumns.totalDayOfMonth'),
      minWidth: 56,
      editable: allowCellEdit,
      headerClassName: 'payroll-col-days payroll-col-days-start',
      cellClassName: 'payroll-col-days payroll-col-days-start',
      valueFormatter: (value: unknown) => formatMaybeNumericString(value)
    }),
    colDef({
      field: 'unpaid_leave',
      headerName: t('payrollManagement.gridColumns.unpaidLeave'),
      minWidth: 56,
      editable: allowCellEdit,
      headerClassName: 'payroll-col-days',
      cellClassName: 'payroll-col-days payroll-col-user-input',
      ...unpaidLeaveEditProps
    }),
    colDef({
      field: 'days_worked',
      headerName: t('payrollManagement.gridColumns.daysWorked'),
      minWidth: 56,
      editable: false,
      headerClassName: 'payroll-col-days payroll-col-days-end',
      cellClassName: 'payroll-col-days payroll-col-days-end',
      valueFormatter: (value: unknown) => formatUnpaidLeaveDisplay(value)
    }),
    colDef({
      field: 'ot_rate',
      headerName: t('payrollManagement.gridColumns.otRate'),
      minWidth: 56,
      editable: allowCellEdit,
      headerClassName: 'payroll-col-attendance payroll-col-attendance-start',
      cellClassName: 'payroll-col-attendance payroll-col-attendance-start payroll-col-user-input payroll-col-center',
      ...numberEditProps
    }),
    colDef({
      field: 'day_ot_hour',
      headerName: t('payrollManagement.gridColumns.dayOtHour'),
      minWidth: 56,
      editable: allowCellEdit,
      headerClassName: 'payroll-col-attendance',
      cellClassName: 'payroll-col-attendance payroll-col-user-input payroll-col-center',
      ...otHourEditProps
    }),
    colDef({
      field: 'sum_total',
      headerName: t('payrollManagement.gridColumns.sumTotal'),
      minWidth: 72,
      editable: false,
      headerClassName: 'payroll-col-sum',
      cellClassName: 'payroll-col-sum payroll-col-center',
      ...numberEditProps
    }),
    colDef({
      field: 'esic_employer',
      headerName: t('payrollManagement.gridColumns.esicEmployer'),
      minWidth: 64,
      editable: allowCellEdit,
      headerClassName: 'payroll-col-employer payroll-col-employer-start',
      cellClassName:
        'payroll-col-employer payroll-col-employer-start payroll-col-user-input payroll-col-center',
      ...numberEditProps
    }),
    colDef({
      field: 'pf_employer',
      headerName: t('payrollManagement.gridColumns.pfEmployer'),
      minWidth: 56,
      editable: false,
      headerClassName: 'payroll-col-employer payroll-col-employer-end',
      cellClassName: 'payroll-col-employer payroll-col-employer-end payroll-col-center',
      valueFormatter: (value: unknown) => formatMaybeNumericString(value)
    }),
    colDef({
      field: 'esic_employee',
      headerName: t('payrollManagement.gridColumns.esicEmployee'),
      minWidth: 64,
      editable: allowCellEdit,
      headerClassName: 'payroll-col-employee payroll-col-employee-start',
      cellClassName:
        'payroll-col-employee payroll-col-employee-start payroll-col-user-input payroll-col-center',
      ...numberEditProps
    }),
    colDef({
      field: 'pf_employee',
      headerName: t('payrollManagement.gridColumns.pfEmployee'),
      minWidth: 56,
      editable: allowCellEdit,
      headerClassName: 'payroll-col-employee',
      cellClassName: 'payroll-col-employee payroll-col-center',
      ...numberEditProps
    }),
    colDef({
      field: 'tds',
      headerName: t('payrollManagement.gridColumns.tds'),
      minWidth: 56,
      editable: allowCellEdit,
      headerClassName: 'payroll-col-employee',
      cellClassName: 'payroll-col-employee payroll-col-center',
      ...numberEditProps
    }),
    colDef({
      field: 'pt',
      headerName: t('payrollManagement.gridColumns.pt'),
      minWidth: 48,
      editable: allowCellEdit,
      headerClassName: 'payroll-col-employee',
      cellClassName: 'payroll-col-employee payroll-col-center',
      ...numberEditProps
    }),
    colDef({
      field: 'net_salary_payable',
      headerName: t('payrollManagement.gridColumns.netSalary'),
      minWidth: 80,
      editable: false,
      headerClassName: 'payroll-col-net payroll-col-net-start',
      cellClassName: 'payroll-col-net payroll-col-net-start payroll-col-center',
      ...numberEditProps
    }),
    {
      field: 'actions',
      headerName: t('payrollManagement.columns.actions'),
      minWidth: 48,
      sortable: false,
      filterable: false,
      editable: false,
      renderCell: (params) => {
        const wm = String((params.row as PayrollGridRow).working_month || '').trim();
        const rowLocked = Boolean(!isRoot && wm && lockedPeriods.has(wm));
        const delDisabled = rowLocked || !allowDelete;
        return (
          <Tooltip
            title={
              !allowDelete ? t('common.menuNoDelete') : t('payrollManagement.actions.delete')
            }
          >
            <span style={{ display: 'inline-flex' }}>
              <IconButton
                size="small"
                color="error"
                disabled={delDisabled}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDeleteRow(params.row.id as number);
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        );
      }
    }
  ];

  // 커스텀 수당은 OT(시간) 다음 · 지급 합계 앞
  const withCustom: GridColDef<PayrollGridRow>[] = [];
  for (const col of base) {
    withCustom.push(col);
    if (col.field === 'day_ot_hour') {
      withCustom.push(...customCols);
    }
  }
  if (!base.some((c) => c.field === 'day_ot_hour') && customCols.length) {
    const sumIdx = withCustom.findIndex((c) => c.field === 'sum_total');
    if (sumIdx >= 0) withCustom.splice(sumIdx, 0, ...customCols);
    else withCustom.push(...customCols);
  }

  const byField = new Map(withCustom.map((c) => [c.field, c]));
  const allFields = withCustom.map((c) => c.field);
  const constantFields = parts.map((p) => constantPartField(p.id));
  const customFields = customColumns.map((c) => customColumnField(c.id));
  let order = mergeColumnOrder(
    columnOrder?.length ? columnOrder : PAYROLL_DEFAULT_COLUMN_ORDER,
    allFields
  );
  // 상수 영역 → 기타 수당 옆(근속 다음 ~ 급여합계 앞), 추가 컬럼 → OT(시간) 옆
  order = placeConstantPartsAfterOther(order, constantFields);
  order = placeCustomColumnsAfterTransport(order, customFields);
  return withPayrollGridDefaults(order.map((f) => byField.get(f)!).filter(Boolean));
}
