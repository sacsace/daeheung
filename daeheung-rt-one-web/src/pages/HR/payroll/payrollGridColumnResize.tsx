import React, { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import {
  GridColumnHeaderParams,
  type GridColDef,
} from '@mui/x-data-grid';
import type { PayrollGridRow } from './payrollGridTypes';
import { resolvePayrollColumnWidth } from './payrollGridColumnWidths';

const MIN_COL_WIDTH = 48;

function PayrollColumnHeaderTitle({
  label,
  description,
}: {
  label: string;
  description?: string;
}) {
  return (
    <span
      className="MuiDataGrid-columnHeaderTitle"
      title={description ? String(description) : undefined}
      style={{
        fontWeight: 600,
        whiteSpace: 'pre-line',
        lineHeight: 1.2,
        textAlign: 'center',
        fontSize: '0.7rem',
        overflow: 'visible',
        textOverflow: 'clip',
      }}
    >
      {label}
    </span>
  );
}

function withResizeHeader(
  field: string,
  existing?: GridColDef<PayrollGridRow>['renderHeader']
): GridColDef<PayrollGridRow>['renderHeader'] {
  return (params: GridColumnHeaderParams<PayrollGridRow>) => (
    <Box
      className="payroll-col-header-inner"
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        px: 0.25,
      }}
    >
      {existing ? existing(params) : (
        <PayrollColumnHeaderTitle
          label={params.colDef.headerName ?? ''}
          description={params.colDef.description}
        />
      )}
      <Box
        component="span"
        className="payroll-col-resize-handle"
        data-field={field}
        aria-hidden
        onClick={(e) => e.stopPropagation()}
      />
    </Box>
  );
}

export function applyPayrollColumnWidths(
  columns: GridColDef<PayrollGridRow>[],
  stored: Record<string, number>
): GridColDef<PayrollGridRow>[] {
  return columns.map((col) => {
    const width = resolvePayrollColumnWidth(col, stored);
    const locked =
      col.field === 'row_no' || col.field === 'actions'
        ? { minWidth: width, maxWidth: width }
        : { minWidth: MIN_COL_WIDTH, maxWidth: undefined as number | undefined };
    return {
      ...col,
      flex: 0,
      width,
      ...locked,
      resizable: false,
      renderHeader: withResizeHeader(col.field, col.renderHeader),
    };
  });
}

export function usePayrollColumnResize(
  containerRef: React.RefObject<HTMLElement | null>,
  onWidthChange: (field: string, width: number, persist: boolean) => void,
  getWidth: (field: string) => number
): void {
  const dragRef = useRef<{ field: string; startX: number; startWidth: number } | null>(null);
  const onWidthChangeRef = useRef(onWidthChange);
  const getWidthRef = useRef(getWidth);
  onWidthChangeRef.current = onWidthChange;
  getWidthRef.current = getWidth;

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const onMouseDown = (e: MouseEvent) => {
      const handle = (e.target as HTMLElement).closest('.payroll-col-resize-handle') as HTMLElement | null;
      if (!handle) return;
      const field = handle.dataset.field;
      if (!field) return;
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        field,
        startX: e.clientX,
        startWidth: getWidthRef.current(field),
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    };

    const onMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const next = Math.max(MIN_COL_WIDTH, Math.round(drag.startWidth + e.clientX - drag.startX));
      onWidthChangeRef.current(drag.field, next, false);
    };

    const onMouseUp = () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      onWidthChangeRef.current(drag.field, getWidthRef.current(drag.field), true);
    };

    root.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      root.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [containerRef]);
}
