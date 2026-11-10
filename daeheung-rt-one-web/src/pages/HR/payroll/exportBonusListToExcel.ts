import ExcelJS from 'exceljs';
import { downloadExcelWorkbook } from '../../../utils/excelExportStyle';

export type BonusExcelRow = {
  employee_name: string;
  employee_number: string;
  department: string;
  email: string;
  hire_date: string | null;
  months_worked: number;
  monthly_salary: number;
  rate_percent: number;
  amount: number;
  statusLabel: string;
  bank_account: string;
  bank_ifsc: string;
};

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFC6EFCE' },
};

const THIN: ExcelJS.BorderStyle = 'thin';
const GRID = { style: THIN, color: { argb: 'FFB4B4B4' } } as const;

export async function exportBonusListToExcel(
  rows: BonusExcelRow[],
  headers: string[],
  filename: string
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Bonus');
  const headerRow = sheet.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = { name: 'Calibri', size: 9, bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { top: GRID, left: GRID, bottom: GRID, right: GRID };
  });
  for (const row of rows) {
    const added = sheet.addRow([
      row.employee_name,
      row.employee_number,
      row.department,
      row.hire_date || '',
      row.months_worked,
      Math.round(row.monthly_salary),
      Number(row.rate_percent.toFixed(2)),
      Math.round(row.amount),
      row.statusLabel,
      row.email,
      row.bank_account,
      row.bank_ifsc,
    ]);
    added.eachCell((cell, col) => {
      cell.border = { top: GRID, left: GRID, bottom: GRID, right: GRID };
      cell.alignment = {
        vertical: 'middle',
        horizontal: col >= 5 && col <= 8 ? 'right' : 'left',
      };
      if (col === 6 || col === 8) cell.numFmt = '#,##0';
      if (col === 7) cell.numFmt = '0.00';
    });
  }
  await downloadExcelWorkbook(workbook, filename, { rowHeight: 18 });
}
