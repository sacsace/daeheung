import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Chip,
  Stack,
  LinearProgress,
  Grid,
  TextField,
  InputAdornment,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert
} from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import {
  mvsPageRootSx,
  mvsSearchFieldSx,
  mvsOutlinedLabelProps,
  mvsKpiCardSx,
  mvsFilterFieldHeightSx,
  mvsBodyCardSx,
  mvsBodySectionHeaderSx,
  mvsBodyFilterWrapSx,
  mvsBodyListZoneSx,
  mvsBodyListTableSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPrimaryBtnSx,
  mvsTableHeadHighlightSx,
  mvsTableBodyRowSx,
  mvsTableScrollSx } from '../../theme/daeheungLayout';
import {
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import {
  LineChart,
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
  Bar } from 'recharts';
import { useTranslation } from 'react-i18next';
import { alpha, useTheme } from '@mui/material/styles';
import { inventoryService } from '../../services/api';
import { UTILS } from '../../constants';
import { useMenuRoutePermissionFlags } from '../../hooks/useMenuRoutePermissionFlags';

const INVENTORY_REPORT_MENU_ROUTES = ['/inventory/report', '/inventory'] as const;
const CHART_COLORS = ['#4caf50', '#2196f3', '#ff9800', '#9c27b0', '#00bcd4', '#f44336'];

const FILTER_OUTLINED = mvsOutlinedLabelProps;

const reportFilterFieldSx = {
  ...(mvsSearchFieldSx as Record<string, unknown>),
  ...mvsFilterFieldHeightSx,
  minWidth: 160 } as const;

interface InventoryStats {
  totalProducts: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  averageTurnover: number;
}

interface ProductReport {
  id: number;
  productCode: string;
  name: string;
  category: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  unitPrice: number;
  totalValue: number;
  turnoverRate: number;
  status: string;
  lastMovement: string;
}

type ReportSortKey =
  | 'productCode'
  | 'name'
  | 'category'
  | 'currentStock'
  | 'stockRate'
  | 'minMax'
  | 'unitPrice'
  | 'totalValue'
  | 'turnoverRate'
  | 'status'
  | 'lastMovement';

function reportStockRatePercent(current: number, max: number): number | null {
  if (!(max > 0) || !Number.isFinite(max)) return null;
  const c = Number(current);
  if (!Number.isFinite(c)) return null;
  return (c / max) * 100;
}

function getReportStatusSortRank(p: ProductReport): number {
  if (p.currentStock === 0) return 0;
  if (p.minStock > 0 && p.currentStock <= p.minStock) return 1;
  if (p.maxStock > 0 && p.currentStock >= p.maxStock * 0.9) return 2;
  return 3;
}

function compareReportRows(a: ProductReport, b: ProductReport, orderBy: ReportSortKey): number {
  switch (orderBy) {
    case 'productCode':
      return a.productCode.localeCompare(b.productCode, undefined, { sensitivity: 'base' });
    case 'name':
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    case 'category':
      return a.category.localeCompare(b.category, undefined, { sensitivity: 'base' });
    case 'currentStock':
      return a.currentStock - b.currentStock;
    case 'stockRate': {
      const ra = reportStockRatePercent(a.currentStock, a.maxStock);
      const rb = reportStockRatePercent(b.currentStock, b.maxStock);
      const na = ra == null ? Number.NEGATIVE_INFINITY : ra;
      const nb = rb == null ? Number.NEGATIVE_INFINITY : rb;
      return na - nb;
    }
    case 'minMax': {
      const c1 = a.minStock - b.minStock;
      if (c1 !== 0) return c1;
      return a.maxStock - b.maxStock;
    }
    case 'unitPrice':
      return a.unitPrice - b.unitPrice;
    case 'totalValue':
      return a.totalValue - b.totalValue;
    case 'turnoverRate':
      return (a.turnoverRate || 0) - (b.turnoverRate || 0);
    case 'status':
      return getReportStatusSortRank(a) - getReportStatusSortRank(b);
    case 'lastMovement': {
      const ta = new Date(a.lastMovement).getTime();
      const tb = new Date(b.lastMovement).getTime();
      const na = Number.isNaN(ta) ? 0 : ta;
      const nb = Number.isNaN(tb) ? 0 : tb;
      return na - nb;
    }
    default:
      return 0;
  }
}

type TxRow = {
  id: number;
  transaction_type?: string;
  quantity?: number | string;
  unit_price?: number | string;
  total_amount?: number | string;
  notes?: string | null;
  created_at?: string;
  created_by?: number;
  creator?: { username?: string; email?: string } | null;
};

function formatTransactionCreator(tx: TxRow): string {
  const u = tx.creator;
  if (u?.username?.trim()) return u.username.trim();
  if (u?.email?.trim()) return u.email.trim();
  if (tx.created_by != null) return `#${tx.created_by}`;
  return '—';
}

const InventoryReport: React.FC = () => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'ko-KR';
  const sortLocale = i18n.language?.startsWith('en') ? 'en' : 'ko';
  const menuFlags = useMenuRoutePermissionFlags(INVENTORY_REPORT_MENU_ROUTES);

  const getStatusInfo = useCallback(
    (product: ProductReport) => {
      const is = { fontSize: '0.875rem' as const };
      if (product.currentStock === 0) {
        return {
          label: t('inventoryStatus.rowStatus.outOfStock'),
          chipTone: 'error' as const,
          icon: <ErrorIcon sx={{ ...is, color: alpha(theme.palette.error.main, 0.85) }} /> };
      }
      if (product.minStock > 0 && product.currentStock <= product.minStock) {
        return {
          label: t('inventoryStatus.rowStatus.lowStock'),
          chipTone: 'warning' as const,
          icon: <WarningIcon sx={{ ...is, color: alpha(theme.palette.warning.main, 0.9) }} /> };
      }
      if (product.maxStock > 0 && product.currentStock >= product.maxStock * 0.9) {
        return {
          label: t('inventoryStatus.rowStatus.overstock'),
          chipTone: 'info' as const,
          icon: <WarningIcon sx={{ ...is, color: alpha(theme.palette.info.main, 0.88) }} /> };
      }
      return {
        label: t('inventoryStatus.rowStatus.normal'),
        chipTone: 'success' as const,
        icon: <CheckCircleIcon sx={{ ...is, color: alpha(theme.palette.success.main, 0.85) }} /> };
    },
    [t, theme]
  );

  const formatTxTypeChip = useCallback(
    (txType?: string) => {
      if (!txType) return { label: '—', color: 'default' as const };
      const map: Record<string, { key: 'in' | 'out' | 'adjustment' | 'transfer'; color: 'success' | 'error' | 'warning' | 'info' }> = {
        in: { key: 'in', color: 'success' },
        out: { key: 'out', color: 'error' },
        adjustment: { key: 'adjustment', color: 'warning' },
        transfer: { key: 'transfer', color: 'info' }
      };
      const m = map[txType];
      if (m) return { label: t(`inventoryStatus.txType.${m.key}`), color: m.color };
      return { label: txType, color: 'default' as const };
    },
    [t]
  );

  const [stats, setStats] = useState<InventoryStats>({
    totalProducts: 0,
    totalValue: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
    averageTurnover: 0
  });
  const [products, setProducts] = useState<ProductReport[]>([]);
  const [categoryDistribution, setCategoryDistribution] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [, setLowStockProducts] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [reportOrderBy, setReportOrderBy] = useState<ReportSortKey>('productCode');
  const [reportOrder, setReportOrder] = useState<'asc' | 'desc'>('asc');

  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductReport | null>(null);
  const [txRows, setTxRows] = useState<TxRow[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState('');
  const [txTotal, setTxTotal] = useState(0);

  const loadReportData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [reportRes, productsRes] = await Promise.all([
        inventoryService.getInventoryReport().catch(() => ({ success: false as const })),
        inventoryService.getProducts({ page: 1, limit: 2000, search: '', category: '' })
      ]);

      let reportOk = false;
      if (reportRes && 'success' in reportRes && reportRes.success && reportRes.data) {
        reportOk = true;
        const { stats: reportStats, categoryDistribution: catDist, monthlyTransactions, lowStockProducts: lowStock } =
          reportRes.data;
        setStats(reportStats);
        setCategoryDistribution((catDist || []).map((item: any, index: number) => ({
          ...item,
          color: item.color || CHART_COLORS[index % CHART_COLORS.length]
        })));
        setMonthlyData(monthlyTransactions || []);
        setLowStockProducts(lowStock || []);
      }

      if (productsRes?.success && Array.isArray(productsRes.data)) {
        const productsList: ProductReport[] = productsRes.data.map((product: any) => ({
          id: product.id,
          productCode: String(product.product_code ?? product.sku ?? ''),
          name: product.name,
          category: product.category || t('inventoryReport.categoryOther'),
          currentStock: parseFloat(product.stock_quantity || 0),
          minStock: parseFloat(product.min_stock_level || 0),
          maxStock: parseFloat(product.max_stock_level || 0),
          unitPrice: parseFloat(product.unit_price || 0),
          totalValue: parseFloat(product.stock_quantity || 0) * parseFloat(product.unit_price || 0),
          turnoverRate: parseFloat(product.turnover_rate || 0),
          status: parseFloat(product.stock_quantity || 0) <= parseFloat(product.min_stock_level || 0) ? 'low' : 'normal',
          lastMovement: product.updated_at || new Date().toISOString()
        }));
        setProducts(productsList);

        if (!reportOk) {
          let totalValue = 0;
          let low = 0;
          let out = 0;
          productsList.forEach((p) => {
            totalValue += p.totalValue;
            if (p.currentStock === 0) out++;
            else if (p.minStock > 0 && p.currentStock <= p.minStock) low++;
          });
          setStats({
            totalProducts: productsList.length,
            totalValue,
            lowStockItems: low,
            outOfStockItems: out,
            averageTurnover: 0
          });
          setCategoryDistribution([]);
          setMonthlyData([]);
          setLowStockProducts([]);
        }
      } else {
        setProducts([]);
        setLoadError(t('inventoryReport.errors.productsLoadFailed'));
      }
    } catch {
      setLoadError(t('inventoryReport.errors.dataLoadError'));
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (menuFlags.menusLoading || !menuFlags.canRead) return;
    void loadReportData();
  }, [loadReportData, menuFlags.menusLoading, menuFlags.canRead]);

  const categoryOptions = useMemo(() => {
    const s = new Set<string>();
    products.forEach((p) => {
      if (p.category) s.add(p.category);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, sortLocale));
  }, [products, sortLocale]);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (selectedCategory) {
      list = list.filter((p) => p.category === selectedCategory);
    }
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.productCode.toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, selectedCategory, searchTerm]);

  const sortedFilteredProducts = useMemo(() => {
    const copy = [...filteredProducts];
    copy.sort((a, b) => {
      const c = compareReportRows(a, b, reportOrderBy);
      return reportOrder === 'asc' ? c : -c;
    });
    return copy;
  }, [filteredProducts, reportOrderBy, reportOrder]);

  const handleReportRequestSort = useCallback(
    (property: ReportSortKey) => {
      const isAsc = reportOrderBy === property && reportOrder === 'asc';
      setReportOrder(isAsc ? 'desc' : 'asc');
      setReportOrderBy(property);
    },
    [reportOrderBy, reportOrder]
  );

  const openTxDialog = useCallback(async (row: ProductReport) => {
    if (!menuFlags.canRead) return;
    setSelectedProduct(row);
    setTxDialogOpen(true);
    setTxRows([]);
    setTxError('');
    setTxLoading(true);
    setTxTotal(0);
    try {
      const res = await inventoryService.getInventoryTransactions({
        product_id: row.id,
        page: 1,
        limit: 1000
      });
      if (res?.success && Array.isArray(res.data)) {
        setTxRows(res.data as TxRow[]);
        setTxTotal(Number((res as { pagination?: { total?: number } }).pagination?.total ?? res.data.length));
      } else {
        setTxError(t('inventoryStatus.errors.txLoadFailed'));
      }
    } catch {
      setTxError(t('inventoryStatus.errors.txLoadError'));
    } finally {
      setTxLoading(false);
    }
  }, [t, menuFlags.canRead]);

  const closeTxDialog = useCallback(() => {
    setTxDialogOpen(false);
    setSelectedProduct(null);
    setTxRows([]);
    setTxError('');
  }, []);

  const formatCurrency = (amount: number) => UTILS.formatCurrency(amount);

  const turnoverData = products.reduce((acc: any[], product) => {
    const existing = acc.find(item => item.category === product.category);
    if (existing) {
      existing.totalTurnover += product.turnoverRate || 0;
      existing.count += 1;
    } else {
      acc.push({ category: product.category, totalTurnover: product.turnoverRate || 0, count: 1 });
    }
    return acc;
  }, []).map(item => ({
    category: item.category,
    turnover: item.count ? Number((item.totalTurnover / item.count).toFixed(2)) : 0
  }));

  /** 재고율(%) = (현재재고 ÷ 최대재고) × 100 — 막대는 100%에서 포화, 숫자는 초과 시 그대로 표시 */
  const getStockLevel = (current: number, min: number, max: number) => {
    const rawPct =
      max > 0 && Number.isFinite(max) && Number.isFinite(current) ? (current / max) * 100 : null;
    const barValue = rawPct == null ? 0 : Math.min(rawPct, 100);
    if (rawPct == null) {
      return { level: 'normal' as const, barValue: 0, displayPercent: null as number | null };
    }
    if (min > 0 && current <= min) return { level: 'low' as const, barValue, displayPercent: rawPct };
    if (max > 0 && current >= max * 0.9) return { level: 'high' as const, barValue, displayPercent: rawPct };
    return { level: 'normal' as const, barValue, displayPercent: rawPct };
  };

  const softChipSx = (tone: 'default' | 'info' | 'warning' | 'success' | 'error' | 'primary' | 'secondary') => {
    const light = theme.palette.mode === 'light';
    if (tone === 'default') {
      return {
        height: 26,
        borderRadius: '8px',
        fontWeight: 600,
        fontSize: '0.6875rem',
        border: `1px solid ${light ? 'rgba(15, 23, 42, 0.12)' : theme.palette.divider}`,
        bgcolor: light ? 'rgba(0, 0, 0, 0.02)' : alpha(theme.palette.common.white, 0.06),
        color: 'text.secondary' } as const;
    }
    const main =
      tone === 'primary'
        ? theme.palette.primary.main
        : tone === 'secondary'
          ? theme.palette.secondary.main
          : theme.palette[tone].main;
    const dark =
      tone === 'primary'
        ? theme.palette.primary.dark
        : tone === 'secondary'
          ? theme.palette.secondary.dark
          : theme.palette[tone].dark;
    return {
      height: 26,
      borderRadius: '8px',
      fontWeight: 600,
      fontSize: '0.6875rem',
      border: `1px solid ${alpha(main, light ? 0.3 : 0.42)}`,
      bgcolor: alpha(main, light ? 0.08 : 0.12),
      color: dark } as const;
  };

  const txTypeChipSx = (c: 'default' | 'success' | 'error' | 'warning' | 'info') => {
    if (c === 'success') return softChipSx('success');
    if (c === 'error') return softChipSx('error');
    if (c === 'warning') return softChipSx('warning');
    if (c === 'info') return softChipSx('info');
    return softChipSx('default');
  };

  const listStateBoxSx = {
    ...mvsBodyListTableSx,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    py: { xs: 6, sm: 8 },
    px: 3,
    gap: 1.5 } as const;

  return (
    <Box sx={{ ...mvsPageRootSx }}>
      <DaeheungPageHeader
        title={t('inventoryReport.pageTitle')}
        description={t('inventoryReport.pageSubtitle')}
      />

      {loadError ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {loadError}
        </Alert>
      ) : null}

      {!menuFlags.menusLoading && !menuFlags.canRead ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('common.menuNoView')}
        </Alert>
      ) : null}

      {/* 필터 및 액션 */}
      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 3 }}>
        <Box sx={mvsBodyFilterWrapSx}>
          <Stack direction="row" spacing={2} alignItems="flex-end" justifyContent="space-between" flexWrap="wrap" useFlexGap>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="flex-end">
              <TextField
                size="small"
                select
                label={t('inventoryReport.periodLabel')}
                {...FILTER_OUTLINED}
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                disabled={menuFlags.menusLoading || !menuFlags.canRead}
                sx={reportFilterFieldSx}
              >
                <MenuItem value="week">{t('inventoryReport.periodWeek')}</MenuItem>
                <MenuItem value="month">{t('inventoryReport.periodMonth')}</MenuItem>
                <MenuItem value="quarter">{t('inventoryReport.periodQuarter')}</MenuItem>
                <MenuItem value="year">{t('inventoryReport.periodYear')}</MenuItem>
              </TextField>
              <TextField
                size="small"
                select
                label={t('inventoryReport.categoryLabel')}
                {...FILTER_OUTLINED}
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                disabled={menuFlags.menusLoading || !menuFlags.canRead}
                SelectProps={{
                  displayEmpty: true,
                  renderValue: (selected) =>
                    selected === '' ? t('inventoryReport.allCategories') : String(selected) }}
                sx={reportFilterFieldSx}
              >
                <MenuItem value="">{t('inventoryReport.allCategories')}</MenuItem>
                {categoryOptions.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon fontSize="small" />}
                onClick={loadReportData}
                disabled={loading || menuFlags.menusLoading || !menuFlags.canRead}
                sx={mvsBodyOutlinedBtnSx}
              >
                {t('inventoryReport.refresh')}
              </Button>
              <Button
                variant="outlined"
                startIcon={<PrintIcon fontSize="small" />}
                disabled={menuFlags.menusLoading || !menuFlags.canRead}
                sx={mvsBodyOutlinedBtnSx}
              >
                {t('inventoryReport.print')}
              </Button>
              <Button
                variant="contained"
                disableElevation
                startIcon={<DownloadIcon fontSize="small" />}
                disabled={menuFlags.menusLoading || !menuFlags.canRead}
                sx={mvsBodyPrimaryBtnSx}
              >
                {t('inventoryReport.downloadReport')}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Card>

      {/* 주요 지표 카드 */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'repeat(4, 1fr)' },
          gap: 2.5,
          mb: 3 }}
      >
        <Card elevation={0} sx={mvsKpiCardSx}>
          <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
              {t('inventoryReport.statsTotalProducts')}
            </Typography>
            <Typography variant="h5" sx={{ mt: 0.75, fontWeight: 600, letterSpacing: '-0.02em', color: 'text.primary' }}>
              {loading ? '…' : stats.totalProducts}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {t('inventoryReport.statsActiveProducts')}
            </Typography>
          </CardContent>
        </Card>
        <Card elevation={0} sx={mvsKpiCardSx}>
          <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
              {t('inventoryReport.statsTotalValue')}
            </Typography>
            <Typography variant="h5" sx={{ mt: 0.75, fontWeight: 600, letterSpacing: '-0.02em', color: 'text.primary' }}>
              {loading ? '…' : formatCurrency(stats.totalValue)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {t('inventoryReport.statsTotalValueHint')}
            </Typography>
          </CardContent>
        </Card>
        <Card elevation={0} sx={mvsKpiCardSx}>
          <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
              {t('inventoryReport.statsLowStock')}
            </Typography>
            <Typography variant="h5" sx={{ mt: 0.75, fontWeight: 600, letterSpacing: '-0.02em', color: 'warning.main' }}>
              {loading ? '…' : stats.lowStockItems}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {t('inventoryReport.statsLowStockHint')}
            </Typography>
          </CardContent>
        </Card>
        <Card elevation={0} sx={mvsKpiCardSx}>
          <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
              {t('inventoryReport.statsAvgTurnover')}
            </Typography>
            <Typography variant="h5" sx={{ mt: 0.75, fontWeight: 600, letterSpacing: '-0.02em', color: 'info.main' }}>
              {loading ? '…' : `${stats.averageTurnover}x`}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {t('inventoryReport.statsAvgTurnoverHint')}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* 차트 섹션 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* 월별 재고 추이 */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card elevation={0} sx={mvsBodyCardSx}>
            <Box sx={mvsBodySectionHeaderSx}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em', color: 'text.primary' }}>
                {t('inventoryReport.chartMonthlyTrend')}
              </Typography>
            </Box>
            <CardContent sx={{ px: { xs: 2, sm: 2.5 }, py: 2.5, '&:last-child': { pb: 2.5 } }}>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <RechartsTooltip />
                  <Line 
                    type="monotone" 
                    dataKey="stock" 
                    stroke="#4caf50" 
                    strokeWidth={3}
                    name={t('inventoryReport.chartSeriesStock')}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="movements" 
                    stroke="#2196f3" 
                    strokeWidth={3}
                    name={t('inventoryReport.chartSeriesMovements')}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* 카테고리별 재고 분포 */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card elevation={0} sx={mvsBodyCardSx}>
            <Box sx={mvsBodySectionHeaderSx}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em', color: 'text.primary' }}>
                {t('inventoryReport.chartCategoryDistribution')}
              </Typography>
            </Box>
            <CardContent sx={{ px: { xs: 2, sm: 2.5 }, py: 2.5, '&:last-child': { pb: 2.5 } }}>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryDistribution.length > 0 ? categoryDistribution : [{ name: t('inventoryReport.noData'), value: 0 }]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
              <Box sx={{ mt: 2 }}>
                {categoryDistribution.map((item, index) => (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        backgroundColor: item.color || CHART_COLORS[index % CHART_COLORS.length],
                        borderRadius: '50%',
                        mr: 1
                      }}
                    />
                    <Typography variant="body2" sx={{ flexGrow: 1 }}>
                      {item.name}
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {formatCurrency(item.value)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 회전율 분석 */}
        <Grid size={{ xs: 12 }}>
          <Card elevation={0} sx={mvsBodyCardSx}>
            <Box sx={mvsBodySectionHeaderSx}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em', color: 'text.primary' }}>
                {t('inventoryReport.chartTurnoverByCategory')}
              </Typography>
            </Box>
            <CardContent sx={{ px: { xs: 2, sm: 2.5 }, py: 2.5, '&:last-child': { pb: 2.5 } }}>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={turnoverData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <RechartsTooltip
                    formatter={(value: number) => t('inventoryReport.turnoverTooltip', { value })}
                  />
                  <Bar dataKey="turnover" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 상세 재고 현황 테이블 */}
      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 0 }}>
        <Box sx={mvsBodySectionHeaderSx}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em', color: 'text.primary' }}>
            {t('inventoryReport.detailTableTitle')}
          </Typography>
          <TextField
            size="small"
            label={t('common.search')}
            {...FILTER_OUTLINED}
            placeholder={t('inventoryReport.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={menuFlags.menusLoading || !menuFlags.canRead}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: '1.125rem', color: 'text.secondary' }} />
                </InputAdornment>
              ) }}
            sx={{ ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx, minWidth: 260 }}
          />
        </Box>
      </Card>

      <Box sx={mvsBodyListZoneSx}>
        {loading ? (
          <Box sx={listStateBoxSx}>
            <CircularProgress size={36} />
            <Typography variant="body2" color="text.secondary">
              {t('inventoryManagement.empty.loading')}
            </Typography>
          </Box>
        ) : filteredProducts.length === 0 ? (
          <Box sx={listStateBoxSx}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em', color: 'text.primary' }}>
              {t('inventoryReport.emptyFiltered')}
            </Typography>
          </Box>
        ) : (
          <TableContainer sx={{ ...mvsBodyListTableSx, ...mvsTableScrollSx }}>
            <Table
              size="small"
              sx={{
                width: '100%',
                minWidth: 1200,
                borderCollapse: 'collapse',
                bgcolor: 'transparent',
                '& .MuiTableCell-root': {
                  borderLeft: 'none',
                  borderRight: 'none',
                  borderTop: 'none' } }}
            >
              <TableHead sx={mvsTableHeadHighlightSx}>
                  <TableRow>
                    <TableCell sortDirection={reportOrderBy === 'productCode' ? reportOrder : false}>
                      <TableSortLabel
                        disabled={menuFlags.menusLoading || !menuFlags.canRead}
                        active={reportOrderBy === 'productCode'}
                        direction={reportOrderBy === 'productCode' ? reportOrder : 'asc'}
                        onClick={() => handleReportRequestSort('productCode')}
                      >
                        {t('inventoryReport.colProductCode')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sortDirection={reportOrderBy === 'name' ? reportOrder : false}>
                      <TableSortLabel
                        disabled={menuFlags.menusLoading || !menuFlags.canRead}
                        active={reportOrderBy === 'name'}
                        direction={reportOrderBy === 'name' ? reportOrder : 'asc'}
                        onClick={() => handleReportRequestSort('name')}
                      >
                        {t('inventoryReport.colProductName')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sortDirection={reportOrderBy === 'category' ? reportOrder : false}>
                      <TableSortLabel
                        disabled={menuFlags.menusLoading || !menuFlags.canRead}
                        active={reportOrderBy === 'category'}
                        direction={reportOrderBy === 'category' ? reportOrder : 'asc'}
                        onClick={() => handleReportRequestSort('category')}
                      >
                        {t('inventoryReport.colCategory')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right" sortDirection={reportOrderBy === 'currentStock' ? reportOrder : false}>
                      <TableSortLabel
                        disabled={menuFlags.menusLoading || !menuFlags.canRead}
                        active={reportOrderBy === 'currentStock'}
                        direction={reportOrderBy === 'currentStock' ? reportOrder : 'asc'}
                        onClick={() => handleReportRequestSort('currentStock')}
                      >
                        {t('inventoryReport.colCurrentStock')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right" sortDirection={reportOrderBy === 'stockRate' ? reportOrder : false}>
                      <TableSortLabel
                        disabled={menuFlags.menusLoading || !menuFlags.canRead}
                        active={reportOrderBy === 'stockRate'}
                        direction={reportOrderBy === 'stockRate' ? reportOrder : 'asc'}
                        onClick={() => handleReportRequestSort('stockRate')}
                      >
                        {t('inventoryReport.colStockRate')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right" sortDirection={reportOrderBy === 'minMax' ? reportOrder : false}>
                      <TableSortLabel
                        disabled={menuFlags.menusLoading || !menuFlags.canRead}
                        active={reportOrderBy === 'minMax'}
                        direction={reportOrderBy === 'minMax' ? reportOrder : 'asc'}
                        onClick={() => handleReportRequestSort('minMax')}
                      >
                        {t('inventoryReport.colMinMax')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right" sortDirection={reportOrderBy === 'unitPrice' ? reportOrder : false}>
                      <TableSortLabel
                        disabled={menuFlags.menusLoading || !menuFlags.canRead}
                        active={reportOrderBy === 'unitPrice'}
                        direction={reportOrderBy === 'unitPrice' ? reportOrder : 'asc'}
                        onClick={() => handleReportRequestSort('unitPrice')}
                      >
                        {t('inventoryReport.colUnitPrice')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right" sortDirection={reportOrderBy === 'totalValue' ? reportOrder : false}>
                      <TableSortLabel
                        disabled={menuFlags.menusLoading || !menuFlags.canRead}
                        active={reportOrderBy === 'totalValue'}
                        direction={reportOrderBy === 'totalValue' ? reportOrder : 'asc'}
                        onClick={() => handleReportRequestSort('totalValue')}
                      >
                        {t('inventoryReport.colTotalValue')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right" sortDirection={reportOrderBy === 'turnoverRate' ? reportOrder : false}>
                      <TableSortLabel
                        disabled={menuFlags.menusLoading || !menuFlags.canRead}
                        active={reportOrderBy === 'turnoverRate'}
                        direction={reportOrderBy === 'turnoverRate' ? reportOrder : 'asc'}
                        onClick={() => handleReportRequestSort('turnoverRate')}
                      >
                        {t('inventoryReport.colTurnover')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sortDirection={reportOrderBy === 'status' ? reportOrder : false}>
                      <TableSortLabel
                        disabled={menuFlags.menusLoading || !menuFlags.canRead}
                        active={reportOrderBy === 'status'}
                        direction={reportOrderBy === 'status' ? reportOrder : 'asc'}
                        onClick={() => handleReportRequestSort('status')}
                      >
                        {t('inventoryReport.colStatus')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sortDirection={reportOrderBy === 'lastMovement' ? reportOrder : false}>
                      <TableSortLabel
                        disabled={menuFlags.menusLoading || !menuFlags.canRead}
                        active={reportOrderBy === 'lastMovement'}
                        direction={reportOrderBy === 'lastMovement' ? reportOrder : 'asc'}
                        onClick={() => handleReportRequestSort('lastMovement')}
                      >
                        {t('inventoryReport.colLastUpdated')}
                      </TableSortLabel>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody sx={mvsTableBodyRowSx}>
                  {sortedFilteredProducts.map((product) => {
                    const stockLevel = getStockLevel(product.currentStock, product.minStock, product.maxStock);
                    const statusInfo = getStatusInfo(product);
                    const lowOrOut =
                      product.currentStock === 0 ||
                      (product.minStock > 0 && product.currentStock <= product.minStock);
                    return (
                      <TableRow
                        key={product.id}
                        onClick={menuFlags.canRead ? () => void openTxDialog(product) : undefined}
                        sx={{
                          cursor: menuFlags.canRead ? 'pointer' : 'default',
                          '&:active': { bgcolor: menuFlags.canRead ? 'action.selected' : undefined } }}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {product.productCode || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {product.name}
                          </Typography>
                        </TableCell>
                        <TableCell>{product.category}</TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            color={lowOrOut ? 'error.main' : 'text.primary'}
                          >
                            {t('inventoryStatus.pieces', { n: product.currentStock })}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ minWidth: 88 }}>
                            <LinearProgress
                              variant="determinate"
                              value={stockLevel.barValue}
                              color={
                                stockLevel.level === 'low'
                                  ? 'error'
                                  : stockLevel.level === 'high'
                                    ? 'warning'
                                    : 'success'
                              }
                              sx={{
                                mb: 0.5,
                                height: 6,
                                borderRadius: '4px',
                                bgcolor:
                                  theme.palette.mode === 'light' ? 'rgba(15, 23, 42, 0.08)' : alpha(theme.palette.common.white, 0.08),
                                '& .MuiLinearProgress-bar': { borderRadius: '4px' } }}
                            />
                            <Typography variant="caption">
                              {stockLevel.displayPercent == null
                                ? '—'
                                : `${stockLevel.displayPercent.toFixed(1)}%`}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {t('inventoryReport.minMaxUnits', { min: product.minStock, max: product.maxStock })}
                          </Typography>
                        </TableCell>
                        <TableCell>{formatCurrency(product.unitPrice)}</TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {formatCurrency(product.totalValue)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {t('inventoryReport.turnoverPerYear', { rate: product.turnoverRate || 0 })}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={statusInfo.icon}
                            label={statusInfo.label}
                            size="small"
                            sx={{
                              ...softChipSx(statusInfo.chipTone),
                              '& .MuiChip-icon': { color: 'inherit', opacity: 0.92, ml: '6px' } }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {product.lastMovement
                              ? new Date(product.lastMovement).toLocaleDateString(locale)
                              : '—'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
        )}
      </Box>

      <Dialog open={txDialogOpen} onClose={closeTxDialog} maxWidth="md" fullWidth scroll="paper">
        <DialogTitle sx={{ pr: 6 }}>
          {t('inventoryStatus.txDialog.title')}
          {selectedProduct ? (
            <Typography
              component="span"
              variant="body2"
              color="text.secondary"
              sx={{ display: 'block', mt: 0.5, fontWeight: 400 }}
            >
              {selectedProduct.name} · {selectedProduct.productCode || '—'}
            </Typography>
          ) : null}
        </DialogTitle>
        <DialogContent dividers>
          {txLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={32} />
            </Box>
          ) : txError ? (
            <Alert severity="error">{txError}</Alert>
          ) : txRows.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2 }}>
              {t('inventoryStatus.txDialog.noRecords')}
            </Typography>
          ) : (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                {t('inventoryStatus.txDialog.totalShown', { total: txTotal })}
              </Typography>
              <TableContainer sx={{ ...mvsBodyListTableSx, ...mvsTableScrollSx, borderRadius: '8px', overflow: 'hidden' }}>
                <Table size="small" sx={{ borderCollapse: 'collapse', bgcolor: 'transparent' }}>
                  <TableHead sx={mvsTableHeadHighlightSx}>
                    <TableRow>
                      <TableCell width={160}>{t('inventoryStatus.txColumns.datetime')}</TableCell>
                      <TableCell width={100}>{t('inventoryStatus.txColumns.type')}</TableCell>
                      <TableCell width={120}>{t('inventoryStatus.txColumns.handler')}</TableCell>
                      <TableCell align="right">{t('inventoryStatus.txColumns.quantity')}</TableCell>
                      <TableCell align="right">{t('inventoryStatus.txColumns.unitPrice')}</TableCell>
                      <TableCell align="right">{t('inventoryStatus.txColumns.amount')}</TableCell>
                      <TableCell>{t('inventoryStatus.txColumns.notes')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody sx={mvsTableBodyRowSx}>
                    {txRows.map((tx) => {
                      const tinfo = formatTxTypeChip(tx.transaction_type);
                      const qty = Number(tx.quantity ?? 0);
                      const at = tx.created_at ? new Date(tx.created_at) : null;
                      return (
                        <TableRow key={tx.id}>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {at && !Number.isNaN(at.getTime())
                              ? at.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'medium' })
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={tinfo.label} sx={txTypeChipSx(tinfo.color)} />
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatTransactionCreator(tx)}</TableCell>
                          <TableCell align="right">{qty.toLocaleString(locale)}</TableCell>
                          <TableCell align="right">{formatCurrency(Number(tx.unit_price ?? 0))}</TableCell>
                          <TableCell align="right">{formatCurrency(Number(tx.total_amount ?? 0))}</TableCell>
                          <TableCell sx={{ maxWidth: 220, wordBreak: 'break-word' }}>{tx.notes?.trim() || '—'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeTxDialog} variant="contained" disableElevation sx={mvsBodyPrimaryBtnSx}>
            {t('inventoryStatus.txDialog.close')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InventoryReport;