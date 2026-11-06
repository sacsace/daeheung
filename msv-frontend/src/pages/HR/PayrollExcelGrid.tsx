import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DataGrid,
  GridCellParams,
  GridRowModel,
  GridRowSelectionModel,
  useGridApiRef,
} from '@mui/x-data-grid';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  Add as AddIcon,
  KeyboardArrowDown as ArrowDownIcon,
  KeyboardArrowUp as ArrowUpIcon,
  DeleteOutline as DeleteOutlineIcon,
  EditOutlined as EditOutlinedIcon,
  Percent as PercentIcon,
  Reorder as ReorderIcon,
  ViewColumn as ViewColumnIcon,
} from '@mui/icons-material';
import { payrollService } from '../../services/api';
import type { PayrollGridRow } from './payroll/payrollGridTypes';
import {
  applySalaryRatiosToRow,
  gridRowToPayload,
  recalculatePayrollRow,
  roundOtHour,
  shouldPreferTotalSplit,
  type PayrollRecalcContext,
} from './payroll/payrollGridUtils';
import { buildPayrollGridColumns } from './payroll/payrollGridColumns';
import {
  applyPayrollAutoColumnWidths,
  sumPayrollGridWidth,
} from './payroll/payrollGridAutoColumnWidths';
import { payrollDataGridSx } from './payroll/payrollGridStyles';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { mvsBodyOutlinedBtnSx } from '../../theme/mvsLayout';
import {
  createCustomColumnId,
  customColumnField,
  loadPayrollColumnPrefs,
  mergeColumnOrder,
  PAYROLL_DEFAULT_COLUMN_ORDER,
  placeConstantPartsAfterOther,
  placeCustomColumnsAfterTransport,
  savePayrollColumnPrefs,
  type PayrollColumnPrefs,
  type PayrollCustomColumn,
  type PayrollCustomColumnInputMode,
} from './payroll/payrollColumnPrefs';
import {
  isValidPayrollColumnFormula,
  normalizePayrollColumnFormula,
} from './payroll/payrollColumnFormula';
import {
  DEFAULT_SALARY_RATIOS,
  constantPartField,
  createConstantPartId,
  draftSalaryRatios,
  loadPayrollSalaryRatios,
  normalizeSalaryRatios,
  savePayrollSalaryRatios,
  type PayrollConstantPart,
  type PayrollSalaryRatios,
} from './payroll/payrollSalaryRatios';
import {
  persistPayrollGridSettings,
} from './payroll/payrollGridSettingsSync';
import {
  getPayrollCellCopyText,
  isPayrollGridCellEditable,
  parsePayrollColumnPasteLines,
  parsePayrollFieldInput,
  patchPayrollRowField,
  type PayrollCellAnchor,
} from './payroll/payrollGridCellEdit';

export type { PayrollGridRow } from './payroll/payrollGridTypes';
export { computeTenureMonths, payrollRecordToGridRow, sortPayrollGridRowsDefault } from './payroll';

type Props = {
  rows: PayrollGridRow[];
  loading: boolean;
  onReload: () => Promise<void>;
  onError: (msg: string | null) => void;
  onSuccess: (msg: string) => void;
  onOpenPayslip: (row: PayrollGridRow) => void;
  lockedPeriods?: Set<string>;
  isRoot?: boolean;
  allowCellEdit?: boolean;
  allowDelete?: boolean;
  allowOpenPayslip?: boolean;
  /** 회사별 컬럼·상수 설정을 분리하는 회사 ID */
  companyId?: string | number | null;
  /** 부모에서 서버 그리드 설정 동기화 완료 시 증가 */
  settingsRevision?: number;
  companyStateCode?: string | null;
  payrollMonth?: string | null;
  /** 해당 급여월 기본 직원 수(검색 필터 전). ESIC 10명 초과 여부 판단 */
  payrollEmployeeCount?: number | null;
  /** 행 선택(체크박스) — 명세서 다운로드 등 */
  selectedRowIds?: number[];
  onSelectedRowIdsChange?: (ids: number[]) => void;
  enableRowSelection?: boolean;
};

const PayrollExcelGrid: React.FC<Props> = ({
  rows,
  loading,
  onReload,
  onError,
  onSuccess,
  onOpenPayslip,
  lockedPeriods = new Set(),
  isRoot = false,
  allowCellEdit = true,
  allowDelete = true,
  allowOpenPayslip = true,
  companyId = null,
  settingsRevision = 0,
  companyStateCode = null,
  payrollMonth = null,
  payrollEmployeeCount = null,
  selectedRowIds,
  onSelectedRowIdsChange,
  enableRowSelection = false,
}) => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { dialogState, showConfirm, handleConfirm, handleCancel } = useConfirmDialog();
  const apiRef = useGridApiRef();
  const lastFocusRef = useRef<PayrollCellAnchor | null>(null);
  const [prefs, setPrefs] = useState<PayrollColumnPrefs>(() => {
    const loaded = loadPayrollColumnPrefs(companyId);
    const customFields = loaded.customColumns.map((c) => customColumnField(c.id));
    if (customFields.length === 0) return loaded;
    const totalIdx = loaded.order.indexOf('total_salary');
    const stuckInSalaryBlock = customFields.some((f) => {
      const i = loaded.order.indexOf(f);
      return i >= 0 && totalIdx >= 0 && i < totalIdx;
    });
    if (!stuckInSalaryBlock) return loaded;
    const order = placeCustomColumnsAfterTransport(loaded.order, customFields);
    const normalized = { ...loaded, order };
    savePayrollColumnPrefs(normalized, companyId);
    return normalized;
  });
  const [addOpen, setAddOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [ratiosOpen, setRatiosOpen] = useState(false);
  const [newColumnLabel, setNewColumnLabel] = useState('');
  const [newColumnInputMode, setNewColumnInputMode] = useState<PayrollCustomColumnInputMode>('amount');
  const [newColumnFormula, setNewColumnFormula] = useState('');
  const [editColumnOpen, setEditColumnOpen] = useState(false);
  const [editColumnDraft, setEditColumnDraft] = useState<PayrollCustomColumn | null>(null);
  const [manageColumnsOpen, setManageColumnsOpen] = useState(false);
  const [salaryRatios, setSalaryRatios] = useState<PayrollSalaryRatios>(() =>
    loadPayrollSalaryRatios(companyId)
  );
  const [ratioDraft, setRatioDraft] = useState<PayrollSalaryRatios>(() =>
    loadPayrollSalaryRatios(companyId)
  );
  const [allowConstantsEdit, setAllowConstantsEdit] = useState(false);
  const [applyingRatios, setApplyingRatios] = useState(false);

  const recalcCtx = useMemo<PayrollRecalcContext>(
    () => ({
      companyStateCode,
      payrollMonth,
      companyId,
      salaryRatios,
      payrollEmployeeCount:
        payrollEmployeeCount != null && Number.isFinite(Number(payrollEmployeeCount))
          ? Number(payrollEmployeeCount)
          : rows.length,
    }),
    [companyId, companyStateCode, payrollMonth, salaryRatios, payrollEmployeeCount, rows.length]
  );

  useEffect(() => {
    setPrefs(loadPayrollColumnPrefs(companyId));
    const ratios = loadPayrollSalaryRatios(companyId);
    setSalaryRatios(ratios);
    setRatioDraft(ratios);
  }, [companyId, settingsRevision]);

  const persistPrefs = useCallback(
    (next: PayrollColumnPrefs) => {
      setPrefs(next);
      savePayrollColumnPrefs(next, companyId);
      void persistPayrollGridSettings(companyId, {
        columnPrefs: next,
        salaryRatios: loadPayrollSalaryRatios(companyId),
      });
    },
    [companyId]
  );

  const handleDeleteRow = useCallback(
    (id: number) => {
      showConfirm(
        t('payrollManagement.confirmDelete'),
        () => {
          void (async () => {
            try {
              onError(null);
              const scopeCompanyId =
                companyId != null && Number(companyId) > 0 ? Number(companyId) : undefined;
              const res = await payrollService.deletePayroll(
                id,
                scopeCompanyId != null ? { company_id: scopeCompanyId } : undefined
              );
              if (res.success) {
                onSuccess(t('payrollManagement.success.deleted'));
                await onReload();
              } else {
                onError((res as any).message || t('payrollManagement.errors.deleteFailed'));
              }
            } catch (e: any) {
              onError(e?.response?.data?.message || t('payrollManagement.errors.deleteError'));
            }
          })();
        },
        {
          title: t('common.confirm'),
          confirmColor: 'error',
          confirmText: t('common.delete'),
          cancelText: t('common.cancel')
        }
      );
    },
    [companyId, onError, onReload, onSuccess, showConfirm, t]
  );

  const commitPayrollRowUpdate = useCallback(
    async (
      newRow: PayrollGridRow,
      oldRow: PayrollGridRow,
      options?: { notifySuccess?: boolean; reload?: boolean }
    ) => {
      const next = { ...newRow };
      const prev = oldRow;
      const prevOt = roundOtHour(Number(prev.day_ot_hour) || 0);
      const nextOt = roundOtHour(Number(next.day_ot_hour) || 0);
      if (prevOt !== nextOt) {
        next.ot_manual = nextOt > 0;
      }
      if (Math.floor(Number(prev.ot_rate) || 0) !== Math.floor(Number(next.ot_rate) || 0)) {
        next.ot_rate_manual = true;
        next.ot_rate = Math.max(0, Math.floor(Number(next.ot_rate) || 0));
      }
      if (Math.floor(Number(prev.pf_employee) || 0) !== Math.floor(Number(next.pf_employee) || 0)) {
        next.pf_manual = true;
        next.pf_employee = String(Math.max(0, Math.floor(Number(next.pf_employee) || 0)));
      }
      if (
        Math.floor(Number(prev.esic_employee) || 0) !== Math.floor(Number(next.esic_employee) || 0) ||
        Math.floor(Number(prev.esic_employer) || 0) !== Math.floor(Number(next.esic_employer) || 0)
      ) {
        next.esic_manual = true;
        next.esic_employee = String(Math.max(0, Math.floor(Number(next.esic_employee) || 0)));
        next.esic_employer = String(Math.max(0, Math.floor(Number(next.esic_employer) || 0)));
      }
      if (Math.floor(Number(prev.tds) || 0) !== Math.floor(Number(next.tds) || 0)) {
        next.tds_manual = true;
        next.tds = Math.max(0, Math.floor(Number(next.tds) || 0));
      }
      if (Math.floor(Number(prev.pt) || 0) !== Math.floor(Number(next.pt) || 0)) {
        next.pt_manual = true;
        next.pt = String(Math.max(0, Math.floor(Number(next.pt) || 0)));
      }
      const row = recalculatePayrollRow(next, recalcCtx, {
        preferTotalSplit: shouldPreferTotalSplit(prev, next),
        salaryRatios,
      });
      onError(null);
      const payload = gridRowToPayload(row, recalcCtx);
      const scopeCompanyId =
        companyId != null && Number(companyId) > 0 ? Number(companyId) : undefined;
      const res = await payrollService.updatePayroll(
        row.id,
        payload,
        scopeCompanyId != null ? { company_id: scopeCompanyId } : undefined
      );
      if (!res.success) {
        throw new Error((res as any).message || t('payrollManagement.errors.saveFailed'));
      }
      if (options?.notifySuccess !== false) {
        onSuccess(t('payrollManagement.success.saved'));
      }
      if (options?.reload !== false) {
        await onReload();
      }
      return row;
    },
    [companyId, onError, onReload, onSuccess, recalcCtx, salaryRatios, t]
  );

  const processRowUpdate = useCallback(
    async (newRow: GridRowModel, oldRow: GridRowModel) => {
      if (!allowCellEdit) {
        return oldRow as PayrollGridRow;
      }
      try {
        return await commitPayrollRowUpdate(newRow as PayrollGridRow, oldRow as PayrollGridRow);
      } catch (e: any) {
        const msg = e?.message || t('payrollManagement.errors.saveFailed');
        onError(msg);
        throw e;
      }
    },
    [allowCellEdit, commitPayrollRowUpdate, onError, t]
  );

  const cellEditOptions = useMemo(
    () => ({
      allowCellEdit,
      allowConstantsEdit,
      isRoot,
      lockedPeriods,
    }),
    [allowCellEdit, allowConstantsEdit, isRoot, lockedPeriods]
  );

  const isCellEditable = useCallback(
    (params: { field: string; row: PayrollGridRow }) =>
      isPayrollGridCellEditable(params.field, params.row, cellEditOptions),
    [cellEditOptions]
  );

  const handleCellClick = useCallback(
    (params: GridCellParams<PayrollGridRow>) => {
      if (params.field !== 'actions' && params.field !== 'row_no') {
        lastFocusRef.current = { rowId: params.id, field: params.field };
      }
      if (!allowCellEdit || !params.isEditable) return;
      const api = apiRef.current;
      if (!api) return;
      const editState = api.getCellMode(params.id, params.field);
      if (editState === 'edit') return;
      api.startCellEditMode({ id: params.id, field: params.field });
    },
    [allowCellEdit, apiRef]
  );

  const handleCopy = useCallback(
    (e: React.ClipboardEvent) => {
      if (!allowCellEdit) return;
      const el = e.target as HTMLElement;
      if (el.closest('.MuiDataGrid-cell--editing')) return;
      const anchor = lastFocusRef.current;
      if (!anchor) return;
      const row = rows.find((r) => r.id === anchor.rowId);
      if (!row || !isCellEditable({ field: anchor.field, row })) return;
      const text = getPayrollCellCopyText(row, anchor.field, prefs.customColumns);
      e.clipboardData.setData('text/plain', text);
      e.preventDefault();
    },
    [allowCellEdit, isCellEditable, prefs.customColumns, rows]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (!allowCellEdit) return;
      const el = e.target as HTMLElement;
      if (el.closest('.MuiDataGrid-columnHeader') || el.closest('.MuiDataGrid-columnSeparator')) {
        return;
      }

      const text = e.clipboardData?.getData('text/plain');
      if (!text) return;
      const rawLines = parsePayrollColumnPasteLines(text);
      if (rawLines.length === 0) return;

      const inEditing = Boolean(el.closest('.MuiDataGrid-cell--editing'));
      if (inEditing && rawLines.length <= 1) return;

      const focusCell = apiRef.current?.state.focus.cell;
      const pasteAnchor: PayrollCellAnchor | null =
        lastFocusRef.current ??
        (focusCell?.id != null && focusCell.field
          ? { rowId: focusCell.id, field: focusCell.field }
          : null);
      if (!pasteAnchor) return;

      const startRowIdx = rows.findIndex((r) => r.id === pasteAnchor.rowId);
      if (startRowIdx < 0) return;
      const startRow = rows[startRowIdx];
      if (!startRow || !isCellEditable({ field: pasteAnchor.field, row: startRow })) return;

      if (inEditing && rawLines.length > 1) {
        apiRef.current?.stopCellEditMode({
          id: pasteAnchor.rowId,
          field: pasteAnchor.field,
          ignoreModifications: true,
        });
      }

      e.preventDefault();
      e.stopPropagation();

      void (async () => {
        let saved = 0;
        let failed = 0;
        onError(null);
        for (let i = 0; i < rawLines.length; i += 1) {
          const rowIdx = startRowIdx + i;
          if (rowIdx >= rows.length) break;
          const oldRow = rows[rowIdx];
          if (!isCellEditable({ field: pasteAnchor.field, row: oldRow })) {
            failed += 1;
            continue;
          }
          const parsed = parsePayrollFieldInput(pasteAnchor.field, rawLines[i], prefs.customColumns);
          const patched = patchPayrollRowField(oldRow, pasteAnchor.field, parsed, prefs.customColumns);
          if (JSON.stringify(patched) === JSON.stringify(oldRow)) continue;
          try {
            await commitPayrollRowUpdate(patched, oldRow, {
              notifySuccess: false,
              reload: false,
            });
            saved += 1;
          } catch {
            failed += 1;
          }
        }
        if (saved > 0) {
          await onReload();
          if (failed > 0) {
            onError(t('payrollManagement.errors.pastePartial', { ok: saved, fail: failed }));
          } else {
            onSuccess(t('payrollManagement.success.pasteSaved', { count: saved }));
          }
        } else if (failed > 0) {
          onError(t('payrollManagement.errors.pasteFailed'));
        }
      })();
    },
    [
      allowCellEdit,
      commitPayrollRowUpdate,
      isCellEditable,
      onError,
      onReload,
      onSuccess,
      prefs.customColumns,
      rows,
      t,
    ]
  );

  const baseColumns = useMemo(
    () =>
      buildPayrollGridColumns({
        t,
        onOpenPayslip,
        handleDeleteRow,
        lockedPeriods,
        isRoot,
        allowCellEdit,
        allowDelete,
        allowOpenPayslip,
        allowConstantsEdit,
        constantParts: salaryRatios.parts,
        customColumns: prefs.customColumns,
        columnOrder: prefs.order,
      }),
    [
      allowCellEdit,
      allowConstantsEdit,
      allowDelete,
      allowOpenPayslip,
      handleDeleteRow,
      isRoot,
      lockedPeriods,
      onOpenPayslip,
      prefs.customColumns,
      prefs.order,
      salaryRatios.parts,
      t,
    ]
  );

  const columns = useMemo(
    () => applyPayrollAutoColumnWidths(baseColumns, rows),
    [baseColumns, rows]
  );

  const gridMinWidth = useMemo(
    () => sumPayrollGridWidth(columns) + (enableRowSelection ? 42 : 0),
    [columns, enableRowSelection]
  );

  const orderedFieldsForDialog = useMemo(() => {
    const fields = columns.map((c) => c.field);
    return mergeColumnOrder(prefs.order, fields);
  }, [columns, prefs.order]);

  const headerLabelByField = useMemo(() => {
    const map = new Map<string, string>();
    for (const col of columns) {
      map.set(col.field, String(col.headerName || col.field));
    }
    return map;
  }, [columns]);

  const resetAddColumnForm = () => {
    setNewColumnLabel('');
    setNewColumnInputMode('amount');
    setNewColumnFormula('');
  };

  const openAddColumnDialog = () => {
    resetAddColumnForm();
    setAddOpen(true);
  };

  const handleAddColumn = () => {
    const label = newColumnLabel.trim();
    if (!label) return;
    const inputMode = newColumnInputMode;
    const formula =
      inputMode === 'count' ? normalizePayrollColumnFormula(newColumnFormula) : undefined;
    if (inputMode === 'count' && !isValidPayrollColumnFormula(formula)) {
      onError(t('payrollManagement.errors.invalidColumnFormula'));
      return;
    }
    const id = createCustomColumnId(label, prefs.customColumns);
    const field = customColumnField(id);
    const nextColumn: PayrollCustomColumn = {
      id,
      label,
      inputMode,
      ...(formula ? { formula } : {}),
    };
    const nextCustom: PayrollCustomColumn[] = [...prefs.customColumns, nextColumn];
    const baseOrder =
      prefs.order.length > 0 ? [...prefs.order] : [...PAYROLL_DEFAULT_COLUMN_ORDER];
    const customFields = nextCustom.map((c) => customColumnField(c.id));
    if (!baseOrder.includes(field)) baseOrder.push(field);
    const order = placeCustomColumnsAfterTransport(baseOrder, customFields);
    persistPrefs({ order, customColumns: nextCustom });
    resetAddColumnForm();
    setAddOpen(false);
    onSuccess(t('payrollManagement.columnAdded', { name: label }));
  };

  const openEditColumnDialog = (column: PayrollCustomColumn) => {
    setEditColumnDraft({
      ...column,
      inputMode: column.inputMode === 'count' ? 'count' : 'amount',
      formula: column.formula || '',
    });
    setEditColumnOpen(true);
  };

  const handleSaveEditColumn = () => {
    if (!editColumnDraft) return;
    const label = editColumnDraft.label.trim();
    if (!label) return;
    const inputMode: PayrollCustomColumnInputMode =
      editColumnDraft.inputMode === 'count' ? 'count' : 'amount';
    const formula =
      inputMode === 'count' ? normalizePayrollColumnFormula(editColumnDraft.formula) : undefined;
    if (inputMode === 'count' && !isValidPayrollColumnFormula(formula)) {
      onError(t('payrollManagement.errors.invalidColumnFormula'));
      return;
    }
    const nextCustom: PayrollCustomColumn[] = prefs.customColumns.map((col) =>
      col.id === editColumnDraft.id
        ? {
            id: col.id,
            label,
            inputMode,
            ...(inputMode === 'count' && formula ? { formula } : {}),
          }
        : col
    );
    persistPrefs({ ...prefs, customColumns: nextCustom });
    setEditColumnOpen(false);
    setEditColumnDraft(null);
    onSuccess(t('payrollManagement.columnUpdated', { name: label }));
  };

  const moveColumn = (field: string, dir: -1 | 1) => {
    const order = [...orderedFieldsForDialog];
    const idx = order.indexOf(field);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= order.length) return;
    if (field === 'actions' || order[next] === 'actions') return;
    if (field === 'row_no' || order[next] === 'row_no') return;
    if (field === 'emp_id' || order[next] === 'emp_id') return;
    [order[idx], order[next]] = [order[next], order[idx]];
    persistPrefs({ ...prefs, order });
  };

  const removeCustomColumn = useCallback(
    (id: string) => {
      const field = customColumnField(id);
      persistPrefs({
        customColumns: prefs.customColumns.filter((c) => c.id !== id),
        order: prefs.order.filter((f) => f !== field),
      });
    },
    [persistPrefs, prefs.customColumns, prefs.order]
  );

  const confirmRemoveCustomColumn = useCallback(
    (column: PayrollCustomColumn, onDone?: () => void) => {
      showConfirm(
        t('payrollManagement.confirmDeleteColumn', { name: column.label }),
        () => {
          removeCustomColumn(column.id);
          onDone?.();
          onSuccess(t('payrollManagement.columnDeleted', { name: column.label }));
        },
        {
          title: t('payrollManagement.dialog.deleteColumnTitle'),
          confirmColor: 'error',
          confirmText: t('payrollManagement.actions.deleteColumn'),
          cancelText: t('common.cancel'),
        }
      );
    },
    [onSuccess, removeCustomColumn, showConfirm, t]
  );

  const handleDeleteEditColumn = () => {
    if (!editColumnDraft) return;
    confirmRemoveCustomColumn(editColumnDraft, () => {
      setEditColumnOpen(false);
      setEditColumnDraft(null);
    });
  };

  const resetColumnOrder = () => {
    const customFields = prefs.customColumns.map((c) => customColumnField(c.id));
    const order = placeCustomColumnsAfterTransport(
      [...PAYROLL_DEFAULT_COLUMN_ORDER],
      customFields
    );
    persistPrefs({
      ...prefs,
      order: mergeColumnOrder(order, [...PAYROLL_DEFAULT_COLUMN_ORDER, ...customFields]),
    });
  };

  const openRatiosDialog = () => {
    const current = loadPayrollSalaryRatios(companyId);
    setSalaryRatios(current);
    setRatioDraft(current);
    setRatiosOpen(true);
  };

  const setPartsDraft = (parts: PayrollConstantPart[]) => {
    setRatioDraft(draftSalaryRatios(parts));
  };

  const updatePartAt = (index: number, patch: Partial<PayrollConstantPart>) => {
    const next = ratioDraft.parts.map((p, i) => (i === index ? { ...p, ...patch } : p));
    setPartsDraft(next);
  };

  const addConstantPart = () => {
    const label = t('payrollManagement.dialog.newConstantPartLabel');
    const id = createConstantPartId(label, ratioDraft.parts);
    setPartsDraft([...ratioDraft.parts, { id, label, pct: 0 }]);
  };

  const removeConstantPart = (index: number) => {
    if (ratioDraft.parts.length <= 1) return;
    setPartsDraft(ratioDraft.parts.filter((_, i) => i !== index));
  };

  const saveRatioSettings = () => {
    void applyRatiosToList();
  };

  const syncConstantColumnsInOrder = (ratios: PayrollSalaryRatios) => {
    const constFields = ratios.parts.map((p) => constantPartField(p.id));
    const customFields = prefs.customColumns.map((c) => customColumnField(c.id));
    let order = placeConstantPartsAfterOther(
      prefs.order.length > 0 ? prefs.order : [...PAYROLL_DEFAULT_COLUMN_ORDER],
      constFields
    );
    order = placeCustomColumnsAfterTransport(order, customFields);
    persistPrefs({
      ...prefs,
      order: mergeColumnOrder(order, [
        ...PAYROLL_DEFAULT_COLUMN_ORDER,
        ...constFields,
        ...customFields,
      ]),
    });
  };

  const applyRatiosToList = async () => {
    const next = normalizeSalaryRatios(ratioDraft);
    savePayrollSalaryRatios(next, companyId);
    setSalaryRatios(next);
    setRatioDraft(next);
    syncConstantColumnsInOrder(next);
    void persistPayrollGridSettings(companyId, { salaryRatios: next });

    if (!allowCellEdit || rows.length === 0) {
      onSuccess(t('payrollManagement.salaryRatiosSaved'));
      return;
    }

    setApplyingRatios(true);
    onError(null);
    const applyCtx: PayrollRecalcContext = {
      ...recalcCtx,
      salaryRatios: next,
    };
    let ok = 0;
    let fail = 0;
    try {
      for (const row of rows) {
        const period = String(row.working_month || '').trim();
        if (!isRoot && period && lockedPeriods.has(period)) {
          fail += 1;
          continue;
        }
        const updated = applySalaryRatiosToRow(row, next, applyCtx);
        try {
          const payload = gridRowToPayload(updated, applyCtx);
          const scopeCompanyId =
            companyId != null && Number(companyId) > 0 ? Number(companyId) : undefined;
          const res = await payrollService.updatePayroll(
            updated.id,
            payload,
            scopeCompanyId != null ? { company_id: scopeCompanyId } : undefined
          );
          if (res.success) ok += 1;
          else fail += 1;
        } catch {
          fail += 1;
        }
      }
      await onReload();
      if (fail === 0) {
        onSuccess(t('payrollManagement.salaryRatiosApplied', { count: ok }));
        setRatiosOpen(false);
      } else {
        onError(t('payrollManagement.salaryRatiosApplyPartial', { ok, fail }));
      }
    } finally {
      setApplyingRatios(false);
    }
  };

  const ratioSum = ratioDraft.parts.reduce((s, p) => s + p.pct, 0);
  const ratioSumOk = Math.abs(ratioSum - 100) < 0.05;
  const monthStructureLocked = Boolean(payrollMonth && lockedPeriods.has(payrollMonth));

  const PAYROLL_ROW_HEIGHT = 36;
  const PAYROLL_HEADER_HEIGHT = 48;
  const PAYROLL_LIST_BOTTOM_GAP = PAYROLL_ROW_HEIGHT;
  const gridBodyHeight =
    PAYROLL_HEADER_HEIGHT + Math.max(rows.length, 1) * PAYROLL_ROW_HEIGHT + PAYROLL_LIST_BOTTOM_GAP;

  return (
    <>
      <ConfirmDialog
        open={dialogState.open}
        title={dialogState.title}
        message={dialogState.message}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        confirmColor={dialogState.confirmColor}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      <Box
        sx={{
          px: { xs: 1.5, sm: 2 },
          py: 1,
          borderBottom: '1px solid #CBD5E1',
          bgcolor: '#FFFFFF',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon fontSize="small" />}
          onClick={openAddColumnDialog}
          disabled={!allowCellEdit || monthStructureLocked}
          sx={mvsBodyOutlinedBtnSx}
        >
          {t('payrollManagement.actions.addColumn')}
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<ViewColumnIcon fontSize="small" />}
          onClick={() => setManageColumnsOpen(true)}
          disabled={prefs.customColumns.length === 0 || monthStructureLocked}
          sx={mvsBodyOutlinedBtnSx}
        >
          {t('payrollManagement.actions.manageCustomColumns')}
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<ReorderIcon fontSize="small" />}
          onClick={() => setOrderOpen(true)}
          disabled={monthStructureLocked}
          sx={mvsBodyOutlinedBtnSx}
        >
          {t('payrollManagement.actions.reorderColumns')}
        </Button>
        <Button
          size="small"
          variant={allowConstantsEdit ? 'contained' : 'outlined'}
          startIcon={<PercentIcon fontSize="small" />}
          onClick={openRatiosDialog}
          disabled={!allowCellEdit || monthStructureLocked}
          sx={mvsBodyOutlinedBtnSx}
        >
          {t('payrollManagement.actions.editConstants')}
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ ml: { sm: 0.5 } }}>
          {t('payrollManagement.columnToolbarHint')}
          {` · ${t('payrollManagement.salaryRatiosShort', {
            summary: salaryRatios.parts.map((p) => `${p.label} ${p.pct}%`).join(' / '),
          })}`}
        </Typography>
      </Box>

      <Box
      onPasteCapture={handlePaste}
      onCopy={handleCopy}
        sx={{
          width: '100%',
          minWidth: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch',
        }}
      >
      <DataGrid
          apiRef={apiRef}
          key={`${i18n.language}-${prefs.order.join('|')}-${prefs.customColumns.map((c) => `${c.id}:${c.inputMode || 'amount'}:${c.formula || ''}`).join(',')}-${salaryRatios.parts.map((p) => `${p.id}:${p.label}`).join(',')}`}
        rows={rows}
        columns={columns}
        loading={loading}
        getRowId={(r) => r.id}
          isCellEditable={(params) => isCellEditable({ field: params.field, row: params.row as PayrollGridRow })}
        processRowUpdate={processRowUpdate}
        editMode="cell"
          onCellClick={handleCellClick}
        disableRowSelectionOnClick
          checkboxSelection={enableRowSelection}
          rowSelectionModel={
            enableRowSelection
              ? {
                  type: 'include',
                  ids: new Set(selectedRowIds ?? []),
                }
              : undefined
          }
          onRowSelectionModelChange={
            enableRowSelection && onSelectedRowIdsChange
              ? (model: GridRowSelectionModel) => {
                  if (model.type === 'include') {
                    onSelectedRowIdsChange(
                      Array.from(model.ids)
                        .map((id) => Number(id))
                        .filter((id) => Number.isFinite(id) && id > 0)
                    );
                    return;
                  }
                  // exclude: 전체에서 제외분 뺀 나머지
                  const excluded = model.ids;
                  onSelectedRowIdsChange(
                    rows
                      .map((r) => r.id)
                      .filter((id) => !excluded.has(id))
                  );
                }
              : undefined
          }
          disableColumnMenu
          sortingOrder={['asc', 'desc', null]}
          showCellVerticalBorder
          showColumnVerticalBorder
          rowHeight={PAYROLL_ROW_HEIGHT}
          columnHeaderHeight={PAYROLL_HEADER_HEIGHT}
          paginationModel={{ page: 0, pageSize: Math.max(rows.length, 1) }}
          onPaginationModelChange={() => undefined}
          hideFooter
        sx={{
            ...(typeof payrollDataGridSx === 'function' ? payrollDataGridSx(theme) : payrollDataGridSx),
          width: '100%',
            minWidth: gridMinWidth,
            height: gridBodyHeight,
            minHeight: gridBodyHeight,
            maxHeight: gridBodyHeight,
          border: 'none',
            ...(enableRowSelection
              ? {
                  '& .MuiDataGrid-cellCheckbox, & .MuiDataGrid-columnHeaderCheckbox': {
                    minWidth: '42px !important',
                    maxWidth: '42px !important',
                    width: '42px !important',
                    p: 0,
                  },
                }
              : {}),
          }}
        />
      </Box>

      <Dialog
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          resetAddColumnForm();
        }}
        maxWidth="xs"
        fullWidth
        onKeyDown={(e) => e.stopPropagation()}
      >
        <DialogTitle>{t('payrollManagement.dialog.addColumnTitle')}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, pt: 0.5 }}>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label={t('payrollManagement.dialog.columnNameLabel')}
            placeholder="Day shift"
            value={newColumnLabel}
            onChange={(e) => setNewColumnLabel(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
          <FormControl fullWidth size="small">
            <InputLabel id="payroll-add-column-input-mode">
              {t('payrollManagement.dialog.columnInputModeLabel')}
            </InputLabel>
            <Select
              labelId="payroll-add-column-input-mode"
              label={t('payrollManagement.dialog.columnInputModeLabel')}
              value={newColumnInputMode}
              onChange={(e) =>
                setNewColumnInputMode(e.target.value as PayrollCustomColumnInputMode)
              }
            >
              <MenuItem value="amount">{t('payrollManagement.dialog.columnInputModeAmount')}</MenuItem>
              <MenuItem value="count">{t('payrollManagement.dialog.columnInputModeCount')}</MenuItem>
            </Select>
          </FormControl>
          {newColumnInputMode === 'count' ? (
            <TextField
              fullWidth
              margin="dense"
              label={t('payrollManagement.dialog.columnFormulaLabel')}
              placeholder="n * 100"
              value={newColumnFormula}
              onChange={(e) => setNewColumnFormula(e.target.value)}
              helperText={t('payrollManagement.dialog.columnFormulaHint')}
              error={
                Boolean(newColumnFormula.trim()) &&
                !isValidPayrollColumnFormula(normalizePayrollColumnFormula(newColumnFormula))
              }
              onKeyDown={(e) => e.stopPropagation()}
            />
          ) : null}
          <Typography variant="caption" color="text.secondary">
            {t('payrollManagement.dialog.addColumnHint')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setAddOpen(false);
              resetAddColumnForm();
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleAddColumn}
            disabled={
              !newColumnLabel.trim() ||
              (newColumnInputMode === 'count' &&
                !isValidPayrollColumnFormula(normalizePayrollColumnFormula(newColumnFormula)))
            }
          >
            {t('payrollManagement.actions.addColumn')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={editColumnOpen}
        onClose={() => {
          setEditColumnOpen(false);
          setEditColumnDraft(null);
        }}
        maxWidth="xs"
        fullWidth
        onKeyDown={(e) => e.stopPropagation()}
      >
        <DialogTitle>{t('payrollManagement.dialog.editColumnTitle')}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, pt: 0.5 }}>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label={t('payrollManagement.dialog.columnNameLabel')}
            value={editColumnDraft?.label || ''}
            onChange={(e) =>
              setEditColumnDraft((prev) => (prev ? { ...prev, label: e.target.value } : prev))
            }
            onKeyDown={(e) => e.stopPropagation()}
          />
          <FormControl fullWidth size="small">
            <InputLabel id="payroll-edit-column-input-mode">
              {t('payrollManagement.dialog.columnInputModeLabel')}
            </InputLabel>
            <Select
              labelId="payroll-edit-column-input-mode"
              label={t('payrollManagement.dialog.columnInputModeLabel')}
              value={editColumnDraft?.inputMode === 'count' ? 'count' : 'amount'}
              onChange={(e) =>
                setEditColumnDraft((prev) =>
                  prev
                    ? {
                        ...prev,
                        inputMode: e.target.value as PayrollCustomColumnInputMode,
                        formula: e.target.value === 'count' ? prev.formula || 'n * 100' : '',
                      }
                    : prev
                )
              }
            >
              <MenuItem value="amount">{t('payrollManagement.dialog.columnInputModeAmount')}</MenuItem>
              <MenuItem value="count">{t('payrollManagement.dialog.columnInputModeCount')}</MenuItem>
            </Select>
          </FormControl>
          {editColumnDraft?.inputMode === 'count' ? (
            <TextField
              fullWidth
              margin="dense"
              label={t('payrollManagement.dialog.columnFormulaLabel')}
              placeholder="n * 150"
              value={editColumnDraft.formula || ''}
              onChange={(e) =>
                setEditColumnDraft((prev) => (prev ? { ...prev, formula: e.target.value } : prev))
              }
              helperText={t('payrollManagement.dialog.columnFormulaHint')}
              error={
                Boolean(String(editColumnDraft.formula || '').trim()) &&
                !isValidPayrollColumnFormula(
                  normalizePayrollColumnFormula(editColumnDraft.formula)
                )
              }
              onKeyDown={(e) => e.stopPropagation()}
            />
          ) : null}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 2 }}>
          <Button
            color="error"
            onClick={handleDeleteEditColumn}
            disabled={!editColumnDraft}
          >
            {t('payrollManagement.actions.deleteColumn')}
          </Button>
          <Box sx={{ display: 'inline-flex', gap: 1 }}>
            <Button
              onClick={() => {
                setEditColumnOpen(false);
                setEditColumnDraft(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveEditColumn}
              disabled={
                !editColumnDraft?.label.trim() ||
                (editColumnDraft.inputMode === 'count' &&
                  !isValidPayrollColumnFormula(
                    normalizePayrollColumnFormula(editColumnDraft.formula)
                  ))
              }
            >
              {t('common.save')}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      <Dialog
        open={manageColumnsOpen}
        onClose={() => setManageColumnsOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('payrollManagement.dialog.manageCustomColumnsTitle')}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {t('payrollManagement.dialog.manageCustomColumnsHint')}
          </Typography>
          {prefs.customColumns.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t('payrollManagement.empty.noCustomColumns')}
            </Typography>
          ) : (
            <List dense disablePadding>
              {prefs.customColumns.map((column) => (
                <ListItem
                  key={column.id}
                  divider
                  secondaryAction={
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setManageColumnsOpen(false);
                          openEditColumnDialog(column);
                        }}
                        aria-label="edit"
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => confirmRemoveCustomColumn(column)}
                        aria-label="delete"
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  }
                  sx={{ pr: 10 }}
                >
                  <ListItemText
                    primary={column.label}
                    secondary={
                      column.inputMode === 'count' && column.formula
                        ? t('payrollManagement.customColumnFormulaBadge', {
                            formula: column.formula,
                          })
                        : t('payrollManagement.customColumnAmountBadge')
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setManageColumnsOpen(false)}>
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={orderOpen} onClose={() => setOrderOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('payrollManagement.dialog.reorderColumnsTitle')}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {t('payrollManagement.dialog.reorderColumnsHint')}
          </Typography>
          <List dense disablePadding>
            {orderedFieldsForDialog.map((field) => {
              const customId = field.startsWith('custom__') ? field.slice('custom__'.length) : null;
              const customColumn = customId
                ? prefs.customColumns.find((c) => c.id === customId)
                : undefined;
              const lockedEdge = field === 'row_no' || field === 'emp_id' || field === 'actions';
              const customSecondary =
                customColumn?.inputMode === 'count' && customColumn.formula
                  ? t('payrollManagement.customColumnFormulaBadge', {
                      formula: customColumn.formula,
                    })
                  : customId
                    ? t('payrollManagement.customColumnBadge')
                    : undefined;
              return (
                <ListItem
                  key={field}
                  divider
                  secondaryAction={
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                      <IconButton
                        size="small"
                        disabled={lockedEdge}
                        onClick={() => moveColumn(field, -1)}
                        aria-label="up"
                      >
                        <ArrowUpIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        disabled={lockedEdge}
                        onClick={() => moveColumn(field, 1)}
                        aria-label="down"
                      >
                        <ArrowDownIcon fontSize="small" />
                      </IconButton>
                      {customColumn ? (
                        <IconButton
                          size="small"
                          onClick={() => openEditColumnDialog(customColumn)}
                          aria-label="edit"
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      ) : null}
                      {customId ? (
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            const column = prefs.customColumns.find((c) => c.id === customId);
                            if (column) confirmRemoveCustomColumn(column);
                          }}
                          aria-label="delete"
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      ) : null}
                    </Box>
                  }
                  sx={{ pr: 16 }}
                >
                  <ListItemText
                    primary={headerLabelByField.get(field) || field}
                    secondary={customSecondary}
                  />
                </ListItem>
              );
            })}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={resetColumnOrder}>{t('payrollManagement.actions.resetColumnOrder')}</Button>
          <Button variant="contained" onClick={() => setOrderOpen(false)}>
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={ratiosOpen}
        onClose={() => !applyingRatios && setRatiosOpen(false)}
        maxWidth="sm"
        fullWidth
        onKeyDown={(e) => e.stopPropagation()}
      >
        <DialogTitle>{t('payrollManagement.dialog.salaryRatiosTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('payrollManagement.dialog.salaryRatiosHint')}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {ratioDraft.parts.map((part, index) => {
              const isLast = index === ratioDraft.parts.length - 1;
              return (
                <Box
                  key={part.id}
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'flex-start',
                    gap: 1,
                    borderBottom: '1px solid #E2E8F0',
                    pb: 1,
                  }}
                >
                  <TextField
                    size="small"
                    label={t('payrollManagement.dialog.constantNameLabel')}
                    value={part.label}
                    onChange={(e) => updatePartAt(index, { label: e.target.value })}
                    onKeyDown={(e) => e.stopPropagation()}
                    sx={{ flex: '1 1 160px', minWidth: 140 }}
                  />
                  <TextField
                    type="number"
                    size="small"
                    label={t('payrollManagement.dialog.constantPctLabel')}
                    value={part.pct}
                    disabled={isLast && ratioDraft.parts.length > 1}
                    onChange={(e) => updatePartAt(index, { pct: Number(e.target.value) })}
                    inputProps={{ min: 0, max: 100, step: 0.1 }}
                    helperText={
                      isLast && ratioDraft.parts.length > 1
                        ? t('payrollManagement.dialog.otherPctHelper')
                        : undefined
                    }
                    sx={{ width: 120 }}
                    InputProps={{ endAdornment: <Typography variant="body2">%</Typography> }}
                  />
                  <IconButton
                    size="small"
                    color="error"
                    disabled={ratioDraft.parts.length <= 1 || applyingRatios}
                    onClick={() => removeConstantPart(index)}
                    aria-label="delete"
                    sx={{ mt: 0.5 }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Box>
              );
            })}
            <Button
              size="small"
              startIcon={<AddIcon fontSize="small" />}
              onClick={addConstantPart}
              disabled={applyingRatios}
              sx={{ alignSelf: 'flex-start' }}
            >
              {t('payrollManagement.actions.addConstantPart')}
            </Button>
            <Typography
              variant="caption"
              color={ratioSumOk ? 'text.secondary' : 'error'}
              sx={{ fontWeight: ratioSumOk ? 400 : 700 }}
            >
              {t('payrollManagement.dialog.ratioSumLabel', { sum: Math.round(ratioSum * 100) / 100 })}
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={allowConstantsEdit}
                  onChange={(e) => setAllowConstantsEdit(e.target.checked)}
                  size="small"
                />
              }
              label={t('payrollManagement.dialog.allowConstantsCellEdit')}
      />
    </Box>
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 2, pb: 2 }}>
          <Button
            onClick={() => {
              setRatioDraft({
                parts: DEFAULT_SALARY_RATIOS.parts.map((p) => ({ ...p })),
              });
            }}
            disabled={applyingRatios}
          >
            {t('payrollManagement.actions.resetRatios')}
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={() => setRatiosOpen(false)} disabled={applyingRatios}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={saveRatioSettings}
            disabled={applyingRatios || !ratioSumOk || ratioDraft.parts.some((p) => !p.label.trim())}
            variant="outlined"
          >
            {t('payrollManagement.actions.saveRatios')}
          </Button>
          <Button
            onClick={() => void applyRatiosToList()}
            disabled={
              applyingRatios ||
              !ratioSumOk ||
              rows.length === 0 ||
              ratioDraft.parts.some((p) => !p.label.trim())
            }
            variant="contained"
          >
            {t('payrollManagement.actions.applyRatiosToList')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PayrollExcelGrid;
