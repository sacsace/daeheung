import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  MenuItem,
  Snackbar,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  RestartAlt as ResetIcon,
  Search as SearchIcon,
  FileDownload as DownloadIcon,
  TrendingDown,
  TrendingUp,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import AccountingCompanyBar from '../../components/Accounting/AccountingCompanyBar';
import { useAccountingCompany } from '../../hooks/useAccountingCompany';
import { accountingService } from '../../services/api';
import { getGlAccountName } from '../../utils/glAccountLabel';
import { formatInr } from '../../utils/formatInr';
import { exportProfitAndLossExcel } from '../../utils/exportFinancialStatementExcel';
import {
  mvsBodyCardSx,
  mvsBodyFilterWrapSx,
  mvsBodyListTableSx,
  mvsBodyListZoneSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPrimaryBtnSx,
  mvsFilterFieldHeightSx,
  mvsKpiCardSx,
  mvsOutlinedLabelProps,
  mvsPageRootSx,
  mvsSearchFieldSx,
  mvsTableBodyRowSx,
  mvsTableHeadHighlightSx,
  mvsTableScrollSx,
} from '../../theme/daeheungLayout';

type PlRow = {
  accountId: number;
  code: string;
  name: string;
  nameEn?: string | null;
  amount: number;
};

type PlData = {
  from: string | null;
  to: string | null;
  incomeRows: PlRow[];
  expenseRows: PlRow[];
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  source?: string;
  tallyVoucherCount?: number;
};

type PlPeriodKey = 'q1' | 'q2' | 'q3' | 'q4' | 'fiscalYear';

type FyOption = {
  startYear: number;
  start_date: string;
  end_date: string;
  label: string;
};

const PL_PERIOD_KEYS: PlPeriodKey[] = ['q1', 'q2', 'q3', 'q4', 'fiscalYear'];

const toYmdLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** 인도식 FY: 4/1 ~ 익년 3/31 */
const getIndiaFyStartYear = (now = new Date()) =>
  now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;

const buildFiscalYearOptions = (now = new Date(), past = 3, future = 3): FyOption[] => {
  const currentStart = getIndiaFyStartYear(now);
  const options: FyOption[] = [];
  for (let y = currentStart - past; y <= currentStart + future; y += 1) {
    const endShort = String(y + 1).slice(-2);
    options.push({
      startYear: y,
      start_date: `${y}-04-01`,
      end_date: `${y + 1}-03-31`,
      label: `FY ${y}-${endShort}`,
    });
  }
  return options;
};

const parseYmdLocal = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const getProfitAndLossPeriodRange = (
  key: PlPeriodKey,
  fy: Pick<FyOption, 'start_date' | 'end_date'>
): { from: string; to: string } => {
  if (key === 'fiscalYear') {
    return { from: fy.start_date, to: fy.end_date };
  }
  const quarterIndex = ({ q1: 0, q2: 1, q3: 2, q4: 3 } as const)[key];
  const fyStart = parseYmdLocal(fy.start_date);
  const qStart = new Date(fyStart.getFullYear(), fyStart.getMonth() + quarterIndex * 3, fyStart.getDate());
  const qEndExclusive = new Date(
    fyStart.getFullYear(),
    fyStart.getMonth() + (quarterIndex + 1) * 3,
    fyStart.getDate()
  );
  const qEnd = new Date(qEndExclusive);
  qEnd.setDate(qEnd.getDate() - 1);

  let from = toYmdLocal(qStart);
  let to = toYmdLocal(qEnd);
  if (from < fy.start_date) from = fy.start_date;
  if (to > fy.end_date) to = fy.end_date;
  return { from, to };
};

const periodToggleGroupSx = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 0.75,
  flex: '1 1 auto',
  minWidth: 0,
} as const;

const periodBtnSx = {
  border: '1px solid #CBD5E1',
  borderRadius: '10px',
  px: 1.25,
  height: 40,
  minWidth: 0,
  textTransform: 'none' as const,
  fontWeight: 600,
  fontSize: '0.8125rem',
  whiteSpace: 'nowrap' as const,
  boxShadow: 'none',
};

const cellEllipsisSx = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: 0,
} as const;

const tableSx = {
  width: '100%',
  tableLayout: 'fixed',
  borderCollapse: 'collapse',
  bgcolor: 'transparent',
  '& .MuiTableCell-root': {
    borderLeft: 'none',
    borderRight: 'none',
    borderTop: 'none',
  },
} as const;

const ProfitAndLoss: React.FC = () => {
  const { t, i18n } = useTranslation();
  const {
    canSelectCompany,
    companies,
    selectedCompanyId,
    effectiveCompanyId,
    selectedCompanyName,
    companyQuery,
    changeCompany,
  } = useAccountingCompany();

  const fyOptions = useMemo(() => buildFiscalYearOptions(), []);
  const currentFyStartYear = useMemo(() => getIndiaFyStartYear(), []);

  const [fyStartYear, setFyStartYear] = useState(currentFyStartYear);
  const [periodKey, setPeriodKey] = useState<PlPeriodKey>('fiscalYear');
  const [from, setFrom] = useState(() => {
    const fy = buildFiscalYearOptions().find((o) => o.startYear === getIndiaFyStartYear());
    return fy?.start_date || '';
  });
  const [to, setTo] = useState(() => {
    const fy = buildFiscalYearOptions().find((o) => o.startYear === getIndiaFyStartYear());
    return fy?.end_date || '';
  });
  const [tab, setTab] = useState(0);
  const [data, setData] = useState<PlData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const selectedFy = useMemo(() => {
    return (
      fyOptions.find((o) => o.startYear === fyStartYear) ||
      fyOptions.find((o) => o.startYear === currentFyStartYear) ||
      fyOptions[0]
    );
  }, [fyOptions, fyStartYear, currentFyStartYear]);

  const applyPeriod = useCallback((key: PlPeriodKey, fy: FyOption) => {
    const range = getProfitAndLossPeriodRange(key, fy);
    setPeriodKey(key);
    setFrom(range.from);
    setTo(range.to);
  }, []);

  const load = useCallback(async () => {
    if (!effectiveCompanyId) return;
    setLoading(true);
    setError('');
    try {
      const response = await accountingService.getProfitAndLoss({
        from: from || undefined,
        to: to || undefined,
        ...companyQuery,
      });
      setData(response?.data || null);
    } catch (err: any) {
      setError(err?.response?.data?.message || t('profitAndLoss.errors.load'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, effectiveCompanyId, companyQuery, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleFyChange = (startYear: number) => {
    const fy = fyOptions.find((o) => o.startYear === startYear);
    if (!fy) return;
    setFyStartYear(startYear);
    applyPeriod(periodKey, fy);
  };

  const handleReset = () => {
    const fy = fyOptions.find((o) => o.startYear === currentFyStartYear);
    if (!fy) return;
    setFyStartYear(currentFyStartYear);
    setPeriodKey('fiscalYear');
    setFrom(fy.start_date);
    setTo(fy.end_date);
    setTab(0);
  };

  const handleExcelDownload = async () => {
    if (!data) {
      setError(t('profitAndLoss.errors.noDataForExport'));
      return;
    }
    try {
      setExporting(true);
      await exportProfitAndLossExcel({
        data,
        companyName: selectedCompanyName || undefined,
        language: i18n.language,
        filePrefix: i18n.language?.startsWith('en') ? 'Profit_and_Loss' : '손익계산서',
      });
    } catch (err: any) {
      setError(err?.message || t('profitAndLoss.errors.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const kpis = useMemo(
    () => [
      {
        key: 'income',
        label: t('profitAndLoss.kpi.totalIncome'),
        value: data?.totalIncome ?? 0,
        color: 'primary.main',
      },
      {
        key: 'expense',
        label: t('profitAndLoss.kpi.totalExpense'),
        value: data?.totalExpense ?? 0,
        color: 'error.main',
      },
      {
        key: 'net',
        label: t('profitAndLoss.kpi.netProfit'),
        value: data?.netProfit ?? 0,
        color: (data?.netProfit ?? 0) >= 0 ? 'success.main' : 'error.main',
      },
    ],
    [data, t]
  );

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

  const filterFieldSx = { ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx };

  const renderAmountTable = (rows: PlRow[], total: number, emptyKey: string, totalColor: string) => {
    if (loading) {
      return (
        <Box sx={listStateBoxSx}>
          <CircularProgress size={36} />
          <Typography variant="body2" color="text.secondary">
            {t('common.loading')}
          </Typography>
        </Box>
      );
    }

    if (!rows.length) {
      return (
        <Box sx={listStateBoxSx}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em', color: 'text.primary' }}>
            {t(emptyKey)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
            {t('profitAndLoss.empty.hint')}
          </Typography>
        </Box>
      );
    }

    return (
      <TableContainer sx={{ ...mvsBodyListTableSx, ...mvsTableScrollSx }}>
        <Table size="small" sx={tableSx}>
          <TableHead sx={mvsTableHeadHighlightSx}>
            <TableRow>
              <TableCell width="18%">{t('profitAndLoss.columns.code')}</TableCell>
              <TableCell width="52%">{t('profitAndLoss.columns.account')}</TableCell>
              <TableCell width="30%" align="right">
                {t('profitAndLoss.columns.amount')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody sx={mvsTableBodyRowSx}>
            {rows.map((row) => (
              <TableRow key={row.accountId} hover>
                <TableCell sx={cellEllipsisSx}>{row.code}</TableCell>
                <TableCell sx={cellEllipsisSx}>
                  {getGlAccountName(
                    { code: row.code, name: row.name, name_en: row.nameEn },
                    i18n.language
                  )}
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatInr(row.amount)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow sx={{ bgcolor: '#F8FAFC !important' }}>
              <TableCell colSpan={2} sx={{ fontWeight: 700 }}>
                {t('profitAndLoss.total')}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: totalColor, fontVariantNumeric: 'tabular-nums' }}>
                {formatInr(total)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <Box sx={mvsPageRootSx}>
      <DaeheungPageHeader title={t('profitAndLoss.title')} description={t('profitAndLoss.description')} />

      <AccountingCompanyBar
        canSelectCompany={canSelectCompany}
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        selectedCompanyName={selectedCompanyName}
        onChangeCompany={changeCompany}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2.5, mb: 3 }}>
        {kpis.map((kpi) => (
          <Card key={kpi.key} elevation={0} sx={mvsKpiCardSx}>
            <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
                {kpi.label}
              </Typography>
              <Typography
                variant="h5"
                sx={{ mt: 0.75, fontWeight: 600, letterSpacing: '-0.02em', color: kpi.color }}
              >
                {loading ? '…' : formatInr(kpi.value)}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        {t('profitAndLoss.hint')}
      </Alert>

      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 2 }}>
        <Box sx={mvsBodyFilterWrapSx}>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              gap: 1.25,
              ...(mvsSearchFieldSx as Record<string, unknown>),
            }}
          >
            <TextField
              size="small"
              select
              label={t('profitAndLoss.fiscalYear')}
              value={fyStartYear}
              onChange={(e) => handleFyChange(Number(e.target.value))}
              disabled={loading}
              sx={{ ...filterFieldSx, width: { xs: '100%', sm: 180 }, minWidth: 160, flex: '0 0 auto' }}
              {...mvsOutlinedLabelProps}
            >
              {fyOptions.map((opt) => (
                <MenuItem key={opt.startYear} value={opt.startYear}>
                  {opt.label}
                  {opt.startYear === currentFyStartYear ? ` (${t('profitAndLoss.currentFy')})` : ''}
                </MenuItem>
              ))}
            </TextField>

            <Box
              sx={{
                ...periodToggleGroupSx,
                flex: { xs: '1 1 100%', md: '0 1 auto' },
                maxWidth: '100%',
              }}
            >
              {PL_PERIOD_KEYS.map((key) => {
                const selected = periodKey === key;
                return (
                  <Button
                    key={key}
                    size="small"
                    variant={selected ? 'contained' : 'outlined'}
                    disableElevation
                    disabled={loading || !selectedFy}
                    onClick={() => selectedFy && applyPeriod(key, selectedFy)}
                    sx={{
                      ...periodBtnSx,
                      ...(selected
                        ? {
                            bgcolor: 'primary.main',
                            color: '#fff',
                            borderColor: 'primary.main',
                            '&:hover': { bgcolor: 'primary.dark', borderColor: 'primary.dark' },
                          }
                        : {
                            bgcolor: '#fff',
                            color: 'text.primary',
                            '&:hover': { bgcolor: '#F8FAFC', borderColor: '#9AA8B8' },
                          }),
                    }}
                  >
                    {t(`profitAndLoss.periods.${key}`)}
                  </Button>
                );
              })}
            </Box>

            <TextField
              size="small"
              type="date"
              label={t('profitAndLoss.from')}
              value={from}
              InputProps={{ readOnly: true }}
              disabled={loading}
              sx={{ ...filterFieldSx, width: { xs: '100%', sm: 150 }, minWidth: 140, flex: '0 0 auto' }}
              {...mvsOutlinedLabelProps}
            />
            <TextField
              size="small"
              type="date"
              label={t('profitAndLoss.to')}
              value={to}
              InputProps={{ readOnly: true }}
              disabled={loading}
              sx={{ ...filterFieldSx, width: { xs: '100%', sm: 150 }, minWidth: 140, flex: '0 0 auto' }}
              {...mvsOutlinedLabelProps}
            />
            <Button
              variant="contained"
              disableElevation
              startIcon={<SearchIcon fontSize="small" />}
              sx={{ ...mvsBodyPrimaryBtnSx, height: 40, whiteSpace: 'nowrap', flex: '0 0 auto' }}
              onClick={() => void load()}
              disabled={loading}
            >
              {t('profitAndLoss.search')}
            </Button>
            <Button
              variant="outlined"
              startIcon={<ResetIcon fontSize="small" />}
              sx={{ ...mvsBodyOutlinedBtnSx, height: 40, whiteSpace: 'nowrap', flex: '0 0 auto' }}
              onClick={handleReset}
              disabled={loading}
            >
              {t('common.reset')}
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon fontSize="small" />}
              sx={{ ...mvsBodyOutlinedBtnSx, height: 40, whiteSpace: 'nowrap', flex: '0 0 auto' }}
              onClick={handleExcelDownload}
              disabled={loading || exporting || !data}
            >
              {t('profitAndLoss.excelDownload')}
            </Button>
          </Box>
        </Box>
      </Card>

      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 0 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ px: 1, minHeight: 48, '& .MuiTab-root': { py: 1.5, textTransform: 'none', fontWeight: 600 } }}
        >
          <Tab icon={<TrendingUp fontSize="small" />} iconPosition="start" label={t('profitAndLoss.tabs.income')} />
          <Tab icon={<TrendingDown fontSize="small" />} iconPosition="start" label={t('profitAndLoss.tabs.expense')} />
          <Tab label={t('profitAndLoss.tabs.summary')} />
        </Tabs>
      </Card>

      <Box sx={mvsBodyListZoneSx}>
        {tab === 0 &&
          renderAmountTable(data?.incomeRows || [], data?.totalIncome ?? 0, 'profitAndLoss.empty.income', 'primary.main')}
        {tab === 1 &&
          renderAmountTable(data?.expenseRows || [], data?.totalExpense ?? 0, 'profitAndLoss.empty.expense', 'error.main')}
        {tab === 2 &&
          (loading ? (
            <Box sx={listStateBoxSx}>
              <CircularProgress size={36} />
              <Typography variant="body2" color="text.secondary">
                {t('common.loading')}
              </Typography>
            </Box>
          ) : (
            <TableContainer sx={{ ...mvsBodyListTableSx, ...mvsTableScrollSx }}>
              <Table size="small" sx={tableSx}>
                <TableHead sx={mvsTableHeadHighlightSx}>
                  <TableRow>
                    <TableCell width="60%">{t('profitAndLoss.sections.netProfit')}</TableCell>
                    <TableCell width="40%" align="right">
                      {t('profitAndLoss.columns.amount')}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody sx={mvsTableBodyRowSx}>
                  <TableRow hover>
                    <TableCell>{t('profitAndLoss.kpi.totalIncome')}</TableCell>
                    <TableCell align="right" sx={{ color: 'primary.main', fontVariantNumeric: 'tabular-nums' }}>
                      {formatInr(data?.totalIncome ?? 0)}
                    </TableCell>
                  </TableRow>
                  <TableRow hover>
                    <TableCell>{t('profitAndLoss.kpi.totalExpense')}</TableCell>
                    <TableCell align="right" sx={{ color: 'error.main', fontVariantNumeric: 'tabular-nums' }}>
                      {formatInr(data?.totalExpense ?? 0)}
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ bgcolor: '#F8FAFC !important' }}>
                    <TableCell sx={{ fontWeight: 700 }}>{t('profitAndLoss.kpi.netProfit')}</TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: 800,
                        fontSize: '1.05rem',
                        color: (data?.netProfit ?? 0) >= 0 ? 'success.main' : 'error.main',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatInr(data?.netProfit ?? 0)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          ))}
        {!loading && tab === 2 && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
            {t('profitAndLoss.formula', {
              income: formatInr(data?.totalIncome ?? 0),
              expense: formatInr(data?.totalExpense ?? 0),
            })}
          </Typography>
        )}
      </Box>

      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')} message={error} />
    </Box>
  );
};

export default ProfitAndLoss;
