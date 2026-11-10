import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Link,
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
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import AccountingCompanyBar from '../../components/Accounting/AccountingCompanyBar';
import { useAccountingCompany } from '../../hooks/useAccountingCompany';
import { accountingService } from '../../services/api';
import { getGlAccountName } from '../../utils/glAccountLabel';
import { formatEnglishSentenceLabel } from '../../utils/textCase';
import { formatInr } from '../../utils/formatInr';
import { exportBalanceSheetExcel } from '../../utils/exportFinancialStatementExcel';
import {
  AmountRow,
  BsBundle,
  ComparativeLine,
  DetailScheduleKey,
  PlBundle,
  TbRow,
  buildBsImbalanceSuspects,
  buildBsSheet,
  buildCapitalSheet,
  buildDetailSchedules,
  buildPlSheet,
  buildSchBsSheet,
  buildSchPlSheet,
  detailScheduleHasRows,
  DETAIL_SCHEDULE_KEYS,
  sumAmounts,
} from '../../utils/financialStatementSheets';
import {
  mvsBodyCardSx,
  mvsBodyFilterWrapSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPrimaryBtnSx,
  mvsBodySectionHeaderSx,
  mvsFilterFieldHeightSx,
  mvsKpiCardSx,
  mvsOutlinedLabelProps,
  mvsPageRootSx,
  mvsSearchFieldSx,
  mvsTableBodyRowSx,
  mvsTableHeadHighlightSx,
} from '../../theme/daeheungLayout';

type BsData = BsBundle & {
  asOf: string | null;
  from: string | null;
  balanced: boolean;
  source?: string;
  tallyVoucherCount?: number;
};

type PlData = PlBundle & {
  from: string | null;
  to: string | null;
};

type BsPeriodKey = 'q1' | 'q2' | 'q3' | 'q4' | 'fiscalYear';

type FyOption = {
  startYear: number;
  start_date: string;
  end_date: string;
  label: string;
};

type CoreSheetKey = 'bs' | 'pl' | 'capital' | 'schBs' | 'schPl' | 'trialBalance';
type SheetKey = CoreSheetKey | DetailScheduleKey;

const BS_PERIOD_KEYS: BsPeriodKey[] = ['q1', 'q2', 'q3', 'q4', 'fiscalYear'];

const CORE_SHEET_KEYS: CoreSheetKey[] = ['bs', 'pl', 'capital', 'schBs', 'schPl', 'trialBalance'];

/** Note No. → 이동 탭 (SEDA 스케줄 매핑) */
const NOTE_SHEET_MAP: Record<string, SheetKey> = {
  '1': 'capital',
  '2': 'capital',
  '3': 'capital',
  '4': 'schBs',
  '5': 'schBs',
  '6': 'schBs',
  '7': 'schBs',
  '8': 'schPl',
  '9': 'schPl',
  '10': 'schPl',
};

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

const getBalanceSheetPeriodRange = (
  key: BsPeriodKey,
  fy: Pick<FyOption, 'start_date' | 'end_date'>
): { from: string; asOf: string } => {
  if (key === 'fiscalYear') {
    return { from: fy.start_date, asOf: fy.end_date };
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
  let asOf = toYmdLocal(qEnd);
  if (from < fy.start_date) from = fy.start_date;
  if (asOf > fy.end_date) asOf = fy.end_date;
  return { from, asOf };
};

const dateOneYearEarlier = (ymd: string) => {
  if (!ymd) return '';
  const [year, month, day] = ymd.split('-').map(Number);
  if (!year || !month || !day) return '';
  return `${year - 1}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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

const nowrapAmountSx = {
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  fontSize: '0.75rem',
  px: '6px !important',
} as const;

const ledgerLinkSx = {
  fontWeight: 600,
  fontSize: 'inherit',
  fontFamily: 'inherit',
  lineHeight: 'inherit',
  cursor: 'pointer',
  border: 0,
  background: 'none',
  p: 0,
  m: 0,
  maxWidth: '100%',
  color: 'primary.main',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  display: 'block',
  textAlign: 'left' as const,
} as const;

const ellipsisCellSx = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: '0.75rem',
  px: '6px !important',
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

const compactTableSx = {
  ...tableSx,
  '& .MuiTableCell-root': {
    borderLeft: 'none',
    borderRight: 'none',
    borderTop: 'none',
    py: 1.5,
    lineHeight: 1.4,
  },
} as const;

/** 재무제표 본표(BS·P&L·Capital·스케줄) 리스트만 기본 대비 높이 20% 축소 (12px → 9.6px) */
const statementTableSx = {
  ...tableSx,
  '& .MuiTableCell-root': {
    borderLeft: 'none',
    borderRight: 'none',
    borderTop: 'none',
  },
  '& .MuiTableBody-root .MuiTableRow-root': {
    height: 42,
  },
  '& .MuiTableBody-root .MuiTableCell-body': {
    py: '9.6px !important',
    lineHeight: '1.12 !important',
  },
} as const;

const statementBodySx = {
  '& .MuiTableRow-root': {
    height: 42,
  },
  '& .MuiTableCell-body': {
    py: '9.6px !important',
    lineHeight: '1.12 !important',
  },
} as const;

const compactHeadSx = {
  bgcolor: '#EEF2F6',
  '& .MuiTableCell-head': {
    py: 1.5,
    lineHeight: 1.4,
    bgcolor: '#EEF2F6',
  },
} as const;

const flushTableContainerSx = {
  width: '100%',
  maxWidth: '100%',
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
  borderRadius: 0,
  border: 'none',
  boxShadow: 'none',
  bgcolor: 'transparent',
} as const;

/** 비교표 전기 열 연한 강조 */
const excelPrevColBg = '#F3FAF4';

const MONTH_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const formatExcelMonthYear = (ymd: string) => {
  if (!ymd) return '';
  const [y, m] = ymd.split('-').map(Number);
  if (!y || !m) return '';
  return `${MONTH_SHORT[m - 1]}'${String(y).slice(-2)}`;
};

const formatExcelPeriodRange = (fromYmd: string, toYmd: string) => {
  const a = formatExcelMonthYear(fromYmd);
  const b = formatExcelMonthYear(toYmd);
  if (!a || !b) return '';
  return `${a}~${b}`;
};

const totalRowSx = {
  bgcolor: '#F8FAFC !important',
  '& .MuiTableCell-root': { fontWeight: 700 },
} as const;

const BalanceSheet: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
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
  const [periodKey, setPeriodKey] = useState<BsPeriodKey>('fiscalYear');
  const [from, setFrom] = useState(() => {
    const fy = buildFiscalYearOptions().find((o) => o.startYear === getIndiaFyStartYear());
    return fy?.start_date || '';
  });
  const [asOf, setAsOf] = useState(() => {
    const fy = buildFiscalYearOptions().find((o) => o.startYear === getIndiaFyStartYear());
    return fy?.end_date || '';
  });
  const [sheet, setSheet] = useState<SheetKey>('bs');
  const [bsCurrent, setBsCurrent] = useState<BsData | null>(null);
  const [bsPrevious, setBsPrevious] = useState<BsData | null>(null);
  const [plCurrent, setPlCurrent] = useState<PlData | null>(null);
  const [plPrevious, setPlPrevious] = useState<PlData | null>(null);
  const [trialRows, setTrialRows] = useState<TbRow[]>([]);
  const [trialTotals, setTrialTotals] = useState({ debit: 0, credit: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const autoLoadedKeyRef = useRef('');

  const selectedFy = useMemo(() => {
    return (
      fyOptions.find((o) => o.startYear === fyStartYear) ||
      fyOptions.find((o) => o.startYear === currentFyStartYear) ||
      fyOptions[0]
    );
  }, [fyOptions, fyStartYear, currentFyStartYear]);

  const applyPeriod = useCallback((key: BsPeriodKey, fy: FyOption) => {
    const range = getBalanceSheetPeriodRange(key, fy);
    setPeriodKey(key);
    setFrom(range.from);
    setAsOf(range.asOf);
  }, []);

  const load = useCallback(async () => {
    if (!effectiveCompanyId) return;
    setLoading(true);
    setError('');
    try {
      const prevFrom = dateOneYearEarlier(from);
      const prevAsOf = dateOneYearEarlier(asOf);
      const [
        bsRes,
        bsPrevRes,
        plRes,
        plPrevRes,
        tbRes,
      ] = await Promise.all([
        accountingService.getBalanceSheet({
          from: from || undefined,
          asOf: asOf || undefined,
          ...companyQuery,
        }),
        prevAsOf
          ? accountingService.getBalanceSheet({
              from: prevFrom || undefined,
              asOf: prevAsOf,
              ...companyQuery,
            })
          : Promise.resolve(null),
        accountingService.getProfitAndLoss({
          from: from || undefined,
          to: asOf || undefined,
          ...companyQuery,
        }),
        prevAsOf
          ? accountingService.getProfitAndLoss({
              from: prevFrom || undefined,
              to: prevAsOf,
              ...companyQuery,
            })
          : Promise.resolve(null),
        accountingService.getTrialBalance({
          from: from || undefined,
          to: asOf || undefined,
          tallyOnly: true,
          ...companyQuery,
        }),
      ]);

      setBsCurrent(bsRes?.data || null);
      setBsPrevious(bsPrevRes?.data || null);
      setPlCurrent(plRes?.data || null);
      setPlPrevious(plPrevRes?.data || null);

      const tbData = tbRes?.data;
      const rows: TbRow[] = Array.isArray(tbData?.rows) ? tbData.rows : [];
      setTrialRows(rows);
      setTrialTotals({
        debit: Number(tbData?.totalDebit || 0),
        credit: Number(tbData?.totalCredit || 0),
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || t('balanceSheet.errors.load'));
      setBsCurrent(null);
      setBsPrevious(null);
      setPlCurrent(null);
      setPlPrevious(null);
      setTrialRows([]);
      setTrialTotals({ debit: 0, credit: 0 });
    } finally {
      setLoading(false);
    }
  }, [from, asOf, effectiveCompanyId, companyQuery, t]);

  useEffect(() => {
    const key = `${effectiveCompanyId || ''}:${from}:${asOf}`;
    // React 개발 StrictMode의 effect 재실행으로 같은 5개 재무 API가 중복 호출되는 것을 방지한다.
    if (autoLoadedKeyRef.current === key) return;
    autoLoadedKeyRef.current = key;
    void load();
  }, [load, effectiveCompanyId, from, asOf]);

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
    setAsOf(fy.end_date);
    setSheet('bs');
  };

  const handleExcelDownload = async () => {
    if (!bsCurrent) {
      setError(t('balanceSheet.errors.noDataForExport'));
      return;
    }
    try {
      setExporting(true);
      await exportBalanceSheetExcel({
        data: bsCurrent,
        companyName: selectedCompanyName || undefined,
        language: i18n.language,
        filePrefix: i18n.language?.startsWith('en') ? 'Balance_Sheet' : '재무상태표',
      });
    } catch (err: any) {
      setError(err?.message || t('balanceSheet.errors.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const currentPeriodLabel = asOf || bsCurrent?.asOf || '-';
  const previousPeriodLabel = dateOneYearEarlier(asOf || bsCurrent?.asOf || '');
  const currentPeriodCaption = formatExcelPeriodRange(from, asOf);
  const previousPeriodCaption = formatExcelPeriodRange(dateOneYearEarlier(from), dateOneYearEarlier(asOf));

  const comparativeSheets = useMemo(() => {
    return {
      bs: buildBsSheet(bsCurrent, bsPrevious),
      pl: buildPlSheet(plCurrent, plPrevious),
      capital: buildCapitalSheet(bsCurrent, bsPrevious),
      schBs: buildSchBsSheet(bsCurrent, bsPrevious),
      schPl: buildSchPlSheet(plCurrent, plPrevious),
    };
  }, [bsCurrent, bsPrevious, plCurrent, plPrevious]);

  const imbalanceTopN = 10;
  const imbalanceSuspects = useMemo(() => {
    if (bsCurrent?.balanced !== false) return [];
    return buildBsImbalanceSuspects(trialRows, bsCurrent, imbalanceTopN);
  }, [bsCurrent, trialRows]);

  const imbalanceDiff = useMemo(() => {
    if (!bsCurrent || bsCurrent.balanced !== false) return 0;
    return Number(
      (
        Number(bsCurrent.totalAssets || 0) - Number(bsCurrent.totalLiabilitiesAndEquity || 0)
      ).toFixed(2)
    );
  }, [bsCurrent]);

  const openLedgerForAccount = (accountId: number, code?: string) => {
    if (!accountId && !code) return;
    const params = new URLSearchParams();
    params.set('tab', 'ledger');
    if (accountId) params.set('accountId', String(accountId));
    if (code) params.set('code', code);
    if (effectiveCompanyId) params.set('company_id', String(effectiveCompanyId));
    if (from) params.set('from', from);
    if (asOf) params.set('to', asOf);
    navigate(`/accounting/books?${params.toString()}`);
  };

  const detailSheets = useMemo(
    () =>
      buildDetailSchedules({
        assetRows: (bsCurrent?.assetRows || []) as AmountRow[],
        liabilityRows: (bsCurrent?.liabilityRows || []) as AmountRow[],
        incomeRows: (plCurrent?.incomeRows || []) as AmountRow[],
        expenseRows: (plCurrent?.expenseRows || []) as AmountRow[],
      }),
    [bsCurrent, plCurrent]
  );

  const visibleSheetKeys = useMemo(() => {
    const keys: SheetKey[] = CORE_SHEET_KEYS.slice();
    for (let i = 0; i < DETAIL_SCHEDULE_KEYS.length; i += 1) {
      const key = DETAIL_SCHEDULE_KEYS[i];
      if (detailScheduleHasRows(detailSheets[key])) keys.push(key);
    }
    return keys;
  }, [detailSheets]);

  useEffect(() => {
    if (visibleSheetKeys.indexOf(sheet) < 0) setSheet('bs');
  }, [sheet, visibleSheetKeys]);

  const kpis = useMemo(
    () => [
      {
        key: 'assets',
        label: t('balanceSheet.kpi.totalAssets'),
        value: bsCurrent?.totalAssets ?? 0,
        color: 'primary.main',
      },
      {
        key: 'liab',
        label: t('balanceSheet.kpi.totalLiabilities'),
        value: bsCurrent?.totalLiabilities ?? 0,
        color: 'warning.main',
      },
      {
        key: 'equity',
        label: t('balanceSheet.kpi.totalEquity'),
        value: bsCurrent?.totalEquity ?? 0,
        color: 'success.main',
      },
      {
        key: 'profit',
        label: t('balanceSheet.kpi.netProfit'),
        value: plCurrent?.netProfit ?? bsCurrent?.netProfit ?? 0,
        color: (plCurrent?.netProfit ?? bsCurrent?.netProfit ?? 0) >= 0 ? 'success.main' : 'error.main',
      },
    ],
    [bsCurrent, plCurrent, t]
  );

  const listStateBoxSx = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    py: 4,
    px: 2,
    gap: 1,
  } as const;

  const filterFieldSx = { ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx };

  const renderComparative = (lines: ComparativeLine[]) => {
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

    if (!lines.length) {
      return (
        <Box sx={listStateBoxSx}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
            {t('balanceSheet.empty.hint')}
          </Typography>
        </Box>
      );
    }

    return (
      <TableContainer sx={flushTableContainerSx}>
        <Table size="small" sx={{ ...statementTableSx, minWidth: 860 }}>
          <TableHead sx={[mvsTableHeadHighlightSx, compactHeadSx] as any}>
            <TableRow>
              <TableCell width="6%" />
              <TableCell width="44%">{t('balanceSheet.statement.particulars')}</TableCell>
              <TableCell width="8%" align="center">
                {t('balanceSheet.statement.noteNo')}
              </TableCell>
              <TableCell width="21%" align="right">
                <Box component="span" sx={{ display: 'block', fontWeight: 600 }}>
                  {t('balanceSheet.statement.forPeriod', {
                    range: currentPeriodCaption || currentPeriodLabel,
                  })}
                </Box>
                <Box component="span" sx={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'text.secondary' }}>
                  {t('balanceSheet.statement.amountRs')}
                </Box>
              </TableCell>
              <TableCell
                width="21%"
                align="right"
                sx={{ bgcolor: `${excelPrevColBg} !important` }}
              >
                <Box component="span" sx={{ display: 'block', fontWeight: 600 }}>
                  {t('balanceSheet.statement.forPeriod', {
                    range:
                      previousPeriodCaption ||
                      previousPeriodLabel ||
                      t('balanceSheet.statement.previousPeriod'),
                  })}
                </Box>
                <Box component="span" sx={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'text.secondary' }}>
                  {t('balanceSheet.statement.amountRs')}
                </Box>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody sx={[mvsTableBodyRowSx, statementBodySx] as any}>
            {lines.map((row, idx) => {
              const isSection = Boolean(row.section);
              const isTotal = Boolean(row.total);
              const isGroup = Boolean(row.group) || (!isSection && !isTotal && row.indent === 0 && row.current === null);
              const showAmount = row.current !== null || row.previous !== null;
              const bold = isSection || isTotal || isGroup;
              const labelIndent = isTotal || isSection || (isGroup && (row.indent ?? 0) === 0) ? 0 : row.indent ?? 1;
              const noteKey = String(row.note || '').trim();
              const noteTarget = noteKey ? NOTE_SHEET_MAP[noteKey] : undefined;
              const rawLabel = row.accountId
                ? getGlAccountName(
                    { code: row.code || '', name: row.label, name_en: row.nameEn },
                    i18n.language
                  )
                : row.labelKey
                  ? t(row.labelKey)
                  : row.label;
              const accountLabel = formatEnglishSentenceLabel(rawLabel);

              return (
                <TableRow
                  key={`${row.index || ''}-${row.labelKey || row.label}-${idx}`}
                  hover={!isSection && !isTotal}
                  sx={isTotal ? totalRowSx : undefined}
                >
                  <TableCell
                    align="center"
                    sx={{ fontWeight: bold ? 700 : 400, whiteSpace: 'nowrap', color: 'text.secondary' }}
                  >
                    {isTotal ? '' : row.index || ''}
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: bold ? 700 : 400,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      color:
                        row.mismatchCurrent || row.mismatchPrevious ? 'error.main' : 'inherit',
                      ...(isTotal ? { textAlign: 'center', pl: 1.5 } : { pl: 1.5 + labelIndent * 1.75 }),
                    }}
                  >
                    {row.accountId ? (
                      <Link
                        component="button"
                        type="button"
                        underline="hover"
                        onClick={() => openLedgerForAccount(row.accountId as number, row.code)}
                        sx={{
                          ...ledgerLinkSx,
                          fontWeight: 400,
                          display: 'inline',
                        }}
                      >
                        {accountLabel}
                      </Link>
                    ) : (
                      accountLabel
                    )}
                  </TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                    {isSection || isTotal || Boolean(row.accountId) || !noteKey ? (
                      ''
                    ) : noteTarget ? (
                      <Link
                        component="button"
                        type="button"
                        underline="hover"
                        onClick={() => setSheet(noteTarget)}
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.8125rem',
                          cursor: 'pointer',
                          border: 0,
                          background: 'none',
                          p: 0,
                          color: 'primary.main',
                        }}
                      >
                        {noteKey}
                      </Link>
                    ) : (
                      <Box component="span" sx={{ color: 'text.secondary' }}>
                        {noteKey}
                      </Box>
                    )}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: isTotal ? 700 : 400,
                      color: row.mismatchCurrent ? 'error.main' : 'inherit',
                    }}
                  >
                    {showAmount && row.current !== null ? formatInr(row.current) : ''}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: isTotal ? 700 : 400,
                      bgcolor: `${excelPrevColBg} !important`,
                      color: row.mismatchPrevious ? 'error.main' : 'inherit',
                    }}
                  >
                    {showAmount && row.previous !== null ? formatInr(row.previous) : ''}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderLedgerList = (rows: AmountRow[], emptyKey: string) => {
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
          <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
            {t(emptyKey, { defaultValue: t('balanceSheet.empty.schedule') })}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 480 }}>
            {t('balanceSheet.empty.hint')}
          </Typography>
        </Box>
      );
    }

    const total = sumAmounts(rows);
    return (
      <TableContainer sx={flushTableContainerSx}>
        <Table size="small" sx={compactTableSx}>
          <TableHead sx={[mvsTableHeadHighlightSx, compactHeadSx] as any}>
            <TableRow>
              <TableCell width="18%">{t('balanceSheet.columns.code')}</TableCell>
              <TableCell width="52%">{t('balanceSheet.columns.account')}</TableCell>
              <TableCell width="30%" align="right">
                {t('balanceSheet.columns.amount')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody sx={mvsTableBodyRowSx}>
            {rows.map((row) => (
              <TableRow key={`${row.accountId}-${row.code || row.name}`} hover>
                <TableCell sx={cellEllipsisSx}>{row.code || ''}</TableCell>
                <TableCell sx={cellEllipsisSx}>
                  {row.synthetic
                    ? formatEnglishSentenceLabel(row.name)
                    : getGlAccountName(
                        { code: row.code, name: row.name, name_en: row.nameEn },
                        i18n.language
                      )}
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatInr(row.amount)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow sx={totalRowSx}>
              <TableCell colSpan={2}>{t('balanceSheet.total')}</TableCell>
              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatInr(total)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderTrialBalance = () => {
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

    if (!trialRows.length) {
      return (
        <Box sx={listStateBoxSx}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
            {t('balanceSheet.empty.trialBalance')}
          </Typography>
        </Box>
      );
    }

    return (
      <TableContainer sx={flushTableContainerSx}>
        <Table size="small" sx={{ ...compactTableSx, minWidth: 880 }}>
          <TableHead sx={[mvsTableHeadHighlightSx, compactHeadSx] as any}>
            <TableRow>
              <TableCell width="12%">{t('balanceSheet.columns.code')}</TableCell>
              <TableCell width="36%">{t('balanceSheet.statement.particulars')}</TableCell>
              <TableCell width="12%">{t('balanceSheet.columns.group')}</TableCell>
              <TableCell width="13%" align="right">
                {t('balanceSheet.columns.debit')}
              </TableCell>
              <TableCell width="13%" align="right">
                {t('balanceSheet.columns.credit')}
              </TableCell>
              <TableCell width="14%" align="right">
                {t('balanceSheet.columns.closing')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody sx={mvsTableBodyRowSx}>
            {trialRows.map((row) => (
              <TableRow key={row.accountId} hover>
                <TableCell sx={cellEllipsisSx}>{row.code}</TableCell>
                <TableCell sx={cellEllipsisSx}>
                  {getGlAccountName(
                    { code: row.code, name: row.name, name_en: (row as any).nameEn ?? (row as any).name_en },
                    i18n.language
                  )}
                </TableCell>
                <TableCell sx={cellEllipsisSx}>{formatEnglishSentenceLabel(row.nature || '')}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatInr(row.debit)}
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatInr(row.credit)}
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatInr(row.balance)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow sx={totalRowSx}>
              <TableCell colSpan={3}>{t('balanceSheet.total')}</TableCell>
              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatInr(trialTotals.debit)}
              </TableCell>
              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatInr(trialTotals.credit)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderSheet = () => {
    switch (sheet) {
      case 'bs':
        return renderComparative(comparativeSheets.bs);
      case 'pl':
        return renderComparative(comparativeSheets.pl);
      case 'capital':
        return renderComparative(comparativeSheets.capital);
      case 'schBs':
        return renderComparative(comparativeSheets.schBs);
      case 'schPl':
        return renderComparative(comparativeSheets.schPl);
      case 'trialBalance':
        return renderTrialBalance();
      default:
        if (detailSheets[sheet as DetailScheduleKey]) {
          return renderLedgerList(
            detailSheets[sheet as DetailScheduleKey],
            `balanceSheet.empty.${sheet}`
          );
        }
        return null;
    }
  };

  return (
    <Box sx={mvsPageRootSx}>
      <DaeheungPageHeader title={t('balanceSheet.title')} description={t('balanceSheet.description')} />

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

      <Alert severity={bsCurrent?.balanced === false ? 'warning' : 'info'} sx={{ mb: 2 }}>
        {bsCurrent?.balanced === false ? t('balanceSheet.unbalancedHint') : t('balanceSheet.hint')}
      </Alert>

      {bsCurrent?.balanced === false ? (
        <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 2 }}>
          <Box sx={{ ...mvsBodySectionHeaderSx, alignItems: 'flex-start', py: 1.75 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 700, letterSpacing: '-0.01em', display: 'flex', alignItems: 'baseline', gap: 1 }}
              >
                <Box component="span" sx={{ color: 'error.main' }}>
                  {t('balanceSheet.imbalancePanel.warning')}
                </Box>
                {t('balanceSheet.imbalancePanel.title', { n: imbalanceTopN })}
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 0.5, fontVariantNumeric: 'tabular-nums', color: 'error.main', fontWeight: 600 }}
              >
                {t('balanceSheet.imbalancePanel.difference')}: {formatInr(imbalanceDiff)}
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setSheet('trialBalance')}
              sx={mvsBodyOutlinedBtnSx}
            >
              {t('balanceSheet.imbalancePanel.openTrialBalance')}
            </Button>
          </Box>

          {!imbalanceSuspects.length ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                px: { xs: 2, sm: 2.5 },
                py: 3,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {t('balanceSheet.imbalancePanel.empty')}
              </Typography>
            </Box>
          ) : (
            <TableContainer
              sx={{
                width: '100%',
                maxWidth: '100%',
                maxHeight: 280,
                overflowX: 'hidden',
                overflowY: 'auto',
              }}
            >
              <Table
                size="small"
                stickyHeader
                sx={{
                  ...compactTableSx,
                  width: '100%',
                  minWidth: 0,
                  tableLayout: 'fixed',
                  borderCollapse: 'separate',
                  borderSpacing: 0,
                  '& .MuiTableCell-root': {
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderTop: 'none',
                    py: '2px !important',
                    px: '6px !important',
                    fontSize: '0.75rem',
                    lineHeight: 1.2,
                  },
                }}
              >
                <TableHead
                  sx={[
                    mvsTableHeadHighlightSx,
                    compactHeadSx,
                    {
                      '& .MuiTableCell-head': {
                        position: 'sticky',
                        top: 0,
                        zIndex: 3,
                        bgcolor: '#F8FAFC',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontSize: '0.75rem',
                        px: '6px !important',
                      },
                    },
                  ] as any}
                >
                  <TableRow>
                    <TableCell width="4%">{t('balanceSheet.imbalancePanel.columns.rank')}</TableCell>
                    <TableCell width="9%">{t('balanceSheet.columns.code')}</TableCell>
                    <TableCell width="18%">{t('balanceSheet.columns.account')}</TableCell>
                    <TableCell width="7%">{t('balanceSheet.columns.group')}</TableCell>
                    <TableCell width="11%" align="right">
                      {t('balanceSheet.columns.debit')}
                    </TableCell>
                    <TableCell width="11%" align="right">
                      {t('balanceSheet.columns.credit')}
                    </TableCell>
                    <TableCell width="12%" align="right">
                      {t('balanceSheet.imbalancePanel.columns.periodNet')}
                    </TableCell>
                    <TableCell width="12%" align="right">
                      {t('balanceSheet.imbalancePanel.columns.bsAmount')}
                    </TableCell>
                    <TableCell width="16%">{t('balanceSheet.imbalancePanel.columns.reason')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody sx={mvsTableBodyRowSx}>
                  {imbalanceSuspects.map((row, idx) => {
                    const accountLabel = getGlAccountName(
                      { code: row.code, name: row.name, name_en: row.nameEn },
                      i18n.language
                    );
                    const reasonLabel = t(`balanceSheet.imbalancePanel.reasons.${row.reason}`);
                    return (
                    <TableRow key={row.accountId} hover>
                      <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {idx + 1}
                      </TableCell>
                      <TableCell sx={ellipsisCellSx} title={row.code}>
                        {row.accountId ? (
                          <Link
                            component="button"
                            type="button"
                            underline="hover"
                            onClick={() => openLedgerForAccount(row.accountId, row.code)}
                            sx={ledgerLinkSx}
                          >
                            {row.code}
                          </Link>
                        ) : (
                          row.code
                        )}
                      </TableCell>
                      <TableCell sx={ellipsisCellSx} title={accountLabel}>
                        {row.accountId ? (
                          <Link
                            component="button"
                            type="button"
                            underline="hover"
                            onClick={() => openLedgerForAccount(row.accountId, row.code)}
                            sx={ledgerLinkSx}
                          >
                            {accountLabel}
                          </Link>
                        ) : (
                          accountLabel
                        )}
                      </TableCell>
                      <TableCell sx={ellipsisCellSx}>{row.nature || ''}</TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          ...nowrapAmountSx,
                          color: row.debit < 0 ? 'error.main' : 'inherit',
                        }}
                      >
                        {formatInr(row.debit)}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          ...nowrapAmountSx,
                          color: row.credit < 0 ? 'error.main' : 'inherit',
                        }}
                      >
                        {formatInr(row.credit)}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          ...nowrapAmountSx,
                          color: row.periodNet < 0 ? 'error.main' : 'inherit',
                        }}
                      >
                        {formatInr(row.periodNet)}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          ...nowrapAmountSx,
                          color:
                            row.bsAmount != null && row.bsAmount < 0 ? 'error.main' : 'inherit',
                        }}
                      >
                        {row.bsAmount == null ? '—' : formatInr(row.bsAmount)}
                      </TableCell>
                      <TableCell sx={ellipsisCellSx} title={reasonLabel}>
                        {reasonLabel}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Card>
      ) : null}

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
              label={t('balanceSheet.fiscalYear')}
              value={fyStartYear}
              onChange={(e) => handleFyChange(Number(e.target.value))}
              disabled={loading}
              sx={{ ...filterFieldSx, width: { xs: '100%', sm: 180 }, minWidth: 160, flex: '0 0 auto' }}
              {...mvsOutlinedLabelProps}
            >
              {fyOptions.map((opt) => (
                <MenuItem key={opt.startYear} value={opt.startYear}>
                  {opt.label}
                  {opt.startYear === currentFyStartYear ? ` (${t('balanceSheet.currentFy')})` : ''}
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
              {BS_PERIOD_KEYS.map((key) => {
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
                    {t(`balanceSheet.periods.${key}`)}
                  </Button>
                );
              })}
            </Box>

            <TextField
              size="small"
              type="date"
              label={t('balanceSheet.from')}
              value={from}
              InputProps={{ readOnly: true }}
              disabled={loading}
              sx={{ ...filterFieldSx, width: { xs: '100%', sm: 150 }, minWidth: 140, flex: '0 0 auto' }}
              {...mvsOutlinedLabelProps}
            />
            <TextField
              size="small"
              type="date"
              label={t('balanceSheet.asOf')}
              value={asOf}
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
              {t('balanceSheet.search')}
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
              onClick={() => void handleExcelDownload()}
              disabled={loading || exporting || !bsCurrent}
            >
              {t('balanceSheet.excelDownload')}
            </Button>
          </Box>
        </Box>
      </Card>

      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 0 }}>
        <Tabs
          value={visibleSheetKeys.indexOf(sheet) >= 0 ? sheet : 'bs'}
          onChange={(_, value: SheetKey) => setSheet(value)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            minHeight: 48,
            px: 1,
            bgcolor: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
            '& .MuiTabs-indicator': { display: 'none' },
            '& .MuiTabs-flexContainer': {
              minHeight: 48,
              alignItems: 'center',
              gap: 0.5,
            },
            '& .MuiTab-root': {
              minHeight: 36,
              minWidth: 0,
              py: 1,
              px: 1.5,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.8125rem',
              color: 'text.secondary',
              borderRadius: '6px',
            },
            '& .MuiTab-root.Mui-selected': {
              color: 'primary.main',
              fontWeight: 700,
              bgcolor: '#E8F1FB',
            },
          }}
        >
          {visibleSheetKeys.map((key) => (
            <Tab key={key} value={key} label={t(`balanceSheet.sheets.${key}`)} />
          ))}
        </Tabs>
        {renderSheet()}
      </Card>

      <Snackbar open={Boolean(error)} autoHideDuration={5000} onClose={() => setError('')}>
        <Alert severity="error" onClose={() => setError('')} sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default BalanceSheet;
