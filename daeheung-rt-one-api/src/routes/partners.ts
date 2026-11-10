import express from 'express';
import { Request, Response } from 'express';
import { Op } from 'sequelize';
import {
  Partner,
  PartnerGstNumber,
  Product,
  WorkAssigneeItem,
  GlVoucher,
  GlVoucherLine,
  AcImportMapping,
} from '../models';
import { resolveRequestCompanyId } from '../utils/resolveRequestCompanyId';
import sequelize from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import multer from 'multer';
import * as XLSX from 'xlsx';
import path from 'path';
import { isMissingTableError } from '../utils/dbErrors';
import { normalizePartnerCompanyName } from '../utils/partnerCompanyName';
import {
  buildReferenceCacheKey,
  referenceCacheGet,
  referenceCacheSet,
  referenceCacheDel,
} from '../utils/redisCache';

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PARTNER_FILL_FIELDS = [
  'pan_number',
  'representative',
  'industry',
  'address',
  'phone',
  'website',
  'bank_name',
  'account_number',
  'bank_ifsc',
  'account_holder',
  'contract_start_date',
  'contract_end_date',
] as const;

const isBlankPartnerValue = (value: unknown) => {
  if (value == null) return true;
  if (value instanceof Date) return Number.isNaN(value.getTime());
  return String(value).trim() === '' || String(value).trim() === '-';
};

const invalidatePartnersCache = async () => {
  await referenceCacheDel('ref:partners:*');
};

/** root는 선택한 회사, 그 외는 로그인 회사. 실패 시 응답 후 null */
async function companyIdForRequest(req: Request, res: Response): Promise<number | null> {
  try {
    return await resolveRequestCompanyId(req as any);
  } catch (error: any) {
    if (error?.status === 400) {
      res.status(400).json({ success: false, message: error.message || '선택한 회사를 찾을 수 없습니다.' });
      return null;
    }
    throw error;
  }
}

const partnerGstInclude = {
  model: PartnerGstNumber,
  as: 'gstNumbers',
  where: { is_active: true },
  required: false,
  separate: true,
  attributes: ['id', 'gst_number'],
} as const;

/** GST JOIN으로 같은 파트너가 여러 행이 되어도 id 기준으로 한 건만 반환 */
const serializePartners = (partners: any[]) => {
  const byId = new Map<number, any>();
  for (const partner of partners) {
    const partnerData = partner.toJSON ? partner.toJSON() : { ...partner };
    const id = Number(partnerData.id);
    const gstNumbers = (partnerData.gstNumbers || [])
      .map((gst: any) => (typeof gst === 'string' ? gst : gst?.gst_number))
      .filter(Boolean);
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, { ...partnerData, gstNumbers: Array.from(new Set(gstNumbers)) });
      continue;
    }
    existing.gstNumbers = Array.from(new Set([...(existing.gstNumbers || []), ...gstNumbers]));
  }
  return Array.from(byId.values());
};

/** 동일 회사(tenant+company) 내 회사명 중복 — 정규화 후 대소문자 무시 */
const findDuplicatePartnerByCompanyName = async ({
  tenantId,
  companyId,
  companyName,
  excludeId,
}: {
  tenantId: number;
  companyId: number;
  companyName: string;
  excludeId?: number;
}) => {
  const normalized = normalizePartnerCompanyName(companyName);
  if (!normalized) return null;
  const target = normalized.toLowerCase();

  const where: Record<string, unknown> = {
    tenant_id: tenantId,
    company_id: companyId,
    is_active: true,
  };
  if (excludeId != null && Number.isFinite(excludeId) && excludeId > 0) {
    where.id = { [Op.ne]: excludeId };
  }

  // DB에 정규화 전 표기가 남아 있어도 normalize 후 비교해 동일 회사명을 잡는다
  const rows = await (Partner as any).findAll({
    where,
    attributes: ['id', 'company_name', 'business_number', 'email', 'status'],
  });
  return (
    rows.find(
      (row: any) =>
        normalizePartnerCompanyName(row.company_name).toLowerCase() === target
    ) || null
  );
};

// Multer 설정 (메모리 스토리지)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv' // .csv
    ];
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (allowedMimes.includes(file.mimetype) && allowedExtensions.includes(extension)) {
      cb(null, true);
    } else {
      cb(new Error('Excel 파일(.xlsx, .xls) 또는 CSV 파일만 업로드 가능합니다.'));
    }
  }
});

// 파트너 목록 조회
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    const companyId = await companyIdForRequest(req, res);
    if (companyId == null) return;
    const userRole = (req as any).user.role;

    const whereClause: any = {
      tenant_id: tenantId,
      company_id: companyId,
      is_active: true,
    };

    const cacheKey = buildReferenceCacheKey(['ref', 'partners', tenantId, companyId, userRole]);
    const cached = await referenceCacheGet(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const partners = await (Partner as any).findAll({
      where: whereClause,
      include: [partnerGstInclude],
      order: [['created_at', 'DESC']]
    });

    const partnersData = serializePartners(partners);

    const payload = { success: true, data: partnersData };
    await referenceCacheSet(cacheKey, JSON.stringify(payload));
    res.json(payload);
  } catch (error: any) {
    console.error('파트너 목록 조회 오류:', error);
    if (isMissingTableError(error)) {
      return res.json({ success: true, data: [] });
    }
    res.status(500).json({
      success: false,
      message: '파트너 목록 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * 중복 파트너 합치기
 * - keepId 유지, mergeIds 는 soft-delete
 * - GST·상품·전표·업무담당 등 참조를 keepId 로 이관
 */
router.post('/merge', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    const companyId = await companyIdForRequest(req, res);
    if (companyId == null) return;
    const keepId = Number(req.body?.keepId);
    const mergeIdsRaw = Array.isArray(req.body?.mergeIds) ? req.body.mergeIds : [];
    const mergeIds = [...new Set(
      mergeIdsRaw
        .map((id: unknown) => Number(id))
        .filter((id: number) => Number.isFinite(id) && id > 0 && id !== keepId)
    )];

    if (!Number.isFinite(keepId) || keepId <= 0) {
      return res.status(400).json({ success: false, message: '유지할 파트너를 선택해주세요.' });
    }
    if (mergeIds.length === 0) {
      return res.status(400).json({ success: false, message: '합칠 파트너를 1개 이상 선택해주세요.' });
    }

    const allIds = [keepId, ...mergeIds];
    const partners = await (Partner as any).findAll({
      where: {
        id: { [Op.in]: allIds },
        tenant_id: tenantId,
        company_id: companyId,
        is_active: true,
      },
    });

    if (partners.length !== allIds.length) {
      return res.status(404).json({
        success: false,
        message: '선택한 파트너 중 일부를 찾을 수 없습니다. 목록을 새로고침 후 다시 시도하세요.',
      });
    }

    const keep = partners.find((p: any) => Number(p.id) === keepId);
    const sources = partners.filter((p: any) => Number(p.id) !== keepId);
    if (!keep) {
      return res.status(404).json({ success: false, message: '유지할 파트너를 찾을 수 없습니다.' });
    }

    await sequelize.transaction(async (transaction) => {
      const keepGstRows = await (PartnerGstNumber as any).findAll({
        where: { partner_id: keepId },
        transaction,
      });
      const keepGstMap = new Map<string, any>(
        keepGstRows.map((row: any) => [String(row.gst_number).trim().toUpperCase(), row])
      );

      for (const srcId of mergeIds) {
        const srcGstRows = await (PartnerGstNumber as any).findAll({
          where: { partner_id: srcId },
          transaction,
        });
        for (const row of srcGstRows) {
          const key = String(row.gst_number || '').trim().toUpperCase();
          if (!key) {
            await row.update({ is_active: false }, { transaction });
            continue;
          }
          const existing = keepGstMap.get(key);
          if (existing) {
            if (!existing.is_active) {
              await existing.update({ is_active: true }, { transaction });
            }
            await row.update({ is_active: false }, { transaction });
          } else {
            await row.update({ partner_id: keepId, is_active: true }, { transaction });
            keepGstMap.set(key, row);
          }
        }
      }

      await (Product as any).update(
        { partner_id: keepId },
        { where: { partner_id: { [Op.in]: mergeIds } }, transaction }
      );
      await (WorkAssigneeItem as any).update(
        { partner_id: keepId },
        { where: { partner_id: { [Op.in]: mergeIds } }, transaction }
      );
      await (GlVoucher as any).update(
        { party_id: keepId },
        { where: { party_id: { [Op.in]: mergeIds } }, transaction }
      );
      await (GlVoucherLine as any).update(
        { party_id: keepId },
        { where: { party_id: { [Op.in]: mergeIds } }, transaction }
      );
      await (AcImportMapping as any).update(
        { target_partner_id: keepId },
        { where: { target_partner_id: { [Op.in]: mergeIds } }, transaction }
      );

      const patch: Record<string, unknown> = {};
      for (const field of PARTNER_FILL_FIELDS) {
        if (!isBlankPartnerValue(keep[field])) continue;
        for (const src of sources) {
          if (!isBlankPartnerValue(src[field])) {
            patch[field] = src[field];
            break;
          }
        }
      }

      if (isBlankPartnerValue(keep.business_number) || String(keep.business_number).trim() === '-') {
        for (const src of sources) {
          if (!isBlankPartnerValue(src.business_number) && String(src.business_number).trim() !== '-') {
            patch.business_number = src.business_number;
            break;
          }
        }
      }

      const keepEmail = String(keep.email || '').trim().toLowerCase();
      const extraEmails = sources
        .map((src: any) => String(src.email || '').trim())
        .filter((email: string) => email && email.toLowerCase() !== keepEmail);
      const mergeNoteLines = sources.map((src: any) => {
        const email = String(src.email || '').trim();
        return `Merged #${src.id}${email ? ` (${email})` : ''}`;
      });
      const noteParts = [
        String(keep.notes || '').trim(),
        ...sources.map((src: any) => String(src.notes || '').trim()).filter(Boolean),
        extraEmails.length ? `Alt emails: ${extraEmails.join(', ')}` : '',
        mergeNoteLines.join('; '),
      ].filter(Boolean);
      if (noteParts.length) {
        patch.notes = noteParts.join('\n');
      }

      if (Object.keys(patch).length) {
        await keep.update(patch, { transaction });
      }

      for (const src of sources) {
        await src.update({ is_active: false }, { transaction });
      }
    });

    await invalidatePartnersCache();

    const merged = await (Partner as any).findByPk(keepId, {
      include: [partnerGstInclude],
    });
    const data = merged?.toJSON ? merged.toJSON() : merged;
    if (data) {
      data.gstNumbers = data.gstNumbers?.map((gst: any) => gst.gst_number || gst) || [];
    }

    return res.json({
      success: true,
      message: `${mergeIds.length}건을 합쳤습니다.`,
      data: {
        keepId,
        mergedIds: mergeIds,
        partner: data,
      },
    });
  } catch (error: any) {
    console.error('파트너 합치기 오류:', error);
    if (isMissingTableError(error)) {
      return res.status(500).json({
        success: false,
        message: '관련 테이블이 없어 합치기에 실패했습니다.',
      });
    }
    return res.status(500).json({
      success: false,
      message: '파트너 합치기 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// 파트너 상세 조회
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).user.tenant_id;
    const companyId = await companyIdForRequest(req, res);
    if (companyId == null) return;

    const partner = await (Partner as any).findOne({
      where: { 
        id, 
        tenant_id: tenantId,
        company_id: companyId,
        is_active: true
      },
      include: [{
        model: PartnerGstNumber,
        as: 'gstNumbers',
        where: { is_active: true },
        required: false
      }]
    });

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: '파트너를 찾을 수 없습니다.'
      });
    }

    const partnerData = partner.toJSON();
    partnerData.gstNumbers = partnerData.gstNumbers?.map((gst: any) => gst.gst_number) || [];

    res.json({
      success: true,
      data: partnerData
    });
  } catch (error: any) {
    console.error('파트너 상세 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '파트너 상세 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 파트너 생성
router.post(
  '/',
  authenticateToken,
  validateBody({
    companyName: { required: true, type: 'string', minLength: 1, maxLength: 200 },
    businessNumber: { type: 'string', maxLength: 50 },
    email: { type: 'string', maxLength: 255, pattern: emailPattern },
    status: { type: 'string', maxLength: 50 },
    phone: { type: 'string', maxLength: 50 },
    representative: { type: 'string', maxLength: 100 },
    bankName: { type: 'string', maxLength: 100 },
    accountNumber: { type: 'string', maxLength: 50 },
    ifsc: { type: 'string', maxLength: 50 },
    accountHolder: { type: 'string', maxLength: 120 }
  }),
  async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    const companyId = await companyIdForRequest(req, res);
    if (companyId == null) return;
    const { gstNumbers, ...partnerFormData } = req.body;

    // GST 번호 검증 (선택 — 건물주/소상공인 등 미등록 가능)
    if (gstNumbers !== undefined && gstNumbers !== null && !Array.isArray(gstNumbers)) {
      return res.status(400).json({
        success: false,
        message: 'GST 번호 형식이 올바르지 않습니다.'
      });
    }

    const gstList = Array.isArray(gstNumbers) ? gstNumbers : [];
    if (gstList.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'GST 번호는 최대 10개까지 등록할 수 있습니다.'
      });
    }

    // 파트너 생성
    const normalizedCompanyName = normalizePartnerCompanyName(partnerFormData.companyName);
    const duplicateByName = await findDuplicatePartnerByCompanyName({
      tenantId,
      companyId,
      companyName: normalizedCompanyName,
    });
    if (duplicateByName) {
      return res.status(409).json({
        success: false,
        message: `이미 등록된 회사명입니다: ${duplicateByName.company_name}`,
        code: 'DUPLICATE_COMPANY_NAME',
        data: {
          id: duplicateByName.id,
          companyName: duplicateByName.company_name,
          businessNumber: duplicateByName.business_number,
          email: duplicateByName.email,
        },
      });
    }

    const businessNumber =
      String(partnerFormData.businessNumber || '').trim() || '-';

    const partner = await (Partner as any).create({
      ...partnerFormData,
      tenant_id: tenantId,
      company_id: companyId,
      company_name: normalizedCompanyName,
      business_number: businessNumber,
      pan_number: partnerFormData.panNumber || null,
      representative: partnerFormData.representative || null,
      business_type: partnerFormData.businessType || 'partner',
      industry: partnerFormData.industry || null,
      address: partnerFormData.address || null,
      phone: partnerFormData.phone || null,
      email: String(partnerFormData.email || '').trim(),
      website: partnerFormData.website || null,
      bank_name: partnerFormData.bankName || null,
      account_number: partnerFormData.accountNumber || null,
      bank_ifsc: partnerFormData.ifsc || null,
      account_holder: partnerFormData.accountHolder || null,
      contract_start_date: partnerFormData.contractStartDate || null,
      contract_end_date: partnerFormData.contractEndDate || null,
      status: partnerFormData.status || 'active',
      notes: partnerFormData.notes || null
    });

    // GST 번호 저장
    const validGstNumbers = gstList.filter((gst: string) => gst && gst.trim() !== '');
    for (const gstNumber of validGstNumbers) {
      await (PartnerGstNumber as any).create({
        partner_id: partner.id,
        gst_number: gstNumber.trim()
      });
    }

    // 생성된 파트너 조회 (GST 번호 포함)
    const createdPartner = await (Partner as any).findByPk(partner.id, {
      include: [{
        model: PartnerGstNumber,
        as: 'gstNumbers',
        attributes: ['id', 'gst_number'],
        where: { is_active: true },
        required: false,
      }]
    });

    const responseData = createdPartner.toJSON();
    responseData.gstNumbers = responseData.gstNumbers?.map((gst: any) => gst.gst_number) || [];

    await invalidatePartnersCache();
    res.status(201).json({
      success: true,
      data: responseData,
      message: '파트너가 성공적으로 생성되었습니다.'
    });
  } catch (error: any) {
    console.error('파트너 생성 오류:', error);
    console.error('오류 상세:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    res.status(500).json({
      success: false,
      message: '파트너 생성 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      details: process.env.NODE_ENV === 'development' ? {
        stack: error.stack,
        code: error.code
      } : undefined
    });
  }
});

// 파트너 수정
router.put(
  '/:id',
  authenticateToken,
  validateBody({
    companyName: { type: 'string', minLength: 1, maxLength: 200 },
    businessNumber: { type: 'string', maxLength: 50 },
    email: { type: 'string', maxLength: 255, pattern: emailPattern },
    status: { type: 'string', maxLength: 50 },
    phone: { type: 'string', maxLength: 50 },
    representative: { type: 'string', maxLength: 100 },
    bankName: { type: 'string', maxLength: 100 },
    accountNumber: { type: 'string', maxLength: 50 },
    ifsc: { type: 'string', maxLength: 50 },
    accountHolder: { type: 'string', maxLength: 120 }
  }),
  async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).user.tenant_id;
    const companyId = await companyIdForRequest(req, res);
    if (companyId == null) return;
    const { gstNumbers, ...partnerData } = req.body;

    const partner = await (Partner as any).findOne({
      where: { 
        id, 
        tenant_id: tenantId,
        company_id: companyId
      }
    });

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: '파트너를 찾을 수 없습니다.'
      });
    }

    // GST 번호 검증 (선택)
    if (gstNumbers !== undefined) {
      if (!Array.isArray(gstNumbers)) {
        return res.status(400).json({
          success: false,
          message: 'GST 번호 형식이 올바르지 않습니다.'
        });
      }

      if (gstNumbers.length > 10) {
        return res.status(400).json({
          success: false,
          message: 'GST 번호는 최대 10개까지 등록할 수 있습니다.'
        });
      }

      const validGstNumbers = [...new Set(
        gstNumbers
          .filter((gst: string) => gst && gst.trim() !== '')
          .map((gst: string) => gst.trim().toUpperCase())
      )];

      await sequelize.transaction(async (transaction) => {
        const existingNumbers = await (PartnerGstNumber as any).findAll({
          where: { partner_id: id },
          transaction,
        });
        const existingByNumber = new Map<string, any>(
          existingNumbers.map((record: any) => [String(record.gst_number).trim().toUpperCase(), record])
        );

        await (PartnerGstNumber as any).update(
          { is_active: false },
          { where: { partner_id: id, is_active: true }, transaction }
        );
        for (const gstNumber of validGstNumbers) {
          const existing = existingByNumber.get(gstNumber);
          if (existing) {
            await existing.update({ is_active: true }, { transaction });
          } else {
            await (PartnerGstNumber as any).create({
              partner_id: id,
              gst_number: gstNumber,
              is_active: true,
            }, { transaction });
          }
        }
      });
    }

    // 파트너 정보 업데이트
    const nextCompanyName = partnerData.companyName
      ? normalizePartnerCompanyName(partnerData.companyName)
      : partner.company_name;
    if (partnerData.companyName) {
      const duplicateByName = await findDuplicatePartnerByCompanyName({
        tenantId,
        companyId,
        companyName: nextCompanyName,
        excludeId: Number(id),
      });
      if (duplicateByName) {
        return res.status(409).json({
          success: false,
          message: `이미 등록된 회사명입니다: ${duplicateByName.company_name}`,
          code: 'DUPLICATE_COMPANY_NAME',
          data: {
            id: duplicateByName.id,
            companyName: duplicateByName.company_name,
            businessNumber: duplicateByName.business_number,
            email: duplicateByName.email,
          },
        });
      }
    }

    await partner.update({
      company_name: nextCompanyName,
      business_number:
        partnerData.businessNumber !== undefined
          ? String(partnerData.businessNumber || '').trim() || '-'
          : partner.business_number,
      pan_number: partnerData.panNumber !== undefined ? partnerData.panNumber : partner.pan_number,
      representative: partnerData.representative !== undefined ? partnerData.representative : partner.representative,
      business_type: partnerData.businessType || partner.business_type,
      industry: partnerData.industry !== undefined ? partnerData.industry : partner.industry,
      address: partnerData.address !== undefined ? partnerData.address : partner.address,
      phone: partnerData.phone !== undefined ? partnerData.phone : partner.phone,
      email: partnerData.email !== undefined ? String(partnerData.email || '').trim() : partner.email,
      website: partnerData.website !== undefined ? partnerData.website : partner.website,
      bank_name: partnerData.bankName !== undefined ? partnerData.bankName : partner.bank_name,
      account_number: partnerData.accountNumber !== undefined ? partnerData.accountNumber : partner.account_number,
      bank_ifsc: partnerData.ifsc !== undefined ? partnerData.ifsc : partner.bank_ifsc,
      account_holder: partnerData.accountHolder !== undefined ? partnerData.accountHolder : partner.account_holder,
      contract_start_date: partnerData.contractStartDate || partner.contract_start_date,
      contract_end_date: partnerData.contractEndDate || partner.contract_end_date,
      status: partnerData.status || partner.status,
      notes: partnerData.notes !== undefined ? partnerData.notes : partner.notes
    });

    // 업데이트된 파트너 조회
    const updatedPartner = await (Partner as any).findByPk(id, {
      include: [{
        model: PartnerGstNumber,
        as: 'gstNumbers',
        attributes: ['id', 'gst_number'],
        where: { is_active: true },
        required: false,
      }]
    });

    const partnerDataResult = updatedPartner.toJSON();
    partnerDataResult.gstNumbers = partnerDataResult.gstNumbers?.map((gst: any) => gst.gst_number) || [];

    await invalidatePartnersCache();
    res.json({
      success: true,
      data: partnerDataResult,
      message: '파트너가 성공적으로 수정되었습니다.'
    });
  } catch (error: any) {
    console.error('파트너 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: '파트너 수정 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 파트너 삭제 (소프트 삭제)
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).user.tenant_id;
    const companyId = await companyIdForRequest(req, res);
    if (companyId == null) return;

    const partner = await (Partner as any).findOne({
      where: { 
        id, 
        tenant_id: tenantId,
        company_id: companyId
      }
    });

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: '파트너를 찾을 수 없습니다.'
      });
    }

    // 소프트 삭제: 파트너와 관련 GST 번호도 비활성화
    await (PartnerGstNumber as any).update({ is_active: false }, { where: { partner_id: id } });
    await partner.update({ is_active: false });

    await invalidatePartnersCache();
    res.json({
      success: true,
      message: '파트너가 성공적으로 비활성화되었습니다.'
    });
  } catch (error: any) {
    console.error('파트너 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '파트너 삭제 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Excel 샘플 파일 다운로드
router.get('/excel/sample', authenticateToken, async (req: Request, res: Response) => {
  try {
    // 샘플 데이터 생성
    const sampleData = [
      {
        '회사명': 'ABC Corporation',
        '사업자번호': '1234567890',
        'PAN 번호': 'ABCDE1234F',
        'GST 번호 (쉼표로 구분)': '27ABCDE1234F1Z5,27ABCDE1234F2Z6',
        '대표자명': '홍길동',
        '업종': '제조업',
        '주소': '서울시 강남구 테헤란로 123',
        '전화번호': '02-1234-5678',
        '이메일': 'contact@abc.com',
        '웹사이트': 'https://www.abc.com',
        '은행명': 'KB국민은행',
        '계좌번호': '123-456-789012',
        'IFSC': 'KKBK0001234',
        '예금주명': '홍길동',
        '계약시작일 (YYYY-MM-DD)': '2024-01-01',
        '계약종료일 (YYYY-MM-DD)': '2024-12-31',
        '상태 (active/inactive/suspended)': 'active',
        '비고': '샘플 데이터입니다'
      },
      {
        '회사명': 'XYZ Industries',
        '사업자번호': '0987654321',
        'PAN 번호': 'FGHIJ5678K',
        'GST 번호 (쉼표로 구분)': '27FGHIJ5678K1Z7',
        '대표자명': '김철수',
        '업종': 'IT서비스',
        '주소': '부산시 해운대구 센텀중앙로 456',
        '전화번호': '051-9876-5432',
        '이메일': 'info@xyz.com',
        '웹사이트': 'https://www.xyz.com',
        '은행명': '신한은행',
        '계좌번호': '987-654-321098',
        'IFSC': 'SHBK0005678',
        '예금주명': '김철수',
        '계약시작일 (YYYY-MM-DD)': '2024-06-01',
        '계약종료일 (YYYY-MM-DD)': '2025-05-31',
        '상태 (active/inactive/suspended)': 'active',
        '비고': ''
      }
    ];

    // Excel 워크북 생성
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    
    // 컬럼 너비 설정
    const columnWidths = [
      { wch: 20 }, // 회사명
      { wch: 15 }, // 사업자번호
      { wch: 15 }, // PAN 번호
      { wch: 30 }, // GST 번호
      { wch: 12 }, // 대표자명
      { wch: 12 }, // 업종
      { wch: 30 }, // 주소
      { wch: 15 }, // 전화번호
      { wch: 25 }, // 이메일
      { wch: 25 }, // 웹사이트
      { wch: 15 }, // 은행명
      { wch: 18 }, // 계좌번호
      { wch: 14 }, // IFSC
      { wch: 14 }, // 예금주명
      { wch: 18 }, // 계약시작일
      { wch: 18 }, // 계약종료일
      { wch: 20 }, // 상태
      { wch: 30 }  // 비고
    ];
    worksheet['!cols'] = columnWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, '파트너 업체');

    // Excel 파일 버퍼 생성
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 파일명 설정
    const fileName = `파트너_업체_입력_샘플_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.send(excelBuffer);
  } catch (error: any) {
    console.error('Excel 샘플 파일 생성 오류:', error);
    res.status(500).json({
      success: false,
      message: 'Excel 샘플 파일 생성 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Excel 파일 내보내기
router.get('/excel/export', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    const companyId = await companyIdForRequest(req, res);
    if (companyId == null) return;

    const whereClause: any = {
      tenant_id: tenantId,
      company_id: companyId,
      is_active: true,
    };

    const partners = await (Partner as any).findAll({
      where: whereClause,
      include: [partnerGstInclude],
      order: [['created_at', 'DESC']]
    });

    // Excel 데이터 형식으로 변환
    const excelData = serializePartners(partners).map((partnerData: any) => {
      const gstNumbers = partnerData.gstNumbers || [];
      
      return {
        '회사명': partnerData.company_name || '',
        '사업자번호': partnerData.business_number || '',
        'PAN 번호': partnerData.pan_number || '',
        'GST 번호 (쉼표로 구분)': gstNumbers.join(','),
        '대표자명': partnerData.representative || '',
        '업종': partnerData.industry || '',
        '주소': partnerData.address || '',
        '전화번호': partnerData.phone || '',
        '이메일': partnerData.email || '',
        '웹사이트': partnerData.website || '',
        '은행명': partnerData.bank_name || '',
        '계좌번호': partnerData.account_number || '',
        'IFSC': partnerData.bank_ifsc || '',
        '예금주명': partnerData.account_holder || '',
        '계약시작일 (YYYY-MM-DD)': partnerData.contract_start_date 
          ? new Date(partnerData.contract_start_date).toISOString().split('T')[0] 
          : '',
        '계약종료일 (YYYY-MM-DD)': partnerData.contract_end_date 
          ? new Date(partnerData.contract_end_date).toISOString().split('T')[0] 
          : '',
        '상태 (active/inactive/suspended)': partnerData.status || 'active',
        '비고': partnerData.notes || ''
      };
    });

    // Excel 워크북 생성
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // 컬럼 너비 설정
    const columnWidths = [
      { wch: 20 }, // 회사명
      { wch: 15 }, // 사업자번호
      { wch: 15 }, // PAN 번호
      { wch: 30 }, // GST 번호
      { wch: 12 }, // 대표자명
      { wch: 12 }, // 업종
      { wch: 30 }, // 주소
      { wch: 15 }, // 전화번호
      { wch: 25 }, // 이메일
      { wch: 25 }, // 웹사이트
      { wch: 15 }, // 은행명
      { wch: 18 }, // 계좌번호
      { wch: 14 }, // IFSC
      { wch: 14 }, // 예금주명
      { wch: 18 }, // 계약시작일
      { wch: 18 }, // 계약종료일
      { wch: 20 }, // 상태
      { wch: 30 }  // 비고
    ];
    worksheet['!cols'] = columnWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, '파트너 업체');

    // Excel 파일 버퍼 생성
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 파일명 설정
    const fileName = `파트너_업체_목록_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.send(excelBuffer);
  } catch (error: any) {
    console.error('Excel 파일 내보내기 오류:', error);
    res.status(500).json({
      success: false,
      message: 'Excel 파일 내보내기 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Excel 파일 업로드 및 파트너 일괄 등록
router.post('/excel/import', authenticateToken, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Excel 파일을 업로드해주세요.'
      });
    }

    const tenantId = (req as any).user.tenant_id;
    const companyId = await companyIdForRequest(req, res);
    if (companyId == null) return;

    // Excel 파일 파싱
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Excel 파일에 데이터가 없습니다.'
      });
    }

    const results = {
      success: [] as any[],
      failed: [] as any[],
      total: data.length
    };
    const seenCompanyNames = new Set<string>();
    const seenBusinessNumbers = new Set<string>();

    // 각 행 처리
    for (let i = 0; i < data.length; i++) {
      const row = data[i] as any;
      try {
        // 필수 필드 검증 (회사명만 — CIN/GST/이메일은 선택)
        if (!row['회사명']) {
          results.failed.push({
            row: i + 2, // Excel 행 번호 (헤더 제외)
            data: row,
            error: '필수 필드(회사명)가 누락되었습니다.'
          });
          continue;
        }

        // GST 번호 파싱 (쉼표로 구분) — 없으면 빈 배열 허용
        const gstNumbersStr = row['GST 번호 (쉼표로 구분)'] || '';
        const gstNumbers = gstNumbersStr
          .split(',')
          .map((gst: string) => gst.trim())
          .filter((gst: string) => gst !== '');

        if (gstNumbers.length > 10) {
          results.failed.push({
            row: i + 2,
            data: row,
            error: 'GST 번호는 최대 10개까지 등록할 수 있습니다.'
          });
          continue;
        }

        // 중복 사업자번호 확인 (비어 있으면 '-' 로 저장, 중복 검사 생략)
        const businessNumber = String(row['사업자번호'] || '').trim() || '-';
        if (businessNumber !== '-' && seenBusinessNumbers.has(businessNumber.toLowerCase())) {
          results.failed.push({
            row: i + 2,
            data: row,
            error: '파일 내에 동일한 사업자번호가 중복되어 있습니다.',
          });
          continue;
        }

        const existingPartner = await (Partner as any).findOne({
          where: {
            tenant_id: tenantId,
            company_id: companyId,
            business_number: businessNumber
          }
        });

        if (existingPartner) {
          results.failed.push({
            row: i + 2,
            data: row,
            error: '이미 등록된 사업자번호입니다.'
          });
          continue;
        }

        const companyName = normalizePartnerCompanyName(row['회사명']);
        const companyNameKey = companyName.toLowerCase();
        if (seenCompanyNames.has(companyNameKey)) {
          results.failed.push({
            row: i + 2,
            data: row,
            error: `파일 내에 동일한 회사명이 중복되어 있습니다: ${companyName}`,
          });
          continue;
        }

        const duplicateByName = await findDuplicatePartnerByCompanyName({
          tenantId,
          companyId,
          companyName,
        });
        if (duplicateByName) {
          results.failed.push({
            row: i + 2,
            data: row,
            error: `이미 등록된 회사명입니다: ${duplicateByName.company_name}`,
          });
          continue;
        }

        // 파트너 생성
        const partner = await (Partner as any).create({
          tenant_id: tenantId,
          company_id: companyId,
          company_name: companyName,
          business_number: businessNumber,
          pan_number: row['PAN 번호'] ? row['PAN 번호'].toString().trim() : null,
          representative: row['대표자명'] ? row['대표자명'].toString().trim() : null,
          business_type: (row['업종'] && ['partner', 'customer', 'other'].includes(row['업종'].toString().toLowerCase())) 
            ? row['업종'].toString().toLowerCase() 
            : 'partner',
          industry: row['업종'] ? row['업종'].toString().trim() : null,
          address: row['주소'] ? row['주소'].toString().trim() : null,
          phone: row['전화번호'] ? row['전화번호'].toString().trim() : null,
          email: row['이메일'] ? row['이메일'].toString().trim() : '',
          website: row['웹사이트'] ? row['웹사이트'].toString().trim() : null,
          bank_name: row['은행명'] ? row['은행명'].toString().trim() : null,
          account_number: row['계좌번호'] ? row['계좌번호'].toString().trim() : null,
          bank_ifsc: row['IFSC'] ? row['IFSC'].toString().trim() : null,
          account_holder: row['예금주명'] ? row['예금주명'].toString().trim() : null,
          contract_start_date: row['계약시작일 (YYYY-MM-DD)'] ? new Date(row['계약시작일 (YYYY-MM-DD)'].toString()) : null,
          contract_end_date: row['계약종료일 (YYYY-MM-DD)'] ? new Date(row['계약종료일 (YYYY-MM-DD)'].toString()) : null,
          status: (row['상태 (active/inactive/suspended)'] && ['active', 'inactive', 'suspended'].includes(row['상태 (active/inactive/suspended)'].toString().toLowerCase()))
            ? row['상태 (active/inactive/suspended)'].toString().toLowerCase()
            : 'active',
          notes: row['비고'] ? row['비고'].toString().trim() : null,
          is_active: true
        });

        // GST 번호 저장
        for (const gstNumber of gstNumbers) {
          await (PartnerGstNumber as any).create({
            partner_id: partner.id,
            gst_number: gstNumber,
            is_active: true
          });
        }

        results.success.push({
          row: i + 2,
          companyName: row['회사명'],
          businessNumber: row['사업자번호']
        });
        seenCompanyNames.add(companyNameKey);
        if (businessNumber !== '-') {
          seenBusinessNumbers.add(businessNumber.toLowerCase());
        }
      } catch (error: any) {
        results.failed.push({
          row: i + 2,
          data: row,
          error: error.message || '알 수 없는 오류가 발생했습니다.'
        });
      }
    }

    await invalidatePartnersCache();
    res.json({
      success: true,
      message: `총 ${results.total}건 중 ${results.success.length}건이 성공적으로 등록되었습니다.`,
      data: results
    });
  } catch (error: any) {
    console.error('Excel 파일 업로드 오류:', error);
    res.status(500).json({
      success: false,
      message: 'Excel 파일 업로드 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
