import express from 'express';
import { Response } from 'express';
import { Customer, RoomBooking } from '../models';
import { resolveRequestCompanyId } from '../utils/resolveRequestCompanyId';
import { validateBody } from '../middleware/validate';
import { authenticateToken } from '../middleware/auth';
import { requireAdminRootOrMenuPermissionAnyOf } from '../middleware/menuPermission';
import { AuthRequest } from '../types';

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 고객 CRUD는 파트너/고객 통합 메뉴 권한으로 검사 (구 /customers/info 제거됨) */
const CUSTOMER_MENU_ROUTES = ['/basic-info/partners', '/basic-info', '/customers/info', '/customers'];
/** 예약에서 합성한 숙박손님 행 id (`1000000000 + booking.id`) */
const GUEST_CUSTOMER_ID_BASE = 1000000000;

const permRead = requireAdminRootOrMenuPermissionAnyOf(CUSTOMER_MENU_ROUTES, ['can_view', 'can_create']);
const permCreate = requireAdminRootOrMenuPermissionAnyOf(CUSTOMER_MENU_ROUTES, ['can_create']);
const permEdit = requireAdminRootOrMenuPermissionAnyOf(CUSTOMER_MENU_ROUTES, ['can_edit']);
const permDelete = requireAdminRootOrMenuPermissionAnyOf(CUSTOMER_MENU_ROUTES, ['can_delete']);

router.use(authenticateToken);

async function companyIdForRequest(req: AuthRequest, res: Response): Promise<number | null> {
  try {
    return await resolveRequestCompanyId(req);
  } catch (error: any) {
    if (error?.status === 400) {
      res.status(400).json({ success: false, message: error.message || '선택한 회사를 찾을 수 없습니다.' });
      return null;
    }
    throw error;
  }
}

// 고객 목록 조회
router.get('/', permRead, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user.tenant_id;
    const companyId = await companyIdForRequest(req, res);
    if (companyId == null) return;

    const customers = await (Customer as any).findAll({
      where: { tenant_id: tenantId, company_id: companyId },
      order: [['created_at', 'DESC']]
    });

    const roomGuests = await (RoomBooking as any).findAll({
      where: {
        tenant_id: tenantId,
        company_id: companyId,
        is_active: true
      },
      attributes: [
        'id',
        'guest_name',
        'company_name',
        'guest_email',
        'guest_phone',
        'status',
        'created_at',
        'updated_at'
      ],
      order: [['updated_at', 'DESC']]
    });

    const customerRows = customers.map((row: any) => ({
      ...row.toJSON(),
      source_type: 'customer'
    }));

    const guestMap = new Map<string, any>();
    for (const booking of roomGuests) {
      const guestName = String(booking.guest_name || '').trim();
      if (!guestName) continue;
      const guestPhone = String(booking.guest_phone || '').trim();
      const guestEmail = String(booking.guest_email || '').trim().toLowerCase();
      const dedupeKey = `${guestName.toLowerCase()}|${guestPhone}|${guestEmail}`;
      if (guestMap.has(dedupeKey)) continue;

      guestMap.set(dedupeKey, {
        id: GUEST_CUSTOMER_ID_BASE + Number(booking.id || 0),
        tenant_id: tenantId,
        company_id: companyId,
        name: guestName,
        business_number: null,
        ceo_name: booking.company_name || '숙박손님',
        address: null,
        phone: guestPhone || null,
        email: guestEmail || null,
        website: null,
        industry: '숙박손님',
        status: booking.status === 'cancelled' || booking.status === 'no_show' ? 'inactive' : 'active',
        created_at: booking.created_at,
        updated_at: booking.updated_at,
        source_type: 'room_guest',
        source_booking_id: booking.id
      });
    }

    const mergedRows = [...customerRows, ...Array.from(guestMap.values())].sort((a: any, b: any) => {
      const aTs = a?.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bTs = b?.updated_at ? new Date(b.updated_at).getTime() : 0;
      return bTs - aTs;
    });

    res.json({
      success: true,
      data: mergedRows
    });
  } catch (error: any) {
    console.error('고객 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '고객 목록 조회 중 오류가 발생했습니다.'
    });
  }
});

// 특정 고객 조회
router.get('/:id', permRead, async (req: AuthRequest, res: Response) => {
  try {
    const numericId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isFinite(numericId)) {
      return res.status(400).json({ success: false, message: '잘못된 고객 ID입니다.' });
    }
    if (numericId >= GUEST_CUSTOMER_ID_BASE) {
      return res.status(404).json({
        success: false,
        message: '고객을 찾을 수 없습니다.'
      });
    }

    const companyId = await companyIdForRequest(req, res);
    if (companyId == null) return;

    const customer = await (Customer as any).findOne({
      where: {
        id: numericId,
        tenant_id: req.user.tenant_id,
        company_id: companyId
      }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: '고객을 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      data: customer
    });
  } catch (error: any) {
    console.error('고객 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '고객 조회 중 오류가 발생했습니다.'
    });
  }
});

// 고객 생성
router.post(
  '/',
  permCreate,
  validateBody({
    name: { required: true, type: 'string', minLength: 1, maxLength: 200 },
    email: { type: 'string', maxLength: 255, pattern: emailPattern },
    business_number: { type: 'string', maxLength: 50 },
    status: { type: 'string', maxLength: 20 }
  }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = await companyIdForRequest(req, res);
      if (companyId == null) return;
      const { company_id: _ignoredCompanyId, companyId: _ignoredCompanyIdCamel, ...body } = req.body || {};
      const customerData = {
        ...body,
        tenant_id: req.user.tenant_id,
        company_id: companyId
      };

      const customer = await (Customer as any).create(customerData);

      res.status(201).json({
        success: true,
        message: '고객이 성공적으로 등록되었습니다.',
        data: customer
      });
    } catch (error: any) {
      console.error('고객 생성 오류:', error);
      res.status(500).json({
        success: false,
        message: '고객 생성 중 오류가 발생했습니다.'
      });
    }
  }
);

// 고객 수정
router.put(
  '/:id',
  permEdit,
  validateBody({
    name: { type: 'string', minLength: 1, maxLength: 200 },
    email: { type: 'string', maxLength: 255, pattern: emailPattern },
    business_number: { type: 'string', maxLength: 50 },
    status: { type: 'string', maxLength: 20 }
  }),
  async (req: AuthRequest, res: Response) => {
    try {
      const numericId = Number.parseInt(String(req.params.id), 10);
      if (!Number.isFinite(numericId)) {
        return res.status(400).json({ success: false, message: '잘못된 고객 ID입니다.' });
      }
      if (numericId >= GUEST_CUSTOMER_ID_BASE) {
        return res.status(400).json({
          success: false,
          message: '숙박 연동 고객은 이 API로 수정할 수 없습니다.'
        });
      }

      const companyId = await companyIdForRequest(req, res);
      if (companyId == null) return;

      const customer = await (Customer as any).findOne({
        where: {
          id: numericId,
          tenant_id: req.user.tenant_id,
          company_id: companyId
        }
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: '고객을 찾을 수 없습니다.'
        });
      }

      const { company_id: _ignoredCompanyId, companyId: _ignoredCompanyIdCamel, ...body } = req.body || {};
      await customer.update(body);

      res.json({
        success: true,
        message: '고객 정보가 성공적으로 수정되었습니다.',
        data: customer
      });
    } catch (error: any) {
      console.error('고객 수정 오류:', error);
      res.status(500).json({
        success: false,
        message: '고객 수정 중 오류가 발생했습니다.'
      });
    }
  }
);

// 고객 삭제
router.delete('/:id', permDelete, async (req: AuthRequest, res: Response) => {
  try {
    const numericId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isFinite(numericId)) {
      return res.status(400).json({ success: false, message: '잘못된 고객 ID입니다.' });
    }
    if (numericId >= GUEST_CUSTOMER_ID_BASE) {
      return res.status(400).json({
        success: false,
        message: '숙박 연동 고객은 이 API로 삭제할 수 없습니다.'
      });
    }

    const companyId = await companyIdForRequest(req, res);
    if (companyId == null) return;

    const customer = await (Customer as any).findOne({
      where: {
        id: numericId,
        tenant_id: req.user.tenant_id,
        company_id: companyId
      }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: '고객을 찾을 수 없습니다.'
      });
    }

    await customer.destroy();

    res.json({
      success: true,
      message: '고객이 성공적으로 삭제되었습니다.'
    });
  } catch (error: any) {
    console.error('고객 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '고객 삭제 중 오류가 발생했습니다.'
    });
  }
});

export default router;
