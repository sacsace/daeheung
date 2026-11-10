import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Switch,
  TextField,
  Typography,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
  Chip,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  KeyboardArrowUp as ArrowUpIcon,
  KeyboardArrowDown as ArrowDownIcon,
  MilitaryTech as RankIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { positionService } from '../../services/api';
import { useStore } from '../../store';
import { usePageMenuPermission } from '../../context/MenuPermissionContext';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import {
  mvsPageRootSx,
  mvsBodyCardSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPrimaryBtnSx,
  mvsBodyListZoneSx,
  mvsBodyListTableSx,
  mvsSearchFieldSx,
  mvsFilterFieldHeightSx,
  mvsOutlinedLabelProps,
} from '../../theme/daeheungLayout';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import { formatPositionLabel } from '../../utils/positionLabels';

const POS_FORM_FIELD_SX = { ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx } as const;

type PosRow = {
  id: number;
  name: string;
  code?: string | null;
  sort_order: number;
  is_active: boolean;
};

type PosFormState = {
  name: string;
  sort_order: number;
  is_active: boolean;
};

/** 순서 표장 — 상위일수록 바 개수↑ */
const RankInsignia: React.FC<{ level: number; total: number; inactive?: boolean }> = ({
  level,
  total,
  inactive,
}) => {
  const theme = useTheme();
  const bars = Math.max(1, Math.min(5, total - level + 1));
  const color = inactive
    ? theme.palette.text.disabled
    : theme.palette.primary.main;

  return (
    <Box
      aria-hidden
      sx={{
        display: 'flex',
        flexDirection: 'column-reverse',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '3px',
        width: 28,
        minHeight: 28,
        flexShrink: 0,
      }}
    >
      {Array.from({ length: bars }, (_, i) => (
        <Box
          key={i}
          sx={{
            width: 10 + i * 4,
            height: 3,
            borderRadius: 1,
            bgcolor: color,
            opacity: inactive ? 0.45 : 0.55 + i * 0.1,
          }}
        />
      ))}
    </Box>
  );
};

/** embedded: 사용자 관리 페이지 탭 안에 넣을 때 true */
export const PositionManagementPanel: React.FC<{
  embedded?: boolean;
  companyId?: number | null;
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
  const { t, i18n } = useTranslation();
  const { dialogState, showConfirm, handleConfirm, handleCancel } = useConfirmDialog();
  const [rows, setRows] = useState<PosRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  const [form, setForm] = useState<PosFormState>({
    name: '',
    sort_order: 1,
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
      const res = await positionService.list(true, scopedCompanyId);
      if (res.success && Array.isArray(res.data)) {
        const list = (res.data as PosRow[]).slice().sort((a, b) => {
          const so = (a.sort_order ?? 0) - (b.sort_order ?? 0);
          if (so !== 0) return so;
          return a.name.localeCompare(b.name, 'ko');
        });
        setRows(list);
      } else {
        setError(t('positionManagement.loadFailed'));
        setRows([]);
      }
    } catch {
      setError(t('positionManagement.loadFailed'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [scopedCompanyId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const nextRankLevel = useMemo(() => {
    if (rows.length === 0) return 1;
    return Math.max(...rows.map((r) => r.sort_order ?? 0)) + 1;
  }, [rows]);

  const openCreate = () => {
    if (!canCreate || scopedCompanyId == null) return;
    setEditingId(null);
    setForm({ name: '', sort_order: nextRankLevel, is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (row: PosRow) => {
    if (!canEdit) return;
    setEditingId(row.id);
    setForm({
      name: row.name,
      sort_order: row.sort_order ?? 1,
      is_active: row.is_active !== false,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name) {
      setError(t('positionManagement.nameRequired'));
      return;
    }
    if (scopedCompanyId == null) {
      setError(t('positionManagement.selectCompanyFirst'));
      return;
    }
    if (editingId != null && !canEdit) return;
    if (editingId == null && !canCreate) return;
    const sort_order = Number.isFinite(form.sort_order) && form.sort_order > 0 ? form.sort_order : 1;
    setError('');
    try {
      if (editingId != null) {
        const res = await positionService.update(editingId, {
          name,
          sort_order,
          is_active: form.is_active,
          company_id: scopedCompanyId,
        });
        if (!res.success) throw new Error();
      } else {
        const res = await positionService.create({
          name,
          sort_order,
          is_active: form.is_active,
          company_id: scopedCompanyId,
        });
        if (!res.success) throw new Error();
      }
      setSuccess(t('positionManagement.saved'));
      setDialogOpen(false);
      await load();
    } catch {
      setError(t('positionManagement.saveFailed'));
    }
  };

  const handleDelete = (row: PosRow) => {
    if (!canDelete || scopedCompanyId == null) return;
    showConfirm(
      t('positionManagement.deleteConfirm'),
      () => {
        void (async () => {
          try {
            const res = await positionService.delete(row.id, scopedCompanyId);
            if (!res.success) throw new Error();
            setSuccess(t('positionManagement.deleted'));
            await load();
          } catch (e: any) {
            const msg = e?.response?.data?.message;
            setError(msg || t('positionManagement.deleteFailed'));
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

  const moveRank = async (index: number, direction: -1 | 1) => {
    if (!canEdit || scopedCompanyId == null || reordering) return;
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const a = rows[index];
    const b = rows[target];
    setReordering(true);
    setError('');
    try {
      const [r1, r2] = await Promise.all([
        positionService.update(a.id, {
          sort_order: b.sort_order,
          company_id: scopedCompanyId,
        }),
        positionService.update(b.id, {
          sort_order: a.sort_order,
          company_id: scopedCompanyId,
        }),
      ]);
      if (!r1.success || !r2.success) throw new Error();
      await load();
    } catch {
      setError(t('positionManagement.reorderFailed'));
    } finally {
      setReordering(false);
    }
  };

  if (scopedCompanyId == null) {
    const selectCompanyBlock = (
      <Box sx={listStateBoxSx}>
        <RankIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.35 }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {t('positionManagement.selectCompanyFirst')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('positionManagement.selectCompanyHint')}
        </Typography>
      </Box>
    );
    if (embedded) return selectCompanyBlock;
    return <Box sx={mvsPageRootSx}>{selectCompanyBlock}</Box>;
  }

  const content = (
    <>
      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            px: { xs: 2, sm: 2.5 },
            py: 1.75,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <RankIcon sx={{ fontSize: 22, color: 'primary.main', flexShrink: 0 }} />
              <Typography
                component="h2"
                sx={{
                  fontSize: '0.9375rem',
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  color: 'text.primary',
                }}
              >
                {t('positionManagement.title')}
              </Typography>
              {!loading && (
                <Chip
                  size="small"
                  label={t('positionManagement.stats.totalCount', { count: rows.length })}
                  sx={{
                    height: 22,
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    color: 'primary.main',
                    borderRadius: '6px',
                  }}
                />
              )}
            </Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5, ml: { xs: 0, sm: 4 }, fontSize: '0.75rem', lineHeight: 1.45 }}
            >
              {t('positionManagement.ladderHint')}
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
            {t('positionManagement.add')}
          </Button>
        </Box>
      </Card>

      <Box sx={mvsBodyListZoneSx}>
        {loading ? (
          <Box sx={listStateBoxSx}>
            <CircularProgress size={36} />
            <Typography variant="body2" color="text.secondary">
              {t('positionManagement.empty.loading')}
            </Typography>
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={listStateBoxSx}>
            <RankIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.3 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
              {t('positionManagement.empty.noItems')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 440 }}>
              {t('positionManagement.empty.noItemsHint')}
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
              {t('positionManagement.add')}
            </Button>
          </Box>
        ) : (
          <Box
            sx={{
              ...mvsBodyListTableSx,
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
              py: 0.5,
              px: { xs: 1, sm: 1.5 },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 1,
                color: 'text.secondary',
              }}
            >
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {t('positionManagement.highest')}
              </Typography>
              <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
            </Box>

            {rows.map((row, index) => {
              const inactive = row.is_active === false;
              return (
                <Box
                  key={row.id}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'auto 1fr auto',
                      sm: 'auto auto 1fr auto auto',
                    },
                    alignItems: 'center',
                    columnGap: { xs: 1.25, sm: 1.75 },
                    rowGap: 0.5,
                    px: { xs: 1.25, sm: 1.75 },
                    py: 1.25,
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: 'transparent',
                    opacity: inactive ? 0.72 : 1,
                    transition: 'background-color 0.15s ease, border-color 0.15s ease',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.04),
                      borderColor: alpha(theme.palette.primary.main, 0.12),
                    },
                  }}
                >
                  <Typography
                    sx={{
                      width: 36,
                      textAlign: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      color: inactive ? 'text.disabled' : 'primary.main',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {t('positionManagement.rankBadge', { level: index + 1 })}
                  </Typography>

                  <Box sx={{ display: { xs: 'none', sm: 'flex' } }}>
                    <RankInsignia level={index + 1} total={rows.length} inactive={inactive} />
                  </Box>

                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      noWrap
                      title={formatPositionLabel(row.name, i18n.language)}
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        letterSpacing: '-0.01em',
                        color: inactive ? 'text.secondary' : 'text.primary',
                      }}
                    >
                      {formatPositionLabel(row.name, i18n.language)}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 0.15, fontSize: '0.6875rem' }}
                    >
                      {inactive
                        ? t('positionManagement.inactive')
                        : t('positionManagement.rankLevelLabel', { level: row.sort_order })}
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.15,
                      gridColumn: { xs: '3', sm: 'auto' },
                      gridRow: { xs: '1 / span 1', sm: 'auto' },
                    }}
                  >
                    <Tooltip title={t('positionManagement.moveUp')}>
                      <span>
                        <IconButton
                          size="small"
                          disabled={!canEdit || reordering || index === 0}
                          onClick={() => void moveRank(index, -1)}
                          aria-label={t('positionManagement.moveUp')}
                          sx={{ p: 0.35, color: 'text.secondary' }}
                        >
                          <ArrowUpIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={t('positionManagement.moveDown')}>
                      <span>
                        <IconButton
                          size="small"
                          disabled={!canEdit || reordering || index === rows.length - 1}
                          onClick={() => void moveRank(index, 1)}
                          aria-label={t('positionManagement.moveDown')}
                          sx={{ p: 0.35, color: 'text.secondary' }}
                        >
                          <ArrowDownIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 0.25, justifySelf: { xs: 'end', sm: 'center' } }}>
                    <Tooltip title={canEdit ? t('positionManagement.edit') : ''}>
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => openEdit(row)}
                          disabled={!canEdit}
                          aria-label={t('positionManagement.edit')}
                          sx={{
                            color: 'text.secondary',
                            borderRadius: '8px',
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
                    <Tooltip title={canDelete ? t('positionManagement.delete') : ''}>
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(row)}
                          disabled={!canDelete}
                          aria-label={t('positionManagement.delete')}
                          sx={{
                            color: alpha(theme.palette.text.secondary, 0.72),
                            borderRadius: '8px',
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
                </Box>
              );
            })}

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 1,
                color: 'text.secondary',
              }}
            >
              <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {t('positionManagement.lowest')}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '10px',
            overflow: 'hidden',
          },
        }}
      >
        <DialogTitle
          sx={{
            pt: 2.5,
            px: 3,
            pb: 0.5,
            fontSize: '1.0625rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}
        >
          {editingId != null ? t('positionManagement.edit') : t('positionManagement.add')}
        </DialogTitle>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ px: 3, pb: 1.5, fontSize: '0.75rem', lineHeight: 1.5 }}
        >
          {t('positionManagement.dialogHint')}
        </Typography>
        <DialogContent
          sx={{
            px: 3,
            pb: 1,
            overflow: 'visible',
            pt: '16px !important',
            ...POS_FORM_FIELD_SX,
          }}
        >
          <TextField
            autoFocus
            margin="dense"
            label={t('positionManagement.name')}
            placeholder={t('positionManagement.namePlaceholder')}
            fullWidth
            size="small"
            {...mvsOutlinedLabelProps}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            sx={{ mb: 2, mt: 0.5, overflow: 'visible' }}
          />
          <TextField
            margin="dense"
            type="number"
            label={t('positionManagement.sortOrder')}
            fullWidth
            size="small"
            {...mvsOutlinedLabelProps}
            value={form.sort_order}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              setForm((f) => ({ ...f, sort_order: Number.isFinite(n) ? n : 1 }));
            }}
            inputProps={{ min: 1, step: 1 }}
            helperText={t('positionManagement.sortOrderHint')}
            FormHelperTextProps={{ sx: { mx: 0, mt: 0.75, fontSize: '0.6875rem' } }}
            sx={{ mb: 1.5 }}
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
            }
            label={t('positionManagement.active')}
            sx={{
              ml: 0,
              '& .MuiFormControlLabel-label': { fontSize: '0.8125rem', fontWeight: 500 },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} sx={mvsBodyOutlinedBtnSx}>
            {t('positionManagement.cancel')}
          </Button>
          <Button
            variant="contained"
            disableElevation
            size="small"
            onClick={() => void handleSave()}
            disabled={(editingId != null && !canEdit) || (editingId == null && !canCreate)}
            sx={mvsBodyPrimaryBtnSx}
          >
            {t('positionManagement.save')}
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
      <DaeheungPageHeader title={t('positionManagement.title')} description={t('positionManagement.description')} />
      {content}
    </Box>
  );
};

const POSITION_MENU_ROUTES = ['/hr/users', '/hr/positions', '/hr'] as const;

const PositionManagement: React.FC = () => {
  const { user } = useStore();
  const { t } = useTranslation();
  const menuFlags = usePageMenuPermission(POSITION_MENU_ROUTES);
  return (
    <Box>
      {!menuFlags.menusLoading && !menuFlags.canRead && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {t('common.menuNoView')}
        </Alert>
      )}
      <PositionManagementPanel
        companyId={user?.company_id != null ? Number(user.company_id) : null}
        canCreate={menuFlags.canCreate}
        canEdit={menuFlags.canEdit}
        canDelete={menuFlags.canDelete}
      />
    </Box>
  );
};

export default PositionManagement;
