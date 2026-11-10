import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react';
import { DataGrid, GridColDef, GridRowModel, GridCellParams, useGridApiRef } from '@mui/x-data-grid';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Delete as DeleteIcon,
  DeleteOutline as DeleteOutlineIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { alpha, useTheme } from '@mui/material/styles';
import { mvsBodyPaginationSx } from '../../theme/daeheungLayout';
import ExcelJS from 'exceljs';
import { loginInfoService } from '../../services/api';

const EXCEL_EXPORT_FONT_SIZE = 9;

export type LoginInfoColumnSchema = {
  columns: Array<
    | { kind: 'builtin'; key: string }
    | { kind: 'custom'; id: string; label: string }
  >;
};

/** 표시 너비 추정 (한글 등 비ASCII는 가로 폭을 넉넉히 잡음) */
function measureCellDisplayWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    w += code <= 0xff ? 1 : 2;
  }
  return w;
}

const BUILTIN_KEYS = ['division', 'login_id', 'password', 'open_file_returns', 'url'] as const;
type BuiltinKey = (typeof BUILTIN_KEYS)[number];

const BUILTIN_COL_WIDTH: Record<BuiltinKey, { flex: number; minWidth: number }> = {
  division: { flex: 1, minWidth: 120 },
  login_id: { flex: 1, minWidth: 130 },
  password: { flex: 1, minWidth: 120 },
  open_file_returns: { flex: 1, minWidth: 140 },
  url: { flex: 1.2, minWidth: 180 }
};

const CORE_KEYS: BuiltinKey[] = ['division', 'login_id', 'password'];

function effectiveColumnSchema(
  columnSchema: LoginInfoColumnSchema | null | undefined,
  columnHiddenLegacy: string[] | null | undefined
): LoginInfoColumnSchema {
  if (columnSchema?.columns?.length) {
    return columnSchema;
  }
  const hidden = new Set(columnHiddenLegacy || []);
  return {
    columns: BUILTIN_KEYS.filter((k) => !hidden.has(k)).map((key) => ({ kind: 'builtin' as const, key }))
  };
}

function customFieldName(id: string): string {
  return `x_${id}`;
}

export interface LoginInfoRecord {
  id: number;
  tenant_id: number;
  company_id: number;
  tab_id?: number;
  division: string;
  login_id: string;
  password: string;
  open_file_returns?: string;
  url?: string;
  extra_fields?: Record<string, string> | null;
}

export type LoginInfoGridRow = {
  id: number | string;
  division: string;
  login_id: string;
  password: string;
  open_file_returns: string;
  url: string;
  extra_fields: Record<string, string>;
};

function isTempId(id: GridRowModel['id']): boolean {
  return typeof id === 'string' && id.startsWith('temp-');
}

export type LoginInfoExcelGridHandle = {
  addRow: () => void;
  exportToExcel: () => Promise<void>;
  /** 커스텀 열 추가 다이얼로그 열기 */
  openAddColumnDialog: () => void;
};

export type LoginInfoHeaderFieldKey =
  | 'no'
  | 'division'
  | 'login_id'
  | 'password'
  | 'open_file_returns'
  | 'url'
  | 'actions';

type Props = {
  companyId: number;
  companyName?: string;
  tabId: number;
  /** 파일명·표시용 (탭 이름) */
  tabLabel: string;
  /** 탭에 저장된 커스텀 열 헤더 */
  columnHeaders?: Record<string, string> | null;
  /** 열 구성(추가/삭제 반영). 없으면 columnHiddenLegacy 사용 */
  columnSchema?: LoginInfoColumnSchema | null;
  /** 레거시 숨김 목록(column_schema 없을 때만) */
  columnHiddenLegacy?: string[] | null;
  /** 열 헤더 일부 저장 (서버에서 기존 값과 병합) */
  onColumnHeadersPatch: (patch: Record<string, string>) => Promise<void>;
  /** 열 구성 저장 */
  onColumnSchemaChange: (schema: LoginInfoColumnSchema | null) => Promise<void>;
  loginInfos: LoginInfoRecord[];
  loading: boolean;
  isDark: boolean;
  onReload: () => Promise<void>;
  onError: (message: string | null) => void;
};

function EditableGridHeader(props: {
  label: string;
  isDark: boolean;
  hint: string;
  onCommit: (value: string) => void;
  moveLeftHint?: string;
  moveRightHint?: string;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  removeHint?: string;
  onRemoveColumn?: () => void;
}) {
  const {
    label,
    isDark,
    hint,
    onCommit,
    moveLeftHint,
    moveRightHint,
    onMoveLeft,
    onMoveRight,
    removeHint,
    onRemoveColumn
  } = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  useEffect(() => setDraft(label), [label]);

  if (editing) {
    return (
      <TextField
        autoFocus
        size="small"
        variant="standard"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onCommit(draft);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === 'Escape') {
            setDraft(label);
            setEditing(false);
          }
        }}
        InputProps={{
          sx: {
            color: isDark ? 'rgba(236, 239, 241, 0.98)' : '#64748B',
            fontSize: '0.8125rem',
            fontWeight: 700
          }
        }}
        sx={{ width: '100%', minWidth: 48 }}
      />
    );
  }
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 0.25, minWidth: 0 }}>
      {onMoveLeft && (
        <Tooltip title={moveLeftHint ?? ''}>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onMoveLeft();
            }}
            sx={{ p: 0.2, flexShrink: 0 }}
            aria-label={moveLeftHint}
          >
            <ChevronLeftIcon sx={{ fontSize: '1.1rem' }} />
          </IconButton>
        </Tooltip>
      )}
      {onMoveRight && (
        <Tooltip title={moveRightHint ?? ''}>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onMoveRight();
            }}
            sx={{ p: 0.2, flexShrink: 0 }}
            aria-label={moveRightHint}
          >
            <ChevronRightIcon sx={{ fontSize: '1.1rem' }} />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title={hint}>
        <Box
          component="span"
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          sx={{
            cursor: 'pointer',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block',
            fontWeight: 700,
            fontSize: '0.8125rem',
            color: isDark ? 'rgba(236, 239, 241, 0.98)' : '#64748B',
            lineHeight: 1.2,
            py: 0.25,
            flex: 1,
            minWidth: 0
          }}
        >
          {label}
        </Box>
      </Tooltip>
      {onRemoveColumn && (
        <Tooltip title={removeHint ?? ''}>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveColumn();
            }}
            sx={{ p: 0.25, flexShrink: 0 }}
            aria-label={removeHint}
          >
            <DeleteOutlineIcon sx={{ fontSize: '1rem' }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

const LoginInfoExcelGrid = forwardRef<LoginInfoExcelGridHandle, Props>(function LoginInfoExcelGrid(
  {
    companyId,
    companyName,
    tabId,
    tabLabel,
    columnHeaders,
    columnSchema,
    columnHiddenLegacy,
    onColumnHeadersPatch,
    onColumnSchemaChange,
    loginInfos,
    loading,
    isDark,
    onReload,
    onError
  },
  ref
) {
  const { t } = useTranslation();
  const theme = useTheme();
  const headerHint = t('loginInfoManagement.hints.doubleClickHeader');

  const defaultHeaderLabels = useMemo(
    () => ({
      no: 'No',
      division: t('loginInfoManagement.fields.division'),
      login_id: t('loginInfoManagement.fields.loginId'),
      password: t('loginInfoManagement.fields.password'),
      open_file_returns: t('loginInfoManagement.fields.openFileReturns'),
      url: 'URL',
      actions: t('loginInfoManagement.fields.actions')
    }),
    [t]
  );

  const mergedHeaderLabels = useMemo(() => {
    const ch = columnHeaders || {};
    return {
      no: ch.no || defaultHeaderLabels.no,
      division: ch.division || defaultHeaderLabels.division,
      login_id: ch.login_id || defaultHeaderLabels.login_id,
      password: ch.password || defaultHeaderLabels.password,
      open_file_returns: ch.open_file_returns || defaultHeaderLabels.open_file_returns,
      url: ch.url || defaultHeaderLabels.url,
      actions: ch.actions || defaultHeaderLabels.actions
    };
  }, [columnHeaders, defaultHeaderLabels]);

  const resolvedSchema = useMemo(
    () => effectiveColumnSchema(columnSchema, columnHiddenLegacy),
    [columnSchema, columnHiddenLegacy]
  );

  const pasteFieldOrder = useMemo(() => {
    const out: string[] = [];
    for (const col of resolvedSchema.columns) {
      if (col.kind === 'builtin') out.push(col.key);
      else out.push(customFieldName(col.id));
    }
    return out;
  }, [resolvedSchema]);

  const commitHeader = useCallback(
    async (field: LoginInfoHeaderFieldKey, value: string) => {
      const def = defaultHeaderLabels[field];
      const trimmed = value.trim();
      const patch = { [field]: trimmed === def || !trimmed ? '' : trimmed };
      try {
        onError(null);
        await onColumnHeadersPatch(patch);
      } catch (e: any) {
        onError(e?.message || t('loginInfoManagement.errors.saveTabFailed'));
      }
    },
    [defaultHeaderLabels, onColumnHeadersPatch, onError, t]
  );

  const [addColumnDialogOpen, setAddColumnDialogOpen] = useState(false);
  const [newColumnLabel, setNewColumnLabel] = useState('');
  const [listViewMode, setListViewMode] = useState<'page' | 'all'>('page');
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 15 });

  const handleRemoveColumnEntry = useCallback(
    async (entry: LoginInfoColumnSchema['columns'][0]) => {
      if (entry.kind === 'builtin' && CORE_KEYS.includes(entry.key as BuiltinKey)) {
        onError(t('loginInfoManagement.errors.cannotRemoveCoreColumn'));
        return;
      }
      const nextCols = resolvedSchema.columns.filter((c) => {
        if (c.kind !== entry.kind) return true;
        if (c.kind === 'builtin' && entry.kind === 'builtin') return c.key !== entry.key;
        if (c.kind === 'custom' && entry.kind === 'custom') return c.id !== entry.id;
        return true;
      });
      if (nextCols.length === 0) {
        onError(t('loginInfoManagement.errors.cannotRemoveLastColumn'));
        return;
      }
      try {
        onError(null);
        await onColumnSchemaChange({ columns: nextCols });
      } catch (e: any) {
        onError(e?.message || t('loginInfoManagement.errors.saveTabFailed'));
      }
    },
    [onColumnSchemaChange, onError, resolvedSchema.columns, t]
  );

  const handleMoveColumn = useCallback(
    async (fromIndex: number, direction: -1 | 1) => {
      const cols = [...resolvedSchema.columns];
      const toIndex = fromIndex + direction;
      if (toIndex < 0 || toIndex >= cols.length) return;
      const next = [...cols];
      const a = next[fromIndex]!;
      const b = next[toIndex]!;
      next[fromIndex] = b;
      next[toIndex] = a;
      try {
        onError(null);
        await onColumnSchemaChange({ columns: next });
      } catch (e: any) {
        onError(e?.message || t('loginInfoManagement.errors.saveTabFailed'));
      }
    },
    [onColumnSchemaChange, onError, resolvedSchema.columns, t]
  );

  const handleAddCustomColumn = useCallback(async () => {
    const label = newColumnLabel.trim();
    if (!label || label.length > 80) {
      onError(t('loginInfoManagement.errors.columnLabelInvalid'));
      return;
    }
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
            const r = (Math.random() * 16) | 0;
            const v = ch === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
    const next: LoginInfoColumnSchema = {
      columns: [...resolvedSchema.columns, { kind: 'custom', id, label }]
    };
    try {
      onError(null);
      await onColumnSchemaChange(next);
      setAddColumnDialogOpen(false);
      setNewColumnLabel('');
    } catch (e: any) {
      onError(e?.message || t('loginInfoManagement.errors.saveTabFailed'));
    }
  }, [newColumnLabel, onColumnSchemaChange, onError, resolvedSchema.columns, t]);

  const commitCustomColumnLabel = useCallback(
    async (id: string, value: string) => {
      const trimmed = value.trim();
      if (!trimmed || trimmed.length > 80) {
        onError(t('loginInfoManagement.errors.columnLabelInvalid'));
        return;
      }
      const next: LoginInfoColumnSchema = {
        columns: resolvedSchema.columns.map((c) =>
          c.kind === 'custom' && c.id === id ? { ...c, label: trimmed } : c
        )
      };
      try {
        onError(null);
        await onColumnSchemaChange(next);
      } catch (e: any) {
        onError(e?.message || t('loginInfoManagement.errors.saveTabFailed'));
      }
    },
    [onColumnSchemaChange, onError, resolvedSchema.columns, t]
  );

  const apiRef = useGridApiRef();
  const tempIdRef = useRef(0);
  const lastFocusRef = useRef<{ rowId: string | number; field: string } | null>(null);

  const makeTempId = useCallback(() => {
    tempIdRef.current += 1;
    return `temp-${tempIdRef.current}`;
  }, []);

  const buildRows = useCallback((infos: LoginInfoRecord[]): LoginInfoGridRow[] => {
    return infos.map((i) => {
      const extra = { ...(i.extra_fields && typeof i.extra_fields === 'object' ? i.extra_fields : {}) };
      return {
        id: i.id,
        division: i.division ?? '',
        login_id: i.login_id ?? '',
        password: i.password ?? '',
        open_file_returns: i.open_file_returns ?? '',
        url: i.url ?? '',
        extra_fields: extra
      };
    });
  }, []);

  const [rows, setRows] = useState<LoginInfoGridRow[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteRow, setPendingDeleteRow] = useState<LoginInfoGridRow | null>(null);

  useEffect(() => {
    setRows(buildRows(loginInfos));
  }, [loginInfos, buildRows]);

  useEffect(() => {
    if (listViewMode === 'all') {
      setPaginationModel({ page: 0, pageSize: Math.max(rows.length, 1) });
    } else {
      setPaginationModel({ page: 0, pageSize: 15 });
    }
  }, [listViewMode, rows.length]);

  const rowIsBlank = useCallback((row: LoginInfoGridRow) => {
    const ex = row.extra_fields || {};
    const extraNonEmpty = Object.values(ex).some((v) => String(v ?? '').trim());
    return (
      !String(row.division ?? '').trim() &&
      !String(row.login_id ?? '').trim() &&
      !String(row.password ?? '').trim() &&
      !String(row.open_file_returns ?? '').trim() &&
      !String(row.url ?? '').trim() &&
      !extraNonEmpty
    );
  }, []);

  const persistRow = useCallback(
    async (newRow: LoginInfoGridRow, oldRow: LoginInfoGridRow): Promise<LoginInfoGridRow> => {
      if (rowIsBlank(newRow)) {
        return newRow;
      }

      const division = String(newRow.division ?? '').trim();
      const login_id = String(newRow.login_id ?? '').trim();
      const password = String(newRow.password ?? '').trim();
      const open_file_returns = String(newRow.open_file_returns ?? '').trim() || null;
      const url = String(newRow.url ?? '').trim() || null;

      if (!division || !login_id || !password) {
        return newRow;
      }

      const payload: Record<string, unknown> = {
        company_id: companyId,
        tab_id: tabId,
        division,
        login_id,
        password,
        open_file_returns,
        url,
        extra_fields: Object.keys(newRow.extra_fields || {}).length ? newRow.extra_fields : null
      };

      if (isTempId(newRow.id)) {
        const res = (await loginInfoService.createLoginInfo(payload)) as {
          success?: boolean;
          data?: LoginInfoRecord;
          message?: string;
        };
        if (!res?.success || !res.data) {
          throw new Error(res?.message || t('loginInfoManagement.errors.saveFailed'));
        }
        const d = res.data;
        const ex = { ...(d.extra_fields && typeof d.extra_fields === 'object' ? d.extra_fields : {}) };
        return {
          id: d.id,
          division: d.division ?? '',
          login_id: d.login_id ?? '',
          password: d.password ?? '',
          open_file_returns: d.open_file_returns ?? '',
          url: d.url ?? '',
          extra_fields: ex
        };
      }

      const res = (await loginInfoService.updateLoginInfo(Number(newRow.id), payload)) as {
        success?: boolean;
        data?: LoginInfoRecord;
        message?: string;
      };
      if (!res?.success) {
        throw new Error(res?.message || t('loginInfoManagement.errors.saveFailed'));
      }
      const d = res.data;
      if (d) {
        const ex = { ...(d.extra_fields && typeof d.extra_fields === 'object' ? d.extra_fields : {}) };
        return {
          id: d.id,
          division: d.division ?? '',
          login_id: d.login_id ?? '',
          password: d.password ?? '',
          open_file_returns: d.open_file_returns ?? '',
          url: d.url ?? '',
          extra_fields: ex
        };
      }
      return {
        ...newRow,
        division,
        login_id,
        password,
        open_file_returns: open_file_returns ?? '',
        url: url ?? '',
        extra_fields: newRow.extra_fields || {}
      };
    },
    [companyId, tabId, rowIsBlank, t]
  );

  const processRowUpdate = useCallback(
    async (newRow: GridRowModel, oldRow: GridRowModel) => {
      const nr = newRow as LoginInfoGridRow;
      const or = oldRow as LoginInfoGridRow;
      try {
        onError(null);
        return await persistRow(nr, or);
      } catch (e: any) {
        const msg = e?.message || t('loginInfoManagement.errors.saveFailed');
        onError(msg);
        throw e;
      }
    },
    [onError, persistRow, t]
  );

  const handleDelete = useCallback(
    (row: LoginInfoGridRow) => {
      if (isTempId(row.id)) {
        setRows((prev) =>
          prev.map((r) =>
            r.id === row.id
              ? {
                  id: makeTempId(),
                  division: '',
                  login_id: '',
                  password: '',
                  open_file_returns: '',
                  url: '',
                  extra_fields: {}
                }
              : r
          )
        );
        return;
      }
      setPendingDeleteRow(row);
      setDeleteDialogOpen(true);
    },
    [makeTempId]
  );

  const confirmDeleteRow = useCallback(async () => {
    if (!pendingDeleteRow || isTempId(pendingDeleteRow.id)) {
      setDeleteDialogOpen(false);
      setPendingDeleteRow(null);
      return;
    }
    try {
      onError(null);
      await loginInfoService.deleteLoginInfo(Number(pendingDeleteRow.id));
      await onReload();
      setDeleteDialogOpen(false);
      setPendingDeleteRow(null);
    } catch (e: any) {
      onError(e?.response?.data?.message || t('loginInfoManagement.errors.deleteFailed'));
    }
  }, [onError, onReload, pendingDeleteRow, t]);

  const addEmptyRow = useCallback(() => {
    setRows((prev) => [
      ...prev,
      {
        id: makeTempId(),
        division: '',
        login_id: '',
        password: '',
        open_file_returns: '',
        url: '',
        extra_fields: {}
      }
    ]);
  }, [makeTempId]);

  const exportToExcel = useCallback(async () => {
    const dataRows = rows.filter((r) => !rowIsBlank(r));
    if (dataRows.length === 0) {
      onError(t('loginInfoManagement.errors.nothingToExport'));
      return;
    }
    onError(null);
    const labels = mergedHeaderLabels as Record<string, string>;
    const header: string[] = [];
    for (const col of resolvedSchema.columns) {
      if (col.kind === 'builtin') header.push(labels[col.key] ?? col.key);
      else header.push(col.label);
    }
    if (header.length === 0) {
      onError(t('loginInfoManagement.errors.nothingToExport'));
      return;
    }
    const body = dataRows.map((r) =>
      resolvedSchema.columns.map((col) => {
        if (col.kind === 'builtin') return String((r as Record<string, unknown>)[col.key] ?? '');
        return String(r.extra_fields?.[col.id] ?? '');
      })
    );
    const aoa: string[][] = [header, ...body];

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('LoginInfo', {
      views: [{ showGridLines: true }]
    });

    const font = { name: 'Calibri', size: EXCEL_EXPORT_FONT_SIZE };

    aoa.forEach((rowValues) => {
      const row = sheet.addRow(rowValues);
      row.eachCell((cell) => {
        cell.font = font;
      });
    });

    const numCols = header.length;
    for (let c = 1; c <= numCols; c++) {
      let maxW = 0;
      for (let r = 0; r < aoa.length; r++) {
        const cellText = String(aoa[r][c - 1] ?? '');
        maxW = Math.max(maxW, measureCellDisplayWidth(cellText));
      }
      const width = Math.min(Math.max(maxW * 1.05 + 2.5, 9), 85);
      sheet.getColumn(c).width = width;
    }

    const buf = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const safe = String(companyName || 'export')
      .replace(/[\\/:*?"<>|]/g, '_')
      .trim()
      .slice(0, 80);
    const dateStr = new Date().toISOString().slice(0, 10);
    const tabSlug = String(tabLabel || `tab_${tabId}`)
      .replace(/[\\/:*?"<>|]/g, '_')
      .trim()
      .slice(0, 48);
    const filename = `${safe}_${tabSlug}_${dateStr}.xlsx`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [companyName, mergedHeaderLabels, onError, resolvedSchema.columns, rowIsBlank, rows, tabId, tabLabel, t]);

  const openAddColumnDialog = useCallback(() => {
    setAddColumnDialogOpen(true);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      addRow: addEmptyRow,
      exportToExcel,
      openAddColumnDialog
    }),
    [addEmptyRow, exportToExcel, openAddColumnDialog]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('.MuiDataGrid-columnHeader') || el.closest('.MuiDataGrid-columnSeparator')) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const text = e.clipboardData?.getData('text/plain');
      if (!text) return;

      const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
      const matrix = lines.filter((line) => line.length > 0).map((line) => line.split('\t'));
      if (matrix.length === 0) return;

      setRows((prev) => {
        const snapshot = prev.map((r) => ({ ...r }));
        const next = [...prev];

        let startRowIdx = 0;
        let startColIdx = 0;
        const anchor = lastFocusRef.current;
        if (anchor) {
          const ri = next.findIndex((r) => r.id === anchor.rowId);
          startRowIdx = ri >= 0 ? ri : 0;
          const fi = pasteFieldOrder.indexOf(anchor.field);
          startColIdx = fi >= 0 ? fi : 0;
        }

        const needed = startRowIdx + matrix.length;
        while (next.length < needed) {
          next.push({
            id: makeTempId(),
            division: '',
            login_id: '',
            password: '',
            open_file_returns: '',
            url: '',
            extra_fields: {}
          });
        }

        for (let r = 0; r < matrix.length; r++) {
          const cells = matrix[r];
          const ri = startRowIdx + r;
          let row = { ...next[ri] };
          const xf = { ...(row.extra_fields || {}) };
          for (let c = 0; c < cells.length; c++) {
            const ci = startColIdx + c;
            if (ci >= pasteFieldOrder.length) break;
            const field = pasteFieldOrder[ci];
            if (field.startsWith('x_')) {
              const cid = field.slice(2);
              xf[cid] = cells[c] ?? '';
            } else {
              const v = cells[c] ?? '';
              switch (field) {
                case 'division':
                  row.division = v;
                  break;
                case 'login_id':
                  row.login_id = v;
                  break;
                case 'password':
                  row.password = v;
                  break;
                case 'open_file_returns':
                  row.open_file_returns = v;
                  break;
                case 'url':
                  row.url = v;
                  break;
                default:
                  break;
              }
            }
          }
          row.extra_fields = xf;
          next[ri] = row;
        }

        void (async () => {
          for (let r = 0; r < matrix.length; r++) {
            const ri = startRowIdx + r;
            const newRow = next[ri];
            const oldRow =
              snapshot[ri] ??
              ({
                id: newRow.id,
                division: '',
                login_id: '',
                password: '',
                open_file_returns: '',
                url: '',
                extra_fields: {}
              } as LoginInfoGridRow);
            try {
              onError(null);
              const saved = await persistRow(newRow, oldRow);
              setRows((cur) => {
                const copy = [...cur];
                if (ri < copy.length) copy[ri] = saved;
                return copy;
              });
            } catch (err: any) {
              onError(err?.message || t('loginInfoManagement.errors.saveFailed'));
            }
          }
        })();

        return next;
      });
    },
    [makeTempId, onError, pasteFieldOrder, persistRow, t]
  );

  const removeColHint = t('loginInfoManagement.hints.removeColumn');
  const moveColLeftHint = t('loginInfoManagement.hints.moveColumnLeft');
  const moveColRightHint = t('loginInfoManagement.hints.moveColumnRight');
  const schemaColCount = resolvedSchema.columns.length;

  const columns: GridColDef<LoginInfoGridRow>[] = useMemo(() => {
    const noCol: GridColDef<LoginInfoGridRow> = {
      field: 'no',
      headerName: mergedHeaderLabels.no,
      width: 56,
      sortable: false,
      editable: false,
      disableColumnMenu: true,
      renderHeader: () => (
        <EditableGridHeader
          label={mergedHeaderLabels.no}
          isDark={isDark}
          hint={headerHint}
          onCommit={(v) => void commitHeader('no', v)}
        />
      ),
      valueGetter: (_v, row) => {
        const i = rows.findIndex((r) => r.id === row.id);
        return i >= 0 ? i + 1 : '';
      }
    };

    const dataCols: GridColDef<LoginInfoGridRow>[] = resolvedSchema.columns.map((entry, colIndex) => {
      const canMoveLeft = colIndex > 0;
      const canMoveRight = colIndex < schemaColCount - 1;
      if (entry.kind === 'builtin') {
        const k = entry.key as BuiltinKey;
        const w = BUILTIN_COL_WIDTH[k];
        const canRemove = !CORE_KEYS.includes(k);
        return {
          field: k,
          headerName: mergedHeaderLabels[k],
          flex: w.flex,
          minWidth: w.minWidth,
          editable: true,
          disableColumnMenu: true,
          renderHeader: () => (
            <EditableGridHeader
              label={mergedHeaderLabels[k]}
              isDark={isDark}
              hint={headerHint}
              onCommit={(v) => void commitHeader(k, v)}
              moveLeftHint={moveColLeftHint}
              moveRightHint={moveColRightHint}
              onMoveLeft={canMoveLeft ? () => void handleMoveColumn(colIndex, -1) : undefined}
              onMoveRight={canMoveRight ? () => void handleMoveColumn(colIndex, 1) : undefined}
              removeHint={removeColHint}
              onRemoveColumn={canRemove ? () => void handleRemoveColumnEntry(entry) : undefined}
            />
          )
        };
      }
      const fn = customFieldName(entry.id);
      return {
        field: fn,
        headerName: entry.label,
        flex: 1,
        minWidth: 120,
        editable: true,
        disableColumnMenu: true,
        valueGetter: (_v, row) => row.extra_fields?.[entry.id] ?? '',
        valueSetter: (value, row) => ({
          ...row,
          extra_fields: { ...row.extra_fields, [entry.id]: String(value ?? '') }
        }),
        renderHeader: () => (
          <EditableGridHeader
            label={entry.label}
            isDark={isDark}
            hint={headerHint}
            onCommit={(v) => void commitCustomColumnLabel(entry.id, v)}
            moveLeftHint={moveColLeftHint}
            moveRightHint={moveColRightHint}
            onMoveLeft={canMoveLeft ? () => void handleMoveColumn(colIndex, -1) : undefined}
            onMoveRight={canMoveRight ? () => void handleMoveColumn(colIndex, 1) : undefined}
            removeHint={removeColHint}
            onRemoveColumn={() => void handleRemoveColumnEntry(entry)}
          />
        )
      };
    });

    const actionsCol: GridColDef<LoginInfoGridRow> = {
      field: 'actions',
      headerName: mergedHeaderLabels.actions,
      width: 72,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderHeader: () => (
        <EditableGridHeader
          label={mergedHeaderLabels.actions}
          isDark={isDark}
          hint={headerHint}
          onCommit={(v) => void commitHeader('actions', v)}
        />
      ),
      renderCell: (params) => (
        <Tooltip title={t('loginInfoManagement.actions.delete')}>
          <IconButton
            className="login-info-delete-btn"
            size="small"
            onClick={() => void handleDelete(params.row)}
            aria-label={t('loginInfoManagement.actions.delete')}
            sx={{
              color: alpha(theme.palette.text.secondary, theme.palette.mode === 'light' ? 0.72 : 1),
              borderRadius: '10px',
              transition: 'color 0.15s ease, background-color 0.15s ease',
              '&:hover': {
                color: 'error.main',
                bgcolor: alpha(theme.palette.error.main, 0.12),
              },
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )
    };
    return [noCol, ...dataCols, actionsCol];
  }, [
    commitCustomColumnLabel,
    commitHeader,
    handleDelete,
    handleMoveColumn,
    handleRemoveColumnEntry,
    headerHint,
    isDark,
    mergedHeaderLabels,
    moveColLeftHint,
    moveColRightHint,
    removeColHint,
    resolvedSchema.columns,
    schemaColCount,
    rows,
    t,
    theme
  ]);

  const headerBgLight = '#F1F5F9';
  const headerFgLight = '#475569';
  const headerBorderBottomLight = '#A8B4C0';
  const rowHoverLight = '#EFF6FF';

  return (
    <Box onPaste={handlePaste} sx={{ width: '100%' }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 0.75,
          mb: 1,
        }}
      >
        <Button
          size="small"
          disableElevation
          variant={listViewMode === 'all' ? 'contained' : 'outlined'}
          onClick={() => setListViewMode('all')}
          sx={{
            height: 32,
            minWidth: 0,
            px: 1.5,
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.75rem',
            borderRadius: '10px',
            boxShadow: 'none',
            whiteSpace: 'nowrap',
            ...(listViewMode === 'all'
              ? { bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' } }
              : { borderColor: '#CBD5E1', color: 'text.secondary', bgcolor: '#FFFFFF' }),
          }}
        >
          {t('loginInfoManagement.listView.viewAll')}
        </Button>
        <Button
          size="small"
          disableElevation
          variant={listViewMode === 'page' ? 'contained' : 'outlined'}
          onClick={() => setListViewMode('page')}
          sx={{
            height: 32,
            minWidth: 0,
            px: 1.5,
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.75rem',
            borderRadius: '10px',
            boxShadow: 'none',
            whiteSpace: 'nowrap',
            ...(listViewMode === 'page'
              ? { bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' } }
              : { borderColor: '#CBD5E1', color: 'text.secondary', bgcolor: '#FFFFFF' }),
          }}
        >
          {t('loginInfoManagement.listView.viewPages')}
        </Button>
      </Box>
      <DataGrid
        apiRef={apiRef}
        rows={rows}
        columns={columns}
        loading={loading}
        getRowId={(r) => r.id}
        editMode="cell"
        processRowUpdate={processRowUpdate}
        disableColumnMenu
        disableRowSelectionOnClick
        pagination
        pageSizeOptions={listViewMode === 'page' ? [15] : [Math.max(rows.length, 1)]}
        paginationModel={paginationModel}
        onPaginationModelChange={(model) => {
          if (listViewMode === 'page') {
            setPaginationModel(model);
          }
        }}
        hideFooter={listViewMode === 'all'}
        rowHeight={40}
        columnHeaderHeight={40}
        onCellClick={(params: GridCellParams<LoginInfoGridRow>) => {
          if (params.field !== 'actions' && params.field !== 'no') {
            lastFocusRef.current = { rowId: params.id, field: params.field };
          }
        }}
        sx={{
          border: 'none',
          fontSize: '0.8125rem',
          ...(isDark
            ? {
                '&.MuiDataGrid-root': {
                  border: '1px solid rgba(255,255,255,0.12)',
                },
              }
            : {}),
          '& .MuiDataGrid-columnHeaders': isDark
            ? {
                backgroundColor: 'rgba(69, 90, 100, 0.55)',
                borderBottom: '2px solid rgba(144, 164, 174, 0.45)',
                boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.25)',
              }
            : {
                backgroundColor: headerBgLight,
                borderBottom: `1px solid ${headerBorderBottomLight}`,
                borderTop: '2px solid',
                borderTopColor: 'primary.main',
                boxShadow: 'none',
              },
          '& .MuiDataGrid-columnHeadersInner': isDark
            ? { backgroundColor: 'rgba(69, 90, 100, 0.55)' }
            : { backgroundColor: headerBgLight },
          '& .MuiDataGrid-columnSeparator': isDark
            ? {
                backgroundColor: 'rgba(69, 90, 100, 0.55)',
                '&:hover': { backgroundColor: 'rgba(90, 115, 128, 0.75)' },
              }
            : {
                backgroundColor: headerBgLight,
                '&:hover': { backgroundColor: 'rgba(100, 116, 139, 0.14)' },
              },
          '& .MuiDataGrid-columnHeader': isDark
            ? {
                backgroundColor: 'rgba(69, 90, 100, 0.55)',
                borderRight: '1px solid rgba(255,255,255,0.1)',
                '&:last-of-type': { borderRight: 'none' },
                '&:focus, &:focus-within': { backgroundColor: 'rgba(69, 90, 100, 0.55)' },
              }
            : {
                backgroundColor: headerBgLight,
                borderRight: 'none',
                '&:last-of-type': { borderRight: 'none' },
                '&:focus, &:focus-within': { backgroundColor: headerBgLight },
              },
          '& .MuiDataGrid-cell': isDark
            ? { borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(245,248,255,0.92)' }
            : undefined,
          '& .MuiDataGrid-columnHeaderTitle': isDark
            ? { color: 'rgba(236, 239, 241, 0.98)', fontWeight: 600 }
            : { color: headerFgLight, fontWeight: 600 },
          '& .MuiDataGrid-row': isDark
            ? { backgroundColor: 'transparent' }
            : { backgroundColor: '#FFFFFF' },
          '& .MuiDataGrid-row:hover': {
            backgroundColor: isDark ? 'rgba(129, 180, 255, 0.12)' : rowHoverLight,
          },
          '& .MuiDataGrid-row:hover .login-info-delete-btn:not(.Mui-disabled)': {
            color: 'error.main',
            bgcolor: alpha(theme.palette.error.main, 0.08),
          },
          '& .MuiDataGrid-cell:focus': {
            outline: isDark ? '1px solid rgba(138,181,255,0.7)' : undefined,
          },
          '& .MuiDataGrid-footerContainer': {
            ...mvsBodyPaginationSx,
            borderTop: 'none',
            minHeight: 48,
          },
          '& .MuiTablePagination-root': {
            overflow: 'visible',
          },
          '& .MuiPaginationItem-root': {
            borderRadius: '10px',
            fontWeight: 500,
          },
        }}
      />

      <Dialog
        open={addColumnDialogOpen}
        onClose={() => {
          setAddColumnDialogOpen(false);
          setNewColumnLabel('');
        }}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: isDark
            ? {
                bgcolor: 'rgba(10, 20, 44, 0.98)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                backgroundImage: 'none'
              }
            : undefined
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: 600,
            ...(isDark ? { color: 'rgba(245, 248, 255, 0.95)' } : {})
          }}
        >
          {t('loginInfoManagement.dialog.addColumnTitle')}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={t('loginInfoManagement.fields.columnName')}
            fullWidth
            value={newColumnLabel}
            onChange={(e) => setNewColumnLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleAddCustomColumn()}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setAddColumnDialogOpen(false);
              setNewColumnLabel('');
            }}
          >
            {t('loginInfoManagement.actions.cancel')}
          </Button>
          <Button variant="contained" onClick={() => void handleAddCustomColumn()}>
            {t('loginInfoManagement.actions.add')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setPendingDeleteRow(null);
        }}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: isDark
            ? {
                bgcolor: 'rgba(10, 20, 44, 0.98)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                backgroundImage: 'none'
              }
            : undefined
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: 600,
            ...(isDark ? { color: 'rgba(245, 248, 255, 0.95)' } : {})
          }}
        >
          {t('loginInfoManagement.dialog.deleteRowTitle')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: isDark ? 'rgba(200, 214, 235, 0.92)' : 'text.secondary' }}>
            {t('loginInfoManagement.confirm.delete')}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setDeleteDialogOpen(false);
              setPendingDeleteRow(null);
            }}
          >
            {t('loginInfoManagement.actions.cancel')}
          </Button>
          <Button color="error" variant="contained" onClick={() => void confirmDeleteRow()}>
            {t('loginInfoManagement.actions.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

export default LoginInfoExcelGrid;
