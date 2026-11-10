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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { RestartAlt as ResetIcon, Search as SearchIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import AccountingCompanyBar from '../../components/Accounting/AccountingCompanyBar';
import { useAccountingCompany } from '../../hooks/useAccountingCompany';
import { accountingService } from '../../services/api';
import { formatInr } from '../../utils/formatInr';
import {
  computeCorporateTax,
  DEFAULT_CORPORATE_TAX_RATES,
  round2,
} from '../../utils/indiaTaxEstimate';
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

type FyOption = {
  startYear: number;
  start_date: string;
  end_date: string;
  label: string;
};

const getIndiaFyStartYear = (now = new Date()) =>
  now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;

const buildFiscalYearOptions = (now = new Date(), past = 3, future = 1): FyOption[] => {
  const currentStart = getIndiaFyStartYear(now);
  const options: FyOption[] = [];
  for (let y = currentStart - past; y <= currentStart + future; y += 1) {
    options.push({
      startYear: y,
      start_date: `${y}-04-01`,
      end_date: `${y + 1}-03-31`,
      label: `FY ${y}-${String(y + 1).slice(-2)}`,
    });
  }
  return options;
};

const parseNum = (v: string) => {
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const tableSx = {
  width: '100%',
  tableLayout: 'fixed' as const,
  borderCollapse: 'collapse' as const,
  '& .MuiTableCell-root': { borderLeft: 'none', borderRight: 'none', borderTop: 'none' },
};

const CorporateTax: React.FC = () => {
  const { t } = useTranslation();
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
  const selectedFy = useMemo(
    () => fyOptions.find((o) => o.startYear === fyStartYear) || fyOptions[0],
    [fyOptions, fyStartYear]
  );

  const [netProfit, setNetProfit] = useState(0);
  const [additions, setAdditions] = useState(0);
  const [deductions, setDeductions] = useState(0);
  const [baseRatePercent, setBaseRatePercent] = useState<number>(DEFAULT_CORPORATE_TAX_RATES.baseRatePercent);
  const [surchargePercent, setSurchargePercent] = useState<number>(DEFAULT_CORPORATE_TAX_RATES.surchargePercent);
  const [cessPercent, setCessPercent] = useState<number>(DEFAULT_CORPORATE_TAX_RATES.cessPercent);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!effectiveCompanyId || !selectedFy) return;
    setLoading(true);
    setError('');
    try {
      const response = await accountingService.getProfitAndLoss({
        from: selectedFy.start_date,
        to: selectedFy.end_date,
        ...companyQuery,
      });
      setNetProfit(round2(Number(response?.data?.netProfit || 0)));
    } catch (err: any) {
      setError(err?.response?.data?.message || t('corporateTax.errors.load'));
      setNetProfit(0);
    } finally {
      setLoading(false);
    }
  }, [effectiveCompanyId, selectedFy, companyQuery, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const result = useMemo(
    () =>
      computeCorporateTax({
        netProfit,
        additions,
        deductions,
        baseRatePercent,
        surchargePercent,
        cessPercent,
      }),
    [netProfit, additions, deductions, baseRatePercent, surchargePercent, cessPercent]
  );

  const handleReset = () => {
    setFyStartYear(currentFyStartYear);
    setAdditions(0);
    setDeductions(0);
    setBaseRatePercent(DEFAULT_CORPORATE_TAX_RATES.baseRatePercent);
    setSurchargePercent(DEFAULT_CORPORATE_TAX_RATES.surchargePercent);
    setCessPercent(DEFAULT_CORPORATE_TAX_RATES.cessPercent);
  };

  const filterFieldSx = { ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx };

  const kpis = [
    { key: 'profit', label: t('corporateTax.kpi.netProfit'), value: netProfit, color: netProfit >= 0 ? 'success.main' : 'error.main' },
    { key: 'taxable', label: t('corporateTax.kpi.taxableIncome'), value: result.taxableIncome, color: 'primary.main' },
    { key: 'tax', label: t('corporateTax.kpi.totalTax'), value: result.totalTax, color: 'warning.main' },
    { key: 'eff', label: t('corporateTax.kpi.effectiveRate'), value: result.effectiveRatePercent, color: 'text.primary', isRate: true },
  ];

  const calcRows = [
    { label: t('corporateTax.rows.netProfit'), amount: netProfit },
    { label: t('corporateTax.rows.additions'), amount: additions },
    { label: t('corporateTax.rows.deductions'), amount: -deductions },
    { label: t('corporateTax.rows.taxableIncome'), amount: result.taxableIncome, total: true },
    { label: t('corporateTax.rows.baseTax', { rate: baseRatePercent }), amount: result.baseTax },
    { label: t('corporateTax.rows.surcharge', { rate: surchargePercent }), amount: result.surcharge },
    { label: t('corporateTax.rows.cess', { rate: cessPercent }), amount: result.cess },
    { label: t('corporateTax.rows.totalTax'), amount: result.totalTax, total: true },
  ];

  return (
    <Box sx={mvsPageRootSx}>
      <DaeheungPageHeader title={t('corporateTax.title')} description={t('corporateTax.description')} />

      <AccountingCompanyBar
        canSelectCompany={canSelectCompany}
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        selectedCompanyName={selectedCompanyName}
        onChangeCompany={changeCompany}
      />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 2.5,
          mb: 3,
        }}
      >
        {kpis.map((kpi) => (
          <Card key={kpi.key} elevation={0} sx={mvsKpiCardSx}>
            <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                {kpi.label}
              </Typography>
              <Typography variant="h5" sx={{ mt: 0.75, fontWeight: 600, color: kpi.color }}>
                {loading ? '…' : kpi.isRate ? `${kpi.value.toFixed(2)}%` : formatInr(kpi.value)}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        {t('corporateTax.hint')}
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
              label={t('corporateTax.fiscalYear')}
              value={fyStartYear}
              onChange={(e) => setFyStartYear(Number(e.target.value))}
              disabled={loading}
              sx={{ ...filterFieldSx, width: { xs: '100%', sm: 180 }, minWidth: 160 }}
              {...mvsOutlinedLabelProps}
            >
              {fyOptions.map((opt) => (
                <MenuItem key={opt.startYear} value={opt.startYear}>
                  {opt.label}
                  {opt.startYear === currentFyStartYear ? ` (${t('corporateTax.currentFy')})` : ''}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="contained"
              disableElevation
              startIcon={<SearchIcon fontSize="small" />}
              onClick={() => void load()}
              disabled={loading}
              sx={{ ...mvsBodyPrimaryBtnSx, height: 40 }}
            >
              {t('corporateTax.loadPl')}
            </Button>
            <Button
              variant="outlined"
              startIcon={<ResetIcon fontSize="small" />}
              onClick={handleReset}
              disabled={loading}
              sx={{ ...mvsBodyOutlinedBtnSx, height: 40 }}
            >
              {t('common.reset')}
            </Button>
          </Box>
        </Box>
      </Card>

      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 2 }}>
        <Box sx={mvsBodyFilterWrapSx}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
            {t('corporateTax.inputsTitle')}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
              gap: 2,
              ...(mvsSearchFieldSx as Record<string, unknown>),
            }}
          >
            <TextField
              size="small"
              type="number"
              label={t('corporateTax.fields.netProfit')}
              value={netProfit}
              onChange={(e) => setNetProfit(parseNum(e.target.value))}
              sx={filterFieldSx}
              {...mvsOutlinedLabelProps}
            />
            <TextField
              size="small"
              type="number"
              label={t('corporateTax.fields.additions')}
              value={additions}
              onChange={(e) => setAdditions(parseNum(e.target.value))}
              sx={filterFieldSx}
              {...mvsOutlinedLabelProps}
            />
            <TextField
              size="small"
              type="number"
              label={t('corporateTax.fields.deductions')}
              value={deductions}
              onChange={(e) => setDeductions(parseNum(e.target.value))}
              sx={filterFieldSx}
              {...mvsOutlinedLabelProps}
            />
            <TextField
              size="small"
              type="number"
              label={t('corporateTax.fields.baseRate')}
              value={baseRatePercent}
              onChange={(e) => setBaseRatePercent(parseNum(e.target.value))}
              sx={filterFieldSx}
              {...mvsOutlinedLabelProps}
            />
            <TextField
              size="small"
              type="number"
              label={t('corporateTax.fields.surcharge')}
              value={surchargePercent}
              onChange={(e) => setSurchargePercent(parseNum(e.target.value))}
              sx={filterFieldSx}
              {...mvsOutlinedLabelProps}
            />
            <TextField
              size="small"
              type="number"
              label={t('corporateTax.fields.cess')}
              value={cessPercent}
              onChange={(e) => setCessPercent(parseNum(e.target.value))}
              sx={filterFieldSx}
              {...mvsOutlinedLabelProps}
            />
          </Box>
        </Box>
      </Card>

      <Box sx={mvsBodyListZoneSx}>
        {loading ? (
          <Box
            sx={{
              ...mvsBodyListTableSx,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              py: 8,
              gap: 1.5,
            }}
          >
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
                  <TableCell width="70%">{t('corporateTax.columns.particulars')}</TableCell>
                  <TableCell width="30%" align="right">
                    {t('corporateTax.columns.amount')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody sx={mvsTableBodyRowSx}>
                {calcRows.map((row) => (
                  <TableRow key={row.label} hover={!row.total} sx={row.total ? { bgcolor: '#F8FAFC !important' } : undefined}>
                    <TableCell sx={{ fontWeight: row.total ? 700 : 400 }}>{row.label}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: row.total ? 700 : 400 }}>
                      {formatInr(row.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <Snackbar open={Boolean(error)} autoHideDuration={5000} onClose={() => setError('')}>
        <Alert severity="error" onClose={() => setError('')} sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CorporateTax;
