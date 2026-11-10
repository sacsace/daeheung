import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
  FormControl,
  InputLabel,
  MenuItem,
  Select,
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
import { alpha, useTheme } from '@mui/material/styles';
import {
  AccountBalance as BooksIcon,
  CloudUpload as UploadIcon,
  RestartAlt as ResetIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import VoucherLinesEditor, { VoucherLineRow } from '../../components/Accounting/VoucherLinesEditor';
import AccountingCompanyBar from '../../components/Accounting/AccountingCompanyBar';
import { useGlAccounts } from '../../hooks/useGlAccounts';
import { useAccountingCompany } from '../../hooks/useAccountingCompany';
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
import { accountingService } from '../../services/api';
import { useStore } from '../../store';

type AutoVoucherStatus =
  | 'uploaded'
  | 'ocr_completed'
  | 'ai_classified'
  | 'draft'
  | 'review_required'
  | 'approved'
  | 'posted'
  | 'rejected'
  | 'cancelled';

type AutoVoucher = {
  id: number;
  voucher_code: string;
  source_doc_type: string;
  source_file_name: string;
  transaction_date?: string;
  invoice_number?: string;
  counterparty_name?: string;
  narration?: string;
  status: AutoVoucherStatus;
  confidence_score: number;
  total_debit: number;
  total_credit: number;
  duplicate_check?: { hasDuplicate?: boolean; matchedVoucherCodes?: string[] };
  ai_analysis?: {
    reason?: string;
    ruleName?: string;
    transactionType?: string;
    needsReview?: boolean;
    disclaimer?: string;
    requestId?: string;
    appliedRules?: Array<{ layer?: string; code?: string; reason?: string; priority?: number }>;
    historicalMatches?: Array<{ source?: string; code?: string; counterparty?: string; similarity?: string }>;
  };
  ocr_data?: { ocrAccuracy?: number };
  final_lines?: any[];
  auditLogs?: Array<{ id: number; action: string; created_at?: string; createdAt?: string }>;
};

const mapLines = (raw: any[] | undefined): VoucherLineRow[] =>
  (Array.isArray(raw) ? raw : []).map((line, index) => ({
    lineNo: Number(line?.lineNo || index + 1),
    accountId: line?.accountId != null ? Number(line.accountId) : undefined,
    accountName: String(line?.accountName || ''),
    debit: Number(line?.debit || 0),
    credit: Number(line?.credit || 0),
    narration: line?.narration ? String(line.narration) : '',
  }));

const DOC_TYPE_VALUES = [
  'purchase_invoice',
  'vendor_bill',
  'sales_invoice',
  'receipt',
  'card_slip',
  'bank_statement',
  'gst_challan',
  'tds_challan',
  'payroll_slip',
  'remittance',
  'credit_note',
  'debit_note',
  'other',
] as const;

const AUTO_VOUCHER_STATUSES: AutoVoucherStatus[] = [
  'uploaded',
  'ocr_completed',
  'ai_classified',
  'draft',
  'review_required',
  'approved',
  'posted',
  'rejected',
  'cancelled',
];

const AIAutoVoucher: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useStore();
  const {
    canSelectCompany,
    companies,
    selectedCompanyId,
    effectiveCompanyId,
    selectedCompanyName,
    companyQuery,
    changeCompany,
  } = useAccountingCompany();
  const [rows, setRows] = useState<AutoVoucher[]>([]);
  const [selected, setSelected] = useState<AutoVoucher | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [docType, setDocType] = useState('receipt');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bridgeInvoiceId, setBridgeInvoiceId] = useState('');
  const [bridgeExpenseId, setBridgeExpenseId] = useState('');
  const [bridgeLoading, setBridgeLoading] = useState(false);
  const [bridgePreview, setBridgePreview] = useState<any>(null);
  const [askQuestion, setAskQuestion] = useState('');
  const [askAnswer, setAskAnswer] = useState('');
  const [askLoading, setAskLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const { ledgerAccounts, reload: reloadAccounts } = useGlAccounts(true, effectiveCompanyId);
  const [form, setForm] = useState({
    transactionDate: '',
    counterpartyName: '',
    narration: '',
    lines: [] as VoucherLineRow[],
  });

  const reviewAllowed = useMemo(
    () => user?.role === 'root' || user?.role === 'admin' || user?.role === 'audit',
    [user?.role]
  );

  const postAllowed = useMemo(() => user?.role === 'root' || user?.role === 'admin', [user?.role]);

  const linesResolvedStrict = useMemo(
    () => form.lines.length >= 2 && form.lines.every((line) => Boolean(line.accountId)),
    [form.lines]
  );

  const kpis = useMemo(() => {
    const review = rows.filter((r) => r.status === 'review_required' || r.ai_analysis?.needsReview).length;
    const posted = rows.filter((r) => r.status === 'posted').length;
    const approved = rows.filter((r) => r.status === 'approved').length;
    const avg =
      rows.length > 0
        ? rows.reduce((sum, r) => sum + Number(r.confidence_score || 0), 0) / rows.length
        : 0;
    return [
      { key: 'review', label: t('autoVoucher.kpi.review'), value: String(review), color: 'warning.main' },
      { key: 'approved', label: t('autoVoucher.kpi.approved'), value: String(approved), color: 'success.main' },
      { key: 'posted', label: t('autoVoucher.kpi.posted'), value: String(posted), color: 'primary.main' },
      {
        key: 'confidence',
        label: t('autoVoucher.kpi.avgConfidence'),
        value: rows.length ? `${avg.toFixed(0)}%` : '—',
        color: 'text.primary',
      },
    ];
  }, [rows, t]);

  const filterFieldSx = { ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx };
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
    '& .MuiTableCell-root': { borderLeft: 'none', borderRight: 'none', borderTop: 'none' },
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

  const handleResetFilters = () => {
    setStatusFilter('');
    setDocType('receipt');
    setSelectedFile(null);
  };

  const loadList = useCallback(async () => {
    try {
      setLoading(true);
      const response = await accountingService.getAutoVouchers({
        status: statusFilter || undefined,
        ...companyQuery,
      });
      setRows(Array.isArray(response?.data) ? response.data : []);
    } catch (err: any) {
      setError(err?.response?.data?.message || t('autoVoucher.errors.loadList'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, companyQuery, t]);

  useEffect(() => {
    setAccounts(ledgerAccounts);
  }, [ledgerAccounts]);

  useEffect(() => {
    setSelected(null);
    loadList();
    reloadAccounts();
  }, [loadList, reloadAccounts, effectiveCompanyId]);

  const loadDetail = useCallback(async (id: number) => {
    try {
      const response = await accountingService.getAutoVoucher(id, effectiveCompanyId);
      const data: AutoVoucher = response?.data;
      setSelected(data);
      setForm({
        transactionDate: data?.transaction_date || '',
        counterpartyName: data?.counterparty_name || '',
        narration: data?.narration || '',
        lines: mapLines(data?.final_lines),
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || t('autoVoucher.errors.loadDetail'));
    }
  }, [effectiveCompanyId, t]);

  const statusLabel = (status: AutoVoucherStatus) => t(`autoVoucher.status.${status}`, status);

  const handleUpload = async () => {
    if (!selectedFile) {
      setError(t('autoVoucher.errors.noFile'));
      return;
    }

    const normalizedName = selectedFile.name.trim().toLowerCase();
    const localDuplicate = rows.find(
      (row) =>
        row.source_file_name?.trim().toLowerCase() === normalizedName &&
        row.status !== 'rejected' &&
        row.status !== 'cancelled'
    );
    if (localDuplicate) {
      setError(
        t('autoVoucher.errors.duplicateFileName', {
          fileName: selectedFile.name,
          vouchers: localDuplicate.voucher_code,
        })
      );
      return;
    }

    try {
      setUploading(true);
      const response = await accountingService.uploadAutoVoucher(selectedFile, docType, effectiveCompanyId);
      const created = response?.data;
      setSuccess(t('autoVoucher.success.uploaded'));
      setSelectedFile(null);
      await loadList();
      if (created?.id) {
        await loadDetail(created.id);
      }
    } catch (err: any) {
      if (err?.response?.data?.code === 'DUPLICATE_FILE_NAME') {
        const vouchers = (err?.response?.data?.data?.matchedVoucherCodes || []).join(', ');
        setError(
          t('autoVoucher.errors.duplicateFileName', {
            fileName: selectedFile.name,
            vouchers,
          })
        );
      } else {
        setError(err?.response?.data?.message || t('autoVoucher.errors.uploadFailed'));
      }
    } finally {
      setUploading(false);
    }
  };

  const handleBridgeRecommend = async (kind: 'invoice' | 'expense') => {
    const raw = kind === 'invoice' ? bridgeInvoiceId : bridgeExpenseId;
    const id = Number(raw);
    if (!id) {
      setError(t('autoVoucher.bridge.invalidId'));
      return;
    }
    setBridgeLoading(true);
    setError('');
    try {
      const response =
        kind === 'invoice'
          ? await accountingService.brainRecommendFromInvoice(id, effectiveCompanyId)
          : await accountingService.brainRecommendFromExpense(id, effectiveCompanyId);
      setBridgePreview(response?.data || null);
      setSuccess(t('autoVoucher.bridge.success'));
    } catch (err: any) {
      setError(err?.response?.data?.message || t('autoVoucher.bridge.failed'));
      setBridgePreview(null);
    } finally {
      setBridgeLoading(false);
    }
  };

  const handleAsk = async () => {
    const q = askQuestion.trim();
    if (!q) return;
    setAskLoading(true);
    setError('');
    try {
      const response = await accountingService.brainAsk(q, effectiveCompanyId);
      const payload = response?.data;
      setAskAnswer(
        [payload?.answer, ...(Array.isArray(payload?.reasons) ? payload.reasons : [])]
          .filter(Boolean)
          .join('\n') || payload?.disclaimer || ''
      );
    } catch (err: any) {
      setError(err?.response?.data?.message || t('autoVoucher.ask.failed'));
      setAskAnswer('');
    } finally {
      setAskLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    try {
      setSaving(true);
      const parsedLines = form.lines;
      await accountingService.updateAutoVoucher(
        selected.id,
        {
          transactionDate: form.transactionDate || null,
          counterpartyName: form.counterpartyName || null,
          narration: form.narration || null,
          finalLines: parsedLines,
        },
        effectiveCompanyId
      );
      setSuccess(t('autoVoucher.success.saved'));
      await loadDetail(selected.id);
      await loadList();
    } catch (err: any) {
      setError(err?.response?.data?.message || t('autoVoucher.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!selected) return;
    if (!linesResolvedStrict) {
      setError(t('autoVoucher.errors.unresolvedLedgers'));
      return;
    }
    try {
      setSaving(true);
      await accountingService.approveAutoVoucher(selected.id, effectiveCompanyId);
      setSuccess(t('autoVoucher.success.approved'));
      await loadDetail(selected.id);
      await loadList();
    } catch (err: any) {
      setError(err?.response?.data?.message || t('autoVoucher.errors.approveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handlePost = async () => {
    if (!selected) return;
    if (!linesResolvedStrict) {
      setError(t('autoVoucher.errors.unresolvedLedgers'));
      return;
    }
    try {
      setSaving(true);
      const response = await accountingService.postAutoVoucher(selected.id, effectiveCompanyId);
      setSuccess(response?.message || t('autoVoucher.success.posted'));
      await loadDetail(selected.id);
      await loadList();
    } catch (err: any) {
      setError(err?.response?.data?.message || t('autoVoucher.errors.postFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    if (!rejectReason.trim()) {
      setError(t('autoVoucher.errors.rejectReasonRequired'));
      return;
    }
    try {
      setSaving(true);
      await accountingService.rejectAutoVoucher(selected.id, rejectReason, effectiveCompanyId);
      setRejectOpen(false);
      setRejectReason('');
      setSuccess(t('autoVoucher.success.rejected'));
      await loadDetail(selected.id);
      await loadList();
    } catch (err: any) {
      setError(err?.response?.data?.message || t('autoVoucher.errors.rejectFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={mvsPageRootSx}>
      <DaeheungPageHeader title={t('autoVoucher.title')} description={t('autoVoucher.description')} />

      <AccountingCompanyBar
        canSelectCompany={canSelectCompany}
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        selectedCompanyName={selectedCompanyName}
        onChangeCompany={changeCompany}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2.5, mb: 3 }}>
        {kpis.map((kpi) => (
          <Card key={kpi.key} elevation={0} sx={mvsKpiCardSx}>
            <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
                {kpi.label}
              </Typography>
              <Typography variant="h5" sx={{ mt: 0.75, fontWeight: 600, letterSpacing: '-0.02em', color: kpi.color }}>
                {loading ? '…' : kpi.value}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        {t('autoVoucher.brainDisclaimer')}
      </Alert>

      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 0 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            flexWrap: 'wrap',
            alignItems: { xs: 'stretch', md: 'center' },
            justifyContent: { md: 'space-between' },
            gap: { xs: 1.25, md: 1 },
            px: { xs: 2, sm: 2.5 },
            py: 1.5,
            bgcolor: '#FFFFFF',
          }}
        >
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<BooksIcon fontSize="small" />}
              sx={mvsBodyOutlinedBtnSx}
              onClick={() =>
                navigate(
                  effectiveCompanyId
                    ? `/accounting/books?company_id=${effectiveCompanyId}`
                    : '/accounting/books'
                )
              }
            >
              {t('autoVoucher.booksLink')}
            </Button>
          </Box>
          <Button
            variant="contained"
            disableElevation
            size="small"
            startIcon={<UploadIcon fontSize="small" />}
            sx={mvsBodyPrimaryBtnSx}
            onClick={handleUpload}
            disabled={uploading || !selectedFile}
          >
            {uploading ? t('autoVoucher.upload.processing') : t('autoVoucher.upload.submit')}
          </Button>
        </Box>

        <Box sx={mvsBodyFilterWrapSx}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'minmax(0, 1.2fr) minmax(0, 1fr) auto auto auto',
              },
              gap: 2,
              alignItems: 'flex-end',
            }}
          >
            <FormControl size="small" fullWidth sx={filterFieldSx}>
              <InputLabel shrink>{t('autoVoucher.upload.docType')}</InputLabel>
              <Select
                label={t('autoVoucher.upload.docType')}
                value={docType}
                onChange={(e) => setDocType(String(e.target.value))}
              >
                {DOC_TYPE_VALUES.map((value) => (
                  <MenuItem key={value} value={value}>
                    {t(`autoVoucher.docTypes.${value}`)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth sx={filterFieldSx}>
              <InputLabel shrink>{t('autoVoucher.list.status')}</InputLabel>
              <Select
                label={t('autoVoucher.list.status')}
                value={statusFilter}
                onChange={(e) => setStatusFilter(String(e.target.value))}
              >
                <MenuItem value="">{t('autoVoucher.list.all')}</MenuItem>
                {AUTO_VOUCHER_STATUSES.map((value) => (
                  <MenuItem key={value} value={value}>
                    {statusLabel(value)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="outlined" component="label" sx={{ ...mvsBodyOutlinedBtnSx, height: 40 }}>
              {t('autoVoucher.upload.selectFile')}
              <input
                hidden
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.txt,.json,.xls,.xlsx"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
            </Button>
            <Typography variant="body2" color="text.secondary" sx={{ py: 1, ...cellEllipsisSx, maxWidth: 180 }}>
              {selectedFile ? selectedFile.name : t('autoVoucher.upload.noFile')}
            </Typography>
            <Button
              variant="outlined"
              startIcon={<ResetIcon fontSize="small" />}
              sx={{ ...mvsBodyOutlinedBtnSx, height: 40 }}
              onClick={handleResetFilters}
            >
              {t('common.reset')}
            </Button>
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mt: 2 }}>
            <TextField
              size="small"
              label={t('autoVoucher.bridge.invoiceId')}
              value={bridgeInvoiceId}
              onChange={(e) => setBridgeInvoiceId(e.target.value)}
              sx={{ width: 140, ...filterFieldSx }}
              {...mvsOutlinedLabelProps}
            />
            <Button
              variant="outlined"
              disabled={bridgeLoading}
              onClick={() => void handleBridgeRecommend('invoice')}
              sx={mvsBodyOutlinedBtnSx}
            >
              {t('autoVoucher.bridge.recommendInvoice')}
            </Button>
            <TextField
              size="small"
              label={t('autoVoucher.bridge.expenseId')}
              value={bridgeExpenseId}
              onChange={(e) => setBridgeExpenseId(e.target.value)}
              sx={{ width: 140, ...filterFieldSx }}
              {...mvsOutlinedLabelProps}
            />
            <Button
              variant="outlined"
              disabled={bridgeLoading}
              onClick={() => void handleBridgeRecommend('expense')}
              sx={mvsBodyOutlinedBtnSx}
            >
              {t('autoVoucher.bridge.recommendExpense')}
            </Button>
            <TextField
              size="small"
              placeholder={t('autoVoucher.ask.placeholder')}
              value={askQuestion}
              onChange={(e) => setAskQuestion(e.target.value)}
              sx={{ flex: '1 1 200px', minWidth: 200, ...filterFieldSx }}
            />
            <Button variant="contained" disableElevation disabled={askLoading} onClick={() => void handleAsk()} sx={mvsBodyPrimaryBtnSx}>
              {t('autoVoucher.ask.submit')}
            </Button>
          </Box>
          {bridgePreview && (
            <Alert severity="success" sx={{ mt: 1.5 }} onClose={() => setBridgePreview(null)}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {bridgePreview.debitLedger?.accountName || '—'} ← Dr / Cr →{' '}
                {bridgePreview.creditLedger?.accountName || '—'} ·{' '}
                {t('autoVoucher.list.columns.confidence')}: {bridgePreview.confidenceScore ?? '—'}
              </Typography>
            </Alert>
          )}
          {askAnswer && (
            <Alert severity="info" sx={{ mt: 1.5, whiteSpace: 'pre-wrap' }} onClose={() => setAskAnswer('')}>
              {askAnswer}
            </Alert>
          )}
        </Box>
      </Card>

      <Box sx={{ ...mvsBodyListZoneSx, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.05fr 1fr' }, gap: 2.5 }}>
        {loading ? (
          <Box sx={listStateBoxSx}>
            <CircularProgress size={36} />
            <Typography variant="body2" color="text.secondary">
              {t('autoVoucher.list.loading')}
            </Typography>
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={listStateBoxSx}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {t('autoVoucher.list.empty')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('autoVoucher.upload.title')}
            </Typography>
          </Box>
        ) : (
          <TableContainer sx={{ ...mvsBodyListTableSx, ...mvsTableScrollSx }}>
            <Table size="small" sx={tableSx}>
              <TableHead sx={mvsTableHeadHighlightSx}>
                <TableRow>
                  <TableCell width="8%">{t('autoVoucher.list.columns.no')}</TableCell>
                  <TableCell width="36%">{t('autoVoucher.list.columns.voucher')}</TableCell>
                  <TableCell width="20%">{t('autoVoucher.list.columns.status')}</TableCell>
                  <TableCell width="16%">{t('autoVoucher.list.columns.confidence')}</TableCell>
                  <TableCell width="20%" align="right">
                    {t('autoVoucher.list.columns.amount')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody sx={mvsTableBodyRowSx}>
                {rows.map((row, index) => (
                  <TableRow
                    key={row.id}
                    hover
                    onClick={() => loadDetail(row.id)}
                    selected={selected?.id === row.id}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={cellEllipsisSx}>{index + 1}</TableCell>
                    <TableCell sx={cellEllipsisSx}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                        {row.voucher_code}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap display="block">
                        {row.source_file_name}
                      </Typography>
                    </TableCell>
                    <TableCell sx={cellEllipsisSx}>
                      <Chip size="small" label={statusLabel(row.status)} />
                    </TableCell>
                    <TableCell sx={cellEllipsisSx}>{Number(row.confidence_score || 0).toFixed(1)}%</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {Number(row.total_debit || 0).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Card elevation={0} sx={mvsBodyCardSx}>
          <Box sx={{ px: { xs: 2, sm: 2.5 }, py: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
              {t('autoVoucher.review.title')}
            </Typography>

            {!selected ? (
              <Typography color="text.secondary">{t('autoVoucher.review.selectHint')}</Typography>
            ) : (
              <Box sx={{ display: 'grid', gap: 1.25 }}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip label={selected.voucher_code} size="small" />
                  <Chip label={statusLabel(selected.status)} size="small" color="primary" variant="outlined" />
                  <Chip
                    label={`${t('autoVoucher.list.columns.confidence')} ${Number(selected.confidence_score || 0).toFixed(1)}%`}
                    size="small"
                  />
                </Box>

                <Typography variant="body2" color="text.secondary">
                  {t('autoVoucher.review.reason')}: {selected.ai_analysis?.reason || '-'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('autoVoucher.review.rule')}: {selected.ai_analysis?.ruleName || '-'}
                </Typography>
                {selected.ai_analysis?.needsReview && (
                  <Alert severity="info" sx={{ py: 0.5 }}>
                    Needs review — Accounting Brain flagged this recommendation before any posting.
                  </Alert>
                )}
                {!linesResolvedStrict && selected.status !== 'posted' && (
                  <Alert severity="error" sx={{ py: 0.5 }}>
                    {t('autoVoucher.errors.unresolvedLedgers')}
                  </Alert>
                )}
                {Array.isArray(selected.ai_analysis?.appliedRules) && selected.ai_analysis!.appliedRules!.length > 0 && (
                  <Box
                    sx={{
                      p: 1.25,
                      borderRadius: 1.5,
                      border: '1px solid #CBD5E1',
                      bgcolor: alpha(theme.palette.primary.main, 0.04),
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
                      Applied rules (priority order)
                    </Typography>
                    {selected.ai_analysis!.appliedRules!.map((rule, idx) => (
                      <Typography key={`${rule.code}-${idx}`} variant="caption" display="block" sx={{ mb: 0.35 }}>
                        [{rule.layer || 'rule'}] {rule.code || '-'} — {rule.reason || '-'}
                      </Typography>
                    ))}
                  </Box>
                )}
                {Array.isArray(selected.ai_analysis?.historicalMatches) &&
                  selected.ai_analysis!.historicalMatches!.length > 0 && (
                    <Box sx={{ p: 1.25, borderRadius: 1.5, border: '1px solid #CBD5E1' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
                        Historical matches
                      </Typography>
                      {selected.ai_analysis!.historicalMatches!.map((m, idx) => (
                        <Typography key={`${m.code}-${idx}`} variant="caption" display="block">
                          {m.code || m.source || '-'} · {m.counterparty || '-'} · {m.similarity || '-'}
                        </Typography>
                      ))}
                    </Box>
                  )}
                {selected.ai_analysis?.disclaimer && (
                  <Typography variant="caption" color="text.secondary">
                    {selected.ai_analysis.disclaimer}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary">
                  {t('autoVoucher.review.ocrAccuracy')}:{' '}
                  {selected.ocr_data?.ocrAccuracy ? `${Math.round(selected.ocr_data.ocrAccuracy * 100)}%` : '-'}
                </Typography>

                {selected.duplicate_check?.hasDuplicate && (
                  <Alert severity="warning">
                    {t('autoVoucher.review.duplicateWarning')}:{' '}
                    {(selected.duplicate_check?.matchedVoucherCodes || []).join(', ')}
                  </Alert>
                )}

                <TextField
                  size="small"
                  label={t('autoVoucher.review.transactionDate')}
                  value={form.transactionDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, transactionDate: e.target.value }))}
                  sx={filterFieldSx}
                  {...mvsOutlinedLabelProps}
                />
                <TextField
                  size="small"
                  label={t('autoVoucher.review.counterparty')}
                  value={form.counterpartyName}
                  onChange={(e) => setForm((prev) => ({ ...prev, counterpartyName: e.target.value }))}
                  sx={filterFieldSx}
                  {...mvsOutlinedLabelProps}
                />
                <TextField
                  size="small"
                  label={t('autoVoucher.review.narration')}
                  value={form.narration}
                  onChange={(e) => setForm((prev) => ({ ...prev, narration: e.target.value }))}
                  sx={filterFieldSx}
                  {...mvsOutlinedLabelProps}
                />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {t('autoVoucher.review.linesTitle')}
                </Typography>
                <VoucherLinesEditor
                  lines={form.lines}
                  accounts={accounts}
                  onChange={(lines) => setForm((prev) => ({ ...prev, lines }))}
                  readOnly={selected.status === 'posted'}
                />

                <Box
                  sx={{
                    p: 1.25,
                    borderRadius: 1.5,
                    bgcolor: alpha(theme.palette.info.main, 0.06),
                    border: `1px solid ${alpha(theme.palette.info.main, 0.18)}`,
                  }}
                >
                  <Typography variant="body2">
                    {t('autoVoucher.review.debitCreditSummary', {
                      debit: Number(selected.total_debit || 0).toLocaleString(),
                      credit: Number(selected.total_credit || 0).toLocaleString(),
                    })}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button variant="outlined" onClick={handleSave} disabled={saving} sx={mvsBodyOutlinedBtnSx}>
                    {t('autoVoucher.review.save')}
                  </Button>
                  {reviewAllowed && (
                    <Button
                      variant="contained"
                      color="success"
                      disableElevation
                      onClick={handleApprove}
                      disabled={
                        saving ||
                        !linesResolvedStrict ||
                        selected.status === 'approved' ||
                        selected.status === 'posted'
                      }
                      sx={mvsBodyPrimaryBtnSx}
                    >
                      {t('autoVoucher.review.approve')}
                    </Button>
                  )}
                  {postAllowed && (
                    <Button
                      variant="contained"
                      color="secondary"
                      disableElevation
                      onClick={handlePost}
                      disabled={saving || !linesResolvedStrict || selected.status !== 'approved'}
                      sx={mvsBodyPrimaryBtnSx}
                    >
                      {t('autoVoucher.review.post')}
                    </Button>
                  )}
                  {selected.status === 'posted' && (
                    <Button
                      variant="outlined"
                      sx={mvsBodyOutlinedBtnSx}
                      onClick={() =>
                        navigate(
                          effectiveCompanyId
                            ? `/accounting/books?tab=ledger&company_id=${effectiveCompanyId}`
                            : '/accounting/books?tab=ledger'
                        )
                      }
                    >
                      {t('autoVoucher.review.viewLedger')}
                    </Button>
                  )}
                  {reviewAllowed && (
                    <Button
                      variant="outlined"
                      onClick={() => setRejectOpen(true)}
                      disabled={saving || selected.status === 'posted'}
                      sx={{
                        ...mvsBodyOutlinedBtnSx,
                        '&:hover': {
                          color: 'error.main',
                          borderColor: alpha(theme.palette.error.main, 0.4),
                          bgcolor: alpha(theme.palette.error.main, 0.08),
                        },
                      }}
                    >
                      {t('autoVoucher.review.reject')}
                    </Button>
                  )}
                </Box>

                <Typography variant="subtitle2" sx={{ mt: 1, fontWeight: 700 }}>
                  {t('autoVoucher.review.auditLog')}
                </Typography>
                <Box sx={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #CBD5E1', borderRadius: 1.5, p: 1 }}>
                  {(selected.auditLogs || []).length === 0 && (
                    <Typography variant="caption" color="text.secondary">
                      {t('autoVoucher.review.noLog')}
                    </Typography>
                  )}
                  {(selected.auditLogs || []).map((log) => {
                    const ts = log.created_at || log.createdAt;
                    const label = ts ? new Date(ts).toLocaleString() : '-';
                    return (
                      <Typography key={log.id} variant="caption" display="block" sx={{ py: 0.25 }}>
                        {log.action} - {label}
                      </Typography>
                    );
                  })}
                </Box>
              </Box>
            )}
          </Box>
        </Card>
      </Box>

      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('autoVoucher.rejectDialog.title')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={4}
            label={t('autoVoucher.rejectDialog.reason')}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            sx={{ mt: 1, ...mvsSearchFieldSx }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectOpen(false)} sx={mvsBodyOutlinedBtnSx}>
            {t('common.cancel')}
          </Button>
          <Button color="error" variant="contained" disableElevation onClick={handleReject} disabled={saving}>
            {t('autoVoucher.rejectDialog.confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(error)} autoHideDuration={3500} onClose={() => setError('')}>
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      </Snackbar>
      <Snackbar open={Boolean(success)} autoHideDuration={2800} onClose={() => setSuccess('')}>
        <Alert severity="success" onClose={() => setSuccess('')}>
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AIAutoVoucher;
