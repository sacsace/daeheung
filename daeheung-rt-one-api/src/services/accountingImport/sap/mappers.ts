import { Op } from 'sequelize';
import AcImportMapping from '../../../models/AcImportMapping';
import { normalizeMappingValue, normalizeSapCode } from './normalizers';

export type MappingResolution = {
  mappingId: number;
  targetId: number;
  confidenceScore: string | null;
};

/**
 * 승인된 매핑만 자동 변환에 사용한다. suggested/AI 결과는 관리자 승인 전에는 전표에 반영하지 않는다.
 */
export const resolveApprovedImportMapping = async ({
  tenantId,
  companyId,
  mappingType,
  sourceCode,
  sourceName,
}: {
  tenantId: number;
  companyId: number;
  mappingType: 'gl' | 'party' | 'gst';
  sourceCode?: string | null;
  sourceName?: string | null;
}): Promise<MappingResolution | null> => {
  const where: any = {
    tenant_id: tenantId,
    company_id: companyId,
    source_system: 'sap',
    mapping_type: mappingType,
    status: 'approved',
    is_active: true,
  };
  const normalizedCode = normalizeSapCode(sourceCode);
  const normalizedName = normalizeMappingValue(sourceName);
  if (normalizedCode) {
    const byCode = await (AcImportMapping as any).findOne({
      where: { ...where, source_code: normalizedCode },
      order: [['confidence_score', 'DESC NULLS LAST'], ['id', 'ASC']],
    });
    if (byCode) return toResolution(byCode, mappingType);
  }
  if (!normalizedName) return null;

  const byName = await (AcImportMapping as any).findOne({
    where: {
      ...where,
      normalized_source_value: normalizedName,
      [Op.or]: [{ source_code: null }, { source_code: '' }],
    },
    order: [['confidence_score', 'DESC NULLS LAST'], ['id', 'ASC']],
  });
  return byName ? toResolution(byName, mappingType) : null;
};

const toResolution = (mapping: any, mappingType: 'gl' | 'party' | 'gst'): MappingResolution | null => {
  const targetId =
    mappingType === 'gl'
      ? mapping.target_account_id
      : mappingType === 'party'
        ? mapping.target_partner_id
        : mapping.target_gst_code_id;
  if (!targetId) return null;
  return {
    mappingId: Number(mapping.id),
    targetId: Number(targetId),
    confidenceScore: mapping.confidence_score == null ? null : String(mapping.confidence_score),
  };
};
