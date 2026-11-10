import React, { createContext, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import {
  useMenuRoutePermissionFlags,
  type MenuRoutePermissionFlags,
} from '../hooks/useMenuRoutePermissionFlags';

const MenuPermissionContext = createContext<MenuRoutePermissionFlags | null>(null);

/** 현재 URL 기준 메뉴 권한 — AppLayout에서 1회 계산 후 하위 페이지에서 재사용 */
export function MenuPermissionProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const flags = useMenuRoutePermissionFlags([location.pathname]);
  return (
    <MenuPermissionContext.Provider value={flags}>{children}</MenuPermissionContext.Provider>
  );
}

/** 현재 페이지 메뉴 권한. `menuRoutes`를 넘기면 해당 route 후보 기준으로 재계산 */
export function usePageMenuPermission(menuRoutes?: readonly string[]): MenuRoutePermissionFlags {
  const contextFlags = useContext(MenuPermissionContext);
  const location = useLocation();
  const routeFlags = useMenuRoutePermissionFlags(menuRoutes ?? [location.pathname]);
  if (menuRoutes && menuRoutes.length > 0) return routeFlags;
  return contextFlags ?? routeFlags;
}
