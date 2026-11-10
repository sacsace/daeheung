import * as XLSX from 'xlsx';

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_DATE_RE = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/;

const formatDateParts = (year: number, month: number, day: number): string =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const isValidYmd = (year: number, month: number, day: number): boolean => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

const parseExcelSerial = (serial: number): string | null => {
  if (!Number.isFinite(serial) || serial < 1 || serial > 60000) return null;
  const parts = XLSX.SSF.parse_date_code(serial);
  if (!parts?.y) return null;
  if (!isValidYmd(parts.y, parts.m, parts.d)) return null;
  return formatDateParts(parts.y, parts.m, parts.d);
};

const isEmptyCell = (value: unknown): boolean =>
  value == null || String(value).trim() === '';

/** Excel/문자/Date 입력을 Sequelize DATEONLY용 YYYY-MM-DD 문자열로 변환 */
export function parseExcelDateOnly(value: unknown): string | null {
  if (isEmptyCell(value)) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return formatDateParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return parseExcelSerial(value);
  }

  const text = String(value).trim();
  if (!text) return null;

  const isoMatch = ISO_DATE_RE.exec(text);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    return isValidYmd(year, month, day) ? formatDateParts(year, month, day) : null;
  }

  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = Number(text);
    const fromSerial = parseExcelSerial(serial);
    if (fromSerial) return fromSerial;
  }

  const dmyMatch = DMY_DATE_RE.exec(text);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    return isValidYmd(year, month, day) ? formatDateParts(year, month, day) : null;
  }

  if (text.length >= 10) {
    const prefix = text.slice(0, 10);
    const prefixMatch = ISO_DATE_RE.exec(prefix);
    if (prefixMatch) {
      const year = Number(prefixMatch[1]);
      const month = Number(prefixMatch[2]);
      const day = Number(prefixMatch[3]);
      return isValidYmd(year, month, day) ? formatDateParts(year, month, day) : null;
    }
  }

  const fallback = new Date(text);
  if (!Number.isNaN(fallback.getTime())) {
    return formatDateParts(fallback.getFullYear(), fallback.getMonth() + 1, fallback.getDate());
  }

  return null;
}

export function parseExcelDateOnlyField(
  value: unknown,
  fieldLabel: string
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (isEmptyCell(value)) return { ok: true, value: null };
  const parsed = parseExcelDateOnly(value);
  if (!parsed) {
    return {
      ok: false,
      error: `${fieldLabel} 형식이 올바르지 않습니다. YYYY-MM-DD 또는 엑셀 날짜 형식을 사용하세요.`,
    };
  }
  return { ok: true, value: parsed };
}
