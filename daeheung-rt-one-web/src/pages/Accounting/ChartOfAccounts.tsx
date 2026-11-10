import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme, type SxProps, type Theme } from '@mui/material/styles';
import {
  AccountBalance as AccountBalanceIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  RestartAlt as ResetIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import AccountingCompanyBar from '../../components/Accounting/AccountingCompanyBar';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import { useAccountingCompany } from '../../hooks/useAccountingCompany';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useStore } from '../../store';
import { getGlAccountName } from '../../utils/glAccountLabel';
import { toSentenceCase } from '../../utils/textCase';
import {
  mvsBodyCardSx,
  mvsBodyListTableSx,
  mvsBodyListZoneSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPaginationSx,
  mvsBodyPrimaryBtnSx,
  mvsFilterFieldHeightSx,
  mvsOutlinedLabelProps,
  mvsPageRootSx,
  mvsSearchFieldSx,
  mvsTableBodyRowSx,
  mvsTableHeadHighlightSx,
  mvsTableScrollSx,
} from '../../theme/daeheungLayout';
import { accountingService } from '../../services/api';
import { usePageMenuPermission } from '../../context/MenuPermissionContext';
import { useMenuActionGuard } from '../../hooks/useMenuActionGuard';

const CHART_OF_ACCOUNTS_MENU_ROUTES = ['/accounting/chart-of-accounts', '/accounting/books'] as const;

type GlAccount = {
  id: number;
  code: string;
  name: string;
  name_en?: string;
  account_type: 'group' | 'ledger';
  nature: string;
  current_balance: number;
  is_system?: boolean;
};

const ACCOUNTS_PER_PAGE = 15;

const chartFilterFieldSx = {
  ...(mvsSearchFieldSx as Record<string, unknown>),
  ...mvsFilterFieldHeightSx,
} as const;

const chartTableSx = {
  width: '100%',
  tableLayout: 'fixed' as const,
  minWidth: 480,
  borderCollapse: 'collapse',
  bgcolor: 'transparent',
  '& .MuiTableCell-root': {
    borderLeft: 'none',
    borderRight: 'none',
    borderTop: 'none',
  },
} as const;

const chartCellEllipsisSx = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: 0,
} as const;

const chartTableBodyRowSx: SxProps<Theme> = (theme) => {
  const base = typeof mvsTableBodyRowSx === 'function' ? mvsTableBodyRowSx(theme) : mvsTableBodyRowSx;
  const rowBg = theme.palette.mode === 'light' ? '#FFFFFF' : theme.palette.background.paper;
  const hoverBg = theme.palette.mode === 'light' ? '#EFF6FF' : theme.palette.action.hover;
  return {
    ...(base as object),
    '& .MuiTableRow-root:nth-of-type(odd)': { bgcolor: rowBg },
    '& .MuiTableRow-root:nth-of-type(even)': { bgcolor: rowBg },
    '& .MuiTableRow-root:hover': { bgcolor: hoverBg },
  };
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

const emptyForm = () => ({
  code: '',
  name: '',
  nameEn: '',
  nature: 'expense',
});

const renderEllipsisText = (text: string) => (
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

const ChartOfAccounts: React.FC = () => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useStore();
  const menuFlags = usePageMenuPermission(CHART_OF_ACCOUNTS_MENU_ROUTES);
  const createGuard = useMenuActionGuard('create', CHART_OF_ACCOUNTS_MENU_ROUTES);
  const editGuard = useMenuActionGuard('edit', CHART_OF_ACCOUNTS_MENU_ROUTES);
  const deleteGuard = useMenuActionGuard('delete', CHART_OF_ACCOUNTS_MENU_ROUTES);
  const mutateGuard = useMenuActionGuard('mutate', CHART_OF_ACCOUNTS_MENU_ROUTES);
  const canManage = menuFlags.canMutate;
  const {
    canSelectCompany,
    companies,
    selectedCompanyId,
    effectiveCompanyId,
    selectedCompanyName,
    changeCompany,
  } = useAccountingCompany();
  const { dialogState, showConfirm, handleConfirm, handleCancel } = useConfirmDialog();

  const [rows, setRows] = useState<GlAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GlAccount | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const natureOptions = ['asset', 'liability', 'equity', 'income', 'expense'] as const;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await accountingService.getGlAccounts({
        ledgerOnly: true,
        company_id: effectiveCompanyId,
      });
      setRows(Array.isArray(response?.data) ? response.data : []);
    } catch (err: any) {
      setError(err?.response?.data?.message || t('chartOfAccounts.errors.load'));
    } finally {
      setLoading(false);
    }
  }, [effectiveCompanyId, t]);

  useEffect(() => {
    if (menuFlags.menusLoading || !menuFlags.canRead) return;
    load();
  }, [load, menuFlags.menusLoading, menuFlags.canRead]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.code.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q) ||
        String(row.name_en || '')
          .toLowerCase()
          .includes(q)
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ACCOUNTS_PER_PAGE));

  const paginatedRows = useMemo(
    () => filteredRows.slice((page - 1) * ACCOUNTS_PER_PAGE, page * ACCOUNTS_PER_PAGE),
    [filteredRows, page]
  );

  const hasActiveFilters = Boolean(search.trim());

  useEffect(() => {
    setPage(1);
  }, [search, effectiveCompanyId]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleResetFilters = () => {
    setSearch('');
  };

  const openCreate = () => {
    if (!createGuard.guard()) return;
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (row: GlAccount) => {
    if (!editGuard.guard()) return;
    setEditing(row);
    setForm({
      code: row.code,
      name: row.name,
      nameEn: row.name_en || '',
      nature: row.nature || 'expense',
    });
    setDialogOpen(true);
  };

  const handleSeed = async () => {
    if (!mutateGuard.guard()) return;
    try {
      const response = await accountingService.seedGlAccounts(effectiveCompanyId);
      setSuccess(response?.message || t('chartOfAccounts.success.seeded'));
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || t('chartOfAccounts.errors.seed'));
    }
  };

  const handleSave = async () => {
    if (editing ? !editGuard.guard() : !createGuard.guard()) return;
    if (!form.code.trim() || !form.name.trim()) {
      setError(t('chartOfAccounts.errors.codeNameRequired'));
      return;
    }
    try {
      setSaving(true);
      const payload = {
        code: form.code.trim(),
        name: toSentenceCase(form.name),
        nameEn: form.nameEn.trim() ? toSentenceCase(form.nameEn) : undefined,
        nature: form.nature,
        accountType: 'ledger',
      };
      if (editing) {
        await accountingService.updateGlAccount(editing.id, payload, effectiveCompanyId);
        setSuccess(t('chartOfAccounts.success.updated'));
      } else {
        await accountingService.createGlAccount(payload, effectiveCompanyId);
        setSuccess(t('chartOfAccounts.success.created'));
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm());
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || t('chartOfAccounts.errors.save'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (row: GlAccount) => {
    if (!deleteGuard.guard()) return;
    showConfirm(
      t('chartOfAccounts.deleteConfirm'),
      () => {
        void (async () => {
          try {
            await accountingService.deleteGlAccount(row.id, effectiveCompanyId);
            setSuccess(t('chartOfAccounts.success.deleted'));
            await load();
          } catch (err: any) {
            setError(err?.response?.data?.message || t('chartOfAccounts.errors.delete'));
          }
        })();
      },
      {
        title: t('common.delete'),
        confirmColor: 'error',
        confirmText: t('common.delete'),
        cancelText: t('common.cancel'),
      }
    );
  };

  const booksPath =
    effectiveCompanyId
      ? `/accounting/books?tab=accounts&company_id=${effectiveCompanyId}`
      : '/accounting/books?tab=accounts';

  return (
    <Box sx={mvsPageRootSx}>
      <DaeheungPageHeader
        title={t('chartOfAccounts.title')}
        description={t('chartOfAccounts.description')}
      />

      <AccountingCompanyBar
        canSelectCompany={canSelectCompany}
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        selectedCompanyName={selectedCompanyName}
        onChangeCompany={changeCompany}
      />

      {!menuFlags.menusLoading && !menuFlags.canRead && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {t('common.menuNoView')}
        </Alert>
      )}

      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 3 }}>
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
              onClick={() => navigate(booksPath)}
              sx={mvsBodyOutlinedBtnSx}
            >
              {t('chartOfAccounts.booksLink')}
            </Button>
            <Tooltip title={mutateGuard.tooltipTitle} disableHoverListener={!mutateGuard.tooltipTitle}>
              <span>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleSeed}
                  disabled={mutateGuard.disabled}
                  sx={mvsBodyOutlinedBtnSx}
                >
                  {t('chartOfAccounts.seed')}
                </Button>
              </span>
            </Tooltip>
          </Box>
          <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 1,
                flexShrink: 0,
                width: { xs: '100%', md: 'auto' },
                ml: { md: 'auto' },
              }}
            >
              <Tooltip title={createGuard.tooltipTitle} disableHoverListener={!createGuard.tooltipTitle}>
                <span>
                  <Button
                    variant="contained"
                    disableElevation
                    size="small"
                    startIcon={<AddIcon fontSize="small" />}
                    sx={mvsBodyPrimaryBtnSx}
                    onClick={openCreate}
                    disabled={createGuard.disabled}
                  >
                    {t('chartOfAccounts.add')}
                  </Button>
                </span>
              </Tooltip>
            </Box>
        </Box>

        <Box
          sx={{
            px: { xs: 2, sm: 2.5 },
            py: 2,
            bgcolor: '#FFFFFF',
            ...(mvsSearchFieldSx as Record<string, unknown>),
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' },
            gap: 2,
            alignItems: 'flex-end',
          }}
        >
          <TextField
            fullWidth
            size="small"
            label={t('common.search')}
            placeholder={t('chartOfAccounts.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={chartFilterFieldSx}
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
            size="small"
            startIcon={<ResetIcon fontSize="small" />}
            onClick={handleResetFilters}
            sx={{
              ...mvsBodyOutlinedBtnSx,
              height: 40,
              whiteSpace: 'nowrap',
              width: { xs: '100%', sm: 'auto' },
              minWidth: { sm: 120 },
            }}
          >
            {t('common.reset')}
          </Button>
        </Box>
      </Card>

      <Box sx={mvsBodyListZoneSx}>
        {loading ? (
          <Box sx={listStateBoxSx}>
            <CircularProgress size={36} />
            <Typography variant="body2" color="text.secondary">
              {t('chartOfAccounts.loading')}
            </Typography>
          </Box>
        ) : filteredRows.length === 0 ? (
          <Box sx={listStateBoxSx}>
            <AccountBalanceIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.3 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em', color: 'text.primary' }}>
              {hasActiveFilters ? t('chartOfAccounts.emptyNoResults') : t('chartOfAccounts.empty')}
            </Typography>
            {hasActiveFilters ? (
              <Button
                variant="outlined"
                size="small"
                startIcon={<ResetIcon fontSize="small" />}
                onClick={handleResetFilters}
                sx={mvsBodyOutlinedBtnSx}
              >
                {t('common.reset')}
              </Button>
            ) : canManage ? (
              <Button
                variant="contained"
                disableElevation
                size="small"
                startIcon={<AddIcon fontSize="small" />}
                sx={mvsBodyPrimaryBtnSx}
                onClick={openCreate}
              >
                {t('chartOfAccounts.add')}
              </Button>
            ) : null}
          </Box>
        ) : (
          <>
            <TableContainer sx={{ ...mvsBodyListTableSx, ...mvsTableScrollSx }}>
              <Table size="small" sx={chartTableSx}>
                <TableHead sx={mvsTableHeadHighlightSx}>
                  <TableRow>
                    <TableCell width="18%" sx={{ whiteSpace: 'nowrap' }}>
                      <Box component="span" sx={chartCellEllipsisSx} title={t('chartOfAccounts.columns.code')}>
                        {t('chartOfAccounts.columns.code')}
                      </Box>
                    </TableCell>
                    <TableCell sx={chartCellEllipsisSx}>
                      <Box component="span" sx={chartCellEllipsisSx} title={t('chartOfAccounts.columns.name')}>
                        {t('chartOfAccounts.columns.name')}
                      </Box>
                    </TableCell>
                    {menuFlags.canMutate && (
                      <TableCell width="14%" align="center" sx={{ whiteSpace: 'nowrap' }}>
                        <Box component="span" sx={chartCellEllipsisSx} title={t('chartOfAccounts.columns.actions')}>
                          {t('chartOfAccounts.columns.actions')}
                        </Box>
                      </TableCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody sx={chartTableBodyRowSx}>
                  {paginatedRows.map((row) => {
                    const accountName = getGlAccountName(row, i18n.language);
                    return (
                      <TableRow key={row.id} hover>
                        <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {row.code}
                        </TableCell>
                        <TableCell sx={chartCellEllipsisSx}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                            <Box sx={{ minWidth: 0, flex: 1 }}>{renderEllipsisText(accountName)}</Box>
                            {row.is_system && (
                              <Chip
                                size="small"
                                label={t('chartOfAccounts.system')}
                                variant="outlined"
                                sx={{ flexShrink: 0, fontWeight: 500, borderRadius: '8px' }}
                              />
                            )}
                          </Box>
                        </TableCell>
                        {menuFlags.canMutate && (
                          <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                              <Tooltip title={editGuard.tooltipTitle || t('common.edit')}>
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={() => openEdit(row)}
                                    disabled={editGuard.disabled}
                                    sx={{ borderRadius: '10px' }}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title={deleteGuard.tooltipTitle || t('common.delete')}>
                                <span>
                                  <IconButton
                                    size="small"
                                    disabled={Boolean(row.is_system) || deleteGuard.disabled}
                                    onClick={() => handleDelete(row)}
                                    sx={{
                                      color: alpha(
                                        theme.palette.text.secondary,
                                        theme.palette.mode === 'light' ? 0.72 : 1
                                      ),
                                      borderRadius: '10px',
                                      transition: 'color 0.15s ease, background-color 0.15s ease',
                                      '&:hover': {
                                        color: 'error.main',
                                        bgcolor: alpha(theme.palette.error.main, 0.12),
                                      },
                                    }}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            {totalPages > 1 && (
              <Box sx={mvsBodyPaginationSx}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, value) => setPage(value)}
                  color="primary"
                  shape="rounded"
                  size="small"
                />
              </Box>
            )}
          </>
        )}
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          {editing ? t('chartOfAccounts.dialog.editTitle') : t('chartOfAccounts.dialog.createTitle')}
        </DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: 1 }}>
          <TextField
            label={t('chartOfAccounts.dialog.code')}
            value={form.code}
            onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
            disabled={Boolean(editing?.is_system)}
          />
          <TextField
            label={t('chartOfAccounts.dialog.name')}
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            onBlur={() => setForm((p) => ({ ...p, name: toSentenceCase(p.name) }))}
          />
          <TextField
            label={t('chartOfAccounts.dialog.nameEn')}
            value={form.nameEn}
            onChange={(e) => setForm((p) => ({ ...p, nameEn: e.target.value }))}
            onBlur={() => setForm((p) => ({ ...p, nameEn: p.nameEn ? toSentenceCase(p.nameEn) : '' }))}
          />
          <FormControl fullWidth>
            <InputLabel>{t('chartOfAccounts.dialog.nature')}</InputLabel>
            <Select
              label={t('chartOfAccounts.dialog.nature')}
              value={form.nature}
              onChange={(e) => setForm((p) => ({ ...p, nature: e.target.value }))}
            >
              {natureOptions.map((n) => (
                <MenuItem key={n} value={n}>
                  {t(`generalLedger.nature.${n}`)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={dialogState.open}
        title={dialogState.title}
        message={dialogState.message}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        confirmColor={dialogState.confirmColor}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      <Snackbar open={Boolean(error)} autoHideDuration={5000} onClose={() => setError('')}>
        <Alert severity="error">{error}</Alert>
      </Snackbar>
      <Snackbar open={Boolean(success)} autoHideDuration={3000} onClose={() => setSuccess('')}>
        <Alert severity="success">{success}</Alert>
      </Snackbar>
    </Box>
  );
};

export default ChartOfAccounts;
