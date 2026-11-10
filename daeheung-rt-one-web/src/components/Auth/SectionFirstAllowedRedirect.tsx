import React, { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useStore, useMenuStore } from '../../store';
import { findMenuIdByPath } from '../../utils/findMenuByPath';

type Props = {
  /** 권한 있는 첫 경로로 이동할 후보 (앞쪽 우선) */
  candidates: readonly string[];
  /** 후보가 모두 불가할 때 */
  fallback?: string;
};

/**
 * 섹션 루트(`/hr` 등)에서 권한이 없는 고정 하위 경로로 보내지 않도록,
 * 사용자에게 허용된 첫 후보 경로로 이동한다.
 */
const SectionFirstAllowedRedirect: React.FC<Props> = ({
  candidates,
  fallback = '/dashboard',
}) => {
  const user = useStore((s) => s.user);
  const { menus, hasMenuPermission, loading: menusLoading } = useMenuStore();
  const elevated = user?.role === 'root';

  const target = useMemo(() => {
    // admin/root·메뉴 로딩 중이라도 섹션 진입이 멈추지 않도록 첫 후보로 보냄
    if (elevated || menusLoading) {
      return candidates[0] || fallback;
    }
    for (const route of candidates) {
      const menuId = findMenuIdByPath(menus, route);
      if (menuId != null && hasMenuPermission(menuId, 'view')) {
        return route;
      }
    }
    return fallback;
  }, [candidates, elevated, fallback, hasMenuPermission, menus, menusLoading]);

  return <Navigate to={target} replace />;
};

export default SectionFirstAllowedRedirect;
