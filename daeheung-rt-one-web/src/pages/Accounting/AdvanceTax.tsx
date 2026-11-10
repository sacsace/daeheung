import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  buildAdvanceTaxSchedule,
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

type PaidState = { q1: number; q2: number; q3: number; q4: number };
type PlRow = { accountId: number; code: string; name: string; nameEn?: string | null; amount: number };
type PlData = {
  incomeRows: PlRow[];
  expenseRows: PlRow[];
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
};

type InstallmentDetail = {
  key: keyof PaidState;
  dueDate: string;
  from: string;
  data: PlData;
  tax: ReturnType<typeof computeCorporateTax>;
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

const emptyPaid = (): PaidState => ({ q1: 0, q2: 0, q3: 0, q4: 0 });

const storageKey = (companyId: number | undefined, fy: number) =>
  `mvs.advanceTax.paid.${companyId || 0}.${fy}`;

const tableSx = {
  width: '100%',
  tableLayout: 'fixed' as const,
  borderCollapse: 'collapse' as const,
  '& .MuiTableCell-root': { borderLeft: 'none', borderRight: 'none', borderTop: 'none' },
};

const compactDetailTableSx = {
  ...tableSx,
  '& .MuiTableCell-root': {
    borderLeft: 'none',
    borderRight: 'none',
    borderTop: 'none',
    py: '2px !important',
    px: 0.75,
    fontSize: '0.75rem',
    lineHeight: 1.15,
  },
};

const compactDetailHeadSx = {
  '& .MuiTableCell-head': {
    py: '4px !important',
    lineHeight: 1.15,
    fontSize: '0.75rem',
  },
} as const;

const AdvanceTax: React.FC = () => {
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

  const [estimatedTax, setEstimatedTax] = useState(0);
  const [paid, setPaid] = useState<PaidState>(emptyPaid);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<InstallmentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadPaidFromStorage = useCallback((companyId: number | undefined, fy: number) => {
    try {
      const raw = localStorage.getItem(storageKey(companyId, fy));
      if (!raw) return emptyPaid();
      const parsed = JSON.parse(raw);
      return {
        q1: round2(Number(parsed?.q1 || 0)),
        q2: round2(Number(parsed?.q2 || 0)),
        q3: round2(Number(parsed?.q3 || 0)),
        q4: round2(Number(parsed?.q4 || 0)),
      };
    } catch {
      return emptyPaid();
    }
  }, []);

  const persistPaid = useCallback((companyId: number | undefined, fy: number, next: PaidState) => {
    try {
      localStorage.setItem(storageKey(companyId, fy), JSON.stringify(next));
    } catch {
      /* ignore quota */
    }
  }, []);

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
      const netProfit = round2(Number(response?.data?.netProfit || 0));
      const tax = computeCorporateTax({
        netProfit,
        additions: 0,
        deductions: 0,
        ...DEFAULT_CORPORATE_TAX_RATES,
      });
      setEstimatedTax(tax.totalTax);
      setPaid(loadPaidFromStorage(effectiveCompanyId, selectedFy.startYear));
    } catch (err: any) {
      setError(err?.response?.data?.message || t('advanceTax.errors.load'));
      setEstimatedTax(0);
    } finally {
      setLoading(false);
    }
  }, [effectiveCompanyId, selectedFy, companyQuery, t, loadPaidFromStorage]);

  useEffect(() => {
    void load();
  }, [load]);

  const schedule = useMemo(
    () => buildAdvanceTaxSchedule(estimatedTax, fyStartYear, paid),
    [estimatedTax, fyStartYear, paid]
  );

  const totalPaid = useMemo(() => round2(paid.q1 + paid.q2 + paid.q3 + paid.q4), [paid]);
  const totalDue = useMemo(
    () => round2(schedule.reduce((s, r) => s + r.installmentDue, 0)),
    [schedule]
  );
  const remaining = round2(Math.max(0, estimatedTax - totalPaid));

  const updatePaid = (key: keyof PaidState, value: number) => {
    const next = { ...paid, [key]: round2(value) };
    setPaid(next);
    persistPaid(effectiveCompanyId, fyStartYear, next);
  };

  const openInstallmentDetail = async (key: keyof PaidState, dueDate: string) => {
    if (!effectiveCompanyId || !selectedFy) return;
    setDetailLoading(true);
    setDetail(null);
    try {
      const response = await accountingService.getProfitAndLoss({
        from: selectedFy.start_date,
        to: dueDate,
        ...companyQuery,
      });
      const data = (response?.data || {
        incomeRows: [],
        expenseRows: [],
        totalIncome: 0,
        totalExpense: 0,
        netProfit: 0,
      }) as PlData;
      const tax = computeCorporateTax({
        netProfit: round2(Number(data.netProfit || 0)),
        additions: 0,
        deductions: 0,
        ...DEFAULT_CORPORATE_TAX_RATES,
      });
      setDetail({ key, dueDate, from: selectedFy.start_date, data, tax });
    } catch (err: any) {
      setError(err?.response?.data?.message || t('advanceTax.errors.detail'));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleReset = () => {
    setFyStartYear(currentFyStartYear);
    const cleared = emptyPaid();
    setPaid(cleared);
    persistPaid(effectiveCompanyId, currentFyStartYear, cleared);
  };

  const filterFieldSx = { ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx };

  const kpis = [
    { key: 'est', label: t('advanceTax.kpi.estimatedTax'), value: estimatedTax, color: 'primary.main' },
    { key: 'due', label: t('advanceTax.kpi.totalInstallments'), value: totalDue, color: 'text.primary' },
    { key: 'paid', label: t('advanceTax.kpi.totalPaid'), value: totalPaid, color: 'success.main' },
    { key: 'remain', label: t('advanceTax.kpi.remaining'), value: remaining, color: remaining > 0 ? 'warning.main' : 'success.main' },
  ];

  return (
    <Box sx={mvsPageRootSx}>
      <DaeheungPageHeader title={t('advanceTax.title')} description={t('advanceTax.description')} />

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
                {loading ? '…' : formatInr(kpi.value)}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        {t('advanceTax.hint')}
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
              label={t('advanceTax.fiscalYear')}
              value={fyStartYear}
              onChange={(e) => {
                const nextFy = Number(e.target.value);
                setFyStartYear(nextFy);
                setPaid(loadPaidFromStorage(effectiveCompanyId, nextFy));
              }}
              disabled={loading}
              sx={{ ...filterFieldSx, width: { xs: '100%', sm: 180 }, minWidth: 160 }}
              {...mvsOutlinedLabelProps}
            >
              {fyOptions.map((opt) => (
                <MenuItem key={opt.startYear} value={opt.startYear}>
                  {opt.label}
                  {opt.startYear === currentFyStartYear ? ` (${t('advanceTax.currentFy')})` : ''}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              type="number"
              label={t('advanceTax.fields.estimatedTax')}
              value={estimatedTax}
              onChange={(e) => setEstimatedTax(parseNum(e.target.value))}
              sx={{ ...filterFieldSx, width: { xs: '100%', sm: 200 } }}
              {...mvsOutlinedLabelProps}
            />
            <Button
              variant="contained"
              disableElevation
              startIcon={<SearchIcon fontSize="small" />}
              onClick={() => void load()}
              disabled={loading}
              sx={{ ...mvsBodyPrimaryBtnSx, height: 40 }}
            >
              {t('advanceTax.loadFromPl')}
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
            <Table size="small" sx={{ ...tableSx, minWidth: 880 }}>
              <TableHead sx={mvsTableHeadHighlightSx}>
                <TableRow>
                  <TableCell width="12%">{t('advanceTax.columns.installment')}</TableCell>
                  <TableCell width="14%">{t('advanceTax.columns.dueDate')}</TableCell>
                  <TableCell width="12%" align="right">
                    {t('advanceTax.columns.cumulativePct')}
                  </TableCell>
                  <TableCell width="16%" align="right">
                    {t('advanceTax.columns.requiredCumulative')}
                  </TableCell>
                  <TableCell width="16%" align="right">
                    {t('advanceTax.columns.installmentDue')}
                  </TableCell>
                  <TableCell width="16%" align="right">
                    {t('advanceTax.columns.paid')}
                  </TableCell>
                  <TableCell width="14%" align="right">
                    {t('advanceTax.columns.balance')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody sx={mvsTableBodyRowSx}>
                {schedule.map((row) => (
                  <TableRow
                    key={row.key}
                    hover
                    onClick={() => void openInstallmentDetail(row.key, row.dueDate)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ fontWeight: 600 }}>{t(`advanceTax.installments.${row.key}`)}</TableCell>
                    <TableCell>{row.dueDate}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {row.cumulativePercent}%
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatInr(row.requiredCumulative)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatInr(row.installmentDue)}
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        value={paid[row.key]}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updatePaid(row.key, parseNum(e.target.value))}
                        sx={{
                          width: 120,
                          '& .MuiInputBase-input': {
                            textAlign: 'right',
                            py: 0.75,
                            fontVariantNumeric: 'tabular-nums',
                          },
                        }}
                      />
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 600,
                        color: row.balance > 0 ? 'warning.main' : row.balance < 0 ? 'success.main' : 'text.primary',
                      }}
                    >
                      {formatInr(row.balance)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ bgcolor: '#F8FAFC !important' }}>
                  <TableCell colSpan={4} sx={{ fontWeight: 700 }}>
                    {t('advanceTax.total')}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {formatInr(totalDue)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {formatInr(totalPaid)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {formatInr(round2(totalDue - totalPaid))}
                  </TableCell>
                </TableRow>
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

      <Dialog
        open={detailLoading || Boolean(detail)}
        onClose={() => {
          if (!detailLoading) setDetail(null);
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {detail
            ? t('advanceTax.detail.title', {
                installment: t(`advanceTax.installments.${detail.key}`),
                from: detail.from,
                to: detail.dueDate,
              })
            : t('advanceTax.detail.loading')}
        </DialogTitle>
        <DialogContent dividers>
          {detailLoading ? (
            <Box sx={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress size={36} />
            </Box>
          ) : detail ? (
            <Box sx={{ display: 'grid', gap: 2 }}>
              <Alert severity="info">{t('advanceTax.detail.hint')}</Alert>
              <TableContainer sx={{ ...mvsBodyListTableSx, ...mvsTableScrollSx, borderRadius: 0, boxShadow: 'none' }}>
                <Table size="small" sx={{ ...compactDetailTableSx, minWidth: 760 }}>
                  <TableHead sx={[mvsTableHeadHighlightSx, compactDetailHeadSx] as any}>
                    <TableRow>
                      <TableCell width="14%">{t('advanceTax.detail.columns.code')}</TableCell>
                      <TableCell width="56%">{t('advanceTax.detail.columns.particulars')}</TableCell>
                      <TableCell width="30%" align="right">
                        {t('advanceTax.detail.columns.amount')}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody sx={mvsTableBodyRowSx}>
                    <TableRow sx={{ bgcolor: '#F8FAFC !important' }}>
                      <TableCell colSpan={3} sx={{ fontWeight: 700 }}>
                        {t('advanceTax.detail.income')}
                      </TableCell>
                    </TableRow>
                    {detail.data.incomeRows.map((row) => (
                      <TableRow key={`income-${row.accountId}`} hover>
                        <TableCell>{row.code}</TableCell>
                        <TableCell>{row.nameEn || row.name}</TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatInr(row.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ bgcolor: '#F8FAFC !important' }}>
                      <TableCell colSpan={2} sx={{ fontWeight: 700 }}>
                        {t('advanceTax.detail.totalIncome')}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {formatInr(detail.data.totalIncome)}
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ bgcolor: '#F8FAFC !important' }}>
                      <TableCell colSpan={3} sx={{ fontWeight: 700 }}>
                        {t('advanceTax.detail.expense')}
                      </TableCell>
                    </TableRow>
                    {detail.data.expenseRows.map((row) => (
                      <TableRow key={`expense-${row.accountId}`} hover>
                        <TableCell>{row.code}</TableCell>
                        <TableCell>{row.nameEn || row.name}</TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatInr(row.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ bgcolor: '#F8FAFC !important' }}>
                      <TableCell colSpan={2} sx={{ fontWeight: 700 }}>
                        {t('advanceTax.detail.totalExpense')}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {formatInr(detail.data.totalExpense)}
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ bgcolor: '#E2F0D9 !important' }}>
                      <TableCell colSpan={2} sx={{ fontWeight: 800 }}>
                        {t('advanceTax.detail.netProfit')}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                        {formatInr(detail.data.netProfit)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

              <TableContainer sx={{ ...mvsBodyListTableSx, ...mvsTableScrollSx, borderRadius: 0, boxShadow: 'none' }}>
                <Table size="small" sx={compactDetailTableSx}>
                  <TableHead sx={[mvsTableHeadHighlightSx, compactDetailHeadSx] as any}>
                    <TableRow>
                      <TableCell width="70%">{t('advanceTax.detail.taxParticulars')}</TableCell>
                      <TableCell width="30%" align="right">
                        {t('advanceTax.detail.columns.amount')}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody sx={mvsTableBodyRowSx}>
                    {[
                      [t('advanceTax.detail.netProfit'), detail.tax.taxableIncome],
                      [t('advanceTax.detail.baseTax'), detail.tax.baseTax],
                      [t('advanceTax.detail.surcharge'), detail.tax.surcharge],
                      [t('advanceTax.detail.cess'), detail.tax.cess],
                      [t('advanceTax.detail.estimatedTax'), detail.tax.totalTax],
                    ].map(([label, amount], index) => (
                      <TableRow
                        key={String(label)}
                        sx={index === 4 ? { bgcolor: '#F8FAFC !important' } : undefined}
                      >
                        <TableCell sx={{ fontWeight: index === 4 ? 700 : 400 }}>{label}</TableCell>
                        <TableCell
                          align="right"
                          sx={{ fontWeight: index === 4 ? 700 : 400, fontVariantNumeric: 'tabular-nums' }}
                        >
                          {formatInr(Number(amount))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetail(null)} disabled={detailLoading} sx={mvsBodyOutlinedBtnSx}>
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdvanceTax;
