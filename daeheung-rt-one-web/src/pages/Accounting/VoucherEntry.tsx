import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  FormControlLabel,
  Grid,
  MenuItem,
  Snackbar,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography } from '@mui/material';
import {
  AccountBalance as BankIcon,
  CheckCircle as CheckIcon,
  EditNote as JournalIcon,
  Payment as PaymentIcon,
  Receipt as ReceiptIcon,
  Sell as SellIcon,
  ShoppingCart as PurchaseIcon,
  SwapHoriz as ContraIcon,
  Warning as WarningIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import AccountingCompanyBar from '../../components/Accounting/AccountingCompanyBar';
import VoucherLinesEditor, { VoucherLineRow } from '../../components/Accounting/VoucherLinesEditor';
import { useAccountingCompany } from '../../hooks/useAccountingCompany';
import { useGlAccounts } from '../../hooks/useGlAccounts';
import { accountingService } from '../../services/api';
import {
  mvsBodyCardSx,
  mvsBodyListTableSx,
  mvsBodyListZoneSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPrimaryBtnSx,
  mvsBodySectionHeaderSx,
  mvsBodyToolbarSx,
  mvsPageRootSx,
  mvsSearchFieldSx,
  mvsTableHeadHighlightSx,
  mvsTableScrollSx } from '../../theme/daeheungLayout';
import { formatInr, parseInrInput } from '../../utils/formatInr';
import { getBilingualName } from '../../utils/accountingMasterLabel';
import { usePageMenuPermission } from '../../context/MenuPermissionContext';
import { useMenuActionGuard } from '../../hooks/useMenuActionGuard';

const VOUCHER_ENTRY_MENU_ROUTES = ['/accounting/tally-import', '/accounting/books'] as const;

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  payment: <PaymentIcon />,
  receipt: <ReceiptIcon />,
  purchase: <PurchaseIcon />,
  sales: <SellIcon />,
  contra: <ContraIcon />,
  journal: <JournalIcon />,
  credit_note: <ReceiptIcon />,
  debit_note: <PaymentIcon /> };

type PreviewLine = {
  lineNo: number;
  lineCategory?: string;
  accountId?: number;
  accountName: string;
  partyId?: number;
  debit: number;
  credit: number;
  narration?: string;
};

const VoucherEntry: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const menuFlags = usePageMenuPermission(VOUCHER_ENTRY_MENU_ROUTES);
  const createGuard = useMenuActionGuard('create', VOUCHER_ENTRY_MENU_ROUTES);
  const {
    canSelectCompany,
    companies,
    selectedCompanyId,
    effectiveCompanyId,
    selectedCompanyName,
    companyQuery,
    changeCompany } = useAccountingCompany();

  const [pageTab, setPageTab] = useState(0);
  const [inputMode, setInputMode] = useState<'simple' | 'advanced'>('simple');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [voucherTypes, setVoucherTypes] = useState<any[]>([]);
  const [transactionItems, setTransactionItems] = useState<any[]>([]);
  const [gstCodes, setGstCodes] = useState<any[]>([]);
  const [tdsCodes, setTdsCodes] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [financialYears, setFinancialYears] = useState<any[]>([]);
  const [partyOptions, setPartyOptions] = useState<any[]>([]);
  const [, setPartySearch] = useState('');

  const [selectedVoucherType, setSelectedVoucherType] = useState<any | null>(null);
  const [selectedParty, setSelectedParty] = useState<any | null>(null);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [selectedBank, setSelectedBank] = useState<any | null>(null);
  const [selectedGst, setSelectedGst] = useState<any | null>(null);
  const [selectedTds, setSelectedTds] = useState<any | null>(null);
  const [financialYearId, setFinancialYearId] = useState<number | ''>('');
  const [voucherNo, setVoucherNo] = useState('');
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().slice(0, 10));
  const [postingDate, setPostingDate] = useState(new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');
  const [taxableAmount, setTaxableAmount] = useState('');
  const [discount] = useState('');
  const [roundOff] = useState('');
  const [applyGst, setApplyGst] = useState(false);
  const [applyTds, setApplyTds] = useState(false);
  const [isInterState, setIsInterState] = useState(false);

  const [previewLines, setPreviewLines] = useState<PreviewLine[]>([]);
  const [amountDetails, setAmountDetails] = useState<Record<string, number>>({});
  const [balanced, setBalanced] = useState(false);
  const [advancedLines, setAdvancedLines] = useState<VoucherLineRow[]>([
    { lineNo: 1, accountName: '', debit: 0, credit: 0 },
    { lineNo: 2, accountName: '', debit: 0, credit: 0 },
  ]);

  const { ledgerAccounts } = useGlAccounts(true, effectiveCompanyId);

  const loadMasters = useCallback(async () => {
    if (menuFlags.menusLoading || !menuFlags.canRead || !effectiveCompanyId) return;
    setLoading(true);
    try {
      await accountingService.seedAccountingMasters(effectiveCompanyId);
      const [vt, ti, gst, tds, banks, fys] = await Promise.all([
        accountingService.getVoucherTypes(effectiveCompanyId),
        accountingService.getTransactionItems({ ...companyQuery }),
        accountingService.getGstCodes({ voucherDate, ...companyQuery }),
        accountingService.getTdsCodes(effectiveCompanyId),
        accountingService.getBankAccounts(effectiveCompanyId),
        accountingService.getFinancialYears(effectiveCompanyId),
      ]);
      setVoucherTypes(vt?.data || []);
      setTransactionItems(ti?.data || []);
      setGstCodes(gst?.data || []);
      setTdsCodes(tds?.data || []);
      setBankAccounts(banks?.data || []);
      setFinancialYears(fys?.data || []);
      if (fys?.data?.length) setFinancialYearId(fys.data[0].id);
      if (banks?.data?.length) setSelectedBank(banks.data[0]);
    } catch (err: any) {
      setError(err?.response?.data?.message || t('voucherEntry.errors.loadMasters'));
    } finally {
      setLoading(false);
    }
  }, [effectiveCompanyId, companyQuery, voucherDate, t, menuFlags.menusLoading, menuFlags.canRead]);

  useEffect(() => {
    loadMasters();
  }, [loadMasters]);

  useEffect(() => {
    if (!selectedVoucherType?.id || !voucherDate) return;
    accountingService
      .getNextVoucherNumber({ voucherTypeId: selectedVoucherType.id, voucherDate, ...companyQuery })
      .then((res) => setVoucherNo(res?.data?.voucherNo || ''))
      .catch(() => setVoucherNo(''));
  }, [selectedVoucherType, voucherDate, companyQuery]);

  const searchParties = useCallback(async (q: string) => {
    setPartySearch(q);
    if (!q.trim()) return;
    try {
      const res = await accountingService.searchAccountingParties({ search: q, ...companyQuery });
      setPartyOptions(res?.data || []);
    } catch {
      setPartyOptions([]);
    }
  }, [companyQuery]);

  const runPreview = useCallback(async () => {
    if (!effectiveCompanyId) return;
    try {
      if (inputMode === 'advanced') {
        const lines = advancedLines.map((l, i) => ({
          lineNo: i + 1,
          accountId: l.accountId,
          accountName: l.accountName,
          debit: l.debit,
          credit: l.credit,
          narration: l.narration }));
        const res = await accountingService.previewVoucher({ inputMode: 'advanced', lines }, effectiveCompanyId);
        const data = res?.data || {};
        setPreviewLines(data.lines || []);
        setBalanced(!!data.balanced);
        setAmountDetails({});
        return;
      }

      const res = await accountingService.previewVoucher(
        {
          inputMode: 'simple',
          simpleInput: {
            voucherTypeId: selectedVoucherType?.id,
            transactionItemId: selectedItem?.id,
            partyId: selectedParty?.id,
            bankAccountId: selectedBank?.id,
            voucherDate,
            taxableAmount: parseInrInput(taxableAmount),
            discount: parseInrInput(discount),
            roundOff: parseInrInput(roundOff),
            gstCodeId: applyGst ? selectedGst?.id : undefined,
            tdsCodeId: applyTds ? selectedTds?.id : undefined,
            isInterState,
            narration } },
        effectiveCompanyId
      );
      const data = res?.data || {};
      setPreviewLines(data.lines || []);
      setAmountDetails(data.amountDetails || {});
      setBalanced(!!data.balanced);
    } catch (err: any) {
      setError(err?.response?.data?.message || t('voucherEntry.errors.preview'));
    }
  }, [
    effectiveCompanyId, inputMode, advancedLines, selectedVoucherType, selectedItem, selectedParty,
    selectedBank, voucherDate, taxableAmount, discount, roundOff, applyGst, selectedGst, applyTds,
    selectedTds, isInterState, narration, t,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => void runPreview(), 400);
    return () => clearTimeout(timer);
  }, [runPreview]);

  const handleSelectVoucherType = (vt: any) => {
    setSelectedVoucherType(vt);
    if (vt.category === 'journal') setInputMode('advanced');
  };

  const handleSelectItem = (item: any | null) => {
    setSelectedItem(item);
    if (item?.default_gst_code_id) {
      const gst = gstCodes.find((g) => g.id === item.default_gst_code_id);
      if (gst) { setSelectedGst(gst); setApplyGst(true); }
    }
    if (item?.default_tds_code_id) {
      const tds = tdsCodes.find((g) => g.id === item.default_tds_code_id);
      if (tds) { setSelectedTds(tds); setApplyTds(true); }
    }
  };

  const handleSave = async (status: 'draft' | 'posted') => {
    if (!createGuard.guard()) return;
    if (!selectedVoucherType) {
      setError(t('voucherEntry.errors.noVoucherType'));
      return;
    }
    if (status === 'posted' && !balanced) {
      setError(t('voucherEntry.errors.notBalanced'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const lines = inputMode === 'advanced'
        ? advancedLines.map((l, i) => ({
            lineNo: i + 1,
            accountId: l.accountId,
            accountName: l.accountName,
            debit: l.debit,
            credit: l.credit,
            narration: l.narration }))
        : previewLines;

      const res = await accountingService.createEnhancedVoucher(
        {
          voucherTypeId: selectedVoucherType.id,
          financialYearId: financialYearId || undefined,
          voucherDate,
          postingDate,
          partyId: selectedParty?.id,
          narration,
          inputMode,
          amountDetails,
          lines,
          status,
          postImmediately: status === 'posted' },
        effectiveCompanyId
      );
      setSuccess(t('voucherEntry.saved'));
      if (status === 'posted') navigate('/accounting/voucher-list');
      else {
        setNarration('');
        setTaxableAmount('');
        setPreviewLines([]);
      }
      return res;
    } catch (err: any) {
      setError(err?.response?.data?.message || t('voucherEntry.errors.save'));
    } finally {
      setSaving(false);
    }
  };

  const categoryLabel = (cat: string) => t(`voucherEntry.categories.${cat}`, cat);

  const amountRows = useMemo(() => {
    if (!amountDetails || !Object.keys(amountDetails).length) return [];
    return [
      { key: 'taxableAmount', label: t('voucherEntry.amount.taxable') },
      { key: 'cgst', label: 'CGST' },
      { key: 'sgst', label: 'SGST' },
      { key: 'igst', label: 'IGST' },
      { key: 'tdsAmount', label: 'TDS' },
      { key: 'grossTotal', label: t('voucherEntry.amount.total') },
      { key: 'paidAmount', label: t('voucherEntry.amount.paid') },
    ].filter((r) => amountDetails[r.key] != null && amountDetails[r.key] !== 0);
  }, [amountDetails, t]);

  const sectionTitleSx = { fontWeight: 700, letterSpacing: '-0.01em' } as const;
  const bodyContentSx = { px: { xs: 2, sm: 2.5 }, py: 2 } as const;

  const handlePageTab = (_: React.SyntheticEvent, value: number) => {
    if (value === 1) {
      navigate('/accounting/document-voucher');
      return;
    }
    if (value === 2) {
      navigate('/accounting/voucher-list');
      return;
    }
    setPageTab(value);
  };

  const typeCardSx = (selected: boolean) => ({
    ...mvsBodyCardSx,
    borderColor: selected ? '#1D4E7C' : '#E2E8F0',
    bgcolor: selected ? 'rgba(106, 143, 147, 0.08)' : '#FFFFFF',
    transition: 'border-color 0.2s, background-color 0.2s' });

  return (
    <Box sx={mvsPageRootSx}>
      <DaeheungPageHeader title={t('voucherEntry.title')} description={t('voucherEntry.subtitle')} />

      {!menuFlags.menusLoading && !menuFlags.canRead && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {t('common.menuNoView')}
        </Alert>
      )}

      <AccountingCompanyBar
        canSelectCompany={canSelectCompany}
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        selectedCompanyName={selectedCompanyName}
        onChangeCompany={changeCompany}
      />

      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 2 }}>
        <Tabs
          value={pageTab}
          onChange={handlePageTab}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ px: 1, minHeight: 48, '& .MuiTab-root': { py: 1.5, textTransform: 'none', fontWeight: 600 } }}
        >
          <Tab label={t('voucherEntry.tabs.new')} />
          <Tab label={t('voucherEntry.tabs.document')} />
          <Tab label={t('voucherEntry.tabs.list')} />
        </Tabs>
      </Card>

      <Box sx={mvsBodyListZoneSx}>
        <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 2 }}>
          <Box sx={mvsBodySectionHeaderSx}>
            <Typography variant="subtitle1" sx={sectionTitleSx}>
              {t('voucherEntry.section.basic')}
            </Typography>
          </Box>
          <Box sx={bodyContentSx}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <TextField
                  fullWidth
                  size="small"
                  select
                  label={t('voucherEntry.financialYear')}
                  value={financialYearId}
                  onChange={(e) => setFinancialYearId(Number(e.target.value))}
                  sx={mvsSearchFieldSx}
                >
                  {financialYears.map((fy) => (
                    <MenuItem key={fy.id} value={fy.id}>{fy.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <TextField fullWidth size="small" label={t('voucherEntry.voucherNo')} value={voucherNo} InputProps={{ readOnly: true }} sx={mvsSearchFieldSx} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label={t('voucherEntry.voucherDate')}
                  value={voucherDate}
                  onChange={(e) => setVoucherDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={mvsSearchFieldSx}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label={t('voucherEntry.postingDate')}
                  value={postingDate}
                  onChange={(e) => setPostingDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={mvsSearchFieldSx}
                />
              </Grid>
            </Grid>
          </Box>
        </Card>

        <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 2 }}>
          <Box sx={mvsBodySectionHeaderSx}>
            <Typography variant="subtitle1" sx={sectionTitleSx}>
              {t('voucherEntry.section.transactionType')}
            </Typography>
          </Box>
          <Box sx={bodyContentSx}>
            <Grid container spacing={1.5}>
              {voucherTypes.map((vt) => (
                <Grid key={vt.id} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
                  <Card elevation={0} sx={typeCardSx(selectedVoucherType?.id === vt.id)}>
                    <CardActionArea onClick={() => handleSelectVoucherType(vt)} sx={{ borderRadius: 'inherit' }}>
                      <Box sx={{ textAlign: 'center', py: 2, px: 1 }}>
                        <Box sx={{ color: '#1D4E7C', mb: 0.5, display: 'flex', justifyContent: 'center' }}>
                          {CATEGORY_ICONS[vt.category] || <JournalIcon />}
                        </Box>
                        <Typography variant="body2" fontWeight={600}>{getBilingualName(vt, i18n.language)}</Typography>
                        {(vt.name_ko && vt.name_en) ? (
                          <Typography variant="caption" color="text.secondary">
                            {i18n.language.startsWith('en') ? vt.name_ko : vt.name_en}
                          </Typography>
                        ) : null}
                      </Box>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Card>

        <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 2 }}>
          <Box sx={{ ...mvsBodyToolbarSx, borderTop: 'none' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={inputMode === 'advanced'}
                  onChange={(e) => setInputMode(e.target.checked ? 'advanced' : 'simple')}
                  color="primary"
                />
              }
              label={inputMode === 'advanced' ? t('voucherEntry.mode.advanced') : t('voucherEntry.mode.simple')}
            />
            {selectedVoucherType ? (
              <Chip size="small" label={categoryLabel(selectedVoucherType.category)} color="primary" variant="outlined" />
            ) : null}
          </Box>

          {inputMode === 'simple' ? (
            <>
              <Box sx={mvsBodySectionHeaderSx}>
                <Typography variant="subtitle1" sx={sectionTitleSx}>
                  {t('voucherEntry.section.simpleForm')}
                </Typography>
              </Box>
              <Box sx={bodyContentSx}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Autocomplete
                      options={partyOptions}
                      getOptionLabel={(o) => o.company_name || ''}
                      value={selectedParty}
                      onChange={(_, v) => setSelectedParty(v)}
                      onInputChange={(_, v) => void searchParties(v)}
                      renderInput={(params) => (
                        <TextField {...params} size="small" label={t('voucherEntry.party')} placeholder={t('voucherEntry.partySearch')} sx={mvsSearchFieldSx} />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Autocomplete
                      options={transactionItems}
                      getOptionLabel={(o) => getBilingualName(o, i18n.language)}
                      value={selectedItem}
                      onChange={(_, v) => handleSelectItem(v)}
                      renderInput={(params) => (
                        <TextField {...params} size="small" label={t('voucherEntry.transactionItem')} sx={mvsSearchFieldSx} />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Autocomplete
                      options={bankAccounts}
                      getOptionLabel={(o) => `${o.bank_name} - ${o.account_name}`}
                      value={selectedBank}
                      onChange={(_, v) => setSelectedBank(v)}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          size="small"
                          label={t('voucherEntry.paymentMethod')}
                          sx={mvsSearchFieldSx}
                          InputProps={{
                            ...params.InputProps,
                            startAdornment: <BankIcon fontSize="small" sx={{ mr: 1, opacity: 0.6 }} /> }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label={t('voucherEntry.taxableAmount')}
                      value={taxableAmount}
                      onChange={(e) => setTaxableAmount(e.target.value)}
                      placeholder="100000"
                      sx={mvsSearchFieldSx}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <FormControlLabel control={<Switch checked={applyGst} onChange={(e) => setApplyGst(e.target.checked)} />} label={t('voucherEntry.applyGst')} />
                    {applyGst ? (
                      <TextField
                        fullWidth
                        size="small"
                        select
                        label="GST"
                        value={selectedGst?.id || ''}
                        onChange={(e) => setSelectedGst(gstCodes.find((g) => g.id === Number(e.target.value)) || null)}
                        sx={{ ...mvsSearchFieldSx, mt: 1 }}
                      >
                        {gstCodes.map((g) => <MenuItem key={g.id} value={g.id}>{g.name} ({g.rate}%)</MenuItem>)}
                      </TextField>
                    ) : null}
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <FormControlLabel control={<Switch checked={applyTds} onChange={(e) => setApplyTds(e.target.checked)} />} label={t('voucherEntry.applyTds')} />
                    {applyTds ? (
                      <TextField
                        fullWidth
                        size="small"
                        select
                        label="TDS"
                        value={selectedTds?.id || ''}
                        onChange={(e) => setSelectedTds(tdsCodes.find((g) => g.id === Number(e.target.value)) || null)}
                        sx={{ ...mvsSearchFieldSx, mt: 1 }}
                      >
                        {tdsCodes.map((g) => <MenuItem key={g.id} value={g.id}>{g.section} - {g.description}</MenuItem>)}
                      </TextField>
                    ) : null}
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <FormControlLabel control={<Switch checked={isInterState} onChange={(e) => setIsInterState(e.target.checked)} />} label={t('voucherEntry.interState')} />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      size="small"
                      multiline
                      minRows={2}
                      label={t('voucherEntry.narration')}
                      value={narration}
                      onChange={(e) => setNarration(e.target.value)}
                      sx={mvsSearchFieldSx}
                    />
                  </Grid>
                </Grid>

                {amountRows.length > 0 ? (
                  <Box sx={{ ...mvsBodyToolbarSx, mt: 2, borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <Box sx={{ width: '100%' }}>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>{t('voucherEntry.amountBreakdown')}</Typography>
                      {amountRows.map((row) => (
                        <Box key={row.key} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
                          <Typography variant="body2" color="text.secondary">{row.label}</Typography>
                          <Typography variant="body2" fontWeight={600}>{formatInr(amountDetails[row.key])}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                ) : null}
              </Box>
            </>
          ) : (
            <Box sx={bodyContentSx}>
              <Alert severity="info" variant="outlined" sx={{ mb: 2, borderRadius: '8px' }}>{t('voucherEntry.advancedHint')}</Alert>
              <VoucherLinesEditor lines={advancedLines} accounts={ledgerAccounts} onChange={setAdvancedLines} />
            </Box>
          )}
        </Card>

        <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 2 }}>
          <Box sx={mvsBodySectionHeaderSx}>
            <Typography variant="subtitle1" sx={sectionTitleSx}>{t('voucherEntry.preview.title')}</Typography>
            {balanced ? (
              <Chip icon={<CheckIcon />} label={t('voucherEntry.preview.balanced')} color="success" size="small" />
            ) : previewLines.length > 0 ? (
              <Chip icon={<WarningIcon />} label={t('voucherEntry.preview.unbalanced')} color="warning" size="small" />
            ) : null}
          </Box>
          <Box sx={{ px: { xs: 2, sm: 2.5 }, pb: 2 }}>
            <TableContainer sx={{ ...mvsBodyListTableSx, ...mvsTableScrollSx }}>
              <Table size="small">
                <TableHead sx={mvsTableHeadHighlightSx}>
                  <TableRow>
                    <TableCell>{t('voucherEntry.preview.category')}</TableCell>
                    <TableCell>{t('voucherEntry.preview.account')}</TableCell>
                    <TableCell align="right">{t('voucherEntry.preview.debit')}</TableCell>
                    <TableCell align="right">{t('voucherEntry.preview.credit')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewLines.map((line) => (
                    <TableRow key={line.lineNo} hover>
                      <TableCell>{line.lineCategory || '-'}</TableCell>
                      <TableCell>{line.accountName}</TableCell>
                      <TableCell align="right">{line.debit > 0 ? formatInr(line.debit) : '-'}</TableCell>
                      <TableCell align="right">{line.credit > 0 ? formatInr(line.credit) : '-'}</TableCell>
                    </TableRow>
                  ))}
                  {previewLines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                        {loading ? t('common.loading') : t('voucherEntry.preview.empty')}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
            {previewLines.length > 0 ? (
              <Box sx={{ mt: 2, display: 'flex', gap: 3, flexWrap: 'wrap', px: 0.5 }}>
                <Typography variant="body2">
                  {t('voucherEntry.preview.debitTotal')}: <strong>{formatInr(previewLines.reduce((s, l) => s + l.debit, 0))}</strong>
                </Typography>
                <Typography variant="body2">
                  {t('voucherEntry.preview.creditTotal')}: <strong>{formatInr(previewLines.reduce((s, l) => s + l.credit, 0))}</strong>
                </Typography>
              </Box>
            ) : null}
          </Box>
        </Card>

        <Box sx={{ ...mvsBodySectionHeaderSx, borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)', justifyContent: 'flex-end' }}>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Tooltip title={createGuard.tooltipTitle || (!balanced ? t('voucherEntry.errors.notBalanced') : '')}>
              <span>
                <Button
                  variant="outlined"
                  sx={mvsBodyOutlinedBtnSx}
                  disabled={saving || createGuard.disabled}
                  onClick={() => void handleSave('draft')}
                >
                  {t('voucherEntry.saveDraft')}
                </Button>
              </span>
            </Tooltip>
            <Tooltip title={createGuard.tooltipTitle || (!balanced ? t('voucherEntry.errors.notBalanced') : '')}>
              <span>
                <Button
                  variant="contained"
                  disableElevation
                  sx={mvsBodyPrimaryBtnSx}
                  disabled={saving || !balanced || createGuard.disabled}
                  onClick={() => void handleSave('posted')}
                >
                  {t('voucherEntry.post')}
                </Button>
              </span>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')} message={error} />
      <Snackbar open={!!success} autoHideDuration={4000} onClose={() => setSuccess('')} message={success} />
    </Box>
  );
};

export default VoucherEntry;
