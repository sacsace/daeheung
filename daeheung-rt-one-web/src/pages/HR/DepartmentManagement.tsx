import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert,
  Snackbar,
  CircularProgress,
  Pagination,
  Tooltip,
} from '@mui/material';
import { alpha, useTheme, type SxProps, type Theme } from '@mui/material/styles';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AccountTree as AccountTreeIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { departmentService } from '../../services/api';
import { useStore } from '../../store';
import { usePageMenuPermission } from '../../context/MenuPermissionContext';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import {
  mvsPageRootSx,
  mvsKpiCardSx,
  mvsBodyCardSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPrimaryBtnSx,
  mvsBodyListZoneSx,
  mvsBodyListTableSx,
  mvsTableHeadHighlightSx,
  mvsTableBodyRowSx,
  mvsTableScrollSx,
  mvsBodyPaginationSx,
  mvsSearchFieldSx,
  mvsFilterFieldHeightSx,
  mvsOutlinedLabelProps,
} from '../../theme/daeheungLayout';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';

const DEPTS_PER_PAGE = 15;
const DEPT_FORM_FIELD_SX = { ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx } as const;

type ListViewMode = 'page' | 'all';

const listViewModeBarSx = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 0.75,
  mb: 1.25,
} as const;

const listViewModeBtnSx = {
  height: 32,
  minWidth: 0,
  px: 1.5,
  textTransform: 'none' as const,
  fontWeight: 600,
  fontSize: '0.75rem',
  borderRadius: '8px',
  boxShadow: 'none',
  whiteSpace: 'nowrap' as const,
};

const deptTableBodyRowSx: SxProps<Theme> = (theme) => {
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

type DeptRow = {
  id: number;
  name: string;
  code?: string | null;
  sort_order: number;
  is_active: boolean;
};

type DeptFormState = {
  name: string;
  sort_order: number;
  is_active: boolean;
};

/** embedded: 사용자 관리 페이지 탭 안에 넣을 때 true (외곽 패딩·배경 중복 방지) */
export const DepartmentManagementPanel: React.FC<{
  embedded?: boolean;
  /** 회사별 부서 — 미지정 시 목록/등록 불가 */
  companyId?: number | null;
  /** 미전달 시 전부 true (단독 부서 관리 페이지) */
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}> = ({
  embedded = false,
  companyId = null,
  canCreate = true,
  canEdit = true,
  canDelete = true,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { dialogState, showConfirm, handleConfirm, handleCancel } = useConfirmDialog();
  const [rows, setRows] = useState<DeptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [listViewMode, setListViewMode] = useState<ListViewMode>('page');
  const [form, setForm] = useState<DeptFormState>({
    name: '',
    sort_order: 0,
    is_active: true,
  });

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

  const scopedCompanyId =
    companyId != null && Number.isFinite(Number(companyId)) ? Number(companyId) : null;

  const load = useCallback(async () => {
    if (scopedCompanyId == null) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await departmentService.list(true, scopedCompanyId);
      if (res.success && Array.isArray(res.data)) {
        setRows(res.data as DeptRow[]);
      } else {
        setError(t('departmentManagement.loadFailed'));
        setRows([]);
      }
    } catch {
      setError(t('departmentManagement.loadFailed'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [scopedCompanyId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const deptStats = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((row) => row.is_active !== false).length,
      inactive: rows.filter((row) => row.is_active === false).length,
    }),
    [rows]
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / DEPTS_PER_PAGE));
  const paginatedRows = useMemo(
    () => rows.slice((page - 1) * DEPTS_PER_PAGE, page * DEPTS_PER_PAGE),
    [rows, page]
  );

  const displayedRows = useMemo(
    () => (listViewMode === 'all' ? rows : paginatedRows),
    [rows, paginatedRows, listViewMode]
  );

  useEffect(() => {
    setPage(1);
  }, [rows.length, scopedCompanyId, listViewMode]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const openCreate = () => {
    if (!canCreate || scopedCompanyId == null) return;
    setEditingId(null);
    setForm({ name: '', sort_order: 0, is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (row: DeptRow) => {
    if (!canEdit) return;
    setEditingId(row.id);
    setForm({
      name: row.name,
      sort_order: row.sort_order ?? 0,
      is_active: row.is_active !== false,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name) {
      setError(t('departmentManagement.nameRequired'));
      return;
    }
    if (scopedCompanyId == null) {
      setError(t('departmentManagement.selectCompanyFirst'));
      return;
    }
    if (editingId != null && !canEdit) return;
    if (editingId == null && !canCreate) return;
    setError('');
    try {
      if (editingId != null) {
        const res = await departmentService.update(editingId, {
          name,
          sort_order: form.sort_order,
          is_active: form.is_active,
          company_id: scopedCompanyId,
        });
        if (!res.success) throw new Error();
      } else {
        const res = await departmentService.create({
          name,
          sort_order: form.sort_order,
          is_active: form.is_active,
          company_id: scopedCompanyId,
        });
        if (!res.success) throw new Error();
      }
      setSuccess(t('departmentManagement.saved'));
      setDialogOpen(false);
      await load();
    } catch {
      setError(t('departmentManagement.saveFailed'));
    }
  };

  const handleDelete = (row: DeptRow) => {
    if (!canDelete || scopedCompanyId == null) return;
    showConfirm(
      t('departmentManagement.deleteConfirm'),
      () => {
        void (async () => {
          try {
            const res = await departmentService.delete(row.id, scopedCompanyId);
            if (!res.success) throw new Error();
            setSuccess(t('departmentManagement.deleted'));
            await load();
          } catch (e: any) {
            const msg = e?.response?.data?.message;
            setError(msg || t('departmentManagement.deleteFailed'));
          }
        })();
      },
      {
        title: t('common.confirm'),
        confirmColor: 'error',
        confirmText: t('common.delete'),
        cancelText: t('common.cancel'),
      }
    );
  };

  if (scopedCompanyId == null) {
    const selectCompanyBlock = (
      <Box sx={listStateBoxSx}>
        <AccountTreeIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.35 }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {t('departmentManagement.selectCompanyFirst')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('departmentManagement.selectCompanyHint')}
        </Typography>
      </Box>
    );
    if (embedded) return selectCompanyBlock;
    return <Box sx={mvsPageRootSx}>{selectCompanyBlock}</Box>;
  }

  const content = (
    <>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          gap: 2.5,
          mb: 3,
        }}
      >
        {[
          { key: 'total', label: t('departmentManagement.stats.total'), value: deptStats.total },
          { key: 'active', label: t('departmentManagement.stats.active'), value: deptStats.active },
          { key: 'inactive', label: t('departmentManagement.stats.inactive'), value: deptStats.inactive },
        ].map((item) => (
          <Card key={item.key} elevation={0} sx={mvsKpiCardSx}>
            <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
                {item.label}
              </Typography>
              <Typography variant="h5" sx={{ mt: 0.75, fontWeight: 600, letterSpacing: '-0.02em', color: 'text.primary' }}>
                {item.value}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Card elevation={0} sx={mvsBodyCardSx}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            px: { xs: 2, sm: 2.5 },
            py: 1.5,
            bgcolor: '#FFFFFF',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <AccountTreeIcon sx={{ fontSize: 20, color: 'primary.main', flexShrink: 0 }} />
            <Typography
              component="h2"
              sx={{
                fontSize: '0.9375rem',
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: 'text.primary',
              }}
            >
              {t('departmentManagement.title')}
            </Typography>
          </Box>
          <Button
            variant="contained"
            disableElevation
            size="small"
            startIcon={<AddIcon fontSize="small" />}
            onClick={openCreate}
            disabled={!canCreate}
            sx={mvsBodyPrimaryBtnSx}
          >
            {t('departmentManagement.add')}
          </Button>
        </Box>
      </Card>

      <Box sx={mvsBodyListZoneSx}>
        {loading ? (
          <Box sx={listStateBoxSx}>
            <CircularProgress size={36} />
            <Typography variant="body2" color="text.secondary">
              {t('departmentManagement.empty.loading')}
            </Typography>
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={listStateBoxSx}>
            <AccountTreeIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.3 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em', color: 'text.primary' }}>
              {t('departmentManagement.empty.noItems')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
              {t('departmentManagement.empty.noItemsHint')}
            </Typography>
            <Button
              variant="contained"
              disableElevation
              size="small"
              startIcon={<AddIcon fontSize="small" />}
              onClick={openCreate}
              disabled={!canCreate}
              sx={mvsBodyPrimaryBtnSx}
            >
              {t('departmentManagement.add')}
            </Button>
          </Box>
        ) : (
          <>
            <Box sx={listViewModeBarSx}>
              <Button
                size="small"
                disableElevation
                variant={listViewMode === 'all' ? 'contained' : 'outlined'}
                onClick={() => setListViewMode('all')}
                sx={{
                  ...listViewModeBtnSx,
                  ...(listViewMode === 'all'
                    ? { bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' } }
                    : { borderColor: '#CBD5E1', color: 'text.secondary', bgcolor: '#FFFFFF' }),
                }}
              >
                {t('departmentManagement.listView.viewAll')}
              </Button>
              <Button
                size="small"
                disableElevation
                variant={listViewMode === 'page' ? 'contained' : 'outlined'}
                onClick={() => setListViewMode('page')}
                sx={{
                  ...listViewModeBtnSx,
                  ...(listViewMode === 'page'
                    ? { bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' } }
                    : { borderColor: '#CBD5E1', color: 'text.secondary', bgcolor: '#FFFFFF' }),
                }}
              >
                {t('departmentManagement.listView.viewPages')}
              </Button>
            </Box>
            <TableContainer sx={{ ...mvsBodyListTableSx, ...mvsTableScrollSx }}>
              <Table
                size="small"
                sx={{
                  tableLayout: 'fixed',
                  width: '100%',
                  borderCollapse: 'collapse',
                  bgcolor: 'transparent',
                  '& .MuiTableCell-root': {
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderTop: 'none',
                  },
                }}
              >
                <TableHead sx={mvsTableHeadHighlightSx}>
                  <TableRow>
                    <TableCell sx={{ overflow: 'hidden' }}>{t('departmentManagement.name')}</TableCell>
                    <TableCell align="right" sx={{ width: 96, overflow: 'hidden' }}>
                      {t('departmentManagement.sortOrder')}
                    </TableCell>
                    <TableCell sx={{ width: 112, overflow: 'hidden' }}>{t('departmentManagement.active')}</TableCell>
                    <TableCell align="center" sx={{ width: 96 }} />
                  </TableRow>
                </TableHead>
                <TableBody sx={deptTableBodyRowSx}>
                  {displayedRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell sx={{ overflow: 'hidden' }}>
                        <Typography variant="body2" fontWeight={600} noWrap title={row.name}>
                          {row.name}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                        {row.sort_order}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>
                        {row.is_active ? t('departmentManagement.active') : t('departmentManagement.inactive')}
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                          <Tooltip title={canEdit ? t('departmentManagement.edit') : ''}>
                            <span style={{ display: 'inline-flex' }}>
                              <IconButton
                                size="small"
                                onClick={() => openEdit(row)}
                                aria-label={t('departmentManagement.edit')}
                                disabled={!canEdit}
                                sx={{
                                  color: 'text.secondary',
                                  borderRadius: '10px',
                                  '&:hover': {
                                    color: 'primary.main',
                                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                                  },
                                }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={canDelete ? t('departmentManagement.delete') : ''}>
                            <span style={{ display: 'inline-flex' }}>
                              <IconButton
                                size="small"
                                onClick={() => void handleDelete(row)}
                                aria-label={t('departmentManagement.delete')}
                                disabled={!canDelete}
                                sx={{
                                  color: alpha(theme.palette.text.secondary, theme.palette.mode === 'light' ? 0.72 : 1),
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {listViewMode === 'page' ? (
              <Box sx={mvsBodyPaginationSx}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, value) => setPage(value)}
                  color="primary"
                  shape="rounded"
                  sx={{
                    '& .MuiPaginationItem-root': {
                      borderRadius: '10px',
                      fontWeight: 500,
                    },
                  }}
                />
              </Box>
            ) : (
              <Box sx={{ ...mvsBodyPaginationSx, justifyContent: 'flex-end' }}>
                <Typography variant="body2" color="text.secondary">
                  {t('departmentManagement.listView.showingAll', { count: displayedRows.length })}
                </Typography>
              </Box>
            )}
          </>
        )}
      </Box>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '8px' } }}
      >
        <DialogTitle sx={{ pt: 2.5, px: 3, pb: 1, fontSize: '1.125rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
          {editingId != null ? t('departmentManagement.edit') : t('departmentManagement.add')}
        </DialogTitle>
        <DialogContent
          sx={{
            px: 3,
            pb: 1,
            overflow: 'visible',
            // DialogTitle 바로 아래면 MUI 기본 pt:0 이라 shrink 라벨이 잘림
            pt: '20px !important',
            ...DEPT_FORM_FIELD_SX,
          }}
        >
          <TextField
            autoFocus
            margin="dense"
            label={t('departmentManagement.name')}
            fullWidth
            size="small"
            {...mvsOutlinedLabelProps}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            sx={{ mb: 2.5, mt: 0.5, overflow: 'visible' }}
          />
          <TextField
            margin="dense"
            type="number"
            label={t('departmentManagement.sortOrder')}
            fullWidth
            size="small"
            {...mvsOutlinedLabelProps}
            value={form.sort_order}
            onChange={(e) => setForm((f) => ({ ...f, sort_order: parseInt(e.target.value, 10) || 0 }))}
            sx={{ mb: 2, overflow: 'visible' }}
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
            }
            label={t('departmentManagement.active')}
            sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.875rem', fontWeight: 500 } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} sx={mvsBodyOutlinedBtnSx}>
            {t('departmentManagement.cancel')}
          </Button>
          <Button
            variant="contained"
            disableElevation
            size="small"
            onClick={() => void handleSave()}
            disabled={(editingId != null && !canEdit) || (editingId == null && !canCreate)}
            sx={mvsBodyPrimaryBtnSx}
          >
            {t('departmentManagement.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')}>
        <Alert severity="error" onClose={() => setError('')} sx={{ borderRadius: '8px' }}>
          {error}
        </Alert>
      </Snackbar>
      <Snackbar open={!!success} autoHideDuration={3000} onClose={() => setSuccess('')}>
        <Alert severity="success" onClose={() => setSuccess('')} sx={{ borderRadius: '8px' }}>
          {success}
        </Alert>
      </Snackbar>

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
    </>
  );

  if (embedded) {
    return (
      <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
        {content}
      </Box>
    );
  }

  return (
    <Box sx={mvsPageRootSx}>
      <DaeheungPageHeader title={t('departmentManagement.title')} description={t('departmentManagement.description')} />
      {content}
    </Box>
  );
};

const DEPARTMENT_MENU_ROUTES = ['/hr/users', '/hr/departments', '/hr'] as const;

const DepartmentManagement: React.FC = () => {
  const { user } = useStore();
  const { t } = useTranslation();
  const menuFlags = usePageMenuPermission(DEPARTMENT_MENU_ROUTES);
  return (
    <Box>
      {!menuFlags.menusLoading && !menuFlags.canRead && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {t('common.menuNoView')}
        </Alert>
      )}
      <DepartmentManagementPanel
        companyId={user?.company_id != null ? Number(user.company_id) : null}
        canCreate={menuFlags.canCreate}
        canEdit={menuFlags.canEdit}
        canDelete={menuFlags.canDelete}
      />
    </Box>
  );
};

export default DepartmentManagement;
