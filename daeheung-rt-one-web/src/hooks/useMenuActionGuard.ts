import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageMenuPermission } from '../context/MenuPermissionContext';
import type { MenuRoutePermissionFlags } from './useMenuRoutePermissionFlags';

export type MenuPermissionAction = 'read' | 'create' | 'edit' | 'delete' | 'mutate';

function isAllowed(flags: MenuRoutePermissionFlags, action: MenuPermissionAction): boolean {
  switch (action) {
    case 'read':
      return flags.canRead;
    case 'create':
      return flags.canCreate;
    case 'edit':
      return flags.canEdit;
    case 'delete':
      return flags.canDelete;
    case 'mutate':
      return flags.canMutate;
    default:
      return false;
  }
}

function tooltipKey(action: MenuPermissionAction): string {
  switch (action) {
    case 'read':
      return 'common.menuNoView';
    case 'create':
      return 'common.menuNoCreate';
    case 'edit':
      return 'common.menuNoEdit';
    case 'delete':
      return 'common.menuNoDelete';
    case 'mutate':
      return 'common.menuNoMutate';
    default:
      return 'common.menuNoView';
  }
}

/** 버튼 disabled / 툴팁 / 핸들러 early-return — view-only 사용자용 */
export function useMenuActionGuard(
  action: MenuPermissionAction,
  menuRoutes?: readonly string[]
) {
  const { t } = useTranslation();
  const flags = usePageMenuPermission(menuRoutes);
  const allowed = isAllowed(flags, action);
  const disabled = flags.menusLoading || !allowed;

  const tooltipTitle = useMemo(() => {
    if (flags.menusLoading || allowed) return '';
    return t(tooltipKey(action));
  }, [action, allowed, flags.menusLoading, t]);

  const guard = useCallback(() => {
    if (flags.menusLoading || !allowed) return false;
    return true;
  }, [allowed, flags.menusLoading]);

  const mergeDisabled = useCallback(
    (extraDisabled?: boolean) => disabled || Boolean(extraDisabled),
    [disabled]
  );

  return {
    flags,
    allowed,
    disabled,
    tooltipTitle,
    guard,
    mergeDisabled,
  };
}
