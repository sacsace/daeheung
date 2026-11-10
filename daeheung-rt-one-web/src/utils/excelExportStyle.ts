import ExcelJS from 'exceljs';

/** MSV Excel export standard font size */
export const EXCEL_EXPORT_FONT_SIZE = 9;

/** Approximate Excel column width units for CJK + ASCII */
export const measureCellDisplayWidth = (s: string): number => {
  let w = 0;
  for (const ch of String(s ?? '')) {
    w += ch.charCodeAt(0) > 255 ? 2 : 1;
  }
  return w;
};

const cellToDisplayText = (value: ExcelJS.CellValue): string => {
  if (value == null) return '';
  if (typeof value === 'object') {
    if ('text' in value && (value as { text?: string }).text != null) {
      return String((value as { text?: string }).text);
    }
    if ('result' in value && (value as { result?: unknown }).result != null) {
      return String((value as { result?: unknown }).result);
    }
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value);
  }
  return String(value);
};

/** Font 9 + column widths that fit content (no wrap / no collapsed rows) */
export const applyExcelFontAndAutoWidth = (
  sheet: ExcelJS.Worksheet,
  options?: { rowHeight?: number }
) => {
  const font = { name: 'Calibri', size: EXCEL_EXPORT_FONT_SIZE };
  const rowHeight = options?.rowHeight ?? 15;
  let maxCol = 0;

  sheet.properties.outlineLevelRow = 0;
  sheet.properties.outlineLevelCol = 0;

  sheet.eachRow({ includeEmpty: false }, (row) => {
    row.hidden = false;
    row.outlineLevel = 0;
    row.height = rowHeight;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      maxCol = Math.max(maxCol, colNumber);
      cell.font = { ...(cell.font || {}), ...font };
      cell.alignment = {
        ...(cell.alignment || {}),
        vertical: 'middle',
        horizontal: 'left',
        wrapText: false,
        shrinkToFit: false,
      };
    });
  });

  for (let c = 1; c <= maxCol; c += 1) {
    let maxW = 0;
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cell = row.getCell(c);
      maxW = Math.max(maxW, measureCellDisplayWidth(cellToDisplayText(cell.value)));
    });
    // Wide enough for long log context; still capped so Excel stays usable
    sheet.getColumn(c).width = Math.min(Math.max(maxW * 1.05 + 2.5, 9), 120);
  }
};

export const downloadExcelWorkbook = async (
  workbook: ExcelJS.Workbook,
  fileName: string,
  options?: { rowHeight?: number }
) => {
  workbook.eachSheet((sheet) => applyExcelFontAndAutoWidth(sheet, options));
  const buf = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};

export const addSheetFromAoA = (
  workbook: ExcelJS.Workbook,
  name: string,
  rows: Array<Array<string | number | null | undefined>>
) => {
  const sheet = workbook.addWorksheet(name.slice(0, 31));
  rows.forEach((row) => {
    sheet.addRow(row.map((v) => (v == null ? '' : v)));
  });
  return sheet;
};

/** Object rows → sheet (header from first object keys) */
export const addSheetFromObjects = (
  workbook: ExcelJS.Workbook,
  name: string,
  rows: Array<Record<string, string | number | null | undefined>>
) => {
  if (!rows.length) {
    return addSheetFromAoA(workbook, name, [['(empty)']]);
  }
  const keys = Object.keys(rows[0]);
  return addSheetFromAoA(workbook, name, [
    keys,
    ...rows.map((r) => keys.map((k) => (r[k] == null ? '' : r[k]))),
  ]);
};
