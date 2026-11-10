import * as XLSX from 'xlsx';
import { SapRawRow } from './types';

export type ParsedSapSheet = {
  sheetName: string;
  headers: string[];
  rows: Iterable<SapRawRow>;
};

const cellText = (sheet: XLSX.WorkSheet, address: string): string => {
  const cell = sheet[address];
  if (!cell) return '';
  return String(XLSX.utils.format_cell(cell) ?? '').trim();
};

/**
 * XLSX/CSV는 서버에서만 읽는다. 워크시트 행을 generator로 노출해 이후 Batch 서비스가
 * 소규모 청크 단위로 저장할 수 있게 한다.
 */
export const parseSapWorkbook = (
  file: Buffer,
  options: { sheetName?: string; headerRowNumber?: number } = {}
): ParsedSapSheet => {
  const workbook = XLSX.read(file, {
    type: 'buffer',
    cellDates: false,
    raw: false,
    dense: false,
  });
  const sheetName = options.sheetName || workbook.SheetNames[0];
  if (!sheetName || !workbook.Sheets[sheetName]) {
    throw new Error('읽을 수 있는 SAP 워크시트를 찾을 수 없습니다.');
  }

  const sheet = workbook.Sheets[sheetName];
  const rangeRef = sheet['!ref'];
  if (!rangeRef) {
    throw new Error('SAP 파일에 데이터가 없습니다.');
  }

  const range = XLSX.utils.decode_range(rangeRef);
  const headerRowIndex = Math.max(0, (options.headerRowNumber ?? 1) - 1);
  if (headerRowIndex > range.e.r) {
    throw new Error('설정된 헤더 행이 파일 범위를 벗어났습니다.');
  }

  const headers: string[] = [];
  const seenHeaders = new Set<string>();
  for (let column = range.s.c; column <= range.e.c; column += 1) {
    const header = cellText(sheet, XLSX.utils.encode_cell({ r: headerRowIndex, c: column }));
    if (!header) continue;
    if (seenHeaders.has(header)) {
      throw new Error(`중복된 SAP 컬럼명입니다: ${header}`);
    }
    headers.push(header);
    seenHeaders.add(header);
  }
  if (headers.length === 0) {
    throw new Error('SAP 파일의 헤더를 찾을 수 없습니다.');
  }

  function* rows(): Generator<SapRawRow> {
    for (let row = headerRowIndex + 1; row <= range.e.r; row += 1) {
      const values: Record<string, string> = {};
      let hasValue = false;

      for (let column = range.s.c; column <= range.e.c; column += 1) {
        const header = cellText(sheet, XLSX.utils.encode_cell({ r: headerRowIndex, c: column }));
        if (!header) continue;
        const value = cellText(sheet, XLSX.utils.encode_cell({ r: row, c: column }));
        values[header] = value;
        if (value) hasValue = true;
      }

      if (hasValue) {
        yield { rowNumber: row + 1, values };
      }
    }
  }

  return { sheetName, headers, rows: rows() };
};
