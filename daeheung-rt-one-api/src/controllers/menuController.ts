import { Request, Response } from 'express';
import { Menu, UserPermission, User, Company } from '../models';
import { Op } from 'sequelize';
import { isMinsubCompanyName } from '../middleware/auth';
import { IS_STANDALONE } from '../config/standalone';

/** Minsub Ventures 소속에만 노출하는 메뉴 route */
const MINSUB_ONLY_MENU_ROUTES = ['/work/assignee-list'];

const isMinsubOnlyMenuRoute = (route?: string | null): boolean => {
  if (!route) return false;
  return MINSUB_ONLY_MENU_ROUTES.some(
    (base) => route === base || route.startsWith(`${base}/`)
  );
};

const filterMinsubOnlyMenus = (menus: any[], companyName?: string | null): any[] => {
  if (IS_STANDALONE || isMinsubCompanyName(companyName)) return menus;
  return menus.filter((m) => !isMinsubOnlyMenuRoute(m?.route));
};

const resolveUserCompanyName = async (userId: number | string): Promise<string | null> => {
  const row = await (User as any).findByPk(userId, {
    attributes: ['id', 'company_id'],
    include: [{ model: Company, as: 'company', attributes: ['id', 'name'], required: false }],
  });
  if (!row) return null;
  const embedded = row.company?.name || row.Company?.name;
  if (embedded) return String(embedded);
  const companyId = Number(row.company_id);
  if (!Number.isFinite(companyId) || companyId <= 0) return null;
  const company = await (Company as any).findByPk(companyId, { attributes: ['name'] });
  return company?.name ? String(company.name) : null;
};

// 사용자별 메뉴 목록 조회 (권한 기반)
export const getUserMenus = async (req: Request, res: Response) => {
  try {
    const { userId, tenantId } = req.params;
    const { language = 'ko' } = req.query;
    
    // 현재 사용자 정보 확인 (req.user는 authenticateToken 미들웨어에서 설정됨)
    const currentUser = (req as any).user;
    const isRoot = currentUser?.role === 'root';
    
    let userMenus: any[] = [];
    
    // root 역할 사용자만 모든 메뉴 조회 (권한 체크 없이)
    // admin과 일반 사용자는 권한이 있는 메뉴만 조회
    if (isRoot) {
      userMenus = await (Menu as any).findAll({
        where: {
          tenant_id: tenantId,
          is_active: true
        },
        order: [
          ['order', 'ASC'],
          ['id', 'ASC']
        ]
      });
    } else {
      // admin과 일반 사용자는 권한이 있는 메뉴만 조회
      userMenus = await (Menu as any).findAll({
        where: {
          tenant_id: tenantId,
          is_active: true
        },
        include: [
          {
            model: UserPermission,
            as: 'permissions',
            where: {
              user_id: userId,
              can_view: true
            },
            required: true
          }
        ],
        order: [
          ['order', 'ASC'],
          ['id', 'ASC']
        ]
      });

      /**
       * 하위 메뉴에만 can_view 권한이 있고 부모 행이 조회 결과에 없으면 buildMenuTree에서 자식이 누락됨.
       * (예: 공지사항만 체크한 사용자 — 사이드바/헤더 진입·AppLayout 경로 매칭이 깨짐)
       */
      if (userMenus.length > 0) {
        const tid = tenantId;
        const collected: any[] = [...userMenus];
        const idSet = new Set(collected.map((m: any) => Number(m.id)));
        let guard = 0;
        while (guard++ < 24) {
          const parentIds = [
            ...new Set(
              collected
                .map((m: any) => (m.parent_id != null ? Number(m.parent_id) : NaN))
                .filter((pid: number) => Number.isInteger(pid) && pid > 0 && !idSet.has(pid))
            )
          ];
          if (parentIds.length === 0) break;
          const parents = await (Menu as any).findAll({
            where: { id: { [Op.in]: parentIds }, tenant_id: tid, is_active: true }
          });
          if (!parents?.length) break;
          let added = false;
          for (const p of parents) {
            const pid = Number((p as any).id);
            if (!idSet.has(pid)) {
              collected.push(p);
              idSet.add(pid);
              added = true;
            }
          }
          if (!added) break;
        }
        userMenus = collected;
      }
    }

    /**
     * 「내 정보·업무」는 모든 역할에 기본 부여한다.
     * (과거 root 전용 숨김 로직 제거)
     */

    // 고객사 리스트 등 Minsub 전용 메뉴는 해당 회사 사용자에게만 노출
    const companyName = await resolveUserCompanyName(userId);
    userMenus = filterMinsubOnlyMenus(userMenus, companyName);

    // 계층 구조로 변환
    const menuTree = buildMenuTree(userMenus, language as string);

    res.json({
      success: true,
      data: menuTree,
      message: '사용자 메뉴 목록을 성공적으로 조회했습니다.'
    });
  } catch (error: any) {
    console.error('메뉴 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '메뉴 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 모든 메뉴 목록 조회 (관리자용)
export const getAllMenus = async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { language = 'ko' } = req.query;

    const menus = await (Menu as any).findAll({
      where: {
        tenant_id: tenantId,
        is_active: true
      },
      order: [
        ['order', 'ASC'],
        ['id', 'ASC']
      ]
    });

    const menuTree = buildMenuTree(menus, language as string);

    res.json({
      success: true,
      data: menuTree,
      message: '전체 메뉴 목록을 성공적으로 조회했습니다.'
    });
  } catch (error) {
    console.error('전체 메뉴 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '전체 메뉴 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
};

// 메뉴 생성
export const createMenu = async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const menuData = {
      ...req.body,
      tenant_id: tenantId
    };

    const newMenu = await (Menu as any).create(menuData);

    res.status(201).json({
      success: true,
      data: newMenu,
      message: '메뉴가 성공적으로 생성되었습니다.'
    });
  } catch (error) {
    console.error('메뉴 생성 오류:', error);
    res.status(500).json({
      success: false,
      message: '메뉴 생성 중 오류가 발생했습니다.',
      error: error.message
    });
  }
};

// 메뉴 수정
export const updateMenu = async (req: Request, res: Response) => {
  try {
    const { menuId } = req.params;
    const updateData = req.body;

    const [updatedRowsCount] = await (Menu as any).update(updateData, {
      where: { id: menuId }
    });

    if (updatedRowsCount === 0) {
      return res.status(404).json({
        success: false,
        message: '메뉴를 찾을 수 없습니다.'
      });
    }

    const updatedMenu = await (Menu as any).findByPk(menuId);

    res.json({
      success: true,
      data: updatedMenu,
      message: '메뉴가 성공적으로 수정되었습니다.'
    });
  } catch (error) {
    console.error('메뉴 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: '메뉴 수정 중 오류가 발생했습니다.',
      error: error.message
    });
  }
};

// 메뉴 삭제
export const deleteMenu = async (req: Request, res: Response) => {
  try {
    const { menuId } = req.params;

    // 하위 메뉴가 있는지 확인
    const childMenus = await (Menu as any).count({
      where: { parent_id: menuId }
    });

    const menu = await (Menu as any).findOne({ where: { id: menuId } });
    
    if (!menu) {
      return res.status(404).json({
        success: false,
        message: '메뉴를 찾을 수 없습니다.'
      });
    }

    // 소프트 삭제: 하위 메뉴가 있어도 비활성화 가능
    // 하위 메뉴도 함께 비활성화
    await (Menu as any).update({ is_active: false }, { where: { parent_id: menuId } });
    await menu.update({ is_active: false });

    res.json({
      success: true,
      message: '메뉴가 성공적으로 비활성화되었습니다.'
    });
  } catch (error) {
    console.error('메뉴 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '메뉴 삭제 중 오류가 발생했습니다.',
      error: error.message
    });
  }
};

// 메뉴 순서 업데이트
export const updateMenuOrder = async (req: Request, res: Response) => {
  try {
    const { menus } = req.body;

    if (!menus || !Array.isArray(menus)) {
      return res.status(400).json({
        success: false,
        message: '메뉴 목록이 필요합니다.'
      });
    }

    // 트랜잭션으로 모든 메뉴 순서 업데이트
    const sequelize = Menu.sequelize!;
    await sequelize.transaction(async (transaction) => {
      for (const menuItem of menus) {
        await (Menu as any).update(
          { order: menuItem.order },
          {
            where: { id: menuItem.id },
            transaction
          }
        );
      }
    });

    res.json({
      success: true,
      message: '메뉴 순서가 성공적으로 업데이트되었습니다.'
    });
  } catch (error: any) {
    console.error('메뉴 순서 업데이트 오류:', error);
    res.status(500).json({
      success: false,
      message: '메뉴 순서 업데이트 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 사용자 권한 설정
export const setUserPermissions = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { permissions } = req.body;
    const granter = (req as any).user;

    if (!granter) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }
    if (granter.role !== 'root' && granter.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '메뉴 권한을 설정할 수 있는 권한이 없습니다.'
      });
    }

    const targetUserId = parseInt(String(userId), 10);
    if (!Number.isFinite(targetUserId)) {
      return res.status(400).json({ success: false, message: '잘못된 사용자 ID입니다.' });
    }

    const targetUser = await (User as any).findByPk(targetUserId, {
      attributes: ['id', 'tenant_id', 'company_id', 'role', 'status']
    });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: '대상 사용자를 찾을 수 없습니다.' });
    }

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ success: false, message: '권한 데이터 형식이 올바르지 않습니다.' });
    }

    // admin: root가 부여한 본인 권한 범위 안에서만 부여/회수. 범위 밖 메뉴는 유지.
    if (granter.role === 'admin') {
      if (Number(targetUser.company_id) !== Number(granter.company_id)) {
        return res.status(403).json({
          success: false,
          message: '같은 회사 사용자의 권한만 설정할 수 있습니다.'
        });
      }

      const granterRows = await (UserPermission as any).findAll({
        where: { user_id: granter.id },
        attributes: ['menu_id', 'can_view', 'can_create', 'can_edit', 'can_delete']
      });
      const granterMap = new Map<number, any>();
      granterRows.forEach((row: any) => {
        granterMap.set(Number(row.menu_id), row);
      });

      const managedMenuIds = Array.from(granterMap.keys());
      const permissionData: any[] = [];

      for (const perm of permissions) {
        const menuId = Number(perm.menu_id);
        if (!Number.isFinite(menuId)) {
          return res.status(400).json({ success: false, message: '잘못된 메뉴 ID가 포함되어 있습니다.' });
        }
        const granterPerm = granterMap.get(menuId);
        if (!granterPerm) {
          return res.status(403).json({
            success: false,
            message: 'root가 부여하지 않은 메뉴 권한은 admin이 추가할 수 없습니다.'
          });
        }

        if (
          (Boolean(perm.can_view) && !granterPerm.can_view) ||
          (Boolean(perm.can_create) && !granterPerm.can_create) ||
          (Boolean(perm.can_edit) && !granterPerm.can_edit) ||
          (Boolean(perm.can_delete) && !granterPerm.can_delete)
        ) {
          return res.status(403).json({
            success: false,
            message: '자신이 가진 권한 범위 내에서만 권한을 부여할 수 있습니다.'
          });
        }

        permissionData.push({
          user_id: targetUserId,
          menu_id: menuId,
          can_view: Boolean(perm.can_view) && Boolean(granterPerm.can_view),
          can_create: Boolean(perm.can_create) && Boolean(granterPerm.can_create),
          can_edit: Boolean(perm.can_edit) && Boolean(granterPerm.can_edit),
          can_delete: Boolean(perm.can_delete) && Boolean(granterPerm.can_delete)
        });
      }

      if (managedMenuIds.length > 0) {
        await (UserPermission as any).destroy({
          where: {
            user_id: targetUserId,
            menu_id: { [Op.in]: managedMenuIds }
          }
        });
      }

      const toCreate = permissionData.filter(
        (p) => p.can_view || p.can_create || p.can_edit || p.can_delete
      );
      if (toCreate.length > 0) {
        await (UserPermission as any).bulkCreate(toCreate);
      }
    } else {
      await (UserPermission as any).destroy({
        where: { user_id: targetUserId }
      });

      const permissionData = permissions
        .map((perm: any) => ({
          user_id: targetUserId,
          menu_id: Number(perm.menu_id),
          can_view: Boolean(perm.can_view),
          can_create: Boolean(perm.can_create),
          can_edit: Boolean(perm.can_edit),
          can_delete: Boolean(perm.can_delete)
        }))
        .filter(
          (p: any) =>
            Number.isFinite(p.menu_id) &&
            (p.can_view || p.can_create || p.can_edit || p.can_delete)
        );

      if (permissionData.length > 0) {
        await (UserPermission as any).bulkCreate(permissionData);
      }
    }

    res.json({
      success: true,
      message: '사용자 권한이 성공적으로 설정되었습니다.'
    });
  } catch (error) {
    console.error('사용자 권한 설정 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용자 권한 설정 중 오류가 발생했습니다.',
      error: error.message
    });
  }
};

// 사용자 권한 조회
export const getUserPermissions = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const permissions = await (UserPermission as any).findAll({
      where: { user_id: userId },
      include: [
        {
          model: Menu,
          as: 'menu',
          attributes: ['id', 'name_ko', 'name_en', 'route', 'icon']
        }
      ]
    });

    res.json({
      success: true,
      data: permissions,
      message: '사용자 권한을 성공적으로 조회했습니다.'
    });
  } catch (error) {
    console.error('사용자 권한 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용자 권한 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
};

// 메뉴 트리 구조 생성 헬퍼 함수
function buildMenuTree(menus: any[], language: string) {
  const menuMap = new Map();
  const rootMenus: any[] = [];

  // 메뉴를 맵에 저장
  menus.forEach(menu => {
    const menuItem = {
      id: menu.id,
      name: language === 'ko' ? menu.name_ko : menu.name_en,
      name_ko: menu.name_ko,
      name_en: menu.name_en,
      route: menu.route,
      icon: menu.icon,
      order: menu.order,
      level: menu.level,
      is_active: menu.is_active,
      description: menu.description,
      children: []
    };
    menuMap.set(menu.id, menuItem);
  });

  // 계층 구조 생성
  menus.forEach(menu => {
    const menuItem = menuMap.get(menu.id);
    if (menu.parent_id) {
      const parent = menuMap.get(menu.parent_id);
      if (parent) {
        parent.children.push(menuItem);
      }
    } else {
      rootMenus.push(menuItem);
    }
  });

  // 자식 메뉴 정렬: order 우선, 동일 시 id로 안정 정렬(구 DB·타이 등으로 order가 겹칠 때 대비)
  const sortMenus = (menuList: any[]) => {
    menuList.sort((a, b) => {
      const ao = Number(a.order) || 0;
      const bo = Number(b.order) || 0;
      if (ao !== bo) return ao - bo;
      return (Number(a.id) || 0) - (Number(b.id) || 0);
    });
    menuList.forEach(menu => {
      if (menu.children.length > 0) {
        sortMenus(menu.children);
      }
    });
  };

  sortMenus(rootMenus);
  return rootMenus;
}