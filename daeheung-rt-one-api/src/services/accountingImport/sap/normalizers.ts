import Decimal from 'decimal.js';
import {
  SapCanonicalField,
  SapImportTemplateConfig,
  SapNormalizedRow,
  SapRawRow,
} from './types';

const collapseWhitespace = (value: unknown): string =>
  String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * 원본 값은 변경하지 않고, 매핑 비교에만 사용하는 표준값을 생성한다.
 * 코드와 명칭 모두 대소문자·공백·일반적인 구두점 차이를 무시한다.
 */
export const normalizeMappingValue = (value: unknown): string =>
  collapseWhitespace(value)
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[.,'’()[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const normalizeSapCode = (value: unknown): string =>
  collapseWhitespace(value)
    .normalize('NFKC')
    .toUpperCase()
    .replace(/\s+/g, '');

export const normalizeSapDate = (value: unknown): string => {
  const raw = collapseWhitespace(value);
  if (!raw) return '';

  const compact = raw.replace(/[./]/g, '-');
  const ymd = compact.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) {
    const [, year, month, day] = ymd;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const dmy = compact.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy) {
    const [, day, month, year] = dmy;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return raw;
};

/**
 * 회계 금액은 Decimal 문자열로만 반환한다. Number를 계산 결과로 사용하지 않는다.
 */
export const normalizeSapAmount = (value: unknown): string => {
  const raw = collapseWhitespace(value);
  if (!raw) return '0';

  const negative = /^\(.*\)$/.test(raw);
  const numeric = raw
    .replace(/[()]/g, '')
    .replace(/,/g, '')
    .replace(/[^\d.+-]/g, '');

  if (!numeric || numeric === '+' || numeric === '-') return '';
  try {
    const amount = new Decimal(numeric);
    return (negative ? amount.negated() : amount).toFixed(2);
  } catch {
    return '';
  }
};

const getMappedValue = (
  rawValues: Record<string, string>,
  mapping: SapImportTemplateConfig['columnMapping'],
  field: SapCanonicalField
): string => {
  const columnName = mapping[field];
  return columnName ? rawValues[columnName] ?? '' : '';
};

const normalizedValueFor = (field: SapCanonicalField, raw: string): string => {
  if (!raw) return '';
  if (field === 'postingDate' || field === 'documentDate') return normalizeSapDate(raw);
  if (
    field === 'companyCode' ||
    field === 'fiscalYear' ||
    field === 'documentNumber' ||
    field === 'glAccountCode' ||
    field === 'vendorCode' ||
    field === 'customerCode' ||
    field === 'costCenter' ||
    field === 'profitCenter' ||
    field === 'taxCode' ||
    field === 'debitCreditIndicator'
  ) {
    return normalizeSapCode(raw);
  }
  return normalizeMappingValue(raw);
};

export const normalizeSapRow = (
  row: SapRawRow,
  template: SapImportTemplateConfig
): SapNormalizedRow => {
  const values: Partial<Record<SapCanonicalField, string>> = {};
  const normalizedValues: Partial<Record<SapCanonicalField, string>> = {};

  (Object.keys(template.columnMapping) as SapCanonicalField[]).forEach((field) => {
    const raw = getMappedValue(row.values, template.columnMapping, field);
    values[field] = raw;
    normalizedValues[field] = normalizedValueFor(field, raw);
  });

  const debit = normalizeSapAmount(values.debit);
  const credit = normalizeSapAmount(values.credit);
  const amount = normalizeSapAmount(values.amount);
  const indicator = normalizedValues.debitCreditIndicator ?? '';
  const debitIndicators = new Set(
    (template.debitCreditConfig?.debitIndicators ?? ['S'])
      .map(normalizeSapCode)
      .filter(Boolean)
  );
  const creditIndicators = new Set(
    (template.debitCreditConfig?.creditIndicators ?? ['H'])
      .map(normalizeSapCode)
      .filter(Boolean)
  );

  let normalizedDebit = debit || '0';
  let normalizedCredit = credit || '0';
  if (template.amountMode === 'amount_indicator') {
    normalizedDebit = debitIndicators.has(indicator) ? amount || '0' : '0';
    normalizedCredit = creditIndicators.has(indicator) ? amount || '0' : '0';
  }

  return {
    rowNumber: row.rowNumber,
    rawValues: row.values,
    values,
    normalizedValues,
    debit: normalizedDebit,
    credit: normalizedCredit,
  };
};
