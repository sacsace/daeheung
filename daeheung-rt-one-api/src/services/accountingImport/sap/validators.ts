import { validateSapDocument } from './documents';
import { normalizeSapAmount } from './normalizers';
import { SapDocument, SapImportTemplateConfig, SapImportValidationIssue, SapNormalizedRow } from './types';

const isMapped = (template: SapImportTemplateConfig, field: keyof SapImportTemplateConfig['columnMapping']) =>
  Boolean(template.columnMapping[field]);

export const validateSapRow = (
  row: SapNormalizedRow,
  template: SapImportTemplateConfig
): SapImportValidationIssue[] => {
  const issues: SapImportValidationIssue[] = [];
  const rawDebit = row.values.debit?.trim() ?? '';
  const rawCredit = row.values.credit?.trim() ?? '';
  const rawAmount = row.values.amount?.trim() ?? '';

  if (template.amountMode === 'separate_columns') {
    if ((rawDebit && !row.debit) || (rawCredit && !row.credit)) {
      issues.push({
        code: 'SAP_AMOUNT_INVALID',
        severity: 'ERROR',
        rowNumber: row.rowNumber,
        message: 'Debit 또는 Credit 컬럼에 유효하지 않은 금액이 있습니다.',
        suggestedAction: 'SAP Export의 금액 형식을 확인하세요.',
      });
    }
  } else {
    if (rawAmount && !normalizeSapAmount(rawAmount)) {
      issues.push({
        code: 'SAP_AMOUNT_INVALID',
        severity: 'ERROR',
        rowNumber: row.rowNumber,
        message: 'Amount 컬럼에 유효하지 않은 금액이 있습니다.',
        suggestedAction: 'SAP Export의 금액 형식을 확인하세요.',
      });
    }
    const indicator = row.normalizedValues.debitCreditIndicator ?? '';
    const debitIndicators = new Set((template.debitCreditConfig?.debitIndicators ?? ['S']).map((value) => value.toUpperCase()));
    const creditIndicators = new Set((template.debitCreditConfig?.creditIndicators ?? ['H']).map((value) => value.toUpperCase()));
    if (!indicator || (!debitIndicators.has(indicator) && !creditIndicators.has(indicator))) {
      issues.push({
        code: 'SAP_DEBIT_CREDIT_INDICATOR_INVALID',
        severity: 'ERROR',
        field: 'debitCreditIndicator',
        rowNumber: row.rowNumber,
        sourceValue: row.values.debitCreditIndicator,
        message: 'Debit/Credit Indicator를 해석할 수 없습니다.',
        suggestedAction: 'Import Template에서 차변·대변 Indicator 값을 설정하세요.',
      });
    }
  }

  if (!row.normalizedValues.glAccountCode && !row.normalizedValues.glAccountName) {
    issues.push({
      code: 'SAP_GL_ACCOUNT_MISSING',
      severity: 'ERROR',
      rowNumber: row.rowNumber,
      message: 'SAP GL Account Code 또는 Name이 없습니다.',
      suggestedAction: 'GL 계정 컬럼 매핑을 확인하세요.',
    });
  }
  if (isMapped(template, 'postingDate') && row.values.postingDate && !/^\d{4}-\d{2}-\d{2}$/.test(row.normalizedValues.postingDate ?? '')) {
    issues.push({
      code: 'SAP_POSTING_DATE_INVALID',
      severity: 'ERROR',
      field: 'postingDate',
      rowNumber: row.rowNumber,
      sourceValue: row.values.postingDate,
      message: '유효하지 않은 전기일입니다.',
      suggestedAction: '날짜 형식을 YYYY-MM-DD, YYYY/MM/DD 또는 DD-MM-YYYY로 맞추세요.',
    });
  }
  return issues;
};

export const validateSapDocuments = (
  documents: SapDocument[],
  template: SapImportTemplateConfig
): SapImportValidationIssue[] =>
  documents.flatMap((document) => [
    ...document.rows.flatMap((row) => validateSapRow(row, template)),
    ...validateSapDocument(document),
  ]);
