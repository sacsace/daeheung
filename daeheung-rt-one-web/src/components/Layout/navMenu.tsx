import React from 'react';
import {
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
  AssignmentInd,
  Download,
  Schedule,
  BeachAccess,
  Payments,
  Campaign,
  Assignment,
  ListAlt,
  Policy,
  FolderSpecial,
} from '@mui/icons-material';
import type { Menu } from '../../services/menuService';
import { isRemovedNavMenuRoute } from '../../utils/isRemovedNavMenuRoute';

export const normalizeMenuPath = (path: string) => {
  const [pathname] = String(path || '').trim().split(/[?#]/);
  if (!pathname) return '';
  if (pathname === '/') return '/';
  return pathname.replace(/\/+$/, '');
};

export const isMenuRouteActive = (currentPath: string, route?: string) => {
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

  return Array.from(routeCandidates).some(
    (candidate) =>
      !!candidate &&
      (normalizedCurrentPath === candidate || normalizedCurrentPath.startsWith(`${candidate}/`))
  );
};

/** 공지·AI·레거시 보고서·시스템관리는 헤더의 별도 진입점으로만 노출 */
export const filterNavMenus = (menus: Menu[], language: string): Menu[] => {
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
    return /^analysis$/i.test(String(m.name_en || '').trim());
  };

  const isSystemManagement = (m: Menu) => {
    const label = language === 'ko' ? m.name_ko : m.name_en;
    return label === '시스템관리' || label === 'System Management';
  };

  const filterRec = (items: Menu[]): Menu[] =>
    items
      .filter(
        (x) =>
          !isNoticeMenu(x) &&
          !isAiMenu(x) &&
          !isLegacyReportsRoot(x) &&
          !isRemovedNavMenuRoute(x.route)
      )
      .map((x) => {
        if (x.children?.length) {
          const children = filterRec(x.children);
          return children.length ? { ...x, children } : null;
        }
        return x;
      })
      .filter((x): x is Menu => x != null);

  return filterRec(menus || []).filter((m) => !isSystemManagement(m));
};

export const getMenuLabel = (menu: Menu, language: string) => {
  if (language === 'ko' && menu.name_ko === '지출보고서') return '지출결의서';
  return language === 'ko'
    ? menu.name_ko
    : String(menu.name_en ?? '').trim() || menu.name_ko;
};

/** 메뉴 트리 전체의 route 목록 */
export const collectMenuRoutes = (menus: Menu[]): string[] => {
  const out: string[] = [];
  const walk = (items: Menu[]) => {
    for (const m of items) {
      if (m.route) out.push(String(m.route));
      if (m.children?.length) walk(m.children);
    }
  };
  walk(menus || []);
  return out;
};

/** 현재 경로에 가장 길게 일치하는 메뉴 route — 형제 메뉴 중복 활성화 방지 */
export const getBestMatchingRoute = (routes: string[], currentPath: string): string | null => {
  if (!normalizeMenuPath(currentPath)) return null;
  const matches = routes
    .map((r) => normalizeMenuPath(r))
    .filter((r) => r && isMenuRouteActive(currentPath, r));
  if (matches.length === 0) return null;
  return matches.reduce((a, b) => (a.length >= b.length ? a : b));
};

/** 현재 경로에 가장 잘 맞는 리프 메뉴 */
export const findBestMatchingMenu = (menus: Menu[], currentPath: string): Menu | null => {
  const best = getBestMatchingRoute(collectMenuRoutes(menus), currentPath);
  if (!best) return null;
  let found: Menu | null = null;
  const walk = (items: Menu[]) => {
    for (const m of items) {
      if (normalizeMenuPath(m.route || '') === best) {
        found = m;
        return;
      }
      if (m.children?.length) walk(m.children);
      if (found) return;
    }
  };
  walk(menus || []);
  return found;
};

/** 상위 메뉴 트리에서 현재 경로에 해당하는 활성 하위 메뉴 (상위 자신 제외) */
export const findActiveChildInBranch = (menu: Menu, currentPath: string): Menu | null => {
  const best = getBestMatchingRoute(collectMenuRoutes([menu]), currentPath);
  if (!best) return null;
  if (normalizeMenuPath(menu.route || '') === best) return null;
  let found: Menu | null = null;
  const walk = (items: Menu[]) => {
    for (const m of items) {
      if (normalizeMenuPath(m.route || '') === best) {
        found = m;
        return;
      }
      if (m.children?.length) walk(m.children);
      if (found) return;
    }
  };
  walk(menu.children || []);
  return found;
};

/** 메뉴 트리에 특정 route가 포함되는지 (정확 일치) */
export const menuContainsExactRoute = (menu: Menu, route: string | null | undefined): boolean => {
  const target = normalizeMenuPath(route || '');
  if (!target) return false;
  if (normalizeMenuPath(menu.route || '') === target) return true;
  return (menu.children || []).some((child) => menuContainsExactRoute(child, target));
};

/**
 * 현재 경로가 이 메뉴 분기에 속하는지.
 * allMenus를 넘기면 전역에서 가장 긴(구체적) 매칭 route만 기준으로 판정 —
 * `/accounting` 부모가 `/accounting/expense`(매입/매출 하위)를 가로채지 않음.
 */
export const isMenuBranchActive = (
  menu: Menu,
  currentPath: string,
  allMenus?: Menu[]
): boolean => {
  if (allMenus && allMenus.length > 0) {
    const best = getBestMatchingRoute(collectMenuRoutes(allMenus), currentPath);
    return menuContainsExactRoute(menu, best);
  }
  const bestInBranch = getBestMatchingRoute(collectMenuRoutes([menu]), currentPath);
  return menuContainsExactRoute(menu, bestInBranch);
};

/** route가 없는 상위 메뉴 클릭 시 이동할 첫 하위 경로 */
export const findFirstRoute = (menu: Menu): string | undefined => {
  if (menu.route) return menu.route;
  for (const child of menu.children || []) {
    const route = findFirstRoute(child);
    if (route) return route;
  }
  return undefined;
};

const ICON_BY_NAME: Record<string, React.ReactElement> = {
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
  list_alt: <ListAlt />,
  category: <Category />,
  view_kanban: <ViewKanban />,
  folder_special: <FolderSpecial />,
  move_to_inbox: <MoveToInbox />,
  post_add: <PostAdd />,
  qr_code_scanner: <QrCodeScanner />,
  download: <Download />,
};

const getIconByRoute = (route: string): React.ReactElement | null => {
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
  if (normalized.includes('/work/assignee-list')) return <AssignmentInd />;
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
  if (normalized.includes('/my/company-policies')) return <Policy />;
  if (normalized.includes('/my/mail-settings')) return <Settings />;
  if (normalized === '/my' || normalized.startsWith('/my/')) return <Person />;
  if (normalized.includes('/communication/desktop-notifier')) return <Download />;
  if (normalized.includes('/communication/email')) return <Chat />;
  if (normalized.includes('/communication/sms')) return <Notifications />;

  if (normalized.includes('/ai/')) return <Psychology />;
  if (normalized.includes('/reports/')) return <Assessment />;

  if (normalized.startsWith('/basic-info')) return <Settings />;
  if (normalized.startsWith('/hr')) return <People />;
  if (normalized.startsWith('/work')) return <ViewKanban />;
  if (normalized.startsWith('/hotel')) return <Dashboard />;
  if (normalized.startsWith('/inventory')) return <Inventory />;
  if (normalized.startsWith('/production')) return <Inventory />;
  if (normalized.startsWith('/sales')) return <TrendingUp />;
  if (normalized.startsWith('/accounting')) return <AccountBalance />;
  if (normalized.startsWith('/customers')) return <TrendingUp />;
  if (normalized.startsWith('/communication')) return <Notifications />;
  if (normalized.startsWith('/ai')) return <Psychology />;
  if (normalized.startsWith('/reports')) return <Assessment />;
  return null;
};

export const getMenuIcon = (menu: Menu): React.ReactElement => {
  const routeIcon = getIconByRoute(String(menu.route || ''));
  if (routeIcon) return routeIcon;

  const ko = String(menu.name_ko || '');
  const en = String(menu.name_en || '').toLowerCase();
  if (ko.includes('내 정보') || en.includes('my info')) return <Person />;
  if (ko.includes('기초') || en.includes('basic')) return <Settings />;
  if (ko.includes('인사') || en.includes('hr')) return <People />;
  if (ko.includes('업무') || en.includes('work')) return <ViewKanban />;
  if (ko.includes('호텔') || ko.includes('기숙사') || en.includes('hotel') || en.includes('dormitory')) return <Dashboard />;
  if (ko.includes('회사') || en.includes('company')) return <AccountBalance />;
  if (ko.includes('파트너') || ko.includes('고객') || en.includes('partner') || en.includes('customer')) return <People />;
  if (ko.includes('재고') || en.includes('inventory')) return <Inventory />;
  if (ko.includes('결재') || en.includes('approval')) return <Description />;
  if (ko.includes('매출') || ko.includes('통계') || en.includes('sales') || en.includes('statistics')) return <TrendingUp />;
  if (ko.includes('회계') || en.includes('accounting')) return <AttachMoney />;
  if (ko.includes('커뮤니케이션') || en.includes('communication')) return <Notifications />;
  if (ko.includes('리포트') || en.includes('report')) return <Assessment />;
  if (ko.includes('설정') || en.includes('setting')) return <Settings />;
  if (ko.includes('공지') || en.includes('notice')) return <Campaign />;
  if (ko.includes('출퇴근') || en.includes('attendance')) return <Schedule />;
  if (ko.includes('휴가') || en.includes('leave') || en.includes('vacation')) return <BeachAccess />;
  if (ko.includes('급여') || en.includes('payslip') || en.includes('payroll')) return <Payments />;

  const iconKey = String(menu.icon || '').trim();
  return ICON_BY_NAME[iconKey] || ICON_BY_NAME[iconKey.toLowerCase()] || <MenuIcon />;
};
