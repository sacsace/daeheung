import { useMemo } from 'react';
import { useStore, useMenuStore } from '../store';
import { findMenuIdByPath } from '../utils/findMenuByPath';

export type MenuRoutePermissionFlags = {
  elevated: boolean;
  menusLoading: boolean;
  /** `can_view` 또는 `can_create` — 목록 조회에 통상 사용 */
  canRead: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  /** 등록·수정 중 하나 */
  canMutate: boolean;
};

/**
 * DB `menus.route` 후보(복수) 중 하나에 대해 사용자 권한이 있으면 true.
 * `menuRoutes`는 파일 상단 `const X = ['...'] as const`처럼 안정 참조를 권장합니다.
 * (매 렌더 새 배열이면 `useMemo`가 매번 재계산됩니다.)
 */
export function useMenuRoutePermissionFlags(menuRoutes: readonly string[]): MenuRoutePermissionFlags {
  const user = useStore((s) => s.user);
  const { menus, hasMenuPermission, loading: menusLoading } = useMenuStore();
  const elevated = user?.role === 'root';

  const routeKey = menuRoutes.filter(Boolean).join('\u0001');

  return useMemo(() => {
    const routes = Array.from(new Set((routeKey ? routeKey.split('\u0001') : []).filter(Boolean)));
    const check = (action: 'view' | 'create' | 'edit' | 'delete') => {
      if (elevated) return true;
      for (const route of routes) {
        const mid = findMenuIdByPath(menus, route);
        if (mid != null && hasMenuPermission(mid, action)) return true;
      }
      return false;
    };
    return {
      elevated,
      menusLoading,
      canRead: check('view') || check('create'),
      canCreate: check('create'),
      canEdit: check('edit'),
      canDelete: check('delete'),
      canMutate: check('create') || check('edit')
    };
  }, [menus, hasMenuPermission, elevated, menusLoading, routeKey]);
}
