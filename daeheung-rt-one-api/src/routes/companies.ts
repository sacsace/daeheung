import express from 'express';
import { Sequelize, QueryTypes } from 'sequelize';
import { Company, CompanyGstNumber, User } from '../models';
import { authenticateToken, requireRole } from '../middleware/auth';
import {
  deleteCompanyWithCascade,
  CompanyNotFoundError,
} from '../services/deleteCompanyCascade';
import { validateBody } from '../middleware/validate';
import sequelize from '../config/database';
import { enrichCompanyList, serializeCompanyBase, batchGstNumbersByCompany } from '../utils/companySerializer';
import { canSelectOtherCompany } from '../utils/companyScope';
import { PRODUCT_NAME } from '../config/standalone';
import {
  buildReferenceCacheKey,
  referenceCacheGet,
  referenceCacheSet,
  referenceCacheDel,
} from '../utils/redisCache';
import {
  getCompanyBankTransferSettings,
  mergeBankTransferSettings,
  testBankApiConnection,
  type BankProvider
} from '../services/banking';

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * MVS 사용 종료 여부 — 로그인과 동일하게 UTC 날짜 기준,
 * 종료일 당일까지는 유효, 그 다음날부터 만료.
 */
function isMvsUsagePeriodExpired(
  loginPeriodEnd: unknown,
  now: Date = new Date()
): boolean {
  if (loginPeriodEnd == null || loginPeriodEnd === '') return false;
  const end =
    loginPeriodEnd instanceof Date
      ? loginPeriodEnd
      : new Date(String(loginPeriodEnd).trim());
  if (Number.isNaN(end.getTime())) return false;
  const currentDateOnly = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const endDateOnly = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())
  );
  return currentDateOnly > endDateOnly;
}

/** QueryTypes.SELECT 결과는 row 배열 — destructure 여부와 무관하게 EXISTS 판정 */
const rowExistsFlag = (rowOrRows: any): boolean => {
  if (Array.isArray(rowOrRows)) {
    return Boolean(rowOrRows[0]?.exists);
  }
  return Boolean(rowOrRows?.exists ?? rowOrRows?.[0]?.exists);
};

const companyGstTableExists = async (): Promise<boolean> => {
  try {
    const rows = await (sequelize as any).query(
      `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'company_gst_numbers'
      ) as exists;
      `,
      { type: QueryTypes.SELECT }
    );
    return rowExistsFlag(rows);
  } catch {
    return false;
  }
};

const invalidateCompaniesCache = async () => {
  await referenceCacheDel('ref:companies:*');
  await referenceCacheDel('ref:company:*');
};

const COMPANY_FIELD_LABELS: Record<string, string> = {
  name: '회사명',
  business_number: '사업자등록번호',
  email: '이메일',
  phone: '전화번호',
  address: '주소',
  website: '웹사이트',
  industry: '업종',
  ceo_name: '대표자명',
  gst_number: 'GST 번호',
  msme_number: 'MSME 번호',
  iec_number: 'IEC 번호',
  pan_number: 'PAN 번호',
  account_number: '계좌번호',
  bank_name: '은행명',
  status: '상태',
};

const companyFieldLabel = (field?: string | null): string => {
  if (!field) return '입력값';
  return COMPANY_FIELD_LABELS[field] || field;
};

/** PostgreSQL 오류 상세("Key (business_number)=(...)")에서 컬럼명을 추출 */
const columnFromPgDetail = (error: any): string | undefined => {
  const source = error?.parent || error?.original || error;
  const direct = source?.column;
  if (direct) return String(direct);
  const detail: string = source?.detail || '';
  const matched = detail.match(/Key \((.+?)\)=/);
  return matched ? matched[1] : undefined;
};

/** DB/유효성 오류를 사용자가 이해할 수 있는 실패 사유로 변환 */
const describeCompanySaveError = (
  error: any,
  fallback: string
): { status: number; message: string } => {
  const source = error?.parent || error?.original || error;
  const pgCode: string | undefined = source?.code;

  if (error?.name === 'SequelizeUniqueConstraintError' || pgCode === '23505') {
    const field = error?.errors?.[0]?.path || columnFromPgDetail(error);
    return {
      status: 409,
      message: `이미 등록된 ${companyFieldLabel(field)}입니다. 다른 값을 입력해 주세요.`,
    };
  }

  if (error?.name === 'SequelizeValidationError') {
    const detail = (error.errors || [])
      .map((e: any) => `${companyFieldLabel(e?.path)}: ${e?.message}`)
      .join(' / ');
    return { status: 400, message: detail || fallback };
  }

  if (pgCode === '23502') {
    return {
      status: 400,
      message: `${companyFieldLabel(columnFromPgDetail(error))}은(는) 필수 입력 항목입니다.`,
    };
  }

  if (pgCode === '22001') {
    return {
      status: 400,
      message: `${companyFieldLabel(columnFromPgDetail(error))} 입력값이 허용된 길이를 초과했습니다.`,
    };
  }

  if (pgCode === '23503') {
    return { status: 400, message: '연결된 데이터가 존재하지 않아 저장할 수 없습니다.' };
  }

  if (pgCode === '42703' || pgCode === '42P01') {
    return {
      status: 500,
      message: '데이터베이스 구조가 최신이 아닙니다. 관리자에게 문의해 주세요.',
    };
  }

  // production에서는 DB 상세(테이블/제약조건)를 노출하지 않음
  return { status: 500, message: fallback };
};

// 모든 회사 조회 (테넌트별)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    const userRole = (req as any).user.role;
    const userCompanyId = (req as any).user.company_id;
    const includeExpired =
      String(req.query.include_expired ?? '').toLowerCase() === '1' ||
      String(req.query.include_expired ?? '').toLowerCase() === 'true';

    // 단독 시스템: 역할과 관계없이 로그인한 회사만.
    const whereClause: any = { tenant_id: tenantId };
    if (userCompanyId != null) {
      whereClause.id = userCompanyId;
    }

    const cacheKey = buildReferenceCacheKey([
      'ref',
      'companies',
      tenantId,
      userRole,
      userCompanyId ?? '',
      includeExpired ? 'all' : 'active_usage',
    ]);
    const cached = await referenceCacheGet(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    
    let companies: any[] = await (Company as any).findAll({
      where: whereClause,
      order: [['created_at', 'DESC']]
    });

    companies = await enrichCompanyList(companies);

    // root/audit 회사 선택 목록: 사용 종료 회사 제외 (회사 관리는 include_expired=1)
    // 일반 사용자는 소속 회사 1건만 보므로 기간과 무관하게 반환
    if (
      !includeExpired &&
      (userRole === 'root' || userRole === 'audit')
    ) {
      companies = companies.filter(
        (c: any) => !isMvsUsagePeriodExpired(c.login_period_end ?? c.mvs_end_date)
      );
    }

    const payload = { success: true, data: companies };
    await referenceCacheSet(cacheKey, JSON.stringify(payload));
    
    res.json(payload);
  } catch (error: any) {
    console.error('회사 정보 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '회사 정보 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
});

/** 송금 API 연결 테스트 (실제 송금 없음). companyId 없으면 요청 본문 자격증명만 사용 */
router.post('/bank-transfer/test', authenticateToken, async (req, res) => {
  try {
    const userRole = (req as any).user.role;
    const userCompanyId = (req as any).user.company_id;
    const tenantId = (req as any).user.tenant_id;

    if (userRole !== 'root' && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '송금 API 테스트 권한이 없습니다.'
      });
    }

    const provider = String(req.body?.provider || '').toLowerCase() as BankProvider;
    if (provider !== 'icici' && provider !== 'kotak') {
      return res.status(400).json({
        success: false,
        message: 'provider는 icici 또는 kotak이어야 합니다.'
      });
    }

    const companyIdRaw = req.body?.companyId;
    const companyId =
      companyIdRaw != null && companyIdRaw !== ''
        ? Number(companyIdRaw)
        : NaN;

    let companySettings = null as ReturnType<typeof getCompanyBankTransferSettings> | null;

    if (Number.isFinite(companyId)) {
      if (userRole === 'admin' && userCompanyId !== companyId) {
        return res.status(403).json({
          success: false,
          message: '자신이 속한 회사의 API만 테스트할 수 있습니다.'
        });
      }

      const whereClause: any = { id: companyId };
      if (userRole !== 'root') {
        whereClause.tenant_id = tenantId;
      }

      const company = await (Company as any).findOne({
        where: whereClause,
        attributes: ['id', 'settings']
      });

      if (!company) {
        return res.status(404).json({
          success: false,
          message: '회사를 찾을 수 없습니다.'
        });
      }

      companySettings = getCompanyBankTransferSettings(company.settings);
    } else if (userRole === 'admin') {
      return res.status(400).json({
        success: false,
        message: '회사 저장 후 연결을 테스트하거나 companyId를 전달하세요.'
      });
    }

    const result = await testBankApiConnection({
      provider,
      companySettings,
      override: {
        apiUrl: req.body?.apiUrl,
        apiKey: req.body?.apiKey,
        transferPath: req.body?.transferPath
      }
    });

    return res.json({
      success: true,
      data: result,
      message: result.message
    });
  } catch (error: any) {
    console.error('송금 API 연결 테스트 오류:', error);
    return res.status(400).json({
      success: false,
      message: error?.message || '송금 API 연결 테스트에 실패했습니다.'
    });
  }
});

// 특정 회사 GST 번호 조회
router.get('/:id/gst-numbers', authenticateToken, async (req, res) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    const userRole = (req as any).user.role;
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
      return res.status(400).json({
        success: false,
        message: '유효하지 않은 회사 ID입니다.'
      });
    }

    const userCompanyId = (req as any).user.company_id;
    if (!canSelectOtherCompany(userRole) && Number(userCompanyId) !== id) {
      return res.status(403).json({
        success: false,
        message: '자신이 속한 회사 정보만 조회할 수 있습니다.'
      });
    }

    const whereClause: any = { id };
    if (userRole !== 'root') {
      whereClause.tenant_id = tenantId;
    }

    const company = await (Company as any).findOne({
      where: whereClause,
      attributes: ['id', 'name']
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: '회사를 찾을 수 없습니다.'
      });
    }

    const [tableCheck] = await (sequelize as any).query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'company_gst_numbers'
      ) as exists;
    `, { type: QueryTypes.SELECT }) as any[];

    const tableExists = Boolean((tableCheck as any)?.exists ?? (tableCheck as any)?.[0]?.exists);
    if (!tableExists) {
      return res.json({
        success: true,
        data: { gst_numbers: [] }
      });
    }

    const gstResults = await (sequelize as any).query(`
      SELECT gst_number
      FROM company_gst_numbers
      WHERE company_id = $1
      ORDER BY id ASC
    `, {
      bind: [id],
      type: QueryTypes.SELECT
    }) as any[];

    const gstNumbers = gstResults
      .map((row: any) => row.gst_number)
      .filter((gst: string) => gst && gst.trim() !== '');

    return res.json({
      success: true,
      data: { gst_numbers: gstNumbers }
    });
  } catch (error) {
    console.error('회사 GST 번호 조회 오류:', error);
    return res.status(500).json({
      success: false,
      message: 'GST 번호를 불러오는데 실패했습니다.'
    });
  }
});

// 특정 회사 조회
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).user.tenant_id;
    const userRole = (req as any).user.role;
    const userCompanyId = (req as any).user.company_id;

    // root/audit는 다른 회사 조회 가능. 그 외는 로그인 회사만.
    if (!canSelectOtherCompany(userRole) && Number(userCompanyId) !== Number(id)) {
      return res.status(403).json({
        success: false,
        message: '자신이 속한 회사 정보만 조회할 수 있습니다.'
      });
    }

    const whereClause: any = { id: id };
    if (userRole !== 'root') {
      whereClause.tenant_id = tenantId;
    }

    const cacheKey = buildReferenceCacheKey(['ref', 'company', id, tenantId, userRole]);
    const cached = await referenceCacheGet(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    let company: any = null;

    try {
      company = await (Company as any).findOne({
        where: whereClause
      });

      if (company) {
        const companyData: any = serializeCompanyBase(company.toJSON());

        try {
          if (await companyGstTableExists()) {
            const gstMap = await batchGstNumbersByCompany([Number(companyData.id)]);
            companyData.gst_numbers = gstMap.get(Number(companyData.id)) || [];
          } else {
            companyData.gst_numbers = [];
          }
        } catch (gstError: any) {
          console.error('GST 번호 조회 실패:', gstError.message);
          companyData.gst_numbers = [];
        }

        try {
          const employeeCount = await (User as any).count({
            where: { company_id: companyData.id }
          });
          companyData.employee_count = employeeCount || 0;
        } catch (employeeCountError: any) {
          console.error(`직원 수 계산 오류 (회사 ID: ${companyData.id}):`, employeeCountError);
          companyData.employee_count = 0;
        }

        company = companyData;
      }
    } catch (error: any) {
      console.error('회사 조회 중 오류:', error.message);
      console.error('에러 스택:', error.stack);

      if (!company) {
        company = await (Company as any).findOne({
          where: whereClause
        });
      }

      if (company) {
        const companyData: any = serializeCompanyBase(
          company.toJSON ? company.toJSON() : company
        );

        try {
          const employeeCount = await (User as any).count({
            where: { company_id: companyData.id }
          });
          companyData.employee_count = employeeCount || 0;
        } catch (employeeCountError: any) {
          console.error(`직원 수 계산 오류 (회사 ID: ${companyData.id}):`, employeeCountError);
          companyData.employee_count = 0;
        }

        try {
          if (await companyGstTableExists()) {
            const gstMap = await batchGstNumbersByCompany([Number(companyData.id)]);
            companyData.gst_numbers = gstMap.get(Number(companyData.id)) || [];
          } else {
            companyData.gst_numbers = [];
          }
        } catch {
          companyData.gst_numbers = [];
        }

        company = companyData;
      }
    }

    if (!company) {
      return res.status(404).json({
        success: false,
        message: '회사를 찾을 수 없습니다.'
      });
    }

    const payload = { success: true, data: company };
    await referenceCacheSet(cacheKey, JSON.stringify(payload));
    res.json(payload);
  } catch (error) {
    console.error('회사 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '회사 정보를 불러오는데 실패했습니다.'
    });
  }
});

// 회사 생성 (root 권한만)
router.post(
  '/',
  authenticateToken,
  requireRole(['root']),
  validateBody({
    name: { required: true, type: 'string', minLength: 1, maxLength: 255 },
    business_number: { required: true, type: 'string', minLength: 4, maxLength: 50 },
    email: { type: 'string', maxLength: 100, pattern: emailPattern },
    phone: { type: 'string', maxLength: 50 },
    status: { type: 'string', oneOf: ['active', 'inactive', 'suspended'] }
  }),
  async (req, res) => {
  try {
    return res.status(403).json({
      success: false,
      message: `${PRODUCT_NAME}은 단독 시스템입니다. 회사를 추가할 수 없습니다.`,
    });

            const tenantId = (req as any).user.tenant_id;
            
    const companyData: any = {
      ...req.body,
      tenant_id: tenantId
    };

    // mvs_start_date, mvs_end_date를 login_period_start, login_period_end로 매핑
    if (companyData.mvs_start_date) {
      companyData.login_period_start = companyData.mvs_start_date;
      delete companyData.mvs_start_date;
    }
    if (companyData.mvs_end_date) {
      companyData.login_period_end = companyData.mvs_end_date;
      delete companyData.mvs_end_date;
    }

    // 날짜 필드 처리 (Invalid date를 null로 변환)
    if (companyData.login_period_start === 'Invalid date' || companyData.login_period_start === '' || !companyData.login_period_start) {
      companyData.login_period_start = null;
    }
    if (companyData.login_period_end === 'Invalid date' || companyData.login_period_end === '' || !companyData.login_period_end) {
      companyData.login_period_end = null;
    }

    // 빈 문자열을 null로 변환 (이미지 필드 제외)
    const imageFields = ['company_logo', 'company_seal', 'ceo_signature'];
    Object.keys(companyData).forEach(key => {
      if (!imageFields.includes(key) && companyData[key] === '') {
        companyData[key] = null;
      }
    });

    // NOT NULL 제약조건이 있는 TEXT/STRING 필드들을 빈 문자열로 설정 (null 방지)
    // 모델에서는 allowNull: true이지만 실제 DB에 NOT NULL 제약조건이 있을 수 있음
    const textFields = ['address', 'phone', 'email', 'website', 'industry', 'ceo_name', 
                        'account_holder_name', 'bank_name', 'account_number', 'ifsc_code', 
                        'swift_code', 'msme_number', 'iec_number', 'pan_number', 'bank_address'];
    textFields.forEach(field => {
      if (companyData[field] === null || companyData[field] === undefined || companyData[field] === '') {
        companyData[field] = '';
      }
    });

    // 이미지 필드 처리 (Base64를 Buffer로 변환)
    for (const field of imageFields) {
      if (companyData[field] && typeof companyData[field] === 'string' && companyData[field].startsWith('data:image')) {
        try {
          const base64Data = companyData[field].replace(/^data:image\/\w+;base64,/, '');
          companyData[field] = Buffer.from(base64Data, 'base64');
                  } catch (error: any) {
          console.error(`❌ 이미지 변환 실패 (${field}):`, error.message);
          return res.status(400).json({
            success: false,
            message: `${field} 이미지 변환에 실패했습니다.`
          });
        }
      } else if (companyData[field] === '' || companyData[field] === null) {
        companyData[field] = null;
      }
    }

    // GST 번호 처리 (별도 테이블)
    let gstNumbers: string[] | undefined = undefined;
    if (companyData.gst_numbers !== undefined) {
      gstNumbers = Array.isArray(companyData.gst_numbers) 
        ? companyData.gst_numbers.filter((gst: string) => gst && gst.trim() !== '')
        : [];
      delete companyData.gst_numbers; // Company 테이블에는 저장하지 않음
          }
    
    // 일반 필드와 이미지 필드 분리
    const nonImageData: any = {};
    const imageData: any = {};
    
    Object.keys(companyData).forEach(key => {
      if (imageFields.includes(key)) {
        imageData[key] = companyData[key];
      } else {
        nonImageData[key] = companyData[key];
      }
    });

    // 사업자등록번호는 유일해야 하므로 사전 확인해 사유를 명확히 전달
    if (nonImageData.business_number) {
      const duplicated = await (Company as any).findOne({
        where: { business_number: String(nonImageData.business_number).trim() }
      });
      if (duplicated) {
        return res.status(409).json({
          success: false,
          message: `이미 등록된 사업자등록번호입니다. (${String(nonImageData.business_number).trim()})`
        });
      }
    }

            // 일반 필드로 회사 생성
        const company = await (Company as any).create(nonImageData);
    const companyId = company.id;
    // GST 저장은 회사 생성 후 단계라 실패해도 롤백하지 않고 사유만 알린다
    let gstWarning = '';
        // GST 번호 저장
    if (gstNumbers !== undefined && gstNumbers.length > 0) {
            try {
        // company_gst_numbers 테이블 존재 여부 확인
        const [tableCheck] = await (sequelize as any).query(`
          SELECT EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'company_gst_numbers'
          ) as exists;
        `, { type: QueryTypes.SELECT }) as any[];
        
                
        const tableExists = tableCheck && (
          (Array.isArray(tableCheck) && tableCheck[0] && tableCheck[0].exists) ||
          (tableCheck.exists) ||
          (tableCheck[0]?.exists === true)
        );
        
        if (tableExists) {
                                                  
          const gstEntries = gstNumbers.map((gst: string) => ({
            company_id: companyId,
            gst_number: gst.trim(),
            status: 'active'
          }));
          
                    
          const createdGst = await (CompanyGstNumber as any).bulkCreate(gstEntries);
                            } else {
          gstWarning = 'GST 번호 저장소가 준비되지 않아 GST 번호는 저장되지 않았습니다.';
                  }
      } catch (gstError: any) {
        // 회사는 이미 생성되었으므로 진행하되, 사유는 응답에 포함한다
        console.error('❌ GST 번호 저장 오류:', gstError.message);
        console.error('에러 스택:', gstError.stack);
        const { message: gstReason } = describeCompanySaveError(
          gstError,
          'GST 번호 저장에 실패했습니다.'
        );
        gstWarning = `회사는 생성되었지만 GST 번호 저장에 실패했습니다. ${gstReason}`;
      }
    }
    // 이미지 필드가 있으면 별도로 업데이트
    if (Object.keys(imageData).length > 0) {
            for (const [field, value] of Object.entries(imageData)) {
        if (value !== null && Buffer.isBuffer(value)) {
          const hexString = '\\x' + (value as Buffer).toString('hex');
          await (sequelize as any).query(
            `UPDATE companies SET ${field} = $1::bytea WHERE id = $2 AND tenant_id = $3`,
            {
              bind: [hexString, companyId, tenantId],
              type: QueryTypes.UPDATE
            }
          );
                  }
      }
    }

    // 최종 회사 데이터 조회 (GST 번호 포함 시도)
        let finalCompany = await (Company as any).findOne({
      where: { 
        id: companyId,
        tenant_id: tenantId 
      }
    });

    // GST 번호 조회 시도 (테이블이 있는 경우)
    try {
      const tableCheck = await (sequelize as any).query(`
        SELECT EXISTS (
          SELECT 1 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'company_gst_numbers'
        ) as exists;
      `, { type: QueryTypes.SELECT }) as any[];
      
      if (tableCheck && tableCheck[0] && tableCheck[0].exists) {
        // GST 번호를 포함하여 다시 조회
        finalCompany = await (Company as any).findOne({
          where: { 
            id: companyId,
            tenant_id: tenantId 
          },
          include: [{
            model: CompanyGstNumber,
            as: 'gstNumbers', // 올바른 alias 사용
            required: false
          }]
        });
        
        // GST 번호를 배열로 변환
        if (finalCompany) {
          const companyData: any = finalCompany.toJSON();
          companyData.gst_numbers = companyData.gstNumbers 
            ? companyData.gstNumbers.map((gst: any) => gst.gst_number)
            : [];
          delete companyData.gstNumbers; // 원본 alias 제거
          finalCompany = companyData;
        }
      } else {
        // 테이블이 없으면 빈 배열로 설정
        if (finalCompany) {
          const companyData: any = finalCompany.toJSON();
          companyData.gst_numbers = [];
          finalCompany = companyData;
        }
      }
    } catch (includeError: any) {
      // include 실패 시 기본 데이터만 반환
            if (finalCompany) {
        const companyData: any = finalCompany.toJSON();
        companyData.gst_numbers = [];
        finalCompany = companyData;
      }
    }

    await invalidateCompaniesCache();
        res.status(201).json({
      success: true,
      data: finalCompany,
      message: '회사가 성공적으로 생성되었습니다.',
      warning: gstWarning || undefined
    });
  } catch (error: any) {
    console.error('❌ 회사 생성 오류:', error);
    console.error('에러 스택:', error.stack);
    console.error('에러 상세:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    const { status, message } = describeCompanySaveError(error, '회사 생성에 실패했습니다.');
    res.status(status).json({
      success: false,
      message,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 회사 수정 (root 권한만)
router.put(
  '/:id',
  authenticateToken,
  validateBody({
    name: { type: 'string', minLength: 1, maxLength: 255 },
    business_number: { type: 'string', minLength: 4, maxLength: 50 },
    email: { type: 'string', maxLength: 100, pattern: emailPattern },
    phone: { type: 'string', maxLength: 50 },
    status: { type: 'string', oneOf: ['active', 'inactive', 'suspended'] }
  }),
  async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).user.tenant_id;
    const userRole = (req as any).user.role;
    const userCompanyId = (req as any).user.company_id;
    
    // root나 admin만 수정 가능, admin은 자신의 회사만 수정 가능
    if (userRole !== 'root' && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '회사 정보를 수정할 권한이 없습니다.'
      });
    }
    
    // admin은 자신의 회사만 수정 가능
    if (userRole === 'admin' && userCompanyId !== parseInt(id)) {
      return res.status(403).json({
        success: false,
        message: '자신이 속한 회사 정보만 수정할 수 있습니다.'
      });
    }
    
    // 요청 데이터 검증 및 정리
    const updateData = { ...req.body };

    // settings.bank_transfer: API 키 마스킹 유지 + 기존 키 보존 병합
    if (updateData.settings !== undefined) {
      const existingCompany = await (Company as any).findOne({
        where: { id: parseInt(id, 10), tenant_id: tenantId },
        attributes: ['id', 'settings']
      });
      const existingSettings =
        existingCompany?.settings && typeof existingCompany.settings === 'object'
          ? { ...existingCompany.settings }
          : {};
      const incomingSettings =
        updateData.settings && typeof updateData.settings === 'object'
          ? { ...updateData.settings }
          : {};
      updateData.settings = {
        ...existingSettings,
        ...incomingSettings,
        bank_transfer: mergeBankTransferSettings(
          getCompanyBankTransferSettings(existingSettings),
          getCompanyBankTransferSettings(incomingSettings)
        )
      };
    }
    
    // mvs_start_date, mvs_end_date를 login_period_start, login_period_end로 매핑
    if (updateData.mvs_start_date !== undefined) {
      updateData.login_period_start = updateData.mvs_start_date;
      delete updateData.mvs_start_date;
    }
    if (updateData.mvs_end_date !== undefined) {
      updateData.login_period_end = updateData.mvs_end_date;
      delete updateData.mvs_end_date;
    }
    
    // 날짜 필드 처리 (Invalid date를 null로 변환 및 날짜 형식 변환)
    if (updateData.login_period_start !== undefined) {
      if (updateData.login_period_start === 'Invalid date' || updateData.login_period_start === '' || !updateData.login_period_start) {
        updateData.login_period_start = null;
      } else if (typeof updateData.login_period_start === 'string') {
        // 문자열 날짜를 Date 객체로 변환 (YYYY-MM-DD 형식)
        try {
          const date = new Date(updateData.login_period_start);
          if (!isNaN(date.getTime())) {
            updateData.login_period_start = date;
          } else {
            updateData.login_period_start = null;
          }
        } catch (e) {
          updateData.login_period_start = null;
        }
      }
    }
    
    if (updateData.login_period_end !== undefined) {
      if (updateData.login_period_end === 'Invalid date' || updateData.login_period_end === '' || !updateData.login_period_end) {
        updateData.login_period_end = null;
      } else if (typeof updateData.login_period_end === 'string') {
        // 문자열 날짜를 Date 객체로 변환 (YYYY-MM-DD 형식)
        try {
          const date = new Date(updateData.login_period_end);
          if (!isNaN(date.getTime())) {
            updateData.login_period_end = date;
          } else {
            updateData.login_period_end = null;
          }
        } catch (e) {
          updateData.login_period_end = null;
        }
      }
    }
    
        
    // 이미지 필드 처리 (Base64를 Buffer로 변환)
    const imageFields = ['company_logo', 'company_seal', 'ceo_signature'];
    for (const field of imageFields) {
      if (updateData[field] !== undefined) {
        if (updateData[field] === null || updateData[field] === '') {
          // 이미지 삭제
          updateData[field] = null;
        } else if (typeof updateData[field] === 'string' && updateData[field].startsWith('data:image')) {
          // Base64 이미지를 Buffer로 변환
          try {
            // data:image/jpeg;base64,/9j/4AAQ... 형식에서 base64 부분만 추출
            const base64Data = updateData[field].replace(/^data:image\/\w+;base64,/, '');
            const imageBuffer = Buffer.from(base64Data, 'base64');
            updateData[field] = imageBuffer;
                      } catch (error: any) {
            console.error(`❌ 이미지 변환 실패 (${field}):`, error.message);
            return res.status(400).json({
              success: false,
              message: `${field} 이미지 변환에 실패했습니다.`
            });
          }
        }
      }
    }
    
    // 빈 문자열 처리 (이미지 필드 제외)
    // address, phone, email, industry는 NOT NULL 제약조건이 있으므로 빈 문자열로 유지
    const notNullFields = ['address', 'phone', 'email', 'industry'];
    Object.keys(updateData).forEach(key => {
      if (!imageFields.includes(key)) {
        if (updateData[key] === '') {
          // NOT NULL 필드는 빈 문자열로 유지, 나머지는 null로 변환
          if (!notNullFields.includes(key)) {
            updateData[key] = null;
          }
        } else if (updateData[key] === null && notNullFields.includes(key)) {
          // null 값이 전송된 NOT NULL 필드는 빈 문자열로 변환
          updateData[key] = '';
        }
      }
    });
    
    // GST 번호 처리 (별도 테이블)
    let gstNumbers: string[] | undefined = undefined;
    if (updateData.gst_numbers !== undefined) {
      gstNumbers = Array.isArray(updateData.gst_numbers) 
        ? updateData.gst_numbers.filter((gst: string) => gst && gst.trim() !== '')
        : [];
      delete updateData.gst_numbers; // Company 테이블에는 저장하지 않음
    }
    
    // tenant_id는 업데이트하지 않음
    delete updateData.tenant_id;
    delete updateData.id;
    delete updateData.created_at;
    delete updateData.createdAt; // camelCase 버전도 제거
    delete updateData.updatedAt; // camelCase 버전도 제거 (updated_at은 자동 업데이트됨)
    
        
    // DB 컬럼 길이 확인 및 자동 수정
    try {
      const [columnInfo] = await (sequelize as any).query(`
        SELECT character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'companies' 
        AND column_name = 'business_number';
      `, { type: QueryTypes.SELECT }) as any[];
      
      if (columnInfo && columnInfo.character_maximum_length && columnInfo.character_maximum_length < 50) {
                await (sequelize as any).query(`
          ALTER TABLE companies 
          ALTER COLUMN business_number TYPE VARCHAR(50);
        `, { type: QueryTypes.RAW });
              }
    } catch (columnFixError: any) {
      console.error('⚠️ 컬럼 길이 자동 수정 실패 (계속 진행):', columnFixError.message);
    }
    
    // 이미지 필드는 별도로 처리 (BYTEA 타입)
    const imageUpdates: any = {};
    const nonImageUpdates: any = {};
    
    Object.keys(updateData).forEach(key => {
      if (imageFields.includes(key)) {
        imageUpdates[key] = updateData[key];
      } else {
        nonImageUpdates[key] = updateData[key];
      }
    });
    
    // 이미지 컬럼 타입 확인 및 자동 수정 (VARCHAR -> BYTEA)
    for (const imageField of imageFields) {
      if (imageUpdates[imageField] !== undefined && imageUpdates[imageField] !== null) {
        try {
          const [columnInfo] = await (sequelize as any).query(`
            SELECT data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_schema = 'public' 
            AND table_name = 'companies' 
            AND column_name = '${imageField}';
          `, { type: QueryTypes.SELECT }) as any[];
          
          if (columnInfo && columnInfo.data_type === 'character varying') {
                        await (sequelize as any).query(`
              ALTER TABLE companies 
              ALTER COLUMN ${imageField} TYPE BYTEA USING NULL;
            `, { type: QueryTypes.RAW });
                      }
        } catch (columnFixError: any) {
          console.error(`⚠️ ${imageField} 컬럼 타입 자동 수정 실패 (계속 진행):`, columnFixError.message);
        }
      }
    }
    
    // 일반 필드 업데이트
    if (Object.keys(nonImageUpdates).length > 0) {
      try {
        // 업데이트할 컬럼 중 알려진 누락 가능 컬럼만 체크
        const knownColumns = ['status', 'bank_address', 'swift_code', 'msme_number', 'iec_number', 'pan_number'];
        const columnsToCheck = Object.keys(nonImageUpdates).filter(key => knownColumns.includes(key));
        
        if (columnsToCheck.length > 0) {
          // 필요한 컬럼만 존재 여부 확인
          const columnChecks = await Promise.all(
            columnsToCheck.map(async (columnName) => {
              try {
                const [result] = await (sequelize as any).query(`
                  SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'companies' 
                    AND column_name = $1
                  ) as exists;
                `, {
                  bind: [columnName],
                  type: QueryTypes.SELECT
                }) as any[];
                return { columnName, exists: result?.exists || false };
              } catch (error) {
                return { columnName, exists: false };
              }
            })
          );
          
          // 누락된 컬럼만 추가
          const missingColumns = columnChecks.filter(check => !check.exists).map(check => check.columnName);
          
          if (missingColumns.length > 0) {
                        
            for (const columnName of missingColumns) {
              try {
                // status 컬럼 (ENUM 타입)
                if (columnName === 'status') {
                  // ENUM 타입 확인 및 생성
                  const enumCheck = await (sequelize as any).query(`
                    SELECT EXISTS (
                      SELECT 1 FROM pg_type WHERE typname = 'company_status_enum'
                    ) as exists;
                  `, { type: QueryTypes.SELECT }) as any[];
                  
                  if (!enumCheck[0]?.exists) {
                    await (sequelize as any).query(`
                      CREATE TYPE company_status_enum AS ENUM ('active', 'inactive', 'suspended');
                    `, { type: QueryTypes.RAW });
                  }
                  
                  await (sequelize as any).query(`
                    ALTER TABLE companies 
                    ADD COLUMN IF NOT EXISTS status company_status_enum NOT NULL DEFAULT 'active';
                  `, { type: QueryTypes.RAW });
                                  }
                // bank_address 컬럼
                else if (columnName === 'bank_address') {
                  await (sequelize as any).query(`
                    ALTER TABLE companies 
                    ADD COLUMN IF NOT EXISTS bank_address TEXT;
                  `, { type: QueryTypes.RAW });
                                  }
                // swift_code 컬럼
                else if (columnName === 'swift_code') {
                  await (sequelize as any).query(`
                    ALTER TABLE companies 
                    ADD COLUMN IF NOT EXISTS swift_code VARCHAR(11);
                  `, { type: QueryTypes.RAW });
                                  }
                // msme_number 컬럼
                else if (columnName === 'msme_number') {
                  await (sequelize as any).query(`
                    ALTER TABLE companies 
                    ADD COLUMN IF NOT EXISTS msme_number VARCHAR(50);
                  `, { type: QueryTypes.RAW });
                                  }
                // iec_number 컬럼
                else if (columnName === 'iec_number') {
                  await (sequelize as any).query(`
                    ALTER TABLE companies 
                    ADD COLUMN IF NOT EXISTS iec_number VARCHAR(50);
                  `, { type: QueryTypes.RAW });
                                  }
                // pan_number 컬럼
                else if (columnName === 'pan_number') {
                  await (sequelize as any).query(`
                    ALTER TABLE companies 
                    ADD COLUMN IF NOT EXISTS pan_number VARCHAR(50);
                  `, { type: QueryTypes.RAW });
                                  }
              } catch (addColumnError: any) {
                console.error(`❌ ${columnName} 컬럼 추가 실패:`, addColumnError.message);
              }
            }
          }
        }
        
        // 업데이트할 데이터 로그 출력
                
        // 날짜 필드를 DATEONLY 형식으로 변환 (YYYY-MM-DD)
        const finalUpdates = { ...nonImageUpdates };
        if (finalUpdates.login_period_start instanceof Date) {
          finalUpdates.login_period_start = finalUpdates.login_period_start.toISOString().split('T')[0];
        } else if (finalUpdates.login_period_start && typeof finalUpdates.login_period_start === 'string') {
          // 이미 YYYY-MM-DD 형식인 경우 그대로 사용
          finalUpdates.login_period_start = finalUpdates.login_period_start.split('T')[0];
        }
        
        if (finalUpdates.login_period_end instanceof Date) {
          finalUpdates.login_period_end = finalUpdates.login_period_end.toISOString().split('T')[0];
        } else if (finalUpdates.login_period_end && typeof finalUpdates.login_period_end === 'string') {
          // 이미 YYYY-MM-DD 형식인 경우 그대로 사용
          finalUpdates.login_period_end = finalUpdates.login_period_end.split('T')[0];
        }
        
                
        // 모든 컬럼 업데이트 (Sequelize가 존재하지 않는 컬럼은 자동으로 무시)
        const updateResult = await (Company as any).update(finalUpdates, {
          where: { 
            id: parseInt(id),
            tenant_id: tenantId 
          }
        });
        
              } catch (updateError: any) {
        // 컬럼이 존재하지 않는 경우를 더 명확하게 처리
        if (updateError.message && updateError.message.includes('column') && updateError.message.includes('does not exist')) {
          console.error('❌ 존재하지 않는 컬럼으로 인한 업데이트 오류:', updateError.message);
          // 존재하지 않는 컬럼을 제외하고 다시 시도
          const errorColumn = updateError.message.match(/column "(\w+)" does not exist/i)?.[1];
          if (errorColumn) {
                        const retryUpdates = { ...nonImageUpdates };
            delete retryUpdates[errorColumn];
            if (Object.keys(retryUpdates).length > 0) {
              await (Company as any).update(retryUpdates, {
                where: { 
                  id: parseInt(id),
                  tenant_id: tenantId 
                }
              });
                          }
          } else {
            throw updateError;
          }
        } else {
          console.error('❌ 회사 정보 업데이트 오류:', updateError.message);
          console.error('에러 스택:', updateError.stack);
          throw updateError;
        }
      }
    }
    
    // GST 번호 업데이트
    if (gstNumbers !== undefined) {
      try {
        // company_gst_numbers 테이블 존재 여부 확인
        const tableCheck = await (sequelize as any).query(`
          SELECT EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'company_gst_numbers'
          ) as exists;
        `, { type: QueryTypes.SELECT }) as any[];
        
        if (tableCheck && tableCheck[0] && tableCheck[0].exists) {
          // 기존 GST 번호 삭제
          await (CompanyGstNumber as any).destroy({
            where: { company_id: parseInt(id) }
          });
          
          // 새로운 GST 번호 추가
          if (gstNumbers.length > 0) {
            const gstEntries = gstNumbers.map((gst: string) => ({
              company_id: parseInt(id),
              gst_number: gst.trim(),
              status: 'active'
            }));
            await (CompanyGstNumber as any).bulkCreate(gstEntries);
          }
        }
      } catch (gstError: any) {
        // 테이블이 없는 경우 등 에러는 무시하고 계속 진행
        if (gstError.code === '42P01') {
          // GST 테이블이 아직 생성되지 않은 개발 환경에서는 회사 수정을 계속한다.
        } else {
          console.error('GST 번호 업데이트 오류:', gstError.message);
        }
      }
    }
    
    // 이미지 필드 업데이트 (BYTEA 타입)
    if (Object.keys(imageUpdates).length > 0) {
      for (const [field, value] of Object.entries(imageUpdates)) {
        if (value === null) {
          // 이미지 삭제
          await (sequelize as any).query(
            `UPDATE companies SET ${field} = NULL WHERE id = $1 AND tenant_id = $2`,
            {
              bind: [parseInt(id), tenantId],
              type: QueryTypes.UPDATE
            }
          );
        } else if (Buffer.isBuffer(value)) {
          // 이미지 업데이트 (BYTEA) - hex 형식으로 변환
          const hexString = '\\x' + value.toString('hex');
          await (sequelize as any).query(
            `UPDATE companies SET ${field} = $1::bytea WHERE id = $2 AND tenant_id = $3`,
            {
              bind: [hexString, parseInt(id), tenantId],
              type: QueryTypes.UPDATE
            }
          );
                  }
      }
    }
    
    // 회사 정보 조회 (GST 번호 포함 시도)
    let updatedCompany = await (Company as any).findOne({
      where: { 
        id: parseInt(id),
        tenant_id: tenantId 
      }
    });

    // GST 번호 조회 시도 (테이블이 있는 경우)
    try {
      const tableCheck = await (sequelize as any).query(`
        SELECT EXISTS (
          SELECT 1 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'company_gst_numbers'
        ) as exists;
      `, { type: QueryTypes.SELECT }) as any[];
      
      if (tableCheck && tableCheck[0] && tableCheck[0].exists) {
        // GST 번호를 포함하여 다시 조회
        updatedCompany = await (Company as any).findOne({
          where: { 
            id: parseInt(id),
            tenant_id: tenantId 
          },
          include: [{
            model: CompanyGstNumber,
            as: 'gstNumbers', // 올바른 alias 사용
            required: false
          }]
        });
        
        // GST 번호를 배열로 변환
        if (updatedCompany) {
          const companyData: any = updatedCompany.toJSON();
          companyData.gst_numbers = companyData.gstNumbers 
            ? companyData.gstNumbers.map((gst: any) => gst.gst_number)
            : [];
          delete companyData.gstNumbers; // 원본 alias 제거
          updatedCompany = companyData;
        }
      } else {
        // 테이블이 없으면 빈 배열로 설정
        if (updatedCompany) {
          const companyData: any = updatedCompany.toJSON();
          companyData.gst_numbers = [];
          updatedCompany = companyData;
        }
      }
    } catch (includeError: any) {
      // include 실패 시 기본 데이터만 반환
            if (updatedCompany) {
        const companyData: any = updatedCompany.toJSON();
        companyData.gst_numbers = [];
        updatedCompany = companyData;
      }
    }

    await invalidateCompaniesCache();
    res.json({
      success: true,
      data: updatedCompany,
      message: '회사 정보가 성공적으로 수정되었습니다.'
    });
  } catch (error: any) {
    console.error('회사 수정 오류:', error);
    console.error('에러 스택:', error.stack);
    const { status, message } = describeCompanySaveError(error, '회사 수정에 실패했습니다.');
    res.status(status).json({
      success: false,
      message,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DB 컬럼 길이 수정 (root 권한만, 개발용)
router.post('/fix-column-lengths', authenticateToken, requireRole(['root']), async (req, res) => {
  try {
        
    // business_number 컬럼 길이 변경
    await (sequelize as any).query(`
      ALTER TABLE companies 
      ALTER COLUMN business_number TYPE VARCHAR(50);
    `, { type: QueryTypes.RAW });
    
        
    // 변경 후 확인
    const [columnInfo] = await (sequelize as any).query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'companies' 
      AND column_name = 'business_number';
    `, { type: QueryTypes.SELECT }) as any[];
    
    res.json({
      success: true,
      message: '컬럼 길이 수정 완료',
      columnInfo: columnInfo
    });
  } catch (error: any) {
    console.error('❌ 컬럼 길이 수정 오류:', error.message);
    res.status(500).json({
      success: false,
      message: '컬럼 길이 수정에 실패했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 회사 삭제 (root 권한만) — 하위 사용자·메뉴 등 연관 데이터 FK 역순 cascade 삭제
router.delete('/:id', authenticateToken, requireRole(['root']), async (req, res) => {
  try {
    return res.status(403).json({
      success: false,
      message: `${PRODUCT_NAME}은 단독 시스템입니다. 회사를 삭제할 수 없습니다.`,
    });

    const companyId = parseInt(req.params.id, 10);
    if (!Number.isFinite(companyId)) {
      return res.status(400).json({
        success: false,
        message: '유효하지 않은 회사 ID입니다.',
      });
    }

    const result = await deleteCompanyWithCascade(companyId);

    await invalidateCompaniesCache();
    res.json({
      success: true,
      message: result.purgedTenant
        ? '회사 및 테넌트 관련 데이터가 모두 삭제되었습니다.'
        : '회사 및 관련 데이터가 성공적으로 삭제되었습니다.',
      data: result,
    });
  } catch (error) {
    if (error instanceof CompanyNotFoundError) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    console.error('회사 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '회사 삭제 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined,
    });
  }
});

export default router;

