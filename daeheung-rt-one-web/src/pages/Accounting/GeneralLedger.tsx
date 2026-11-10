import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  ListItemIcon,
  Menu,
  MenuItem,
  Pagination,
  Snackbar,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  FileDownload as DownloadIcon,
  MoreHoriz as MoreHorizIcon,
  PostAdd as PostAddIcon,
  RestartAlt as ResetIcon,
  Search as SearchIcon,
  UploadFile as TallyImportIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import VoucherLinesEditor from '../../components/Accounting/VoucherLinesEditor';
import AccountingCompanyBar from '../../components/Accounting/AccountingCompanyBar';
import { useGlAccounts } from '../../hooks/useGlAccounts';
import { useAccountingCompany } from '../../hooks/useAccountingCompany';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import {
  getMvsDialogActionsSx,
  getMvsDialogPaperSx,
  getMvsDialogTitleRowSx,
} from '../../components/Common/daeheungDialogShell';
import {
  mvsBodyCardSx,
  mvsBodyFilterWrapSx,
  mvsBodyListTableSx,
  mvsBodyListZoneSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPaginationSx,
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
import { accountingService } from '../../services/api';
import { useStore } from '../../store';
import { getGlAccountLabel, getGlAccountName } from '../../utils/glAccountLabel';

type TabKey = 'vouchers' | 'ledger' | 'trial' | 'accounts';
type ListViewMode = 'page' | 'all';

const listViewModeBarSx = {
  mb: 1.25,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 0.75,
} as const;

const listViewModeBtnSx = {
  height: 32,
  minWidth: 0,
  px: 1.5,
  textTransform: 'none' as const,
  fontWeight: 600,
  fontSize: '0.75rem',
  borderRadius: '10px',
  boxShadow: 'none',
  whiteSpace: 'nowrap' as const,
};

const ListViewModeButtons: React.FC<{
  value: ListViewMode;
  onChange: (mode: ListViewMode) => void;
  pageLabel: string;
  allLabel: string;
}> = ({ value, onChange, pageLabel, allLabel }) => (
  <Box sx={listViewModeBarSx}>
    <Button
      size="small"
      disableElevation
      variant={value === 'page' ? 'contained' : 'outlined'}
      onClick={() => onChange('page')}
      sx={{
        ...listViewModeBtnSx,
        ...(value === 'page'
          ? { bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' } }
          : { borderColor: '#CBD5E1', color: 'text.secondary', bgcolor: '#FFFFFF' }),
      }}
    >
      {pageLabel}
    </Button>
    <Button
      size="small"
      disableElevation
      variant={value === 'all' ? 'contained' : 'outlined'}
      onClick={() => onChange('all')}
      sx={{
        ...listViewModeBtnSx,
        ...(value === 'all'
          ? { bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' } }
          : { borderColor: '#CBD5E1', color: 'text.secondary', bgcolor: '#FFFFFF' }),
      }}
    >
      {allLabel}
    </Button>
  </Box>
);
type AccountSortKey = 'code' | 'name' | 'balance';
type TrialSortKey = 'code' | 'name' | 'debit' | 'credit' | 'balance';
type VoucherSortKey = 'no' | 'date' | 'status' | 'narration' | 'debit';
type LedgerSortKey = 'date' | 'voucher' | 'narration' | 'debit' | 'credit' | 'balance';
type LedgerPeriodKey = 'all' | 'thisMonth' | 'lastMonth' | 'last3Months' | 'fiscalYear' | 'custom';

type FinancialYearRow = {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_open: boolean;
};

const toYmdLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const resolveCurrentFinancialYear = (
  rows: FinancialYearRow[],
  now = new Date()
): FinancialYearRow | null => {
  if (!rows.length) return null;
  const today = toYmdLocal(now);
  const containing = rows.filter((fy) => today >= fy.start_date && today <= fy.end_date);
  if (containing.length) {
    return containing.find((fy) => fy.is_open) || containing[0];
  }
  return rows[0];
};

const getLedgerPeriodRange = (
  key: Exclude<LedgerPeriodKey, 'custom'>,
  options?: { fiscalYear?: FinancialYearRow | null }
): { from: string; to: string } => {
  const now = new Date();
  const today = toYmdLocal(now);
  if (key === 'all') return { from: '', to: '' };
  if (key === 'thisMonth') {
    return { from: toYmdLocal(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
  }
  if (key === 'lastMonth') {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: toYmdLocal(from), to: toYmdLocal(to) };
  }
  if (key === 'last3Months') {
    return { from: toYmdLocal(new Date(now.getFullYear(), now.getMonth() - 2, 1)), to: today };
  }
  const fy = options?.fiscalYear;
  if (fy?.start_date && fy?.end_date) {
    const to = today <= fy.end_date ? today : fy.end_date;
    return { from: fy.start_date, to };
  }
  // 회계연도 마스터 없을 때 인도식 FY(4/1~) 폴백
  const y = now.getFullYear();
  const startYear = now.getMonth() + 1 >= 4 ? y : y - 1;
  return { from: `${startYear}-04-01`, to: today };
};

const parseUrlAccountId = (params: URLSearchParams): number | '' => {
  const raw = Number(params.get('accountId') || params.get('account_id') || '');
  return Number.isFinite(raw) && raw > 0 ? raw : '';
};

const LEDGER_PERIOD_KEYS: Array<Exclude<LedgerPeriodKey, 'custom'>> = [
  'all',
  'thisMonth',
  'lastMonth',
  'last3Months',
  'fiscalYear',
];

const PAGE_SIZE = 15;

const periodToggleGroupSx = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 0.75,
  flex: '1 1 auto',
  minWidth: 0,
  position: 'relative',
  zIndex: 1,
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

const filterToolbarRowSx = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-end',
  gap: 1.25,
} as const;

const scoreAccountSearch = (
  account: { code?: string; name?: string; name_en?: string | null },
  inputValue: string,
  language: string
) => {
  const tokens = inputValue
    .trim()
    .toLowerCase()
    .split(/[\s,/._-]+/)
    .filter(Boolean);
  if (!tokens.length) return 1;

  const hay = [account.code, account.name, account.name_en, getGlAccountLabel(account as any, language)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const words = hay.split(/[\s,/._-]+/).filter(Boolean);

  let score = 0;
  let matched = 0;
  for (const token of tokens) {
    if (hay.includes(token)) {
      matched += 1;
      score += token.length >= 3 ? 4 : 2;
      if (words.some((w) => w.startsWith(token))) score += 3;
      continue;
    }
    // 앞글자 일치로 오타 완화 (limiyua → limited)
    if (token.length >= 3) {
      const prefix = token.slice(0, Math.min(4, token.length));
      if (words.some((w) => w.startsWith(prefix) || prefix.startsWith(w.slice(0, Math.min(4, w.length))))) {
        matched += 1;
        score += 1;
      }
    }
  }
  if (matched === 0) return 0;
  // 입력 단어 중 절반 이상 맞으면 우선
  score += matched * 2;
  if (matched === tokens.length) score += 10;
  return score;
};

const TAB_INDEX: Record<TabKey, number> = { vouchers: 0, ledger: 1, trial: 2, accounts: 3 };
const INDEX_TAB: TabKey[] = ['vouchers', 'ledger', 'trial', 'accounts'];

const STATUS_COLOR: Record<string, 'default' | 'success' | 'warning'> = {
  draft: 'warning',
  posted: 'success',
  cancelled: 'default',
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

const GeneralLedger: React.FC = () => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isCompactToolbar = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useStore();
  const postAllowed = user?.role === 'root' || user?.role === 'admin';
  const {
    canSelectCompany,
    companies,
    selectedCompanyId,
    effectiveCompanyId,
    selectedCompanyName,
    companyQuery,
    changeCompany,
  } = useAccountingCompany();
  const { accounts, ledgerAccounts, reload: reloadAccounts } = useGlAccounts(false, effectiveCompanyId);
  const { dialogState, showConfirm, handleConfirm, handleCancel } = useConfirmDialog();

  const initialTab = TAB_INDEX[(searchParams.get('tab') as TabKey) || 'vouchers'] ?? 0;
  const [tab, setTab] = useState(initialTab);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const [bulkPosting, setBulkPosting] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [toolbarMenuAnchor, setToolbarMenuAnchor] = useState<null | HTMLElement>(null);

  const [vouchers, setVouchers] = useState<any[]>([]);
  const [selectedVoucher, setSelectedVoucher] = useState<any | null>(null);
  const [voucherSearch, setVoucherSearch] = useState('');
  const [voucherPeriod, setVoucherPeriod] = useState<LedgerPeriodKey>('fiscalYear');
  const [voucherFrom, setVoucherFrom] = useState(() => getLedgerPeriodRange('fiscalYear').from);
  const [voucherTo, setVoucherTo] = useState(() => getLedgerPeriodRange('fiscalYear').to);
  const [voucherSortBy, setVoucherSortBy] = useState<VoucherSortKey>('date');
  const [voucherSortDir, setVoucherSortDir] = useState<'asc' | 'desc'>('desc');
  const [voucherPage, setVoucherPage] = useState(1);
  const [voucherViewMode, setVoucherViewMode] = useState<ListViewMode>('page');

  const urlLedgerAccountId = parseUrlAccountId(searchParams);
  const urlLedgerFrom = searchParams.get('from') || '';
  const urlLedgerTo = searchParams.get('to') || '';
  const prevCompanyIdRef = useRef<number | undefined>(undefined);

  const [ledgerAccountId, setLedgerAccountId] = useState<number | ''>(urlLedgerAccountId);
  const [ledgerPeriod, setLedgerPeriod] = useState<LedgerPeriodKey>(
    urlLedgerFrom || urlLedgerTo ? 'custom' : 'fiscalYear'
  );
  const [ledgerFrom, setLedgerFrom] = useState(
    () => urlLedgerFrom || getLedgerPeriodRange('fiscalYear').from
  );
  const [ledgerTo, setLedgerTo] = useState(
    () => urlLedgerTo || getLedgerPeriodRange('fiscalYear').to
  );
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [ledgerExporting, setLedgerExporting] = useState(false);
  const [ledgerSortBy, setLedgerSortBy] = useState<LedgerSortKey>('date');
  const [ledgerSortDir, setLedgerSortDir] = useState<'asc' | 'desc'>('asc');
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerViewMode, setLedgerViewMode] = useState<ListViewMode>('page');

  const [trialPeriod, setTrialPeriod] = useState<LedgerPeriodKey>('fiscalYear');
  const [trialFrom, setTrialFrom] = useState(() => getLedgerPeriodRange('fiscalYear').from);
  const [trialTo, setTrialTo] = useState(() => getLedgerPeriodRange('fiscalYear').to);
  const [trialData, setTrialData] = useState<any>(null);
  const [trialExporting, setTrialExporting] = useState(false);
  const [trialSearch, setTrialSearch] = useState('');
  const [trialSortBy, setTrialSortBy] = useState<TrialSortKey>('code');
  const [trialSortDir, setTrialSortDir] = useState<'asc' | 'desc'>('asc');
  const [trialPage, setTrialPage] = useState(1);
  const [trialViewMode, setTrialViewMode] = useState<ListViewMode>('page');

  const [accountSearch, setAccountSearch] = useState('');
  const [accountSortBy, setAccountSortBy] = useState<AccountSortKey>('code');
  const [accountSortDir, setAccountSortDir] = useState<'asc' | 'desc'>('asc');
  const [accountPage, setAccountPage] = useState(1);
  const [accountViewMode, setAccountViewMode] = useState<ListViewMode>('page');
  const [financialYears, setFinancialYears] = useState<FinancialYearRow[]>([]);

  const currentFinancialYear = useMemo(
    () => resolveCurrentFinancialYear(financialYears),
    [financialYears]
  );

  const periodRangeOptions = useMemo(
    () => ({ fiscalYear: currentFinancialYear }),
    [currentFinancialYear]
  );

  const voucherFromRef = useRef(voucherFrom);
  const voucherToRef = useRef(voucherTo);
  voucherFromRef.current = voucherFrom;
  voucherToRef.current = voucherTo;

  const ledgerFromRef = useRef(ledgerFrom);
  const ledgerToRef = useRef(ledgerTo);
  ledgerFromRef.current = ledgerFrom;
  ledgerToRef.current = ledgerTo;

  const appliedFyKeyRef = useRef<string>('');

  const trialFromRef = useRef(trialFrom);
  const trialToRef = useRef(trialTo);
  trialFromRef.current = trialFrom;
  trialToRef.current = trialTo;

  const filterFieldSx = { ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx };
  const dateFilterFieldSx = {
    ...filterFieldSx,
    width: { xs: 'calc(50% - 6px)', sm: 168 },
    flex: '0 0 auto',
    '& input[type="date"]': {
      cursor: 'pointer',
      colorScheme: 'light',
    },
  } as const;

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

  const kpis = useMemo(() => {
    const posted = vouchers.filter((v) => v.status === 'posted').length;
    const draft = vouchers.filter((v) => v.status === 'draft').length;
    const amount = vouchers.reduce((s, v) => s + Number(v.total_debit || 0), 0);
    return [
      { key: 'total', value: vouchers.length, color: 'text.primary' },
      { key: 'draft', value: draft, color: 'warning.main' },
      { key: 'posted', value: posted, color: 'success.main' },
      { key: 'totalDebit', value: amount.toLocaleString(), color: 'primary.main' },
    ] as const;
  }, [vouchers]);

  const draftCount = useMemo(
    () => vouchers.filter((v) => v.status === 'draft').length,
    [vouchers]
  );

  const loadVouchers = useCallback(async (range?: { from?: string; to?: string }) => {
    setLoadingVouchers(true);
    try {
      const from = range?.from !== undefined ? range.from : voucherFromRef.current;
      const to = range?.to !== undefined ? range.to : voucherToRef.current;
      const res = await accountingService.getGlVouchers({
        ...companyQuery,
        from: from || undefined,
        to: to || undefined,
      });
      setVouchers(Array.isArray(res?.data) ? res.data : []);
    } finally {
      setLoadingVouchers(false);
    }
  }, [companyQuery]);

  const applyVoucherPeriod = (key: Exclude<LedgerPeriodKey, 'custom'>) => {
    const { from, to } = getLedgerPeriodRange(key, periodRangeOptions);
    setVoucherPeriod(key);
    setVoucherFrom(from);
    setVoucherTo(to);
    void loadVouchers({ from, to });
  };

  const setVoucherDateCustom = (field: 'from' | 'to', value: string) => {
    setVoucherPeriod('custom');
    if (field === 'from') setVoucherFrom(value);
    else setVoucherTo(value);
  };

  const loadVoucherDetail = useCallback(
    async (id: number) => {
      setDetailOpen(true);
      setDetailLoading(true);
      setSelectedVoucher(null);
      try {
        const res = await accountingService.getGlVoucher(id, effectiveCompanyId);
        setSelectedVoucher(res?.data || null);
      } catch (err: any) {
        setError(err?.response?.data?.message || t('generalLedger.errors.loadVoucher'));
        setDetailOpen(false);
        setSelectedVoucher(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [effectiveCompanyId, t]
  );

  const closeVoucherDetail = () => {
    setDetailOpen(false);
    setSelectedVoucher(null);
  };

  const loadLedger = useCallback(
    async (accountId?: number, range?: { from?: string; to?: string }) => {
      const id = accountId ?? ledgerAccountId;
      if (!id) {
        setLedgerData(null);
        return;
      }
      try {
        const from = range?.from !== undefined ? range.from : ledgerFromRef.current;
        const to = range?.to !== undefined ? range.to : ledgerToRef.current;
        const res = await accountingService.getAccountLedger({
          accountId: Number(id),
          from: from || undefined,
          to: to || undefined,
          company_id: effectiveCompanyId,
        });
        const data = res?.data;
        // 회사 전환 중 404 → 목록 폴백이 data:[] 를 줄 수 있음 (배열의 .entries 는 메서드)
        if (!data || Array.isArray(data) || !data.account) {
          setLedgerData(null);
          return;
        }
        setLedgerData({
          ...data,
          entries: Array.isArray(data.entries) ? data.entries : [],
        });
      } catch {
        setLedgerData(null);
      }
    },
    [ledgerAccountId, effectiveCompanyId]
  );

  const ledgerEntries = useMemo(
    () => (Array.isArray(ledgerData?.entries) ? ledgerData.entries : []),
    [ledgerData]
  );

  const skipUrlPeriodSyncRef = useRef(false);

  const writeLedgerPeriodToUrl = (from: string, to: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'ledger');
    if (ledgerAccountId) next.set('accountId', String(ledgerAccountId));
    if (from) next.set('from', from);
    else next.delete('from');
    if (to) next.set('to', to);
    else next.delete('to');
    if (effectiveCompanyId) next.set('company_id', String(effectiveCompanyId));
    skipUrlPeriodSyncRef.current = true;
    setSearchParams(next, { replace: true });
  };

  const applyLedgerPeriod = (key: Exclude<LedgerPeriodKey, 'custom'>) => {
    const { from, to } = getLedgerPeriodRange(key, periodRangeOptions);
    setLedgerPeriod(key);
    setLedgerFrom(from);
    setLedgerTo(to);
    writeLedgerPeriodToUrl(from, to);
    void loadLedger(undefined, { from, to });
  };

  const setLedgerDateCustom = (field: 'from' | 'to', value: string) => {
    setLedgerPeriod('custom');
    if (field === 'from') setLedgerFrom(value);
    else setLedgerTo(value);
  };

  const setTrialDateCustom = (field: 'from' | 'to', value: string) => {
    setTrialPeriod('custom');
    if (field === 'from') setTrialFrom(value);
    else setTrialTo(value);
  };

  const sortedLedgerEntries = useMemo(() => {
    const rows = [...ledgerEntries];
    const dir = ledgerSortDir === 'asc' ? 1 : -1;
    rows.sort((a: any, b: any) => {
      if (ledgerSortBy === 'debit' || ledgerSortBy === 'credit' || ledgerSortBy === 'balance') {
        const key =
          ledgerSortBy === 'balance' ? 'runningBalance' : ledgerSortBy;
        return (Number(a[key] || 0) - Number(b[key] || 0)) * dir;
      }
      if (ledgerSortBy === 'voucher') {
        return (
          String(a.voucherNo || '').localeCompare(String(b.voucherNo || ''), undefined, {
            sensitivity: 'base',
            numeric: true,
          }) * dir
        );
      }
      if (ledgerSortBy === 'narration') {
        return (
          String(a.narration || '').localeCompare(String(b.narration || ''), undefined, {
            sensitivity: 'base',
            numeric: true,
          }) * dir
        );
      }
      return String(a.voucherDate || '').localeCompare(String(b.voucherDate || '')) * dir;
    });
    return rows;
  }, [ledgerEntries, ledgerSortBy, ledgerSortDir]);

  const ledgerPageCount = Math.max(1, Math.ceil(sortedLedgerEntries.length / PAGE_SIZE));
  const pagedLedgerEntries = useMemo(() => {
    if (ledgerViewMode === 'all') return sortedLedgerEntries;
    const start = (ledgerPage - 1) * PAGE_SIZE;
    return sortedLedgerEntries.slice(start, start + PAGE_SIZE);
  }, [sortedLedgerEntries, ledgerPage, ledgerViewMode]);

  useEffect(() => {
    setLedgerPage(1);
  }, [ledgerSortBy, ledgerSortDir, ledgerAccountId, ledgerFrom, ledgerTo, effectiveCompanyId, ledgerViewMode]);

  useEffect(() => {
    if (ledgerPage > ledgerPageCount) setLedgerPage(ledgerPageCount);
  }, [ledgerPage, ledgerPageCount]);

  const handleLedgerSort = (key: LedgerSortKey) => {
    if (ledgerSortBy === key) {
      setLedgerSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setLedgerSortBy(key);
    setLedgerSortDir(key === 'debit' || key === 'credit' || key === 'balance' ? 'desc' : 'asc');
  };

  const ledgerTotals = useMemo(
    () =>
      ledgerEntries.reduce(
        (acc: { debit: number; credit: number }, e: any) => ({
          debit: acc.debit + Number(e.debit || 0),
          credit: acc.credit + Number(e.credit || 0),
        }),
        { debit: 0, credit: 0 }
      ),
    [ledgerEntries]
  );

  const exportLedgerExcel = async () => {
    if (!ledgerData?.account || !sortedLedgerEntries.length) {
      setError(t('generalLedger.errors.noDataForExport'));
      return;
    }
    try {
      setLedgerExporting(true);
      const ExcelJS = (await import('exceljs')).default;
      const { addSheetFromObjects, downloadExcelWorkbook } = await import('../../utils/excelExportStyle');
      const workbook = new ExcelJS.Workbook();
      const dateKey = t('generalLedger.ledger.columns.date');
      const voucherKey = t('generalLedger.ledger.columns.voucher');
      const narrationKey = t('generalLedger.ledger.columns.narration');
      const debitKey = t('generalLedger.ledger.columns.debit');
      const creditKey = t('generalLedger.ledger.columns.credit');
      const balanceKey = t('generalLedger.ledger.columns.balance');
      const exportRows = [
        ...sortedLedgerEntries.map((e: any) => ({
          [dateKey]: e.voucherDate ?? '',
          [voucherKey]: e.voucherNo ?? '',
          [narrationKey]: e.narration || '-',
          [debitKey]: Number(e.debit || 0),
          [creditKey]: Number(e.credit || 0),
          [balanceKey]: Number(e.runningBalance || 0),
        })),
        {
          [dateKey]: '',
          [voucherKey]: '',
          [narrationKey]: t('generalLedger.ledger.total'),
          [debitKey]: ledgerTotals.debit,
          [creditKey]: ledgerTotals.credit,
          [balanceKey]: Number(ledgerData.currentBalance || 0),
        },
      ];
      const sheetName = (i18n.language?.startsWith('en') ? 'Ledger' : '장부').slice(0, 31);
      addSheetFromObjects(workbook, sheetName, exportRows);
      const dateToken = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const prefix = i18n.language?.startsWith('en') ? 'Ledger' : '장부';
      const codePart = ledgerData.account.code ? `_${ledgerData.account.code}` : '';
      await downloadExcelWorkbook(workbook, `${prefix}${codePart}_${dateToken}.xlsx`);
      setSuccess(t('generalLedger.success.excelDownloaded'));
    } catch (err: any) {
      setError(err?.message || t('generalLedger.errors.exportFailed'));
    } finally {
      setLedgerExporting(false);
    }
  };

  const loadTrial = useCallback(async (range?: { from?: string; to?: string }) => {
    const from = range?.from !== undefined ? range.from : trialFromRef.current;
    const to = range?.to !== undefined ? range.to : trialToRef.current;
    const res = await accountingService.getTrialBalance({
      from: from || undefined,
      to: to || undefined,
      company_id: effectiveCompanyId,
    });
    setTrialData(res?.data || null);
  }, [effectiveCompanyId]);

  const applyTrialPeriod = (key: Exclude<LedgerPeriodKey, 'custom'>) => {
    const { from, to } = getLedgerPeriodRange(key, periodRangeOptions);
    setTrialPeriod(key);
    setTrialFrom(from);
    setTrialTo(to);
    void loadTrial({ from, to });
  };

  const exportTrialExcel = async () => {
    const rows = sortedTrialRows;
    if (!rows.length) {
      setError(t('generalLedger.errors.noDataForExport'));
      return;
    }
    try {
      setTrialExporting(true);
      const ExcelJS = (await import('exceljs')).default;
      const { addSheetFromObjects, downloadExcelWorkbook } = await import('../../utils/excelExportStyle');
      const workbook = new ExcelJS.Workbook();
      const codeKey = t('generalLedger.trial.columns.code');
      const accountKey = t('generalLedger.trial.columns.account');
      const debitKey = t('generalLedger.trial.columns.debit');
      const creditKey = t('generalLedger.trial.columns.credit');
      const balanceKey = t('generalLedger.trial.columns.balance');
      const exportRows = [
        ...rows.map((r: any) => ({
          [codeKey]: r.code ?? '',
          [accountKey]: resolveAccountName(r.accountId, r.name),
          [debitKey]: Number(r.debit || 0),
          [creditKey]: Number(r.credit || 0),
          [balanceKey]: Number(r.balance || 0),
        })),
        {
          [codeKey]: '',
          [accountKey]: t('generalLedger.trial.total'),
          [debitKey]: filteredTrialTotals.debit,
          [creditKey]: filteredTrialTotals.credit,
          [balanceKey]: '',
        },
      ];
      const sheetName = i18n.language?.startsWith('en') ? 'Trial Balance' : '시산표';
      addSheetFromObjects(workbook, sheetName, exportRows);
      const dateToken = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const prefix = i18n.language?.startsWith('en') ? 'Trial_Balance' : '시산표';
      await downloadExcelWorkbook(workbook, `${prefix}_${dateToken}.xlsx`);
      setSuccess(t('generalLedger.success.excelDownloaded'));
    } catch (err: any) {
      setError(err?.message || t('generalLedger.errors.exportFailed'));
    } finally {
      setTrialExporting(false);
    }
  };

  useEffect(() => {
    if (!effectiveCompanyId) {
      setFinancialYears([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await accountingService.getFinancialYears(effectiveCompanyId);
        if (!cancelled) {
          setFinancialYears(Array.isArray(res?.data) ? res.data : []);
        }
      } catch {
        if (!cancelled) setFinancialYears([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveCompanyId]);

  useEffect(() => {
    const companyChanged =
      prevCompanyIdRef.current !== undefined && prevCompanyIdRef.current !== effectiveCompanyId;
    prevCompanyIdRef.current = effectiveCompanyId;

    setSelectedVoucher(null);
    setLedgerData(null);
    setTrialData(null);
    setAccountSearch('');
    setVoucherSearch('');
    appliedFyKeyRef.current = '';
    const range = getLedgerPeriodRange('fiscalYear');
    setVoucherPeriod('fiscalYear');
    setVoucherFrom(range.from);
    setVoucherTo(range.to);

    const urlId = parseUrlAccountId(searchParams);
    const fromQ = searchParams.get('from') || '';
    const toQ = searchParams.get('to') || '';
    if (companyChanged && !urlId) {
      setLedgerAccountId('');
      setLedgerPeriod('fiscalYear');
      setLedgerFrom(range.from);
      setLedgerTo(range.to);
    } else if (urlId) {
      setLedgerAccountId(urlId);
      if (fromQ || toQ) {
        setLedgerPeriod('custom');
        setLedgerFrom(fromQ || range.from);
        setLedgerTo(toQ || range.to);
      }
    }

    setTrialPeriod('fiscalYear');
    setTrialFrom(range.from);
    setTrialTo(range.to);
    setTrialSearch('');
    setDetailOpen(false);
    void loadVouchers({ from: range.from, to: range.to });
    reloadAccounts();
    // loadVouchers 참조가 바뀌어도 URL 계정을 초기화하지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveCompanyId]);

  // 회계연도 마스터 로드 후 기간이 '현재 회계년도'이면 날짜를 마스터 FY에 맞춤
  useEffect(() => {
    if (!currentFinancialYear?.start_date || !currentFinancialYear?.end_date) return;
    const fyKey = `${effectiveCompanyId}:${currentFinancialYear.id}:${currentFinancialYear.start_date}:${currentFinancialYear.end_date}`;
    if (appliedFyKeyRef.current === fyKey) return;
    appliedFyKeyRef.current = fyKey;
    const range = getLedgerPeriodRange('fiscalYear', { fiscalYear: currentFinancialYear });
    if (voucherPeriod === 'fiscalYear') {
      setVoucherFrom(range.from);
      setVoucherTo(range.to);
      void loadVouchers({ from: range.from, to: range.to });
    }
    if (ledgerPeriod === 'fiscalYear') {
      setLedgerFrom(range.from);
      setLedgerTo(range.to);
    }
    if (trialPeriod === 'fiscalYear') {
      setTrialFrom(range.from);
      setTrialTo(range.to);
    }
  }, [
    currentFinancialYear,
    effectiveCompanyId,
    voucherPeriod,
    ledgerPeriod,
    trialPeriod,
    loadVouchers,
  ]);

  useEffect(() => {
    const urlId = parseUrlAccountId(searchParams);
    const urlCode = String(searchParams.get('code') || '').trim().toLowerCase();
    if (urlId) {
      setLedgerAccountId(urlId);
      return;
    }
    if (urlCode && ledgerAccounts.length) {
      const found = ledgerAccounts.find((a) => String(a.code || '').toLowerCase() === urlCode);
      if (found) {
        setLedgerAccountId(Number(found.id));
        return;
      }
    }
    if (ledgerAccounts.length && !ledgerAccountId) {
      setLedgerAccountId(Number(ledgerAccounts[0].id));
    }
  }, [ledgerAccounts, ledgerAccountId, searchParams]);

  useEffect(() => {
    if (skipUrlPeriodSyncRef.current) {
      skipUrlPeriodSyncRef.current = false;
      return;
    }
    if (!urlLedgerFrom && !urlLedgerTo) return;
    setLedgerPeriod('custom');
    if (urlLedgerFrom) setLedgerFrom(urlLedgerFrom);
    if (urlLedgerTo) setLedgerTo(urlLedgerTo);
  }, [urlLedgerFrom, urlLedgerTo]);

  useEffect(() => {
    if (tab === 1 && ledgerAccountId) {
      const fromQ = urlLedgerFrom || undefined;
      const toQ = urlLedgerTo || undefined;
      void loadLedger(
        Number(ledgerAccountId),
        fromQ || toQ ? { from: fromQ, to: toQ } : undefined
      );
    }
    if (tab === 2) loadTrial();
  }, [tab, ledgerAccountId, loadLedger, loadTrial, urlLedgerFrom, urlLedgerTo]);

  const handleTab = (_: React.SyntheticEvent, idx: number) => {
    setTab(idx);
    const next = new URLSearchParams(searchParams);
    next.set('tab', INDEX_TAB[idx]);
    if (effectiveCompanyId) next.set('company_id', String(effectiveCompanyId));
    setSearchParams(next, { replace: true });
  };

  const statusLabel = useCallback(
    (status: string) => t(`generalLedger.status.${status}`, status),
    [t]
  );

  const filteredVouchers = useMemo(() => {
    const q = voucherSearch.trim().toLowerCase();
    if (!q) return vouchers;
    return vouchers.filter((v) => {
      const no = String(v.voucher_no || '').toLowerCase();
      const date = String(v.voucher_date || '').toLowerCase();
      const narration = String(v.narration || '').toLowerCase();
      const status = statusLabel(v.status).toLowerCase();
      const debit = String(v.total_debit ?? '');
      return (
        no.includes(q) ||
        date.includes(q) ||
        narration.includes(q) ||
        status.includes(q) ||
        debit.includes(q)
      );
    });
  }, [vouchers, voucherSearch, statusLabel]);

  const sortedVouchers = useMemo(() => {
    const rows = [...filteredVouchers];
    const dir = voucherSortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      if (voucherSortBy === 'debit') {
        return (Number(a.total_debit || 0) - Number(b.total_debit || 0)) * dir;
      }
      if (voucherSortBy === 'status') {
        return statusLabel(a.status).localeCompare(statusLabel(b.status), undefined, {
          sensitivity: 'base',
        }) * dir;
      }
      if (voucherSortBy === 'narration') {
        return String(a.narration || '').localeCompare(String(b.narration || ''), undefined, {
          sensitivity: 'base',
          numeric: true,
        }) * dir;
      }
      if (voucherSortBy === 'date') {
        return String(a.voucher_date || '').localeCompare(String(b.voucher_date || '')) * dir;
      }
      return (
        String(a.voucher_no || '').localeCompare(String(b.voucher_no || ''), undefined, {
          sensitivity: 'base',
          numeric: true,
        }) * dir
      );
    });
    return rows;
  }, [filteredVouchers, voucherSortBy, voucherSortDir, statusLabel]);

  const voucherPageCount = Math.max(1, Math.ceil(sortedVouchers.length / PAGE_SIZE));
  const pagedVouchers = useMemo(() => {
    if (voucherViewMode === 'all') return sortedVouchers;
    const start = (voucherPage - 1) * PAGE_SIZE;
    return sortedVouchers.slice(start, start + PAGE_SIZE);
  }, [sortedVouchers, voucherPage, voucherViewMode]);

  useEffect(() => {
    setVoucherPage(1);
  }, [voucherSearch, voucherSortBy, voucherSortDir, voucherFrom, voucherTo, effectiveCompanyId, voucherViewMode]);

  useEffect(() => {
    if (voucherPage > voucherPageCount) setVoucherPage(voucherPageCount);
  }, [voucherPage, voucherPageCount]);

  const handleVoucherSort = (key: VoucherSortKey) => {
    if (voucherSortBy === key) {
      setVoucherSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setVoucherSortBy(key);
    setVoucherSortDir(key === 'date' || key === 'debit' ? 'desc' : 'asc');
  };

  const resolveAccountName = useCallback(
    (accountId: number, fallback?: string) => {
      const found = accounts.find((a) => a.id === accountId);
      if (found) return getGlAccountName(found, i18n.language);
      return fallback || '-';
    },
    [accounts, i18n.language]
  );

  const filteredLedgerAccounts = useMemo(() => {
    const ledgers = accounts.filter((a) => a.account_type === 'ledger');
    const q = accountSearch.trim().toLowerCase();
    if (!q) return ledgers;
    return ledgers.filter((a) => {
      const code = String(a.code || '').toLowerCase();
      const name = String(a.name || '').toLowerCase();
      const nameEn = String(a.name_en || '').toLowerCase();
      const label = getGlAccountName(a, i18n.language).toLowerCase();
      return code.includes(q) || name.includes(q) || nameEn.includes(q) || label.includes(q);
    });
  }, [accounts, accountSearch, i18n.language]);

  const sortedLedgerAccounts = useMemo(() => {
    const rows = [...filteredLedgerAccounts];
    const dir = accountSortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      if (accountSortBy === 'balance') {
        const av = Number(a.current_balance || 0);
        const bv = Number(b.current_balance || 0);
        return (av - bv) * dir;
      }
      if (accountSortBy === 'name') {
        const an = getGlAccountName(a, i18n.language);
        const bn = getGlAccountName(b, i18n.language);
        return an.localeCompare(bn, undefined, { sensitivity: 'base', numeric: true }) * dir;
      }
      return (
        String(a.code || '').localeCompare(String(b.code || ''), undefined, {
          sensitivity: 'base',
          numeric: true,
        }) * dir
      );
    });
    return rows;
  }, [filteredLedgerAccounts, accountSortBy, accountSortDir, i18n.language]);

  const handleAccountSort = (key: AccountSortKey) => {
    if (accountSortBy === key) {
      setAccountSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setAccountSortBy(key);
    setAccountSortDir(key === 'balance' ? 'desc' : 'asc');
  };

  const filteredTrialRows = useMemo(() => {
    const rows = Array.isArray(trialData?.rows) ? trialData.rows : [];
    const q = trialSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r: any) => {
      const code = String(r.code || '').toLowerCase();
      const name = resolveAccountName(r.accountId, r.name).toLowerCase();
      const rawName = String(r.name || '').toLowerCase();
      return code.includes(q) || name.includes(q) || rawName.includes(q);
    });
  }, [trialData, trialSearch, resolveAccountName]);

  const sortedTrialRows = useMemo(() => {
    const rows = [...filteredTrialRows];
    const dir = trialSortDir === 'asc' ? 1 : -1;
    rows.sort((a: any, b: any) => {
      if (trialSortBy === 'debit' || trialSortBy === 'credit' || trialSortBy === 'balance') {
        const av = Number(a[trialSortBy] || 0);
        const bv = Number(b[trialSortBy] || 0);
        return (av - bv) * dir;
      }
      if (trialSortBy === 'name') {
        const an = resolveAccountName(a.accountId, a.name);
        const bn = resolveAccountName(b.accountId, b.name);
        return an.localeCompare(bn, undefined, { sensitivity: 'base', numeric: true }) * dir;
      }
      return (
        String(a.code || '').localeCompare(String(b.code || ''), undefined, {
          sensitivity: 'base',
          numeric: true,
        }) * dir
      );
    });
    return rows;
  }, [filteredTrialRows, trialSortBy, trialSortDir, resolveAccountName]);

  const handleTrialSort = (key: TrialSortKey) => {
    if (trialSortBy === key) {
      setTrialSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setTrialSortBy(key);
    setTrialSortDir(key === 'code' || key === 'name' ? 'asc' : 'desc');
  };

  const trialPageCount = Math.max(1, Math.ceil(sortedTrialRows.length / PAGE_SIZE));
  const pagedTrialRows = useMemo(() => {
    if (trialViewMode === 'all') return sortedTrialRows;
    const start = (trialPage - 1) * PAGE_SIZE;
    return sortedTrialRows.slice(start, start + PAGE_SIZE);
  }, [sortedTrialRows, trialPage, trialViewMode]);

  useEffect(() => {
    setTrialPage(1);
  }, [trialSearch, trialSortBy, trialSortDir, trialFrom, trialTo, effectiveCompanyId, trialViewMode]);

  useEffect(() => {
    if (trialPage > trialPageCount) setTrialPage(trialPageCount);
  }, [trialPage, trialPageCount]);

  const accountPageCount = Math.max(1, Math.ceil(sortedLedgerAccounts.length / PAGE_SIZE));
  const pagedLedgerAccounts = useMemo(() => {
    if (accountViewMode === 'all') return sortedLedgerAccounts;
    const start = (accountPage - 1) * PAGE_SIZE;
    return sortedLedgerAccounts.slice(start, start + PAGE_SIZE);
  }, [sortedLedgerAccounts, accountPage, accountViewMode]);

  useEffect(() => {
    setAccountPage(1);
  }, [accountSearch, accountSortBy, accountSortDir, accountViewMode]);

  useEffect(() => {
    if (accountPage > accountPageCount) setAccountPage(accountPageCount);
  }, [accountPage, accountPageCount]);

  const filteredTrialTotals = useMemo(
    () =>
      filteredTrialRows.reduce(
        (acc: { debit: number; credit: number }, r: any) => ({
          debit: acc.debit + Number(r.debit || 0),
          credit: acc.credit + Number(r.credit || 0),
        }),
        { debit: 0, credit: 0 }
      ),
    [filteredTrialRows]
  );

  const goTallyImport = () => {
    navigate(
      effectiveCompanyId
        ? `/accounting/tally-import?company_id=${effectiveCompanyId}`
        : '/accounting/tally-import'
    );
  };

  const postSelected = async () => {
    if (!selectedVoucher) return;
    try {
      await accountingService.postGlVoucher(selectedVoucher.id, effectiveCompanyId);
      setSuccess(t('generalLedger.success.posted'));
      await loadVoucherDetail(selectedVoucher.id);
      await loadVouchers();
      reloadAccounts();
    } catch (err: any) {
      setError(err?.response?.data?.message || t('generalLedger.errors.postVoucher'));
    }
  };

  const postAllDrafts = () => {
    if (!postAllowed || draftCount <= 0 || bulkPosting) return;
    showConfirm(
      t('generalLedger.vouchers.postAllConfirm', { count: draftCount }),
      () => {
        void (async () => {
          try {
            setBulkPosting(true);
            const res = await accountingService.bulkPostGlVouchers(effectiveCompanyId);
            const posted = Number(res?.data?.posted || 0);
            const failed = Number(res?.data?.failed || 0);
            setSuccess(
              res?.message || t('generalLedger.success.bulkPosted', { posted, failed })
            );
            if (failed > 0 && Array.isArray(res?.data?.failures) && res.data.failures[0]) {
              setError(
                t('generalLedger.errors.bulkPostPartial', {
                  message: res.data.failures[0].message,
                  voucherNo: res.data.failures[0].voucherNo,
                })
              );
            }
            await loadVouchers();
            if (selectedVoucher?.id) await loadVoucherDetail(selectedVoucher.id);
            reloadAccounts();
          } catch (err: any) {
            setError(err?.response?.data?.message || t('generalLedger.errors.bulkPost'));
          } finally {
            setBulkPosting(false);
          }
        })();
      },
      {
        title: t('generalLedger.vouchers.postAllDrafts', { count: draftCount }),
        confirmColor: 'primary',
      }
    );
  };

  const openLedgerForAccount = (accountId: number) => {
    setLedgerAccountId(accountId);
    setTab(1);
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'ledger');
    next.set('accountId', String(accountId));
    if (effectiveCompanyId) next.set('company_id', String(effectiveCompanyId));
    setSearchParams(next, { replace: true });
    loadLedger(accountId);
  };

  return (
    <Box sx={mvsPageRootSx}>
      <DaeheungPageHeader
        title={t('generalLedger.title')}
        description={t('generalLedger.description')}
      />

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
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 2.5,
          mb: 3,
        }}
      >
        {kpis.map((kpi) => (
          <Card key={kpi.key} elevation={0} sx={mvsKpiCardSx}>
            <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
                {t(`generalLedger.kpi.${kpi.key}`)}
              </Typography>
              <Typography
                variant="h5"
                sx={{ mt: 0.75, fontWeight: 600, letterSpacing: '-0.02em', color: kpi.color }}
              >
                {kpi.value}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 0 }}>
        <Tabs
          value={tab}
          onChange={handleTab}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 1,
            minHeight: 48,
            '& .MuiTab-root': {
              py: 1.5,
              textTransform: 'none',
              fontWeight: 600,
              color: 'text.secondary',
              '&.Mui-selected': { color: 'primary.main' },
            },
            '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0' },
          }}
        >
          <Tab label={t('generalLedger.tabs.vouchers')} />
          <Tab label={t('generalLedger.tabs.ledger')} />
          <Tab label={t('generalLedger.tabs.trial')} />
          <Tab label={t('generalLedger.tabs.accounts')} />
        </Tabs>
      </Card>

      {tab === 0 && (
        <>
          <Card elevation={0} sx={{ ...mvsBodyCardSx, mt: 2.5, mb: 0 }}>
            <Box sx={mvsBodyFilterWrapSx}>
              <Box sx={filterToolbarRowSx}>
                <TextField
                  size="small"
                  type="date"
                  label={t('generalLedger.ledger.from')}
                  value={voucherFrom}
                  onChange={(e) => setVoucherDateCustom('from', e.target.value)}
                  sx={dateFilterFieldSx}
                  {...mvsOutlinedLabelProps}
                />
                <TextField
                  size="small"
                  type="date"
                  label={t('generalLedger.ledger.to')}
                  value={voucherTo}
                  onChange={(e) => setVoucherDateCustom('to', e.target.value)}
                  sx={dateFilterFieldSx}
                  {...mvsOutlinedLabelProps}
                />
                <Box sx={periodToggleGroupSx}>
                  {LEDGER_PERIOD_KEYS.map((key) => {
                    const selected = voucherPeriod === key;
                    return (
                      <Button
                        key={key}
                        size="small"
                        disableElevation
                        variant={selected ? 'contained' : 'outlined'}
                        onClick={() => applyVoucherPeriod(key)}
                        sx={{
                          ...periodBtnSx,
                          ...(selected
                            ? {
                                bgcolor: 'primary.main',
                                color: '#fff',
                                borderColor: 'primary.main',
                                '&:hover': { bgcolor: 'primary.dark' },
                              }
                            : {
                                color: 'text.secondary',
                                bgcolor: '#FFFFFF',
                              }),
                        }}
                      >
                        {t(`generalLedger.ledger.periods.${key}`)}
                      </Button>
                    );
                  })}
                </Box>
                <TextField
                  size="small"
                  label={t('common.search')}
                  placeholder={t('generalLedger.vouchers.searchPlaceholder')}
                  value={voucherSearch}
                  onChange={(e) => setVoucherSearch(e.target.value)}
                  sx={{
                    ...filterFieldSx,
                    flex: '1 1 200px',
                    minWidth: { xs: '100%', sm: 180 },
                    maxWidth: { md: 280 },
                  }}
                  {...mvsOutlinedLabelProps}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ fontSize: '1.125rem', color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  }}
                />
                <Button
                  variant="contained"
                  disableElevation
                  startIcon={<SearchIcon fontSize="small" />}
                  onClick={() => void loadVouchers({ from: voucherFrom, to: voucherTo })}
                  sx={{ ...mvsBodyPrimaryBtnSx, height: 40, whiteSpace: 'nowrap', flex: '0 0 auto' }}
                >
                  {t('generalLedger.ledger.search')}
                </Button>
                {isCompactToolbar ? (
                  <>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<MoreHorizIcon fontSize="small" />}
                      onClick={(e) => setToolbarMenuAnchor(e.currentTarget)}
                      sx={{ ...mvsBodyOutlinedBtnSx, height: 40, whiteSpace: 'nowrap', flex: '0 0 auto' }}
                    >
                      {t('generalLedger.moreTools')}
                    </Button>
                    <Menu
                      anchorEl={toolbarMenuAnchor}
                      open={Boolean(toolbarMenuAnchor)}
                      onClose={() => setToolbarMenuAnchor(null)}
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                      slotProps={{
                        paper: {
                          sx: {
                            mt: 0.5,
                            minWidth: 220,
                            borderRadius: '8px',
                            border: '1px solid #CBD5E1',
                            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.1)',
                          },
                        },
                      }}
                    >
                      <MenuItem
                        onClick={() => {
                          setToolbarMenuAnchor(null);
                          goTallyImport();
                        }}
                      >
                        <ListItemIcon>
                          <TallyImportIcon fontSize="small" />
                        </ListItemIcon>
                        {t('generalLedger.tallyImportLink')}
                      </MenuItem>
                      {postAllowed && draftCount > 0 ? (
                        <MenuItem
                          disabled={bulkPosting}
                          onClick={() => {
                            setToolbarMenuAnchor(null);
                            postAllDrafts();
                          }}
                        >
                          <ListItemIcon>
                            <PostAddIcon fontSize="small" />
                          </ListItemIcon>
                          {t('generalLedger.vouchers.postAllDrafts', { count: draftCount })}
                        </MenuItem>
                      ) : null}
                    </Menu>
                  </>
                ) : (
                  <>
                    {postAllowed && draftCount > 0 ? (
                      <Button
                        variant="outlined"
                        startIcon={
                          bulkPosting ? (
                            <CircularProgress size={14} color="inherit" />
                          ) : (
                            <PostAddIcon fontSize="small" />
                          )
                        }
                        sx={{ ...mvsBodyOutlinedBtnSx, height: 40, whiteSpace: 'nowrap', flex: '0 0 auto' }}
                        disabled={bulkPosting}
                        onClick={postAllDrafts}
                      >
                        {t('generalLedger.vouchers.postAllDrafts', { count: draftCount })}
                      </Button>
                    ) : null}
                    <Button
                      variant="outlined"
                      startIcon={<TallyImportIcon fontSize="small" />}
                      sx={{ ...mvsBodyOutlinedBtnSx, height: 40, whiteSpace: 'nowrap', flex: '0 0 auto' }}
                      onClick={goTallyImport}
                    >
                      {t('generalLedger.tallyImportLink')}
                    </Button>
                  </>
                )}
              </Box>
            </Box>
          </Card>

          <Box sx={mvsBodyListZoneSx}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, fontWeight: 600 }}>
              {t('generalLedger.vouchers.listTitle')}
              {voucherSearch.trim()
                ? ` (${t('generalLedger.vouchers.filteredCount', { count: sortedVouchers.length })})`
                : ` (${vouchers.length})`}
            </Typography>

            {loadingVouchers ? (
              <Box sx={listStateBoxSx}>
                <CircularProgress size={36} />
                <Typography variant="body2" color="text.secondary">
                  {t('common.loading')}
                </Typography>
              </Box>
            ) : vouchers.length === 0 ? (
              <Box sx={listStateBoxSx}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {t('generalLedger.vouchers.empty')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
                  {t('generalLedger.vouchers.emptyHint')}
                </Typography>
                <Button
                  variant="contained"
                  disableElevation
                  startIcon={<TallyImportIcon fontSize="small" />}
                  sx={mvsBodyPrimaryBtnSx}
                  onClick={goTallyImport}
                >
                  {t('generalLedger.tallyImportLink')}
                </Button>
              </Box>
            ) : !sortedVouchers.length ? (
              <Box sx={listStateBoxSx}>
                <Typography variant="body1" color="text.secondary">
                  {t('generalLedger.vouchers.emptySearch')}
                </Typography>
              </Box>
            ) : (
              <>
                <ListViewModeButtons
                  value={voucherViewMode}
                  onChange={setVoucherViewMode}
                  pageLabel={t('generalLedger.listView.page')}
                  allLabel={t('generalLedger.listView.all')}
                />
                <TableContainer sx={{ ...mvsBodyListTableSx, ...mvsTableScrollSx }}>
                  <Table size="small" sx={tableSx}>
                    <TableHead sx={mvsTableHeadHighlightSx}>
                      <TableRow>
                        <TableCell width="22%" sortDirection={voucherSortBy === 'no' ? voucherSortDir : false}>
                          <TableSortLabel
                            active={voucherSortBy === 'no'}
                            direction={voucherSortBy === 'no' ? voucherSortDir : 'asc'}
                            onClick={() => handleVoucherSort('no')}
                          >
                            <Typography noWrap component="span" variant="inherit">
                              {t('generalLedger.vouchers.columns.no')}
                            </Typography>
                          </TableSortLabel>
                        </TableCell>
                        <TableCell width="14%" sortDirection={voucherSortBy === 'date' ? voucherSortDir : false}>
                          <TableSortLabel
                            active={voucherSortBy === 'date'}
                            direction={voucherSortBy === 'date' ? voucherSortDir : 'asc'}
                            onClick={() => handleVoucherSort('date')}
                          >
                            <Typography noWrap component="span" variant="inherit">
                              {t('generalLedger.vouchers.columns.date')}
                            </Typography>
                          </TableSortLabel>
                        </TableCell>
                        <TableCell width="14%" sortDirection={voucherSortBy === 'status' ? voucherSortDir : false}>
                          <TableSortLabel
                            active={voucherSortBy === 'status'}
                            direction={voucherSortBy === 'status' ? voucherSortDir : 'asc'}
                            onClick={() => handleVoucherSort('status')}
                          >
                            <Typography noWrap component="span" variant="inherit">
                              {t('generalLedger.vouchers.columns.status')}
                            </Typography>
                          </TableSortLabel>
                        </TableCell>
                        <TableCell
                          width="30%"
                          sortDirection={voucherSortBy === 'narration' ? voucherSortDir : false}
                        >
                          <TableSortLabel
                            active={voucherSortBy === 'narration'}
                            direction={voucherSortBy === 'narration' ? voucherSortDir : 'asc'}
                            onClick={() => handleVoucherSort('narration')}
                          >
                            <Typography noWrap component="span" variant="inherit">
                              {t('generalLedger.vouchers.narration')}
                            </Typography>
                          </TableSortLabel>
                        </TableCell>
                        <TableCell
                          width="20%"
                          align="right"
                          sortDirection={voucherSortBy === 'debit' ? voucherSortDir : false}
                        >
                          <TableSortLabel
                            active={voucherSortBy === 'debit'}
                            direction={voucherSortBy === 'debit' ? voucherSortDir : 'asc'}
                            onClick={() => handleVoucherSort('debit')}
                            sx={{ '& .MuiTableSortLabel-icon': { ml: 0.5, mr: 0 } }}
                          >
                            <Typography noWrap component="span" variant="inherit">
                              {t('generalLedger.vouchers.columns.debit')}
                            </Typography>
                          </TableSortLabel>
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody sx={mvsTableBodyRowSx}>
                      {pagedVouchers.map((v) => (
                        <TableRow
                          key={v.id}
                          hover
                          onClick={() => void loadVoucherDetail(v.id)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell sx={{ ...cellEllipsisSx, fontFamily: 'monospace', fontSize: 13 }}>
                            {v.voucher_no}
                          </TableCell>
                          <TableCell sx={cellEllipsisSx}>{v.voucher_date}</TableCell>
                          <TableCell sx={cellEllipsisSx}>
                            <Chip
                              size="small"
                              label={statusLabel(v.status)}
                              color={STATUS_COLOR[v.status] || 'default'}
                            />
                          </TableCell>
                          <TableCell sx={cellEllipsisSx}>{v.narration || '-'}</TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {Number(v.total_debit || 0).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {voucherViewMode === 'page' && sortedVouchers.length > PAGE_SIZE ? (
                  <Box sx={mvsBodyPaginationSx}>
                    <Pagination
                      count={voucherPageCount}
                      page={voucherPage}
                      onChange={(_e, page) => setVoucherPage(page)}
                      color="primary"
                      shape="rounded"
                      siblingCount={0}
                      boundaryCount={1}
                    />
                  </Box>
                ) : null}
              </>
            )}
          </Box>
        </>
      )}

      {tab === 1 && (
        <>
          <Card elevation={0} sx={{ ...mvsBodyCardSx, mt: 2.5, mb: 0 }}>
            <Box sx={mvsBodyFilterWrapSx}>
              <Box sx={filterToolbarRowSx}>
                <Autocomplete
                  size="small"
                  options={ledgerAccounts}
                  value={
                    ledgerAccounts.find((a) => Number(a.id) === Number(ledgerAccountId)) || null
                  }
                  onChange={(_, account) => {
                    const nextId = account?.id ? Number(account.id) : '';
                    setLedgerAccountId(nextId);
                    const next = new URLSearchParams(searchParams);
                    next.set('tab', 'ledger');
                    if (nextId) {
                      next.set('accountId', String(nextId));
                      if (account?.code) next.set('code', String(account.code));
                    } else {
                      next.delete('accountId');
                      next.delete('code');
                    }
                    if (effectiveCompanyId) next.set('company_id', String(effectiveCompanyId));
                    setSearchParams(next, { replace: true });
                  }}
                  getOptionLabel={(a) => getGlAccountLabel(a, i18n.language)}
                  isOptionEqualToValue={(a, b) => Number(a.id) === Number(b.id)}
                  autoHighlight
                  openOnFocus
                  selectOnFocus
                  handleHomeEndKeys
                  clearOnBlur={false}
                  filterOptions={(options, { inputValue }) => {
                    const q = inputValue.trim();
                    if (!q) return options.slice(0, 80);
                    return options
                      .map((a) => ({ a, score: scoreAccountSearch(a, q, i18n.language) }))
                      .filter((x) => x.score > 0)
                      .sort(
                        (x, y) =>
                          y.score - x.score ||
                          String(x.a.code || '').localeCompare(String(y.a.code || ''), undefined, {
                            numeric: true,
                          })
                      )
                      .map((x) => x.a)
                      .slice(0, 50);
                  }}
                  noOptionsText={t('generalLedger.ledger.accountNoOptions')}
                  sx={{
                    flex: '1 1 220px',
                    minWidth: { xs: '100%', sm: 220 },
                    maxWidth: { md: 320 },
                  }}
                  renderOption={(props, a) => (
                    <li {...props} key={a.id}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography noWrap variant="body2" sx={{ fontWeight: 600 }}>
                          {a.code}
                        </Typography>
                        <Typography noWrap variant="caption" color="text.secondary">
                          {getGlAccountName(a, i18n.language)}
                        </Typography>
                      </Box>
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('generalLedger.ledger.account')}
                      placeholder={t('generalLedger.ledger.accountSearchPlaceholder')}
                      sx={filterFieldSx}
                      {...mvsOutlinedLabelProps}
                    />
                  )}
                />
                <TextField
                  size="small"
                  type="date"
                  label={t('generalLedger.ledger.from')}
                  value={ledgerFrom}
                  onChange={(e) => setLedgerDateCustom('from', e.target.value)}
                  sx={dateFilterFieldSx}
                  {...mvsOutlinedLabelProps}
                />
                <TextField
                  size="small"
                  type="date"
                  label={t('generalLedger.ledger.to')}
                  value={ledgerTo}
                  onChange={(e) => setLedgerDateCustom('to', e.target.value)}
                  sx={dateFilterFieldSx}
                  {...mvsOutlinedLabelProps}
                />
                <Box sx={periodToggleGroupSx}>
                  {LEDGER_PERIOD_KEYS.map((key) => {
                    const selected = ledgerPeriod === key;
                    return (
                      <Button
                        key={key}
                        size="small"
                        disableElevation
                        variant={selected ? 'contained' : 'outlined'}
                        onClick={() => applyLedgerPeriod(key)}
                        sx={{
                          ...periodBtnSx,
                          ...(selected
                            ? {
                                bgcolor: 'primary.main',
                                color: '#fff',
                                borderColor: 'primary.main',
                                '&:hover': { bgcolor: 'primary.dark' },
                              }
                            : {
                                color: 'text.secondary',
                                bgcolor: '#FFFFFF',
                              }),
                        }}
                      >
                        {t(`generalLedger.ledger.periods.${key}`)}
                      </Button>
                    );
                  })}
                </Box>
                <Button
                  variant="contained"
                  disableElevation
                  startIcon={<SearchIcon fontSize="small" />}
                  onClick={() => {
                    writeLedgerPeriodToUrl(ledgerFrom, ledgerTo);
                    void loadLedger(undefined, { from: ledgerFrom, to: ledgerTo });
                  }}
                  sx={{ ...mvsBodyPrimaryBtnSx, height: 40, whiteSpace: 'nowrap', flex: '0 0 auto' }}
                >
                  {t('generalLedger.ledger.search')}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon fontSize="small" />}
                  onClick={() => void exportLedgerExcel()}
                  disabled={ledgerExporting || !sortedLedgerEntries.length}
                  sx={{ ...mvsBodyOutlinedBtnSx, height: 40, whiteSpace: 'nowrap', flex: '0 0 auto' }}
                >
                  {t('generalLedger.ledger.excelDownload')}
                </Button>
              </Box>
            </Box>
          </Card>

          <Box sx={mvsBodyListZoneSx}>
            {!ledgerData?.account ? (
              <Box sx={listStateBoxSx}>
                <Typography variant="body2" color="text.secondary">
                  {t('generalLedger.vouchers.selectHint')}
                </Typography>
              </Box>
            ) : (
              <>
                <Box
                  sx={{
                    mb: 1.5,
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 1,
                  }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, minWidth: 0 }}>
                    {ledgerData.account.code} {getGlAccountName(ledgerData.account, i18n.language)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {t('generalLedger.ledger.balance')} {Number(ledgerData.currentBalance || 0).toLocaleString()}
                  </Typography>
                </Box>
                {!ledgerEntries.length ? (
                  <Box sx={listStateBoxSx}>
                    <Typography variant="body1" color="text.secondary">
                      {t('generalLedger.ledger.empty')}
                    </Typography>
                  </Box>
                ) : (
                  <>
                    <ListViewModeButtons
                      value={ledgerViewMode}
                      onChange={setLedgerViewMode}
                      pageLabel={t('generalLedger.listView.page')}
                      allLabel={t('generalLedger.listView.all')}
                    />
                    <TableContainer sx={{ ...mvsBodyListTableSx, ...mvsTableScrollSx }}>
                      <Table size="small" sx={tableSx}>
                        <TableHead sx={mvsTableHeadHighlightSx}>
                          <TableRow>
                            <TableCell
                              width="14%"
                              sortDirection={ledgerSortBy === 'date' ? ledgerSortDir : false}
                            >
                              <TableSortLabel
                                active={ledgerSortBy === 'date'}
                                direction={ledgerSortBy === 'date' ? ledgerSortDir : 'asc'}
                                onClick={() => handleLedgerSort('date')}
                              >
                                <Typography noWrap component="span" variant="inherit">
                                  {t('generalLedger.ledger.columns.date')}
                                </Typography>
                              </TableSortLabel>
                            </TableCell>
                            <TableCell
                              width="16%"
                              sortDirection={ledgerSortBy === 'voucher' ? ledgerSortDir : false}
                            >
                              <TableSortLabel
                                active={ledgerSortBy === 'voucher'}
                                direction={ledgerSortBy === 'voucher' ? ledgerSortDir : 'asc'}
                                onClick={() => handleLedgerSort('voucher')}
                              >
                                <Typography noWrap component="span" variant="inherit">
                                  {t('generalLedger.ledger.columns.voucher')}
                                </Typography>
                              </TableSortLabel>
                            </TableCell>
                            <TableCell
                              width="30%"
                              sortDirection={ledgerSortBy === 'narration' ? ledgerSortDir : false}
                            >
                              <TableSortLabel
                                active={ledgerSortBy === 'narration'}
                                direction={ledgerSortBy === 'narration' ? ledgerSortDir : 'asc'}
                                onClick={() => handleLedgerSort('narration')}
                              >
                                <Typography noWrap component="span" variant="inherit">
                                  {t('generalLedger.ledger.columns.narration')}
                                </Typography>
                              </TableSortLabel>
                            </TableCell>
                            <TableCell
                              width="13%"
                              align="right"
                              sortDirection={ledgerSortBy === 'debit' ? ledgerSortDir : false}
                            >
                              <TableSortLabel
                                active={ledgerSortBy === 'debit'}
                                direction={ledgerSortBy === 'debit' ? ledgerSortDir : 'asc'}
                                onClick={() => handleLedgerSort('debit')}
                                sx={{ '& .MuiTableSortLabel-icon': { ml: 0.5, mr: 0 } }}
                              >
                                <Typography noWrap component="span" variant="inherit">
                                  {t('generalLedger.ledger.columns.debit')}
                                </Typography>
                              </TableSortLabel>
                            </TableCell>
                            <TableCell
                              width="13%"
                              align="right"
                              sortDirection={ledgerSortBy === 'credit' ? ledgerSortDir : false}
                            >
                              <TableSortLabel
                                active={ledgerSortBy === 'credit'}
                                direction={ledgerSortBy === 'credit' ? ledgerSortDir : 'asc'}
                                onClick={() => handleLedgerSort('credit')}
                                sx={{ '& .MuiTableSortLabel-icon': { ml: 0.5, mr: 0 } }}
                              >
                                <Typography noWrap component="span" variant="inherit">
                                  {t('generalLedger.ledger.columns.credit')}
                                </Typography>
                              </TableSortLabel>
                            </TableCell>
                            <TableCell
                              width="14%"
                              align="right"
                              sortDirection={ledgerSortBy === 'balance' ? ledgerSortDir : false}
                            >
                              <TableSortLabel
                                active={ledgerSortBy === 'balance'}
                                direction={ledgerSortBy === 'balance' ? ledgerSortDir : 'asc'}
                                onClick={() => handleLedgerSort('balance')}
                                sx={{ '& .MuiTableSortLabel-icon': { ml: 0.5, mr: 0 } }}
                              >
                                <Typography noWrap component="span" variant="inherit">
                                  {t('generalLedger.ledger.columns.balance')}
                                </Typography>
                              </TableSortLabel>
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody sx={mvsTableBodyRowSx}>
                          {pagedLedgerEntries.map((e: any) => (
                            <TableRow
                              key={e.id}
                              hover
                              sx={{ cursor: e.voucherId ? 'pointer' : 'default' }}
                              onClick={() => {
                                if (e.voucherId) void loadVoucherDetail(e.voucherId);
                              }}
                            >
                              <TableCell sx={cellEllipsisSx}>{e.voucherDate}</TableCell>
                              <TableCell sx={{ ...cellEllipsisSx, fontFamily: 'monospace', fontSize: 12 }}>
                                {e.voucherNo}
                              </TableCell>
                              <TableCell sx={cellEllipsisSx}>{e.narration || '-'}</TableCell>
                              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                {Number(e.debit || 0).toLocaleString()}
                              </TableCell>
                              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                {Number(e.credit || 0).toLocaleString()}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                {Number(e.runningBalance || 0).toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow sx={{ bgcolor: '#F8FAFC !important' }}>
                            <TableCell colSpan={3} sx={{ fontWeight: 700 }}>
                              {t('generalLedger.ledger.total')}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                              {ledgerTotals.debit.toLocaleString()}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                              {ledgerTotals.credit.toLocaleString()}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                              {Number(ledgerData.currentBalance || 0).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                    {ledgerViewMode === 'page' && sortedLedgerEntries.length > PAGE_SIZE ? (
                      <Box sx={mvsBodyPaginationSx}>
                        <Pagination
                          count={ledgerPageCount}
                          page={ledgerPage}
                          onChange={(_e, page) => setLedgerPage(page)}
                          color="primary"
                          shape="rounded"
                          siblingCount={0}
                          boundaryCount={1}
                        />
                      </Box>
                    ) : null}
                  </>
                )}
              </>
            )}
          </Box>
        </>
      )}

      {tab === 2 && (
        <>
          <Card elevation={0} sx={{ ...mvsBodyCardSx, mt: 2.5, mb: 0 }}>
            <Box sx={mvsBodyFilterWrapSx}>
              <Box sx={filterToolbarRowSx}>
                <TextField
                  size="small"
                  type="date"
                  label={t('generalLedger.ledger.from')}
                  value={trialFrom}
                  onChange={(e) => setTrialDateCustom('from', e.target.value)}
                  sx={dateFilterFieldSx}
                  {...mvsOutlinedLabelProps}
                />
                <TextField
                  size="small"
                  type="date"
                  label={t('generalLedger.ledger.to')}
                  value={trialTo}
                  onChange={(e) => setTrialDateCustom('to', e.target.value)}
                  sx={dateFilterFieldSx}
                  {...mvsOutlinedLabelProps}
                />
                <Box sx={periodToggleGroupSx}>
                  {LEDGER_PERIOD_KEYS.map((key) => {
                    const selected = trialPeriod === key;
                    return (
                      <Button
                        key={key}
                        size="small"
                        disableElevation
                        variant={selected ? 'contained' : 'outlined'}
                        onClick={() => applyTrialPeriod(key)}
                        sx={{
                          ...periodBtnSx,
                          ...(selected
                            ? {
                                bgcolor: 'primary.main',
                                color: '#fff',
                                borderColor: 'primary.main',
                                '&:hover': { bgcolor: 'primary.dark' },
                              }
                            : {
                                color: 'text.secondary',
                                bgcolor: '#FFFFFF',
                              }),
                        }}
                      >
                        {t(`generalLedger.ledger.periods.${key}`)}
                      </Button>
                    );
                  })}
                </Box>
                <TextField
                  size="small"
                  label={t('common.search')}
                  placeholder={t('generalLedger.trial.searchPlaceholder')}
                  value={trialSearch}
                  onChange={(e) => setTrialSearch(e.target.value)}
                  sx={{
                    ...filterFieldSx,
                    flex: '1 1 200px',
                    minWidth: { xs: '100%', sm: 180 },
                    maxWidth: { md: 280 },
                  }}
                  {...mvsOutlinedLabelProps}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ fontSize: '1.125rem', color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  }}
                />
                <Button
                  variant="contained"
                  disableElevation
                  startIcon={<SearchIcon fontSize="small" />}
                  onClick={() => void loadTrial({ from: trialFrom, to: trialTo })}
                  sx={{ ...mvsBodyPrimaryBtnSx, height: 40, whiteSpace: 'nowrap', flex: '0 0 auto' }}
                >
                  {t('generalLedger.ledger.search')}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon fontSize="small" />}
                  onClick={() => void exportTrialExcel()}
                  disabled={trialExporting || !sortedTrialRows.length}
                  sx={{ ...mvsBodyOutlinedBtnSx, height: 40, whiteSpace: 'nowrap', flex: '0 0 auto' }}
                >
                  {t('generalLedger.trial.excelDownload')}
                </Button>
              </Box>
            </Box>
          </Card>

          <Box sx={mvsBodyListZoneSx}>
            {!(trialData?.rows || []).length ? (
              <Box sx={listStateBoxSx}>
                <Typography variant="body1" color="text.secondary">
                  {t('generalLedger.trial.empty')}
                </Typography>
              </Box>
            ) : !filteredTrialRows.length ? (
              <Box sx={listStateBoxSx}>
                <Typography variant="body1" color="text.secondary">
                  {t('generalLedger.trial.emptySearch')}
                </Typography>
              </Box>
            ) : (
              <>
                <ListViewModeButtons
                  value={trialViewMode}
                  onChange={setTrialViewMode}
                  pageLabel={t('generalLedger.listView.page')}
                  allLabel={t('generalLedger.listView.all')}
                />
                <TableContainer sx={{ ...mvsBodyListTableSx, ...mvsTableScrollSx }}>
                <Table size="small" sx={tableSx}>
                  <TableHead sx={mvsTableHeadHighlightSx}>
                    <TableRow>
                      <TableCell width="16%" sortDirection={trialSortBy === 'code' ? trialSortDir : false}>
                        <TableSortLabel
                          active={trialSortBy === 'code'}
                          direction={trialSortBy === 'code' ? trialSortDir : 'asc'}
                          onClick={() => handleTrialSort('code')}
                        >
                          {t('generalLedger.trial.columns.code')}
                        </TableSortLabel>
                      </TableCell>
                      <TableCell width="36%" sortDirection={trialSortBy === 'name' ? trialSortDir : false}>
                        <TableSortLabel
                          active={trialSortBy === 'name'}
                          direction={trialSortBy === 'name' ? trialSortDir : 'asc'}
                          onClick={() => handleTrialSort('name')}
                        >
                          {t('generalLedger.trial.columns.account')}
                        </TableSortLabel>
                      </TableCell>
                      <TableCell
                        width="16%"
                        align="right"
                        sortDirection={trialSortBy === 'debit' ? trialSortDir : false}
                      >
                        <TableSortLabel
                          active={trialSortBy === 'debit'}
                          direction={trialSortBy === 'debit' ? trialSortDir : 'asc'}
                          onClick={() => handleTrialSort('debit')}
                          sx={{ '& .MuiTableSortLabel-icon': { ml: 0.5, mr: 0 } }}
                        >
                          {t('generalLedger.trial.columns.debit')}
                        </TableSortLabel>
                      </TableCell>
                      <TableCell
                        width="16%"
                        align="right"
                        sortDirection={trialSortBy === 'credit' ? trialSortDir : false}
                      >
                        <TableSortLabel
                          active={trialSortBy === 'credit'}
                          direction={trialSortBy === 'credit' ? trialSortDir : 'asc'}
                          onClick={() => handleTrialSort('credit')}
                          sx={{ '& .MuiTableSortLabel-icon': { ml: 0.5, mr: 0 } }}
                        >
                          {t('generalLedger.trial.columns.credit')}
                        </TableSortLabel>
                      </TableCell>
                      <TableCell
                        width="16%"
                        align="right"
                        sortDirection={trialSortBy === 'balance' ? trialSortDir : false}
                      >
                        <TableSortLabel
                          active={trialSortBy === 'balance'}
                          direction={trialSortBy === 'balance' ? trialSortDir : 'asc'}
                          onClick={() => handleTrialSort('balance')}
                          sx={{ '& .MuiTableSortLabel-icon': { ml: 0.5, mr: 0 } }}
                        >
                          {t('generalLedger.trial.columns.balance')}
                        </TableSortLabel>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody sx={mvsTableBodyRowSx}>
                    {pagedTrialRows.map((r: any) => (
                      <TableRow
                        key={r.accountId}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => openLedgerForAccount(r.accountId)}
                      >
                        <TableCell sx={cellEllipsisSx}>{r.code}</TableCell>
                        <TableCell sx={cellEllipsisSx}>{resolveAccountName(r.accountId, r.name)}</TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {Number(r.debit || 0).toLocaleString()}
                        </TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {Number(r.credit || 0).toLocaleString()}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {Number(r.balance || 0).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ bgcolor: '#F8FAFC !important' }}>
                      <TableCell colSpan={2} sx={{ fontWeight: 700 }}>
                        {t('generalLedger.trial.total')}
                        {trialSearch.trim()
                          ? ` (${t('generalLedger.trial.filteredCount', { count: sortedTrialRows.length })})`
                          : ''}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {filteredTrialTotals.debit.toLocaleString()}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {filteredTrialTotals.credit.toLocaleString()}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
                {trialViewMode === 'page' && sortedTrialRows.length > PAGE_SIZE ? (
                  <Box sx={mvsBodyPaginationSx}>
                    <Pagination
                      count={trialPageCount}
                      page={trialPage}
                      onChange={(_e, page) => setTrialPage(page)}
                      color="primary"
                      shape="rounded"
                      siblingCount={0}
                      boundaryCount={1}
                    />
                  </Box>
                ) : null}
              </>
            )}
          </Box>
        </>
      )}

      {tab === 3 && (
        <>
          <Box sx={mvsBodyListZoneSx}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'stretch', sm: 'flex-end' },
                justifyContent: 'space-between',
                gap: 2,
                mb: 1.5,
              }}
            >
              <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600, flexShrink: 0 }}>
                {t('generalLedger.accounts.listTitle')} (
                {t('generalLedger.accounts.ledgerCount', {
                  count: filteredLedgerAccounts.length,
                })}
                )
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' },
                  gap: 1.5,
                  alignItems: 'flex-end',
                  width: { xs: '100%', sm: 'min(100%, 420px)' },
                }}
              >
                <TextField
                  fullWidth
                  size="small"
                  label={t('common.search')}
                  placeholder={t('generalLedger.accounts.searchPlaceholder')}
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                  sx={filterFieldSx}
                  {...mvsOutlinedLabelProps}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ fontSize: '1.125rem', color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  }}
                />
                <Button
                  variant="outlined"
                  startIcon={<ResetIcon fontSize="small" />}
                  onClick={() => setAccountSearch('')}
                  disabled={!accountSearch.trim()}
                  sx={{ ...mvsBodyOutlinedBtnSx, height: 40, whiteSpace: 'nowrap' }}
                >
                  {t('common.reset')}
                </Button>
              </Box>
            </Box>
            {!filteredLedgerAccounts.length ? (
              <Box sx={listStateBoxSx}>
                <Typography variant="body1" color="text.secondary">
                  {accountSearch.trim()
                    ? t('generalLedger.accounts.emptySearch')
                    : t('generalLedger.accounts.empty')}
                </Typography>
              </Box>
            ) : (
              <>
                <ListViewModeButtons
                  value={accountViewMode}
                  onChange={setAccountViewMode}
                  pageLabel={t('generalLedger.listView.page')}
                  allLabel={t('generalLedger.listView.all')}
                />
                <TableContainer
                  sx={{
                    ...mvsBodyListTableSx,
                    ...mvsTableScrollSx,
                    ...(accountViewMode === 'page'
                      ? { maxHeight: { xs: '50vh', md: 560 } }
                      : { maxHeight: 'none' }),
                  }}
                >
                <Table size="small" stickyHeader={accountViewMode === 'page'} sx={tableSx}>
                  <TableHead sx={mvsTableHeadHighlightSx}>
                    <TableRow>
                      <TableCell width="20%" sortDirection={accountSortBy === 'code' ? accountSortDir : false}>
                        <TableSortLabel
                          active={accountSortBy === 'code'}
                          direction={accountSortBy === 'code' ? accountSortDir : 'asc'}
                          onClick={() => handleAccountSort('code')}
                        >
                          {t('generalLedger.trial.columns.code')}
                        </TableSortLabel>
                      </TableCell>
                      <TableCell width="55%" sortDirection={accountSortBy === 'name' ? accountSortDir : false}>
                        <TableSortLabel
                          active={accountSortBy === 'name'}
                          direction={accountSortBy === 'name' ? accountSortDir : 'asc'}
                          onClick={() => handleAccountSort('name')}
                        >
                          {t('generalLedger.trial.columns.account')}
                        </TableSortLabel>
                      </TableCell>
                      <TableCell
                        width="25%"
                        align="right"
                        sortDirection={accountSortBy === 'balance' ? accountSortDir : false}
                      >
                        <TableSortLabel
                          active={accountSortBy === 'balance'}
                          direction={accountSortBy === 'balance' ? accountSortDir : 'asc'}
                          onClick={() => handleAccountSort('balance')}
                          sx={{
                            '& .MuiTableSortLabel-icon': {
                              marginLeft: 0.5,
                              marginRight: 0,
                            },
                          }}
                        >
                          {t('generalLedger.trial.columns.balance')}
                        </TableSortLabel>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody sx={mvsTableBodyRowSx}>
                    {pagedLedgerAccounts.map((a) => (
                      <TableRow
                        key={a.id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => openLedgerForAccount(a.id)}
                      >
                        <TableCell sx={cellEllipsisSx}>{a.code}</TableCell>
                        <TableCell sx={cellEllipsisSx}>{getGlAccountName(a, i18n.language)}</TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {Number(a.current_balance || 0).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
                {accountViewMode === 'page' && sortedLedgerAccounts.length > PAGE_SIZE ? (
                  <Box sx={mvsBodyPaginationSx}>
                    <Pagination
                      count={accountPageCount}
                      page={accountPage}
                      onChange={(_e, page) => setAccountPage(page)}
                      color="primary"
                      shape="rounded"
                      siblingCount={0}
                      boundaryCount={1}
                    />
                  </Box>
                ) : null}
              </>
            )}
          </Box>
        </>
      )}

      <Dialog
        open={detailOpen}
        onClose={closeVoucherDetail}
        maxWidth="md"
        fullWidth
        scroll="paper"
        slotProps={{
          backdrop: { sx: { backgroundColor: 'rgba(15, 23, 42, 0.35)' } },
        }}
        PaperProps={{ sx: getMvsDialogPaperSx(theme) }}
      >
        <DialogTitle sx={{ ...getMvsDialogTitleRowSx(theme), pr: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
              {t('generalLedger.vouchers.detailTitle')}
            </Typography>
            {selectedVoucher && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {selectedVoucher.voucher_no}
              </Typography>
            )}
          </Box>
          <IconButton aria-label={t('common.close')} onClick={closeVoucherDetail} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ px: 2.5, py: 2 }}>
          {detailLoading || !selectedVoucher ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={36} />
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gap: 1.5 }}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip label={selectedVoucher.voucher_no} size="small" />
                <Chip label={selectedVoucher.voucher_date} size="small" variant="outlined" />
                <Chip
                  label={statusLabel(selectedVoucher.status)}
                  size="small"
                  color={STATUS_COLOR[selectedVoucher.status]}
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                {selectedVoucher.narration || '-'}
              </Typography>
              <VoucherLinesEditor
                readOnly
                lines={(selectedVoucher.lines || []).map((l: any) => ({
                  lineNo: l.line_no,
                  accountId: l.account_id,
                  accountName: l.account_name,
                  debit: Number(l.debit),
                  credit: Number(l.credit),
                }))}
                accounts={accounts}
                onChange={() => undefined}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={getMvsDialogActionsSx(theme)}>
          <Button onClick={closeVoucherDetail} sx={mvsBodyOutlinedBtnSx}>
            {t('common.close')}
          </Button>
          {postAllowed && selectedVoucher?.status === 'draft' && (
            <Button
              variant="contained"
              disableElevation
              onClick={() => void postSelected()}
              sx={mvsBodyPrimaryBtnSx}
            >
              {t('generalLedger.vouchers.postToLedger')}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={dialogState.open}
        title={dialogState.title}
        titleKey={dialogState.titleKey}
        message={dialogState.message}
        messageKey={dialogState.messageKey}
        confirmText={dialogState.confirmText}
        confirmTextKey={dialogState.confirmTextKey}
        cancelText={dialogState.cancelText}
        cancelTextKey={dialogState.cancelTextKey}
        confirmColor={dialogState.confirmColor}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      <Snackbar open={Boolean(error)} autoHideDuration={5000} onClose={() => setError('')}>
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      </Snackbar>
      <Snackbar open={Boolean(success)} autoHideDuration={3000} onClose={() => setSuccess('')}>
        <Alert severity="success" onClose={() => setSuccess('')}>
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default GeneralLedger;
