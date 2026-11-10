import { createHash } from 'crypto';
import { getTemplateGroupKeys, groupSapDocuments } from './documents';
import { normalizeSapRow } from './normalizers';
import { parseSapWorkbook } from './parsers';
import { SapImportTemplateConfig, SapImportValidationIssue } from './types';
import { validateSapDocuments } from './validators';

export type SapImportPreview = {
  sheetName: string;
  headers: string[];
  fileSha256: string;
  totalRows: number;
  totalDocuments: number;
  validDocuments: number;
  warningCount: number;
  errorCount: number;
  issues: SapImportValidationIssue[];
};

/**
 * API 응답은 집계와 제한된 Issue 표본만 포함한다. 원본 행 전체는 반환하지 않는다.
 * 실제 Batch 저장/변환은 이후 단계에서 이 도메인 함수를 청크 오케스트레이터로 감싼다.
 */
export const previewSapImport = (
  file: Buffer,
  template: SapImportTemplateConfig,
  options: { issueLimit?: number; sheetName?: string; headerRowNumber?: number } = {}
): SapImportPreview => {
  const parsed = parseSapWorkbook(file, {
    sheetName: options.sheetName,
    headerRowNumber: options.headerRowNumber,
  });
  const normalizedRows = [...parsed.rows].map((row) => normalizeSapRow(row, template));
  const { documents, issues: groupingIssues } = groupSapDocuments(
    normalizedRows,
    getTemplateGroupKeys(template)
  );
  const documentValidation = documents.map((document) => ({
    document,
    issues: validateSapDocuments([document], template),
  }));
  const validationIssues = documentValidation.flatMap(({ issues }) => issues);
  const allIssues = [...groupingIssues, ...validationIssues];
  const invalidDocumentCount = documentValidation.filter(({ issues }) =>
    issues.some((issue) => issue.severity === 'ERROR')
  ).length;
  const warningCount = allIssues.filter((issue) => issue.severity === 'WARNING').length;
  const errorCount = allIssues.filter((issue) => issue.severity === 'ERROR').length;

  return {
    sheetName: parsed.sheetName,
    headers: parsed.headers,
    fileSha256: createHash('sha256').update(file).digest('hex'),
    totalRows: normalizedRows.length,
    totalDocuments: documents.length,
    validDocuments: documents.length - invalidDocumentCount,
    warningCount,
    errorCount,
    issues: allIssues.slice(0, options.issueLimit ?? 100),
  };
};
