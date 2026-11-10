import { Response } from 'express';
import fs from 'fs';
import AcImportTemplate from '../models/AcImportTemplate';
import { RequestWithUser } from '../types';
import { resolveCompanyScope } from '../utils/companyScope';
import { parseSapWorkbook } from '../services/accountingImport/sap/parsers';
import { previewSapImport as previewSapImportFile } from '../services/accountingImport/sap/sapImportService';
import { SapCanonicalField, SapImportTemplateConfig } from '../services/accountingImport/sap/types';

const CANONICAL_FIELDS = new Set<SapCanonicalField>([
  'companyCode', 'fiscalYear', 'documentNumber', 'postingDate', 'documentDate', 'documentType',
  'currencyCode', 'exchangeRate', 'glAccountCode', 'glAccountName', 'vendorCode', 'vendorName',
  'customerCode', 'customerName', 'costCenter', 'profitCenter', 'taxCode', 'assignment',
  'reference', 'lineText', 'debit', 'credit', 'amount', 'debitCreditIndicator',
]);

type UploadedFile = { path: string; originalname?: string; filename?: string; size?: number };

const removeUploadFile = (filePath?: string) => {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // Multipart 임시 파일 정리 실패는 사용자 요청을 실패시키지 않는다.
  }
};

const getUploadedFile = (req: RequestWithUser): UploadedFile => {
  const file = (req as any).file as UploadedFile | undefined;
  if (!file?.path) throw new Error('SAP 파일이 업로드되지 않았습니다. field 이름은 file이어야 합니다.');
  return file;
};

const parseTemplateConfig = (input: unknown): SapImportTemplateConfig => {
  let parsedInput = input;
  if (typeof input === 'string') {
    try {
      parsedInput = JSON.parse(input);
    } catch {
      throw new Error('template 설정은 유효한 JSON 객체여야 합니다.');
    }
  }
  const payload = parsedInput && typeof parsedInput === 'object' ? parsedInput as Record<string, unknown> : {};
  const rawMapping = payload.columnMapping;
  if (!rawMapping || typeof rawMapping !== 'object' || Array.isArray(rawMapping)) {
    throw new Error('columnMapping 설정이 필요합니다.');
  }

  const columnMapping: SapImportTemplateConfig['columnMapping'] = {};
  for (const [field, value] of Object.entries(rawMapping as Record<string, unknown>)) {
    if (CANONICAL_FIELDS.has(field as SapCanonicalField) && typeof value === 'string' && value.trim()) {
      columnMapping[field as SapCanonicalField] = value.trim();
    }
  }
  const rawGroupKeys = Array.isArray(payload.documentGroupKeys) ? payload.documentGroupKeys : [];
  const documentGroupKeys = rawGroupKeys
    .filter((field): field is SapCanonicalField => typeof field === 'string' && CANONICAL_FIELDS.has(field as SapCanonicalField));
  const amountMode = payload.amountMode === 'amount_indicator' ? 'amount_indicator' : 'separate_columns';
  if (!columnMapping.companyCode || !columnMapping.fiscalYear || !columnMapping.documentNumber) {
    throw new Error('Company Code, Fiscal Year, Document Number 컬럼 매핑이 필요합니다.');
  }
  if (
    (amountMode === 'separate_columns' && (!columnMapping.debit || !columnMapping.credit)) ||
    (amountMode === 'amount_indicator' && (!columnMapping.amount || !columnMapping.debitCreditIndicator))
  ) {
    throw new Error('선택한 Debit/Credit 방식에 필요한 금액 컬럼 매핑이 없습니다.');
  }

  const debitCreditConfig = payload.debitCreditConfig && typeof payload.debitCreditConfig === 'object'
    ? payload.debitCreditConfig as SapImportTemplateConfig['debitCreditConfig']
    : undefined;
  return {
    columnMapping,
    documentGroupKeys: documentGroupKeys.length ? documentGroupKeys : ['companyCode', 'fiscalYear', 'documentNumber'],
    amountMode,
    debitCreditConfig,
  };
};

const getTemplateConfig = async (
  req: RequestWithUser,
  tenantId: number,
  companyId: number
): Promise<{ config: SapImportTemplateConfig; sheetName?: string; headerRowNumber?: number }> => {
  const body = req.body || {};
  if (body.templateId) {
    const template = await (AcImportTemplate as any).findOne({
      where: {
        id: Number(body.templateId),
        tenant_id: tenantId,
        company_id: companyId,
        source_system: 'sap',
        is_active: true,
      },
    });
    if (!template) throw new Error('사용 가능한 SAP Import Template을 찾을 수 없습니다.');
    return {
      config: parseTemplateConfig({
        columnMapping: template.column_mapping,
        documentGroupKeys: template.document_group_keys,
        amountMode: template.amount_mode,
        debitCreditConfig: template.debit_credit_config,
      }),
      sheetName: template.sheet_name ?? undefined,
      headerRowNumber: template.header_row_number ?? 1,
    };
  }

  return {
    config: parseTemplateConfig(body.template),
    sheetName: typeof body.sheetName === 'string' ? body.sheetName : undefined,
    headerRowNumber: Number(body.headerRowNumber) || 1,
  };
};

/** Step 1 of the wizard: inspect column names only. */
export const inspectSapImportFile = async (req: RequestWithUser, res: Response) => {
  const filePath = (req as any).file?.path as string | undefined;
  try {
    const file = getUploadedFile(req);
    const buffer = fs.readFileSync(file.path);
    const parsed = parseSapWorkbook(buffer, {
      sheetName: typeof req.body?.sheetName === 'string' ? req.body.sheetName : undefined,
      headerRowNumber: Number(req.body?.headerRowNumber) || 1,
    });
    return res.json({
      success: true,
      data: {
        fileName: file.originalname || file.filename,
        sheetName: parsed.sheetName,
        headers: parsed.headers,
      },
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error?.message || 'SAP 파일 컬럼을 읽지 못했습니다.' });
  } finally {
    removeUploadFile(filePath);
  }
};

/** Step 2–4 of the wizard: normalize, group and validate without DB writes. */
export const previewSapImport = async (req: RequestWithUser, res: Response) => {
  const filePath = (req as any).file?.path as string | undefined;
  try {
    const file = getUploadedFile(req);
    const { tenantId, companyId } = resolveCompanyScope(req);
    const template = await getTemplateConfig(req, tenantId, companyId);
    const result = previewSapImportFile(fs.readFileSync(file.path), template.config, {
      sheetName: template.sheetName,
      headerRowNumber: template.headerRowNumber,
      issueLimit: 100,
    });
    return res.json({ success: true, data: { fileName: file.originalname || file.filename, ...result } });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error?.message || 'SAP Import 미리보기에 실패했습니다.' });
  } finally {
    removeUploadFile(filePath);
  }
};

export const listSapImportTemplates = async (req: RequestWithUser, res: Response) => {
  const { tenantId, companyId } = resolveCompanyScope(req);
  const templates = await (AcImportTemplate as any).findAll({
    where: { tenant_id: tenantId, company_id: companyId, source_system: 'sap', is_active: true },
    order: [['name', 'ASC']],
  });
  return res.json({ success: true, data: templates });
};

export const createSapImportTemplate = async (req: RequestWithUser, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    const { tenantId, companyId } = resolveCompanyScope(req);
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const fileFormat = String(body.fileFormat || '').toLowerCase();
    if (!name) throw new Error('Template 이름을 입력하세요.');
    if (!['xlsx', 'xls', 'csv'].includes(fileFormat)) throw new Error('지원하지 않는 SAP 파일 형식입니다.');
    const config = parseTemplateConfig(body.template ?? body);

    const template = await (AcImportTemplate as any).create({
      tenant_id: tenantId,
      company_id: companyId,
      source_system: 'sap',
      name,
      file_format: fileFormat,
      sheet_name: typeof body.sheetName === 'string' ? body.sheetName.trim() || null : null,
      header_row_number: Number(body.headerRowNumber) || 1,
      column_mapping: config.columnMapping,
      document_group_keys: config.documentGroupKeys,
      amount_mode: config.amountMode,
      debit_credit_config: config.debitCreditConfig || {},
      created_by: req.user.id,
      updated_by: req.user.id,
    });
    return res.status(201).json({ success: true, data: template });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error?.message || 'SAP Import Template 저장에 실패했습니다.' });
  }
};
