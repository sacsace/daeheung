import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  Pagination,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  MenuBook as BooksIcon,
  RestartAlt as ResetIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import AccountingCompanyBar from '../../components/Accounting/AccountingCompanyBar';
import { useAccountingCompany } from '../../hooks/useAccountingCompany';
import { accountingService } from '../../services/api';
import {
  mvsBodyCardSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPaginationSx,
  mvsBodyPrimaryBtnSx,
  mvsPageRootSx,
  mvsTableHeadHighlightSx,
} from '../../theme/daeheungLayout';

const ROWS_PER_PAGE = 15;
/** Keep in sync with server default `TALLY_IMPORT_MAX_MB` (2048 = 2GB) */
const TALLY_IMPORT_MAX_BYTES = 2048 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = ['xml', 'json', 'txt'];
const wizardTableSx = {
  border: '1px solid #B4B4B4',
  '& .MuiTableCell-root': { borderColor: '#B4B4B4' },
} as const;

const cellEllipsisSx = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: 0,
} as const;

type PreviewData = {
  format: string;
  fileName?: string;
  ledgers: Array<{ name: string; parent?: string; openingBalance?: number }>;
  vouchers: Array<{
    date: string;
    voucherType: string;
    voucherNumber: string;
    narration?: string;
    lineCount: number;
    totalDebit: number;
    totalCredit: number;
  }>;
  totals: { ledgers: number; vouchers: number };
};

type ImportResult = {
  dryRun: boolean;
  format: string;
  batchId?: number | null;
  parsed: { ledgers: number; vouchers: number };
  ledgers: { matched: number; created: number; skipped: number };
  vouchers: { created: number; skipped: number; failed: number };
  issues: Array<{ level: string; message: string; context?: string }>;
  createdVoucherIds: number[];
  createdAccountCodes: string[];
};

type ReconciliationData = {
  status: 'PASS' | 'FAIL';
  scope: string;
  note: string;
  checks: {
    voucherCount: { status: string; source: number; mvs: number };
    debitTotal: { status: string; source: string; mvs: string; difference: string };
    creditTotal: { status: string; source: string; mvs: string; difference: string };
    ledgerMovements: { status: string; differenceCount: number };
  };
};

type ReportIssueSource = 'preview' | 'dryRun' | 'import';

type ReportIssue = {
  level: string;
  message: string;
  context?: string;
  source: ReportIssueSource;
  at: string;
};

type IssueLevelFilter = 'all' | 'error' | 'warn' | 'info';

const ISSUE_LEVEL_ORDER: Record<string, number> = { error: 0, warn: 1, info: 2 };

const renderEllipsis = (text: string) => (
  <Tooltip title={text} placement="top-start" enterDelay={400}>
    <Box
      component="span"
      sx={{
        display: 'block',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </Box>
  </Tooltip>
);

const IssueLevelChip: React.FC<{ level: string; label: string }> = ({ level, label }) => {
  const color =
    level === 'error' ? 'error' : level === 'warn' ? 'warning' : level === 'info' ? 'info' : 'default';
  return (
    <Chip
      size="small"
      label={label}
      color={color}
      variant="outlined"
      sx={{ height: 22, fontWeight: 600, fontSize: '0.7rem' }}
    />
  );
};

const TallyImport: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const {
    canSelectCompany,
    companies,
    selectedCompanyId,
    effectiveCompanyId,
    selectedCompanyName,
    changeCompany,
  } = useAccountingCompany();

  const [file, setFile] = useState<File | null>(null);
  const [importLedgers, setImportLedgers] = useState(true);
  const [importVouchers, setImportVouchers] = useState(true);
  const [createMissingLedgers, setCreateMissingLedgers] = useState(true);
  const [createMissingParties, setCreateMissingParties] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [reconciliation, setReconciliation] = useState<ReconciliationData | null>(null);
  const [reportIssues, setReportIssues] = useState<ReportIssue[]>([]);
  const [previewPage, setPreviewPage] = useState(1);
  const [issuesPage, setIssuesPage] = useState(1);
  const [issueLevelFilter, setIssueLevelFilter] = useState<IssueLevelFilter>('all');

  const wizardSteps = useMemo(
    () => [
      t('tallyImport.wizard.upload'),
      t('tallyImport.wizard.inspect'),
      t('tallyImport.wizard.mapping'),
      t('tallyImport.wizard.review'),
      t('tallyImport.wizard.preview'),
      t('tallyImport.wizard.complete'),
    ],
    [t]
  );

  const booksHref = effectiveCompanyId
    ? `/accounting/books?tab=vouchers&company_id=${effectiveCompanyId}`
    : '/accounting/books?tab=vouchers';

  const previewRows = preview?.vouchers || [];
  const previewPageCount = Math.max(1, Math.ceil(previewRows.length / ROWS_PER_PAGE));
  const pagedPreview = previewRows.slice((previewPage - 1) * ROWS_PER_PAGE, previewPage * ROWS_PER_PAGE);

  const issueCounts = useMemo(() => {
    const all = reportIssues;
    return {
      all: all.length,
      error: all.filter((i) => i.level === 'error').length,
      warn: all.filter((i) => i.level === 'warn').length,
      info: all.filter((i) => i.level === 'info').length,
    };
  }, [reportIssues]);

  const issueRows = useMemo(() => {
    const all = [...reportIssues];
    all.sort((a, b) => {
      const levelDiff = (ISSUE_LEVEL_ORDER[a.level] ?? 9) - (ISSUE_LEVEL_ORDER[b.level] ?? 9);
      if (levelDiff !== 0) return levelDiff;
      return String(a.at).localeCompare(String(b.at));
    });
    if (issueLevelFilter === 'all') return all;
    return all.filter((i) => i.level === issueLevelFilter);
  }, [reportIssues, issueLevelFilter]);

  const issuesPageCount = Math.max(1, Math.ceil(issueRows.length / ROWS_PER_PAGE));
  const pagedIssues = issueRows.slice((issuesPage - 1) * ROWS_PER_PAGE, issuesPage * ROWS_PER_PAGE);

  const issueLevelLabel = (level: string) => {
    if (level === 'error') return t('tallyImport.issueLevel.error');
    if (level === 'warn') return t('tallyImport.issueLevel.warn');
    if (level === 'info') return t('tallyImport.issueLevel.info');
    return level;
  };

  const issueSourceLabel = (source: ReportIssueSource) => {
    if (source === 'preview') return t('tallyImport.reportSource.preview');
    if (source === 'dryRun') return t('tallyImport.reportSource.dryRun');
    return t('tallyImport.reportSource.import');
  };

  const appendReportIssues = (
    source: ReportIssueSource,
    issues: Array<{ level: string; message: string; context?: string }> | undefined,
    opts?: { switchToReport?: boolean }
  ) => {
    const at = new Date().toISOString();
    const rows = (issues || []).map((issue) => ({
      level: issue.level || 'info',
      message: issue.message || '',
      context: issue.context,
      source,
      at,
    }));
    if (!rows.length) return;
    setReportIssues((prev) => [...prev, ...rows]);
    setIssuesPage(1);
    if (opts?.switchToReport !== false) {
      const failed = rows.some((r) => r.level === 'error');
      setIssueLevelFilter(failed ? 'error' : 'all');
    }
  };

  const clearSessionResults = () => {
    setPreview(null);
    setResult(null);
    setReconciliation(null);
    setReportIssues([]);
    setPreviewPage(1);
    setIssuesPage(1);
    setIssueLevelFilter('all');
  };

  const handleDownloadImportLog = async () => {
    if (reportIssues.length === 0) {
      setError(t('tallyImport.errors.noLogToDownload'));
      return;
    }

    try {
      const stamp = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const fileStamp = `${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}`;

      const ExcelJS = (await import('exceljs')).default;
      const { addSheetFromAoA, downloadExcelWorkbook } = await import('../../utils/excelExportStyle');
      const {
        tallyIssueLevelToEn,
        tallyIssueMessageToEn,
        tallyIssueContextToEn,
      } = await import('../../utils/tallyImportLogEn');

      const workbook = new ExcelJS.Workbook();
      const header = ['Level', 'Source', 'Time', 'Message', 'Reason / Detail'];

      const toEnRows = (issues: ReportIssue[]) =>
        issues.map((issue) => [
          tallyIssueLevelToEn(issue.level),
          issue.source,
          issue.at,
          tallyIssueMessageToEn(issue.message),
          tallyIssueContextToEn(issue.context),
        ]);

      const failed = reportIssues.filter((i) => i.level === 'error');
      const warnings = reportIssues.filter((i) => i.level === 'warn');
      const infos = reportIssues.filter((i) => i.level === 'info');

      addSheetFromAoA(workbook, 'Summary', [
        ['Tally Import Report'],
        result
          ? [
              `Accounts matched ${result.ledgers.matched} · Accounts created ${result.ledgers.created} · Vouchers created ${result.vouchers.created} · Skipped ${result.vouchers.skipped} · Failed ${result.vouchers.failed}`,
            ]
          : ['No import result summary (preview / accumulated issues only)'],
        [`Failed ${failed.length} · Warning ${warnings.length} · Info ${infos.length} · Total ${reportIssues.length}`],
        ...(file?.name ? [[`File: ${file.name}`]] : []),
        [],
        ['Sheet', 'Rows'],
        ['All', String(reportIssues.length)],
        ['Failed', String(failed.length)],
        ['Warnings', String(warnings.length)],
        ['Info', String(infos.length)],
      ]);
      addSheetFromAoA(workbook, 'All', [header, ...toEnRows(reportIssues)]);
      addSheetFromAoA(workbook, 'Failed', [header, ...toEnRows(failed)]);
      addSheetFromAoA(workbook, 'Warnings', [header, ...toEnRows(warnings)]);
      addSheetFromAoA(workbook, 'Info', [header, ...toEnRows(infos)]);

      await downloadExcelWorkbook(workbook, `Tally_Import_Report_${fileStamp}.xlsx`);
      setSuccess(t('tallyImport.success.logDownloaded'));
    } catch (err: any) {
      setError(err?.message || t('tallyImport.errors.import'));
    }
  };

  const handleReset = () => {
    setFile(null);
    setImportLedgers(true);
    setImportVouchers(true);
    setCreateMissingLedgers(true);
    setCreateMissingParties(true);
    clearSessionResults();
    if (fileRef.current) fileRef.current.value = '';
  };

  const chooseFile = (selected: File | undefined) => {
    setError('');
    clearSessionResults();
    if (!selected) return;
    const extension = selected.name.split('.').pop()?.toLowerCase() || '';
    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      setError(t('tallyImport.errors.unsupportedFormat'));
      return;
    }
    if (selected.size > TALLY_IMPORT_MAX_BYTES) {
      setError(t('tallyImport.errors.fileTooLarge'));
      return;
    }
    setFile(selected);
  };

  const buildFormData = (dryRun?: boolean) => {
    if (!file) throw new Error(t('tallyImport.errors.noFile'));
    const fd = new FormData();
    fd.append('file', file);
    fd.append('importLedgers', String(importLedgers));
    fd.append('importVouchers', String(importVouchers));
    fd.append('createMissingLedgers', String(createMissingLedgers));
    fd.append('createMissingParties', String(createMissingParties));
    if (dryRun != null) fd.append('dryRun', String(dryRun));
    return fd;
  };

  const handlePreview = async () => {
    if (!effectiveCompanyId) {
      setError(t('tallyImport.errors.noCompany'));
      return;
    }
    if (file && file.size > TALLY_IMPORT_MAX_BYTES) {
      setError(t('tallyImport.errors.fileTooLarge'));
      return;
    }
    try {
      setLoading(true);
      setError('');
      setResult(null);
      const fd = buildFormData();
      const res = await accountingService.previewTallyImport(fd, effectiveCompanyId);
      setPreview(res?.data || null);
      setPreviewPage(1);
      const data = res?.data;
      appendReportIssues(
        'preview',
        [
          {
            level: 'info',
            message: t('tallyImport.success.preview'),
            context: data
              ? `ledgers=${data.totals?.ledgers ?? 0}, vouchers=${data.totals?.vouchers ?? 0}, format=${data.format || '-'}`
              : undefined,
          },
        ],
        { switchToReport: false }
      );
      setSuccess(t('tallyImport.success.preview'));
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || t('tallyImport.errors.preview');
      appendReportIssues('preview', [{ level: 'error', message }]);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (dryRun: boolean) => {
    if (!effectiveCompanyId) {
      setError(t('tallyImport.errors.noCompany'));
      return;
    }
    if (file && file.size > TALLY_IMPORT_MAX_BYTES) {
      setError(t('tallyImport.errors.fileTooLarge'));
      return;
    }
    try {
      setLoading(true);
      setError('');
      const fd = buildFormData(dryRun);
      const res = await accountingService.importTallyExport(fd, effectiveCompanyId);
      const importResult = res?.data || null;
      setResult(importResult);
      setReconciliation(null);
      appendReportIssues(dryRun ? 'dryRun' : 'import', importResult?.issues || []);
      setSuccess(res?.message || (dryRun ? t('tallyImport.success.dryRun') : t('tallyImport.success.import')));
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || t('tallyImport.errors.import');
      appendReportIssues(dryRun ? 'dryRun' : 'import', [{ level: 'error', message }]);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleReconciliation = async () => {
    if (!effectiveCompanyId || !result?.batchId) return;
    try {
      setLoading(true);
      setError('');
      const res = await accountingService.getTallyImportReconciliation(result.batchId, effectiveCompanyId);
      setReconciliation(res?.data || null);
      setSuccess(t('tallyImport.success.reconciliation'));
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || t('tallyImport.errors.reconciliation'));
    } finally {
      setLoading(false);
    }
  };

  const activeStep = result && !result.dryRun
    ? 5
    : result?.dryRun || (preview && reportIssues.some((issue) => issue.source === 'dryRun'))
      ? 3
      : preview
        ? 2
        : 0;

  const reviewIssueRows = reportIssues.filter((issue) => issue.source !== 'preview' || issue.level !== 'info');
  const errorCount = reviewIssueRows.filter((issue) => issue.level === 'error').length;
  const warnCount = reviewIssueRows.filter((issue) => issue.level === 'warn').length;

  return (
    <Box sx={mvsPageRootSx}>
      <DaeheungPageHeader title={t('tallyImport.title')} description={t('tallyImport.description')} />

      <AccountingCompanyBar
        canSelectCompany={canSelectCompany}
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        selectedCompanyName={selectedCompanyName}
        onChangeCompany={changeCompany}
      />

      <Paper elevation={0} sx={{ ...mvsBodyCardSx, p: { xs: 1.25, sm: 2 }, mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'stretch', minWidth: 0, overflowX: 'auto' }}>
          {wizardSteps.map((label, index) => {
            const current = index === activeStep;
            const completed = index < activeStep;
            return (
              <Box
                key={label}
                sx={{
                  minWidth: { xs: 116, sm: 138 },
                  flex: 1,
                  px: 1,
                  py: 0.75,
                  border: '1px solid',
                  borderColor: current ? 'primary.main' : completed ? '#70AD47' : '#B4B4B4',
                  borderLeftWidth: index === 0 ? 1 : 0,
                  bgcolor: current ? '#C6EFCE' : '#FFFFFF',
                  color: current ? 'text.primary' : 'text.secondary',
                  fontSize: '0.75rem',
                  fontWeight: current ? 700 : 500,
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                }}
              >
                {completed ? <CheckCircleIcon sx={{ fontSize: 15, mr: 0.45, verticalAlign: 'text-bottom' }} /> : null}
                {index + 1}. {label}
              </Box>
            );
          })}
        </Box>
      </Paper>

      <Paper elevation={0} sx={{ ...mvsBodyCardSx, p: { xs: 1.5, sm: 2 }, borderRadius: 0 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.35 }}>
          {t('tallyImport.steps.uploadTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t('tallyImport.steps.uploadHint')}
        </Typography>
        {error ? <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert> : null}
        <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
          <Button variant="outlined" startIcon={<UploadIcon />} onClick={() => fileRef.current?.click()}>
            {t('tallyImport.selectFile')}
          </Button>
          <input
            ref={fileRef}
            hidden
            type="file"
            accept=".xml,.json,.txt,application/xml,text/xml,application/json"
            onChange={(event) => chooseFile(event.target.files?.[0])}
          />
          <Typography variant="body2" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {file ? `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)` : t('tallyImport.noFile')}
          </Typography>
          <Button variant="outlined" startIcon={<ResetIcon fontSize="small" />} onClick={handleReset} sx={{ ...mvsBodyOutlinedBtnSx }}>
            {t('common.reset')}
          </Button>
          <Button
            variant="contained"
            disableElevation
            sx={{ ...mvsBodyPrimaryBtnSx, ml: { xs: 0, sm: 'auto' } }}
            onClick={() => void handlePreview()}
            disabled={!file || loading || !effectiveCompanyId}
          >
            {loading && !preview ? <CircularProgress size={18} color="inherit" /> : t('tallyImport.steps.inspectButton')}
          </Button>
        </Box>
      </Paper>

      {preview ? (
        <Paper elevation={0} sx={{ ...mvsBodyCardSx, mt: 1.5, p: { xs: 1.5, sm: 2 }, borderRadius: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
            {t('tallyImport.steps.inspectTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
            {preview.fileName || file?.name} · {String(preview.format || '-').toUpperCase()} · Ledger {preview.totals.ledgers} · Voucher {preview.totals.vouchers}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1, mb: 1.5 }}>
            {[
              [t('tallyImport.kpi.format'), String(preview.format || '-').toUpperCase()],
              [t('tallyImport.kpi.parsedLedgers'), preview.totals.ledgers],
              [t('tallyImport.kpi.parsedVouchers'), preview.totals.vouchers],
              [t('tallyImport.kpi.file'), file?.name || '-'],
            ].map(([label, value]) => (
              <Box key={String(label)} sx={{ border: '1px solid #B4B4B4', px: 1, py: 0.75, bgcolor: '#FFFFFF' }}>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</Typography>
              </Box>
            ))}
          </Box>
          {preview.ledgers.length > 0 ? (
            <Table size="small" sx={wizardTableSx}>
              <TableHead sx={mvsTableHeadHighlightSx}>
                <TableRow>
                  <TableCell width={60}>{t('tallyImport.columns.order')}</TableCell>
                  <TableCell>{t('tallyImport.columns.ledgerName')}</TableCell>
                  <TableCell>{t('tallyImport.columns.parent')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {preview.ledgers.slice(0, 20).map((ledger, index) => (
                  <TableRow key={`${ledger.name}-${index}`}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{ledger.name}</TableCell>
                    <TableCell>{ledger.parent || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Alert severity="info">{t('tallyImport.emptyLedgers')}</Alert>
          )}

          <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 2.5, mb: 0.5 }}>
            {t('tallyImport.steps.mappingTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
            {t('tallyImport.steps.mappingHint')}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 0.5, sm: 1.5 }, alignItems: 'center', mb: 1.5 }}>
            <FormControlLabel control={<Checkbox checked={importLedgers} onChange={(e) => setImportLedgers(e.target.checked)} size="small" />} label={<Typography variant="body2">{t('tallyImport.options.importLedgers')}</Typography>} />
            <FormControlLabel control={<Checkbox checked={importVouchers} onChange={(e) => setImportVouchers(e.target.checked)} size="small" />} label={<Typography variant="body2">{t('tallyImport.options.importVouchers')}</Typography>} />
            <FormControlLabel control={<Checkbox checked={createMissingLedgers} onChange={(e) => setCreateMissingLedgers(e.target.checked)} size="small" />} label={<Typography variant="body2">{t('tallyImport.options.createMissing')}</Typography>} />
            <FormControlLabel control={<Checkbox checked={createMissingParties} onChange={(e) => setCreateMissingParties(e.target.checked)} size="small" />} label={<Typography variant="body2">{t('tallyImport.options.createParties')}</Typography>} />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            {t('tallyImport.hint')}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" disableElevation sx={mvsBodyPrimaryBtnSx} onClick={() => void handleImport(true)} disabled={loading}>
              {loading && !result ? <CircularProgress size={18} color="inherit" /> : t('tallyImport.steps.reviewButton')}
            </Button>
          </Box>
        </Paper>
      ) : null}

      {result?.dryRun || result && !result.dryRun || reportIssues.some((issue) => issue.source === 'dryRun' || issue.source === 'import') ? (
        <Paper elevation={0} sx={{ ...mvsBodyCardSx, mt: 1.5, p: { xs: 1.5, sm: 2 }, borderRadius: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            {t('tallyImport.steps.reviewTitle')}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' }, gap: 1, mb: 1.5 }}>
            {[
              [t('tallyImport.kpi.parsedLedgers'), preview?.totals.ledgers ?? result?.parsed.ledgers ?? 0],
              [t('tallyImport.kpi.parsedVouchers'), preview?.totals.vouchers ?? result?.parsed.vouchers ?? 0],
              [t('tallyImport.issueLevel.error'), errorCount],
              [t('tallyImport.issueLevel.warn'), warnCount],
              [t('tallyImport.logFilter.all'), reviewIssueRows.length],
            ].map(([label, value]) => (
              <Box key={String(label)} sx={{ border: '1px solid #B4B4B4', px: 1, py: 0.75, bgcolor: '#FFFFFF' }}>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Typography variant="body1" sx={{ fontWeight: 700 }}>{value}</Typography>
              </Box>
            ))}
          </Box>
          {reviewIssueRows.length === 0 ? (
            <Alert severity="success">{t('tallyImport.steps.reviewClean')}</Alert>
          ) : (
            <>
              <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={{ mb: 1.25, alignItems: 'center', justifyContent: 'space-between' }}>
                <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={{ alignItems: 'center' }}>
                  {(['all', 'error', 'warn', 'info'] as const).map((key) => (
                    <Button
                      key={key}
                      size="small"
                      variant={issueLevelFilter === key ? 'contained' : 'outlined'}
                      disabled={key !== 'all' && issueCounts[key] === 0}
                      onClick={() => { setIssueLevelFilter(key); setIssuesPage(1); }}
                      sx={{ ...mvsBodyOutlinedBtnSx, minWidth: 0, px: 1.25, ...(issueLevelFilter === key ? { boxShadow: 'none', color: '#fff' } : {}) }}
                    >
                      {t(`tallyImport.logFilter.${key}`)} ({issueCounts[key]})
                    </Button>
                  ))}
                </Stack>
                <Button size="small" variant="outlined" startIcon={<DownloadIcon fontSize="small" />} disabled={reportIssues.length === 0} onClick={() => void handleDownloadImportLog()} sx={mvsBodyOutlinedBtnSx}>
                  {t('tallyImport.downloadLog')}
                </Button>
              </Stack>
              <Table size="small" sx={wizardTableSx}>
                <TableHead sx={mvsTableHeadHighlightSx}>
                  <TableRow>
                    <TableCell width={95}>{t('tallyImport.columns.level')}</TableCell>
                    <TableCell width={95}>{t('tallyImport.columns.source')}</TableCell>
                    <TableCell>{t('tallyImport.columns.message')}</TableCell>
                    <TableCell>{t('tallyImport.columns.context')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedIssues.map((issue, idx) => (
                    <TableRow key={`${issue.source}-${issue.level}-${idx}`}>
                      <TableCell><IssueLevelChip level={issue.level} label={issueLevelLabel(issue.level)} /></TableCell>
                      <TableCell sx={cellEllipsisSx}>{renderEllipsis(issueSourceLabel(issue.source))}</TableCell>
                      <TableCell sx={cellEllipsisSx}>{renderEllipsis(issue.message)}</TableCell>
                      <TableCell sx={cellEllipsisSx}>{renderEllipsis(issue.context || '-')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {issueRows.length > ROWS_PER_PAGE ? (
                <Box sx={mvsBodyPaginationSx}>
                  <Pagination count={issuesPageCount} page={issuesPage} onChange={(_e, p) => setIssuesPage(p)} color="primary" shape="rounded" size="small" />
                </Box>
              ) : null}
            </>
          )}
          {result?.dryRun ? (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5, gap: 1 }}>
              <Button variant="contained" disableElevation sx={mvsBodyPrimaryBtnSx} onClick={() => void handleImport(false)} disabled={loading || errorCount > 0}>
                {loading ? <CircularProgress size={18} color="inherit" /> : t('tallyImport.steps.importButton')}
              </Button>
            </Box>
          ) : null}
        </Paper>
      ) : null}

      {preview ? (
        <Paper elevation={0} sx={{ ...mvsBodyCardSx, mt: 1.5, p: { xs: 1.5, sm: 2 }, borderRadius: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            {t('tallyImport.steps.previewTitle')}
          </Typography>
          {previewRows.length === 0 ? (
            <Alert severity="info">{t('tallyImport.emptyVouchers')}</Alert>
          ) : (
            <>
              <Table size="small" sx={wizardTableSx}>
                <TableHead sx={mvsTableHeadHighlightSx}>
                  <TableRow>
                    <TableCell sx={{ width: '14%' }}>{t('tallyImport.columns.date')}</TableCell>
                    <TableCell sx={{ width: '16%' }}>{t('tallyImport.columns.type')}</TableCell>
                    <TableCell sx={{ width: '18%' }}>{t('tallyImport.columns.number')}</TableCell>
                    <TableCell sx={{ width: '12%' }}>{t('tallyImport.columns.lines')}</TableCell>
                    <TableCell sx={{ width: '20%' }} align="right">{t('tallyImport.columns.debit')}</TableCell>
                    <TableCell sx={{ width: '20%' }} align="right">{t('tallyImport.columns.credit')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedPreview.map((v, idx) => (
                    <TableRow key={`${v.voucherNumber}-${idx}`}>
                      <TableCell sx={cellEllipsisSx}>{renderEllipsis(v.date)}</TableCell>
                      <TableCell sx={cellEllipsisSx}>{renderEllipsis(v.voucherType)}</TableCell>
                      <TableCell sx={cellEllipsisSx}>{renderEllipsis(v.voucherNumber)}</TableCell>
                      <TableCell sx={cellEllipsisSx}>{v.lineCount}</TableCell>
                      <TableCell align="right" sx={cellEllipsisSx}>{Number(v.totalDebit || 0).toLocaleString()}</TableCell>
                      <TableCell align="right" sx={cellEllipsisSx}>{Number(v.totalCredit || 0).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {previewRows.length > ROWS_PER_PAGE ? (
                <Box sx={mvsBodyPaginationSx}>
                  <Pagination count={previewPageCount} page={previewPage} onChange={(_e, p) => setPreviewPage(p)} color="primary" shape="rounded" size="small" />
                </Box>
              ) : null}
            </>
          )}
        </Paper>
      ) : null}

      {result && !result.dryRun ? (
        <Paper elevation={0} sx={{ ...mvsBodyCardSx, mt: 1.5, p: { xs: 1.5, sm: 2 }, borderRadius: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            {t('tallyImport.steps.completeTitle')}
          </Typography>
          <Alert severity={result.vouchers.failed > 0 ? 'warning' : 'success'} sx={{ mb: 1.5 }}>
            {t('tallyImport.resultSummary', {
              matched: result.ledgers.matched,
              createdAcc: result.ledgers.created,
              createdVch: result.vouchers.created,
              skipped: result.vouchers.skipped,
              failed: result.vouchers.failed,
            })}
          </Alert>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Button variant="outlined" startIcon={<BooksIcon fontSize="small" />} sx={mvsBodyOutlinedBtnSx} onClick={() => navigate(booksHref)}>
              {t('tallyImport.booksLink')}
            </Button>
            <Button variant="outlined" sx={mvsBodyOutlinedBtnSx} disabled={!result.batchId || loading} onClick={() => void handleReconciliation()}>
              {t('tallyImport.reconciliation')}
            </Button>
          </Box>
          {reconciliation ? (
            <Stack spacing={1.25} sx={{ mt: 1.5 }}>
              <Alert severity={reconciliation.status === 'PASS' ? 'success' : 'warning'} variant="outlined">
                {reconciliation.status === 'PASS' ? t('tallyImport.reconciliationPass') : t('tallyImport.reconciliationFail')}
              </Alert>
              <Typography variant="body2" color="text.secondary">{reconciliation.note}</Typography>
              <Table size="small" sx={wizardTableSx}>
                <TableHead sx={mvsTableHeadHighlightSx}>
                  <TableRow>
                    <TableCell>{t('tallyImport.reconciliationColumns.check')}</TableCell>
                    <TableCell align="right">{t('tallyImport.reconciliationColumns.source')}</TableCell>
                    <TableCell align="right">{t('tallyImport.reconciliationColumns.mvs')}</TableCell>
                    <TableCell align="right">{t('tallyImport.reconciliationColumns.difference')}</TableCell>
                    <TableCell>{t('tallyImport.reconciliationColumns.status')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>{t('tallyImport.reconciliationChecks.voucherCount')}</TableCell>
                    <TableCell align="right">{reconciliation.checks.voucherCount.source}</TableCell>
                    <TableCell align="right">{reconciliation.checks.voucherCount.mvs}</TableCell>
                    <TableCell align="right">-</TableCell>
                    <TableCell>{reconciliation.checks.voucherCount.status}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>{t('tallyImport.reconciliationChecks.debitTotal')}</TableCell>
                    <TableCell align="right">{reconciliation.checks.debitTotal.source}</TableCell>
                    <TableCell align="right">{reconciliation.checks.debitTotal.mvs}</TableCell>
                    <TableCell align="right">{reconciliation.checks.debitTotal.difference}</TableCell>
                    <TableCell>{reconciliation.checks.debitTotal.status}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>{t('tallyImport.reconciliationChecks.creditTotal')}</TableCell>
                    <TableCell align="right">{reconciliation.checks.creditTotal.source}</TableCell>
                    <TableCell align="right">{reconciliation.checks.creditTotal.mvs}</TableCell>
                    <TableCell align="right">{reconciliation.checks.creditTotal.difference}</TableCell>
                    <TableCell>{reconciliation.checks.creditTotal.status}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>{t('tallyImport.reconciliationChecks.ledgerMovements')}</TableCell>
                    <TableCell align="right">-</TableCell>
                    <TableCell align="right">-</TableCell>
                    <TableCell align="right">{reconciliation.checks.ledgerMovements.differenceCount}</TableCell>
                    <TableCell>{reconciliation.checks.ledgerMovements.status}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Stack>
          ) : null}
        </Paper>
      ) : null}
      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')}>
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      </Snackbar>
      <Snackbar open={!!success} autoHideDuration={4000} onClose={() => setSuccess('')}>
        <Alert severity="success" onClose={() => setSuccess('')}>
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TallyImport;
