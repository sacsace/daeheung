import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  InputAdornment,
  Chip,
  Alert,
  LinearProgress,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tooltip,
} from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import {
  mvsPageRootSx,
  mvsTableHeadHighlightSx,
  mvsSearchFieldSx,
  mvsKpiCardSx,
  mvsFilterFieldHeightSx,
  mvsBodyCardSx,
  mvsBodySectionHeaderSx,
  mvsBodyFilterWrapSx,
  mvsBodyListZoneSx,
  mvsBodyListTableSx,
  mvsBodyPrimaryBtnSx,
  mvsTableBodyRowSx,
  mvsTableScrollSx,
} from '../../theme/daeheungLayout';
import { Search as SearchIcon, Warning as WarningIcon, CheckCircle as CheckCircleIcon, Error as ErrorIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { alpha, useTheme } from '@mui/material/styles';
import { inventoryService } from '../../services/api';
import { UTILS } from '../../constants';
import { useMenuRoutePermissionFlags } from '../../hooks/useMenuRoutePermissionFlags';

const INVENTORY_STATUS_MENU_ROUTES = ['/inventory/status', '/inventory'] as const;

type StatusRow = {
  id: number;
  productCode: string;
  productName: string;
  category: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  unitPrice: number;
  totalValue: number;
  lastUpdated: string;
};

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
  product?: { name?: string; product_code?: string };
};

function formatTransactionCreator(tx: TxRow): string {
  const u = tx.creator;
  if (u?.username?.trim()) return u.username.trim();
  if (u?.email?.trim()) return u.email.trim();
  if (tx.created_by != null) return `#${tx.created_by}`;
  return '—';
}

/** 재고율(%) = (현재재고 ÷ 최대재고) × 100 — 최대재고를 100% 기준. 최대재고 미설정(≤0)이면 null */
function stockRatePercentVsMax(current: number, max: number): number | null {
  if (!(max > 0) || !Number.isFinite(max)) return null;
  const c = Number(current);
  if (!Number.isFinite(c)) return null;
  return (c / max) * 100;
}

type StatusSortKey =
  | 'productCode'
  | 'productName'
  | 'category'
  | 'currentStock'
  | 'minStock'
  | 'maxStock'
  | 'stockRate'
  | 'unitPrice'
  | 'totalValue'
  | 'status';

function getStatusSortRank(item: StatusRow): number {
  if (item.currentStock === 0) return 0;
  if (item.minStock > 0 && item.currentStock <= item.minStock) return 1;
  if (item.maxStock > 0 && item.currentStock >= item.maxStock * 0.9) return 2;
  return 3;
}

function compareStatusRows(a: StatusRow, b: StatusRow, orderBy: StatusSortKey): number {
  switch (orderBy) {
    case 'productCode':
      return a.productCode.localeCompare(b.productCode, undefined, { sensitivity: 'base' });
    case 'productName':
      return a.productName.localeCompare(b.productName, undefined, { sensitivity: 'base' });
    case 'category':
      return a.category.localeCompare(b.category, undefined, { sensitivity: 'base' });
    case 'currentStock':
      return a.currentStock - b.currentStock;
    case 'minStock':
      return a.minStock - b.minStock;
    case 'maxStock':
      return a.maxStock - b.maxStock;
    case 'stockRate': {
      const ra = stockRatePercentVsMax(a.currentStock, a.maxStock);
      const rb = stockRatePercentVsMax(b.currentStock, b.maxStock);
      const na = ra == null ? Number.NEGATIVE_INFINITY : ra;
      const nb = rb == null ? Number.NEGATIVE_INFINITY : rb;
      return na - nb;
    }
    case 'unitPrice':
      return a.unitPrice - b.unitPrice;
    case 'totalValue':
      return a.totalValue - b.totalValue;
    case 'status':
      return getStatusSortRank(a) - getStatusSortRank(b);
    default:
      return 0;
  }
}

const InventoryStatus: React.FC = () => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'ko-KR';
  const menuFlags = useMenuRoutePermissionFlags(INVENTORY_STATUS_MENU_ROUTES);

  const [inventoryItems, setInventoryItems] = useState<StatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalValue: 0,
    lowStockItems: 0,
    outOfStockItems: 0
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [orderBy, setOrderBy] = useState<StatusSortKey>('productCode');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');

  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<StatusRow | null>(null);
  const [txRows, setTxRows] = useState<TxRow[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState('');
  const [txTotal, setTxTotal] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [productsRes, reportRes] = await Promise.all([
        inventoryService.getProducts({ page: 1, limit: 2000, search: '', category: '' }),
        inventoryService.getInventoryReport()
      ]);

      if (!productsRes?.success || !Array.isArray(productsRes.data)) {
        setInventoryItems([]);
        setLoadError(t('inventoryStatus.errors.loadListFailed'));
        return;
      }

      const rows: StatusRow[] = productsRes.data.map((product: Record<string, unknown>) => {
        const currentStock = Number(product.stock_quantity ?? product.current_stock ?? 0);
        const minStock = Number(product.min_stock_level ?? product.min_stock ?? 0);
        const maxStock = Number(product.max_stock_level ?? product.max_stock ?? 0);
        const unitPrice = parseFloat(String(product.unit_price ?? 0));
        return {
          id: Number(product.id),
          productCode: String(product.product_code ?? product.sku ?? ''),
          productName: String(product.name ?? ''),
          category: String(product.category ?? ''),
          currentStock,
          minStock,
          maxStock,
          unitPrice,
          totalValue: currentStock * unitPrice,
          lastUpdated: product.updated_at
            ? new Date(String(product.updated_at)).toISOString().split('T')[0]
            : ''
        };
      });
      setInventoryItems(rows);

      if (reportRes?.success && reportRes.data?.stats) {
        const s = reportRes.data.stats;
        setStats({
          totalProducts: Number(s.totalProducts ?? rows.length),
          totalValue: Number(s.totalValue ?? 0),
          lowStockItems: Number(s.lowStockItems ?? 0),
          outOfStockItems: Number(s.outOfStockItems ?? 0)
        });
      } else {
        let totalValue = 0;
        let low = 0;
        let out = 0;
        rows.forEach((r) => {
          totalValue += r.totalValue;
          if (r.currentStock === 0) out++;
          else if (r.minStock > 0 && r.currentStock <= r.minStock) low++;
        });
        setStats({
          totalProducts: rows.length,
          totalValue,
          lowStockItems: low,
          outOfStockItems: out
        });
      }
    } catch {
      setLoadError(t('inventoryStatus.errors.loadDataError'));
      setInventoryItems([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (menuFlags.menusLoading || !menuFlags.canRead) return;
    loadData();
  }, [loadData, menuFlags.menusLoading, menuFlags.canRead]);

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

  const getStatusInfo = (item: StatusRow) => {
    const is = { fontSize: '0.875rem' as const };
    if (item.currentStock === 0) {
      return {
        label: t('inventoryStatus.rowStatus.outOfStock'),
        chipTone: 'error' as const,
        icon: <ErrorIcon sx={{ ...is, color: alpha(theme.palette.error.main, 0.85) }} />
      };
    }
    if (item.minStock > 0 && item.currentStock <= item.minStock) {
      return {
        label: t('inventoryStatus.rowStatus.lowStock'),
        chipTone: 'error' as const,
        icon: <WarningIcon sx={{ ...is, color: alpha(theme.palette.error.main, 0.9) }} />
      };
    }
    if (item.maxStock > 0 && item.currentStock >= item.maxStock * 0.9) {
      return {
        label: t('inventoryStatus.rowStatus.overstock'),
        chipTone: 'info' as const,
        icon: <WarningIcon sx={{ ...is, color: alpha(theme.palette.info.main, 0.88) }} />
      };
    }
    return {
      label: t('inventoryStatus.rowStatus.normal'),
      chipTone: 'success' as const,
      icon: <CheckCircleIcon sx={{ ...is, color: alpha(theme.palette.success.main, 0.85) }} />
    };
  };

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return inventoryItems;
    return inventoryItems.filter(
      (item) =>
        item.productName.toLowerCase().includes(q) || item.productCode.toLowerCase().includes(q)
    );
  }, [inventoryItems, searchTerm]);

  const sortedItems = useMemo(() => {
    const copy = [...filteredItems];
    copy.sort((a, b) => {
      const c = compareStatusRows(a, b, orderBy);
      return order === 'asc' ? c : -c;
    });
    return copy;
  }, [filteredItems, orderBy, order]);

  const handleRequestSort = useCallback((property: StatusSortKey) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  }, [orderBy, order]);

  const formatCurrency = (amount: number) => UTILS.formatCurrency(amount);

  const openTxDialog = useCallback(async (row: StatusRow) => {
    if (!menuFlags.canRead) return;
    setSelectedRow(row);
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
    setSelectedRow(null);
    setTxRows([]);
    setTxError('');
  }, []);

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
        color: 'text.secondary',
      } as const;
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
      color: dark,
    } as const;
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
    gap: 1.5,
  } as const;

  const statusTableSx = {
    width: '100%',
    tableLayout: 'fixed' as const,
    minWidth: { xs: 960, sm: 1100 },
    borderCollapse: 'collapse',
    bgcolor: 'transparent',
    '& .MuiTableCell-root': {
      borderLeft: 'none',
      borderRight: 'none',
      borderTop: 'none',
    },
  } as const;

  const statusCellBaseSx = {
    fontSize: { xs: '0.75rem', sm: '0.8125rem' },
    py: 0.75,
    px: { xs: 0.5, sm: 1 },
    verticalAlign: 'middle' as const,
  } as const;

  const statusCellEllipsisSx = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 0,
  } as const;

  const renderEllipsisText = (text: string, fontWeight?: number) => (
    <Tooltip title={text} placement="top-start" enterDelay={400}>
      <Box
        component="span"
        sx={{
          display: 'block',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight,
        }}
      >
        {text}
      </Box>
    </Tooltip>
  );

  return (
    <Box sx={{ ...mvsPageRootSx }}>
      <DaeheungPageHeader
        title={t('inventoryStatus.pageTitle')}
        description={t('inventoryStatus.pageSubtitle')}
      />

      {loadError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {loadError}
        </Alert>
      ) : null}

      {!menuFlags.menusLoading && !menuFlags.canRead ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('common.menuNoView')}
        </Alert>
      ) : null}

      {/* 요약 카드 — 재고 보고서 API 통계 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 2.5, mb: 3 }}>
        <Card elevation={0} sx={mvsKpiCardSx}>
          <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
              {t('inventoryStatus.stats.totalValue')}
            </Typography>
            <Typography variant="h5" sx={{ mt: 0.75, fontWeight: 600, letterSpacing: '-0.02em', color: 'text.primary' }}>
              {loading ? '…' : formatCurrency(stats.totalValue)}
            </Typography>
          </CardContent>
        </Card>
        <Card elevation={0} sx={mvsKpiCardSx}>
          <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
              {t('inventoryStatus.stats.lowStock')}
            </Typography>
            <Typography variant="h5" sx={{ mt: 0.75, fontWeight: 600, letterSpacing: '-0.02em', color: 'error.main' }}>
              {loading ? '…' : t('inventoryStatus.statsCountSuffix', { count: stats.lowStockItems })}
            </Typography>
          </CardContent>
        </Card>
        <Card elevation={0} sx={mvsKpiCardSx}>
          <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
              {t('inventoryStatus.stats.outOfStock')}
            </Typography>
            <Typography variant="h5" sx={{ mt: 0.75, fontWeight: 600, letterSpacing: '-0.02em', color: 'error.main' }}>
              {loading ? '…' : t('inventoryStatus.statsCountSuffix', { count: stats.outOfStockItems })}
            </Typography>
          </CardContent>
        </Card>
        <Card elevation={0} sx={mvsKpiCardSx}>
          <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
              {t('inventoryStatus.stats.totalProducts')}
            </Typography>
            <Typography variant="h5" sx={{ mt: 0.75, fontWeight: 600, letterSpacing: '-0.02em', color: 'text.primary' }}>
              {loading ? '…' : t('inventoryStatus.statsCountSuffix', { count: stats.totalProducts })}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {!loading && (stats.lowStockItems > 0 || stats.outOfStockItems > 0) ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {t('inventoryStatus.alertLowOut', { low: stats.lowStockItems, out: stats.outOfStockItems })}
        </Alert>
      ) : null}

      {/* 재고 현황 테이블 — 컨트롤(검색)과 리스트 영역 분리 */}
      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 0 }}>
        <Box sx={mvsBodySectionHeaderSx}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em', color: 'text.primary' }}>
            {t('inventoryStatus.tableTitle')}
          </Typography>
        </Box>
        <Box sx={mvsBodyFilterWrapSx}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) minmax(0, 1fr)' },
              gap: 2,
              alignItems: 'flex-end',
              maxWidth: { sm: 640 },
              ...(mvsSearchFieldSx as Record<string, unknown>),
            }}
          >
            <TextField
              fullWidth
              size="small"
              label={t('inventoryStatus.searchLabel')}
              placeholder={t('inventoryStatus.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={menuFlags.menusLoading || !menuFlags.canRead}
              InputLabelProps={{ shrink: true }}
              sx={{ ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
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
        ) : filteredItems.length === 0 ? (
          <Box sx={listStateBoxSx}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em', color: 'text.primary' }}>
              {t('inventoryStatus.emptyTable')}
            </Typography>
          </Box>
        ) : (
          <TableContainer sx={{ ...mvsBodyListTableSx, ...mvsTableScrollSx }}>
              <Table size="small" sx={statusTableSx}>
                <TableHead sx={mvsTableHeadHighlightSx}>
                  <TableRow>
                    {[
                      { key: 'productCode' as const, label: t('inventoryStatus.columns.productCode'), width: '12%', align: 'left' as const, ellipsis: true },
                      { key: 'productName' as const, label: t('inventoryStatus.columns.productName'), width: '12%', align: 'left' as const, ellipsis: true },
                      { key: 'category' as const, label: t('inventoryStatus.columns.category'), width: '12%', align: 'left' as const, ellipsis: true },
                      { key: 'currentStock' as const, label: t('inventoryStatus.columns.currentStock'), width: '8%', align: 'right' as const },
                      { key: 'minStock' as const, label: t('inventoryStatus.columns.minStock'), width: '8%', align: 'right' as const },
                      { key: 'maxStock' as const, label: t('inventoryStatus.columns.maxStock'), width: '8%', align: 'right' as const },
                      { key: 'stockRate' as const, label: t('inventoryStatus.columns.stockRate'), width: '12%', align: 'right' as const },
                      { key: 'unitPrice' as const, label: t('inventoryStatus.columns.unitPrice'), width: '9%', align: 'right' as const },
                      { key: 'totalValue' as const, label: t('inventoryStatus.columns.totalValue'), width: '10%', align: 'right' as const },
                      { key: 'status' as const, label: t('inventoryStatus.columns.status'), width: '11%', align: 'left' as const },
                    ].map((col) => (
                      <TableCell
                        key={col.key}
                        align={col.align}
                        width={col.width}
                        sortDirection={orderBy === col.key ? order : false}
                        sx={{
                          whiteSpace: 'nowrap',
                          verticalAlign: 'middle',
                          ...(col.ellipsis ? statusCellEllipsisSx : {}),
                        }}
                      >
                        <TableSortLabel
                          disabled={menuFlags.menusLoading || !menuFlags.canRead}
                          active={orderBy === col.key}
                          direction={orderBy === col.key ? order : 'asc'}
                          onClick={() => handleRequestSort(col.key)}
                          sx={{
                            color: 'inherit',
                            '& .MuiTableSortLabel-icon': { color: 'inherit' },
                          }}
                        >
                          {col.label}
                        </TableSortLabel>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody sx={mvsTableBodyRowSx}>
                  {sortedItems.map((item) => {
                    const statusInfo = getStatusInfo(item);
                    const ratePct = stockRatePercentVsMax(item.currentStock, item.maxStock);
                    const barFill = ratePct == null ? 0 : Math.min(ratePct, 100);
                    const lowOrOut = item.currentStock === 0 || (item.minStock > 0 && item.currentStock <= item.minStock);
                    const highStock = item.maxStock > 0 && item.currentStock >= item.maxStock * 0.9 && !lowOrOut;

                    return (
                      <TableRow
                        key={item.id}
                        onClick={menuFlags.canRead ? () => void openTxDialog(item) : undefined}
                        sx={{
                          cursor: menuFlags.canRead ? 'pointer' : 'default',
                          '&:active': { bgcolor: menuFlags.canRead ? 'action.selected' : undefined },
                        }}
                      >
                        <TableCell sx={{ ...statusCellBaseSx, ...statusCellEllipsisSx }}>
                          {renderEllipsisText(item.productCode, 700)}
                        </TableCell>
                        <TableCell sx={{ ...statusCellBaseSx, ...statusCellEllipsisSx }}>
                          {renderEllipsisText(item.productName)}
                        </TableCell>
                        <TableCell sx={{ ...statusCellBaseSx, ...statusCellEllipsisSx }}>
                          {renderEllipsisText(item.category)}
                        </TableCell>
                        <TableCell align="right" sx={{ ...statusCellBaseSx, whiteSpace: 'nowrap' }}>
                          <Typography
                            variant="subtitle2"
                            sx={{
                              fontWeight: 'bold',
                              fontSize: 'inherit',
                              color: lowOrOut ? 'error.main' : 'text.primary',
                            }}
                          >
                            {t('inventoryStatus.pieces', { n: item.currentStock })}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ ...statusCellBaseSx, whiteSpace: 'nowrap' }}>
                          {t('inventoryStatus.pieces', { n: item.minStock })}
                        </TableCell>
                        <TableCell align="right" sx={{ ...statusCellBaseSx, whiteSpace: 'nowrap' }}>
                          {t('inventoryStatus.pieces', { n: item.maxStock })}
                        </TableCell>
                        <TableCell align="right" sx={statusCellBaseSx}>
                          <Box sx={{ width: '100%', maxWidth: 120, ml: 'auto' }}>
                            <LinearProgress
                              variant="determinate"
                              value={barFill}
                              color={lowOrOut ? 'error' : highStock ? 'warning' : 'success'}
                              sx={{
                                mb: 0.5,
                                height: 6,
                                borderRadius: '4px',
                                bgcolor:
                                  theme.palette.mode === 'light' ? 'rgba(15, 23, 42, 0.08)' : alpha(theme.palette.common.white, 0.08),
                                '& .MuiLinearProgress-bar': { borderRadius: '4px' },
                              }}
                            />
                            <Typography
                              variant="caption"
                              sx={{ color: lowOrOut ? 'error.main' : 'text.secondary' }}
                            >
                              {ratePct == null ? '—' : `${ratePct.toFixed(1)}%`}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="right" sx={{ ...statusCellBaseSx, whiteSpace: 'nowrap' }}>
                          {formatCurrency(item.unitPrice)}
                        </TableCell>
                        <TableCell align="right" sx={{ ...statusCellBaseSx, whiteSpace: 'nowrap' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', fontSize: 'inherit' }}>
                            {formatCurrency(item.totalValue)}
                          </Typography>
                        </TableCell>
                        <TableCell sx={statusCellBaseSx}>
                          <Chip
                            icon={statusInfo.icon}
                            label={statusInfo.label}
                            size="small"
                            sx={{
                              ...softChipSx(statusInfo.chipTone),
                              maxWidth: '100%',
                              '& .MuiChip-label': {
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              },
                              '& .MuiChip-icon': { color: 'inherit', opacity: 0.92, ml: '6px' },
                            }}
                          />
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
          {selectedRow ? (
            <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontWeight: 400 }}>
              {selectedRow.productName} · {selectedRow.productCode}
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

export default InventoryStatus;
