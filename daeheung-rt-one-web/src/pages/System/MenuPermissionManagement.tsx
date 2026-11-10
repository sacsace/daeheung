import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Checkbox,
  FormControlLabel,
  TextField,
  Chip,
  Avatar,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Alert,
  FormControl,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress
} from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Security as SecurityIcon,
  Business as BusinessIcon,
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  PersonAdd as PersonAddIcon,
  AutoAwesome as AutoAwesomeIcon,
  VisibilityOff as VisibilityOffIcon,
  EditNote as EditNoteIcon,
  AdminPanelSettings as AdminPanelSettingsIcon,
  DragIndicator as DragIndicatorIcon,
} from '@mui/icons-material';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DropAnimation,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  defaultAnimateLayoutChanges,
  useSortable,
  verticalListSortingStrategy,
  type AnimateLayoutChanges,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { useStore, useMenuStore } from '../../store';
import menuService from '../../services/menuService';
import { Menu } from '../../services/menuService';
import { api } from '../../services/api';
import { useReferenceDataStore } from '../../store/referenceDataStore';
import { showErrorPopup, showSuccessPopup } from '../../utils/errorHandler';
import { useTranslation } from 'react-i18next';
import { getUploadUrl } from '../../utils/uploadUrl';
import {
  filterMenusForMinsubCompany,
  isMinsubCompanyName,
  isMinsubOnlyMenuRoute,
} from '../../utils/canAccessSystemLoginHistory';
import { isRemovedNavMenuRoute } from '../../utils/isRemovedNavMenuRoute';

/** 핸들 | 펼침 | 메뉴명 | 권한 — 행 높이 고정이 DnD 부드러움의 핵심 */
const MENU_ROW_GRID_COLUMNS = '22px 22px minmax(12ch, 1fr) auto';
const MENU_ROW_HEIGHT = 40;

const filterOutRemovedMenus = (menus: Menu[]): Menu[] =>
  menus
    .filter((m) => !isRemovedNavMenuRoute(m.route))
    .map((m) =>
      m.children?.length
        ? { ...m, children: filterOutRemovedMenus(m.children) }
        : m
    );

const applyMenuOrderIndexes = (menus: Menu[]): Menu[] =>
  menus.map((menu, index) => ({
    ...menu,
    order: index + 1,
    children: menu.children?.length ? applyMenuOrderIndexes(menu.children) : menu.children,
  }));

const findMenuSiblingContext = (
  menus: Menu[],
  menuId: number,
  parentId: number | null = null
): { parentId: number | null; siblings: Menu[]; index: number } | null => {
  const index = menus.findIndex((m) => m.id === menuId);
  if (index >= 0) {
    return { parentId, siblings: menus, index };
  }
  for (const menu of menus) {
    if (menu.children?.length) {
      const found = findMenuSiblingContext(menu.children, menuId, menu.id);
      if (found) return found;
    }
  }
  return null;
};

const replaceMenuSiblings = (
  menus: Menu[],
  parentId: number | null,
  newSiblings: Menu[]
): Menu[] => {
  if (parentId === null) return newSiblings;
  return menus.map((menu) => {
    if (menu.id === parentId) {
      return { ...menu, children: newSiblings };
    }
    if (menu.children?.length) {
      return { ...menu, children: replaceMenuSiblings(menu.children, parentId, newSiblings) };
    }
    return menu;
  });
};

const findMenuInTree = (menus: Menu[], menuId: number): Menu | null => {
  for (const menu of menus) {
    if (menu.id === menuId) return menu;
    if (menu.children?.length) {
      const found = findMenuInTree(menu.children, menuId);
      if (found) return found;
    }
  }
  return null;
};

const MENU_DROP_ANIMATION: DropAnimation = {
  duration: 200,
  easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: '0.25' } },
  }),
};

/** 드래그 중 레이아웃 애니메이션 — 형제 행이 미끄러지듯 자리 교체 */
const menuAnimateLayoutChanges: AnimateLayoutChanges = (args) =>
  defaultAnimateLayoutChanges({ ...args, wasDragging: true });

/** 드래그 중 커서에 붙는 미리보기 — 원본 행과 동일 높이 */
const MenuDragOverlayRow: React.FC<{ label: string; level: number }> = ({ label, level }) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: MENU_ROW_GRID_COLUMNS,
      columnGap: 1.5,
      alignItems: 'center',
      width: 'min(760px, 94vw)',
      height: MENU_ROW_HEIGHT,
      px: 1.25,
      borderRadius: 0,
      border: '1px solid',
      borderColor: 'primary.main',
      bgcolor: level === 0 ? '#ffffff' : '#F3F5F8',
      boxShadow: '0 12px 32px rgba(15, 23, 42, 0.18)',
      cursor: 'grabbing',
      userSelect: 'none',
      transform: 'scale(1.02)',
      transformOrigin: 'left center',
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'primary.main' }}>
      <DragIndicatorIcon sx={{ fontSize: '1.15rem' }} />
    </Box>
    <Box />
    <Typography
      variant="body2"
      sx={{
        fontWeight: 600,
        fontSize: '0.875rem',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Typography>
    <Typography variant="caption" sx={{ justifySelf: 'end', color: 'text.disabled', pr: 0.5 }}>
      ···
    </Typography>
  </Box>
);

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  company: string;
  company_id?: number;
  status?: string;
  avatar_url?: string | null;
}

interface Company {
  id: number;
  name: string;
  domain: string;
}

interface MenuPermission {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

/** 일반 직원 기본 권한: 「내 정보·업무」+ 대시보드 + 업무보드 (서버 EMPLOYEE_SELF_SERVICE_ROUTES와 동일) */
const EMPLOYEE_DEFAULT_EXTRA_ROUTES = new Set([
  '/dashboard',
  '/work/projects',
]);

const isEmployeeDefaultMenuRoute = (route?: string | null) => {
  if (typeof route !== 'string' || !route) return false;
  if (route === '/my' || route.startsWith('/my/')) return true;
  if (route === '/dashboard' || route.startsWith('/dashboard/')) return true;
  return EMPLOYEE_DEFAULT_EXTRA_ROUTES.has(route);
};

const myWorkspacePermissionFor = (route?: string | null): MenuPermission => {
  const isLeave = route === '/my/leave';
  return {
    can_view: true,
    can_create: isLeave,
    can_edit: false,
    can_delete: false,
  };
};

// 메뉴 권한 아이템 컴포넌트
interface MenuPermissionItemProps {
  menu: Menu;
  level: number;
  index: number;
  /** 같은 부모 형제 그룹 키 — 하위 DnD 시 상위와 섞이지 않도록 */
  parentGroupId: string;
  hasChildren: boolean;
  isExpanded: boolean;
  permission: MenuPermission;
  hasAnyPermission: boolean;
  menuKey: string;
  language: string;
  expandedMenus: Set<number>;
  /** admin이 해당 메뉴/플래그를 부여할 수 있는지 */
  canGrant: {
    all: boolean;
    can_view: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
  };
  /** 목록 드래그 중이면 체크박스 등 무거운 UI를 줄여 프레임 유지 */
  listDragging: boolean;
  onToggleExpand: (menuId: number) => void;
  onPermissionChange: (menuKey: string, permissionType: keyof MenuPermission | 'all', value: boolean) => void;
  onToggleChildren: (menuId: number) => void;
  onNameChange: (menuId: number, nameKo: string, nameEn: string) => void;
  renderMenuTree: (
    menuList: Menu[],
    level: number,
    parentMenuId: number | null,
    parentIndex?: number,
    isLast?: boolean
  ) => React.ReactNode;
}

const MenuPermissionItemInner: React.FC<MenuPermissionItemProps> = ({
  menu,
  level,
  parentGroupId,
  hasChildren,
  isExpanded,
  permission,
  hasAnyPermission,
  menuKey,
  language,
  listDragging,
  canGrant,
  onToggleExpand,
  onPermissionChange,
  renderMenuTree
}) => {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: menu.id,
    data: { parentGroupId, menuId: menu.id, level },
    animateLayoutChanges: menuAnimateLayoutChanges,
  });

  const rowStyle: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    // 드래그 중인 원본은 transition 끄고, 형제만 미끄러지게
    transition: isDragging
      ? undefined
      : transition ?? 'transform 180ms cubic-bezier(0.2, 0, 0, 1)',
    position: 'relative',
    zIndex: isDragging ? 1 : 0,
    // GPU 합성 — 세로 이동만
    willChange: listDragging ? 'transform' : undefined,
  };

  const rowBg = isDragging
    ? alpha('#1976d2', 0.08)
    : level === 0
      ? '#ffffff'
      : level === 1
        ? '#F3F5F8'
        : '#ECEFF3';

  return (
    <Box
      sx={{
        mb: 0.5,
        pl: level > 0 ? `${level * 20}px` : 0,
        contain: 'layout style',
      }}
    >
      <Box
        ref={setNodeRef}
        style={rowStyle}
        sx={{
          display: 'grid',
          gridTemplateColumns: MENU_ROW_GRID_COLUMNS,
          columnGap: 1.5,
          alignItems: 'center',
          width: '100%',
          height: MENU_ROW_HEIGHT,
          minHeight: MENU_ROW_HEIGHT,
          maxHeight: MENU_ROW_HEIGHT,
          px: 1,
          boxSizing: 'border-box',
          bgcolor: rowBg,
          borderRadius: 0,
          border: '1px solid',
          borderStyle: isDragging ? 'dashed' : 'solid',
          borderColor: isDragging
            ? 'primary.main'
            : level === 0
              ? alpha('#000', 0.06)
              : alpha('#64748B', 0.18),
          borderLeft: level === 0 ? '4px solid' : '3px solid',
          borderLeftColor: isDragging
            ? 'primary.main'
            : level === 0
              ? hasAnyPermission
                ? 'primary.main'
                : alpha('#000', 0.08)
              : hasAnyPermission
                ? '#78909C'
                : alpha('#64748B', 0.35),
          // 드래그 원본: 빈 자리만 (오버레이가 실제 카드)
          opacity: isDragging ? 0.35 : 1,
          pointerEvents: isDragging ? 'none' : 'auto',
          '&:hover': isDragging || listDragging
            ? undefined
            : {
                bgcolor:
                  level === 0
                    ? hasAnyPermission
                      ? 'rgba(211, 47, 47, 0.08)'
                      : 'rgba(211, 47, 47, 0.04)'
                    : hasAnyPermission
                      ? 'rgba(211, 47, 47, 0.1)'
                      : 'rgba(211, 47, 47, 0.06)',
                borderColor: alpha('#D32F2F', 0.35),
                borderLeftColor: '#D32F2F',
              },
        }}
      >
        {isDragging ? null : (
          <>
            {/* 드래그 핸들 — 행 전체가 아닌 핸들만 잡음 */}
            <Box
              {...attributes}
              {...listeners}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                cursor: isDragging ? 'grabbing' : 'grab',
                color: 'text.disabled',
                touchAction: 'none',
                flexShrink: 0,
                '&:hover': { color: 'text.primary', bgcolor: alpha('#000', 0.04) },
              }}
              title={t('menuPermissionManagement.menuOrder')}
            >
              <DragIndicatorIcon sx={{ fontSize: '1.15rem' }} />
            </Box>

            {/* 펼침 — 상위는 메뉴명 클릭, 하위(중첩)는 화살표로 펼침 */}
            {hasChildren ? (
              <Box
                onClick={() => onToggleExpand(menu.id)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  cursor: 'pointer',
                  color: 'text.secondary',
                  transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                  transition: 'transform 0.15s ease',
                }}
              >
                <ExpandMoreIcon sx={{ fontSize: 18 }} />
              </Box>
            ) : (
              <Box />
            )}

            {/* 메뉴명 — 상위: 클릭 시 펼침 / 하위: 메뉴명으로 DnD */}
            <Typography
              variant="body2"
              {...(level > 0 ? { ...attributes, ...listeners } : {})}
              onClick={
                level === 0 && hasChildren ? () => onToggleExpand(menu.id) : undefined
              }
              sx={{
                py: 0,
                fontSize: level === 0 ? '0.875rem' : level === 1 ? '0.8125rem' : '0.75rem',
                fontWeight: level === 0 ? 600 : level === 1 ? 500 : 400,
                color: hasAnyPermission ? 'text.primary' : 'text.secondary',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.35,
                letterSpacing: '-0.01em',
                cursor:
                  level > 0
                    ? isDragging
                      ? 'grabbing'
                      : 'grab'
                    : hasChildren
                      ? 'pointer'
                      : 'default',
                userSelect: 'none',
                touchAction: level > 0 ? 'none' : undefined,
              }}
            >
              {language === 'ko' ? menu.name_ko : menu.name_en}
            </Typography>

            {/* 권한 — 드래그 중에는 가벼운 플레이스홀더로 교체 (프레임 확보) */}
            {listDragging ? (
              <Typography
                variant="caption"
                sx={{ justifySelf: 'end', color: 'text.disabled', pr: 0.5, fontSize: '0.75rem' }}
              >
                ···
              </Typography>
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'nowrap',
                  gap: 0.5,
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  minWidth: 'min-content',
                }}
              >
                <Tooltip
                  title={
                    canGrant.all
                      ? t('menuPermissionManagement.toggleAll')
                      : t('menuPermissionManagement.adminScopeBlocked')
                  }
                  arrow
                >
                  <Box
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!canGrant.all) return;
                      const allChecked =
                        permission.can_view &&
                        permission.can_create &&
                        permission.can_edit &&
                        permission.can_delete;
                      onPermissionChange(menuKey, 'all', !allChecked);
                    }}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.125,
                      p: 0.375,
                      borderRadius: 0.5,
                      border: '1px solid',
                      borderColor:
                        permission.can_view &&
                        permission.can_create &&
                        permission.can_edit &&
                        permission.can_delete
                          ? 'primary.main'
                          : 'divider',
                      backgroundColor:
                        permission.can_view &&
                        permission.can_create &&
                        permission.can_edit &&
                        permission.can_delete
                          ? 'primary.50'
                          : 'transparent',
                      cursor: canGrant.all ? 'pointer' : 'not-allowed',
                      opacity: canGrant.all ? 1 : 0.45,
                    }}
                  >
                    <Checkbox
                      checked={
                        permission.can_view &&
                        permission.can_create &&
                        permission.can_edit &&
                        permission.can_delete
                      }
                      indeterminate={
                        hasAnyPermission &&
                        !(
                          permission.can_view &&
                          permission.can_create &&
                          permission.can_edit &&
                          permission.can_delete
                        )
                      }
                      disabled={!canGrant.all}
                      size="small"
                      sx={{ p: 0, '& .MuiSvgIcon-root': { fontSize: 15.4 } }}
                      onChange={(e) => {
                        e.stopPropagation();
                        if (!canGrant.all) return;
                        onPermissionChange(menuKey, 'all', e.target.checked);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Typography
                      variant="caption"
                      sx={{ fontSize: '0.6875rem', fontWeight: 500, whiteSpace: 'nowrap' }}
                    >
                      {t('menuPermissionManagement.all')}
                    </Typography>
                  </Box>
                </Tooltip>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={permission.can_view}
                      disabled={!canGrant.can_view}
                      onChange={(e) => {
                        e.stopPropagation();
                        onPermissionChange(menuKey, 'can_view', e.target.checked);
                      }}
                      size="small"
                      sx={{ '& .MuiSvgIcon-root': { fontSize: 15.4 } }}
                    />
                  }
                  label={t('menuPermissionManagement.view')}
                  sx={{
                    m: 0,
                    opacity: canGrant.can_view ? 1 : 0.45,
                    '& .MuiFormControlLabel-label': { fontSize: '0.6875rem' },
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={permission.can_create}
                      disabled={!canGrant.can_create}
                      onChange={(e) => {
                        e.stopPropagation();
                        onPermissionChange(menuKey, 'can_create', e.target.checked);
                      }}
                      size="small"
                      sx={{ '& .MuiSvgIcon-root': { fontSize: 15.4 } }}
                    />
                  }
                  label={t('menuPermissionManagement.create')}
                  sx={{
                    m: 0,
                    opacity: canGrant.can_create ? 1 : 0.45,
                    '& .MuiFormControlLabel-label': { fontSize: '0.6875rem' },
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={permission.can_edit}
                      disabled={!canGrant.can_edit}
                      onChange={(e) => {
                        e.stopPropagation();
                        onPermissionChange(menuKey, 'can_edit', e.target.checked);
                      }}
                      size="small"
                      sx={{ '& .MuiSvgIcon-root': { fontSize: 15.4 } }}
                    />
                  }
                  label={t('menuPermissionManagement.edit')}
                  sx={{
                    m: 0,
                    opacity: canGrant.can_edit ? 1 : 0.45,
                    '& .MuiFormControlLabel-label': { fontSize: '0.6875rem' },
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={permission.can_delete}
                      disabled={!canGrant.can_delete}
                      onChange={(e) => {
                        e.stopPropagation();
                        onPermissionChange(menuKey, 'can_delete', e.target.checked);
                      }}
                      size="small"
                      sx={{ '& .MuiSvgIcon-root': { fontSize: 15.4 } }}
                    />
                  }
                  label={t('menuPermissionManagement.delete')}
                  sx={{
                    m: 0,
                    opacity: canGrant.can_delete ? 1 : 0.45,
                    '& .MuiFormControlLabel-label': { fontSize: '0.6875rem' },
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </Box>
            )}
          </>
        )}
      </Box>

      {/* 하위는 부모 행(transform) 밖에 두어 하위 DnD 시 상위가 같이 움직이지 않음 */}
      {hasChildren && isExpanded && (
        <Box sx={{ pt: 0.35, pb: 0.15 }}>
          {renderMenuTree(menu.children!, level + 1, menu.id)}
        </Box>
      )}
    </Box>
  );
};

const MenuPermissionItem = React.memo(MenuPermissionItemInner);

const MenuPermissionManagement: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { user } = useStore();
  const { menus, language, userPermissions, hasMenuPermission } = useMenuStore();
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [companySearchTerm, setCompanySearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [expandedMenus, setExpandedMenus] = useState<Set<number>>(new Set());
  const [permissions, setPermissions] = useState<{ [key: string]: MenuPermission }>({});
  const [adminPermissions, setAdminPermissions] = useState<{ [key: string]: MenuPermission }>({});
  /** 권한 편집용 전체 메뉴(네비용 user menus와 분리 — 스토어로 덮어쓰지 않음) */
  const [menuList, setMenuList] = useState<Menu[]>([]);
  const { setMenus } = useMenuStore();
  const [delegationTargetId, setDelegationTargetId] = useState<number | null>(null);
  const [delegationDialogOpen, setDelegationDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [defaultPermissionDialogOpen, setDefaultPermissionDialogOpen] = useState(false);
  /** 레이아웃 추정용 기본 사이드바 너비 (실제 너비는 DB 사용자 UI 설정) */
  const getSidebarWidth = () => 0;

  // 4:6 비율을 위한 기본 너비 계산 (전체 너비의 40%)
  const getDefaultLeftPanelWidth = () => {
    if (typeof window !== 'undefined') {
      const sidebarWidth = getSidebarWidth();
      // 사이드바 너비 + 패딩(48px)을 제외한 실제 컨텐츠 너비
      const availableWidth = Math.min(2400, window.innerWidth - sidebarWidth - 48);
      return Math.max(300, Math.min(1000, availableWidth * 0.4)); // 최소 300px, 최대 1000px, 기본 40%
    }
    return 480; // 서버 사이드 렌더링 시 기본값 (2400px * 0.4 = 960px, 하지만 안전하게 480px)
  };
  
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(getDefaultLeftPanelWidth());
  const [isResizing, setIsResizing] = useState(false);

  // 사용자/회사 영역 비율 (위 6: 아래 4)
  const getDefaultUserSectionHeight = () => {
    if (typeof window !== 'undefined') {
      const cardHeight = window.innerHeight - 300; // 대략적인 카드 높이
      return cardHeight * 0.6; // 60%
    }
    return 400;
  };
  
  const [userSectionHeight, setUserSectionHeight] = useState<number>(getDefaultUserSectionHeight());
  const [isVerticalResizing, setIsVerticalResizing] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // 권한 확인 (root 또는 메뉴 권한이 있는 admin)
  const isRoot = user?.role === 'root';
  const isAdmin = user?.role === 'admin';
  const menuPermissionMenuId = useMemo(() => {
    const targetRoute = '/basic-info/menu-permissions';

    const findMenuIdByRoute = (menuItems: Menu[]): number | null => {
      for (const menu of menuItems) {
        const route = String(menu.route || '');
        if (route === targetRoute || route.startsWith(`${targetRoute}/`)) {
          return menu.id;
        }
        if (menu.children && menu.children.length > 0) {
          const childId = findMenuIdByRoute(menu.children);
          if (childId) return childId;
        }
      }
      return null;
    };

    const idFromMenus = findMenuIdByRoute(menus || []);
    if (idFromMenus) return idFromMenus;

    const permissionWithRoute = userPermissions.find(
      (perm) =>
        perm?.menu?.route === targetRoute ||
        String(perm?.menu?.route || '').startsWith(`${targetRoute}/`)
    );
    return permissionWithRoute?.menu_id || null;
  }, [menus, userPermissions]);

  const hasMenuPermissionControlAuth = useMemo(() => {
    if (!menuPermissionMenuId) return false;
    return (
      hasMenuPermission(menuPermissionMenuId, 'view') ||
      hasMenuPermission(menuPermissionMenuId, 'create') ||
      hasMenuPermission(menuPermissionMenuId, 'edit') ||
      hasMenuPermission(menuPermissionMenuId, 'delete')
    );
  }, [menuPermissionMenuId, hasMenuPermission]);

  const canManagePermissionPage = isRoot || (isAdmin && hasMenuPermissionControlAuth);

  // 리사이즈 핸들러 (좌우)
  const resizeRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  // 리사이즈 핸들러 (상하)
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = leftPanelWidth;
  }, [leftPanelWidth]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    const diff = e.clientX - startXRef.current;
    // 4:6 비율 유지를 위해 최소 300px, 최대는 화면 너비의 60%까지 허용
    const sidebarWidth = getSidebarWidth();
    const maxWidth = typeof window !== 'undefined' ? Math.min(1000, (window.innerWidth - sidebarWidth - 48) * 0.6) : 800;
    const newWidth = Math.max(300, Math.min(maxWidth, startWidthRef.current + diff));
    setLeftPanelWidth(newWidth);
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  // 수직 리사이즈 핸들러
  const handleVerticalMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsVerticalResizing(true);
    startYRef.current = e.clientY;
    startHeightRef.current = userSectionHeight;
  }, [userSectionHeight]);

  const handleVerticalMouseMove = useCallback((e: MouseEvent) => {
    if (!isVerticalResizing) return;
    
    const diff = e.clientY - startYRef.current;
    const minHeight = 150; // 최소 높이
    const maxHeight = typeof window !== 'undefined' ? (window.innerHeight - 400) : 600; // 최대 높이
    const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeightRef.current + diff));
    setUserSectionHeight(newHeight);
  }, [isVerticalResizing]);

  const handleVerticalMouseUp = useCallback(() => {
    setIsVerticalResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    if (isVerticalResizing) {
      document.addEventListener('mousemove', handleVerticalMouseMove);
      document.addEventListener('mouseup', handleVerticalMouseUp);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleVerticalMouseMove);
      document.removeEventListener('mouseup', handleVerticalMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleVerticalMouseMove);
      document.removeEventListener('mouseup', handleVerticalMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isVerticalResizing, handleVerticalMouseMove, handleVerticalMouseUp]);

  // 화면 크기 변경 시 4:6 비율 유지 (선택적)
  useEffect(() => {
    const handleResize = () => {
      // 사용자가 수동으로 조정한 경우는 유지
      // 초기 로드 시에만 비율 적용
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 사용자 및 회사 목록 로드
  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        setDataLoading(false);
        return;
      }

      // 접근 권한이 없으면 데이터 로드 중단
      if (!canManagePermissionPage) {
        setDataLoading(false);
        return;
      }
      
      try {
        setDataLoading(true);
        const currentUserCompanyId = user.company_id;
        
        // 사용자 목록 로드
        const usersArray = await useReferenceDataStore.getState().fetchUsers();
        
        let usersData: User[] = [];
        if (usersArray.length >= 0) {
          usersData = usersArray
            .filter((u: any) => u.status === 'active') // 비활성 사용자 제외
            .filter((u: any) => {
              // root를 제외한 사용자는 본인 회사 사용자만 표시
              if (isRoot) return true;
              return Number(u.company_id) === Number(currentUserCompanyId);
            })
            .map((u: any) => ({
              id: u.id,
              name: u.username,
              email: u.email,
              role: u.role,
              company: '',
              company_id: u.company_id,
              status: u.status,
              avatar_url: u.avatar_url || null,
            }));
        }
        
        // 회사 목록 로드
        try {
          const companiesData = await useReferenceDataStore.getState().fetchCompanies();

          if (companiesData.length >= 0) {
            const scopedCompanies = isRoot
              ? companiesData
              : companiesData.filter((c: any) => Number(c.id) === Number(currentUserCompanyId));

            const formattedCompanies = scopedCompanies.map((c: any) => ({
              id: c.id,
              name: c.name,
              domain: c.website || c.email || ''
            }));
            setCompanies(formattedCompanies);
            
            // 사용자 데이터에 회사명 추가
            usersData = usersData.map(u => {
              const company = scopedCompanies.find((c: any) => c.id === u.company_id);
              return {
                ...u,
                company: company ? company.name : ''
              };
            });
          }
        } catch (companyError: any) {
        }
        
        setUsers(usersData);
      } catch {
        setUsers([]);
        setCompanies([]);
      } finally {
        setDataLoading(false);
      }
    };
    
    loadData();
  }, [user, canManagePermissionPage]);

  // Admin 권한 로드 (admin이 user에게 권한을 줄 때 자신의 권한 범위 내에서만 가능하도록)
  useEffect(() => {
    const loadAdminPermissions = async () => {
      if (!user || !canManagePermissionPage || user.role !== 'admin') return;
      
      try {
        const response = await api.get(`/menus/permissions/user/${user.id}`);
        if (response.data.success && response.data.data) {
          const permissionsMap: { [key: string]: MenuPermission } = {};
          response.data.data.forEach((perm: any) => {
            permissionsMap[String(perm.menu_id)] = {
              can_view: perm.can_view || false,
              can_create: perm.can_create || false,
              can_edit: perm.can_edit || false,
              can_delete: perm.can_delete || false
            };
          });
          setAdminPermissions(permissionsMap);
        } else {
          setAdminPermissions({});
        }
      } catch (error) {
        setAdminPermissions({});
      }
    };
    
    loadAdminPermissions();
  }, [user, canManagePermissionPage]);

  /** 권한 매트릭스용: 테넌트 전체 메뉴 (getUserMenus/스토어와 무관) */
  const reloadAllMenus = useCallback(
    async (resetExpanded = false) => {
      if (!user || !canManagePermissionPage) return;
      try {
        const response = await menuService.getAllMenus(user.tenant_id, language);
        if (response.success && response.data) {
          if (resetExpanded) setExpandedMenus(new Set<number>());
          setMenuList(response.data);
        }
      } catch {
        /* ignore */
      }
    },
    [user, language, canManagePermissionPage]
  );

  useEffect(() => {
    void reloadAllMenus(true);
  }, [reloadAllMenus]);

  // 메뉴명 변경
  const handleNameChange = async (menuId: number, nameKo: string, nameEn: string) => {
    const updateMenuName = (menus: Menu[]): Menu[] => {
      return menus.map(menu => {
        if (menu.id === menuId) {
          return { ...menu, name_ko: nameKo, name_en: nameEn };
        }
        if (menu.children && menu.children.length > 0) {
          return { ...menu, children: updateMenuName(menu.children) };
        }
        return menu;
      });
    };

    const newMenuList = updateMenuName(menuList);
    setMenuList(newMenuList);

    // 서버에 메뉴명 저장
    try {
      await api.put(`/menus/${menuId}`, { name_ko: nameKo, name_en: nameEn });
      
      // 사이드바 메뉴 즉시 업데이트
      setMenus(newMenuList);
    } catch {
      // 실패 시 서버 상태로 복구
      void reloadAllMenus();
    }
  };

  // 메뉴 순서 저장 및 사이드바 업데이트 (드래그앤드롭)
  const saveMenuOrder = async (newMenuList: Menu[]) => {
    const orderedList = applyMenuOrderIndexes(newMenuList);
    setMenuList(orderedList);

    // 모든 메뉴의 순서를 수집 (계층 구조를 평면화)
    const collectMenuOrders = (menus: Menu[], orders: Array<{ id: number; order: number }> = []): Array<{ id: number; order: number }> => {
      menus.forEach((menu, index) => {
        orders.push({ id: menu.id, order: index + 1 });
        if (menu.children && menu.children.length > 0) {
          collectMenuOrders(menu.children, orders);
        }
      });
      return orders;
    };

    const menuOrders = collectMenuOrders(orderedList);

    // 서버에 순서 저장
    try {
      await api.put('/menus/order', { menus: menuOrders });
      
      // 사이드바 메뉴 즉시 업데이트
      setMenus(orderedList);
    } catch {
      // 실패 시 서버 상태로 복구
      void reloadAllMenus();
    }
  };

  const [activeDragMenuId, setActiveDragMenuId] = useState<number | null>(null);
  const menuListRef = useRef(menuList);
  const menuListBeforeDragRef = useRef<Menu[] | null>(null);
  const lastDragOverIdRef = useRef<string | number | null>(null);
  menuListRef.current = menuList;
  const listDragging = activeDragMenuId != null;

  const menuOrderSensors = useSensors(
    useSensor(PointerSensor, {
      // 클릭과 구분하되 반응은 빠르게
      activationConstraint: { distance: 4 },
    })
  );

  /** 같은 부모 형제끼리만 충돌 — 하위 드래그 시 상위가 끌려가지 않음 */
  const menuCollisionDetection = useCallback<CollisionDetection>((args) => {
    const activeGroup = args.active.data.current?.parentGroupId as string | undefined;
    const sameGroup = args.droppableContainers.filter((container) => {
      const group = container.data.current?.parentGroupId as string | undefined;
      return activeGroup != null && group === activeGroup;
    });
    return closestCenter({
      ...args,
      droppableContainers: sameGroup.length > 0 ? sameGroup : args.droppableContainers,
    });
  }, []);

  const activeDragMenu = useMemo(() => {
    if (activeDragMenuId == null) return null;
    return findMenuInTree(menuList, activeDragMenuId);
  }, [activeDragMenuId, menuList]);

  const activeDragLevel = useMemo(() => {
    if (activeDragMenuId == null) return 0;
    const ctx = findMenuSiblingContext(menuList, activeDragMenuId);
    return ctx?.parentId == null ? 0 : 1;
  }, [activeDragMenuId, menuList]);

  const handleMenuDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = Number(event.active.id);
      if (!Number.isFinite(id)) return;
      setActiveDragMenuId(id);
      menuListBeforeDragRef.current = menuListRef.current;
      lastDragOverIdRef.current = null;
      // 상위 드래그 시 펼쳐진 자기 하위만 접어 높이 튀김 방지 (다른 메뉴 펼침은 유지)
      const level = event.active.data.current?.level as number | undefined;
      if (level === 0 && expandedMenus.has(id)) {
        const next = new Set(expandedMenus);
        next.delete(id);
        setExpandedMenus(next);
      }
      document.body.style.cursor = 'grabbing';
    },
    [expandedMenus]
  );

  const handleMenuDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (lastDragOverIdRef.current === over.id) return;

    const activeGroup = active.data.current?.parentGroupId;
    const overGroup = over.data.current?.parentGroupId;
    if (activeGroup == null || activeGroup !== overGroup) return;

    const activeId = Number(active.id);
    const overId = Number(over.id);
    if (!Number.isFinite(activeId) || !Number.isFinite(overId)) return;

    lastDragOverIdRef.current = over.id;

    setMenuList((prev) => {
      const activeCtx = findMenuSiblingContext(prev, activeId);
      const overCtx = findMenuSiblingContext(prev, overId);
      if (!activeCtx || !overCtx || activeCtx.parentId !== overCtx.parentId) return prev;
      if (activeCtx.index === overCtx.index) return prev;
      const reordered = arrayMove(activeCtx.siblings, activeCtx.index, overCtx.index);
      return applyMenuOrderIndexes(replaceMenuSiblings(prev, activeCtx.parentId, reordered));
    });
  }, []);

  const handleMenuDragCancel = useCallback(() => {
    if (menuListBeforeDragRef.current) {
      setMenuList(menuListBeforeDragRef.current);
      menuListBeforeDragRef.current = null;
    }
    lastDragOverIdRef.current = null;
    setActiveDragMenuId(null);
    document.body.style.cursor = '';
  }, []);

  const handleMenuDragEnd = useCallback(
    async (_event: DragEndEvent) => {
      document.body.style.cursor = '';
      setActiveDragMenuId(null);
      lastDragOverIdRef.current = null;

      const snapshot = menuListBeforeDragRef.current;
      menuListBeforeDragRef.current = null;
      const current = menuListRef.current;
      if (!snapshot || JSON.stringify(snapshot) === JSON.stringify(current)) {
        return;
      }
      // 드래그 중 이미 순서가 반영됨 — 저장만 (UI 블로킹 최소화)
      void saveMenuOrder(current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // 사용자/회사 선택 시 권한 로드
  useEffect(() => {
    const loadPermissions = async () => {
      if (!canManagePermissionPage) return;
      
      if (selectedUserId) {
        try {
          setLoading(true);
          const response = await api.get(`/menus/permissions/user/${selectedUserId}`);
          if (response.data.success && response.data.data) {
            const permissionsMap: { [key: string]: MenuPermission } = {};
            response.data.data.forEach((perm: any) => {
              permissionsMap[String(perm.menu_id)] = {
                can_view: perm.can_view || false,
                can_create: perm.can_create || false,
                can_edit: perm.can_edit || false,
                can_delete: perm.can_delete || false
              };
            });
            setPermissions(permissionsMap);
          } else {
            setPermissions({});
          }
        } catch (error) {
          setPermissions({});
        } finally {
          setLoading(false);
        }
      } else if (selectedCompanyId) {
        setPermissions({});
      } else {
        setPermissions({});
      }
    };
    
    loadPermissions();
  }, [selectedUserId, selectedCompanyId, canManagePermissionPage]);

  /** 선택 대상 회사명 — Minsub 전용 메뉴 표시 여부 판단 */
  const permissionTargetCompanyName = useMemo(() => {
    if (selectedUserId) {
      return users.find((u) => u.id === selectedUserId)?.company ?? '';
    }
    if (selectedCompanyId) {
      return companies.find((c) => c.id === selectedCompanyId)?.name ?? '';
    }
    return null as string | null;
  }, [selectedUserId, selectedCompanyId, users, companies]);

  const visibleMenuList = useMemo(() => {
    const base =
      permissionTargetCompanyName == null
        ? menuList
        : filterMenusForMinsubCompany(menuList, permissionTargetCompanyName);
    return filterOutRemovedMenus(base);
  }, [menuList, permissionTargetCompanyName]);

  // 메뉴 트리 렌더링
  const renderMenuTree = (
    menus: Menu[],
    level: number = 0,
    parentMenuId: number | null = null,
    _parentIndex: number = 0,
    _isLast: boolean = false
  ) => {
    const sortedMenuList = [...menus].sort((a, b) => (a.order || 0) - (b.order || 0));
    const sortableIds = sortedMenuList.map((menu) => menu.id);
    const parentGroupId = parentMenuId == null ? 'root' : `parent-${parentMenuId}`;

    return (
      <SortableContext
        id={parentGroupId}
        items={sortableIds}
        strategy={verticalListSortingStrategy}
      >
        {sortedMenuList.map((menu, index) => {
          const hasChildren = !!(menu.children && menu.children.length > 0);
          const isExpanded = expandedMenus.has(menu.id);
          const menuKey = String(menu.id);
          const permission = permissions[menuKey] || {
            can_view: false,
            can_create: false,
            can_edit: false,
            can_delete: false
          };

          const hasAnyPermission = permission.can_view || permission.can_create || permission.can_edit || permission.can_delete;
          const canGrant = getCanGrantFlags(menuKey);

          return (
            <MenuPermissionItem
              key={menu.id}
              menu={menu}
              level={level}
              index={index}
              parentGroupId={parentGroupId}
              hasChildren={hasChildren}
              isExpanded={isExpanded}
              permission={permission}
              hasAnyPermission={hasAnyPermission}
              menuKey={menuKey}
              language={language}
              expandedMenus={expandedMenus}
              listDragging={listDragging}
              canGrant={canGrant}
              onToggleExpand={(menuId) => {
                const newExpanded = new Set(expandedMenus);
                if (expandedMenus.has(menuId)) {
                  newExpanded.delete(menuId);
                } else {
                  newExpanded.add(menuId);
                }
                setExpandedMenus(newExpanded);
              }}
              onPermissionChange={handlePermissionChange}
              onToggleChildren={(menuId) => {
                const newExpanded = new Set(expandedMenus);
                if (expandedMenus.has(menuId)) {
                  newExpanded.delete(menuId);
                } else {
                  newExpanded.add(menuId);
                }
                setExpandedMenus(newExpanded);
              }}
              onNameChange={handleNameChange}
              renderMenuTree={renderMenuTree}
            />
          );
        })}
      </SortableContext>
    );
  };

  // 메뉴 트리에서 특정 메뉴의 모든 자식 메뉴 ID를 재귀적으로 수집
  const getAllChildMenuIds = (menuList: Menu[], parentId: number): number[] => {
    const childIds: number[] = [];
    
    const collectChildIds = (menus: Menu[]): void => {
      menus.forEach(menu => {
        if (menu.id === parentId && menu.children) {
          // 부모 메뉴를 찾았으면 모든 자식을 재귀적으로 수집
          const collectAllDescendants = (children: Menu[]): void => {
            children.forEach(child => {
              childIds.push(child.id);
              if (child.children && child.children.length > 0) {
                collectAllDescendants(child.children);
              }
            });
          };
          collectAllDescendants(menu.children);
        } else if (menu.children) {
          // 자식이 있으면 재귀적으로 탐색
          collectChildIds(menu.children);
        }
      });
    };
    
    collectChildIds(menuList);
    return childIds;
  };

  // Admin의 권한 범위 내에서만 권한을 설정할 수 있는지 체크
  const canSetPermission = (menuKey: string, permissionType: keyof MenuPermission | 'all', _value: boolean): boolean => {
    if (user?.role === 'root') return true;

    if (user?.role === 'admin') {
      const adminPerm = adminPermissions[menuKey];
      if (!adminPerm) {
        return false;
      }

      if (permissionType === 'all') {
        return adminPerm.can_view && adminPerm.can_create && adminPerm.can_edit && adminPerm.can_delete;
      }
      return adminPerm[permissionType] === true;
    }

    return true;
  };

  const getCanGrantFlags = (menuKey: string) => {
    if (user?.role !== 'admin') {
      return {
        all: true,
        can_view: true,
        can_create: true,
        can_edit: true,
        can_delete: true
      };
    }
    const adminPerm = adminPermissions[menuKey];
    return {
      all: Boolean(
        adminPerm?.can_view && adminPerm?.can_create && adminPerm?.can_edit && adminPerm?.can_delete
      ),
      can_view: Boolean(adminPerm?.can_view),
      can_create: Boolean(adminPerm?.can_create),
      can_edit: Boolean(adminPerm?.can_edit),
      can_delete: Boolean(adminPerm?.can_delete)
    };
  };

  /** admin은 root가 부여한 메뉴만 전송 (범위 밖 메뉴는 서버에서 유지) */
  const buildPermissionPayload = (targetUserId: number) => {
    const allowMinsubOnly = isMinsubCompanyName(
      users.find((u) => u.id === targetUserId)?.company || permissionTargetCompanyName
    );
    const findMenuRoute = (menus: Menu[], id: number): string | null => {
      for (const m of menus) {
        if (Number(m.id) === id) return m.route || null;
        if (m.children?.length) {
          const nested = findMenuRoute(m.children, id);
          if (nested) return nested;
        }
      }
      return null;
    };
    return Object.keys(permissions)
      .filter((menuId) => {
        if (user?.role !== 'admin') return true;
        return Boolean(adminPermissions[menuId]);
      })
      .filter((menuId) => {
        if (allowMinsubOnly) return true;
        const route = findMenuRoute(menuList, parseInt(menuId, 10));
        return !isMinsubOnlyMenuRoute(route);
      })
      .map((menuId) => {
        const current = permissions[menuId] || {
          can_view: false,
          can_create: false,
          can_edit: false,
          can_delete: false
        };
        if (user?.role === 'admin') {
          const adminPerm = adminPermissions[menuId];
          return {
            user_id: targetUserId,
            menu_id: parseInt(menuId, 10),
            can_view: Boolean(current.can_view && adminPerm?.can_view),
            can_create: Boolean(current.can_create && adminPerm?.can_create),
            can_edit: Boolean(current.can_edit && adminPerm?.can_edit),
            can_delete: Boolean(current.can_delete && adminPerm?.can_delete)
          };
        }
        return {
          user_id: targetUserId,
          menu_id: parseInt(menuId, 10),
          ...current
        };
      });
  };

  const handlePermissionChange = (menuKey: string, permissionType: keyof MenuPermission | 'all', value: boolean) => {
    if (!canSetPermission(menuKey, permissionType, value)) {
      showErrorPopup(t('menuPermissionManagement.adminScopeBlocked'), t('menuPermissionManagement.scopeTitle'));
      return;
    }
    
    const menuId = parseInt(menuKey);
    
    // 현재 메뉴의 모든 자식 메뉴 ID 찾기
    const childMenuIds = getAllChildMenuIds(menuList, menuId);
    
    setPermissions(prev => {
      const current = prev[menuKey] || {
        can_view: false,
        can_create: false,
        can_edit: false,
        can_delete: false
      };

      const newPermissions: { [key: string]: MenuPermission } = { ...prev };

      // 부모 메뉴 권한 업데이트
      if (permissionType === 'all') {
        newPermissions[menuKey] = {
          can_view: value,
          can_create: value,
          can_edit: value,
          can_delete: value
        };
      } else {
        newPermissions[menuKey] = {
          ...current,
          [permissionType]: value
        };
      }

      // 모든 자식 메뉴의 권한도 동일하게 업데이트 (admin 권한 범위 내에서만)
      childMenuIds.forEach(childId => {
        const childKey = String(childId);
        const childCurrent = prev[childKey] || {
          can_view: false,
          can_create: false,
          can_edit: false,
          can_delete: false
        };

        // 자식 메뉴도 admin 권한 범위 체크
        if (!canSetPermission(childKey, permissionType, value)) {
          return; // 권한이 없으면 스킵
        }

        if (permissionType === 'all') {
          newPermissions[childKey] = {
            can_view: value,
            can_create: value,
            can_edit: value,
            can_delete: value
          };
        } else {
          newPermissions[childKey] = {
            ...childCurrent,
            [permissionType]: value
          };
        }
      });

      return newPermissions;
    });
  };

  const handleSave = async () => {
    if (!selectedUserId && !selectedCompanyId) return;

    try {
      setSaving(true);
      if (selectedUserId) {
        const permissionData = buildPermissionPayload(selectedUserId);
        await menuService.setUserPermissions(selectedUserId, permissionData);
        showSuccessPopup(t('menuPermissionManagement.permissionsSaved'));
      } else if (selectedCompanyId) {
        const companyUsers = users.filter(u => u.company_id === selectedCompanyId);
        
        for (const companyUser of companyUsers) {
          const permissionData = buildPermissionPayload(companyUser.id);
          await menuService.setUserPermissions(companyUser.id, permissionData);
        }
        showSuccessPopup(
          t('menuPermissionManagement.companyPermissionsSaved', { count: companyUsers.length })
        );
      }
    } catch (error: any) {
      showErrorPopup(error, t('menuPermissionManagement.permissionsSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelegation = async () => {
    if (!selectedUserId || !delegationTargetId) return;

    try {
      setSaving(true);
      const permissionData = buildPermissionPayload(delegationTargetId);
      await menuService.setUserPermissions(delegationTargetId, permissionData);
      showSuccessPopup(t('menuPermissionManagement.delegated'));
      setDelegationDialogOpen(false);
      setDelegationTargetId(null);
    } catch (error: any) {
      showErrorPopup(error, t('menuPermissionManagement.delegationFailed'));
    } finally {
      setSaving(false);
    }
  };

  // 기본 권한 템플릿 적용
  const applyDefaultPermissions = async (
    template: 'my_workspace' | 'view_only' | 'read_write' | 'full'
  ) => {
    if (!menuList || menuList.length === 0) return;
    if (!selectedUserId && !selectedCompanyId) return;

    const newPermissions: { [key: string]: MenuPermission } = {};
    const onlyMyWorkspace = template === 'my_workspace';
    
    // 메뉴에 기본 권한 적용 (admin 권한 범위 내에서만). my_workspace는 「내 정보·업무」만.
    const applyToMenu = (menuList: Menu[]) => {
      menuList.forEach(menu => {
        const menuKey = String(menu.id);
        const adminPerm = user?.role === 'admin' ? adminPermissions[menuKey] : null;

        if (onlyMyWorkspace && !isEmployeeDefaultMenuRoute(menu.route)) {
          if (menu.children && menu.children.length > 0) {
            applyToMenu(menu.children);
          }
          return;
        }
        
        let permission: MenuPermission;
        switch (template) {
          case 'my_workspace':
            permission = myWorkspacePermissionFor(menu.route);
            break;
          case 'view_only':
            permission = {
              can_view: true,
              can_create: false,
              can_edit: false,
              can_delete: false
            };
            break;
          case 'read_write':
            permission = {
              can_view: true,
              can_create: true,
              can_edit: true,
              can_delete: false
            };
            break;
          case 'full':
            permission = {
              can_view: true,
              can_create: true,
              can_edit: true,
              can_delete: true
            };
            break;
        }
        
        // Admin인 경우 자신의 권한 범위 내에서만 적용
        if (user?.role === 'admin' && adminPerm) {
          permission = {
            can_view: permission.can_view && adminPerm.can_view,
            can_create: permission.can_create && adminPerm.can_create,
            can_edit: permission.can_edit && adminPerm.can_edit,
            can_delete: permission.can_delete && adminPerm.can_delete
          };
        } else if (user?.role === 'admin' && !adminPerm) {
          // Admin이 해당 메뉴에 대한 권한이 없으면 스킵
          return;
        }
        
        newPermissions[menuKey] = permission;
        
        // 하위 메뉴에도 동일하게 적용
        if (menu.children && menu.children.length > 0) {
          applyToMenu(menu.children);
        }
      });
    };
    
    applyToMenu(menuList);
    setPermissions(newPermissions);
    
    // 서버에 저장
    try {
      setSaving(true);
      if (selectedUserId) {
        const permissionData = Object.keys(newPermissions).map(menuId => ({
          user_id: selectedUserId,
          menu_id: parseInt(menuId),
          ...newPermissions[menuId]
        }));
        await menuService.setUserPermissions(selectedUserId, permissionData);
        showSuccessPopup(t('menuPermissionManagement.defaultPermissionsApplied'));
      } else if (selectedCompanyId) {
        const companyUsers = users.filter(u => u.company_id === selectedCompanyId);
        for (const companyUser of companyUsers) {
          const permissionData = Object.keys(newPermissions).map(menuId => ({
            user_id: companyUser.id,
            menu_id: parseInt(menuId),
            ...newPermissions[menuId]
          }));
          await menuService.setUserPermissions(companyUser.id, permissionData);
        }
        showSuccessPopup(
          t('menuPermissionManagement.defaultPermissionsAppliedToCompany', {
            count: companyUsers.length,
          })
        );
      }
    } catch (error: any) {
      showErrorPopup(error, t('menuPermissionManagement.defaultPermissionsApplyFailed'));
    } finally {
      setSaving(false);
    }
    
    setDefaultPermissionDialogOpen(false);
  };

  // 역할별 기본 권한 적용
  const applyRoleBasedPermissions = async () => {
    if (!selectedUserId || !menuList || menuList.length === 0) return;
    
    const selectedUser = users.find(u => u.id === selectedUserId);
    if (!selectedUser) return;

    const newPermissions: { [key: string]: MenuPermission } = {};
    
    // 역할별 기본 권한 정의 (user는 「내 정보·업무」만 — 아래 applyToMenu에서 필터)
    const roleKey = selectedUser.role.toLowerCase();
    const onlyMyWorkspace = roleKey === 'user';
    const rolePermissions: { [key: string]: { view: boolean; create: boolean; edit: boolean; delete: boolean } } = {
      'admin': { view: true, create: true, edit: true, delete: true },
      'manager': { view: true, create: true, edit: true, delete: false },
      'user': { view: true, create: false, edit: false, delete: false },
      'audit': { view: true, create: false, edit: false, delete: false }
    };
    
    const defaultPerm = rolePermissions[roleKey] || rolePermissions['user'];
    
    // 역할별 권한 적용 (admin 권한 범위 내에서만). user는 「내 정보·업무」만.
    const applyToMenu = (menuList: Menu[]) => {
      menuList.forEach(menu => {
        const menuKey = String(menu.id);
        const adminPerm = user?.role === 'admin' ? adminPermissions[menuKey] : null;

        if (onlyMyWorkspace && !isEmployeeDefaultMenuRoute(menu.route)) {
          if (menu.children && menu.children.length > 0) {
            applyToMenu(menu.children);
          }
          return;
        }
        
        let permission: MenuPermission = onlyMyWorkspace
          ? myWorkspacePermissionFor(menu.route)
          : {
              can_view: defaultPerm.view,
              can_create: defaultPerm.create,
              can_edit: defaultPerm.edit,
              can_delete: defaultPerm.delete
            };
        
        // Admin인 경우 자신의 권한 범위 내에서만 적용
        if (user?.role === 'admin' && adminPerm) {
          permission = {
            can_view: permission.can_view && adminPerm.can_view,
            can_create: permission.can_create && adminPerm.can_create,
            can_edit: permission.can_edit && adminPerm.can_edit,
            can_delete: permission.can_delete && adminPerm.can_delete
          };
        } else if (user?.role === 'admin' && !adminPerm) {
          // Admin이 해당 메뉴에 대한 권한이 없으면 스킵
          return;
        }
        
        newPermissions[menuKey] = permission;
        
        // 하위 메뉴에도 동일하게 적용
        if (menu.children && menu.children.length > 0) {
          applyToMenu(menu.children);
        }
      });
    };
    
    applyToMenu(menuList);
    setPermissions(newPermissions);
    
    // 서버에 저장
    try {
      setSaving(true);
      const permissionData = Object.keys(newPermissions).map(menuId => ({
        user_id: selectedUserId,
        menu_id: parseInt(menuId),
        ...newPermissions[menuId]
      }));
      await menuService.setUserPermissions(selectedUserId, permissionData);
      showSuccessPopup(
        t('menuPermissionManagement.rolePermissionsApplied', { role: selectedUser.role })
      );
    } catch (error: any) {
      showErrorPopup(error, t('menuPermissionManagement.rolePermissionsApplyFailed'));
    } finally {
      setSaving(false);
    }
    
    setDefaultPermissionDialogOpen(false);
  };

  const filteredUsers = users.filter(u => {
    const matchesUserSearch = !userSearchTerm || 
      u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      u.role.toLowerCase().includes(userSearchTerm.toLowerCase());
    const matchesCompanySearch = !companySearchTerm ||
      u.company.toLowerCase().includes(companySearchTerm.toLowerCase());
    // 회사가 선택된 경우 해당 회사의 사용자만 표시
    const matchesSelectedCompany = !selectedCompanyId || u.company_id === selectedCompanyId;
    return matchesUserSearch && matchesCompanySearch && matchesSelectedCompany;
  });

  const filteredCompanies = companies.filter(c => {
    const matchesCompanySearch = !companySearchTerm ||
      c.name.toLowerCase().includes(companySearchTerm.toLowerCase()) ||
      c.domain.toLowerCase().includes(companySearchTerm.toLowerCase());
    return matchesCompanySearch;
  });

  const cardShellSx = {
    borderRadius: '8px',
    border: '1px solid',
    borderColor: theme.palette.mode === 'light' ? '#CBD5E1' : alpha(theme.palette.divider, 0.35),
    boxShadow:
      theme.palette.mode === 'light' ? '0 2px 10px rgba(15, 23, 42, 0.08)' : '0 4px 24px rgba(15, 23, 42, 0.06)',
    bgcolor: 'background.paper',
    overflow: 'hidden' as const };

  const selectionInputSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '8px',
      bgcolor: 'background.paper',
      '& fieldset': {
        borderColor: theme.palette.mode === 'light' ? '#CBD5E1' : undefined },
      '&:hover fieldset': {
        borderColor: theme.palette.mode === 'light' ? '#94A3B8' : undefined } } };

  const listSectionTitleSx = {
    fontSize: '13px',
    fontWeight: 600,
    letterSpacing: '-0.01em',
    color: 'text.primary',
    mb: 1.25 };

  const listItemSelectedSx = {
    '&.Mui-selected': {
      bgcolor: alpha(theme.palette.primary.main, 0.1),
      color: 'text.primary',
      '&:hover': {
        bgcolor: alpha(theme.palette.primary.main, 0.16) } } };

  // 권한이 없으면 접근 불가 메시지 표시
  if (!canManagePermissionPage) {
    return (
      <Box sx={{ p: 0, width: '100%' }}>
        <Alert severity="error" sx={{ borderRadius: '8px' }}>
          {t('menuPermissionManagement.accessDenied')}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      p: 0,
      backgroundColor: 'transparent',
      borderRadius: 0,
      minHeight: '100%',
      width: '100%',
      maxWidth: '100%',
      marginLeft: { xs: -2, sm: -2, md: -3, lg: -3, xl: -3 },
      marginRight: { xs: -2, sm: -2, md: -3, lg: -3, xl: -3 },
      paddingLeft: { xs: 2, sm: 2, md: 3, lg: 3, xl: 3 },
      paddingRight: { xs: 2, sm: 2, md: 3, lg: 3, xl: 3 },
      overflow: 'hidden',
      boxSizing: 'border-box'
    }}>
      {/* 헤더 */}
      <DaeheungPageHeader
        title={t('menuPermissionManagement.title')}
        description={t('menuPermissionManagement.description')}
        actions={
          (selectedUserId || selectedCompanyId) ? (
            <>
              {selectedUserId && (
                <>
                  <Button
                    variant="outlined"
                    startIcon={<AutoAwesomeIcon />}
                    onClick={() => setDefaultPermissionDialogOpen(true)}
                    size="small"
                    sx={{
                      borderRadius: '8px',
                      textTransform: 'none',
                      fontWeight: 600,
                      px: 2,
                      borderColor: alpha(theme.palette.divider, 0.95) }}
                  >
                    {t('menuPermissionManagement.defaultPermissions')}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<PersonAddIcon />}
                    onClick={() => setDelegationDialogOpen(true)}
                    size="small"
                    sx={{
                      borderRadius: '8px',
                      textTransform: 'none',
                      fontWeight: 600,
                      px: 2,
                      borderColor: alpha(theme.palette.divider, 0.95) }}
                  >
                    {t('menuPermissionManagement.permissionDelegation')}
                  </Button>
                </>
              )}
              <Button
                variant="contained"
                disableElevation
                startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                onClick={handleSave}
                disabled={saving}
                size="small"
                sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, px: 2.25 }}
              >
                {saving ? t('menuPermissionManagement.saving') : t('menuPermissionManagement.save')}
              </Button>
            </>
          ) : undefined
        }
      />

      <Box sx={{ 
        display: 'flex',
        height: 'calc(100vh - 200px)',
        width: '100%',
        gap: 0,
        position: 'relative'
      }}>
        {/* 왼쪽: 사용자/회사 선택 */}
        <Box sx={{ 
          width: `${leftPanelWidth}px`,
          minWidth: '300px',
          maxWidth: '1000px',
          flexShrink: 0,
          position: 'relative'
        }}>
          <Card elevation={0} sx={{ height: '100%', display: 'flex', flexDirection: 'column', mr: 0, ...cardShellSx }}>
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', py: 2.75, px: { xs: 2.25, sm: 2.75 }, '&:last-child': { pb: 2.75 } }}>
              <Typography component="h2" variant="subtitle1" sx={{ ...listSectionTitleSx, fontSize: '15px', mb: 2 }}>
                {t('menuPermissionManagement.select')}
              </Typography>
              
              {/* 사용자 검색 */}
              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  label={t('menuPermissionManagement.userSearch')}
                  placeholder={t('menuPermissionManagement.userSearchPlaceholder')}
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={selectionInputSx}
                />
              </Box>

              {/* 회사 검색 */}
              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  label={t('menuPermissionManagement.companySearch')}
                  placeholder={t('menuPermissionManagement.companySearchPlaceholder')}
                  value={companySearchTerm}
                  onChange={(e) => setCompanySearchTerm(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={selectionInputSx}
                />
              </Box>

              {/* 사용자 영역 (위 60%) */}
              <Box sx={{ 
                height: `${userSectionHeight}px`,
                minHeight: '150px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}>
                <Typography component="h3" variant="subtitle2" sx={listSectionTitleSx}>
                  {t('menuPermissionManagement.users')}
                </Typography>
                {dataLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : filteredUsers.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    {userSearchTerm || companySearchTerm ? t('common.search') : t('menuPermissionManagement.noUsers')}
                  </Typography>
                ) : (
                  <List dense sx={{ flex: 1, overflow: 'auto', py: 0.5 }}>
                    {filteredUsers.map((u) => {
                      const avatarSrc = getUploadUrl(u.avatar_url) || undefined;
                      return (
                      <ListItemButton
                        key={u.id}
                        selected={selectedUserId === u.id}
                        onClick={() => {
                          setSelectedUserId(u.id);
                          // 회사 필터는 유지 (사용자 선택 시 회사 필터 해제하지 않음)
                        }}
                        sx={{
                          mb: 0.5,
                          borderRadius: '8px',
                          py: 1,
                          ...listItemSelectedSx }}
                      >
                        <ListItemIcon sx={{ minWidth: 40 }}>
                          <Avatar
                            src={avatarSrc}
                            alt={u.name}
                            sx={{
                              width: 32,
                              height: 32,
                              fontSize: '0.8125rem',
                              fontWeight: 600,
                              bgcolor: avatarSrc
                                ? 'transparent'
                                : selectedUserId === u.id
                                  ? alpha(theme.palette.primary.main, 0.22)
                                  : theme.palette.primary.main,
                              color: selectedUserId === u.id ? 'primary.dark' : theme.palette.primary.contrastText,
                            }}
                          >
                            {u.name?.charAt(0)?.toUpperCase() || '?'}
                          </Avatar>
                        </ListItemIcon>
                        <ListItemText
                          primary={u.name}
                          secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5, flexWrap: 'wrap' }}>
                              <Chip
                                label={u.role}
                                size="small"
                                sx={{
                                  height: 22,
                                  fontSize: '0.6875rem',
                                  fontWeight: 600,
                                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                                  color: 'primary.dark',
                                  border: 'none',
                                  '& .MuiChip-label': { px: 1 } }}
                              />
                              <Typography variant="caption" color="text.secondary" sx={{ ml: 0 }}>
                                {u.company}
                              </Typography>
                            </Box>
                          }
                          primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 600, letterSpacing: '-0.01em' }}
                          secondaryTypographyProps={{ component: 'div' }}
                        />
                      </ListItemButton>
                      );
                    })}
                  </List>
                )}
              </Box>

              {/* 수직 리사이즈 핸들 */}
              <Box
                onMouseDown={handleVerticalMouseDown}
                sx={{
                  height: '4px',
                  cursor: 'row-resize',
                  backgroundColor: isVerticalResizing ? alpha(theme.palette.primary.main, 0.35) : alpha(theme.palette.divider, 0.9),
                  borderRadius: '4px',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.2) },
                  position: 'relative',
                  flexShrink: 0,
                  transition: isVerticalResizing ? 'none' : 'background-color 0.2s',
                  zIndex: 10,
                  my: 1,
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: '-2px',
                    bottom: '-2px',
                    left: 0,
                    right: 0,
                    cursor: 'row-resize'
                  }
                }}
              />

              {/* 회사 영역 (아래 40%) */}
              <Box sx={{ 
                flex: 1,
                minHeight: '150px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}>
                <Typography component="h3" variant="subtitle2" sx={listSectionTitleSx}>
                  {t('menuPermissionManagement.companies')}
                </Typography>
                {dataLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : filteredCompanies.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    {companySearchTerm ? t('common.search') : t('menuPermissionManagement.noCompanies')}
                  </Typography>
                ) : (
                  <List dense sx={{ flex: 1, overflow: 'auto', py: 0.5 }}>
                    {filteredCompanies.map((c) => (
                      <ListItemButton
                        key={c.id}
                        selected={selectedCompanyId === c.id}
                        onClick={() => {
                          setSelectedCompanyId(c.id);
                          setSelectedUserId(null);
                        }}
                        sx={{
                          mb: 0.5,
                          borderRadius: '8px',
                          py: 1,
                          ...listItemSelectedSx }}
                      >
                        <ListItemIcon sx={{ minWidth: 40 }}>
                          <BusinessIcon
                            sx={{
                              fontSize: '1.25rem',
                              color: selectedCompanyId === c.id ? 'primary.main' : alpha(theme.palette.text.secondary, 0.85) }}
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={c.name}
                          primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                )}
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* 리사이즈 핸들 */}
        <Box
          ref={resizeRef}
          onMouseDown={handleMouseDown}
          sx={{
            width: '4px',
            cursor: 'col-resize',
            backgroundColor: isResizing ? alpha(theme.palette.primary.main, 0.35) : alpha(theme.palette.divider, 0.9),
            borderRadius: '4px',
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, 0.2) },
            position: 'relative',
            flexShrink: 0,
            transition: isResizing ? 'none' : 'background-color 0.2s',
            zIndex: 10,
            '&::before': {
              content: '""',
              position: 'absolute',
              left: '-2px',
              right: '-2px',
              top: 0,
              bottom: 0,
              cursor: 'col-resize'
            }
          }}
        />

        {/* 오른쪽: 메뉴 권한 트리 */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Card elevation={0} sx={{ height: '100%', display: 'flex', flexDirection: 'column', ml: 0, ...cardShellSx }}>
            <CardContent
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                minWidth: 0,
                py: 2.75,
                px: { xs: 2.25, sm: 2.75 },
                '&:last-child': { pb: 2.75 } }}
            >
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start', 
                mb: 2.5,
                pb: 2,
                borderBottom: '1px solid',
                borderColor: alpha(theme.palette.divider, 0.85) }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5, fontSize: '1.0625rem', letterSpacing: '-0.02em' }}>
                    {selectedUserId
                      ? t('menuPermissionManagement.userMenuPermissions', {
                          name: users.find(u => u.id === selectedUserId)?.name ?? '',
                        })
                      : selectedCompanyId
                      ? t('menuPermissionManagement.userMenuPermissions', {
                          name: companies.find(c => c.id === selectedCompanyId)?.name ?? '',
                        })
                      : t('menuPermissionManagement.selectUserOrCompany')}
                  </Typography>
                  {(selectedUserId || selectedCompanyId) && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, fontSize: '0.8125rem', lineHeight: 1.55 }}>
                      {t('menuPermissionManagement.clickPermissionBoxes')}
                    </Typography>
                  )}
                </Box>
              </Box>

              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8, flex: 1 }}>
                  <CircularProgress />
                </Box>
              ) : visibleMenuList.length > 0 && (selectedUserId || selectedCompanyId) ? (
                <Box
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    overflow: 'auto',
                    pr: 1.5,
                    pb: 1,
                    maxHeight: 'calc(100vh - 350px)' }}
                >
                  <Box sx={{ minWidth: 'max-content', width: '100%' }}>
                    {/* 헤더 — 행과 동일 그리드로 정렬 */}
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: MENU_ROW_GRID_COLUMNS,
                        columnGap: 1.5,
                        alignItems: 'center',
                        width: '100%',
                        mb: 1.5,
                        pb: 1.25,
                        px: 1,
                        borderBottom: '1px solid',
                        borderColor: alpha(theme.palette.divider, 0.75) }}
                    >
                      <Box aria-hidden />
                      <Box aria-hidden />
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 600, fontSize: '0.8125rem', letterSpacing: '-0.01em', color: 'text.secondary' }}
                      >
                        {t('menuPermissionManagement.menuName')}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          justifySelf: 'end',
                          fontWeight: 600,
                          fontSize: '0.8125rem',
                          letterSpacing: '-0.01em',
                          color: 'text.secondary',
                          whiteSpace: 'nowrap' }}
                      >
                        {t('menuPermissionManagement.permissions')}
                      </Typography>
                    </Box>
                    <DndContext
                      sensors={menuOrderSensors}
                      collisionDetection={menuCollisionDetection}
                      modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
                      measuring={{
                        droppable: { strategy: MeasuringStrategy.Always },
                      }}
                      autoScroll={{
                        threshold: { x: 0.15, y: 0.15 },
                        acceleration: 12,
                        interval: 5,
                      }}
                      onDragStart={handleMenuDragStart}
                      onDragOver={handleMenuDragOver}
                      onDragEnd={handleMenuDragEnd}
                      onDragCancel={handleMenuDragCancel}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 0,
                          minHeight: 120,
                          // 드래그 중 페인트 비용 절감
                          ...(listDragging
                            ? { contentVisibility: 'auto' as const }
                            : null),
                        }}
                      >
                        {renderMenuTree(visibleMenuList)}
                      </Box>
                      <DragOverlay
                        adjustScale={false}
                        dropAnimation={MENU_DROP_ANIMATION}
                        zIndex={1600}
                      >
                        {activeDragMenu ? (
                          <MenuDragOverlayRow
                            level={activeDragLevel}
                            label={
                              language === 'ko'
                                ? activeDragMenu.name_ko
                                : activeDragMenu.name_en || activeDragMenu.name_ko
                            }
                          />
                        ) : null}
                      </DragOverlay>
                    </DndContext>
                  </Box>
                </Box>
              ) : (
                <Box
                  sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    py: 6,
                    px: 3,
                    borderRadius: '8px',
                    border: `1px dashed ${alpha(theme.palette.divider, 0.9)}`,
                    bgcolor: alpha(theme.palette.grey[500], theme.palette.mode === 'dark' ? 0.06 : 0.04) }}
                >
                  <SecurityIcon sx={{ fontSize: 40, mb: 2, opacity: 0.22, color: 'text.secondary' }} />
                  <Typography variant="body1" sx={{ mb: 0.75, fontWeight: 600, letterSpacing: '-0.01em', color: 'text.primary' }}>
                    {t('menuPermissionManagement.selectUserOrCompany')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320, lineHeight: 1.6, fontSize: '0.8125rem' }}>
                    {t('menuPermissionManagement.emptyPanelHint')}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* 기본 권한 설정 다이얼로그 */}
      <Dialog 
        open={defaultPermissionDialogOpen} 
        onClose={() => setDefaultPermissionDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{ sx: { borderRadius: '8px' } }}
      >
        <DialogTitle sx={{ fontSize: '1.125rem', fontWeight: 700, letterSpacing: '-0.02em', pt: 2.5, px: 3 }}>
          {t('menuPermissionManagement.defaultPermissionsDialogTitle')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
            {selectedUserId
              ? t('menuPermissionManagement.applyDefaultToUser', {
                  name: users.find(u => u.id === selectedUserId)?.name ?? '',
                })
              : selectedCompanyId
              ? t('menuPermissionManagement.applyDefaultToCompany', {
                  name: companies.find(c => c.id === selectedCompanyId)?.name ?? '',
                })
              : null}
          </Typography>
          
          {/* 역할별 기본 권한 적용 */}
          {selectedUserId && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                {t('menuPermissionManagement.roleBasedPermissions')}
              </Typography>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<AdminPanelSettingsIcon />}
                onClick={applyRoleBasedPermissions}
                sx={{ 
                  mb: 1,
                  justifyContent: 'flex-start',
                  textTransform: 'none',
                  py: 1.5,
                  borderRadius: '8px',
                  borderColor: alpha(theme.palette.divider, 0.95) }}
              >
                {t('menuPermissionManagement.applyRolePermissions', {
                  role: users.find(u => u.id === selectedUserId)?.role ?? '',
                })}
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                {t('menuPermissionManagement.roleLegendAdmin')}
                <br />
                {t('menuPermissionManagement.roleLegendManager')}
                <br />
                {t('menuPermissionManagement.roleLegendUser')}
                <br />
                {t('menuPermissionManagement.roleLegendAudit')}
              </Typography>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          {/* 템플릿 선택 */}
          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
            {t('menuPermissionManagement.permissionTemplates')}
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<PersonAddIcon />}
              onClick={() => applyDefaultPermissions('my_workspace')}
              sx={{ 
                justifyContent: 'flex-start',
                textTransform: 'none',
                py: 1.5,
                borderRadius: '8px',
                borderColor: 'warning.main',
                color: 'warning.main',
                '&:hover': {
                  borderColor: 'warning.dark',
                  backgroundColor: 'rgba(237, 108, 2, 0.08)'
                }
              }}
            >
              <Box sx={{ flex: 1, textAlign: 'left' }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {t('menuPermissionManagement.myWorkspaceOnly')}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  {t('menuPermissionManagement.myWorkspaceOnlyDesc')}
                </Typography>
              </Box>
            </Button>

            <Button
              fullWidth
              variant="outlined"
              startIcon={<VisibilityOffIcon />}
              onClick={() => applyDefaultPermissions('view_only')}
              sx={{ 
                justifyContent: 'flex-start',
                textTransform: 'none',
                py: 1.5,
                borderRadius: '8px',
                borderColor: 'success.main',
                color: 'success.main',
                '&:hover': {
                  borderColor: 'success.dark',
                  backgroundColor: 'rgba(46, 125, 50, 0.08)'
                }
              }}
            >
              <Box sx={{ flex: 1, textAlign: 'left' }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {t('menuPermissionManagement.viewOnly')}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  {t('menuPermissionManagement.viewOnlyDesc')}
                </Typography>
              </Box>
            </Button>

            <Button
              fullWidth
              variant="outlined"
              startIcon={<EditNoteIcon />}
              onClick={() => applyDefaultPermissions('read_write')}
              sx={{ 
                justifyContent: 'flex-start',
                textTransform: 'none',
                py: 1.5,
                borderRadius: '8px',
                borderColor: 'info.main',
                color: 'info.main',
                '&:hover': {
                  borderColor: 'info.dark',
                  backgroundColor: 'rgba(33, 150, 243, 0.08)'
                }
              }}
            >
              <Box sx={{ flex: 1, textAlign: 'left' }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {t('menuPermissionManagement.readWrite')}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  {t('menuPermissionManagement.readWriteDesc')}
                </Typography>
              </Box>
            </Button>

            <Button
              fullWidth
              variant="outlined"
              startIcon={<AdminPanelSettingsIcon />}
              onClick={() => applyDefaultPermissions('full')}
              sx={{ 
                justifyContent: 'flex-start',
                textTransform: 'none',
                py: 1.5,
                borderRadius: '8px',
                borderColor: 'primary.main',
                color: 'primary.main',
                '&:hover': {
                  borderColor: 'primary.dark',
                  backgroundColor: 'rgba(25, 118, 210, 0.08)'
                }
              }}
            >
              <Box sx={{ flex: 1, textAlign: 'left' }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {t('menuPermissionManagement.full')}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  {t('menuPermissionManagement.fullDesc')}
                </Typography>
              </Box>
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDefaultPermissionDialogOpen(false)} sx={{ borderRadius: '8px', textTransform: 'none' }}>
            {t('menuPermissionManagement.close')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 권한 위임 다이얼로그 */}
      <Dialog
        open={delegationDialogOpen}
        onClose={() => setDelegationDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '8px' } }}
      >
        <DialogTitle sx={{ fontSize: '1.125rem', fontWeight: 700, letterSpacing: '-0.02em', pt: 2.5, px: 3 }}>
          {t('menuPermissionManagement.permissionDelegation')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {t('menuPermissionManagement.delegationDescription', {
              name: users.find(u => u.id === selectedUserId)?.name ?? '',
            })}
          </Typography>
          <FormControl fullWidth>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {t('menuPermissionManagement.delegationTargetUser')}
            </Typography>
            <Select
              value={delegationTargetId || ''}
              onChange={(e) => setDelegationTargetId(e.target.value as number)}
              displayEmpty
              sx={{ borderRadius: '8px' }}
            >
              <MenuItem value="">{t('menuPermissionManagement.pleaseSelect')}</MenuItem>
              {users.filter(u => u.id !== selectedUserId && u.status === 'active').map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.name} ({u.role}) - {u.company}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setDelegationDialogOpen(false)} sx={{ borderRadius: '8px', textTransform: 'none' }}>
            {t('menuPermissionManagement.cancel')}
          </Button>
          <Button
            onClick={handleDelegation}
            variant="contained"
            disableElevation
            disabled={!delegationTargetId || saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <PersonAddIcon />}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
          >
            {saving ? t('menuPermissionManagement.delegating') : t('menuPermissionManagement.delegate')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MenuPermissionManagement;
