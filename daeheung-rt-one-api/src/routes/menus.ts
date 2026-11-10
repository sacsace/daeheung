import express from 'express';
import { getUserMenus, createMenu, updateMenu, deleteMenu } from '../controllers/menuController';
import { authenticateToken, requireRole } from '../middleware/auth';
import { UserPermission, Menu } from '../models';

const router = express.Router();

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticateToken);

// 사용자 권한 조회 (더 구체적인 경로를 먼저 정의)
router.get('/user/:userId/permissions', async (req, res) => {
  try {
    const permissions = await (UserPermission as any).findAll({
      where: { user_id: req.params.userId },
      include: [{
        model: Menu,
        as: 'menu'
      }]
    });
    
    res.json({
      success: true,
      data: permissions
    });
  } catch (error) {
    console.error('사용자 권한 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용자 권한 조회 중 오류가 발생했습니다.'
    });
  }
});

// 프론트엔드 호출 경로 추가
router.get('/user/:userId/tenant/:tenantId', getUserMenus);

// 메뉴 목록 조회 (기본 경로)
router.get('/:userId/:tenantId', getUserMenus);

// 메뉴 생성 (관리자만)
router.post('/', requireRole(['admin', 'root']), createMenu);

// 메뉴 수정 (관리자만)
router.put('/:id', requireRole(['admin', 'root']), updateMenu);

// 메뉴 삭제 (관리자만)
router.delete('/:id', requireRole(['admin', 'root']), deleteMenu);

export default router;
