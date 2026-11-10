import express from 'express';
import {
  getUserMenus,
  getAllMenus,
  createMenu,
  updateMenu,
  deleteMenu,
  updateMenuOrder,
  setUserPermissions,
  getUserPermissions
} from '../controllers/menuController';
import { authenticateToken } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = express.Router();

// 사용자별 메뉴 조회 (권한 기반)
router.get('/user/:userId/tenant/:tenantId', authenticateToken, getUserMenus);

// 모든 메뉴 조회 (관리자용)
router.get('/tenant/:tenantId', authenticateToken, getAllMenus);

// 메뉴 생성 (관리자용)
router.post(
  '/tenant/:tenantId',
  authenticateToken,
  validateBody({
    name_ko: { required: true, type: 'string', minLength: 1, maxLength: 100 },
    name_en: { required: true, type: 'string', minLength: 1, maxLength: 100 },
    route: { required: true, type: 'string', minLength: 1, maxLength: 255 },
    icon: { required: true, type: 'string', minLength: 1, maxLength: 50 },
    order: { type: 'number' },
    level: { type: 'number' },
    parent_id: { type: 'number' },
    is_active: { type: 'boolean' },
    description: { type: 'string' }
  }),
  createMenu
);

// 메뉴 순서 업데이트 (관리자용) - 동적 경로보다 먼저 정의해야 함
router.put('/order', authenticateToken, updateMenuOrder);

// 메뉴 수정 (관리자용)
router.put(
  '/:menuId',
  authenticateToken,
  validateBody({
    name_ko: { type: 'string', minLength: 1, maxLength: 100 },
    name_en: { type: 'string', minLength: 1, maxLength: 100 },
    route: { type: 'string', minLength: 1, maxLength: 255 },
    icon: { type: 'string', minLength: 1, maxLength: 50 },
    order: { type: 'number' },
    level: { type: 'number' },
    parent_id: { type: 'number' },
    is_active: { type: 'boolean' },
    description: { type: 'string' }
  }),
  updateMenu
);

// 메뉴 삭제 (관리자용)
router.delete('/:menuId', authenticateToken, deleteMenu);

// 사용자 권한 설정 — root/admin만 (admin은 컨트롤러에서 본인 권한 범위로 재검증)
router.post(
  '/permissions/user/:userId',
  authenticateToken,
  (req, res, next) => {
    const role = (req as any).user?.role;
    if (role === 'root' || role === 'admin') {
      next();
      return;
    }
    res.status(403).json({
      success: false,
      message: '메뉴 권한을 설정할 수 있는 권한이 없습니다.'
    });
  },
  setUserPermissions
);

// 사용자 권한 조회
router.get('/permissions/user/:userId', authenticateToken, getUserPermissions);

export default router;
