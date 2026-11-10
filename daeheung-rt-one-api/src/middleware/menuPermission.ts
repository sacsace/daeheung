import { Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import { Menu, UserPermission } from '../models';
import { AuthRequest } from '../types';

export type MenuPermissionFlag = 'can_view' | 'can_create' | 'can_edit' | 'can_delete';

/**
 * 회사 메뉴(`menus.route`)와 `user_permissions`를 기준으로 API 단에서 권한을 강제합니다.
 * — 프론트만 막으면 우회 호출로 뚫리므로 서버 검증이 필수입니다.
 */
export const requireMenuPermission = (menuRoute: string, flag: MenuPermissionFlag) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ success: false, message: '인증이 필요합니다.' });
        return;
      }
      if (user.role === 'root') {
        next();
        return;
      }

      const menu = await Menu.findOne({
        where: { tenant_id: user.tenant_id, route: menuRoute, is_active: true },
        attributes: ['id']
      });

      if (!menu) {
        res.status(403).json({
          success: false,
          message: '메뉴 권한 설정을 찾을 수 없습니다. 관리자에게 문의하세요.'
        });
        return;
      }

      const permission = await UserPermission.findOne({
        where: { user_id: user.id, menu_id: menu.id },
        attributes: ['can_view', 'can_create', 'can_edit', 'can_delete']
      });

      const allowed = Boolean(permission && (permission as any)[flag]);
      if (!allowed) {
        res.status(403).json({
          success: false,
          message: '이 작업을 수행할 권한이 없습니다.'
        });
        return;
      }

      next();
    } catch (error) {
      console.error('메뉴 권한 검증 오류:', error);
      res.status(500).json({ success: false, message: '권한 확인 중 오류가 발생했습니다.' });
    }
  };
};

/**
 * 동일 기능에 메뉴 행이 둘 이상인 경우(예: `/work/room-reservation` vs `/hotel/room-reservation`).
 * 나열된 route 중 **하나의 메뉴**에 대해 사용자에게 해당 플래그가 true이면 통과합니다.
 */
export const requireMenuPermissionAny = (menuRoutes: string[], flag: MenuPermissionFlag) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ success: false, message: '인증이 필요합니다.' });
        return;
      }
      if (user.role === 'root') {
        next();
        return;
      }

      const uniqueRoutes = [...new Set(menuRoutes.filter(Boolean))];
      if (uniqueRoutes.length === 0) {
        res.status(403).json({
          success: false,
          message: '메뉴 권한 설정을 찾을 수 없습니다. 관리자에게 문의하세요.'
        });
        return;
      }

      const menusFound = await Menu.findAll({
        where: {
          tenant_id: user.tenant_id,
          route: { [Op.in]: uniqueRoutes },
          is_active: true
        },
        attributes: ['id']
      });

      if (!menusFound.length) {
        res.status(403).json({
          success: false,
          message: '메뉴 권한 설정을 찾을 수 없습니다. 관리자에게 문의하세요.'
        });
        return;
      }

      const menuIds = menusFound.map((m) => Number(m.id));
      const rows = await UserPermission.findAll({
        where: { user_id: user.id, menu_id: { [Op.in]: menuIds } },
        attributes: ['menu_id', 'can_view', 'can_create', 'can_edit', 'can_delete']
      });

      const allowed = rows.some((row) => Boolean((row as any)[flag]));
      if (!allowed) {
        res.status(403).json({
          success: false,
          message: '이 작업을 수행할 권한이 없습니다.'
        });
        return;
      }

      next();
    } catch (error) {
      console.error('메뉴 권한 검증 오류:', error);
      res.status(500).json({ success: false, message: '권한 확인 중 오류가 발생했습니다.' });
    }
  };
};

/** 사용자 관리 화면 라우트(프론트 `/hr/users` 등)와 DB `menus.route` 정합 */
export const USER_MANAGEMENT_MENU_ROUTES = ['/hr/users', '/users'];

/**
 * `root`만 즉시 허용.
 * 그 외 역할(`admin` 포함)은 사용자 관리 메뉴에 해당 플래그가 있어야 API 쓰기 가능.
 */
export const requireAdminRootOrUserMenuPermission = (flag: MenuPermissionFlag) => {
  const menuCheck = requireMenuPermissionAny(USER_MANAGEMENT_MENU_ROUTES, flag);
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: '인증이 필요합니다.' });
      return;
    }
    if (user.role === 'root') {
      next();
      return;
    }
    await menuCheck(req, res, next);
  };
};

/** 휴가 관리 메뉴 `route` (프론트 `/hr/leave`, `/hr/leave/request` 상위) */
export const VACATION_MENU_ROUTES = ['/hr/leave', '/my/leave'];

/**
 * `root`만 즉시 허용.
 * 그 외 역할(`admin` 포함)은 나열된 메뉴 route 중 하나에 대해 `flags` 중 **하나라도** true이면 통과.
 */
export const requireAdminRootOrMenuPermissionAnyOf = (
  menuRoutes: string[],
  flags: MenuPermissionFlag[]
) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ success: false, message: '인증이 필요합니다.' });
        return;
      }
      if (user.role === 'root') {
        next();
        return;
      }

      const uniqueRoutes = [...new Set(menuRoutes.filter(Boolean))];
      if (uniqueRoutes.length === 0 || flags.length === 0) {
        res.status(403).json({
          success: false,
          message: '메뉴 권한 설정을 찾을 수 없습니다. 관리자에게 문의하세요.'
        });
        return;
      }

      const menusFound = await Menu.findAll({
        where: {
          tenant_id: user.tenant_id,
          route: { [Op.in]: uniqueRoutes },
          is_active: true
        },
        attributes: ['id']
      });

      if (!menusFound.length) {
        res.status(403).json({
          success: false,
          message: '메뉴 권한 설정을 찾을 수 없습니다. 관리자에게 문의하세요.'
        });
        return;
      }

      const menuIds = menusFound.map((m) => Number(m.id));
      const rows = await UserPermission.findAll({
        where: { user_id: user.id, menu_id: { [Op.in]: menuIds } },
        attributes: ['menu_id', 'can_view', 'can_create', 'can_edit', 'can_delete']
      });

      const allowed = rows.some((row) =>
        flags.some((flag) => Boolean((row as any)[flag]))
      );
      if (!allowed) {
        res.status(403).json({
          success: false,
          message: '이 작업을 수행할 권한이 없습니다.'
        });
        return;
      }

      next();
    } catch (error) {
      console.error('메뉴 권한 검증 오류:', error);
      res.status(500).json({ success: false, message: '권한 확인 중 오류가 발생했습니다.' });
    }
  };
};
