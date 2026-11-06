import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Box,
  Typography,
  Tooltip,
  Link
} from '@mui/material';
import {
  ExpandLess,
  ExpandMore,
  Menu as MenuIcon,
  Dashboard,
  Inventory,
  Description,
  Receipt,
  ReceiptLong,
  LocalShipping,
  People,
  AccountBalance,
  Assessment,
  Person,
  Settings,
  Notifications,
  Psychology,
  Chat,
  AttachMoney,
  EventAvailable,
  Category,
  ViewKanban,
  TrendingUp,
  MoveToInbox,
  PostAdd,
  QrCodeScanner,
  Business,
  Email,
  RequestQuote,
  MenuBook,
  Hotel,
  UploadFile,
  Download,
  Schedule,
  BeachAccess,
  Payments,
  Campaign,
  Assignment,
  FolderSpecial,
} from '@mui/icons-material';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { prefetchRoute } from '../Common/LazyPage';
import { useTranslation } from 'react-i18next';
import { useStore, useMenuStore } from '../../store';
import menuService, { type Menu } from '../../services/menuService';
import { isRemovedNavMenuRoute } from '../../utils/isRemovedNavMenuRoute';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  onToggle?: () => void;
  isMobile?: boolean;
  width?: number;
  onWidthChange?: (width: number) => void;
  autoCollapseEnabled?: boolean;
  isCollapsed?: boolean;
  collapsedWidth?: number;
  onCollapseChange?: (collapsed: boolean) => void;
  /** 헤더 버튼으로 아이콘만 보이게 접기 */
  iconOnly?: boolean;
}

/** AppBar Toolbar 높이와 동일 */
const HEADER_HEIGHT_PX = 60;
/** 헤더 상단 inset — Header.tsx AppBar top 과 동일(화면 상단 밀착) */
const HEADER_TOP_INSET_PX = 0;
/** 헤더 하단과 좌측 메뉴 패널 사이 여백 — 헤더에 밀착 */
const HEADER_MENU_GAP_PX = 0;
const SIDEBAR_TOP_PX = HEADER_TOP_INSET_PX + HEADER_HEIGHT_PX + HEADER_MENU_GAP_PX;
/** 메뉴 패널 하단과 화면 맨 아래 사이 여백 — 화면 하단에 밀착 */
const SIDEBAR_BOTTOM_GAP_PX = 0;
const SIDEBAR_HEIGHT_CALC = `calc(100vh - ${SIDEBAR_TOP_PX + SIDEBAR_BOTTOM_GAP_PX}px)`;
/** 접기/펼치기·본문 패딩과 동일한 easing */
export const SIDEBAR_WIDTH_TRANSITION_MS = 300;
export const SIDEBAR_WIDTH_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
/** 마우스 이탈 후 접기 — 살짝 여유를 두어 자연스럽게 */
const SIDEBAR_HOVER_CLOSE_DELAY_MS = 380;
/** 좌측 메뉴 — 본문과 구분되는 카드형 패널 */
const MENU_ITEM_RADIUS_PX = 10;
/** 화면 왼쪽 끝에 밀착 */
const MENU_PANEL_INSET_PX = 0;
/** 화면 가장자리에 붙는 패널이라 모서리를 둥글게 두지 않음 */
const MENU_PANEL_RADIUS_PX = 0;
const MENU_PANEL_BG = '#FFFFFF';
const MENU_PANEL_BORDER = '#CBD5E1';
const MENU_PANEL_SHADOW = '2px 0 8px rgba(36, 52, 71, 0.06)';
const MENU_ACTIVE_COLOR = '#1D4E7C';
const MENU_ACTIVE_BG = 'rgba(29, 78, 124, 0.12)';
const MENU_HOVER_BG = 'rgba(29, 78, 124, 0.07)';
const MENU_MAIN_TEXT_COLOR = '#1E2F42';
const MENU_SUB_TEXT_COLOR = '#526578';
const MENU_SECTION_MUTED = '#6E8092';
const MENU_NEST_BORDER = '#B7C9DB';

const menuItemButtonSx = (
  _theme: { palette: { action: { hover: string } } },
  isActive: boolean,
  extra: Record<string, unknown>,
  level: number = 0,
  _isSection: boolean = false
) => ({
  ...extra,
  position: 'relative' as const,
  border: 'none',
  boxShadow: 'none',
  backgroundColor: isActive && level > 0 ? MENU_ACTIVE_BG : 'transparent',
  color: isActive
    ? MENU_ACTIVE_COLOR
    : level === 0
      ? MENU_MAIN_TEXT_COLOR
      : MENU_SUB_TEXT_COLOR,
  transition: 'background-color 0.14s ease, color 0.14s ease',
  '&::before':
    isActive && level > 0
      ? {
          content: '""',
          position: 'absolute',
          left: 6,
          top: 7,
          bottom: 7,
          width: 3,
          borderRadius: 3,
          backgroundColor: MENU_ACTIVE_COLOR,
        }
      : {},
  '&:hover': {
    backgroundColor:
      isActive && level > 0 ? 'rgba(29, 78, 124, 0.2)' : MENU_HOVER_BG,
  },
});

const menuItemIconSx = (extra: Record<string, unknown>) => ({
  ...extra,
  color: 'inherit',
  justifyContent: 'center',
});

const normalizeMenuPath = (path: string) => {
  const [pathname] = String(path || '').trim().split(/[?#]/);
  if (!pathname) return '';
  if (pathname === '/') return '/';
  return pathname.replace(/\/+$/, '');
};

const isMenuRouteActive = (currentPath: string, route?: string) => {
  const normalizedCurrentPath = normalizeMenuPath(currentPath);
  const normalizedRoute = normalizeMenuPath(route || '');
  if (!normalizedCurrentPath || !normalizedRoute) return false;

  const routeCandidates = new Set<string>([normalizedRoute]);
  if (normalizedRoute === '/communication/notice') routeCandidates.add('/communication/notices');
  if (normalizedRoute === '/communication/notices') routeCandidates.add('/communication/notice');
  if (normalizedRoute === '/my/notices') {
    routeCandidates.add('/communication/notice');
    routeCandidates.add('/communication/notices');
  }
  if (normalizedRoute === '/communication/notice' || normalizedRoute === '/communication/notices') {
    routeCandidates.add('/my/notices');
  }

  return Array.from(routeCandidates).some((candidate) => {
    if (!candidate) return false;
    return (
      normalizedCurrentPath === candidate ||
      normalizedCurrentPath.startsWith(`${candidate}/`)
    );
  });
};

const routeMatchesMenuPath = (currentPath: string, route?: string) =>
  isMenuRouteActive(currentPath, route);

const Sidebar: React.FC<SidebarProps> = ({
  open,
  onClose,
  isMobile = false,
  width = 280,
  onWidthChange,
  autoCollapseEnabled = false,
  isCollapsed = false,
  collapsedWidth = 72,
  onCollapseChange,
  iconOnly = false,
}) => {
  const [sidebarWidth, setSidebarWidth] = useState<number>(width);
  const [isResizing, setIsResizing] = useState(false);
  const [peekOpen, setPeekOpen] = useState(false);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const isExpandedVisual =
    isMobile || (iconOnly ? peekOpen : !autoCollapseEnabled || !isCollapsed || peekOpen);
  const isCompact =
    !isMobile && (iconOnly ? !peekOpen : autoCollapseEnabled && !isExpandedVisual);
  const effectiveWidth = isExpandedVisual ? sidebarWidth : collapsedWidth;
  const leaveTimerRef = useRef<number | null>(null);
  const peekCloseTimerRef = useRef<number | null>(null);

  // width prop이 변경되면 내부 state 업데이트
  useEffect(() => {
    if (!isResizing) {
      setSidebarWidth(width);
    }
  }, [width, isResizing]);

  // 리사이즈 핸들러
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isCompact) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;
  }, [isCompact, sidebarWidth]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    // requestAnimationFrame으로 부드러운 업데이트
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    
    rafRef.current = requestAnimationFrame(() => {
      const diff = e.clientX - startXRef.current; // 오른쪽으로 드래그하면 양수 (사이드바 확대), 왼쪽으로 드래그하면 음수 (사이드바 축소)
      const minWidth = 200; // 최소 너비
      const maxWidth = 500; // 최대 너비
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current + diff));
      setSidebarWidth(newWidth);
      if (onWidthChange) {
        onWidthChange(newWidth);
      }
    });
  }, [isResizing, onWidthChange]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
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
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    return () => {
      if (leaveTimerRef.current) {
        window.clearTimeout(leaveTimerRef.current);
        leaveTimerRef.current = null;
      }
      if (peekCloseTimerRef.current) {
        window.clearTimeout(peekCloseTimerRef.current);
        peekCloseTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!autoCollapseEnabled && !iconOnly) {
      setPeekOpen(false);
    }
  }, [autoCollapseEnabled, iconOnly]);

  useEffect(() => {
    setPeekOpen(false);
  }, [iconOnly]);

  const schedulePeekClose = useCallback(() => {
    if (peekCloseTimerRef.current) {
      window.clearTimeout(peekCloseTimerRef.current);
    }
    peekCloseTimerRef.current = window.setTimeout(() => {
      setPeekOpen(false);
      peekCloseTimerRef.current = null;
    }, SIDEBAR_WIDTH_TRANSITION_MS + 40);
  }, []);

  const handleSidebarMouseEnter = useCallback(() => {
    if (!iconOnly && !autoCollapseEnabled) return;
    if (leaveTimerRef.current) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    if (peekCloseTimerRef.current) {
      window.clearTimeout(peekCloseTimerRef.current);
      peekCloseTimerRef.current = null;
    }
    setPeekOpen(true);
    if (!iconOnly && isCollapsed) {
      onCollapseChange?.(false);
    }
  }, [autoCollapseEnabled, iconOnly, isCollapsed, onCollapseChange]);

  const handleSidebarMouseLeave = useCallback(() => {
    if (!iconOnly && !autoCollapseEnabled) return;
    if (leaveTimerRef.current) {
      window.clearTimeout(leaveTimerRef.current);
    }
    leaveTimerRef.current = window.setTimeout(() => {
      if (!iconOnly) {
        onCollapseChange?.(true);
      }
      schedulePeekClose();
      leaveTimerRef.current = null;
    }, SIDEBAR_HOVER_CLOSE_DELAY_MS);
  }, [autoCollapseEnabled, iconOnly, onCollapseChange, schedulePeekClose]);
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user } = useStore();
  const {
    menus,
    loading,
    error,
    language,
    setMenus,
    setUserPermissions,
    setLoading,
    setError
  } = useMenuStore();
  
  const [expandedMenus, setExpandedMenus] = useState<Set<number>>(new Set());

  /** 공지·AI·레거시 보고서는 헤더/다른 경로로만 진입 — 사이드바에서 제외 */
  const menusWithoutNotice = useMemo((): Menu[] => {
    const isNoticeMenu = (m: Menu) =>
      String(m.route || '').startsWith('/communication') ||
      m.name_ko === '공지사항' ||
      m.name_ko === '커뮤니케이션' ||
      /^notices?$/i.test(String(m.name_en || '').trim()) ||
      /^communication$/i.test(String(m.name_en || '').trim());

    const isLegacyReportsRoot = (m: Menu) => {
      const route = normalizeMenuPath(m.route || '');
      return route === '/reports' || m.name_ko === '보고서';
    };

    const isAiMenu = (m: Menu) => {
      const route = String(m.route || '');
      if (route.startsWith('/ai')) return true;
      if (/^\/(cost-analysis|efficiency|forecasting|recommendations)(\/|$)/.test(route)) return true;
      if (m.name_ko === 'AI 분석' || m.name_ko === '분석') return true;
      if (/^analysis$/i.test(String(m.name_en || '').trim())) return true;
      return false;
    };

    const filterRec = (items: Menu[]): Menu[] =>
      items
        .filter((x) => !isNoticeMenu(x) && !isAiMenu(x) && !isLegacyReportsRoot(x) && !isRemovedNavMenuRoute(x.route))
        .map((x) => {
          if (x.children?.length) {
            const children = filterRec(x.children);
            return children.length ? { ...x, children } : null;
          }
          return x;
        })
        .filter((x): x is Menu => x != null);

    return filterRec(menus || []);
  }, [menus]);

  const topLevelMenuIds = useMemo(
    () => new Set((menusWithoutNotice || []).map((m) => m.id)),
    [menusWithoutNotice]
  );

  const allMenuRoutes = useMemo(() => {
    const out: string[] = [];
    const walk = (items: Menu[]) => {
      for (const m of items) {
        if (m.route) out.push(String(m.route));
        if (m.children?.length) walk(m.children);
      }
    };
    walk(menusWithoutNotice || []);
    return out;
  }, [menusWithoutNotice]);

  const getLongestMatchingMenuRoute = (currentPath: string): string | null => {
    if (!normalizeMenuPath(currentPath)) return null;
    const matches = allMenuRoutes
      .map((r) => normalizeMenuPath(r))
      .filter((r) => r && routeMatchesMenuPath(currentPath, r));
    if (matches.length === 0) return null;
    return matches.reduce((a, b) => (a.length >= b.length ? a : b));
  };

  const isRouteExactMatch = (currentPath: string, route?: string) => {
    const normalizedCurrentPath = normalizeMenuPath(currentPath);
    const normalizedRoute = normalizeMenuPath(route || '');
    if (!normalizedCurrentPath || !normalizedRoute) return false;
    return normalizedCurrentPath === normalizedRoute;
  };

  /** 현재 URL에 해당하는 하위 메뉴가 있으면 그 경로까지의 부모 메뉴 id — 항상 펼침 */
  const ancestorIdsToKeepOpen = useMemo(() => {
    const currentPath = location.pathname;
    if (!normalizeMenuPath(currentPath) || !menusWithoutNotice?.length) return new Set<number>();

    const matches = allMenuRoutes
      .map((r) => normalizeMenuPath(r))
      .filter((r) => r && routeMatchesMenuPath(currentPath, r));
    if (matches.length === 0) return new Set<number>();
    const best = matches.reduce((a, b) => (a.length >= b.length ? a : b));

    const findChainToRoute = (items: Menu[], acc: Menu[]): Menu[] | null => {
      for (const m of items) {
        const nr = normalizeMenuPath(m.route || '');
        if (nr && nr === best) return [...acc, m];
        if (m.children?.length) {
          const found = findChainToRoute(m.children, [...acc, m]);
          if (found) return found;
        }
      }
      return null;
    };

    const chain = findChainToRoute(menusWithoutNotice, []);
    if (!chain?.length) return new Set<number>();

    return new Set(chain.slice(0, -1).map((m) => m.id));
  }, [location.pathname, menusWithoutNotice, allMenuRoutes]);

  // 페이지 이동 시 현재 섹션만 남기고 다른 최상위 그룹은 접기
  useEffect(() => {
    setExpandedMenus((prev) => {
      const next = new Set<number>();
      ancestorIdsToKeepOpen.forEach((id) => next.add(id));
      prev.forEach((id) => {
        if (!topLevelMenuIds.has(id)) next.add(id);
      });
      const same =
        next.size === prev.size && Array.from(next).every((id) => prev.has(id));
      return same ? prev : next;
    });
  }, [ancestorIdsToKeepOpen, topLevelMenuIds]);

  // 아이콘 매핑
  const getIcon = (iconName: string) => {
    const key = String(iconName || '').trim();
    const iconMap: { [key: string]: React.ReactElement } = {
      dashboard: <Dashboard />,
      inventory: <Inventory />,
      description: <Description />,
      receipt_long: <ReceiptLong />,
      receipt: <Receipt />,
      local_shipping: <LocalShipping />,
      people: <People />,
      account_balance: <AccountBalance />,
      assessment: <Assessment />,
      person: <Person />,
      Person: <Person />,
      settings: <Settings />,
      notifications: <Notifications />,
      psychology: <Psychology />,
      chat: <Chat />,
      attach_money: <AttachMoney />,
      event_available: <EventAvailable />,
      event: <BeachAccess />,
      schedule: <Schedule />,
      payments: <Payments />,
      campaign: <Campaign />,
      assignment: <Assignment />,
      category: <Category />,
      view_kanban: <ViewKanban />,
      folder_special: <FolderSpecial />,
      move_to_inbox: <MoveToInbox />,
      post_add: <PostAdd />,
      qr_code_scanner: <QrCodeScanner />,
      download: <Download />,
    };
    return iconMap[key] || iconMap[key.toLowerCase()] || <MenuIcon />;
  };

  const getSubmenuIconByRoute = (route: string) => {
    const normalized = String(route || '').toLowerCase();
    if (normalized.includes('/basic-info/company')) return <AccountBalance />;
    if (normalized.includes('/basic-info/partners')) return <People />;
    if (normalized.includes('/basic-info/organization')) return <Category />;
    if (normalized.includes('/basic-info/menu-permissions')) return <Settings />;
    if (normalized.includes('/basic-info/login-info')) return <Person />;
    if (normalized.includes('/basic-info/system-settings')) return <Settings />;
    if (normalized.includes('/basic-info/mail-send-test')) return <Email />;

    if (normalized.includes('/hr/users')) return <Person />;
    if (normalized.includes('/hr/departments')) return <Business />;
    if (normalized.includes('/hr/attendance/statistics')) return <Assessment />;
    if (normalized.includes('/hr/attendance')) return <Schedule />;
    if (normalized.includes('/hr/payslip-send')) return <Email />;
    if (normalized.includes('/hr/payroll')) return <Payments />;
    if (normalized.includes('/hr/leave') || normalized.includes('/hr/vacation')) return <BeachAccess />;
    if (normalized.includes('/hr/employment-contracts')) return <Description />;

    if (normalized.includes('/work/project-management')) return <FolderSpecial />;
    if (normalized.includes('/work/projects')) return <ViewKanban />;
    if (normalized.includes('/work/statistics')) return <Assessment />;
    if (normalized.includes('/work/approval')) return <Description />;
    if (normalized.includes('/hotel/room-reservation')) return <Hotel />;
    if (normalized.includes('/work/reports')) return <ReceiptLong />;

    if (normalized.includes('/hotel/front-desk')) return <Dashboard />;
    if (normalized.includes('/hotel/reservations')) return <EventAvailable />;
    if (normalized.includes('/hotel/room-types')) return <Inventory />;

    if (normalized.includes('/inventory/stock-in')) return <PostAdd />;
    if (normalized.includes('/inventory/stock-out')) return <QrCodeScanner />;
    if (normalized.includes('/inventory/basic')) return <Inventory />;
    if (normalized.includes('/inventory/status')) return <Assessment />;
    if (normalized.includes('/inventory/transaction')) return <AttachMoney />;
    if (normalized.includes('/inventory/report')) return <ReceiptLong />;

    if (normalized.includes('/accounting/books')) return <MenuBook />;
    if (normalized.includes('/accounting/tally-import')) return <UploadFile />;
    if (normalized.includes('/accounting/sap-import')) return <UploadFile />;
    if (normalized.includes('/accounting/chart-of-accounts')) return <AccountBalance />;
    if (normalized.includes('/accounting/vouchers')) return <ReceiptLong />;
    if (normalized.includes('/accounting/ledger')) return <Description />;
    if (normalized.includes('/accounting/trial-balance')) return <Assessment />;
    if (normalized.includes('/accounting/quotation')) return <RequestQuote />;
    if (normalized.includes('/accounting/e-invoice')) return <ReceiptLong />;
    if (normalized.includes('/accounting/invoice')) return <Description />;
    if (normalized.includes('/accounting/eway-bill')) return <LocalShipping />;
    if (normalized.includes('/accounting/auto-voucher')) return <ReceiptLong />;
    if (normalized.includes('/accounting/expense')) return <AttachMoney />;
    if (normalized.includes('/accounting/assets')) return <AccountBalance />;
    if (normalized.includes('/accounting/statistics')) return <Assessment />;
    if (normalized.includes('/accounting/corporate-tax')) return <Payments />;
    if (normalized.includes('/accounting/advance-tax')) return <Payments />;

    if (normalized.includes('/customers/contracts')) return <Description />;

    if (normalized.includes('/dashboard')) return <Dashboard />;
    if (normalized.includes('/my/personal-info')) return <Person />;
    if (normalized.includes('/my/attendance')) return <Schedule />;
    if (normalized.includes('/my/leave')) return <BeachAccess />;
    if (normalized.includes('/my/payslips')) return <Payments />;
    if (normalized.includes('/my/contracts')) return <Description />;
    if (normalized.includes('/my/notices') || normalized.includes('/communication/notice')) {
      return <Campaign />;
    }
    if (normalized.includes('/my/work-list')) return <Assignment />;
    if (normalized.includes('/my/mail-settings')) return <Settings />;
    if (normalized === '/my' || normalized.startsWith('/my/')) return <Person />;
    if (normalized.includes('/communication/desktop-notifier')) return <Download />;
    if (normalized.includes('/communication/email')) return <Chat />;
    if (normalized.includes('/communication/sms')) return <Notifications />;

    if (normalized.includes('/ai/')) return <Psychology />;
    if (normalized.includes('/reports/')) return <Assessment />;

    // 상위 메뉴(섹션) 라우트 매핑
    if (normalized.startsWith('/basic-info')) return <Settings />;
    if (normalized.startsWith('/hr')) return <People />;
    if (normalized.startsWith('/work')) return <ViewKanban />;
    if (normalized.startsWith('/hotel')) return <Dashboard />;
    if (normalized.startsWith('/inventory')) return <Inventory />;
    if (normalized.startsWith('/sales')) return <TrendingUp />;
    if (normalized.startsWith('/accounting')) return <AccountBalance />;
    if (normalized.startsWith('/customers')) return <TrendingUp />;
    if (normalized.startsWith('/communication')) return <Notifications />;
    if (normalized.startsWith('/ai')) return <Psychology />;
    if (normalized.startsWith('/reports')) return <Assessment />;
    return null;
  };

  const getContextualMenuIcon = (menu: any, level: number) => {
    const defaultIcon = getIcon(menu.icon);
    const routeIcon = getSubmenuIconByRoute(String(menu.route || ''));
    if (routeIcon) return routeIcon;

    const ko = String(menu.name_ko || '');
    const en = String(menu.name_en || '').toLowerCase();
    if (ko.includes('내 정보') || en.includes('my info')) return <Person />;
    if (ko.includes('기초') || en.includes('basic')) return <Settings />;
    if (ko.includes('인사') || en.includes('hr')) return <People />;
    if (ko.includes('업무') || en.includes('work')) return <ViewKanban />;
    if (ko.includes('호텔') || en.includes('hotel')) return <Dashboard />;
    if (ko.includes('회사') || en.includes('company')) return <AccountBalance />;
    if (ko.includes('파트너') || ko.includes('고객') || en.includes('partner') || en.includes('customer')) return <People />;
    if (ko.includes('재고') || en.includes('inventory')) return <Inventory />;
    if (ko.includes('결재') || ko.includes('전자결재') || en.includes('approval')) return <Description />;
    if (ko.includes('매출') || ko.includes('통계') || en.includes('sales') || en.includes('statistics')) return <TrendingUp />;
    if (ko.includes('회계') || en.includes('accounting')) return <AttachMoney />;
    if (ko.includes('커뮤니케이션') || en.includes('communication')) return <Notifications />;
    if (ko.includes('ai') || en.includes('ai')) return <Psychology />;
    if (ko.includes('리포트') || en.includes('report')) return <Assessment />;
    if (ko.includes('출퇴근') || en.includes('attendance')) return <Schedule />;
    if (ko.includes('휴가') || en.includes('leave') || en.includes('vacation')) return <BeachAccess />;
    if (ko.includes('급여') || en.includes('payslip') || en.includes('payroll')) return <Payments />;
    if (ko.includes('설정') || en.includes('setting')) return <Settings />;
    if (ko.includes('공지') || en.includes('notice')) return <Campaign />;
    if (level === 0) return defaultIcon;
    return defaultIcon;
  };

  // 메뉴 데이터 로드 (재시도 로직 포함)
  useEffect(() => {
    const loadMenus = async (retryCount = 0) => {
      if (!user) {
        setLoading(false);
        setMenus([]);
        setUserPermissions([]);
        return;
      }

      setLoading(true);
      const timeoutId = window.setTimeout(() => {
        setLoading(false);
        setError('메뉴 로드 시간이 초과되었습니다. 새로고침 후 다시 시도해주세요.');
      }, 20000);

      try {
        const [menusResponse, permissionsResponse] = await Promise.all([
          menuService.getUserMenus(user.id, user.tenant_id, language),
          menuService.getUserPermissions(user.id)
        ]);
        
        if (menusResponse.success) {
          setMenus(menusResponse.data);
        }
        
        if (permissionsResponse.success) {
          setUserPermissions(permissionsResponse.data);
        }
        
        setError(null);
      } catch (error: any) {
        if (error.response?.status === 429 && retryCount < 3) {
          window.clearTimeout(timeoutId);
          setTimeout(() => {
            loadMenus(retryCount + 1);
          }, (retryCount + 1) * 2000);
          return;
        }
        
        setError('메뉴를 불러오는데 실패했습니다.');
      } finally {
        window.clearTimeout(timeoutId);
        setLoading(false);
      }
    };

    loadMenus();
  }, [user, language, setMenus, setUserPermissions, setLoading, setError]);

  // 메뉴 확장/축소 — 최상위는 아코디언(현재 경로 섹션 제외 한 개만 펼침)
  const handleMenuToggle = (menuId: number) => {
    if (ancestorIdsToKeepOpen.has(menuId)) {
      return;
    }
    setExpandedMenus((prev) => {
      const isTopLevel = topLevelMenuIds.has(menuId);
      if (isTopLevel) {
        const opening = !prev.has(menuId);
        const next = new Set<number>();
        ancestorIdsToKeepOpen.forEach((id) => next.add(id));
        prev.forEach((id) => {
          if (!topLevelMenuIds.has(id)) next.add(id);
        });
        if (opening) next.add(menuId);
        return next;
      }
      const next = new Set(prev);
      if (next.has(menuId)) next.delete(menuId);
      else next.add(menuId);
      return next;
    });
  };

  // 메뉴 클릭 처리
  const handleMenuClick = (menu: any) => {
    if (menu.children && menu.children.length > 0) {
      if (isCompact) {
        setPeekOpen(true);
        const newExpanded = new Set(expandedMenus);
        newExpanded.add(menu.id);
        setExpandedMenus(newExpanded);
        return;
      }
      handleMenuToggle(menu.id);
    } else if (menu.route) {
      navigate(menu.route);
      if (isMobile) {
        onClose();
      }
    }
  };

  // 메뉴 렌더링
  const renderMenuItem = (menu: any, level: number = 0) => {
    const hasChildren = menu.children && menu.children.length > 0;
    const isExpanded = ancestorIdsToKeepOpen.has(menu.id) || expandedMenus.has(menu.id);
    const isActive = hasChildren
      ? isRouteExactMatch(location.pathname, menu.route)
      : (() => {
          const best = getLongestMatchingMenuRoute(location.pathname);
          const nr = normalizeMenuPath(menu.route || '');
          return !!nr && best === nr;
        })();
    const isSection = level === 0 && hasChildren;
    const sectionHasActiveChild =
      isSection &&
      Array.from(ancestorIdsToKeepOpen).some((id) => id === menu.id);
    const highlight = isActive || (isCompact && sectionHasActiveChild);
    const isCompactItem = isCompact;
    const labelText =
      language === 'ko' && menu.name_ko === '지출보고서'
        ? '지출결의서'
        : language === 'ko'
          ? menu.name_ko
          : String(menu.name_en ?? '').trim() || menu.name_ko;

    return (
      <React.Fragment key={menu.id}>
        <ListItem
          disablePadding
          sx={{
            mb: level === 0 ? 0.15 : 0.05,
            mt: level === 0 ? 0.35 : 0,
          }}
        >
          {isCompactItem ? (
            <Tooltip title={labelText} placement="right">
              <ListItemButton
                onMouseEnter={() => prefetchRoute(menu.route)}
                onFocus={() => prefetchRoute(menu.route)}
                onClick={() => handleMenuClick(menu)}
                sx={(theme) =>
                  menuItemButtonSx(
                    theme,
                    highlight,
                    {
                      mx: 0.75,
                      px: 1,
                      py: 0.9,
                      minHeight: 40,
                      justifyContent: 'center',
                      borderRadius: MENU_ITEM_RADIUS_PX,
                      backgroundColor: highlight ? MENU_ACTIVE_BG : 'transparent',
                    },
                    level,
                    isSection
                  )
                }
              >
                <ListItemIcon
                  sx={menuItemIconSx({
                    minWidth: 0,
                    color: highlight ? MENU_ACTIVE_COLOR : MENU_SECTION_MUTED,
                    '& .MuiSvgIcon-root': { fontSize: '1.2rem' },
                  })}
                >
                  {getContextualMenuIcon(menu, level)}
                </ListItemIcon>
              </ListItemButton>
            </Tooltip>
          ) : (
            <ListItemButton
              onMouseEnter={() => prefetchRoute(menu.route)}
              onFocus={() => prefetchRoute(menu.route)}
              onClick={() => handleMenuClick(menu)}
              sx={(theme) =>
                menuItemButtonSx(
                  theme,
                  isActive,
                  {
                    mx: 1,
                    pl: level === 0 ? 1.35 : 2.25,
                    pr: 1,
                    py: level === 0 ? 0.8 : 0.55,
                    minHeight: level === 0 ? 40 : 32,
                    borderRadius: MENU_ITEM_RADIUS_PX,
                    alignItems: 'center',
                    ...(level === 0 && isActive
                      ? { backgroundColor: MENU_ACTIVE_BG }
                      : {}),
                  },
                  level,
                  isSection
                )
              }
            >
              <ListItemIcon
                sx={menuItemIconSx({
                  minWidth: level === 0 ? 28 : 24,
                  color:
                    isActive || sectionHasActiveChild
                      ? MENU_ACTIVE_COLOR
                      : level === 0
                        ? MENU_SECTION_MUTED
                        : 'inherit',
                  opacity: isActive || sectionHasActiveChild ? 1 : level === 0 ? 0.85 : 0.7,
                  '& .MuiSvgIcon-root': {
                    fontSize: level === 0 ? '1.05rem' : '0.95rem',
                  },
                })}
              >
                {getContextualMenuIcon(menu, level)}
              </ListItemIcon>
              <ListItemText
                primary={labelText}
                primaryTypographyProps={{ component: 'span' }}
                sx={{
                  my: 0,
                  minWidth: 0,
                  opacity: isExpandedVisual ? 1 : 0,
                  transform: isExpandedVisual ? 'translateX(0)' : 'translateX(-6px)',
                  transition: `opacity ${SIDEBAR_WIDTH_TRANSITION_MS - 80}ms ${SIDEBAR_WIDTH_EASING} 70ms, transform ${SIDEBAR_WIDTH_TRANSITION_MS - 80}ms ${SIDEBAR_WIDTH_EASING} 70ms`,
                  '& .MuiListItemText-primary': {
                    fontSize: level === 0 ? '13.5px' : '13px',
                    fontWeight: isActive ? 500 : level === 0 ? 500 : 400,
                    letterSpacing: '-0.01em',
                    color: 'inherit',
                    lineHeight: 1.3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
                }}
              />
              {hasChildren && (
                <Box
                  component="span"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 20,
                    height: 20,
                    ml: 0.25,
                    color: isExpanded || sectionHasActiveChild ? MENU_ACTIVE_COLOR : '#A0AEBC',
                    flexShrink: 0,
                    transition: 'transform 0.18s ease, color 0.14s ease',
                    transform: isExpanded ? 'rotate(0deg)' : 'rotate(0deg)',
                    '& .MuiSvgIcon-root': { fontSize: '1.05rem' },
                  }}
                >
                  {isExpanded ? <ExpandLess fontSize="inherit" /> : <ExpandMore fontSize="inherit" />}
                </Box>
              )}
            </ListItemButton>
          )}
        </ListItem>

        {hasChildren && !isCompactItem && (
          <Collapse in={isExpanded} timeout={160} unmountOnExit>
            <List
              component="div"
              disablePadding
              sx={{
                mb: 0.4,
                ml: 1.75,
                pl: 1.1,
                borderLeft: `2px solid ${MENU_NEST_BORDER}`,
                bgcolor: 'rgba(29, 78, 124, 0.035)',
                borderRadius: '0 10px 10px 0',
                py: 0.25,
                mr: 0.75,
              }}
            >
              {menu.children.map((child: any) => renderMenuItem(child, level + 1))}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    );
  };

  const drawerPaperSx = {
    width: Math.max(effectiveWidth - MENU_PANEL_INSET_PX, 56),
    boxSizing: 'border-box' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    position: 'fixed' as const,
    top: `${SIDEBAR_TOP_PX}px`,
    left: `${MENU_PANEL_INSET_PX}px`,
    height: SIDEBAR_HEIGHT_CALC,
    minHeight: SIDEBAR_HEIGHT_CALC,
    backgroundColor: MENU_PANEL_BG,
    borderRight: `1px solid ${MENU_PANEL_BORDER}`,
    borderRadius: `${MENU_PANEL_RADIUS_PX}px`,
    zIndex: (iconOnly || autoCollapseEnabled) && peekOpen && (iconOnly || isCollapsed) ? 1300 : 1200,
    willChange: 'width, box-shadow',
    overflowX: 'hidden' as const,
    boxShadow:
      (iconOnly || autoCollapseEnabled) && peekOpen
        ? '6px 0 24px rgba(15, 23, 42, 0.14)'
        : MENU_PANEL_SHADOW,
    transition: isResizing
      ? 'none'
      : `width ${SIDEBAR_WIDTH_TRANSITION_MS}ms ${SIDEBAR_WIDTH_EASING}, box-shadow ${SIDEBAR_WIDTH_TRANSITION_MS}ms ${SIDEBAR_WIDTH_EASING}`,
  };

  const mobileDrawerPaperSx = {
    width: Math.min(sidebarWidth, 300),
    maxWidth: '85vw',
    boxSizing: 'border-box' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    top: `${SIDEBAR_TOP_PX}px`,
    height: SIDEBAR_HEIGHT_CALC,
    minHeight: SIDEBAR_HEIGHT_CALC,
    backgroundColor: MENU_PANEL_BG,
    borderRight: `1px solid ${MENU_PANEL_BORDER}`,
    borderRadius: `${MENU_PANEL_RADIUS_PX}px`,
    boxShadow: MENU_PANEL_SHADOW,
    overflowX: 'hidden' as const,
  };

  const drawerBody = (
    <Box
      sx={{
        flexGrow: 1,
        overflow: 'auto',
        backgroundColor: MENU_PANEL_BG,
        px: 0.25,
        pt: 0.75,
        pb: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        '&::-webkit-scrollbar': { width: 5 },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: 'rgba(29, 78, 124, 0.28)',
          borderRadius: 8,
        },
        '&::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
      }}
    >
      <List sx={{ flexGrow: 1, p: 0 }}>
        {menusWithoutNotice
          .filter((menu: Menu) => {
            const menuName = language === 'ko' ? menu.name_ko : menu.name_en;
            return menuName !== '시스템관리' && menuName !== 'System Management';
          })
          .map((menu: Menu) => renderMenuItem(menu))}
      </List>

      <Box
        sx={{
          mt: 'auto',
          px: 1.5,
          py: 1.25,
          textAlign: 'center',
          flexShrink: 0,
          borderTop: `1px solid ${MENU_PANEL_BORDER}`,
          bgcolor: '#FFFFFF',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: 0.5,
            mb: 0.35,
            opacity: isExpandedVisual ? 1 : 0,
            pointerEvents: isExpandedVisual ? 'auto' : 'none',
            transition: `opacity ${SIDEBAR_WIDTH_TRANSITION_MS - 60}ms ${SIDEBAR_WIDTH_EASING} 90ms`,
          }}
        >
          {[
            { to: '/legal/terms', label: t('login.footerTerms') },
            { to: '/legal/privacy', label: t('login.footerPrivacy') },
            { to: '/legal/support', label: t('login.footerSupport') },
          ].map((item, index) => (
            <React.Fragment key={item.to}>
              {index > 0 && (
                <Typography
                  component="span"
                  sx={{
                    fontSize: '0.625rem',
                    color: 'text.secondary',
                    opacity: 0.55,
                    lineHeight: 1,
                  }}
                >
                  ·
                </Typography>
              )}
              <Typography
                component={RouterLink}
                to={item.to}
                sx={{
                  fontSize: '0.625rem',
                  fontWeight: 500,
                  color: 'text.secondary',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.4,
                  '&:hover': {
                    color: MENU_ACTIVE_COLOR,
                    textDecoration: 'underline',
                  },
                }}
              >
                {item.label}
              </Typography>
            </React.Fragment>
          ))}
        </Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            fontSize: '0.6875rem',
            letterSpacing: '0.02em',
            opacity: isExpandedVisual ? 0.5 : 0,
            display: 'block',
            transition: `opacity ${SIDEBAR_WIDTH_TRANSITION_MS - 60}ms ${SIDEBAR_WIDTH_EASING} 90ms`,
          }}
        >
          © {new Date().getFullYear()}{' '}
          <Link
            href="https://www.msventures.in"
            target="_blank"
            rel="noopener noreferrer"
            underline="none"
            color="inherit"
            sx={{
              fontSize: 'inherit',
              cursor: 'pointer',
              '&:hover': {
                color: MENU_ACTIVE_COLOR,
                textDecoration: 'none',
              },
              '&:visited': {
                color: 'inherit',
              },
            }}
          >
            Minsub Ventures
          </Link>
        </Typography>
      </Box>
    </Box>
  );

  if (isMobile) {
    if (loading) {
      return (
        <Drawer
          variant="temporary"
          anchor="left"
          open={open}
          onClose={onClose}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': mobileDrawerPaperSx }}
        >
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography>메뉴 로딩 중...</Typography>
          </Box>
        </Drawer>
      );
    }

    if (error) {
      return (
        <Drawer
          variant="temporary"
          anchor="left"
          open={open}
          onClose={onClose}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': mobileDrawerPaperSx }}
        >
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography color="error">{error}</Typography>
          </Box>
        </Drawer>
      );
    }

    return (
      <Drawer
        variant="temporary"
        anchor="left"
        open={open}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{ '& .MuiDrawer-paper': mobileDrawerPaperSx }}
      >
        {drawerBody}
      </Drawer>
    );
  }

  if (loading) {
    return (
      <Box sx={{ position: 'relative' }}>
        <Drawer
          variant="permanent"
          open={true}
          sx={{
            width: effectiveWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              ...drawerPaperSx,
            }
          }}
        >
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography>메뉴 로딩 중...</Typography>
          </Box>
        </Drawer>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ position: 'relative' }}>
        <Drawer
          variant="permanent"
          open={true}
          sx={{
            width: effectiveWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              ...drawerPaperSx,
            }
          }}
        >
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography color="error">{error}</Typography>
          </Box>
        </Drawer>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: 'relative',
        width:
          effectiveWidth +
          ((iconOnly || autoCollapseEnabled) && (iconOnly || isCollapsed) && !peekOpen ? 12 : 0),
        flexShrink: 0,
        transition: isResizing
          ? 'none'
          : `width ${SIDEBAR_WIDTH_TRANSITION_MS}ms ${SIDEBAR_WIDTH_EASING}`,
      }}
      onMouseEnter={iconOnly || autoCollapseEnabled ? handleSidebarMouseEnter : undefined}
      onMouseLeave={iconOnly || autoCollapseEnabled ? handleSidebarMouseLeave : undefined}
    >
      <Drawer
        variant="permanent"
        open={true}
        sx={{
          width: effectiveWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': drawerPaperSx,
        }}
      >
        {drawerBody}
      </Drawer>
      {/* 리사이즈 핸들 */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          position: 'fixed',
          top: `${SIDEBAR_TOP_PX}px`,
          left: effectiveWidth - 4,
          width: '8px',
          height: SIDEBAR_HEIGHT_CALC,
          cursor: isCompact ? 'default' : 'col-resize',
          zIndex: 1201,
          backgroundColor: 'transparent',
          transition: isResizing
            ? 'none'
            : `left ${SIDEBAR_WIDTH_TRANSITION_MS}ms ${SIDEBAR_WIDTH_EASING}`,
          '&:hover': {
            backgroundColor: isCompact ? 'transparent' : 'rgba(0, 0, 0, 0.05)',
            '&::after': {
              content: '""',
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '2px',
              height: '40px',
              backgroundColor: 'primary.main',
              borderRadius: '1px',
            }
          },
          ...(isResizing && {
            backgroundColor: 'rgba(10, 110, 125, 0.1)',
            '&::after': {
              content: '""',
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '2px',
              height: '40px',
              backgroundColor: 'primary.main',
              borderRadius: '1px',
            }
          })
        }}
      />
    </Box>
  );
};

export default Sidebar;