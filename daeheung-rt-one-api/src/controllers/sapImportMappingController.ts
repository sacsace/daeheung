import { Response } from 'express';
import AcImportMapping from '../models/AcImportMapping';
import GlAccount from '../models/GlAccount';
import Partner from '../models/Partner';
import AcGstCode from '../models/AcGstCode';
import { RequestWithUser } from '../types';
import { resolveCompanyScope } from '../utils/companyScope';
import { normalizeMappingValue, normalizeSapCode } from '../services/accountingImport/sap/normalizers';

const MAPPING_TYPES = new Set(['gl', 'party', 'gst']);

const validateTarget = async ({
  mappingType,
  targetId,
  tenantId,
  companyId,
}: {
  mappingType: string;
  targetId: number;
  tenantId: number;
  companyId: number;
}) => {
  if (mappingType === 'gl') {
    return (GlAccount as any).findOne({
      where: { id: targetId, tenant_id: tenantId, company_id: companyId, account_type: 'ledger', is_active: true },
    });
  }
  if (mappingType === 'party') {
    return (Partner as any).findOne({
      where: { id: targetId, tenant_id: tenantId, company_id: companyId, status: 'active' },
    });
  }
  return (AcGstCode as any).findOne({
    where: { id: targetId, tenant_id: tenantId, company_id: companyId, is_active: true },
  });
};

export const listSapImportMappings = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = resolveCompanyScope(req);
    const mappingType = String(req.query.mappingType || '');
    const where: any = {
      tenant_id: tenantId,
      company_id: companyId,
      source_system: 'sap',
      is_active: true,
    };
    if (MAPPING_TYPES.has(mappingType)) where.mapping_type = mappingType;
    const rows = await (AcImportMapping as any).findAll({ where, order: [['mapping_type', 'ASC'], ['source_code', 'ASC']] });
    return res.json({ success: true, data: rows });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'SAP 매핑 목록을 불러오지 못했습니다.' });
  }
};

export const createSapImportMapping = async (req: RequestWithUser, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    const { tenantId, companyId } = resolveCompanyScope(req);
    const body = req.body || {};
    const mappingType = String(body.mappingType || '');
    const sourceCode = normalizeSapCode(body.sourceCode);
    const sourceName = String(body.sourceName || '').trim();
    const targetId = Number(body.targetId);
    if (!MAPPING_TYPES.has(mappingType)) throw new Error('지원하지 않는 SAP 매핑 유형입니다.');
    if (!sourceCode && !sourceName) throw new Error('SAP 원본 코드 또는 이름을 입력하세요.');
    if (!Number.isInteger(targetId) || targetId <= 0) throw new Error('MVS 대상 마스터를 선택하세요.');

    const target = await validateTarget({ mappingType, targetId, tenantId, companyId });
    if (!target) throw new Error('선택한 MVS 마스터를 찾을 수 없거나 사용할 수 없습니다.');

    const targetField = mappingType === 'gl'
      ? { target_account_id: targetId }
      : mappingType === 'party'
        ? { target_partner_id: targetId }
        : { target_gst_code_id: targetId };
    const created = await (AcImportMapping as any).create({
      tenant_id: tenantId,
      company_id: companyId,
      source_system: 'sap',
      mapping_type: mappingType,
      source_code: sourceCode || null,
      source_name: sourceName || null,
      normalized_source_value: normalizeMappingValue(sourceName) || null,
      status: 'suggested',
      confidence_score: 100,
      mapping_source: 'user_override',
      ...targetField,
      created_by: req.user.id,
      updated_by: req.user.id,
    });
    return res.status(201).json({
      success: true,
      message: 'SAP 매핑 제안이 저장되었습니다. 승인 후 자동 변환에 사용됩니다.',
      data: created,
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error?.message || 'SAP 매핑 저장에 실패했습니다.' });
  }
};

export const approveSapImportMapping = async (req: RequestWithUser, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    const { tenantId, companyId } = resolveCompanyScope(req);
    const reason = String(req.body?.reason || '').trim();
    if (!reason) throw new Error('매핑 승인 사유를 입력하세요.');
    const mapping = await (AcImportMapping as any).findOne({
      where: {
        id: Number(req.params.id),
        tenant_id: tenantId,
        company_id: companyId,
        source_system: 'sap',
        is_active: true,
      },
    });
    if (!mapping) return res.status(404).json({ success: false, message: 'SAP 매핑을 찾을 수 없습니다.' });
    await mapping.update({
      status: 'approved',
      reason,
      approved_by: req.user.id,
      approved_at: new Date(),
      updated_by: req.user.id,
    });
    return res.json({ success: true, data: mapping });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error?.message || 'SAP 매핑 승인에 실패했습니다.' });
  }
};

export const deactivateSapImportMapping = async (req: RequestWithUser, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    const { tenantId, companyId } = resolveCompanyScope(req);
    const mapping = await (AcImportMapping as any).findOne({
      where: { id: Number(req.params.id), tenant_id: tenantId, company_id: companyId, source_system: 'sap', is_active: true },
    });
    if (!mapping) return res.status(404).json({ success: false, message: 'SAP 매핑을 찾을 수 없습니다.' });
    await mapping.update({ status: 'inactive', is_active: false, updated_by: req.user.id });
    return res.json({ success: true, data: mapping });
  } catch {
    return res.status(500).json({ success: false, message: 'SAP 매핑 비활성화에 실패했습니다.' });
  }
};
