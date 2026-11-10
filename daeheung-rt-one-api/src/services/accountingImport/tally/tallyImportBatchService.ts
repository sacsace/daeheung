import AcImportBatch from '../../../models/AcImportBatch';
import AcImportBatchDocument from '../../../models/AcImportBatchDocument';
import AcImportIssue from '../../../models/AcImportIssue';
import AcImportSourceDocument from '../../../models/AcImportSourceDocument';
import GlVoucher from '../../../models/GlVoucher';
import GlVoucherLine from '../../../models/GlVoucherLine';
import type { ParsedTallyVoucher, TallyImportIssue, TallyImportResult } from '../../tallyImportService';

const tallyCorrelationId = (voucher: ParsedTallyVoucher, fallbackVoucherNo: string) =>
  String(
    voucher.guid ||
      `TLY-${voucher.voucherType || 'VOUCHER'}-${voucher.voucherNumber || fallbackVoucherNo}-${voucher.date || ''}`
  ).slice(0, 80);

const documentKey = (voucher: ParsedTallyVoucher, fallbackVoucherNo: string) =>
  `tally|${voucher.guid || `${voucher.voucherType || 'VOUCHER'}|${voucher.voucherNumber || fallbackVoucherNo}|${voucher.date || ''}`}`.slice(0, 255);

const financialYear = (date?: string) => {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const startYear = month >= 4 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
};

const severityFor = (level: TallyImportIssue['level']) =>
  level === 'error' ? 'ERROR' : level === 'warn' ? 'WARNING' : 'INFO';

export const createTallyImportBatch = async ({
  tenantId,
  companyId,
  userId,
  fileName,
  fileSize,
  fileSha256,
}: {
  tenantId: number;
  companyId: number;
  userId: number;
  fileName: string;
  fileSize?: number;
  fileSha256: string;
}) =>
  (AcImportBatch as any).create({
    tenant_id: tenantId,
    company_id: companyId,
    source_system: 'tally',
    file_name: fileName,
    file_size_bytes: fileSize ?? null,
    file_sha256: fileSha256,
    status: 'parsing',
    started_at: new Date(),
    created_by: userId,
    updated_by: userId,
  });

export const finalizeTallyImportBatch = async ({
  batchId,
  tenantId,
  companyId,
  userId,
  fileSha256,
  vouchers,
  result,
}: {
  batchId: number;
  tenantId: number;
  companyId: number;
  userId: number;
  fileSha256: string;
  vouchers: ParsedTallyVoucher[];
  result: TallyImportResult;
}) => {
  const batch = await (AcImportBatch as any).findOne({
    where: { id: batchId, tenant_id: tenantId, company_id: companyId, source_system: 'tally' },
  });
  if (!batch) throw new Error('Tally Import Batch를 찾을 수 없습니다.');

  for (let index = 0; index < vouchers.length; index += 1) {
    const voucher = vouchers[index];
    const fallbackVoucherNo = `${voucher.voucherType || 'VOUCHER'}-${index + 1}`;
    const correlationId = tallyCorrelationId(voucher, fallbackVoucherNo);
    const persistedVoucher = await (GlVoucher as any).findOne({
      where: {
        tenant_id: tenantId,
        company_id: companyId,
        source_type: 'tally_import',
        source_correlation_id: correlationId,
        is_active: true,
      },
      attributes: ['id'],
    });
    const [sourceDocument] = await (AcImportSourceDocument as any).findOrCreate({
      where: {
        tenant_id: tenantId,
        company_id: companyId,
        source_system: 'tally',
        source_document_key: documentKey(voucher, fallbackVoucherNo),
      },
      defaults: {
        source_company_code: 'TALLY',
        fiscal_year: financialYear(voucher.date) || 'NA',
        source_document_number: String(voucher.voucherNumber || fallbackVoucherNo).slice(0, 80),
        source_posting_date: voucher.date || null,
        raw_document: voucher,
        normalized_document: {
          voucherType: voucher.voucherType,
          totalDebit: voucher.lines.reduce((sum, line) => sum + line.debit, 0),
          totalCredit: voucher.lines.reduce((sum, line) => sum + line.credit, 0),
        },
        latest_file_sha256: fileSha256,
        status: persistedVoucher ? 'converted' : 'parsed',
        voucher_id: persistedVoucher?.id || null,
        source_correlation_id: correlationId,
        is_active: true,
      },
    });
    const persistedLines = persistedVoucher
      ? await (GlVoucherLine as any).findAll({
          where: { voucher_id: persistedVoucher.id },
          attributes: ['line_no', 'account_id', 'account_name'],
          order: [['line_no', 'ASC']],
        })
      : [];
    const normalizedDocument = {
      ...(sourceDocument.normalized_document || {}),
      voucherType: voucher.voucherType,
      totalDebit: voucher.lines.reduce((sum, line) => sum + line.debit, 0),
      totalCredit: voucher.lines.reduce((sum, line) => sum + line.credit, 0),
      lineMappings: voucher.lines.map((line, lineIndex) => {
        const mappedLine = persistedLines.find((savedLine: any) => Number(savedLine.line_no) === lineIndex + 1);
        return {
          sourceLedgerName: line.ledgerName,
          mvsAccountId: mappedLine?.account_id || null,
          mvsAccountName: mappedLine?.account_name || null,
        };
      }),
    };
    await sourceDocument.update({
      source_posting_date: voucher.date || null,
      raw_document: voucher,
      normalized_document: normalizedDocument,
      latest_file_sha256: fileSha256,
      status: persistedVoucher ? 'converted' : 'parsed',
      voucher_id: persistedVoucher?.id || null,
      source_correlation_id: correlationId,
    });

    const [batchDocument] = await (AcImportBatchDocument as any).findOrCreate({
      where: { batch_id: batch.id, source_document_id: sourceDocument.id },
      defaults: {
        first_row_number: index + 1,
        row_count: voucher.lines.length,
        status: persistedVoucher ? 'converted' : 'parsed',
        validation_summary: {
          totalDebit: voucher.lines.reduce((sum, line) => sum + line.debit, 0),
          totalCredit: voucher.lines.reduce((sum, line) => sum + line.credit, 0),
        },
        override_values: {},
        source_fields: {},
      },
    });
    await batchDocument.update({
      first_row_number: index + 1,
      row_count: voucher.lines.length,
      status: persistedVoucher ? 'converted' : 'parsed',
      validation_summary: {
        totalDebit: voucher.lines.reduce((sum, line) => sum + line.debit, 0),
        totalCredit: voucher.lines.reduce((sum, line) => sum + line.credit, 0),
      },
    });
  }

  if (result.issues.length) {
    await (AcImportIssue as any).bulkCreate(
      result.issues.map((issue) => ({
        batch_id: batch.id,
        code: 'TALLY_IMPORT_ISSUE',
        severity: severityFor(issue.level),
        source_value: issue.context || null,
        message: issue.message,
        is_resolved: false,
      }))
    );
  }

  const errorCount = result.issues.filter((issue) => issue.level === 'error').length;
  const warningCount = result.issues.filter((issue) => issue.level === 'warn').length;
  await batch.update({
    status: errorCount > 0 ? 'validated' : 'converted',
    total_rows: vouchers.reduce((sum, voucher) => sum + voucher.lines.length, 0),
    total_documents: vouchers.length,
    valid_documents: Math.max(0, vouchers.length - result.vouchers.failed),
    warning_count: warningCount,
    error_count: errorCount,
    converted_documents: result.vouchers.created,
    completed_at: new Date(),
    updated_by: userId,
  });
  return batch;
};

export const failTallyImportBatch = async ({
  batchId,
  tenantId,
  companyId,
  userId,
  error,
}: {
  batchId: number;
  tenantId: number;
  companyId: number;
  userId: number;
  error: unknown;
}) =>
  (AcImportBatch as any).update(
    {
      status: 'failed',
      completed_at: new Date(),
      updated_by: userId,
      failure_detail: { message: String(error instanceof Error ? error.message : error).slice(0, 1000) },
    },
    { where: { id: batchId, tenant_id: tenantId, company_id: companyId, source_system: 'tally' } }
  );
