import Decimal from 'decimal.js';
import {
  SapCanonicalField,
  SapDocument,
  SapImportTemplateConfig,
  SapImportValidationIssue,
  SapNormalizedRow,
} from './types';

const defaultGroupKeys: SapCanonicalField[] = ['companyCode', 'fiscalYear', 'documentNumber'];

export const buildDocumentKey = (
  row: SapNormalizedRow,
  groupKeys: SapCanonicalField[] = defaultGroupKeys
): string => {
  const parts = groupKeys.map((field) => row.normalizedValues[field] ?? '');
  return parts.join('|');
};

export const groupSapDocuments = (
  rows: Iterable<SapNormalizedRow>,
  groupKeys: SapCanonicalField[] = defaultGroupKeys
): { documents: SapDocument[]; issues: SapImportValidationIssue[] } => {
  const groups = new Map<string, SapNormalizedRow[]>();
  const issues: SapImportValidationIssue[] = [];

  for (const row of rows) {
    const missingKey = groupKeys.find((field) => !row.normalizedValues[field]);
    if (missingKey) {
      issues.push({
        code: 'SAP_DOCUMENT_GROUP_KEY_MISSING',
        severity: 'ERROR',
        field: missingKey,
        rowNumber: row.rowNumber,
        sourceValue: row.values[missingKey],
        message: `문서 그룹 키 ${missingKey} 값이 없습니다.`,
        suggestedAction: 'Import Template의 컬럼 매핑과 원본 파일 값을 확인하세요.',
      });
      continue;
    }

    const key = buildDocumentKey(row, groupKeys);
    const current = groups.get(key);
    if (current) current.push(row);
    else groups.set(key, [row]);
  }

  return {
    documents: [...groups.entries()].map(([documentKey, documentRows]) => ({
      documentKey,
      rows: documentRows,
    })),
    issues,
  };
};

export const validateVoucherBalance = (document: SapDocument): SapImportValidationIssue[] => {
  let debit = new Decimal(0);
  let credit = new Decimal(0);
  const issues: SapImportValidationIssue[] = [];

  for (const row of document.rows) {
    try {
      const rowDebit = new Decimal(row.debit || '0');
      const rowCredit = new Decimal(row.credit || '0');
      if (rowDebit.isNegative() || rowCredit.isNegative()) {
        issues.push({
          code: 'SAP_AMOUNT_NEGATIVE',
          severity: 'ERROR',
          rowNumber: row.rowNumber,
          message: '차변 또는 대변 금액은 음수일 수 없습니다.',
          suggestedAction: '금액 부호와 Debit/Credit Indicator 설정을 확인하세요.',
        });
        continue;
      }
      if (rowDebit.gt(0) && rowCredit.gt(0)) {
        issues.push({
          code: 'SAP_DEBIT_CREDIT_BOTH_PRESENT',
          severity: 'ERROR',
          rowNumber: row.rowNumber,
          message: '한 행에 차변과 대변 금액이 동시에 입력되었습니다.',
          suggestedAction: 'SAP Export 컬럼 또는 Import Template 설정을 확인하세요.',
        });
      }
      if (rowDebit.isZero() && rowCredit.isZero()) {
        issues.push({
          code: 'SAP_DEBIT_CREDIT_EMPTY',
          severity: 'WARNING',
          rowNumber: row.rowNumber,
          message: '차변과 대변 금액이 모두 0입니다.',
          suggestedAction: '금액 없는 행이 필요한지 확인하세요.',
        });
      }
      debit = debit.plus(rowDebit);
      credit = credit.plus(rowCredit);
    } catch {
      issues.push({
        code: 'SAP_AMOUNT_INVALID',
        severity: 'ERROR',
        rowNumber: row.rowNumber,
        message: '유효하지 않은 회계 금액입니다.',
        suggestedAction: '원본 파일의 금액 형식을 확인하세요.',
      });
    }
  }

  if (!debit.equals(credit)) {
    issues.push({
      code: 'SAP_VOUCHER_UNBALANCED',
      severity: 'ERROR',
      message: `차변 ${debit.toFixed(2)} / 대변 ${credit.toFixed(2)}로 일치하지 않습니다.`,
      suggestedAction: '문서의 Debit/Credit 행과 Import Template 설정을 확인하세요.',
    });
  }
  if (debit.isZero() && credit.isZero()) {
    issues.push({
      code: 'SAP_VOUCHER_ZERO_AMOUNT',
      severity: 'ERROR',
      message: '문서의 차변·대변 합계가 0입니다.',
      suggestedAction: '금액이 있는 SAP 문서만 변환하세요.',
    });
  }

  return issues;
};

export const validateSapDocument = (document: SapDocument): SapImportValidationIssue[] =>
  validateVoucherBalance(document);

export const getTemplateGroupKeys = (template: SapImportTemplateConfig): SapCanonicalField[] =>
  template.documentGroupKeys.length ? template.documentGroupKeys : defaultGroupKeys;
