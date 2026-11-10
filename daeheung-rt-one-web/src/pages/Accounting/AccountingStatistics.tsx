import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  MenuItem,
  Button,
  Stack,
  Chip,
  Divider,
  Grid,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import {
  mvsPageRootSx,
  mvsKpiCardSx,
  mvsBodyCardSx,
  mvsBodyPrimaryBtnSx,
  mvsBodySectionHeaderSx,
  mvsBodyListZoneSx,
  mvsBodyPaginationSx,
  mvsSearchFieldSx,
  mvsFilterFieldHeightSx,
  mvsTableScrollSx,
  mvsTableHeadHighlightSx,
  mvsTableBodyRowSx,
  mvsOutlinedLabelProps } from '../../theme/daeheungLayout';
import {
  Download as DownloadIcon,
  Search as SearchIcon,
  ShowChart as ShowChartIcon,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  ReceiptLong as ReceiptLongIcon,
  ShoppingCart as ShoppingCartIcon } from '@mui/icons-material';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Area,
  Legend,
  ComposedChart } from 'recharts';
import { alpha, useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store';
import { accountingService } from '../../services/api';
import { UTILS } from '../../constants';
import { shortCompanyName } from '../../utils/companyDisplayName';

type PeriodMode = 'date' | 'quarter' | 'fiscalYear';

type FyOption = {
  startYear: number;
  start_date: string;
  end_date: string;
  label: string;
};

const toYmdLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getIndiaFyStartYear = (now = new Date()) =>
  now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;

const buildFiscalYearOptions = (now = new Date(), past = 3, future = 3): FyOption[] => {
  const currentStart = getIndiaFyStartYear(now);
  const options: FyOption[] = [];
  for (let y = currentStart - past; y <= currentStart + future; y += 1) {
    options.push({
      startYear: y,
      start_date: `${y}-04-01`,
      end_date: `${y + 1}-03-31`,
      label: `FY ${y}-${String(y + 1).slice(-2)}` });
  }
  return options;
};

const parseYmdLocal = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const getFyQuarterRange = (fy: FyOption, quarter: 1 | 2 | 3 | 4) => {
  const fyStart = parseYmdLocal(fy.start_date);
  const qStart = new Date(fyStart.getFullYear(), fyStart.getMonth() + (quarter - 1) * 3, fyStart.getDate());
  const qEndExclusive = new Date(fyStart.getFullYear(), fyStart.getMonth() + quarter * 3, fyStart.getDate());
  const qEnd = new Date(qEndExclusive);
  qEnd.setDate(qEnd.getDate() - 1);
  let from = toYmdLocal(qStart);
  let to = toYmdLocal(qEnd);
  if (from < fy.start_date) from = fy.start_date;
  if (to > fy.end_date) to = fy.end_date;
  return { start_date: from, end_date: to };
};

interface AccountingStats {
  totalRevenue: number;
  combinedRevenue?: number;
  roomBookingRevenue?: number;
  collectedRevenue?: number;
  outstandingRevenue?: number;
  totalExpenses: number;
  netProfit: number;
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
  overdueInvoices: number;
  profitMargin: number;
  revenueGrowth: number;
  expenseGrowth: number;
  averageInvoiceAmount: number;
}

interface TrendRow {
  month?: string;
  quarter?: string;
  day?: string;
  revenue: number;
  expenses: number;
  profit: number;
  budget: number;
}

interface CategoryRow {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

interface InvoiceStatusRow {
  status: string;
  count: number;
  amount: number;
  color: string;
}

interface SalesListRow {
  id: number;
  source: 'invoice' | 'room_booking';
  document_number: string;
  date: string;
  counterparty: string;
  category: string;
  amount: number;
  tax_amount: number;
  status: string;
  payment_status: string;
}

interface PurchaseLineItem {
  description: string;
  qty: number;
  unit_price: number;
  amount: number;
}

interface PurchaseListRow {
  id: number;
  document_number: string;
  date: string;
  title: string;
  requester: string;
  department: string;
  purpose: string;
  amount: number;
  currency: string;
  status: string;
  payment_status: string;
  partner_name?: string | null;
  remarks?: string | null;
  line_items?: PurchaseLineItem[];
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ mb: 3 }}>{children}</Box>}
    </div>
  );
}

const accountingStatsFilterFieldSx = {
  ...(mvsSearchFieldSx as Record<string, unknown>),
  ...mvsFilterFieldHeightSx } as const;

const LIST_PAGE_SIZE = 15;

type ListViewMode = 'page' | 'all';

const listViewModeBarSx = {
  mb: 1.25,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 0.75 } as const;

const listViewModeBtnSx = {
  height: 32,
  minWidth: 0,
  px: 1.5,
  textTransform: 'none' as const,
  fontWeight: 600,
  fontSize: '0.75rem',
  borderRadius: '10px',
  boxShadow: 'none',
  whiteSpace: 'nowrap' as const };

const ListViewModeButtons: React.FC<{
  value: ListViewMode;
  onChange: (mode: ListViewMode) => void;
  allLabel: string;
  pageLabel: string;
}> = ({ value, onChange, allLabel, pageLabel }) => (
  <Box sx={listViewModeBarSx}>
    <Button
      size="small"
      disableElevation
      variant={value === 'all' ? 'contained' : 'outlined'}
      onClick={() => onChange('all')}
      sx={{
        ...listViewModeBtnSx,
        ...(value === 'all'
          ? { bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' } }
          : { borderColor: '#CBD5E1', color: 'text.secondary', bgcolor: '#FFFFFF' }) }}
    >
      {allLabel}
    </Button>
    <Button
      size="small"
      disableElevation
      variant={value === 'page' ? 'contained' : 'outlined'}
      onClick={() => onChange('page')}
      sx={{
        ...listViewModeBtnSx,
        ...(value === 'page'
          ? { bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' } }
          : { borderColor: '#CBD5E1', color: 'text.secondary', bgcolor: '#FFFFFF' }) }}
    >
      {pageLabel}
    </Button>
  </Box>
);

const bodyCardTableContainerSx = {
  ...mvsTableScrollSx,
  width: '100%',
  maxWidth: '100%' } as const;

const listStateInlineSx = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  py: 6,
  px: 2 } as const;

const AccountingStatistics: React.FC = () => {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const { user } = useStore();
  const canSelectCompany = false;
  const [stats, setStats] = useState<AccountingStats>({
    totalRevenue: 0,
    combinedRevenue: 0,
    roomBookingRevenue: 0,
    collectedRevenue: 0,
    outstandingRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    totalInvoices: 0,
    paidInvoices: 0,
    pendingInvoices: 0,
    overdueInvoices: 0,
    profitMargin: 0,
    revenueGrowth: 0,
    expenseGrowth: 0,
    averageInvoiceAmount: 0 });
  const [periodMode, setPeriodMode] = useState<PeriodMode>('fiscalYear');
  const fyOptions = useMemo(() => buildFiscalYearOptions(), []);
  const currentFyStartYear = useMemo(() => getIndiaFyStartYear(), []);
  const [fyStartYear, setFyStartYear] = useState(currentFyStartYear);
  const [selectedQuarter, setSelectedQuarter] = useState<1 | 2 | 3 | 4>(1);
  const [dateFrom, setDateFrom] = useState(() => {
    const fy = buildFiscalYearOptions().find((o) => o.startYear === getIndiaFyStartYear());
    return fy?.start_date || toYmdLocal(new Date());
  });
  const [dateTo, setDateTo] = useState(() => toYmdLocal(new Date()));
  const [appliedRangeLabel, setAppliedRangeLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | ''>(user?.company_id ?? '');
  const [monthlyRevenueData, setMonthlyRevenueData] = useState<TrendRow[]>([]);
  const [categoryExpenseData, setCategoryExpenseData] = useState<CategoryRow[]>([]);
  const [categoryRevenueData, setCategoryRevenueData] = useState<CategoryRow[]>([]);
  const [invoiceStatusData, setInvoiceStatusData] = useState<InvoiceStatusRow[]>([]);
  const [quarterlyData, setQuarterlyData] = useState<TrendRow[]>([]);
  const [dailyData, setDailyData] = useState<TrendRow[]>([]);
  const [salesList, setSalesList] = useState<SalesListRow[]>([]);
  const [salesTotal, setSalesTotal] = useState(0);
  const [purchaseList, setPurchaseList] = useState<PurchaseListRow[]>([]);
  const [purchaseTotal, setPurchaseTotal] = useState(0);
  const [purchasePaidTotal, setPurchasePaidTotal] = useState(0);
  const [salesPage, setSalesPage] = useState(1);
  const [purchasePage, setPurchasePage] = useState(1);
  const [salesListViewMode, setSalesListViewMode] = useState<ListViewMode>('page');
  const [purchaseListViewMode, setPurchaseListViewMode] = useState<ListViewMode>('page');
  const [purchaseDetail, setPurchaseDetail] = useState<PurchaseListRow | null>(null);

  const selectedFy = useMemo(
    () =>
      fyOptions.find((o) => o.startYear === fyStartYear) ||
      fyOptions.find((o) => o.startYear === currentFyStartYear) ||
      fyOptions[0],
    [fyOptions, fyStartYear, currentFyStartYear]
  );

  const getQuarterLabel = useCallback(
    (quarter: 1 | 2 | 3 | 4) => t(`purchaseSalesStats.quarters.q${quarter}`),
    [t]
  );

  const resolveQueryRange = useCallback(() => {
    if (periodMode === 'date') {
      const start = dateFrom || dateTo;
      const end = dateTo || dateFrom;
      return {
        start_date: start,
        end_date: end,
        label: t('purchaseSalesStats.appliedRange.byDate', { start: start || '-', end: end || '-' }) };
    }
    if (!selectedFy) {
      return { start_date: '', end_date: '', label: '' };
    }
    if (periodMode === 'quarter') {
      const range = getFyQuarterRange(selectedFy, selectedQuarter);
      return {
        ...range,
        label: t('purchaseSalesStats.appliedRange.byQuarter', {
          fy: selectedFy.label,
          quarterLabel: getQuarterLabel(selectedQuarter) }) };
    }
    return {
      start_date: selectedFy.start_date,
      end_date: selectedFy.end_date,
      label: t('purchaseSalesStats.appliedRange.byFiscalYear', { fy: selectedFy.label }) };
  }, [periodMode, dateFrom, dateTo, selectedFy, selectedQuarter, t, getQuarterLabel]);

  // 언어 전환 시 적용 기간 문구만 갱신
  useEffect(() => {
    if (!appliedRangeLabel) return;
    setAppliedRangeLabel(resolveQueryRange().label);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 언어 변경 시에만
  }, [i18n.language]);

  const displayedSalesList = useMemo(() => {
    if (salesListViewMode === 'all') return salesList;
    const start = (salesPage - 1) * LIST_PAGE_SIZE;
    return salesList.slice(start, start + LIST_PAGE_SIZE);
  }, [salesList, salesPage, salesListViewMode]);

  const displayedPurchaseList = useMemo(() => {
    if (purchaseListViewMode === 'all') return purchaseList;
    const start = (purchasePage - 1) * LIST_PAGE_SIZE;
    return purchaseList.slice(start, start + LIST_PAGE_SIZE);
  }, [purchaseList, purchasePage, purchaseListViewMode]);

  useEffect(() => {
    setSalesPage(1);
  }, [salesList]);

  useEffect(() => {
    setPurchasePage(1);
  }, [purchaseList]);

  useEffect(() => {
    if (canSelectCompany) {
      loadCompanies();
    }
  }, [canSelectCompany]);

  useEffect(() => {
    if (selectedCompanyId === '' && user?.company_id) {
      setSelectedCompanyId(user.company_id);
    }
  }, [user?.company_id, selectedCompanyId]);

  const loadCompanies = async () => {
    try {
      const { api } = await import('../../services/api');
      const response = await api.get('/companies');
      if (response.data.success) {
        setCompanies(response.data.data || []);
      }
    } catch {
      /* ignore */
    }
  };

  const loadStatistics = useCallback(async () => {
    const range = resolveQueryRange();
    if (!range.start_date || !range.end_date) {
      setError(t('purchaseSalesStats.errors.selectPeriod'));
      return;
    }
    if (range.start_date > range.end_date) {
      setError(t('purchaseSalesStats.errors.invalidDateRange'));
      return;
    }

    setLoading(true);
    setError('');
    try {
      const params: any = {
        start_date: range.start_date,
        end_date: range.end_date };

      if (selectedCompanyId) {
        params.company_id = selectedCompanyId;
      }

      const response = await accountingService.getAccountingStats(params);
      setAppliedRangeLabel(range.label);

      if (response.success) {
        const data = response.data || {};
        setStats({
          totalRevenue: data.totalRevenue || 0,
          combinedRevenue: data.combinedRevenue || 0,
          roomBookingRevenue: data.roomBookingRevenue || 0,
          collectedRevenue: data.collectedRevenue || 0,
          outstandingRevenue: data.outstandingRevenue || 0,
          totalExpenses: data.totalExpenses || 0,
          netProfit: data.netProfit || 0,
          totalInvoices: data.totalInvoices || 0,
          paidInvoices: data.paidInvoices || 0,
          pendingInvoices: data.pendingInvoices || 0,
          overdueInvoices: data.overdueInvoices || 0,
          profitMargin: data.profitMargin || 0,
          revenueGrowth: data.revenueGrowth || 0,
          expenseGrowth: data.expenseGrowth || 0,
          averageInvoiceAmount: data.averageInvoiceAmount || 0 });
        setMonthlyRevenueData(Array.isArray(data.monthlyRevenueData) ? data.monthlyRevenueData : []);
        setCategoryExpenseData(Array.isArray(data.categoryExpenseData) ? data.categoryExpenseData : []);
        setCategoryRevenueData(Array.isArray(data.categoryRevenueData) ? data.categoryRevenueData : []);
        setInvoiceStatusData(Array.isArray(data.invoiceStatusData) ? data.invoiceStatusData : []);
        setQuarterlyData(Array.isArray(data.quarterlyData) ? data.quarterlyData : []);
        setDailyData(Array.isArray(data.dailyData) ? data.dailyData : []);
        setSalesList(Array.isArray(data.salesList) ? data.salesList : []);
        setSalesTotal(Number(data.salesTotal) || 0);
        setPurchaseList(
          (Array.isArray(data.purchaseList) ? data.purchaseList : []).map((row: any) => ({
            ...row,
            line_items: Array.isArray(row.line_items) ? row.line_items : [],
            partner_name: row.partner_name || null,
            remarks: row.remarks || null,
          }))
        );
        setPurchaseTotal(Number(data.purchaseTotal) || 0);
        setPurchasePaidTotal(Number(data.purchasePaidTotal) || 0);
      } else {
        setStats({
          totalRevenue: 0,
          combinedRevenue: 0,
          roomBookingRevenue: 0,
          collectedRevenue: 0,
          outstandingRevenue: 0,
          totalExpenses: 0,
          netProfit: 0,
          totalInvoices: 0,
          paidInvoices: 0,
          pendingInvoices: 0,
          overdueInvoices: 0,
          profitMargin: 0,
          revenueGrowth: 0,
          expenseGrowth: 0,
          averageInvoiceAmount: 0 });
        setMonthlyRevenueData([]);
        setCategoryExpenseData([]);
        setCategoryRevenueData([]);
        setInvoiceStatusData([]);
        setQuarterlyData([]);
        setDailyData([]);
        setSalesList([]);
        setSalesTotal(0);
        setPurchaseList([]);
        setPurchaseTotal(0);
        setPurchasePaidTotal(0);
      }
    } catch (error) {
      setError(t('purchaseSalesStats.errors.loadFailed'));
      setStats({
        totalRevenue: 0,
        combinedRevenue: 0,
        roomBookingRevenue: 0,
        collectedRevenue: 0,
        outstandingRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
        totalInvoices: 0,
        paidInvoices: 0,
        pendingInvoices: 0,
        overdueInvoices: 0,
        profitMargin: 0,
        revenueGrowth: 0,
        expenseGrowth: 0,
        averageInvoiceAmount: 0 });
      setMonthlyRevenueData([]);
      setCategoryExpenseData([]);
      setCategoryRevenueData([]);
      setInvoiceStatusData([]);
      setQuarterlyData([]);
      setDailyData([]);
      setSalesList([]);
      setSalesTotal(0);
      setPurchaseList([]);
      setPurchaseTotal(0);
      setPurchasePaidTotal(0);
    } finally {
      setLoading(false);
    }
  }, [resolveQueryRange, selectedCompanyId, t]);

  // 최초 1회만 자동 조회 (이후는 조회 버튼)
  useEffect(() => {
    void loadStatistics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatCurrency = (amount: number) => UTILS.formatCurrency(amount);

  const formatDate = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    return date.toLocaleDateString(i18n.language === 'ko' ? 'ko-KR' : 'en-US');
  };

  const getPaymentStatusChip = (status?: string) => {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'paid') {
      return <Chip size="small" label={t('purchaseSalesStats.paymentStatus.paid')} color="success" variant="outlined" />;
    }
    if (normalized === 'pending') {
      return <Chip size="small" label={t('purchaseSalesStats.paymentStatus.pending')} color="warning" variant="outlined" />;
    }
    if (normalized === 'partial' || normalized === 'refunded') {
      return <Chip size="small" label={status} color="default" variant="outlined" />;
    }
    return <Chip size="small" label={status || '-'} color="default" variant="outlined" />;
  };

  const getExpenseStatusChip = (status?: string) => {
    const map: Record<string, { labelKey: string; color: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
      draft: { labelKey: 'purchaseSalesStats.expenseStatus.draft', color: 'default' },
      submitted: { labelKey: 'purchaseSalesStats.expenseStatus.submitted', color: 'info' },
      in_review: { labelKey: 'purchaseSalesStats.expenseStatus.in_review', color: 'warning' },
      approved: { labelKey: 'purchaseSalesStats.expenseStatus.approved', color: 'success' },
      rejected: { labelKey: 'purchaseSalesStats.expenseStatus.rejected', color: 'error' },
      paid: { labelKey: 'purchaseSalesStats.expenseStatus.paid', color: 'success' } };
    const key = String(status || '').toLowerCase();
    const item = map[key];
    const label = item ? t(item.labelKey) : status || '-';
    const color = item?.color || 'default';
    return <Chip size="small" label={label} color={color} variant="outlined" />;
  };

  const formatAxisAmount = (value: number) => {
    if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return `${Math.round(value)}`;
  };

  const getProfitMargin = () => {
    if (stats.totalRevenue === 0) return 0;
    return ((stats.netProfit / stats.totalRevenue) * 100).toFixed(1);
  };

  const getChartData = () => {
    if (periodMode === 'date') return dailyData.length ? dailyData : monthlyRevenueData;
    if (periodMode === 'quarter') return monthlyRevenueData.length ? monthlyRevenueData : quarterlyData;
    return quarterlyData.length ? quarterlyData : monthlyRevenueData;
  };

  const getChartXKey = () => {
    if (periodMode === 'date') return dailyData.length ? 'day' : 'month';
    if (periodMode === 'quarter') return monthlyRevenueData.length ? 'month' : 'quarter';
    return quarterlyData.length ? 'quarter' : 'month';
  };

  const handleDownloadReport = async () => {
    const range = resolveQueryRange();

    const companyLabel =
      selectedCompanyId === ''
        ? t('purchaseSalesStats.export.allCompanies')
        : shortCompanyName(companies.find((company) => company.id === selectedCompanyId)?.name) ||
          (selectedCompanyId ? t('purchaseSalesStats.export.companyWithId', { id: selectedCompanyId }) : '') ||
          user?.username ||
          t('purchaseSalesStats.export.selectedCompany');

    const summaryRows = [
      { 항목: '생성일시', 값: new Date().toLocaleString('ko-KR') },
      { 항목: '기간 구분', 값: appliedRangeLabel || range.label },
      { 항목: '시작일', 값: range.start_date },
      { 항목: '종료일', 값: range.end_date },
      { 항목: '조회 회사', 값: companyLabel },
      { 항목: '총 매출(인보이스)', 값: stats.totalRevenue || 0 },
      { 항목: '수금액', 값: stats.collectedRevenue || 0 },
      { 항목: '미수금', 값: stats.outstandingRevenue || 0 },
      { 항목: '객실예약 매출', 값: stats.roomBookingRevenue || 0 },
      { 항목: '통합 매출(참고)', 값: stats.combinedRevenue || stats.totalRevenue || 0 },
      { 항목: '총 지출', 값: stats.totalExpenses || 0 },
      { 항목: '순이익', 값: stats.netProfit || 0 },
      { 항목: '총 인보이스', 값: stats.totalInvoices || 0 },
      { 항목: '결제완료 인보이스', 값: stats.paidInvoices || 0 },
      { 항목: '대기 인보이스', 값: stats.pendingInvoices || 0 },
      { 항목: '연체 인보이스', 값: stats.overdueInvoices || 0 },
      { 항목: '평균 인보이스 금액', 값: stats.averageInvoiceAmount || 0 }
    ];

    const trendRows = getChartData().map((row) => ({
      기간: row.day || row.quarter || row.month || '-',
      수익: row.revenue || 0,
      비용: row.expenses || 0,
      순이익: row.profit || 0
    }));

    const invoiceRows = invoiceStatusData.map((row) => ({
      상태: row.status,
      건수: row.count,
      금액: row.amount
    }));

    const revenueCategoryRows = categoryRevenueData.map((row) => ({
      카테고리: row.name,
      금액: row.value,
      비중: `${row.percentage}%`
    }));

    const expenseCategoryRows = categoryExpenseData.map((row) => ({
      카테고리: row.name,
      금액: row.value,
      비중: `${row.percentage}%`
    }));

    const salesRows = salesList.map((row) => ({
      문서번호: row.document_number,
      일자: formatDate(row.date),
      거래처: row.counterparty,
      유형: row.category,
      공급가액: row.amount - row.tax_amount,
      세액: row.tax_amount,
      합계: row.amount,
      결제상태: row.payment_status }));

    const purchaseRows = purchaseList.map((row) => ({
      문서번호: row.document_number,
      일자: formatDate(row.date),
      제목: row.title,
      신청자: row.requester,
      부서: row.department,
      용도: row.purpose,
      금액: row.amount,
      상태: row.status,
      지급상태: row.payment_status }));

    const ExcelJS = (await import('exceljs')).default;
    const { addSheetFromObjects, downloadExcelWorkbook } = await import('../../utils/excelExportStyle');
    const workbook = new ExcelJS.Workbook();
    addSheetFromObjects(workbook, '요약', summaryRows);
    addSheetFromObjects(
      workbook,
      '추이',
      trendRows.length > 0 ? trendRows : [{ 기간: '-', 수익: 0, 비용: 0, 순이익: 0, 예산: 0 }]
    );
    addSheetFromObjects(
      workbook,
      '인보이스현황',
      invoiceRows.length > 0 ? invoiceRows : [{ 상태: '-', 건수: 0, 금액: 0 }]
    );
    addSheetFromObjects(
      workbook,
      '수익카테고리',
      revenueCategoryRows.length > 0 ? revenueCategoryRows : [{ 카테고리: '-', 금액: 0, 비중: '0%' }]
    );
    addSheetFromObjects(
      workbook,
      '비용카테고리',
      expenseCategoryRows.length > 0 ? expenseCategoryRows : [{ 카테고리: '-', 금액: 0, 비중: '0%' }]
    );
    addSheetFromObjects(
      workbook,
      '매출통계',
      salesRows.length > 0
        ? [...salesRows, { 문서번호: '합계', 일자: '', 거래처: '', 유형: '', 공급가액: '', 세액: '', 합계: salesTotal, 결제상태: '' }]
        : [{ 문서번호: '-', 일자: '-', 거래처: '-', 유형: '-', 공급가액: 0, 세액: 0, 합계: 0, 결제상태: '-' }]
    );
    addSheetFromObjects(
      workbook,
      '매입통계',
      purchaseRows.length > 0
        ? [
            ...purchaseRows,
            {
              문서번호: '합계',
              일자: '',
              제목: '',
              신청자: '',
              부서: '',
              용도: '',
              금액: purchaseTotal,
              상태: '',
              지급상태: '' },
          ]
        : [
            {
              문서번호: '-',
              일자: '-',
              제목: '-',
              신청자: '-',
              부서: '-',
              용도: '-',
              금액: 0,
              상태: '-',
              지급상태: '-' },
          ]
    );

    const dateToken = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    await downloadExcelWorkbook(workbook, `매입매출통계_보고서_${dateToken}.xlsx`);
  };

  return (
    <Box sx={{ ...mvsPageRootSx }}>
      <DaeheungPageHeader
        title={t('purchaseSalesStats.title')}
        description={t('purchaseSalesStats.description')}
        actions={
          <Button
            variant="contained"
            disableElevation
            startIcon={<DownloadIcon fontSize="small" />}
            onClick={handleDownloadReport}
            sx={mvsBodyPrimaryBtnSx}
          >
            {t('purchaseSalesStats.downloadReport')}
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 2 }}>
        {t('purchaseSalesStats.infoAlert')}
      </Alert>

      {/* 필터 섹션 */}
      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 3 }}>
        <Box
          sx={{
            px: { xs: 2, sm: 2.5 },
            py: 2,
            bgcolor: '#FFFFFF',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            gap: 1.25,
            ...accountingStatsFilterFieldSx }}
        >
          {canSelectCompany && (
            <TextField
              size="small"
              select
              label={t('purchaseSalesStats.filters.company')}
              value={selectedCompanyId}
              onChange={(e) => {
                const value = String(e.target.value);
                if (value === '') {
                  setSelectedCompanyId('');
                } else {
                  const num = Number(value);
                  setSelectedCompanyId(isNaN(num) ? '' : num);
                }
              }}
              InputLabelProps={{ shrink: true }}
              SelectProps={{
                displayEmpty: true,
                renderValue: (value) => {
                  if (value === '' || value == null) {
                    return t('purchaseSalesStats.filters.allCompanies');
                  }
                  const found = companies.find((c) => Number(c.id) === Number(value));
                  return shortCompanyName(found?.name) || String(value);
                },
                MenuProps: {
                  PaperProps: {
                    sx: {
                      maxWidth: 'min(560px, 92vw)',
                      '& .MuiMenuItem-root': {
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'block',
                      },
                    },
                  },
                },
              }}
              sx={{
                ...accountingStatsFilterFieldSx,
                width: { xs: '100%', sm: 220 },
                minWidth: 180,
                flex: '0 0 auto',
                '& .MuiOutlinedInput-root': { overflow: 'hidden' },
                '& .MuiSelect-select': {
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                },
              }}
            >
              <MenuItem value="">{t('purchaseSalesStats.filters.allCompanies')}</MenuItem>
              {companies.map((company) => (
                <MenuItem key={company.id} value={company.id}>
                  {shortCompanyName(company.name) || company.name}
                </MenuItem>
              ))}
            </TextField>
          )}

          <TextField
            size="small"
            select
            label={t('purchaseSalesStats.filters.period')}
            value={periodMode}
            onChange={(e) => setPeriodMode(e.target.value as PeriodMode)}
            InputLabelProps={{ shrink: true }}
            sx={{ ...accountingStatsFilterFieldSx, width: { xs: '100%', sm: 170 }, minWidth: 150, flex: '0 1 auto' }}
          >
            <MenuItem value="date">{t('purchaseSalesStats.filters.byDate')}</MenuItem>
            <MenuItem value="quarter">{t('purchaseSalesStats.filters.byQuarter')}</MenuItem>
            <MenuItem value="fiscalYear">{t('purchaseSalesStats.filters.byFiscalYear')}</MenuItem>
          </TextField>

          {periodMode === 'date' && (
            <>
              <TextField
                size="small"
                type="date"
                label={t('purchaseSalesStats.filters.from')}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                sx={{ ...accountingStatsFilterFieldSx, width: { xs: '100%', sm: 150 }, minWidth: 140, flex: '0 0 auto' }}
                {...mvsOutlinedLabelProps}
              />
              <TextField
                size="small"
                type="date"
                label={t('purchaseSalesStats.filters.to')}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                sx={{ ...accountingStatsFilterFieldSx, width: { xs: '100%', sm: 150 }, minWidth: 140, flex: '0 0 auto' }}
                {...mvsOutlinedLabelProps}
              />
            </>
          )}

          {(periodMode === 'quarter' || periodMode === 'fiscalYear') && (
            <TextField
              size="small"
              select
              label={t('purchaseSalesStats.filters.fiscalYear')}
              value={fyStartYear}
              onChange={(e) => setFyStartYear(Number(e.target.value))}
              InputLabelProps={{ shrink: true }}
              sx={{ ...accountingStatsFilterFieldSx, width: { xs: '100%', sm: 180 }, minWidth: 160, flex: '0 0 auto' }}
            >
              {fyOptions.map((opt) => (
                <MenuItem key={opt.startYear} value={opt.startYear}>
                  {opt.label}
                  {opt.startYear === currentFyStartYear ? ` (${t('purchaseSalesStats.filters.currentFy')})` : ''}
                </MenuItem>
              ))}
            </TextField>
          )}

          {periodMode === 'quarter' && (
            <TextField
              size="small"
              select
              label={t('purchaseSalesStats.filters.quarter')}
              value={selectedQuarter}
              onChange={(e) => setSelectedQuarter(Number(e.target.value) as 1 | 2 | 3 | 4)}
              InputLabelProps={{ shrink: true }}
              sx={{ ...accountingStatsFilterFieldSx, width: { xs: '100%', sm: 120 }, minWidth: 100, flex: '0 0 auto' }}
            >
              <MenuItem value={1}>{getQuarterLabel(1)}</MenuItem>
              <MenuItem value={2}>{getQuarterLabel(2)}</MenuItem>
              <MenuItem value={3}>{getQuarterLabel(3)}</MenuItem>
              <MenuItem value={4}>{getQuarterLabel(4)}</MenuItem>
            </TextField>
          )}

          <Button
            variant="contained"
            disableElevation
            startIcon={<SearchIcon fontSize="small" />}
            onClick={() => void loadStatistics()}
            disabled={loading}
            sx={{ ...mvsBodyPrimaryBtnSx, height: 40, whiteSpace: 'nowrap', flex: '0 0 auto' }}
          >
            {t('purchaseSalesStats.filters.search')}
          </Button>

          {appliedRangeLabel && (
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', ml: { sm: 0.5 } }}>
              {t('purchaseSalesStats.filters.applied')}: {appliedRangeLabel}
            </Typography>
          )}
        </Box>
      </Card>

      {/* 주요 지표 카드 */}
      <Grid container spacing={2.5} sx={{ mb: 3 }} alignItems="stretch">
        <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
          <Card elevation={0} sx={{ ...mvsKpiCardSx, width: '100%', height: '100%' }}>
            <CardContent sx={{ py: 2.25, px: 2.5, height: '100%' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
                {t('purchaseSalesStats.kpi.totalRevenue')}
              </Typography>
              <Typography variant="h5" fontWeight={600} color="success.main" sx={{ mt: 0.75, letterSpacing: '-0.02em' }}>
                {formatCurrency(stats.totalRevenue)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, fontSize: '0.72rem', lineHeight: 1.35 }}>
                {t('purchaseSalesStats.kpi.collectedOutstanding', {
                  collected: formatCurrency(stats.collectedRevenue || 0),
                  outstanding: formatCurrency(stats.outstandingRevenue || 0) })}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35, fontSize: '0.72rem', lineHeight: 1.35 }}>
                {t('purchaseSalesStats.kpi.roomBookingNote', {
                  roomBooking: formatCurrency(stats.roomBookingRevenue || 0),
                  combined: formatCurrency(stats.combinedRevenue || stats.totalRevenue) })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
          <Card elevation={0} sx={{ ...mvsKpiCardSx, width: '100%', height: '100%' }}>
            <CardContent sx={{ py: 2.25, px: 2.5, height: '100%' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
                {t('purchaseSalesStats.kpi.totalExpenses')}
              </Typography>
              <Typography variant="h5" fontWeight={600} color="error.main" sx={{ mt: 0.75, letterSpacing: '-0.02em' }}>
                {formatCurrency(stats.totalExpenses)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                {t('purchaseSalesStats.kpi.vsLastMonth', {
                  percent: `${stats.expenseGrowth > 0 ? '+' : ''}${stats.expenseGrowth}` })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
          <Card elevation={0} sx={{ ...mvsKpiCardSx, width: '100%', height: '100%' }}>
            <CardContent sx={{ py: 2.25, px: 2.5, height: '100%' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
                {t('purchaseSalesStats.kpi.netProfit')}
              </Typography>
              <Typography variant="h5" fontWeight={600} color="info.main" sx={{ mt: 0.75, letterSpacing: '-0.02em' }}>
                {formatCurrency(stats.netProfit)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                {t('purchaseSalesStats.kpi.profitMargin', { percent: getProfitMargin() })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
          <Card elevation={0} sx={{ ...mvsKpiCardSx, width: '100%', height: '100%' }}>
            <CardContent sx={{ py: 2.25, px: 2.5, height: '100%' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
                {t('purchaseSalesStats.kpi.totalInvoices')}
              </Typography>
              <Typography variant="h5" fontWeight={600} sx={{ mt: 0.75, letterSpacing: '-0.02em' }}>
                {stats.totalInvoices}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                {t('purchaseSalesStats.kpi.average', { amount: formatCurrency(stats.averageInvoiceAmount) })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* 탭 메뉴 */}
          <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 3 }}>
            <Tabs
              value={activeTab}
              onChange={(_, newValue) => setActiveTab(newValue)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                minHeight: 48,
                px: { xs: 1, sm: 1.5 },
                bgcolor: '#FFFFFF',
                '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0' },
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontWeight: 500,
                  fontSize: '0.8125rem',
                  minHeight: 48,
                  py: 1.5,
                  letterSpacing: '-0.01em',
                  color: 'text.secondary' },
                '& .MuiTab-root.Mui-selected': { color: 'primary.main', fontWeight: 700 } }}
            >
              <Tab icon={<ReceiptLongIcon />} iconPosition="start" label={t('purchaseSalesStats.tabs.sales')} />
              <Tab icon={<ShoppingCartIcon />} iconPosition="start" label={t('purchaseSalesStats.tabs.purchase')} />
              <Tab icon={<ShowChartIcon />} iconPosition="start" label={t('purchaseSalesStats.tabs.trend')} />
              <Tab icon={<PieChartIcon />} iconPosition="start" label={t('purchaseSalesStats.tabs.categoryAnalysis')} />
              <Tab icon={<BarChartIcon />} iconPosition="start" label={t('purchaseSalesStats.tabs.invoiceStatus')} />
            </Tabs>
          </Card>

          {/* 매출 통계 */}
          <TabPanel value={activeTab} index={0}>
            <Card elevation={0} sx={mvsBodyCardSx}>
              <Box sx={{ ...mvsBodySectionHeaderSx, alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
                    {t('purchaseSalesStats.sales.title')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {t('purchaseSalesStats.sales.subtitle', { count: salesList.length })}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">{t('purchaseSalesStats.sales.totalAmount')}</Typography>
                  <Typography variant="h6" fontWeight={700} color="success.main">
                    {formatCurrency(salesTotal)}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ ...mvsBodyListZoneSx, mt: 0, pb: 0 }}>
                {salesList.length === 0 ? (
                  <Box sx={listStateInlineSx}>
                    <Typography variant="body2" color="text.secondary">
                      {t('purchaseSalesStats.sales.empty')}
                    </Typography>
                  </Box>
                ) : (
                  <>
                  <Box sx={{ px: { xs: 2, sm: 2.5 }, pt: 1.5 }}>
                    <ListViewModeButtons
                      value={salesListViewMode}
                      onChange={(mode) => {
                        setSalesListViewMode(mode);
                        if (mode === 'page') setSalesPage(1);
                      }}
                      allLabel={t('purchaseSalesStats.listView.viewAll')}
                      pageLabel={t('purchaseSalesStats.listView.viewPages')}
                    />
                  </Box>
                  <TableContainer sx={bodyCardTableContainerSx}>
                    <Table
                      size="small"
                      sx={{
                        borderCollapse: 'collapse',
                        bgcolor: 'transparent',
                        '& .MuiTableCell-root': {
                          borderLeft: 'none',
                          borderRight: 'none',
                          borderTop: 'none' } }}
                    >
                      <TableHead sx={mvsTableHeadHighlightSx}>
                        <TableRow>
                          <TableCell>{t('purchaseSalesStats.columns.documentNumber')}</TableCell>
                          <TableCell>{t('purchaseSalesStats.columns.date')}</TableCell>
                          <TableCell>{t('purchaseSalesStats.columns.counterparty')}</TableCell>
                          <TableCell>{t('purchaseSalesStats.columns.type')}</TableCell>
                          <TableCell align="right">{t('purchaseSalesStats.columns.supplyAmount')}</TableCell>
                          <TableCell align="right">{t('purchaseSalesStats.columns.taxAmount')}</TableCell>
                          <TableCell align="right">{t('purchaseSalesStats.columns.total')}</TableCell>
                          <TableCell align="center">{t('purchaseSalesStats.columns.paymentStatus')}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody sx={mvsTableBodyRowSx}>
                        {displayedSalesList.map((row) => (
                          <TableRow key={`${row.source}-${row.id}`} hover>
                            <TableCell>{row.document_number}</TableCell>
                            <TableCell>{formatDate(row.date)}</TableCell>
                            <TableCell>{row.counterparty}</TableCell>
                            <TableCell>
                              <Chip size="small" label={row.category} variant="outlined" />
                            </TableCell>
                            <TableCell align="right">{formatCurrency(row.amount - row.tax_amount)}</TableCell>
                            <TableCell align="right">{formatCurrency(row.tax_amount)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>
                              {formatCurrency(row.amount)}
                            </TableCell>
                            <TableCell align="center">{getPaymentStatusChip(row.payment_status)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow sx={{ bgcolor: alpha(theme.palette.success.main, 0.08) }}>
                          <TableCell colSpan={6} sx={{ fontWeight: 700 }}>{t('purchaseSalesStats.sales.totalAmount')}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>
                            {formatCurrency(salesTotal)}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {salesListViewMode === 'page' && salesList.length > LIST_PAGE_SIZE && (
                    <Box sx={mvsBodyPaginationSx}>
                      <Pagination
                        count={Math.ceil(salesList.length / LIST_PAGE_SIZE)}
                        page={salesPage}
                        onChange={(_, value) => setSalesPage(value)}
                        color="primary"
                      />
                    </Box>
                  )}
                  </>
                )}
              </Box>
            </Card>
          </TabPanel>

          {/* 매입 통계 */}
          <TabPanel value={activeTab} index={1}>
            <Card elevation={0} sx={mvsBodyCardSx}>
              <Box sx={{ ...mvsBodySectionHeaderSx, alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
                    {t('purchaseSalesStats.purchase.title')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {t('purchaseSalesStats.purchase.subtitle', {
                      count: purchaseList.length,
                      paidTotal: formatCurrency(purchasePaidTotal) })}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">{t('purchaseSalesStats.purchase.totalAmount')}</Typography>
                  <Typography variant="h6" fontWeight={700} color="error.main">
                    {formatCurrency(purchaseTotal)}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ ...mvsBodyListZoneSx, mt: 0, pb: 0 }}>
                {purchaseList.length === 0 ? (
                  <Box sx={listStateInlineSx}>
                    <Typography variant="body2" color="text.secondary">
                      {t('purchaseSalesStats.purchase.empty')}
                    </Typography>
                  </Box>
                ) : (
                  <>
                  <Box sx={{ px: { xs: 2, sm: 2.5 }, pt: 1.5 }}>
                    <ListViewModeButtons
                      value={purchaseListViewMode}
                      onChange={(mode) => {
                        setPurchaseListViewMode(mode);
                        if (mode === 'page') setPurchasePage(1);
                      }}
                      allLabel={t('purchaseSalesStats.listView.viewAll')}
                      pageLabel={t('purchaseSalesStats.listView.viewPages')}
                    />
                  </Box>
                  <TableContainer sx={bodyCardTableContainerSx}>
                    <Table
                      size="small"
                      sx={{
                        borderCollapse: 'collapse',
                        bgcolor: 'transparent',
                        '& .MuiTableCell-root': {
                          borderLeft: 'none',
                          borderRight: 'none',
                          borderTop: 'none' } }}
                    >
                      <TableHead sx={mvsTableHeadHighlightSx}>
                        <TableRow>
                          <TableCell>{t('purchaseSalesStats.columns.documentNumber')}</TableCell>
                          <TableCell>{t('purchaseSalesStats.columns.date')}</TableCell>
                          <TableCell>{t('purchaseSalesStats.columns.title')}</TableCell>
                          <TableCell>{t('purchaseSalesStats.columns.requester')}</TableCell>
                          <TableCell>{t('purchaseSalesStats.columns.department')}</TableCell>
                          <TableCell>{t('purchaseSalesStats.columns.purpose')}</TableCell>
                          <TableCell align="right">{t('purchaseSalesStats.columns.amount')}</TableCell>
                          <TableCell align="center">{t('purchaseSalesStats.columns.status')}</TableCell>
                          <TableCell align="center">{t('purchaseSalesStats.columns.expensePaymentStatus')}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody sx={mvsTableBodyRowSx}>
                        {displayedPurchaseList.map((row) => (
                          <TableRow
                            key={row.id}
                            hover
                            onClick={() => setPurchaseDetail(row)}
                            sx={{ cursor: 'pointer', '&:active': { bgcolor: 'action.selected' } }}
                          >
                            <TableCell>{row.document_number}</TableCell>
                            <TableCell>{formatDate(row.date)}</TableCell>
                            <TableCell>{row.title}</TableCell>
                            <TableCell>{row.requester}</TableCell>
                            <TableCell>{row.department}</TableCell>
                            <TableCell sx={{ maxWidth: 220 }}>{row.purpose}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>
                              {formatCurrency(row.amount)}
                            </TableCell>
                            <TableCell align="center">{getExpenseStatusChip(row.status)}</TableCell>
                            <TableCell align="center">{getPaymentStatusChip(row.payment_status)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow sx={{ bgcolor: alpha(theme.palette.error.main, 0.08) }}>
                          <TableCell colSpan={6} sx={{ fontWeight: 700 }}>{t('purchaseSalesStats.purchase.totalAmount')}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: 'error.main' }}>
                            {formatCurrency(purchaseTotal)}
                          </TableCell>
                          <TableCell colSpan={2} />
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {purchaseListViewMode === 'page' && purchaseList.length > LIST_PAGE_SIZE && (
                    <Box sx={mvsBodyPaginationSx}>
                      <Pagination
                        count={Math.ceil(purchaseList.length / LIST_PAGE_SIZE)}
                        page={purchasePage}
                        onChange={(_, value) => setPurchasePage(value)}
                        color="primary"
                      />
                    </Box>
                  )}
                  </>
                )}
              </Box>
            </Card>
          </TabPanel>

          {/* 수익/비용 추이 */}
          <TabPanel value={activeTab} index={2}>
            <Card elevation={0} sx={mvsBodyCardSx}>
              <Box sx={mvsBodySectionHeaderSx}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
                  {t('purchaseSalesStats.tabs.trend')}
                </Typography>
              </Box>
              <Box sx={{ px: { xs: 2, sm: 2.5 }, py: 2.5 }}>
                      <ResponsiveContainer width="100%" height={400}>
                        <ComposedChart data={getChartData()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey={getChartXKey()} />
                          <YAxis tickFormatter={formatAxisAmount} />
                          <RechartsTooltip 
                            formatter={(value: number) => formatCurrency(value)}
                          />
                          <Legend />
                          <Area 
                            type="monotone" 
                            dataKey="revenue" 
                            fill="#4caf50" 
                            fillOpacity={0.3}
                            stroke="#4caf50"
                            strokeWidth={2}
                            name={t('purchaseSalesStats.chart.revenue')}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="expenses" 
                            fill="#f44336" 
                            fillOpacity={0.3}
                            stroke="#f44336"
                            strokeWidth={2}
                            name={t('purchaseSalesStats.chart.expenses')}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="profit" 
                            stroke="#2196f3" 
                            strokeWidth={3}
                            name={t('purchaseSalesStats.chart.profit')}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
              </Box>
            </Card>
          </TabPanel>

          {/* 카테고리별 분석 */}
          <TabPanel value={activeTab} index={3}>
            <Grid container spacing={2.5}>
              <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex' }}>
                <Card elevation={0} sx={{ ...mvsBodyCardSx, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={mvsBodySectionHeaderSx}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
                      {t('purchaseSalesStats.category.expenseDistribution')}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1, px: { xs: 2, sm: 2.5 }, py: 2.5 }}>
                      <ResponsiveContainer width="100%" height={350}>
                        <PieChart>
                          <Pie
                            data={categoryExpenseData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={120}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, percentage }) => `${name} ${percentage}%`}
                          >
                            {categoryExpenseData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <Box sx={{ mt: 2 }}>
                        {categoryExpenseData.map((item, index) => (
                          <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Box
                              sx={{
                                width: 12,
                                height: 12,
                                backgroundColor: item.color,
                                borderRadius: '50%',
                                mr: 1
                              }}
                            />
                            <Typography variant="body2" sx={{ flexGrow: 1 }}>
                              {item.name}
                            </Typography>
                            <Typography variant="body2" fontWeight={500} sx={{ mr: 2 }}>
                              {item.percentage}%
                            </Typography>
                            <Typography variant="body2" fontWeight={500}>
                              {formatCurrency(item.value)}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                  </Box>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex' }}>
                <Card elevation={0} sx={{ ...mvsBodyCardSx, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={mvsBodySectionHeaderSx}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
                      {t('purchaseSalesStats.category.revenueDistribution')}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1, px: { xs: 2, sm: 2.5 }, py: 2.5 }}>
                      <ResponsiveContainer width="100%" height={350}>
                        <PieChart>
                          <Pie
                            data={categoryRevenueData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={120}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, percentage }) => `${name} ${percentage}%`}
                          >
                            {categoryRevenueData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <Box sx={{ mt: 2 }}>
                        {categoryRevenueData.map((item, index) => (
                          <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Box
                              sx={{
                                width: 12,
                                height: 12,
                                backgroundColor: item.color,
                                borderRadius: '50%',
                                mr: 1
                              }}
                            />
                            <Typography variant="body2" sx={{ flexGrow: 1 }}>
                              {item.name}
                            </Typography>
                            <Typography variant="body2" fontWeight={500} sx={{ mr: 2 }}>
                              {item.percentage}%
                            </Typography>
                            <Typography variant="body2" fontWeight={500}>
                              {formatCurrency(item.value)}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                  </Box>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>

          {/* 인보이스 현황 */}
          <TabPanel value={activeTab} index={4}>
            <Grid container spacing={2.5}>
              <Grid size={{ xs: 12, md: 8 }} sx={{ display: 'flex' }}>
                <Card elevation={0} sx={{ ...mvsBodyCardSx, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={mvsBodySectionHeaderSx}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
                      {t('purchaseSalesStats.invoice.statusChart')}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1, px: { xs: 2, sm: 2.5 }, py: 2.5 }}>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={invoiceStatusData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="status" />
                          <YAxis />
                          <RechartsTooltip 
                            formatter={(value: number, name: string) => [
                              name === 'count'
                                ? t('purchaseSalesStats.chart.countUnit', { count: value })
                                : formatCurrency(value),
                              name === 'count' ? t('purchaseSalesStats.chart.count') : t('purchaseSalesStats.chart.amount')
                            ]}
                          />
                          <Legend />
                          <Bar dataKey="count" fill="#8884d8" name={t('purchaseSalesStats.chart.count')} />
                          <Bar dataKey="amount" fill="#82ca9d" name={t('purchaseSalesStats.chart.amount')} />
                        </BarChart>
                      </ResponsiveContainer>
                  </Box>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex' }}>
                <Card elevation={0} sx={{ ...mvsBodyCardSx, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={mvsBodySectionHeaderSx}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
                      {t('purchaseSalesStats.invoice.statusSummary')}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1, px: { xs: 2, sm: 2.5 }, py: 2.5 }}>
                      <Stack spacing={2}>
                        {invoiceStatusData.map((item, index) => (
                          <Box key={index}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Box
                                  sx={{
                                    width: 12,
                                    height: 12,
                                    backgroundColor: item.color,
                                    borderRadius: '50%',
                                    mr: 1
                                  }}
                                />
                                <Typography variant="body2" fontWeight={500}>{item.status}</Typography>
                              </Box>
                              <Typography variant="body2" fontWeight={500}>
                                {t('purchaseSalesStats.invoice.countWithUnit', { count: item.count })}
                              </Typography>
                            </Box>
                            <Typography variant="h6" color={item.color}>
                              {formatCurrency(item.amount)}
                            </Typography>
                            {index < invoiceStatusData.length - 1 && <Divider sx={{ mt: 2 }} />}
                          </Box>
                        ))}
                        <Divider />
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                          <Typography variant="body1" fontWeight={600}>{t('purchaseSalesStats.invoice.grandTotal')}</Typography>
                          <Typography variant="h6" fontWeight={600}>
                            {formatCurrency(invoiceStatusData.reduce((sum, item) => sum + item.amount, 0))}
                          </Typography>
                        </Box>
                      </Stack>
                  </Box>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>
        </>
      )}

      <Dialog
        open={Boolean(purchaseDetail)}
        onClose={() => setPurchaseDetail(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          {t('purchaseSalesStats.purchaseDetail.title')}
        </DialogTitle>
        <DialogContent dividers sx={{ px: 2.5, py: 2 }}>
          {purchaseDetail ? (
            <Stack spacing={1.5}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '112px 1fr',
                  rowGap: 0.75,
                  columnGap: 1,
                  '& > *:nth-of-type(odd)': { color: 'text.secondary', fontSize: '0.8125rem' },
                  '& > *:nth-of-type(even)': { fontSize: '0.875rem', fontWeight: 600 },
                }}
              >
                <Typography component="span">{t('purchaseSalesStats.columns.documentNumber')}</Typography>
                <Typography component="span">{purchaseDetail.document_number || '-'}</Typography>
                <Typography component="span">{t('purchaseSalesStats.columns.date')}</Typography>
                <Typography component="span">{formatDate(purchaseDetail.date)}</Typography>
                <Typography component="span">{t('purchaseSalesStats.columns.title')}</Typography>
                <Typography component="span">{purchaseDetail.title || '-'}</Typography>
                <Typography component="span">{t('purchaseSalesStats.purchaseDetail.partner')}</Typography>
                <Typography component="span">{purchaseDetail.partner_name || '-'}</Typography>
                <Typography component="span">{t('purchaseSalesStats.columns.purpose')}</Typography>
                <Typography component="span">{purchaseDetail.purpose || '-'}</Typography>
                <Typography component="span">{t('purchaseSalesStats.columns.requester')}</Typography>
                <Typography component="span">
                  {[purchaseDetail.requester, purchaseDetail.department].filter(Boolean).join(' / ') || '-'}
                </Typography>
                <Typography component="span">{t('purchaseSalesStats.columns.amount')}</Typography>
                <Typography component="span" sx={{ color: 'error.main' }}>
                  {formatCurrency(purchaseDetail.amount)}
                </Typography>
                <Typography component="span">{t('purchaseSalesStats.columns.status')}</Typography>
                <Box component="span" sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  {getExpenseStatusChip(purchaseDetail.status)}
                  {getPaymentStatusChip(purchaseDetail.payment_status)}
                </Box>
              </Box>

              {purchaseDetail.remarks ? (
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                    {t('purchaseSalesStats.purchaseDetail.remarks')}
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {purchaseDetail.remarks}
                  </Typography>
                </Box>
              ) : null}

              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
                  {t('purchaseSalesStats.purchaseDetail.lineItems')}
                </Typography>
                {(purchaseDetail.line_items || []).length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {t('purchaseSalesStats.purchaseDetail.emptyItems')}
                  </Typography>
                ) : (
                  <TableContainer
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 0,
                    }}
                  >
                    <Table size="small" sx={{ borderCollapse: 'collapse' }}>
                      <TableHead sx={{ bgcolor: '#C6EFCE' }}>
                        <TableRow>
                          <TableCell>{t('purchaseSalesStats.purchaseDetail.itemDescription')}</TableCell>
                          <TableCell align="right">{t('purchaseSalesStats.purchaseDetail.qty')}</TableCell>
                          <TableCell align="right">{t('purchaseSalesStats.purchaseDetail.unitPrice')}</TableCell>
                          <TableCell align="right">{t('purchaseSalesStats.columns.amount')}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(purchaseDetail.line_items || []).map((item, index) => (
                          <TableRow key={`${purchaseDetail.id}-item-${index}`}>
                            <TableCell>{item.description || '-'}</TableCell>
                            <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                              {item.qty}
                            </TableCell>
                            <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                              {formatCurrency(item.unit_price)}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                              {formatCurrency(item.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5 }}>
          <Button onClick={() => setPurchaseDetail(null)} sx={mvsBodyPrimaryBtnSx} variant="contained" disableElevation>
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AccountingStatistics;
