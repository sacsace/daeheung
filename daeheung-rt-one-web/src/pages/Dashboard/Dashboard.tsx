import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  Tabs,
  Tab,
  Button,
  Tooltip,
  Alert,
  Checkbox,
  FormControlLabel,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Radio,
  RadioGroup,
  LinearProgress,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';
import {
  Dashboard as DashboardIcon,
  TrendingUp,
  TrendingDown,
  Inventory,
  People,
  Receipt,
  Assessment,
  Notifications,
  Refresh,
  Settings as SettingsIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminPanelSettingsIcon,
  ArrowForward as ArrowForwardIcon,
  Announcement as AnnouncementIcon,
  CalendarToday as CalendarTodayIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Assignment as AssignmentIcon,
  Work as WorkIcon,
  Warning as WarningIcon,
  Pending as PendingIcon,
  Business as BusinessIcon,
  FolderSpecial as FolderSpecialIcon,
  AttachFile as AttachFileIcon,
  Login as CheckInIcon,
  Logout as CheckOutIcon,
  StarBorder as StarBorderIcon,
  Security as SecurityIcon,
  ReceiptLong as ReceiptLongIcon,
  AccountBalanceWallet as AccountBalanceWalletIcon,
} from '@mui/icons-material';
import { Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useStore, useMenuStore } from '../../store';
import {
  api,
  noticeService,
  approvalService,
  vacationService,
  projectService,
  userUiPreferencesService,
  departmentService,
  companyCalendarScheduleService,
  accountingService,
} from '../../services/api';
import type {
  CompanyCalendarScheduleItem,
  PublicPersonalCalendarScheduleItem
} from '../../services/api';
import { showErrorPopup } from '../../utils/errorHandler';
import { isRemovedNavMenuRoute } from '../../utils/isRemovedNavMenuRoute';
import { useTranslation } from 'react-i18next';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import {
  mvsBodyCardSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPrimaryBtnSx,
  mvsBodySectionHeaderSx,
  mvsDashboardWidgetCardSx,
  mvsDashboardWidgetGroupSx,
  mvsKpiCardSx,
  mvsPageRootSx } from '../../theme/daeheungLayout';
import DepartmentLeaveCalendar, { CALENDAR_DEPARTMENT_ALL_VALUE } from '../HR/DepartmentLeaveCalendar';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 0.5, pb: 1.2, px: 0 }}>{children}</Box>}
    </div>
  );
}

const defaultSalesData = [
  { name: '1월', sales: 0, profit: 0 },
  { name: '2월', sales: 0, profit: 0 },
  { name: '3월', sales: 0, profit: 0 },
  { name: '4월', sales: 0, profit: 0 },
  { name: '5월', sales: 0, profit: 0 },
  { name: '6월', sales: 0, profit: 0 },
];

type QuickActionColor = 'primary' | 'success' | 'warning' | 'info' | 'error' | 'secondary';
type QuickActionRequiredAction = 'view' | 'create' | 'edit' | 'delete';

interface QuickActionConfig {
  route: string;
  title: string;
  description: string;
  icon: React.ReactElement;
  color: QuickActionColor;
  requiredAction: QuickActionRequiredAction;
}

interface CalendarScheduleItem {
  id: string;
  title: string;
  type: 'normal' | 'company_holiday';
  isPublic?: boolean;
}

const CompanyHolidayStarIcon: React.FC<{ color: string }> = ({ color }) => (
  <StarBorderIcon sx={{ fontSize: '0.8rem', color }} />
);

const QUICK_ACTION_MAX_COUNT = 8;
const DEFAULT_QUICK_ACTION_ROUTES = [
  '/accounting/e-invoice',
  '/basic-info/partners',
  '/inventory',
  '/reports'
];
const DASHBOARD_CARD_DEFAULT_IDS = [
  'approval',
  'projects',
  'lowStock',
  'recentTransactions',
  'calendar',
  'vacationCalendar',
  'notice',
  'expenseReceived',
  'expenseTransfer',
] as const;

/** 일반 직원(user): 재고·거래·전자결재 등 비관련 카드 제외 */
const GENERAL_USER_HIDDEN_CARD_IDS = ['approval', 'lowStock', 'recentTransactions'] as const;

const GENERAL_USER_DEFAULT_CARD_IDS = [
  'projects',
  'calendar',
  'vacationCalendar',
  'notice',
  'expenseReceived',
] as const;

type DashboardCardAccessOpts = {
  isPaymentOfficer?: boolean;
};

const isGeneralEmployeeRole = (role?: string | null) => role === 'user';

const hasExpenseTransferCardAccess = (
  role?: string | null,
  opts?: DashboardCardAccessOpts
) => Boolean(opts?.isPaymentOfficer) || role === 'root';

const getAllowedDashboardCardIds = (
  role?: string | null,
  opts?: DashboardCardAccessOpts
): string[] => {
  let ids: string[] = isGeneralEmployeeRole(role)
    ? DASHBOARD_CARD_DEFAULT_IDS.filter(
        (id) => !(GENERAL_USER_HIDDEN_CARD_IDS as readonly string[]).includes(id)
      )
    : [...DASHBOARD_CARD_DEFAULT_IDS];
  if (!hasExpenseTransferCardAccess(role, opts)) {
    ids = ids.filter((id) => id !== 'expenseTransfer');
  }
  return ids;
};

const getDefaultDashboardCardIds = (
  role?: string | null,
  opts?: DashboardCardAccessOpts
): string[] => {
  const allowed = new Set(getAllowedDashboardCardIds(role, opts));
  if (isGeneralEmployeeRole(role)) {
    return GENERAL_USER_DEFAULT_CARD_IDS.filter((id) => allowed.has(id));
  }
  return DASHBOARD_CARD_DEFAULT_IDS.filter((id) => allowed.has(id));
};

const sanitizeDashboardCardIds = (
  ids: unknown,
  role?: string | null,
  opts?: DashboardCardAccessOpts
): string[] => {
  const allowed = new Set(getAllowedDashboardCardIds(role, opts));
  const defaults = getDefaultDashboardCardIds(role, opts);
  if (!Array.isArray(ids) || ids.length === 0) return defaults;
  const sanitized = ids
    .filter((id): id is string => typeof id === 'string')
    .filter((id) => allowed.has(id));
  return sanitized.length > 0 ? sanitized : defaults;
};

const floorDashboardMoney = (value: number): number => Math.floor(Number(value) || 0);

const expenseAttachmentHasTaxInvoice = (attachments: unknown): boolean => {
  if (!Array.isArray(attachments)) return false;
  return attachments.some((item) => {
    if (typeof item === 'string') return true;
    if (!item || typeof item !== 'object') return false;
    const row = item as { invoiceType?: string; invoice_type?: string };
    const type = String(row.invoiceType ?? row.invoice_type ?? 'tax').toLowerCase();
    return type === 'tax';
  });
};

const expenseIsPrepaidRaw = (expense: any): boolean => {
  const meta =
    expense?.itemMeta ||
    (() => {
      try {
        const items = typeof expense?.items === 'string' ? JSON.parse(expense.items) : expense?.items;
        return items && typeof items === 'object' && !Array.isArray(items) ? items.meta : null;
      } catch {
        return null;
      }
    })();
  if (!meta || typeof meta !== 'object') return false;
  const v = (meta as any).isPrepaid ?? (meta as any).is_prepaid;
  return v === true || v === 'true' || v === 1 || v === '1';
};

const expenseIsAwaitingTaxInvoiceRaw = (expense: any): boolean => {
  if (expenseIsPrepaidRaw(expense)) return false;
  const total = Number(expense.total_amount ?? expense.totalAmount ?? 0);
  const paid = Number(expense.paid_amount ?? expense.paidAmount ?? 0);
  const remaining = Math.max(0, total - paid);
  if (remaining > 0 || paid <= 0) return false;
  if (String(expense.payment_request_status || expense.paymentRequestStatus || '').toLowerCase() === 'paid') {
    return false;
  }
  if (expense.status === 'paid') return false;
  return !expenseAttachmentHasTaxInvoice(expense.attachments);
};

const getExpenseTransferFilterKey = (expense: any): string => {
  if (expenseIsPrepaidRaw(expense)) return 'transfer_completed';
  const total = floorDashboardMoney(Number(expense.total_amount ?? expense.totalAmount ?? 0));
  const paid = floorDashboardMoney(Number(expense.paid_amount ?? expense.paidAmount ?? 0));
  const remaining = Math.max(0, total - paid);
  if (String(expense.bank_transfer_status || expense.bankTransferStatus || '').toLowerCase() === 'failed') {
    return 'transfer_failed';
  }
  if (expenseIsAwaitingTaxInvoiceRaw(expense)) return 'awaiting_tax';
  if (
    remaining <= 0 ||
    String(expense.payment_request_status || expense.paymentRequestStatus || '').toLowerCase() === 'paid' ||
    expense.status === 'paid'
  ) {
    return 'transfer_completed';
  }
  if (paid > 0) return 'transfer_partial';
  return 'transfer_pending';
};

const isExpensePaidForDashboard = (expense: any): boolean => {
  if (expenseIsAwaitingTaxInvoiceRaw(expense)) return false;
  const total = floorDashboardMoney(Number(expense.total_amount ?? expense.totalAmount ?? 0));
  const paid = floorDashboardMoney(Number(expense.paid_amount ?? expense.paidAmount ?? 0));
  const remaining = Math.max(0, total - paid);
  const paymentPaid =
    String(expense.payment_request_status || expense.paymentRequestStatus || '').toLowerCase() === 'paid';
  return (
    paymentPaid ||
    expense.status === 'paid' ||
    (paid > 0 && remaining <= 0 && ['approved', 'paid'].includes(String(expense.status || '')))
  );
};

const isExpenseReceivedForUser = (expense: any, userId: number): boolean => {
  if (expense.status === 'draft') return false;
  if (Number(expense.current_approver_id ?? expense.currentApproverId) === userId) return true;
  const meta = expense.itemMeta || (() => {
    try {
      const items = typeof expense.items === 'string' ? JSON.parse(expense.items) : expense.items;
      return items && typeof items === 'object' && !Array.isArray(items) ? items.meta : null;
    } catch {
      return null;
    }
  })();
  if (meta?.checkedById && Number(meta.checkedById) === userId) return true;
  if (meta?.approvedById && Number(meta.approvedById) === userId) return true;
  const ccIds = Array.isArray(expense.cc_user_ids)
    ? expense.cc_user_ids
    : Array.isArray(expense.ccUserIds)
      ? expense.ccUserIds
      : [];
  if (ccIds.some((id: any) => Number(id) === userId)) return true;
  const flow = Array.isArray(expense.approval_flow)
    ? expense.approval_flow
    : Array.isArray(expense.approvalFlow)
      ? expense.approvalFlow
      : [];
  return flow.some((step: any) => Number(step.approverId ?? step.approver_id) === userId);
};

const DASHBOARD_CARD_PAD = 2.5;
const DASHBOARD_CARD_SPACING = 1.5;

type DashboardCardTitleAccent = 'primary' | 'error';

const dashboardCardTitleBar = (
  accent: DashboardCardTitleAccent,
  opts?: { noFlex?: boolean }
): SxProps<Theme> => (theme) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  ...(opts?.noFlex ? { flex: 'none' as const } : { flex: 1, minWidth: 0 }),
  px: 1.5,
  py: 1,
  borderRadius: '8px',
  border: 'none',
  bgcolor: alpha(theme.palette[accent].main, 0.06) });

const DASHBOARD_CARD_TITLE_TYPO: SxProps<Theme> = {
  fontWeight: 600,
  fontSize: '14px',
  lineHeight: 1.4,
  color: '#0F172A',
  letterSpacing: '-0.01em'
};

const DASHBOARD_WIDGET_CARD_BASE_SX: SxProps<Theme> = {
  ...(mvsDashboardWidgetCardSx as object),
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'box-shadow 0.2s ease',
  '&:hover': {
    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)' } };

const dashboardWidgetCardSx = (
  order: number,
  extra?: SxProps<Theme>
): SxProps<Theme> => ({
  ...DASHBOARD_WIDGET_CARD_BASE_SX,
  order,
  ...(extra && typeof extra !== 'function' ? extra : {}) });

const Dashboard: React.FC = () => {
  const theme = useTheme();
  const { user } = useStore();
  const { menus, hasMenuPermission, language } = useMenuStore();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const skipUiPrefsPersistRef = useRef(true);
  const [uiPrefsReady, setUiPrefsReady] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [stats, setStats] = useState({
    totalSales: 0,
    totalCustomers: 0,
    totalInvoices: 0,
    totalInventory: 0,
    totalEmployees: 0,
    totalProjects: 0,
    pendingApprovals: 0,
    pendingVacations: 0
  });

  // 기본 데이터 초기화 (컴포넌트 내부에서 t() 함수 사용 가능)
  const getDefaultInventoryData = () => [
    { name: t('dashboard.inventoryLow'), value: 0, color: '#ff6b6b' },
    { name: t('dashboard.inventoryNormal'), value: 0, color: '#4ecdc4' },
    { name: t('dashboard.inventoryHigh'), value: 0, color: '#ffe66d' },
  ];

  const [, setSalesData] = useState(defaultSalesData);
  const [inventoryData, setInventoryData] = useState(getDefaultInventoryData());
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
  });
  const [, setPendingVacations] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  

  const [myReceivedApprovals, setMyReceivedApprovals] = useState<any[]>([]);
  const [myRequestedApprovals, setMyRequestedApprovals] = useState<any[]>([]);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [receivedExpenses, setReceivedExpenses] = useState<any[]>([]);
  const [transferExpenses, setTransferExpenses] = useState<any[]>([]);
  const [noticeDialogOpen, setNoticeDialogOpen] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<any | null>(null);
  const [noticeDetailLoading, setNoticeDetailLoading] = useState(false);
  const [selectedPollOptionId, setSelectedPollOptionId] = useState<number | null>(null);
  const [pollVoting, setPollVoting] = useState(false);
  const [noticePollMessage, setNoticePollMessage] = useState('');
  const [noticePollError, setNoticePollError] = useState('');
  

  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkOutLoading, setCheckOutLoading] = useState(false);
  const [attendanceMessage, setAttendanceMessage] = useState<string | null>(null);
  const [attendanceSeverity, setAttendanceSeverity] = useState<'success' | 'error' | 'info' | 'warning'>('success');
  const [attendanceSnackbarOpen, setAttendanceSnackbarOpen] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [quickActionDialogOpen, setQuickActionDialogOpen] = useState(false);
  const [selectedQuickActionRoutes, setSelectedQuickActionRoutes] = useState<string[]>([]);
  const [quickActionSearchTerm, setQuickActionSearchTerm] = useState('');
  const [dashboardCardDialogOpen, setDashboardCardDialogOpen] = useState(false);
  const dashboardCardAccessOpts = useMemo<DashboardCardAccessOpts>(
    () => ({ isPaymentOfficer: Boolean(user?.is_payment_officer) }),
    [user?.is_payment_officer]
  );

  const [selectedDashboardCards, setSelectedDashboardCards] = useState<string[]>(() =>
    getDefaultDashboardCardIds(undefined)
  );
  const [dashboardCardSearchTerm, setDashboardCardSearchTerm] = useState('');
  const [draggingDashboardCardId, setDraggingDashboardCardId] = useState<string | null>(null);
  const [customCalendarSchedules, setCustomCalendarSchedules] = useState<Record<string, CalendarScheduleItem[]>>({});
  const [companyCalendarSchedules, setCompanyCalendarSchedules] = useState<CompanyCalendarScheduleItem[]>([]);
  const [publicPersonalSchedules, setPublicPersonalSchedules] = useState<PublicPersonalCalendarScheduleItem[]>([]);
  const [dashboardLeaveMonth, setDashboardLeaveMonth] = useState(() => new Date());
  const [dashboardLeaveRaw, setDashboardLeaveRaw] = useState<any[]>([]);
  const [dashboardHrDepartmentNames, setDashboardHrDepartmentNames] = useState<string[]>([]);
  const [dashboardLeaveDept, setDashboardLeaveDept] = useState<string>('');
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleDialogDate, setScheduleDialogDate] = useState<Date | null>(null);
  const [newScheduleTitle, setNewScheduleTitle] = useState('');
  const [scheduleIsPublic, setScheduleIsPublic] = useState(false);

  // 사용자 권한에 따른 탭 필터링
  const isRoot = user?.role === 'root';
  const isAdmin = user?.role === 'admin';
  const canViewAdminDashboard = isRoot || isAdmin;

  // 사용 가능한 탭 목록
  const availableTabs = useMemo(
    () =>
      [
        { index: 0, label: t('dashboard.personal'), icon: PersonIcon, available: true },
        { index: 2, label: t('dashboard.admin'), icon: AdminPanelSettingsIcon, available: canViewAdminDashboard }
      ].filter(tab => tab.available),
    [t, canViewAdminDashboard]
  );

  // 실제 탭 인덱스를 사용 가능한 탭 인덱스로 매핑
  const getTabIndex = (displayIndex: number) => {
    return availableTabs[displayIndex]?.index ?? 0;
  };

  const getDisplayIndex = (actualIndex: number) => {
    const found = availableTabs.findIndex(tab => tab.index === actualIndex);
    return found >= 0 ? found : 0;
  };

  // 경로로 메뉴 찾기 함수
  const findMenuByRoute = (route: string): number | null => {
    const findMenu = (menuList: any[]): any | null => {
      for (const menu of menuList) {
        if (menu.route === route || menu.route === route.replace(/^\//, '')) {
          return menu;
        }
        if (menu.children) {
          const found = findMenu(menu.children);
          if (found) return found;
        }
      }
      return null;
    };
    const menu = findMenu(menus);
    return menu ? menu.id : null;
  };

  // 메뉴 권한 체크 및 네비게이션 함수
  const handleNavigationWithPermission = (route: string, requiredAction: 'view' | 'create' | 'edit' | 'delete' = 'view') => {
    // root나 admin은 모든 메뉴 접근 가능
    if (isRoot || isAdmin) {
      navigate(route);
      return;
    }

    const menuId = findMenuByRoute(route);
    if (menuId && hasMenuPermission(menuId, requiredAction)) {
      navigate(route);
    } else {
      // 권한이 없으면 에러 팝업 표시
      showErrorPopup(t('dashboard.accessDenied'), t('dashboard.accessDeniedTitle'));
    }
  };

  const getQuickActionIconByRoute = (route: string) => {
    if (route.includes('/invoice') || route.includes('/proforma') || route.includes('/quotation')) return <Receipt />;
    if (route.includes('/partner') || route.includes('/customer') || route.includes('/users') || route.includes('/hr')) return <People />;
    if (route.includes('/inventory')) return <Inventory />;
    if (route.includes('/report') || route.includes('/statistics')) return <Assessment />;
    if (route.includes('/approval')) return <AssignmentIcon />;
    if (route.includes('/vacation') || route.includes('/leave')) return <WorkIcon />;
    if (route.includes('/project') || route.includes('/work')) return <FolderSpecialIcon />;
    if (route.includes('/company') || route.includes('/organization')) return <BusinessIcon />;
    if (route.includes('/attendance') || route.includes('/meeting')) return <CalendarTodayIcon />;
    if (route.includes('/system') || route.includes('/settings') || route.includes('/menu-permissions')) return <SecurityIcon />;
    return <DashboardIcon />;
  };

  const getQuickActionColorByRoute = (route: string): QuickActionColor => {
    if (route.includes('/invoice') || route.includes('/proforma') || route.includes('/quotation')) return 'primary';
    if (route.includes('/partner') || route.includes('/customer') || route.includes('/users')) return 'success';
    if (route.includes('/inventory')) return 'warning';
    if (route.includes('/report') || route.includes('/statistics')) return 'info';
    if (route.includes('/approval')) return 'error';
    if (route.includes('/work') || route.includes('/project')) return 'secondary';
    return 'primary';
  };

  const getQuickActionRequiredAction = (route: string): QuickActionRequiredAction => {
    // 빠른 액션은 "메뉴 접근 권한(조회)" 기준으로만 노출/선택
    return 'view';
  };

  const flattenMenus = (menuList: any[]): any[] => {
    const result: any[] = [];
    const walk = (items: any[]) => {
      items.forEach((menu) => {
        result.push(menu);
        if (menu.children && menu.children.length > 0) {
          walk(menu.children);
        }
      });
    };
    walk(menuList);
    return result;
  };

  const quickActionCandidates = useMemo<QuickActionConfig[]>(() => {
    const flattenedMenus = flattenMenus(menus || []);
    const routeMap = new Map<string, QuickActionConfig>();
    const normalizeKoMenuName = (menu: any, rawTitle: string): string => {
      if (rawTitle === '지출보고서') return '지출 결의서';
      if (language === 'ko' && String(menu.route || '') === '/accounting/expense') return '지출 결의서';
      return rawTitle;
    };

    flattenedMenus.forEach((menu) => {
      const route = String(menu.route || '').trim();
      if (!route || !route.startsWith('/') || route === '/dashboard' || route === '/login') return;
      if (isRemovedNavMenuRoute(route)) return;

      const hasChildren = Array.isArray(menu.children) && menu.children.length > 0;
      if (hasChildren) return;

      const canView = isRoot || isAdmin || hasMenuPermission(menu.id, 'view');
      if (!canView) return;

      if (!routeMap.has(route)) {
        const baseTitle = language === 'en' ? (menu.name_en || menu.name || route) : (menu.name_ko || menu.name || route);
        const title = language === 'ko' ? normalizeKoMenuName(menu, baseTitle) : baseTitle;
        const description = language === 'en'
          ? `${title} menu shortcut`
          : `${title} 메뉴 바로가기`;
        routeMap.set(route, {
          route,
          title,
          description,
          icon: getQuickActionIconByRoute(route),
          color: getQuickActionColorByRoute(route),
          requiredAction: getQuickActionRequiredAction(route)
        });
      }
    });

    return Array.from(routeMap.values());
  }, [menus, language, isRoot, isAdmin, hasMenuPermission]);

  const quickActionRouteSet = useMemo(
    () => new Set(quickActionCandidates.map((item) => item.route)),
    [quickActionCandidates]
  );

  const selectedQuickActions = useMemo(() => {
    const configByRoute = new Map(quickActionCandidates.map((item) => [item.route, item]));
    return selectedQuickActionRoutes
      .map((route) => configByRoute.get(route))
      .filter((item): item is QuickActionConfig => !!item);
  }, [quickActionCandidates, selectedQuickActionRoutes]);

  const filteredQuickActionCandidates = useMemo(() => {
    const keyword = quickActionSearchTerm.trim().toLowerCase();
    if (!keyword) return quickActionCandidates;
    return quickActionCandidates.filter((menu) =>
      menu.title.toLowerCase().includes(keyword) ||
      menu.route.toLowerCase().includes(keyword) ||
      menu.description.toLowerCase().includes(keyword)
    );
  }, [quickActionCandidates, quickActionSearchTerm]);

  const dashboardCardOptions = useMemo(() => {
    const all = [
      { id: 'approval', label: language === 'en' ? 'Electronic Approval' : '전자결재' },
      { id: 'projects', label: language === 'en' ? 'My Assigned Work' : '내 담당 업무' },
      { id: 'lowStock', label: language === 'en' ? 'Low Stock Alerts' : '재고 부족 알림' },
      { id: 'recentTransactions', label: language === 'en' ? 'Recent Transactions' : '최근 거래' },
      { id: 'calendar', label: language === 'en' ? 'Weekly Schedule' : '주간 스케줄' },
      { id: 'vacationCalendar', label: language === 'en' ? 'Leave calendar' : '휴가 달력' },
      { id: 'notice', label: language === 'en' ? 'Notices' : '공지사항' },
      {
        id: 'expenseReceived',
        label: language === 'en' ? 'Received Expense Approvals' : '지출결의서 받은거',
      },
      {
        id: 'expenseTransfer',
        label: language === 'en' ? 'Remittance List' : '송금할 리스트',
      },
    ];
    const allowed = new Set(getAllowedDashboardCardIds(user?.role, dashboardCardAccessOpts));
    return all.filter((card) => allowed.has(card.id));
  }, [language, user?.role, dashboardCardAccessOpts]);

  const visibleDashboardCards = useMemo(
    () => sanitizeDashboardCardIds(selectedDashboardCards, user?.role, dashboardCardAccessOpts),
    [selectedDashboardCards, user?.role, dashboardCardAccessOpts]
  );

  const dashboardLeaveMapped = useMemo(() => {
    return dashboardLeaveRaw.map((v: any) => ({
      id: v.id,
      employeeName: v.user?.username || '—',
      department: (v.user?.department || '').trim() || '-',
      vacationType: v.vacation_type,
      startDate: v.start_date,
      endDate: v.end_date,
      status: v.status as 'pending' | 'approved' | 'rejected' | 'cancelled',
      days: Number(v.days) || 0 }));
  }, [dashboardLeaveRaw]);

  const dashboardLeaveDeptOptions = useMemo(() => {
    if (!(user?.role === 'admin' || user?.role === 'root')) return [];
    return [...dashboardHrDepartmentNames];
  }, [dashboardHrDepartmentNames, user?.role]);

  useEffect(() => {
    if (!(user?.role === 'admin' || user?.role === 'root')) {
      setDashboardHrDepartmentNames([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await departmentService.list(false);
        if (cancelled) return;
        const rows = res?.success && Array.isArray(res.data) ? res.data : [];
        const names = rows
          .map((d: { name?: string }) => String(d?.name ?? '').trim())
          .filter(Boolean)
          .sort((a: string, b: string) => a.localeCompare(b, 'ko'));
        setDashboardHrDepartmentNames(names);
      } catch {
        if (!cancelled) setDashboardHrDepartmentNames([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role]);

  const dashboardLeaveForCalendar = useMemo(() => {
    if (user?.role === 'admin' || user?.role === 'root') {
      if (!dashboardLeaveDept) return [];
      if (dashboardLeaveDept === CALENDAR_DEPARTMENT_ALL_VALUE) return dashboardLeaveMapped;
      return dashboardLeaveMapped.filter((r) => r.department === dashboardLeaveDept);
    }
    return dashboardLeaveMapped;
  }, [dashboardLeaveMapped, dashboardLeaveDept, user?.role]);

  const dashboardLeaveCalendarItems = useMemo(
    () =>
      dashboardLeaveForCalendar.map(({ id, employeeName, vacationType, startDate, endDate, status, days }) => ({
        id,
        employeeName,
        vacationType,
        startDate,
        endDate,
        status,
        days })),
    [dashboardLeaveForCalendar]
  );

  useEffect(() => {
    if (!(user?.role === 'admin' || user?.role === 'root')) return;
    if (dashboardLeaveDeptOptions.length === 0) {
      if (dashboardLeaveMapped.length > 0) {
        setDashboardLeaveDept(CALENDAR_DEPARTMENT_ALL_VALUE);
      } else {
        setDashboardLeaveDept('');
      }
      return;
    }
    setDashboardLeaveDept((prev) => {
      if (prev === CALENDAR_DEPARTMENT_ALL_VALUE) return CALENDAR_DEPARTMENT_ALL_VALUE;
      if (prev && dashboardLeaveDeptOptions.includes(prev)) return prev;
      const u = user?.department?.trim();
      if (u && dashboardLeaveDeptOptions.includes(u)) return u;
      return dashboardLeaveDeptOptions[0];
    });
  }, [dashboardLeaveDeptOptions, dashboardLeaveMapped.length, user?.department, user?.role]);

  const filteredDashboardCardOptions = useMemo(() => {
    const keyword = dashboardCardSearchTerm.trim().toLowerCase();
    if (!keyword) return dashboardCardOptions;
    return dashboardCardOptions.filter((card) => card.label.toLowerCase().includes(keyword));
  }, [dashboardCardOptions, dashboardCardSearchTerm]);

  /** DB(users.settings.ui)에서 대시보드 UI 상태 로드 */
  useEffect(() => {
    if (!user?.id) {
      setUiPrefsReady(false);
      setCustomCalendarSchedules({});
      setSelectedDashboardCards(getDefaultDashboardCardIds(user?.role, dashboardCardAccessOpts));
      setSelectedQuickActionRoutes([]);
      return;
    }

    let cancelled = false;
    setUiPrefsReady(false);
    skipUiPrefsPersistRef.current = true;

    (async () => {
      try {
        const data = await userUiPreferencesService.get();
        if (cancelled) return;

        setSelectedDashboardCards(
          sanitizeDashboardCardIds(data.dashboardCards, user?.role, dashboardCardAccessOpts)
        );

        const rawCal = data.calendarSchedules || {};
        const sanitizedCal: Record<string, CalendarScheduleItem[]> = {};
        Object.entries(rawCal).forEach(([dateKey, value]) => {
          if (!Array.isArray(value)) return;
          const items: CalendarScheduleItem[] = value
            .filter((item: any) => item && typeof item.title === 'string')
            .map((item: any) => ({
              id: String(item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
              title: String(item.title).trim(),
              type: (item.type === 'company_holiday' ? 'company_holiday' : 'normal') as 'normal' | 'company_holiday',
              isPublic: Boolean(item.isPublic ?? item.is_public)
            }))
            .filter((item) => item.title.length > 0);
          if (items.length > 0) sanitizedCal[dateKey] = items;
        });
        setCustomCalendarSchedules(sanitizedCal);

        if (quickActionCandidates.length > 0) {
          const routeSet = new Set(quickActionCandidates.map((item) => item.route));
          const defaultRoutes = DEFAULT_QUICK_ACTION_ROUTES.filter((route) => routeSet.has(route));
          const fallbackRoutes =
            defaultRoutes.length > 0
              ? defaultRoutes
              : quickActionCandidates.slice(0, 4).map((item) => item.route);

          let initialQuick = fallbackRoutes;
          if (Array.isArray(data.quickActionRoutes) && data.quickActionRoutes.length > 0) {
            const validParsed = data.quickActionRoutes
              .filter((value: unknown) => typeof value === 'string')
              .filter((route: string) => routeSet.has(route))
              .slice(0, QUICK_ACTION_MAX_COUNT);
            if (validParsed.length > 0) initialQuick = validParsed;
          }
          setSelectedQuickActionRoutes(initialQuick);
        }

        requestAnimationFrame(() => {
          setUiPrefsReady(true);
          setTimeout(() => {
            skipUiPrefsPersistRef.current = false;
          }, 400);
        });
      } catch {
        if (!cancelled) {
          setSelectedDashboardCards(getDefaultDashboardCardIds(user?.role, dashboardCardAccessOpts));
          setCustomCalendarSchedules({});
          requestAnimationFrame(() => {
            setUiPrefsReady(true);
            setTimeout(() => {
              skipUiPrefsPersistRef.current = false;
            }, 400);
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role, quickActionCandidates, dashboardCardAccessOpts]);

  /** 메뉴 권한 로딩 후 빠른 액션 경로 보정 */
  useEffect(() => {
    if (!uiPrefsReady || quickActionCandidates.length === 0) return;

    const defaultRoutes = DEFAULT_QUICK_ACTION_ROUTES.filter((route) => quickActionRouteSet.has(route));
    const fallbackRoutes =
      defaultRoutes.length > 0 ? defaultRoutes : quickActionCandidates.slice(0, 4).map((item) => item.route);

    setSelectedQuickActionRoutes((prev) => {
      const filtered = prev.filter((route) => quickActionRouteSet.has(route)).slice(0, QUICK_ACTION_MAX_COUNT);
      if (filtered.length === 0) return fallbackRoutes;
      return filtered;
    });
  }, [uiPrefsReady, quickActionCandidates, quickActionRouteSet]);

  useEffect(() => {
    if (!uiPrefsReady || !user?.id || skipUiPrefsPersistRef.current) return;
    const t = window.setTimeout(() => {
      userUiPreferencesService.patch({ quickActionRoutes: selectedQuickActionRoutes }).catch(() => {});
    }, 500);
    return () => window.clearTimeout(t);
  }, [selectedQuickActionRoutes, uiPrefsReady, user?.id]);

  useEffect(() => {
    if (!uiPrefsReady || !user?.id || skipUiPrefsPersistRef.current) return;
    const t = window.setTimeout(() => {
      userUiPreferencesService
        .patch({
          dashboardCards: sanitizeDashboardCardIds(
            selectedDashboardCards,
            user?.role,
            dashboardCardAccessOpts
          ),
        })
        .catch(() => {});
    }, 500);
    return () => window.clearTimeout(t);
  }, [selectedDashboardCards, uiPrefsReady, user?.id, user?.role, dashboardCardAccessOpts]);

  useEffect(() => {
    if (!uiPrefsReady || !user?.id || skipUiPrefsPersistRef.current) return;
    const t = window.setTimeout(() => {
      userUiPreferencesService.patch({ calendarSchedules: customCalendarSchedules }).catch(() => {});
    }, 500);
    return () => window.clearTimeout(t);
  }, [customCalendarSchedules, uiPrefsReady, user?.id]);

  const formatDateKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const companySchedulesByDate = useMemo(() => {
    const map: Record<string, CompanyCalendarScheduleItem[]> = {};
    companyCalendarSchedules.forEach((item) => {
      const key = item.scheduleDate;
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [companyCalendarSchedules]);

  const publicPersonalSchedulesByDate = useMemo(() => {
    const map: Record<string, PublicPersonalCalendarScheduleItem[]> = {};
    publicPersonalSchedules.forEach((item) => {
      const key = item.scheduleDate;
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [publicPersonalSchedules]);

  useEffect(() => {
    if (!user?.id) {
      setCompanyCalendarSchedules([]);
      setPublicPersonalSchedules([]);
      return;
    }

    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(currentWeekStart.getDate() + 6);
    const from = formatDateKey(currentWeekStart);
    const to = formatDateKey(weekEnd);

    let cancelled = false;
    (async () => {
      try {
        const [companyRes, publicRes] = await Promise.all([
          companyCalendarScheduleService.list({ from, to }),
          companyCalendarScheduleService.listPublicPersonal({ from, to })
        ]);
        if (cancelled) return;
        setCompanyCalendarSchedules(Array.isArray(companyRes?.data) ? companyRes.data : []);
        setPublicPersonalSchedules(Array.isArray(publicRes?.data) ? publicRes.data : []);
      } catch {
        if (!cancelled) {
          setCompanyCalendarSchedules([]);
          setPublicPersonalSchedules([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, currentWeekStart]);

  const getGoodFriday = (year: number): Date => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    const easterSunday = new Date(year, month - 1, day);
    const goodFriday = new Date(easterSunday);
    goodFriday.setDate(easterSunday.getDate() - 2);
    return goodFriday;
  };

  const getIndianHolidayMap = (year: number): Record<string, string[]> => {
    const holidayMap: Record<string, string[]> = {};
    const addHoliday = (date: Date, name: string) => {
      const key = formatDateKey(date);
      holidayMap[key] = [...(holidayMap[key] || []), name];
    };
    const addYearHoliday = (targetYear: number, month: number, day: number, name: string) => {
      if (year === targetYear) addHoliday(new Date(targetYear, month, day), name);
    };

    addHoliday(new Date(year, 0, 1), 'New Year');
    addHoliday(new Date(year, 0, 26), 'Republic Day');
    addHoliday(new Date(year, 0, 14), 'Makar Sankranti');
    addHoliday(new Date(year, 4, 1), 'Labour Day');
    addHoliday(new Date(year, 7, 15), 'Independence Day');
    addHoliday(new Date(year, 9, 2), 'Gandhi Jayanti');
    addHoliday(new Date(year, 3, 14), 'Dr. Ambedkar Jayanti');
    addHoliday(new Date(year, 11, 25), 'Christmas');
    addHoliday(getGoodFriday(year), 'Good Friday');

    const pongalDates: Record<number, [number, number]> = {
      2024: [0, 15], 2025: [0, 14], 2026: [0, 14], 2027: [0, 15], 2028: [0, 15]
    };
    const diwaliDates: Record<number, [number, number]> = {
      2024: [9, 31], 2025: [9, 20], 2026: [10, 8], 2027: [9, 29], 2028: [9, 17]
    };
    if (pongalDates[year]) {
      const [month, day] = pongalDates[year];
      addHoliday(new Date(year, month, day), 'Pongal');
    }
    if (diwaliDates[year]) {
      const [month, day] = diwaliDates[year];
      addHoliday(new Date(year, month, day), 'Diwali');
    }

    addYearHoliday(2026, 2, 4, 'Holi');
    addYearHoliday(2026, 2, 21, 'Eid-ul-Fitr');
    addYearHoliday(2026, 9, 20, 'Dussehra');

    return holidayMap;
  };

  const getHolidayNames = (date: Date): string[] => {
    const holidayMap = getIndianHolidayMap(date.getFullYear());
    return holidayMap[formatDateKey(date)] || [];
  };

  const getHolidayDisplayName = (name: string): string => {
    const holidayNameMap: Record<string, { ko: string; en: string }> = {
      'New Year': { ko: '신정', en: 'New Year' },
      'Republic Day': { ko: '공화국의 날', en: 'Republic Day' },
      'Makar Sankranti': { ko: '마카르 산크란티', en: 'Makar Sankranti' },
      Pongal: { ko: '퐁갈', en: 'Pongal' },
      'Labour Day': { ko: '노동절', en: 'Labour Day' },
      'Independence Day': { ko: '독립기념일', en: 'Independence Day' },
      'Gandhi Jayanti': { ko: '간디 탄생일', en: 'Gandhi Jayanti' },
      'Dr. Ambedkar Jayanti': { ko: '암베드카르 탄생일', en: 'Dr. Ambedkar Jayanti' },
      Christmas: { ko: '크리스마스', en: 'Christmas' },
      'Good Friday': { ko: '성금요일', en: 'Good Friday' },
      Diwali: { ko: '디왈리', en: 'Diwali' },
      Holi: { ko: '홀리', en: 'Holi' },
      'Eid-ul-Fitr': { ko: '이드 알피트르', en: 'Eid-ul-Fitr' },
      Dussehra: { ko: '두세라', en: 'Dussehra' }
    };
    const mapped = holidayNameMap[name];
    if (!mapped) return name;
    return language === 'en' ? mapped.en : `${mapped.ko} (${mapped.en})`;
  };

  const getComplianceLabels = (date: Date): Array<{ id: string; label: string; color: string }> => {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const labels: string[] = [];

    if (day === 7) labels.push('TDS');
    if (day === 11) labels.push('GST-R1');
    if (day === 20) labels.push('GST-3B');
    if (day === 15) labels.push('PF');
    if (day === 15) labels.push('ESI');
    if (day === 20) labels.push('Professional Tax');
    if (day === 7) labels.push('ECB');

    if ([3, 6, 9, 12].includes(month) && day === 15) labels.push('Advance Tax');
    if ([7, 10, 1, 5].includes(month) && day === 31) labels.push('TDS Return');
    if ([4, 7, 10, 1].includes(month) && day === 13) labels.push('GST-R1 (Quarterly)');
    if ([4, 7, 10, 1].includes(month) && day === 22) labels.push('GST-3B (Quarterly)');
    if ([1, 4, 7, 10].includes(month) && day === 1) labels.push('Board Meeting');

    if (month === 9 && day === 30) labels.push('DIR-3 KYC');
    if (month === 4 && day === 30) labels.push('Professional Tax Annual Return');
    if (month === 5 && day === 30) labels.push('SFT');
    if (month === 7 && day === 20) labels.push('FLA');
    if (month === 9 && day === 30) labels.push('Audit of Financial Statement');
    if (month === 9 && day === 30) labels.push('ITR');
    if (month === 10 && day === 30) labels.push('ROC AOC-4/MGT-7');
    if (month === 11 && day === 30) labels.push('Transfer Pricing Audit Report');
    if (month === 12 && day === 31) labels.push('GST-9/GST Audit');

    return labels.map((label) => ({
      id: `compliance-${month}-${day}-${label}`,
      label,
      color: 'info.main'
    }));
  };

  const openScheduleDialog = (date: Date) => {
    setScheduleDialogDate(date);
    setNewScheduleTitle('');
    setScheduleIsPublic(false);
    setScheduleDialogOpen(true);
  };

  const closeScheduleDialog = () => {
    setScheduleDialogOpen(false);
    setScheduleDialogDate(null);
    setNewScheduleTitle('');
    setScheduleIsPublic(false);
  };

  const handleAddCustomSchedule = () => {
    if (!scheduleDialogDate) return;
    const title = newScheduleTitle.trim();
    if (!title) return;

    const dateKey = formatDateKey(scheduleDialogDate);
    setCustomCalendarSchedules((prev) => {
      const existing = prev[dateKey] || [];
      return {
        ...prev,
        [dateKey]: [
          ...existing,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            title,
            type: 'normal',
            isPublic: scheduleIsPublic
          }
        ]
      };
    });
    setNewScheduleTitle('');
    setScheduleIsPublic(false);
  };

  const handleDeleteCustomSchedule = (dateKey: string, scheduleId: string) => {
    setCustomCalendarSchedules((prev) => {
      const existing = prev[dateKey] || [];
      const next = existing.filter((item) => item.id !== scheduleId);
      if (next.length === 0) {
        const { [dateKey]: _removed, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [dateKey]: next
      };
    });
  };

  const toggleDashboardCard = (cardId: string) => {
    const allowed = new Set(getAllowedDashboardCardIds(user?.role, dashboardCardAccessOpts));
    if (!allowed.has(cardId)) return;
    setSelectedDashboardCards((prev) => {
      const current = sanitizeDashboardCardIds(prev, user?.role, dashboardCardAccessOpts);
      if (current.includes(cardId)) {
        if (current.length === 1) return current;
        return current.filter((id) => id !== cardId);
      }
      return [...current, cardId];
    });
  };

  const handleSelectAllDashboardCards = () => {
    setSelectedDashboardCards(dashboardCardOptions.map((card) => card.id));
  };

  const handleResetDashboardCards = () => {
    setSelectedDashboardCards(getDefaultDashboardCardIds(user?.role, dashboardCardAccessOpts));
  };

  const handleReorderDashboardCards = (sourceCardId: string, targetCardId: string) => {
    if (!sourceCardId || !targetCardId || sourceCardId === targetCardId) return;
    setSelectedDashboardCards((prev) => {
      const current = sanitizeDashboardCardIds(prev, user?.role, dashboardCardAccessOpts);
      const sourceIndex = current.indexOf(sourceCardId);
      const targetIndex = current.indexOf(targetCardId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const toggleQuickActionRoute = (route: string) => {
    setSelectedQuickActionRoutes((prev) => {
      if (prev.includes(route)) {
        return prev.filter((item) => item !== route);
      }
      if (prev.length >= QUICK_ACTION_MAX_COUNT) {
        return prev;
      }
      return [...prev, route];
    });
  };

  // 출근/퇴근 관련 함수
  const TIME_ZONE = 'Asia/Kolkata';
  const getClientTimeParts = () => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    const lookup = (type: string) => parts.find((part) => part.type === type)?.value || '';
    return {
      year: lookup('year'),
      month: lookup('month'),
      day: lookup('day'),
      hour: lookup('hour'),
      minute: lookup('minute'),
      second: lookup('second')
    };
  };
  const getClientDate = useCallback(() => {
    const { year, month, day } = getClientTimeParts();
    return `${year}-${month}-${day}`;
  }, []);
  const getClientTimeISO = () => {
    const { year, month, day, hour, minute, second } = getClientTimeParts();
    return `${year}-${month}-${day}T${hour}:${minute}:${second}+05:30`;
  };
  const getCurrentPosition = () =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error(t('dashboard.geoNotAvailable')));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 30000
      });
    });

  // 오늘의 근태 조회
  useEffect(() => {
    const fetchTodayAttendance = async () => {
      if (!user) return;
      try {
        const response = await api.get('/hr/attendances/today', {
          params: { client_date: getClientDate() },
          headers: { 'x-skip-error-popup': 'true' }
        });
        if (response.data?.success) {
          setTodayAttendance(response.data.data);
        }
      } catch {
      /* ignore */
    }
    };
    fetchTodayAttendance();
  }, [user, getClientDate]);

  const handleCheckIn = async () => {
    setCheckInLoading(true);
    setAttendanceMessage(null);
    setAttendanceSeverity('success');
    let messageSet = false;
    
    try {
      const clientDate = getClientDate();
      const requiresSecureContext = typeof window !== 'undefined' && !window.isSecureContext;
      const canUseGeo = !!navigator.geolocation && !requiresSecureContext;
      let skipGeo = !canUseGeo;
      let latitude: number | undefined;
      let longitude: number | undefined;
      let accuracy: number | undefined;
      const todayResponse = await api.get('/hr/attendances/today', {
        params: { client_date: clientDate },
        headers: { 'x-skip-error-popup': 'true' }
      });

      if (todayResponse.data?.success && todayResponse.data?.data?.check_in) {
        const message = t('dashboard.alreadyCheckedIn');
        setAttendanceMessage(message);
        setAttendanceSeverity('info');
        messageSet = true;
        setAttendanceSnackbarOpen(true);
        return;
      }

      if (canUseGeo) {
        try {
          const position = await getCurrentPosition();
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
          accuracy = position.coords.accuracy;
        } catch (geoError) {
          skipGeo = true;
        }
      }
      const response = await api.post(
        '/hr/attendances/check-in',
        {
          latitude,
          longitude,
          accuracy,
          client_time: getClientTimeISO(),
          client_date: clientDate,
          use_server_time: skipGeo,
          skip_geo: skipGeo
        },
        { headers: { 'x-skip-error-popup': 'true' } }
      );
      const payload = response.data;
      if (payload?.success) {
        setAttendanceMessage(payload.message || t('dashboard.checkInSuccess'));
        setAttendanceSeverity('success');
        setTodayAttendance(payload.data);
        messageSet = true;
      } else {
        const message = payload?.message || t('dashboard.checkInFailed');
        if (message.includes(t('dashboard.alreadyCheckedIn')) || message.includes('이미 출근')) {
          setAttendanceMessage(message);
          setAttendanceSeverity('info');
        } else {
          setAttendanceMessage(message);
          setAttendanceSeverity('error');
        }
        messageSet = true;
      }
    } catch (error: any) {
      const status = error.response?.status;
      const serverPath = error.response?.data?.path;
      const serverMessage = error.response?.data?.message;
      if (process.env.NODE_ENV === 'development' && (status === 404 || serverPath)) {
      }
      if (serverMessage?.includes('이미 출근')) {
        setAttendanceMessage(serverMessage);
        setAttendanceSeverity('info');
        messageSet = true;
      } else if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        setAttendanceMessage(t('dashboard.serverConnectError', { url: api.defaults.baseURL || '' }));
        setAttendanceSeverity('error');
        messageSet = true;
      } else if (status === 404 && serverPath === '/api') {
        setAttendanceMessage(
          'API 경로를 찾을 수 없습니다. 서버에는 경로가 \'/api\'로만 전달되었습니다. ' +
          '백엔드(daeheung-rt-one-api)가 주소 ' + (api.defaults.baseURL || '미설정').replace(/\/api\/?$/, '') + ' 에서 실행 중인지 확인하세요.'
        );
        setAttendanceSeverity('error');
        messageSet = true;
      } else {
        const code = error.code;
        const fallback = error.message || t('dashboard.checkInError');
        const baseMessage = serverMessage || fallback;
        const meta = [status ? `HTTP ${status}` : null, code ? `code ${code}` : null].filter(Boolean).join(', ');
        const detailMessage = meta ? `${baseMessage} (${meta})` : baseMessage;
        setAttendanceMessage(detailMessage);
        setAttendanceSeverity('error');
        messageSet = true;
      }
    } finally {
      setCheckInLoading(false);
      if (messageSet) {
        setAttendanceSnackbarOpen(true);
      }
    }
  };

  const handleCheckOut = async () => {
    setCheckOutLoading(true);
    setAttendanceMessage(null);
    setAttendanceSeverity('success');
    let messageSet = false;
    
    try {
      const clientDate = getClientDate();
      const todayResponse = await api.get('/hr/attendances/today', {
        params: { client_date: clientDate },
        headers: { 'x-skip-error-popup': 'true' }
      });

      if (todayResponse.data?.success) {
        const todayData = todayResponse.data.data;
        if (!todayData?.check_in) {
          const message = t('dashboard.noCheckInRecord');
          setAttendanceMessage(message);
          setAttendanceSeverity('warning');
          messageSet = true;
          setAttendanceSnackbarOpen(true);
          return;
        }

        if (todayData?.check_out) {
          const message = t('dashboard.alreadyCheckedOut');
          setAttendanceMessage(message);
          setAttendanceSeverity('info');
          messageSet = true;
          setAttendanceSnackbarOpen(true);
          return;
        }
      }

      const response = await api.post(
        '/hr/attendances/check-out',
        {
          client_time: getClientTimeISO(),
          client_date: clientDate
        },
        { headers: { 'x-skip-error-popup': 'true' } }
      );
      const payload = response.data;
      if (payload?.success) {
        // 성공 메시지는 서버 문구 대신 현재 언어 번역을 사용
        setAttendanceMessage(t('dashboard.checkOutSuccess'));
        setAttendanceSeverity('success');
        setTodayAttendance(payload.data);
        messageSet = true;
        // 퇴근 처리 후 오늘의 근태 정보 새로고침
        const refreshResponse = await api.get('/hr/attendances/today', {
          params: { client_date: clientDate },
          headers: { 'x-skip-error-popup': 'true' }
        });
        if (refreshResponse.data?.success) {
          setTodayAttendance(refreshResponse.data.data);
        }
      } else {
        const message = payload?.message || t('dashboard.checkOutFailed');
        if (message.includes(t('dashboard.alreadyCheckedOut')) || message.includes('이미 퇴근')) {
          setAttendanceMessage(message);
          setAttendanceSeverity('info');
        } else {
          setAttendanceMessage(message);
          setAttendanceSeverity('error');
        }
        messageSet = true;
      }
    } catch (error: any) {
      const status = error.response?.status;
      const serverPath = error.response?.data?.path;
      const serverMessage = error.response?.data?.message;
      if (process.env.NODE_ENV === 'development' && (status === 404 || serverPath)) {
      }
      if (serverMessage?.includes('이미 퇴근')) {
        setAttendanceMessage(serverMessage);
        setAttendanceSeverity('info');
        messageSet = true;
      } else if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        setAttendanceMessage(t('dashboard.serverConnectError', { url: api.defaults.baseURL || '' }));
        setAttendanceSeverity('error');
        messageSet = true;
      } else if (status === 404 && serverPath === '/api') {
        setAttendanceMessage(
          'API 경로를 찾을 수 없습니다. 서버에는 경로가 \'/api\'로만 전달되었습니다. ' +
          '백엔드(daeheung-rt-one-api)가 주소 ' + (api.defaults.baseURL || '미설정').replace(/\/api\/?$/, '') + ' 에서 실행 중인지 확인하세요.'
        );
        setAttendanceSeverity('error');
        messageSet = true;
      } else {
        const code = error.code;
        const fallback = error.message || t('dashboard.checkOutError');
        const baseMessage = serverMessage || fallback;
        const meta = [status ? `HTTP ${status}` : null, code ? `code ${code}` : null].filter(Boolean).join(', ');
        const detailMessage = meta ? `${baseMessage} (${meta})` : baseMessage;
        setAttendanceMessage(detailMessage);
        setAttendanceSeverity('error');
        messageSet = true;
      }
    } finally {
      setCheckOutLoading(false);
      if (messageSet) {
        setAttendanceSnackbarOpen(true);
      }
    }
  };

  // 실제 데이터 로드 함수
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const uid = user?.id ? Number(user.id) : null;
      const isAdminLeave = user?.role === 'admin' || user?.role === 'root';
      const isGeneralUser = isGeneralEmployeeRole(user?.role);

      const canLoadTransferExpenses = hasExpenseTransferCardAccess(user?.role, {
        isPaymentOfficer: Boolean(user?.is_payment_officer),
      });

      const [
        statsResponse,
        revenueResponse,
        inventoryResponse,
        noticesResult,
        vacationsResult,
        leaveCalResult,
        projectsResult,
        lowStockResult,
        invoicesResult,
        myTasksResult,
        receivedRes,
        myApprovals,
        expensesResult,
      ] = await Promise.all([
        api.get('/dashboard/stats').catch(() => null),
        isGeneralUser ? Promise.resolve(null) : api.get('/dashboard/revenue-trend').catch(() => null),
        isGeneralUser ? Promise.resolve(null) : api.get('/dashboard/inventory-status').catch(() => null),
        noticeService.getNotices({ status: 'published', limit: 5, page: 1 }).catch(() => null),
        vacationService.getVacations({ status: 'pending' }).catch(() => null),
        (isAdminLeave
          ? vacationService.getVacations()
          : vacationService.getVacations({ same_department: true })
        ).catch(() => null),
        projectService.getProjects({}).catch(() => null),
        isGeneralUser
          ? Promise.resolve(null)
          : api.get('/inventory/products', { params: { lowStock: true, limit: 5 } }).catch(() => null),
        isGeneralUser
          ? Promise.resolve(null)
          : api
              .get('/accounting/invoices', { params: { limit: 5, orderBy: 'created_at', order: 'DESC' } })
              .catch(() => null),
        uid ? api.get('/dashboard/my-tasks').catch(() => null) : Promise.resolve(null),
        uid && !isGeneralUser
          ? approvalService.getApprovals({ current_approver_id: uid, status: 'submitted,in_review' }).catch(() => null)
          : Promise.resolve(null),
        uid && !isGeneralUser
          ? approvalService.getApprovals({ requester_id: uid }).catch(() => null)
          : Promise.resolve(null),
        uid
          ? accountingService
              .getExpenseReports(
                user?.company_id
                  ? { company_id: Number(user.company_id) }
                  : undefined
              )
              .catch(() => null)
          : Promise.resolve(null),
      ]);

      if (statsResponse?.data?.success) {
        setStats((prev) => ({
          ...prev,
          totalSales: statsResponse.data.data.totalRevenue || 0,
          totalCustomers: statsResponse.data.data.customerCount || 0,
          totalInvoices: statsResponse.data.data.invoiceCount || 0,
          totalInventory: statsResponse.data.data.inventoryCount || 0,
          totalEmployees: statsResponse.data.data.employeeCount || 0 }));
      }

      if (revenueResponse?.data?.success) {
        const revenueData = revenueResponse.data.data.map((item: any) => ({
          name: new Date(item.month).toLocaleDateString('ko-KR', { month: 'short' }),
          sales: parseFloat(item.revenue) || 0,
          profit: parseFloat(item.revenue) * 0.3 || 0 }));
        setSalesData(revenueData);
      }

      if (inventoryResponse?.data?.success) {
        const inventoryStatus = inventoryResponse.data.data;
        setInventoryData([
          { name: t('dashboard.inventoryLow'), value: inventoryStatus.lowStock || 0, color: '#ff6b6b' },
          { name: t('dashboard.inventoryNormal'), value: inventoryStatus.normalStock || 0, color: '#4ecdc4' },
          { name: t('dashboard.inventoryHigh'), value: inventoryStatus.overStock || 0, color: '#ffe66d' },
        ]);
      }

      if (noticesResult?.success) {
        setNotices(noticesResult.data || []);
      }

      if (vacationsResult?.success) {
        const vacations = Array.isArray(vacationsResult.data) ? vacationsResult.data : [];
        setPendingVacations(vacations.slice(0, 5));
        setStats((prev) => ({ ...prev, pendingVacations: vacations.length }));
      }

      if (leaveCalResult?.success) {
        setDashboardLeaveRaw(Array.isArray(leaveCalResult.data) ? leaveCalResult.data : []);
      } else {
        setDashboardLeaveRaw([]);
      }

      if (projectsResult?.success) {
        const allProjects = Array.isArray(projectsResult.data) ? projectsResult.data : [];
        setStats((prev) => ({ ...prev, totalProjects: allProjects.length }));
      }

      if (lowStockResult?.data?.success) {
        setLowStockItems(lowStockResult.data.data || []);
      }

      if (invoicesResult?.data?.success) {
        setRecentInvoices(invoicesResult.data.data || []);
      }

      if (myTasksResult?.data?.success) {
        setMyTasks(Array.isArray(myTasksResult.data.data) ? myTasksResult.data.data : []);
      } else {
        setMyTasks([]);
      }

      if (uid && receivedRes?.success) {
        const list = Array.isArray(receivedRes.data) ? receivedRes.data : [];
        const received = list.filter((approval: any) => {
          const approverId = Number(approval.current_approver_id ?? approval.currentApproverId);
          const st = approval.status;
          return approverId === uid && (st === 'submitted' || st === 'in_review');
        });
        setMyReceivedApprovals(received.slice(0, 5));
        setStats((prev) => ({ ...prev, pendingApprovals: received.length }));
      }

      if (uid && myApprovals?.success) {
        const raw = Array.isArray(myApprovals.data) ? myApprovals.data : [];
        const approvals = raw.filter((a: any) => Number(a.requester_id) === uid);
        setMyRequestedApprovals(approvals.slice(0, 5));
      }

      if (uid && expensesResult?.success) {
        const list = Array.isArray(expensesResult.data) ? expensesResult.data : [];
        const companyId = user?.company_id != null ? Number(user.company_id) : null;
        const companyScoped = Number.isFinite(companyId) && (companyId as number) > 0
          ? list.filter((expense: any) => {
              const expenseCompanyId = Number(
                expense.company_id ?? expense.companyId ?? expense.company?.id ?? 0
              );
              return Number.isFinite(expenseCompanyId) && expenseCompanyId === companyId;
            })
          : list;

        const received = companyScoped
          .filter((expense: any) => isExpenseReceivedForUser(expense, uid))
          .filter((expense: any) => !isExpensePaidForDashboard(expense));
        setReceivedExpenses(received.slice(0, 5));

        if (canLoadTransferExpenses) {
          const transfer = companyScoped.filter((expense: any) => {
            if (expense.status !== 'approved' && expense.status !== 'paid') return false;
            return getExpenseTransferFilterKey(expense) !== 'transfer_completed';
          });
          setTransferExpenses(transfer.slice(0, 5));
        } else {
          setTransferExpenses([]);
        }
      } else {
        setReceivedExpenses([]);
        setTransferExpenses([]);
      }
    } catch {
      setError(t('errors.serverError'));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleRefresh = () => {
    loadDashboardData();
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    const actualIndex = getTabIndex(newValue);
    setActiveTab(actualIndex);
  };

  // 초기 탭 설정 (사용 가능한 첫 번째 탭)
  useEffect(() => {
    if (availableTabs.length > 0) {
      const firstAvailableTab = availableTabs[0].index;
      setActiveTab(firstAvailableTab);
    }
  }, [availableTabs]);

  const StatCard = ({ title, value, icon, trend, color = 'primary', onClick, showIfEmpty = false }: any) => {
    // 데이터가 없고 showIfEmpty가 false이면 카드를 표시하지 않음
    if ((value === null || value === undefined || value === 0) && !showIfEmpty) {
      return null;
    }
    
    return (
      <Card
        elevation={0}
        sx={(th) => ({
          ...(mvsKpiCardSx as (theme: Theme) => Record<string, unknown>)(th),
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          cursor: onClick ? 'pointer' : 'default',
          transition: 'box-shadow 0.2s ease',
          '&:hover': onClick
            ? { boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)' }
            : {} })}
        onClick={onClick}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Box sx={{ flex: 1 }}>
              <Typography 
                color="text.secondary" 
                gutterBottom 
                variant="subtitle2"
                sx={{ 
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  mb: 1,
                  color: '#6E6E73' }}
              >
                {title}
              </Typography>
              <Typography 
                variant="h3" 
                component="div" 
                sx={{ 
                  fontWeight: 500,
                  fontSize: '1.5rem',
                  color: 'text.primary',
                  mb: trend ? 1 : 0
                }}
              >
                {value === 0 ? '0' : value.toLocaleString()}
              </Typography>
              {trend && (
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: 0.5
                }}>
                  {trend > 0 ? (
                    <TrendingUp sx={{ 
                      color: 'success.main', 
                      fontSize: '1rem'
                    }} />
                  ) : (
                    <TrendingDown sx={{ 
                      color: 'error.main', 
                      fontSize: '1rem'
                    }} />
                  )}
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: trend > 0 ? 'success.main' : 'error.main',
                      fontSize: '0.75rem',
                      fontWeight: 500
                    }}
                  >
                    {Math.abs(trend)}%
                  </Typography>
                </Box>
              )}
            </Box>
            <Avatar
              sx={(theme) => {
                const tone = theme.palette[color as keyof typeof theme.palette] as
                  | typeof theme.palette.primary
                  | undefined;
                const main = tone?.main ?? theme.palette.primary.main;
                const dark = tone?.dark ?? theme.palette.primary.dark;
                return {
                  bgcolor: alpha(main, 0.14),
                  color: dark,
                  width: 48,
                  height: 48,
                  boxShadow: 'none' };
              }}
            >
              {React.cloneElement(icon, { sx: { fontSize: '1.2rem' } })}
            </Avatar>
          </Box>
          {onClick && (
            <Box sx={{ position: 'absolute', top: 12, right: 12 }}>
              <ArrowForwardIcon sx={{ 
                color: 'text.secondary', 
                fontSize: '0.875rem',
                opacity: 0.6
              }} />
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  const QuickActionCard = ({ title, icon, color, onClick, disabled = false }: any) => (
    <Card
      elevation={0}
      sx={{
        ...(mvsDashboardWidgetCardSx as object),
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 0.2s ease, background-color 0.2s ease',
        '&:hover': disabled
          ? {}
          : {
              bgcolor: alpha(theme.palette.grey[500], 0.04),
              boxShadow: '0 8px 26px rgba(15, 23, 42, 0.08)' } }}
      onClick={disabled ? undefined : onClick}
    >
      <CardContent
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flex: 1,
          '&:last-child': { pb: 2 } }}
      >
        <Avatar
          sx={(th) => {
            const tone = th.palette[color as keyof typeof th.palette] as
              | typeof th.palette.primary
              | undefined;
            const main = tone?.main ?? th.palette.primary.main;
            const dark = tone?.dark ?? th.palette.primary.dark;
            return {
              bgcolor: alpha(main, 0.12),
              color: dark,
              width: 44,
              height: 44,
              flexShrink: 0 };
          }}
        >
          {React.cloneElement(icon, { sx: { fontSize: '1.1rem' } })}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="subtitle1"
            sx={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              lineHeight: 1.35,
              letterSpacing: '-0.015em' }}
          >
            {title}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );

  const openNoticeDetail = async (notice: any) => {
    setNoticePollError('');
    setNoticePollMessage('');
    setSelectedPollOptionId(null);
    setSelectedNotice(notice);
    setNoticeDialogOpen(true);
    if (!notice?.id) return;
    try {
      setNoticeDetailLoading(true);
      const response = await noticeService.getNotice(notice.id);
      if (response?.success && response.data) {
        setSelectedNotice(response.data);
        setSelectedPollOptionId(response.data?.poll?.myVoteOptionId ?? null);
      }
    } catch (err: any) {
      setNoticePollError(
        err?.response?.data?.message ||
          (language === 'en' ? 'Failed to load notice.' : '공지를 불러오지 못했습니다.')
      );
    } finally {
      setNoticeDetailLoading(false);
    }
  };

  const handleDashboardVotePoll = async () => {
    if (!selectedNotice?.id || selectedPollOptionId == null) {
      setNoticePollError(
        language === 'en' ? 'Select an option before voting.' : '선택지를 고른 뒤 투표하세요.'
      );
      return;
    }
    try {
      setPollVoting(true);
      setNoticePollError('');
      const response = await noticeService.votePoll(selectedNotice.id, selectedPollOptionId);
      if (response?.success) {
        setSelectedNotice({
          ...selectedNotice,
          hasPoll: true,
          poll: response.data,
        });
        setNoticePollMessage(
          language === 'en'
            ? 'Your vote was recorded. Results are anonymous.'
            : '투표가 반영되었습니다. 결과는 익명입니다.'
        );
      } else {
        setNoticePollError(
          response?.message || (language === 'en' ? 'Vote failed.' : '투표에 실패했습니다.')
        );
      }
    } catch (err: any) {
      setNoticePollError(
        err?.response?.data?.message || (language === 'en' ? 'Vote failed.' : '투표에 실패했습니다.')
      );
    } finally {
      setPollVoting(false);
    }
  };

  return (
    <Box sx={mvsPageRootSx}>
      <DaeheungPageHeader
        title={t('dashboard.pageTitle')}
        description={t('dashboard.welcomeWork', { name: user?.username || t('dashboard.userFallback') })}
        icon={<DashboardIcon />}
        actions={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0 }}>
            <Tooltip title={t('dashboard.refresh')}>
              <IconButton
                onClick={handleRefresh}
                disabled={loading}
                size="small"
                sx={{
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  bgcolor: '#F8FAFC',
                  '&:hover': { bgcolor: '#E8EDF3' } }}
              >
                <Refresh sx={{ fontSize: '1.125rem' }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('dashboard.notifications')}>
              <IconButton
                size="small"
                sx={{
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  bgcolor: '#F8FAFC',
                  '&:hover': { bgcolor: '#E8EDF3' } }}
              >
                <Notifications sx={{ fontSize: '1.125rem' }} />
              </IconButton>
            </Tooltip>
            <Avatar
              sx={{
                width: 34,
                height: 34,
                bgcolor: 'error.main',
                fontSize: '0.875rem',
                fontWeight: 600 }}
            >
              R
            </Avatar>
          </Box>
        }
      />

      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 2.5, overflow: 'hidden' }}>
        <Tabs
          value={getDisplayIndex(activeTab)}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 1,
            minHeight: 48,
            '& .MuiTabs-indicator': {
              backgroundColor: 'primary.main',
              height: 3,
              borderRadius: '3px 3px 0 0' },
            '& .MuiTab-root': {
              textTransform: 'none',
              fontSize: '0.875rem',
              fontWeight: 600,
              minHeight: 48,
              py: 1.5,
              px: 2.5,
              letterSpacing: '0.01em',
              color: 'text.secondary',
              '&.Mui-selected': {
                color: 'primary.main' } } }}
        >
          {availableTabs.map((tab) => (
            <Tab
              key={tab.index}
              label={tab.label}
              icon={<tab.icon sx={{ fontSize: '1rem' }} />}
              iconPosition="start"
            />
          ))}
        </Tabs>
      </Card>

      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 2.5 }}>
        <Box sx={mvsBodySectionHeaderSx}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, letterSpacing: '-0.01em', color: 'text.primary' }}>
            {t('dashboard.quickActions')}
          </Typography>
        </Box>
        <Box sx={{ px: { xs: 2, sm: 2.5 }, py: 2 }}>
          <Box
            sx={{
              display: 'flex',
              gap: 2.5,
              alignItems: 'stretch',
              flexDirection: { xs: 'column', md: 'row' } }}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, 1fr)',
                  md: `repeat(${Math.min(Math.max(selectedQuickActions.length, 1), 4)}, 1fr)` },
                gap: 2,
                flex: 1,
                minWidth: 0,
                alignItems: 'stretch' }}
            >
              {selectedQuickActions.length === 0 ? (
                <Card variant="outlined" sx={{ borderStyle: 'dashed', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 88 }}>
                  <Typography variant="body2" color="text.secondary">
                    {language === 'en'
                      ? 'No quick actions selected. Use edit button to add menus.'
                      : '선택된 빠른 액션이 없습니다. 편집 버튼에서 메뉴를 추가하세요.'}
                  </Typography>
                </Card>
              ) : (
                selectedQuickActions.map((action) => {
                  const menuId = findMenuByRoute(action.route);
                  const disabled = !isRoot && !isAdmin && (!menuId || !hasMenuPermission(menuId, action.requiredAction));
                  return (
                    <QuickActionCard
                      key={action.route}
                      title={action.title}
                      icon={action.icon}
                      color={action.color}
                      disabled={disabled}
                      onClick={() => handleNavigationWithPermission(action.route, action.requiredAction)}
                    />
                  );
                })
              )}
            </Box>
            
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row', md: 'column' },
                flexWrap: { xs: 'nowrap', sm: 'wrap', md: 'nowrap' },
                gap: 1.25,
                width: { xs: '100%', md: 'auto' },
                minWidth: { md: 200, lg: 220 },
                maxWidth: { md: 280 },
                flexShrink: 0,
                alignSelf: { xs: 'stretch', md: 'flex-start' },
                justifyContent: 'flex-start' }}
            >
              <Button
                size="small"
                variant="outlined"
                startIcon={<SettingsIcon sx={{ fontSize: '1rem' }} />}
                onClick={() => setQuickActionDialogOpen(true)}
                sx={{
                  ...mvsBodyOutlinedBtnSx,
                  width: { xs: '100%', sm: 'auto', md: '100%' },
                  whiteSpace: 'nowrap' }}
              >
                {language === 'en' ? 'Edit quick actions' : '빠른 액션 편집'}
              </Button>
              <Button
                variant="contained"
                size="small"
                disableElevation
                startIcon={<CheckInIcon sx={{ fontSize: '1rem' }} />}
                onClick={handleCheckIn}
                disabled={checkInLoading || !!todayAttendance?.check_in}
                sx={{
                  ...mvsBodyPrimaryBtnSx,
                  width: { xs: '100%', sm: 'auto', md: '100%' },
                  minHeight: 40,
                  whiteSpace: 'nowrap',
                  '& .MuiButton-startIcon': { mr: 0.75, ml: 0 } }}
              >
                {checkInLoading ? t('dashboard.registering') : t('dashboard.checkIn')}
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<CheckOutIcon sx={{ fontSize: '1rem' }} />}
                onClick={handleCheckOut}
                disabled={checkOutLoading || !todayAttendance?.check_in || !!todayAttendance?.check_out}
                sx={{
                  ...mvsBodyOutlinedBtnSx,
                  width: { xs: '100%', sm: 'auto', md: '100%' },
                  minHeight: 40,
                  whiteSpace: 'nowrap',
                  '& .MuiButton-startIcon': { mr: 0.75, ml: 0 } }}
              >
                {checkOutLoading ? t('dashboard.registering') : t('dashboard.checkOut')}
              </Button>
            </Box>
          </Box>
        </Box>
      </Card>

      {visibleDashboardCards.includes('calendar') && (
        <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 2.5 }}>
          <Box
            sx={{
              ...mvsBodySectionHeaderSx,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarTodayIcon color="primary" fontSize="small" />
              <Typography variant="subtitle1" sx={{ fontWeight: 600, letterSpacing: '-0.01em', color: 'text.primary' }}>
                {language === 'en' ? 'Weekly Schedule' : '주간 스케줄'}
              </Typography>
            </Box>
            {(() => {
              const weekDates = Array.from({ length: 7 }, (_, index) => {
                const date = new Date(currentWeekStart);
                date.setDate(currentWeekStart.getDate() + index);
                return date;
              });
              const weekEnd = weekDates[6];
              return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <IconButton
                    size="small"
                    onClick={() => setCurrentWeekStart((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7))}
                  >
                    <ChevronLeftIcon fontSize="small" />
                  </IconButton>
                  <Typography variant="body2" sx={{ fontWeight: 600, minWidth: { xs: 180, sm: 220 }, textAlign: 'center' }}>
                    {`${currentWeekStart.toLocaleDateString(language === 'en' ? 'en-US' : 'ko-KR')} ~ ${weekEnd.toLocaleDateString(language === 'en' ? 'en-US' : 'ko-KR')}`}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => setCurrentWeekStart((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7))}
                  >
                    <ChevronRightIcon fontSize="small" />
                  </IconButton>
                </Box>
              );
            })()}
          </Box>
          <Box sx={{ px: { xs: 1.5, sm: 2.5 }, py: 2, overflowX: 'auto' }}>
            {(() => {
              const weekDaysShort = language === 'en'
                ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                : ['일', '월', '화', '수', '목', '금', '토'];
              const today = new Date();
              const weekDates = Array.from({ length: 7 }, (_, index) => {
                const date = new Date(currentWeekStart);
                date.setDate(currentWeekStart.getDate() + index);
                return date;
              });

              const isToday = (date: Date) =>
                date.getDate() === today.getDate() &&
                date.getMonth() === today.getMonth() &&
                date.getFullYear() === today.getFullYear();

              const isWeekend = (date: Date) => {
                const day = date.getDay();
                return day === 0 || day === 6;
              };

              return (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'repeat(7, minmax(88px, 1fr))',
                      md: 'repeat(7, 1fr)' },
                    gap: { xs: 1, sm: 1.25 },
                    minWidth: { xs: 640, md: '100%' } }}
                >
                  {weekDates.map((date) => {
                    const dayName = weekDaysShort[date.getDay()];
                    const dateKey = formatDateKey(date);
                    const holidayNames = getHolidayNames(date);
                    const customLabels = customCalendarSchedules[dateKey] || [];
                    const companyDaySchedules = companySchedulesByDate[dateKey] || [];
                    const publicDaySchedules = publicPersonalSchedulesByDate[dateKey] || [];
                    const complianceLabels = getComplianceLabels(date);
                    const hasCompanyHoliday =
                      companyDaySchedules.some((item) => item.isHoliday) ||
                      customLabels.some((item) => item.type === 'company_holiday');
                    const isHolidayDate = holidayNames.length > 0;
                    const isTodayDate = isToday(date);
                    const isWeekendDate = isWeekend(date);
                    const isWeekendOnly = isWeekendDate && !isHolidayDate;
                    const hasAnySchedule =
                      holidayNames.length > 0 ||
                      customLabels.length > 0 ||
                      companyDaySchedules.length > 0 ||
                      publicDaySchedules.length > 0 ||
                      complianceLabels.length > 0;
                    const allLabels = [
                      ...holidayNames.map((name) => ({ key: `h-${name}`, label: getHolidayDisplayName(name), type: 'holiday' as const })),
                      ...companyDaySchedules.map((item) => ({
                        key: `co-${item.id}`,
                        label: item.title,
                        type: item.isHoliday ? ('company_holiday' as const) : ('company' as const)
                      })),
                      ...customLabels.map((item) => ({
                        key: `c-${item.id}`,
                        label: item.title,
                        type: item.type === 'company_holiday' ? ('company_holiday' as const) : ('custom' as const)
                      })),
                      ...publicDaySchedules.map((item) => ({
                        key: `pub-${item.id}`,
                        label: item.ownerName ? `${item.title} · ${item.ownerName}` : item.title,
                        type: 'public_personal' as const
                      })),
                      ...complianceLabels.map((item) => ({ key: `p-${item.id}`, label: item.label, type: 'compliance' as const })),
                    ];
                    const visibleLabels = allLabels.slice(0, 2);
                    const hiddenCount = allLabels.length - visibleLabels.length;

                    return (
                      <Box
                        key={dateKey}
                        onClick={() => openScheduleDialog(date)}
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          px: 1,
                          py: 1.25,
                          minHeight: 128,
                          borderRadius: '8px',
                          border: '1px solid',
                          borderColor: hasCompanyHoliday
                            ? 'warning.main'
                            : isTodayDate
                              ? 'primary.main'
                              : 'divider',
                          bgcolor: isTodayDate
                            ? 'primary.main'
                            : isHolidayDate
                              ? 'background.paper'
                              : isWeekendOnly
                                ? 'rgba(10, 110, 125, 0.14)'
                                : 'grey.50',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease',
                          '&:hover': {
                            bgcolor: 'action.hover' } }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 700,
                            color: isTodayDate ? 'common.white' : '#334155',
                            mb: 0.25 }}
                        >
                          {dayName}
                        </Typography>
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.35, mb: 0.75 }}>
                          <Typography
                            variant="h6"
                            sx={{
                              fontWeight: 800,
                              lineHeight: 1,
                              color: isTodayDate ? 'common.white' : 'text.primary' }}
                          >
                            {date.getDate()}
                          </Typography>
                          {hasCompanyHoliday && (
                            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.05 }}>
                              <CompanyHolidayStarIcon color={isTodayDate ? '#FFFFFF' : '#FF1744'} />
                              <CompanyHolidayStarIcon color={isTodayDate ? '#FFFFFF' : '#FF1744'} />
                            </Box>
                          )}
                        </Box>
                        <Box
                          sx={{
                            width: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'stretch',
                            gap: 0.4,
                            flex: 1 }}
                        >
                          {visibleLabels.map((item) => (
                            <Chip
                              key={`${dateKey}-${item.key}`}
                              size="small"
                              label={item.label}
                              sx={{
                                height: 20,
                                maxWidth: '100%',
                                fontSize: '0.62rem',
                                fontWeight: 700,
                                '& .MuiChip-label': {
                                  px: 0.75,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis' },
                                bgcolor:
                                  item.type === 'holiday'
                                    ? 'error.light'
                                    : item.type === 'company_holiday'
                                      ? 'warning.dark'
                                      : item.type === 'compliance'
                                        ? 'info.light'
                                        : item.type === 'public_personal'
                                          ? 'secondary.light'
                                          : 'primary.light',
                                color:
                                  item.type === 'holiday'
                                    ? 'error.contrastText'
                                    : item.type === 'company_holiday'
                                      ? 'common.white'
                                      : item.type === 'compliance'
                                        ? 'info.dark'
                                        : item.type === 'public_personal'
                                          ? 'secondary.dark'
                                          : 'primary.main' }}
                            />
                          ))}
                          {!hasAnySchedule && (
                            <Typography
                              variant="caption"
                              sx={{
                                textAlign: 'center',
                                color: isTodayDate ? 'rgba(255,255,255,0.92)' : '#475569',
                                fontWeight: 700,
                                fontSize: '0.72rem',
                              }}
                            >
                              {language === 'en' ? 'No schedules' : '일정 없음'}
                            </Typography>
                          )}
                          {hiddenCount > 0 && (
                            <Typography
                              variant="caption"
                              sx={{
                                textAlign: 'center',
                                fontWeight: 700,
                                color: isTodayDate ? 'common.white' : 'primary.main' }}
                            >
                              +{hiddenCount}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              );
            })()}
          </Box>
        </Card>
      )}

      <Dialog
        open={quickActionDialogOpen}
        onClose={() => {
          setQuickActionDialogOpen(false);
          setQuickActionSearchTerm('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {language === 'en' ? 'Quick Actions Edit' : '빠른 액션 편집'}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {language === 'en'
              ? `Choose up to ${QUICK_ACTION_MAX_COUNT} menus to show in quick actions.`
              : `빠른 액션에 표시할 메뉴를 최대 ${QUICK_ACTION_MAX_COUNT}개까지 선택하세요.`}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            {language === 'en'
              ? `Selected: ${selectedQuickActionRoutes.length}/${QUICK_ACTION_MAX_COUNT}`
              : `선택: ${selectedQuickActionRoutes.length}/${QUICK_ACTION_MAX_COUNT}`}
          </Typography>

          <TextField
            size="small"
            fullWidth
            value={quickActionSearchTerm}
            onChange={(event) => setQuickActionSearchTerm(event.target.value)}
            placeholder={language === 'en' ? 'Search by menu name or route' : '메뉴명 또는 경로 검색'}
            sx={{ mb: 1.2 }}
          />

          <List sx={{ p: 0 }}>
            {filteredQuickActionCandidates.map((menu) => {
              const checked = selectedQuickActionRoutes.includes(menu.route);
              const disabled = !checked && selectedQuickActionRoutes.length >= QUICK_ACTION_MAX_COUNT;
              return (
                <ListItem
                  key={menu.route}
                  disableGutters
                  secondaryAction={
                    <Checkbox
                      edge="end"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleQuickActionRoute(menu.route)}
                    />
                  }
                  sx={{
                    px: 1,
                    py: 0.75,
                    borderRadius: 1,
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                >
                  <ListItemAvatar sx={{ minWidth: 36 }}>
                    <Avatar sx={{ width: 28, height: 28, bgcolor: `${menu.color}.main` }}>
                      {React.cloneElement(menu.icon, { sx: { fontSize: '0.9rem' } })}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {menu.title}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {menu.route}
                      </Typography>
                    }
                  />
                </ListItem>
              );
            })}
            {filteredQuickActionCandidates.length === 0 && (
              <ListItem sx={{ py: 2, justifyContent: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {language === 'en' ? 'No menus found.' : '검색 결과가 없습니다.'}
                </Typography>
              </ListItem>
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setQuickActionDialogOpen(false);
              setQuickActionSearchTerm('');
            }}
          >
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={dashboardCardDialogOpen}
        onClose={() => {
          setDashboardCardDialogOpen(false);
          setDashboardCardSearchTerm('');
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {language === 'en' ? 'Dashboard Cards Edit' : '하단 카드 편집'}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.2 }}>
            {language === 'en'
              ? 'Choose cards to display in the lower dashboard section.'
              : '하단 대시보드 영역에 표시할 카드를 선택하세요.'}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.2 }}>
            {language === 'en'
              ? `Selected: ${visibleDashboardCards.length}/${dashboardCardOptions.length}`
              : `선택: ${visibleDashboardCards.length}/${dashboardCardOptions.length}`}
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder={language === 'en' ? 'Search cards' : '카드 검색'}
            value={dashboardCardSearchTerm}
            onChange={(e) => setDashboardCardSearchTerm(e.target.value)}
            sx={{ mb: 1 }}
          />
          <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
            <Button size="small" variant="outlined" onClick={handleSelectAllDashboardCards}>
              {language === 'en' ? 'Select all' : '전체 선택'}
            </Button>
            <Button size="small" variant="outlined" onClick={handleResetDashboardCards}>
              {language === 'en' ? 'Restore defaults' : '기본값 복원'}
            </Button>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.6 }}>
            {language === 'en' ? 'Drag selected cards to change order' : '선택된 카드를 드래그해서 순서를 변경하세요'}
          </Typography>
          <List sx={{ p: 0, mb: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            {visibleDashboardCards.map((cardId) => {
              const card = dashboardCardOptions.find((option) => option.id === cardId);
              if (!card) return null;
              return (
                <ListItem
                  key={`selected-${card.id}`}
                  draggable
                  onDragStart={() => setDraggingDashboardCardId(card.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggingDashboardCardId) {
                      handleReorderDashboardCards(draggingDashboardCardId, card.id);
                    }
                  }}
                  onDragEnd={() => setDraggingDashboardCardId(null)}
                  sx={{
                    px: 1,
                    py: 0.6,
                    cursor: 'grab',
                    bgcolor: draggingDashboardCardId === card.id ? 'action.selected' : 'transparent',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    '&:last-of-type': {
                      borderBottom: 'none'
                    }
                  }}
                >
                  <ListItemText
                    primary={
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        ≡ {card.label}
                      </Typography>
                    }
                  />
                </ListItem>
              );
            })}
          </List>
          <List sx={{ p: 0 }}>
            {filteredDashboardCardOptions.map((card) => {
              const checked = visibleDashboardCards.includes(card.id);
              const disableUncheck = checked && visibleDashboardCards.length === 1;
              return (
                <ListItem
                  key={card.id}
                  disableGutters
                  secondaryAction={
                    <Checkbox
                      edge="end"
                      checked={checked}
                      disabled={disableUncheck}
                      onChange={() => toggleDashboardCard(card.id)}
                    />
                  }
                  sx={{
                    px: 1,
                    py: 0.75,
                    borderRadius: 1,
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                >
                  <ListItemText
                    primary={
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {card.label}
                      </Typography>
                    }
                  />
                </ListItem>
              );
            })}
            {filteredDashboardCardOptions.length === 0 && (
              <ListItem sx={{ py: 2, justifyContent: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {language === 'en' ? 'No cards found.' : '검색 결과가 없습니다.'}
                </Typography>
              </ListItem>
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDashboardCardDialogOpen(false);
              setDashboardCardSearchTerm('');
            }}
          >
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={noticeDialogOpen}
        onClose={() => {
          setNoticeDialogOpen(false);
          setSelectedNotice(null);
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            maxHeight: '90vh'
          }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AnnouncementIcon color="primary" />
            {t('dashboard.noticeDetail')}
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedNotice && (
            <Box>
              <Box sx={{ mb: 3 }}>
                <Typography variant="h5" fontWeight="bold" gutterBottom>
                  {selectedNotice.title}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  {selectedNotice.status === 'published' && (
                    <Chip label={t('dashboard.published')} color="success" size="small" />
                  )}
                  {selectedNotice.isPinned && (
                    <Chip label={t('dashboard.pinned')} color="warning" size="small" />
                  )}
                  {(selectedNotice.hasPoll || selectedNotice.poll) && (
                    <Chip
                      label={language === 'en' ? 'Poll' : '투표'}
                      size="small"
                      sx={{ borderRadius: 0, bgcolor: '#F9A825', color: '#212121', fontWeight: 700 }}
                    />
                  )}
                </Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  component="div"
                  sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1.5, rowGap: 0.5, alignItems: 'baseline' }}
                >
                  {(() => {
                    const dateLocale = language === 'en' ? 'en-US' : 'ko-KR';
                    const targetLabel =
                      selectedNotice.targetAudience === 'all'
                        ? t('dashboard.targetAll')
                        : selectedNotice.targetAudience === 'employees'
                          ? t('dashboard.targetEmployees')
                          : selectedNotice.targetAudience === 'managers'
                            ? t('dashboard.targetManagers')
                            : t('dashboard.targetSpecific');
                    const sep = (key: string) => (
                      <Box
                        key={key}
                        component="span"
                        sx={{ color: 'text.disabled', userSelect: 'none' }}
                        aria-hidden
                      >
                        ·
                      </Box>
                    );
                    const written = new Date(selectedNotice.createdAt).toLocaleDateString(dateLocale);
                    const nodes: React.ReactNode[] = [
                      <span key="author">
                        {t('dashboard.author')}: {selectedNotice.author}
                      </span>,
                      sep('sep-a'),
                      <span key="written">
                        {t('dashboard.writtenDate')}: {written}
                      </span>,
                      sep('sep-b'),
                      <span key="target">
                        {t('dashboard.targetLabel')}: {targetLabel}
                      </span>,
                    ];
                    if (selectedNotice.publishedAt) {
                      const published = new Date(selectedNotice.publishedAt).toLocaleDateString(dateLocale);
                      nodes.push(
                        sep('sep-c'),
                        <span key="published">
                          {t('dashboard.publishedDate')}: {published}
                        </span>
                      );
                    }
                    return nodes;
                  })()}
                </Typography>
              </Box>

              <Divider sx={{ my: 3 }} />

              <Box
                sx={{
                  mb: 3,
                  '& p': {
                    margin: '0.5em 0',
                    lineHeight: 1.8
                  },
                  '& img': {
                    maxWidth: '100%',
                    height: 'auto',
                    display: 'block',
                    margin: '12px auto'
                  },
                  '& table': {
                    borderCollapse: 'collapse',
                    width: '100%',
                    margin: '16px 0',
                    '& td, & th': {
                      border: '1px solid #ddd',
                      padding: '8px',
                      textAlign: 'left'
                    },
                    '& th': {
                      backgroundColor: '#f2f2f2',
                      fontWeight: 'bold'
                    }
                  },
                  '& h1, & h2, & h3': {
                    margin: '0.8em 0 0.4em 0',
                    fontWeight: 'bold'
                  },
                  '& ul, & ol': {
                    paddingLeft: '1.5em',
                    margin: '0.5em 0'
                  }
                }}
                dangerouslySetInnerHTML={{ __html: selectedNotice.content }}
              />

              {noticeDetailLoading && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {language === 'en' ? 'Loading…' : '불러오는 중…'}
                </Typography>
              )}

              {noticePollError ? (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 0 }}>
                  {noticePollError}
                </Alert>
              ) : null}
              {noticePollMessage ? (
                <Alert severity="success" sx={{ mb: 2, borderRadius: 0 }}>
                  {noticePollMessage}
                </Alert>
              ) : null}

              {selectedNotice.poll && (
                <Box
                  sx={{
                    mb: 3,
                    border: '1px solid #B4B4B4',
                    borderLeft: '4px solid #F9A825',
                    bgcolor: '#FFFDF5',
                    p: 2,
                  }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {language === 'en' ? 'Poll' : '투표'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                    {language === 'en' ? 'Anonymous · one vote per user' : '익명 · 1인 1표'}
                    {selectedNotice.poll.isNotYetOpen
                      ? ` · ${language === 'en' ? 'Not started' : '시작 전'}`
                      : selectedNotice.poll.isClosed
                        ? ` · ${language === 'en' ? 'Closed' : '마감'}`
                        : ` · ${language === 'en' ? 'Open' : '진행 중'}`}
                    {` · ${language === 'en' ? 'Total' : '총'} ${selectedNotice.poll.totalVotes}${
                      language === 'en' ? ' votes' : '표'
                    }`}
                  </Typography>
                  {(selectedNotice.poll.opensAt || selectedNotice.poll.closesAt) && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                      {language === 'en' ? 'Voting period' : '투표 기간'}:{' '}
                      {selectedNotice.poll.opensAt
                        ? new Date(selectedNotice.poll.opensAt).toLocaleString(
                            language === 'en' ? 'en-US' : 'ko-KR'
                          )
                        : language === 'en'
                          ? 'Immediate'
                          : '즉시'}
                      {' ~ '}
                      {selectedNotice.poll.closesAt
                        ? new Date(selectedNotice.poll.closesAt).toLocaleString(
                            language === 'en' ? 'en-US' : 'ko-KR'
                          )
                        : language === 'en'
                          ? 'No end'
                          : '기한 없음'}
                    </Typography>
                  )}
                  <Typography variant="body1" sx={{ mb: 1.5, fontWeight: 600 }}>
                    {selectedNotice.poll.question}
                  </Typography>

                  {(selectedNotice.poll.canVote ??
                    (!selectedNotice.poll.hasVoted &&
                      !selectedNotice.poll.isClosed &&
                      !selectedNotice.poll.isNotYetOpen)) ? (
                    <Box>
                      <RadioGroup
                        value={selectedPollOptionId ?? ''}
                        onChange={(e) => setSelectedPollOptionId(Number(e.target.value))}
                      >
                        {selectedNotice.poll.options?.map((opt: any) => (
                          <FormControlLabel
                            key={opt.id}
                            value={opt.id}
                            control={<Radio size="small" />}
                            label={opt.label}
                          />
                        ))}
                      </RadioGroup>
                      <Button
                        variant="contained"
                        size="small"
                        disableElevation
                        onClick={() => void handleDashboardVotePoll()}
                        disabled={pollVoting || selectedPollOptionId == null}
                        sx={{ mt: 1 }}
                      >
                        {pollVoting
                          ? language === 'en'
                            ? 'Voting…'
                            : '투표 중…'
                          : language === 'en'
                            ? 'Vote'
                            : '투표하기'}
                      </Button>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                      {selectedNotice.poll.isNotYetOpen && !selectedNotice.poll.hasVoted ? (
                        <Typography variant="body2" color="text.secondary">
                          {language === 'en'
                            ? 'Voting is not available before the start time.'
                            : '투표 시작 전에는 투표할 수 없습니다.'}
                        </Typography>
                      ) : null}
                      {selectedNotice.poll.isClosed && !selectedNotice.poll.hasVoted ? (
                        <Typography variant="body2" color="text.secondary">
                          {language === 'en' ? 'This poll is closed.' : '마감되어 투표할 수 없습니다.'}
                        </Typography>
                      ) : null}
                      {(selectedNotice.poll.hasVoted || selectedNotice.poll.isClosed) &&
                        selectedNotice.poll.options?.map((opt: any) => {
                          const total = selectedNotice.poll.totalVotes || 0;
                          const pct = total > 0 ? Math.round((opt.voteCount / total) * 100) : 0;
                          const isMine = selectedNotice.poll.myVoteOptionId === opt.id;
                          return (
                            <Box key={opt.id}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                                <Typography variant="body2" sx={{ fontWeight: isMine ? 700 : 400 }}>
                                  {opt.label}
                                  {isMine
                                    ? ` (${language === 'en' ? 'Your choice' : '내 선택'})`
                                    : ''}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {opt.voteCount}
                                  {language === 'en' ? '' : '표'} ({pct}%)
                                </Typography>
                              </Box>
                              <LinearProgress
                                variant="determinate"
                                value={pct}
                                sx={{
                                  height: 8,
                                  borderRadius: 0,
                                  bgcolor: '#E8E8E8',
                                  '& .MuiLinearProgress-bar': {
                                    bgcolor: isMine ? '#4CAF50' : '#9E9E9E',
                                  },
                                }}
                              />
                            </Box>
                          );
                        })}
                      {selectedNotice.poll.isNotYetOpen &&
                        !selectedNotice.poll.hasVoted &&
                        selectedNotice.poll.options?.map((opt: any) => (
                          <Typography key={opt.id} variant="body2" sx={{ pl: 0.5 }}>
                            · {opt.label}
                          </Typography>
                        ))}
                    </Box>
                  )}
                </Box>
              )}

              {selectedNotice.attachments && selectedNotice.attachments.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>{t('dashboard.attachments')}</Typography>
                  <List>
                    {selectedNotice.attachments.map((attachment: string, index: number) => (
                      <ListItem key={index}>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'primary.main' }}>
                            <AttachFileIcon />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={attachment}
                          secondary={t('dashboard.download')}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  {t('dashboard.views')}: {selectedNotice.views || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('dashboard.readCount')}: {selectedNotice.readCount || 0}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setNoticeDialogOpen(false);
            setSelectedNotice(null);
          }}>
            {t('common.close')}
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setNoticeDialogOpen(false);
              setSelectedNotice(null);
              navigate('/my/notices');
            }}
          >
            {language === 'en' ? 'View all' : '전체 보기'}
          </Button>
        </DialogActions>
      </Dialog>

      {availableTabs.some(tab => tab.index === 2) && (
        <TabPanel value={activeTab} index={2}>
        <Box>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(4, 1fr)',
              lg: 'repeat(4, 1fr)'
            },
            gap: 2,
            mb: 3,
            px: 0
      }}>
        <StatCard
          title={t('dashboard.totalSales')}
          value={stats.totalSales}
          icon={<Receipt />}
          color="primary"
          onClick={() => navigate('/reports/sales')}
        />
        <StatCard
          title={t('dashboard.customerCount')}
          value={stats.totalCustomers}
          icon={<People />}
          color="success"
          onClick={() => navigate('/sales')}
        />
        <StatCard
          title={t('dashboard.invoiceCount')}
          value={stats.totalInvoices}
          icon={<Receipt />}
          color="warning"
          onClick={() => navigate('/invoice')}
        />
        <StatCard
          title={t('dashboard.inventoryCount')}
          value={stats.totalInventory}
          icon={<Inventory />}
          color="info"
          onClick={() => navigate('/inventory')}
        />
        <StatCard
          title={t('dashboard.employeeCount')}
          value={stats.totalEmployees}
          icon={<People />}
          color="secondary"
          onClick={() => navigate('/hr/employees')}
        />
        <StatCard
          title={t('dashboard.projectCount')}
          value={stats.totalProjects}
          icon={<FolderSpecialIcon />}
          color="warning"
          onClick={() => navigate('/projects')}
        />
        <StatCard
          title={t('dashboard.approvalPending')}
          value={stats.pendingApprovals}
          icon={<PendingIcon />}
          color="error"
          onClick={() => navigate('/work/approval?tab=1')}
          showIfEmpty={true}
        />
        <StatCard
          title={t('dashboard.vacationPending')}
          value={stats.pendingVacations}
          icon={<WorkIcon />}
          color="info"
          onClick={() => navigate('/hr/vacations')}
          showIfEmpty={true}
        />
      </Box>

          <Box sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: '1fr'
            },
            gap: 2,
            mb: 3
          }}>
            <Card elevation={0} sx={mvsBodyCardSx}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Inventory color="primary" />
                  재고 현황
                </Typography>
                {inventoryData.every((item: { name: string; value: number; color: string }) => item.value === 0) ? (
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    height: 250,
                    color: 'text.secondary'
                  }}>
                    <Typography variant="body1">{t('dashboard.noData')}</Typography>
                  </Box>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={inventoryData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, value }: { name: string; value: number }) => `${name}: ${value}`}
                      >
                        {inventoryData.map((entry: { name: string; value: number; color: string }, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </Box>
        </Box>
      </TabPanel>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<SettingsIcon sx={{ fontSize: '0.9rem' }} />}
          onClick={() => setDashboardCardDialogOpen(true)}
          sx={mvsBodyOutlinedBtnSx}
        >
          {language === 'en' ? 'Edit dashboard cards' : '하단 카드 편집'}
        </Button>
      </Box>

      <Box
        sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: '1fr',
          md: 'repeat(3, 1fr)',
          lg: 'repeat(3, 1fr)'
        },
        mb: 3,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        gridAutoRows: 'minmax(0, auto)',
        alignItems: 'stretch',
        ...mvsDashboardWidgetGroupSx,
        '& > .MuiCard-root': {
          minHeight: 0,
          height: '100%',
          alignSelf: 'stretch'
        },
        '& > .MuiCard-root.dashboard-vacation-calendar-card': {
          height: 'auto',
          alignSelf: 'start'
        }
      }}>
        {visibleDashboardCards.includes('approval') && (
        <Card
          elevation={0}
          onClick={() => navigate('/work/approval')}
          sx={dashboardWidgetCardSx(visibleDashboardCards.indexOf('approval'), {
            cursor: 'pointer' })}
        >
          <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: DASHBOARD_CARD_PAD, overflow: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: DASHBOARD_CARD_SPACING, gap: 1 }}>
              <Box sx={dashboardCardTitleBar('primary')}>
                <AssignmentIcon color="primary" fontSize="small" />
                <Typography component="div" variant="subtitle1" sx={DASHBOARD_CARD_TITLE_TYPO}>
                  {language === 'en' ? 'Electronic Approval' : '전자결재'}
                </Typography>
              </Box>
              <Button
                size="small"
                variant="text"
                onClick={(event) => {
                  event.stopPropagation();
                  navigate('/work/approval?tab=0');
                }}
              >
                {language === 'en' ? 'View all' : '모두 보기'}
              </Button>
            </Box>
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {myReceivedApprovals.length > 0 || myRequestedApprovals.length > 0 ? (
              <Box sx={{ flex: 1 }}>
                {myReceivedApprovals.length > 0 && (
                  <Box sx={{ mb: DASHBOARD_CARD_SPACING }}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.8 }}>
                      {language === 'en'
                        ? `Received (${myReceivedApprovals.length})`
                        : `받은 결재 (${myReceivedApprovals.length}건)`}
                    </Typography>
                    <List sx={{ p: 0 }}>
                      {myReceivedApprovals.slice(0, 3).map((approval: any) => (
                        <ListItem
                          key={approval.id}
                          sx={{
                            px: 0,
                            py: 0.4,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.hover' }
                          }}
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate('/work/approval');
                          }}
                        >
                          <ListItemText
                            primary={
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {approval.title}
                              </Typography>
                            }
                            secondary={
                              <Typography variant="caption" color="text.secondary">
                                {approval.requesterName} •{' '}
                                {new Date(approval.createdAt).toLocaleDateString(
                                  language === 'en' ? 'en-US' : 'ko-KR'
                                )}
                              </Typography>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
                {myRequestedApprovals.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.8 }}>
                      {language === 'en'
                        ? `My requests (${myRequestedApprovals.length})`
                        : `내가 요청한 결재 (${myRequestedApprovals.length}건)`}
                    </Typography>
                    <List sx={{ p: 0 }}>
                      {myRequestedApprovals.slice(0, 3).map((approval: any) => (
                        <ListItem
                          key={approval.id}
                          sx={{
                            px: 0,
                            py: 0.4,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.hover' }
                          }}
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate('/work/approval');
                          }}
                        >
                          <ListItemText
                            primary={
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {approval.title}
                              </Typography>
                            }
                            secondary={
                              <Typography variant="caption" color="text.secondary">
                                {t('dashboard.statusLabel')}: {approval.status === 'pending' ? t('dashboard.statusPending') : approval.status === 'approved' ? t('dashboard.statusApproved') : t('dashboard.statusRejected')} • {new Date(approval.createdAt).toLocaleDateString()}
                              </Typography>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </Box>
            ) : (
              <Box sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.secondary'
              }}>
                <Typography variant="body2">
                  {language === 'en' ? 'No approval documents.' : '결재 문서가 없습니다'}
                </Typography>
              </Box>
            )}
            </Box>
          </CardContent>
        </Card>
        )}

        {visibleDashboardCards.includes('projects') && (
        <Card elevation={0} sx={dashboardWidgetCardSx(visibleDashboardCards.indexOf('projects'))}>
          <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: DASHBOARD_CARD_PAD, overflow: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: DASHBOARD_CARD_SPACING, gap: 1 }}>
              <Box sx={dashboardCardTitleBar('primary')}>
                <WorkIcon color="primary" fontSize="small" />
                <Typography component="div" variant="subtitle1" sx={DASHBOARD_CARD_TITLE_TYPO}>
                  {language === 'en' ? 'My Assigned Work' : '내 담당 업무'}
                </Typography>
              </Box>
              <Button
                size="small"
                variant="text"
                onClick={() => {
                  if (myTasks.length > 0 && myTasks[0]?.boardId) {
                    navigate(`/work/projects/${myTasks[0].boardId}`);
                    return;
                  }
                  navigate('/work/projects');
                }}
              >
                {language === 'en' ? 'View all' : '모두 보기'}
              </Button>
            </Box>
            {myTasks.length > 0 ? (
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                <List sx={{ p: 0 }}>
                  {myTasks.slice(0, 5).map((task: any) => (
                    <ListItem
                      key={task.id}
                      sx={{
                        px: 0,
                        py: 0.8,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                      onClick={() => navigate(`/work/projects/${task.boardId}`)}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {task.title}
                            </Typography>
                            <Chip
                              size="small"
                              color={task.status === 'done' ? 'success' : task.status === 'in_progress' ? 'warning' : 'default'}
                              label={
                                task.status === 'done'
                                  ? (language === 'en' ? 'Done' : '완료')
                                  : task.status === 'in_progress'
                                    ? (language === 'en' ? 'In Progress' : '진행중')
                                    : (language === 'en' ? 'Todo' : '대기')
                              }
                            />
                          </Box>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {task.boardName} • {task.listName}
                            {task.dueDate ? ` • ${language === 'en' ? 'Due' : '마감'}: ${new Date(task.dueDate).toLocaleDateString()}` : ''}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            ) : (
              <Box sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.secondary'
              }}>
                <Typography variant="body2">
                  {language === 'en' ? 'No assigned work items.' : '담당 업무가 없습니다.'}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
        )}

        {visibleDashboardCards.includes('lowStock') && (
        <Card elevation={0} sx={dashboardWidgetCardSx(visibleDashboardCards.indexOf('lowStock'))}>
          <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: DASHBOARD_CARD_PAD, overflow: 'hidden', minHeight: 0 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: DASHBOARD_CARD_SPACING, gap: 1, flexShrink: 0 }}>
              <Box sx={dashboardCardTitleBar('error')}>
                <WarningIcon color="error" fontSize="small" />
                <Typography component="div" variant="subtitle1" sx={DASHBOARD_CARD_TITLE_TYPO}>
                  {language === 'en' ? 'Low Stock Alerts' : '재고 부족 알림'}
                </Typography>
              </Box>
              <Button
                size="small"
                variant="text"
                onClick={() => navigate('/inventory')}
              >
                {language === 'en' ? 'View all' : '모두 보기'}
              </Button>
            </Box>
            {lowStockItems.length > 0 ? (
              <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                <List sx={{ p: 0 }}>
                  {lowStockItems.slice(0, 5).map((item: any) => (
                    <ListItem
                      key={item.id}
                      sx={{
                        px: 0,
                        py: 0.4,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                      onClick={() => navigate('/inventory')}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'error.light', width: 32, height: 32 }}>
                          <Inventory sx={{ fontSize: '1rem' }} />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {item.name}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="error.main">
                            {language === 'en'
                              ? `Stock: ${Number(item.stock_quantity ?? 0)} (min. ${Number(item.min_stock_level ?? 0)})`
                              : `재고: ${Number(item.stock_quantity ?? 0)}개 · 최소 ${Number(item.min_stock_level ?? 0)}개 이하`}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            ) : (
              <Box sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.secondary'
              }}>
                <Typography variant="body2">
                  {language === 'en' ? 'No low stock alerts.' : '재고 부족 알림이 없습니다'}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
        )}

        {visibleDashboardCards.includes('recentTransactions') && (
        <Card elevation={0} sx={dashboardWidgetCardSx(visibleDashboardCards.indexOf('recentTransactions'))}>
          <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: DASHBOARD_CARD_PAD, overflow: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: DASHBOARD_CARD_SPACING, gap: 1 }}>
              <Box sx={dashboardCardTitleBar('primary')}>
                <Receipt color="primary" fontSize="small" />
                <Typography component="div" variant="subtitle1" sx={DASHBOARD_CARD_TITLE_TYPO}>
                  {language === 'en' ? 'Recent transactions' : '최근 거래'}
                </Typography>
              </Box>
              <Button
                size="small"
                variant="text"
                onClick={() => navigate('/accounting/invoices')}
              >
                {language === 'en' ? 'View all' : '모두 보기'}
              </Button>
            </Box>
            {recentInvoices.length > 0 ? (
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                <List sx={{ p: 0 }}>
                  {recentInvoices.slice(0, 5).map((invoice: any) => (
                    <ListItem
                      key={invoice.id}
                      sx={{
                        px: 0,
                        py: 0.4,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                      onClick={() => navigate('/accounting/invoices')}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {invoice.invoice_number || '-'}
                            </Typography>
                            <Chip
                              label={invoice.status === 'paid' ? t('dashboard.paid') : invoice.status === 'pending' ? t('dashboard.statusPending') : t('dashboard.unpaid')}
                              color={invoice.status === 'paid' ? 'success' : invoice.status === 'pending' ? 'warning' : 'default'}
                              size="small"
                            />
                          </Box>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {invoice.customer_name || t('dashboard.noCustomerName')} • {invoice.total_amount?.toLocaleString() || 0} • {new Date(invoice.created_at || invoice.createdAt).toLocaleDateString()}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            ) : (
              <Box sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.secondary'
              }}>
                <Typography variant="body2">
                  {language === 'en' ? 'No recent transactions.' : '최근 거래가 없습니다'}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
        )}

        {visibleDashboardCards.includes('vacationCalendar') && (
        <Card
          elevation={0}
          className="dashboard-vacation-calendar-card"
          sx={dashboardWidgetCardSx(visibleDashboardCards.indexOf('vacationCalendar'))}
        >
          <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: DASHBOARD_CARD_PAD, overflow: 'visible', minHeight: 0 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: DASHBOARD_CARD_SPACING, flexShrink: 0 }}>
              <Box sx={dashboardCardTitleBar('primary')}>
                <WorkIcon color="primary" fontSize="small" />
                <Typography component="div" variant="subtitle1" sx={DASHBOARD_CARD_TITLE_TYPO}>
                  {t('dashboard.vacationLeaveCalendar')}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                {(user?.role === 'admin' || user?.role === 'root') &&
                (dashboardLeaveDeptOptions.length > 0 || dashboardLeaveMapped.length > 0) ? (
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel shrink id="dash-vcal-dept">{t('vacationManagement.departmentFilter')}</InputLabel>
                    <Select
                      labelId="dash-vcal-dept"
                      label={t('vacationManagement.departmentFilter')}
                      value={dashboardLeaveDept}
                      onChange={(e) => setDashboardLeaveDept(e.target.value as string)}
                    >
                      <MenuItem value={CALENDAR_DEPARTMENT_ALL_VALUE}>
                        {t('vacationManagement.allDepartments')}
                      </MenuItem>
                      {dashboardLeaveDeptOptions.map((d) => (
                        <MenuItem key={d} value={d}>
                          {d}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : null}
                <Button
                  size="small"
                  variant="text"
                  onClick={() => navigate('/hr/leave')}
                >
                  {language === 'en' ? 'Open HR' : '휴가 관리'}
                </Button>
              </Box>
            </Box>
            <Box sx={{ width: '100%', flex: '1 1 auto', minHeight: 0, overflow: 'visible' }}>
              {(user?.role === 'admin' || user?.role === 'root') &&
              dashboardLeaveDeptOptions.length === 0 &&
              dashboardLeaveMapped.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t('dashboard.vacationLeaveCalendarEmpty')}
                </Typography>
              ) : (
                <>
                  <DepartmentLeaveCalendar
                    vacations={dashboardLeaveCalendarItems}
                    viewMonth={dashboardLeaveMonth}
                    onMonthChange={setDashboardLeaveMonth}
                    onSelectVacation={(v) => {
                      const tab = user?.role === 'admin' || user?.role === 'root' ? '0' : '1';
                      navigate(`/hr/leave?tab=${tab}&id=${v.id}`);
                    }}
                    language={i18n.language?.startsWith('en') ? 'en' : 'ko'}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    {t('vacationManagement.calendarStatusLegend')}
                  </Typography>
                </>
              )}
            </Box>
          </CardContent>
        </Card>
        )}

        {visibleDashboardCards.includes('notice') && (
        <Card elevation={0} sx={dashboardWidgetCardSx(visibleDashboardCards.indexOf('notice'))}>
          <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: DASHBOARD_CARD_PAD, overflow: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: DASHBOARD_CARD_SPACING, gap: 1 }}>
              <Box sx={dashboardCardTitleBar('primary')}>
                <AnnouncementIcon color="primary" fontSize="small" />
                <Typography component="div" variant="subtitle1" sx={DASHBOARD_CARD_TITLE_TYPO}>
                  {language === 'en' ? 'Notices' : '공지사항'}
                </Typography>
              </Box>
              <Button
                size="small"
                variant="text"
                onClick={() => navigate('/my/notices')}
              >
                {language === 'en' ? 'View all' : '모두 보기'}
              </Button>
            </Box>
            {notices.length > 0 ? (
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                <List sx={{ p: 0 }}>
                  {notices.slice(0, 5).map((notice: any) => (
                    <ListItem
                      key={notice.id}
                      sx={{
                        px: 1,
                        py: 0.55,
                        cursor: 'pointer',
                        borderLeft: notice.hasPoll ? '3px solid #F9A825' : '3px solid transparent',
                        bgcolor: notice.hasPoll ? '#FFF8E1' : 'transparent',
                        mb: 0.25,
                        '&:hover': { bgcolor: notice.hasPoll ? '#FFF3C4' : 'action.hover' },
                      }}
                      onClick={() => void openNoticeDetail(notice)}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                              {notice.title || '—'}
                            </Typography>
                            {notice.hasPoll ? (
                              <Chip
                                size="small"
                                label={language === 'en' ? 'Poll' : '투표'}
                                sx={{
                                  height: 18,
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  borderRadius: 0,
                                  bgcolor: '#F9A825',
                                  color: '#212121',
                                  flexShrink: 0,
                                }}
                              />
                            ) : null}
                          </Box>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {notice.published_at ||
                            notice.publishedAt ||
                            notice.created_at ||
                            notice.createdAt
                              ? new Date(
                                  notice.published_at ||
                                    notice.publishedAt ||
                                    notice.created_at ||
                                    notice.createdAt
                                ).toLocaleDateString(language === 'en' ? 'en-US' : 'ko-KR')
                              : ''}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            ) : (
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'text.secondary',
                  minHeight: 72
                }}
              >
                <Typography variant="body2">
                  {language === 'en' ? 'No notices.' : '등록된 공지가 없습니다.'}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
        )}

        {visibleDashboardCards.includes('expenseReceived') && (
        <Card
          elevation={0}
          onClick={() => navigate('/accounting/expense?tab=received')}
          sx={dashboardWidgetCardSx(visibleDashboardCards.indexOf('expenseReceived'), {
            cursor: 'pointer',
          })}
        >
          <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: DASHBOARD_CARD_PAD, overflow: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: DASHBOARD_CARD_SPACING, gap: 1 }}>
              <Box sx={dashboardCardTitleBar('primary')}>
                <ReceiptLongIcon color="primary" fontSize="small" />
                <Typography component="div" variant="subtitle1" sx={DASHBOARD_CARD_TITLE_TYPO}>
                  {language === 'en' ? 'Received Expense Approvals' : '지출결의서 받은거'}
                </Typography>
              </Box>
              <Button
                size="small"
                variant="text"
                onClick={(event) => {
                  event.stopPropagation();
                  navigate('/accounting/expense?tab=received');
                }}
              >
                {language === 'en' ? 'View all' : '모두 보기'}
              </Button>
            </Box>
            {receivedExpenses.length > 0 ? (
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                <List sx={{ p: 0 }}>
                  {receivedExpenses.slice(0, 5).map((expense: any) => (
                    <ListItem
                      key={expense.id}
                      sx={{
                        px: 0,
                        py: 0.8,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/accounting/expense?tab=received&id=${expense.id}`);
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                              {expense.title || expense.expense_id || '—'}
                            </Typography>
                            <Chip size="small" label={expense.status || '—'} />
                          </Box>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {expense.requester_name || expense.requesterName || '—'}
                            {' · '}
                            {floorDashboardMoney(
                              Number(expense.total_amount ?? expense.totalAmount ?? 0)
                            ).toLocaleString()}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            ) : (
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'text.secondary',
                  minHeight: 72,
                }}
              >
                <Typography variant="body2">
                  {language === 'en' ? 'No received expense approvals.' : '받은 지출결의서가 없습니다.'}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
        )}

        {visibleDashboardCards.includes('expenseTransfer') && (
        <Card
          elevation={0}
          onClick={() => navigate('/accounting/expense?tab=transfer')}
          sx={dashboardWidgetCardSx(visibleDashboardCards.indexOf('expenseTransfer'), {
            cursor: 'pointer',
          })}
        >
          <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: DASHBOARD_CARD_PAD, overflow: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: DASHBOARD_CARD_SPACING, gap: 1 }}>
              <Box sx={dashboardCardTitleBar('primary')}>
                <AccountBalanceWalletIcon color="primary" fontSize="small" />
                <Typography component="div" variant="subtitle1" sx={DASHBOARD_CARD_TITLE_TYPO}>
                  {language === 'en' ? 'Remittance List' : '송금할 리스트'}
                </Typography>
              </Box>
              <Button
                size="small"
                variant="text"
                onClick={(event) => {
                  event.stopPropagation();
                  navigate('/accounting/expense?tab=transfer');
                }}
              >
                {language === 'en' ? 'View all' : '모두 보기'}
              </Button>
            </Box>
            {transferExpenses.length > 0 ? (
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                <List sx={{ p: 0 }}>
                  {transferExpenses.slice(0, 5).map((expense: any) => {
                    const total = floorDashboardMoney(
                      Number(expense.total_amount ?? expense.totalAmount ?? 0)
                    );
                    const paid = floorDashboardMoney(
                      Number(expense.paid_amount ?? expense.paidAmount ?? 0)
                    );
                    const remaining = Math.max(0, total - paid);
                    return (
                      <ListItem
                        key={expense.id}
                        sx={{
                          px: 0,
                          py: 0.8,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/accounting/expense?tab=transfer&id=${expense.id}`);
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                                {expense.title || expense.expense_id || '—'}
                              </Typography>
                              <Chip
                                size="small"
                                color={remaining > 0 && paid > 0 ? 'warning' : 'default'}
                                label={
                                  remaining > 0 && paid > 0
                                    ? language === 'en'
                                      ? 'Partial'
                                      : '부분지급'
                                    : language === 'en'
                                      ? 'Pending'
                                      : '송금대기'
                                }
                              />
                            </Box>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary">
                              {expense.requester_name || expense.requesterName || '—'}
                              {' · '}
                              {language === 'en' ? 'Remain' : '잔액'} {remaining.toLocaleString()}
                            </Typography>
                          }
                        />
                      </ListItem>
                    );
                  })}
                </List>
              </Box>
            ) : (
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'text.secondary',
                  minHeight: 72,
                }}
              >
                <Typography variant="body2">
                  {language === 'en' ? 'No remittance items.' : '송금할 항목이 없습니다.'}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
        )}
      </Box>

      <Dialog
        open={scheduleDialogOpen}
        onClose={closeScheduleDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: '#0F172A', fontWeight: 700 }}>
          {language === 'en' ? 'Schedule Input' : '스케줄 입력'}
          {scheduleDialogDate && (
            <Typography variant="body2" sx={{ display: 'block', mt: 0.5, color: '#334155', fontWeight: 600 }}>
              {scheduleDialogDate.toLocaleDateString(language === 'en' ? 'en-US' : 'ko-KR')}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', gap: 1, mb: 1.2 }}>
            <TextField
              fullWidth
              size="small"
              value={newScheduleTitle}
              onChange={(e) => setNewScheduleTitle(e.target.value)}
              placeholder={language === 'en' ? 'Enter schedule' : '일정을 입력하세요'}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCustomSchedule();
                }
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#FFFFFF',
                },
                '& .MuiOutlinedInput-input': {
                  color: '#0F172A',
                  fontWeight: 500,
                },
                '& .MuiOutlinedInput-input::placeholder': {
                  color: '#64748B',
                  opacity: 1,
                },
              }}
            />
            <Button variant="contained" onClick={handleAddCustomSchedule}>
              {language === 'en' ? 'Add' : '추가'}
            </Button>
          </Box>
          <FormControlLabel
            sx={{
              mb: 1,
              '& .MuiFormControlLabel-label': {
                color: '#1E293B',
                fontWeight: 600,
                fontSize: '0.875rem',
              },
            }}
            control={
              <Switch
                checked={scheduleIsPublic}
                onChange={(e) => setScheduleIsPublic(e.target.checked)}
                color="primary"
              />
            }
            label={language === 'en' ? 'Public' : '공개'}
          />
          <Typography variant="caption" sx={{ display: 'block', mb: 1, color: '#64748B', fontWeight: 500 }}>
            {language === 'en'
              ? 'Public schedules are visible to colleagues on the weekly calendar.'
              : '공개 일정은 주간 스케줄에서 동료에게 표시됩니다.'}
          </Typography>

          <List sx={{ p: 0 }}>
            {scheduleDialogDate && (customCalendarSchedules[formatDateKey(scheduleDialogDate)] || []).length > 0 ? (
              (customCalendarSchedules[formatDateKey(scheduleDialogDate)] || []).map((item) => (
                <ListItem
                  key={item.id}
                  disableGutters
                  secondaryAction={
                    <Button
                      size="small"
                      color="error"
                      onClick={() => handleDeleteCustomSchedule(formatDateKey(scheduleDialogDate), item.id)}
                      sx={{ fontWeight: 700 }}
                    >
                      {language === 'en' ? 'Delete' : '삭제'}
                    </Button>
                  }
                  sx={{
                    px: 0.5,
                    py: 0.6,
                    borderBottom: '1px solid',
                    borderColor: 'divider'
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        {item.type === 'company_holiday' && (
                          <Chip
                            size="small"
                            color="warning"
                            label={language === 'en' ? 'Company Holiday' : '회사 휴일'}
                            sx={{ height: 22, fontWeight: 700 }}
                          />
                        )}
                        {item.isPublic && item.type !== 'company_holiday' && (
                          <Chip
                            size="small"
                            color="primary"
                            variant="outlined"
                            label={language === 'en' ? 'Public' : '공개'}
                            sx={{ height: 22, fontWeight: 700 }}
                          />
                        )}
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F172A' }}>
                          {item.title}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))
            ) : (
              <ListItem sx={{ px: 0, py: 1 }}>
                <ListItemText
                  primary={
                    <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600 }}>
                      {language === 'en' ? 'No schedules for this date.' : '이 날짜에 등록된 일정이 없습니다.'}
                    </Typography>
                  }
                />
              </ListItem>
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeScheduleDialog}>
            {language === 'en' ? 'Close' : '닫기'}
          </Button>
        </DialogActions>
      </Dialog>
      
      <Snackbar
        open={attendanceSnackbarOpen}
        autoHideDuration={4000}
        onClose={() => setAttendanceSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity={attendanceSeverity}
          onClose={() => setAttendanceSnackbarOpen(false)}
          sx={{ width: '100%' }}
        >
          {attendanceMessage || t('dashboard.processed')}
        </Alert>
      </Snackbar>
    </Box>
    );
  };

export default Dashboard;