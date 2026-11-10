import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import PhotoPreviewProvider from './components/Common/PhotoPreviewProvider';
import { useTranslation } from 'react-i18next';
import { theme as defaultTheme } from './theme';
import { createDynamicTheme } from './utils/themeUtils';
import { systemSettingsService } from './services/api';
import { useStore } from './store';
import { useErrorStore } from './store/errorStore';
import AppLayout from './components/Layout/AppLayout';
import Login from './pages/Auth/Login';
import TermsOfService from './pages/Legal/TermsOfService';
import PrivacyPolicy from './pages/Legal/PrivacyPolicy';
import CustomerCenter from './pages/Legal/CustomerCenter';
import LegalRouteGate from './pages/Legal/LegalRouteGate';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import SectionFirstAllowedRedirect from './components/Auth/SectionFirstAllowedRedirect';
import ErrorDialog from './components/Common/ErrorDialog';
import NotificationSnackbar from './components/Common/NotificationSnackbar';
import ErrorBoundary from './components/Common/ErrorBoundary';
import AppInstallBanner from './components/Common/AppInstallBanner';
import InputProperCaseListener from './components/Common/InputProperCaseListener';
import ScrollPreserveBridge from './components/Common/ScrollPreserveBridge';
import UnderDevelopment from './components/Common/UnderDevelopment';
import ComingSoon from './components/Common/ComingSoon';
import { lazyRoute } from './components/Common/LazyPage';

// 무거운 페이지는 방문 시에만 로드. 메뉴에 올리면 그 화면만 미리 받는다.
const Dashboard = lazyRoute('/dashboard', () => import('./pages/Dashboard/Dashboard'));
const PersonalDashboard = lazyRoute('/dashboard/personal', () => import('./pages/Dashboard/PersonalDashboard'));
const PersonalSettings = lazyRoute('/account/settings', () => import('./pages/Account/PersonalSettings'));
const TeamDashboard = lazyRoute('/dashboard/team', () => import('./pages/Dashboard/TeamDashboard'));
const AdminDashboard = lazyRoute('/dashboard/admin', () => import('./pages/Dashboard/AdminDashboard'));
const InventoryManagement = lazyRoute('/inventory/basic', () => import('./pages/Inventory/InventoryManagement'));
const UserManagement = lazyRoute(['/hr/users', '/users'], () => import('./pages/Users/UserManagement'));
const CompanyManagement = lazyRoute('/basic-info/company', () => import('./pages/Company/CompanyManagement'));
const PartnerManagement = lazyRoute('/basic-info/partners', () => import('./pages/Partners/PartnerManagement'));
const AttendanceManagement = lazyRoute(['/hr/attendance', '/my/attendance'], () => import('./pages/Attendance/AttendanceManagement'));
const WorkBoardsPage = lazyRoute('/work/projects', () => import('./pages/Work/WorkBoardsPage'));
const WorkBoardDetailPage = lazyRoute('/work/projects/:boardId', () => import('./pages/Work/WorkBoardDetailPage'));
const WorkAssigneeListPage = lazyRoute('/work/assignee-list', () => import('./pages/Work/WorkAssigneeListPage'));
const ProjectManagement = lazyRoute('/work/project-management', () => import('./pages/Projects/ProjectManagement'));
const ProjectDetailPage = lazyRoute('/work/project-management/:projectId', () => import('./pages/Projects/ProjectDetailPage'));
const EInvoiceManagement = lazyRoute('/accounting/e-invoice', () => import('./pages/Invoice/EInvoiceManagement'));
const ProformaInvoiceManagement = lazyRoute(['/proforma', '/accounting/proforma'], () => import('./pages/Invoice/ProformaInvoiceManagement'));
const QuotationManagement = lazyRoute(['/work/quotation', '/quotation', '/accounting/quotation'], () => import('./pages/Quotation/QuotationManagement'));
const InventoryStatus = lazyRoute('/inventory/status', () => import('./pages/Inventory/InventoryStatus'));
const InventoryReport = lazyRoute(['/inventory/report', '/reports/inventory'], () => import('./pages/Inventory/InventoryReport'));
const LotTrackingPage = lazyRoute('/production/lots', () => import('./pages/Production/LotTrackingPage'));
const CostAnalysis = lazyRoute(['/ai/cost-analysis', '/cost-analysis'], () => import('./pages/AI/CostAnalysis'));
const EfficiencyMetrics = lazyRoute(['/ai/efficiency-metrics', '/efficiency'], () => import('./pages/AI/EfficiencyMetrics'));
const ForecastingData = lazyRoute(['/ai/forecasting-data', '/forecasting'], () => import('./pages/AI/ForecastingData'));
const RecommendationEngine = lazyRoute(['/ai/recommendation-engine', '/recommendations'], () => import('./pages/AI/RecommendationEngine'));
const StockInSimple = lazyRoute('/inventory/stock-in', () => import('./pages/Inventory/StockInSimple'));
const StockOutBarcode = lazyRoute('/inventory/stock-out', () => import('./pages/Inventory/StockOutBarcode'));
const QuotationList = lazyRoute('/quotation/list', () => import('./pages/Invoice/QuotationList'));
const OrganizationChart = lazyRoute('/basic-info/organization', () => import('./pages/Organization/OrganizationChart'));
const MenuPermissionManagement = lazyRoute('/basic-info/menu-permissions', () => import('./pages/System/MenuPermissionManagement'));
const VacationManagement = lazyRoute(['/hr/leave', '/my/leave'], () => import('./pages/HR/VacationManagement'));
const VacationRequest = lazyRoute(['/hr/leave/request', '/my/leave/request'], () => import('./pages/HR/VacationRequest'));
const SystemSettings = lazyRoute(['/basic-info/system-settings', '/settings'], () => import('./pages/System/SystemSettings'));
const MailSendTest = lazyRoute('/basic-info/mail-send-test', () => import('./pages/System/MailSendTest'));
const LoginInfoManagement = lazyRoute('/basic-info/login-info', () => import('./pages/System/LoginInfoManagement'));
const NoticeManagement = lazyRoute('/my/notices', () => import('./pages/Communication/NoticeManagement'));
const MyPayslips = lazyRoute('/my/payslips', () => import('./pages/My/MyPayslips'));
const MyMailSettings = lazyRoute('/my/mail-settings', () => import('./pages/My/MyMailSettings'));
const MyWorkList = lazyRoute('/my/work-list', () => import('./pages/My/MyWorkList'));
const MyPersonalInfo = lazyRoute('/my/personal-info', () => import('./pages/My/MyPersonalInfo'));
const MyCompanyPolicies = lazyRoute('/my/company-policies', () => import('./pages/My/MyCompanyPolicies'));
const NotificationManagement = lazyRoute('/notifications', () => import('./pages/Notifications/NotificationManagement'));
const EmailManagement = lazyRoute('/communication/email', () => import('./pages/Communication/EmailManagement'));
const SMSManagement = lazyRoute('/communication/sms', () => import('./pages/Communication/SMSManagement'));
const DesktopNotifierDownload = lazyRoute('/communication/desktop-notifier', () => import('./pages/Communication/DesktopNotifierDownload'));
const PayrollManagement = lazyRoute('/hr/payroll', () => import('./pages/HR/PayrollManagement'));
const PayrollPayslipSend = lazyRoute('/hr/payslip-send', () => import('./pages/HR/PayslipSendSystem'));
const EmploymentContractManagement = lazyRoute(['/hr/employment-contracts', '/my/contracts'], () => import('./pages/HR/EmploymentContractManagement'));
const AttendanceStatistics = lazyRoute('/hr/attendance/statistics', () => import('./pages/HR/AttendanceStatistics'));
const WorkStatistics = lazyRoute('/work/statistics', () => import('./pages/Work/WorkStatistics'));
const ElectronicApproval = lazyRoute('/work/approval', () => import('./pages/Work/ElectronicApproval'));
const RoomBookingManagement = lazyRoute('/hotel/room-reservation', () => import('./pages/Work/RoomBookingManagement'));
const WorkReport = lazyRoute('/work/reports', () => import('./pages/Work/WorkReport'));
const FrontDesk = lazyRoute('/hotel/front-desk', () => import('./pages/Hotel/FrontDesk'));
const ReservationStatus = lazyRoute('/hotel/reservations', () => import('./pages/Hotel/ReservationStatus'));
const RoomTypeManagement = lazyRoute('/hotel/room-types', () => import('./pages/Hotel/RoomTypeManagement'));
const EInvoiceCreate = lazyRoute('/accounting/e-invoice/create', () => import('./pages/Invoice/EInvoiceCreate'));
const ExpenseApproval = lazyRoute('/accounting/expense', () => import('./pages/Accounting/ExpenseApproval'));
const ExpenseTransferLog = lazyRoute('/accounting/expense/transfer-log/:id', () => import('./pages/Accounting/ExpenseTransferLog'));
const AssetManagement = lazyRoute('/accounting/assets', () => import('./pages/Accounting/AssetManagement'));
const AccountingStatistics = lazyRoute('/accounting/statistics', () => import('./pages/Accounting/AccountingStatistics'));
const ExpenseReceiptUpload = lazyRoute('/expense-receipt-upload', () => import('./pages/Accounting/ExpenseReceiptUpload'));
const GeneralLedger = lazyRoute('/accounting/books', () => import('./pages/Accounting/GeneralLedger'));
const ProfitAndLoss = lazyRoute('/accounting/profit-and-loss', () => import('./pages/Accounting/ProfitAndLoss'));
const BalanceSheet = lazyRoute('/accounting/balance-sheet', () => import('./pages/Accounting/BalanceSheet'));
const CorporateTax = lazyRoute('/accounting/corporate-tax', () => import('./pages/Accounting/CorporateTax'));
const AdvanceTax = lazyRoute('/accounting/advance-tax', () => import('./pages/Accounting/AdvanceTax'));
const TallyImport = lazyRoute('/accounting/tally-import', () => import('./pages/Accounting/TallyImport'));
const SapImport = lazyRoute('/accounting/sap-import', () => import('./pages/Accounting/SapImport'));
const ContractManagement = lazyRoute('/customers/contracts', () => import('./pages/Sales/ContractManagement'));
const RegularInvoice = lazyRoute(['/invoice', '/accounting/invoice'], () => import('./pages/Invoice/RegularInvoice'));

const Reports = () => {
  const { t } = useTranslation();
  return (
    <UnderDevelopment 
      pageName={t('app.reportsTitle')}
      description={t('app.reportsDesc')}
      estimatedCompletion={t('app.estimatedCompletion')}
      features={[
        t('app.reportsFeature1'),
        t('app.reportsFeature2'),
        t('app.reportsFeature3'),
        t('app.reportsFeature4'),
        t('app.reportsFeature5')
      ]}
      status="planning"
    />
  );
};


const Chat = () => (
  <UnderDevelopment 
    pageName="채팅 시스템"
    description="실시간 채팅 및 커뮤니케이션 기능을 제공하는 페이지입니다."
    estimatedCompletion="2024년 12월"
    features={[
      "실시간 채팅",
      "파일 공유",
      "그룹 채팅",
      "채팅 히스토리",
      "알림 설정"
    ]}
    status="development"
  />
);

function App() {
  const { user } = useStore();
  const { removeOldErrors } = useErrorStore();
  const [currentTheme, setCurrentTheme] = useState(defaultTheme);

  // 주기적으로 오래된 에러 정리 (1시간마다)
  useEffect(() => {
    const interval = setInterval(() => {
      removeOldErrors();
    }, 60 * 60 * 1000); // 1시간

    return () => clearInterval(interval);
  }, [removeOldErrors]);

  // 시스템 설정의 라이트/다크 모드만 적용
  useEffect(() => {
    const loadThemeMode = async () => {
      if (!user) {
        setCurrentTheme(defaultTheme);
        return;
      }

      try {
        const response = await systemSettingsService.getSettings();
        const savedTheme = String(response?.data?.appearance?.theme || 'light');
        const normalizedTheme = savedTheme === 'ocean' ? 'forest' : savedTheme;
        const mode = ['light', 'dark', 'forest', 'sunset', 'lavender', 'graphite'].includes(normalizedTheme)
          ? (normalizedTheme as 'light' | 'dark' | 'forest' | 'sunset' | 'lavender' | 'graphite')
          : 'light';
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-app-theme', mode);
        }
        setCurrentTheme(
          createDynamicTheme({
            theme: mode
          })
        );
      } catch (error) {
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-app-theme', 'light');
        }
        setCurrentTheme(defaultTheme);
      }
    };

    loadThemeMode();
  }, [user]);

  return (
    <ThemeProvider theme={currentTheme}>
      <CssBaseline />
      <InputProperCaseListener />
      <PhotoPreviewProvider>
      <ErrorBoundary>
        <ErrorDialog />
        <NotificationSnackbar />
        <AppInstallBanner />
        <ScrollPreserveBridge />
        <Router>
          <Routes>
          {/* 인증 관련 라우트 */}
          <Route path="/login" element={<Login />} />
          <Route path="/legal/terms" element={<LegalRouteGate><TermsOfService /></LegalRouteGate>} />
          <Route path="/legal/privacy" element={<LegalRouteGate><PrivacyPolicy /></LegalRouteGate>} />
          <Route path="/legal/support" element={<LegalRouteGate><CustomerCenter /></LegalRouteGate>} />
          <Route path="/expense-receipt-upload" element={<ExpenseReceiptUpload />} />
          
          {/* 메인 애플리케이션 라우트 (인증 필요) */}
          <Route path="/" element={
            <ProtectedRoute>
              <AppLayout><Outlet /></AppLayout>
            </ProtectedRoute>
          }>
                  {/* 대시보드 */}
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="dashboard/personal" element={<PersonalDashboard />} />
                  <Route path="dashboard/team" element={<TeamDashboard />} />
                  <Route path="dashboard/admin" element={<AdminDashboard />} />
                  <Route path="account/settings" element={<PersonalSettings />} />
                  <Route path="dashboard/stats" element={<UnderDevelopment pageName="통계 대시보드" description="시스템 전반의 통계를 보여주는 페이지입니다." estimatedCompletion="2024년 12월" features={["실시간 통계", "통계 차트", "통계 분석", "통계 내보내기", "통계 알림"]} status="development" />} />
                  <Route path="dashboard/charts" element={<UnderDevelopment pageName="차트 대시보드" description="다양한 차트로 데이터를 시각화하는 페이지입니다." estimatedCompletion="2024년 12월" features={["인터랙티브 차트", "차트 커스터마이징", "차트 내보내기", "차트 공유", "차트 분석"]} status="development" />} />
                  <Route path="dashboard/monitoring" element={<UnderDevelopment pageName="실시간 모니터링" description="시스템을 실시간으로 모니터링하는 페이지입니다." estimatedCompletion="2024년 12월" features={["실시간 모니터링", "알림 관리", "성능 지표", "모니터링 설정", "모니터링 보고서"]} status="development" />} />
            
            {/* 기본정보관리 */}
            <Route path="basic-info" element={<Navigate to="/basic-info/company" replace />} />
            <Route path="basic-info/company" element={<CompanyManagement />} />
            <Route path="basic-info/partners" element={<PartnerManagement />} />
            <Route path="customers/info" element={<Navigate to="/basic-info/partners" replace />} />
            <Route path="basic-info/organization" element={<OrganizationChart />} />
            <Route path="basic-info/menu-permissions" element={<MenuPermissionManagement />} />
            <Route path="basic-info/login-info" element={<LoginInfoManagement />} />
            <Route path="basic-info/system-settings" element={<SystemSettings />} />
            <Route path="basic-info/mail-send-test" element={<MailSendTest />} />
            
            {/* 인사관리 — 권한 있는 첫 하위 메뉴로 이동 (고정 /hr/users 금지) */}
            <Route
              path="hr"
              element={
                <SectionFirstAllowedRedirect
                  candidates={[
                    '/hr/users',
                    '/hr/employment-contracts',
                    '/hr/attendance',
                    '/hr/attendance/statistics',
                    '/hr/leave',
                    '/hr/payroll',
                    '/hr/payslip-send',
                  ]}
                />
              }
            />
            <Route path="hr/users" element={<UserManagement />} />
            <Route
              path="hr/departments"
              element={<Navigate replace to={`/hr/users?tab=departments`} />}
            />
            <Route
              path="hr/positions"
              element={<Navigate replace to={`/hr/users?tab=positions`} />}
            />
            <Route path="hr/attendance/statistics" element={<AttendanceStatistics />} />
            <Route path="hr/attendance" element={<AttendanceManagement />} />
            <Route path="hr/payroll" element={<PayrollManagement />} />
            <Route path="hr/payslip-send" element={<PayrollPayslipSend />} />
            <Route path="hr/leave" element={<VacationManagement />} />
            <Route path="hr/leave/request" element={<VacationRequest />} />
            <Route path="hr/leave/request/:id" element={<VacationRequest />} />
            <Route path="hr/employment-contracts" element={<EmploymentContractManagement />} />

            {/* 내 정보·업무 (셀프서비스) */}
            <Route path="my" element={<Navigate to="/my/personal-info" replace />} />
            <Route path="my/personal-info" element={<MyPersonalInfo />} />
            <Route path="my/attendance" element={<AttendanceManagement />} />
            <Route path="my/payslips" element={<MyPayslips />} />
            <Route path="my/contracts" element={<EmploymentContractManagement />} />
            <Route path="my/notices" element={<NoticeManagement />} />
            <Route path="my/leave" element={<VacationManagement />} />
            <Route path="my/leave/request" element={<VacationRequest />} />
            <Route path="my/leave/request/:id" element={<VacationRequest />} />
            <Route path="my/work-list" element={<MyWorkList />} />
            <Route path="my/company-policies" element={<MyCompanyPolicies />} />
            <Route path="my/mail-settings" element={<MyMailSettings />} />
            
            {/* 업무관리 */}
            <Route path="work" element={<Navigate to="/work/projects" replace />} />
            <Route path="work/projects" element={<WorkBoardsPage />} />
            <Route path="work/projects/:boardId" element={<WorkBoardDetailPage />} />
            <Route path="work/assignee-list" element={<WorkAssigneeListPage />} />
            <Route path="work/project-management" element={<ProjectManagement />} />
            <Route path="work/project-management/:projectId" element={<ProjectDetailPage />} />
            <Route path="customers/contracts" element={<ContractManagement />} />
            <Route path="work/statistics" element={<WorkStatistics />} />
            <Route path="work/approval" element={<ElectronicApproval />} />
            <Route path="work/quotation" element={<QuotationManagement />} />
            <Route path="work/room-reservation" element={<Navigate to="/hotel/room-reservation" replace />} />
            <Route path="work/reports" element={<WorkReport />} />
            
            {/* 호텔 관리 */}
            <Route path="hotel" element={<Navigate to="/hotel/front-desk" replace />} />
            <Route path="hotel/front-desk" element={<FrontDesk />} />
            <Route path="hotel/reservations" element={<ReservationStatus />} />
            <Route path="hotel/room-types" element={<RoomTypeManagement />} />
            <Route path="hotel/room-reservation" element={<RoomBookingManagement />} />

            {/* 재고관리 */}
            <Route path="inventory" element={<Navigate to="/inventory/basic" replace />} />
            <Route path="inventory/basic" element={<InventoryManagement />} />
            <Route path="inventory/status" element={<InventoryStatus />} />
            <Route path="inventory/transaction" element={<Navigate to="/inventory/stock-in" replace />} />
            <Route path="inventory/movement" element={<Navigate to="/inventory/stock-out" replace />} />
            <Route path="inventory/stock-in" element={<StockInSimple />} />
            <Route path="inventory/stock-out" element={<StockOutBarcode />} />
            <Route path="inventory/report" element={<InventoryReport />} />

            <Route path="production" element={<Navigate to="/production/lots" replace />} />
            <Route path="production/lots" element={<LotTrackingPage />} />
            
            {/* 견적서 관리 */}
            <Route path="quotation" element={<QuotationManagement />} />
            <Route path="quotation/list" element={<QuotationList />} />
            <Route path="quotation/create" element={<UnderDevelopment pageName="견적서 작성" description="새로운 견적서를 작성하는 페이지입니다." estimatedCompletion="2024년 12월" features={["견적서 작성", "템플릿 사용", "자동 계산", "미리보기", "저장 및 발송"]} status="development" />} />
            <Route path="quotation/approval" element={<UnderDevelopment pageName="견적서 승인" description="견적서 승인 워크플로우를 관리하는 페이지입니다." estimatedCompletion="2024년 12월" features={["승인 워크플로우", "승인 이력", "알림 관리", "승인 통계", "자동 승인"]} status="development" />} />
            <Route path="quotation/templates" element={<UnderDevelopment pageName="견적서 템플릿" description="견적서 템플릿을 관리하는 페이지입니다." estimatedCompletion="2024년 12월" features={["템플릿 생성", "템플릿 편집", "템플릿 공유", "템플릿 분류", "템플릿 통계"]} status="development" />} />
            
            {/* 프로포마 인보이스 */}
            <Route path="proforma" element={<ProformaInvoiceManagement />} />
            <Route path="proforma/list" element={<UnderDevelopment pageName="프로포마 목록" description="생성된 프로포마 인보이스 목록을 관리하는 페이지입니다." estimatedCompletion="2024년 12월" features={["프로포마 목록 조회", "상태별 필터링", "검색 기능", "일괄 작업", "내보내기"]} status="development" />} />
            <Route path="proforma/create" element={<UnderDevelopment pageName="프로포마 작성" description="새로운 프로포마 인보이스를 작성하는 페이지입니다." estimatedCompletion="2024년 12월" features={["프로포마 작성", "견적서 연동", "자동 계산", "미리보기", "저장 및 발송"]} status="development" />} />
            <Route path="proforma/approval" element={<UnderDevelopment pageName="프로포마 승인" description="프로포마 인보이스 승인 워크플로우를 관리하는 페이지입니다." estimatedCompletion="2024년 12월" features={["승인 워크플로우", "승인 이력", "알림 관리", "승인 통계", "자동 승인"]} status="development" />} />
            <Route path="proforma/convert" element={<UnderDevelopment pageName="인보이스 변환" description="프로포마 인보이스를 정식 인보이스로 변환하는 페이지입니다." estimatedCompletion="2024년 12월" features={["인보이스 변환", "데이터 이관", "변환 이력", "변환 통계", "자동 변환"]} status="development" />} />
            
            {/* 일반 인보이스 */}
            <Route path="invoice" element={<RegularInvoice />} />
            <Route path="invoice/list" element={<UnderDevelopment pageName="인보이스 목록" description="생성된 인보이스 목록을 관리하는 페이지입니다." estimatedCompletion="2024년 12월" features={["인보이스 목록 조회", "상태별 필터링", "검색 기능", "일괄 작업", "내보내기"]} status="development" />} />
            <Route path="invoice/create" element={<UnderDevelopment pageName="인보이스 작성" description="새로운 인보이스를 작성하는 페이지입니다." estimatedCompletion="2024년 12월" features={["인보이스 작성", "템플릿 사용", "자동 계산", "미리보기", "저장 및 발송"]} status="development" />} />
            <Route path="invoice/approval" element={<UnderDevelopment pageName="인보이스 승인" description="인보이스 승인 워크플로우를 관리하는 페이지입니다." estimatedCompletion="2024년 12월" features={["승인 워크플로우", "승인 이력", "알림 관리", "승인 통계", "자동 승인"]} status="development" />} />
            <Route path="invoice/dispatch" element={<UnderDevelopment pageName="인보이스 발송" description="인보이스를 고객에게 발송하는 페이지입니다." estimatedCompletion="2024년 12월" features={["이메일 발송", "SMS 발송", "우편 발송", "발송 이력", "발송 통계"]} status="development" />} />
            
            {/* E-인보이스 - 메뉴 경로와 일치하도록 리다이렉트 */}
            <Route path="e-invoice" element={<Navigate to="/accounting/e-invoice" replace />} />
            <Route path="e-invoice/list" element={<Navigate to="/accounting/e-invoice" replace />} />
            <Route path="e-invoice/create" element={<Navigate to="/accounting/e-invoice/create" replace />} />
            <Route path="e-invoice/send" element={<Navigate to="/accounting/e-invoice" replace />} />
            <Route path="e-invoice/status" element={<Navigate to="/accounting/e-invoice" replace />} />
            
            {/* E-Way Bill */}
            <Route path="eway-bill" element={<Navigate to="/basic-info/partners" replace />} />
            <Route path="eway-bill/list" element={<Navigate to="/basic-info/partners" replace />} />
            <Route path="eway-bill/create" element={<Navigate to="/basic-info/partners" replace />} />
            <Route path="eway-bill/send" element={<Navigate to="/basic-info/partners" replace />} />
            <Route path="eway-bill/track" element={<Navigate to="/basic-info/partners" replace />} />
            <Route path="accounting/eway-bill" element={<Navigate to="/basic-info/partners" replace />} />
            
            {/* 매입/매출 관리 */}
            <Route path="sales" element={<Navigate to="/accounting/quotation" replace />} />
            <Route path="customers" element={<Navigate to="/basic-info/partners" replace />} />
            <Route path="accounting/quotation" element={<QuotationManagement />} />
            <Route path="accounting/proforma" element={<ProformaInvoiceManagement />} />
            <Route path="accounting/e-invoice" element={<EInvoiceManagement />} />
            <Route path="accounting/e-invoice/create" element={<EInvoiceCreate />} />
            <Route path="accounting/invoice" element={<RegularInvoice />} />
            <Route path="accounting/expense" element={<ExpenseApproval />} />
            <Route path="accounting/expense/transfer-log/:id" element={<ExpenseTransferLog />} />
            <Route path="accounting/statistics" element={<AccountingStatistics />} />
            
            {/* 회계관리 */}
            <Route path="accounting" element={<Navigate to="/accounting/books" replace />} />
            <Route path="accounting/basic-info" element={<Navigate to="/accounting/books" replace />} />
            <Route path="accounting/budget" element={<Navigate to="/accounting/books" replace />} />
            <Route path="accounting/assets" element={<AssetManagement />} />
            <Route path="accounting/books" element={<GeneralLedger />} />
            <Route path="accounting/chart-of-accounts" element={<Navigate to="/accounting/books?tab=accounts" replace />} />
            <Route path="accounting/tally-import" element={<TallyImport />} />
            <Route path="accounting/sap-import" element={<SapImport />} />
            <Route path="accounting/vouchers" element={<Navigate to="/accounting/books?tab=vouchers" replace />} />
            <Route path="accounting/ledger" element={<Navigate to="/accounting/books?tab=ledger" replace />} />
            <Route path="accounting/trial-balance" element={<Navigate to="/accounting/books?tab=trial" replace />} />
            <Route path="accounting/profit-and-loss" element={<ProfitAndLoss />} />
            <Route path="accounting/balance-sheet" element={<BalanceSheet />} />
            <Route path="accounting/corporate-tax" element={<CorporateTax />} />
            <Route path="accounting/advance-tax" element={<AdvanceTax />} />
            <Route path="accounting/voucher-entry" element={<Navigate to="/accounting/tally-import" replace />} />
            <Route path="accounting/voucher-list" element={<Navigate to="/accounting/books?tab=vouchers" replace />} />
            <Route path="accounting/settings/masters" element={<Navigate to="/accounting/books" replace />} />
            <Route path="accounting/auto-voucher" element={<Navigate to="/accounting/tally-import" replace />} />
            <Route path="accounting/document-voucher" element={<Navigate to="/accounting/tally-import" replace />} />
            
            {/* 보고서 */}
            <Route path="reports" element={<Reports />} />
            <Route path="reports/sales" element={<UnderDevelopment pageName="매출 보고서" description="매출 관련 보고서를 생성하는 페이지입니다." estimatedCompletion="2025년 1월" features={["매출 분석", "매출 추이", "고객별 매출", "상품별 매출", "매출 예측"]} status="planning" />} />
            <Route path="reports/inventory" element={<InventoryReport />} />
            <Route path="reports/customers" element={<UnderDevelopment pageName="고객 보고서" description="고객 관련 보고서를 생성하는 페이지입니다." estimatedCompletion="2025년 1월" features={["고객 분석", "고객 분류", "고객 행동 분석", "고객 예측", "고객 최적화"]} status="planning" />} />
            <Route path="reports/financial" element={<UnderDevelopment pageName="재무 보고서" description="재무 관련 보고서를 생성하는 페이지입니다." estimatedCompletion="2025년 1월" features={["재무 분석", "수익성 분석", "현금흐름 분석", "재무 예측", "재무 최적화"]} status="planning" />} />
            <Route path="reports/ai" element={<UnderDevelopment pageName="AI 분석 보고서" description="AI 기반 분석 보고서를 생성하는 페이지입니다." estimatedCompletion="2025년 2월" features={["AI 분석", "예측 모델링", "패턴 분석", "자동 인사이트", "추천 시스템"]} status="planning" />} />
            
            {/* 사용자 관리 */}
            <Route path="users" element={<UserManagement />} />
            <Route path="users/list" element={<UnderDevelopment pageName="사용자 목록" description="등록된 사용자 목록을 관리하는 페이지입니다." estimatedCompletion="2024년 12월" features={["사용자 목록 조회", "검색 및 필터링", "사용자 상태 관리", "일괄 작업", "내보내기"]} status="development" />} />
            <Route path="users/register" element={<UnderDevelopment pageName="사용자 등록" description="새로운 사용자를 등록하는 페이지입니다." estimatedCompletion="2024년 12월" features={["사용자 정보 등록", "권한 설정", "역할 할당", "계정 활성화", "자동 중복 검사"]} status="development" />} />
            <Route path="users/permissions" element={<UnderDevelopment pageName="권한 관리" description="사용자 권한을 관리하는 페이지입니다." estimatedCompletion="2024년 12월" features={["권한 그룹 관리", "권한 설정", "권한 할당", "권한 이력", "권한 통계"]} status="development" />} />
            <Route path="users/roles" element={<UnderDevelopment pageName="역할 관리" description="사용자 역할을 관리하는 페이지입니다." estimatedCompletion="2024년 12월" features={["역할 생성", "역할 편집", "역할 할당", "역할 이력", "역할 통계"]} status="development" />} />
            
            {/* 시스템 설정 */}
            <Route path="settings" element={<SystemSettings />} />
            <Route path="settings/general" element={<UnderDevelopment pageName="일반 설정" description="시스템의 일반적인 설정을 관리하는 페이지입니다." estimatedCompletion="2024년 12월" features={["기본 설정", "언어 설정", "시간대 설정", "테마 설정", "알림 설정"]} status="development" />} />
            <Route path="settings/company" element={<UnderDevelopment pageName="회사 정보" description="회사 정보를 관리하는 페이지입니다." estimatedCompletion="2024년 12월" features={["회사 기본 정보", "회사 로고", "회사 주소", "연락처 정보", "회사 설정"]} status="development" />} />
            <Route path="settings/gst" element={<UnderDevelopment pageName="GST 설정" description="GST 관련 설정을 관리하는 페이지입니다." estimatedCompletion="2024년 12월" features={["GST 설정", "세율 설정", "GST 포털 연동", "GST 보고서", "GST 검증"]} status="development" />} />
            <Route path="settings/security" element={<UnderDevelopment pageName="보안 설정" description="시스템 보안 설정을 관리하는 페이지입니다." estimatedCompletion="2024년 12월" features={["보안 정책", "암호 정책", "접근 제어", "보안 로그", "보안 알림"]} status="development" />} />
            <Route path="settings/integration" element={<UnderDevelopment pageName="통합 설정" description="외부 시스템과의 통합 설정을 관리하는 페이지입니다." estimatedCompletion="2024년 12월" features={["API 설정", "웹훅 설정", "데이터 동기화", "통합 테스트", "통합 모니터링"]} status="development" />} />
            
            {/* 알림 */}
            <Route path="notifications" element={<NotificationManagement />} />
            <Route path="ai" element={<Navigate to="/ai/cost-analysis" replace />} />
            <Route path="ai/cost-analysis" element={<CostAnalysis />} />
            <Route path="ai/efficiency-metrics" element={<EfficiencyMetrics />} />
            <Route path="ai/forecasting-data" element={<ForecastingData />} />
            <Route path="ai/recommendation-engine" element={<RecommendationEngine />} />
            
            {/* 알람 (/communication) */}
            <Route path="communication" element={<Navigate to="/communication/desktop-notifier" replace />} />
            <Route path="communication/notice" element={<Navigate to="/my/notices" replace />} />
            <Route path="communication/notices" element={<Navigate to="/my/notices" replace />} />
            <Route path="communication/email" element={<EmailManagement />} />
            <Route path="communication/sms" element={<SMSManagement />} />
            <Route path="communication/desktop-notifier" element={<DesktopNotifierDownload />} />
            
            {/* 시스템관리 - 제거됨 (기본정보관리의 시스템 설정으로 대체) */}
            
            {/* AI 분석 단축 경로 */}
            <Route path="efficiency" element={<EfficiencyMetrics />} />
            <Route path="cost-analysis" element={<CostAnalysis />} />
            <Route path="forecasting" element={<ForecastingData />} />
            <Route path="recommendations" element={<RecommendationEngine />} />
            
            {/* 채팅 */}
            <Route path="chat" element={<Chat />} />

            {/* 로그인 후 미등록 경로 — 빈 Outlet/루프 대신 안내 (보호 레이아웃 유지) */}
            <Route
              path="*"
              element={
                <ComingSoon
                  pageName="페이지"
                  description="요청하신 페이지를 찾을 수 없습니다. 메뉴에서 다시 선택하거나 대시보드로 이동해 주세요."
                />
              }
            />
          </Route>
          
          {/* 보호 라우트 밖 404 */}
          <Route path="*" element={<ComingSoon pageName="페이지" description="요청하신 페이지는 현재 준비 중입니다." />} />
        </Routes>
        </Router>
      </ErrorBoundary>
      </PhotoPreviewProvider>
    </ThemeProvider>
  );
}

export default App;