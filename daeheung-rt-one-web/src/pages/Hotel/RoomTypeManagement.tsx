import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  Typography,
  Button,
  TextField,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  MenuItem,
  InputAdornment,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { roomTypeService } from '../../services/api';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import {
  mvsPageRootSx,
  mvsBodyCardSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPrimaryBtnSx,
  mvsBodyListZoneSx,
  mvsBodyListTableSx,
  mvsBodyFilterWrapSx,
  mvsSearchFieldSx,
  mvsFilterFieldHeightSx,
  mvsOutlinedLabelProps,
  mvsTableScrollSx,
  mvsTableHeadHighlightSx,
  mvsTableBodyRowSx,
} from '../../theme/daeheungLayout';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';

type RoomType = {
  id: number;
  name: string;
  count: number;
  nightlyRate: number;
  description: string;
  isActive: boolean;
  createdAt: string;
};

const roomTypeFilterFieldSx = {
  ...(mvsSearchFieldSx as Record<string, unknown>),
  ...mvsFilterFieldHeightSx,
} as const;

const listStateBoxSx = {
  ...mvsBodyListTableSx,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  py: 6,
  px: 2,
} as const;

const roomTypeTableSx = {
  width: '100%',
  tableLayout: 'fixed' as const,
  minWidth: { xs: 640, sm: 800 },
  borderCollapse: 'collapse',
  bgcolor: 'transparent',
  '& .MuiTableCell-root': {
    borderLeft: 'none',
    borderRight: 'none',
    borderTop: 'none',
  },
} as const;

const roomTypeCellBaseSx = {
  fontSize: { xs: '0.75rem', sm: '0.8125rem' },
  py: 0.75,
  px: { xs: 0.5, sm: 1 },
  verticalAlign: 'middle' as const,
} as const;

const roomTypeCellEllipsisSx = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: 0,
} as const;

const chipSx = { fontWeight: 500, borderRadius: '8px' } as const;

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

const RoomTypeManagement: React.FC = () => {
  const { t } = useTranslation();
  const { dialogState, showConfirm, handleConfirm, handleCancel } = useConfirmDialog();
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingRoomType, setEditingRoomType] = useState<RoomType | null>(null);
  const [formState, setFormState] = useState({
    name: '',
    count: '',
    nightlyRate: '',
    description: '',
    isActive: true
  });

  const loadRoomTypes = async () => {
    try {
      const response = await roomTypeService.getRoomTypes();
      if (response.success) {
        const mapped = (response.data || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          count: Number(item.room_count || 0),
          nightlyRate: Number(item.nightly_rate || 0),
          description: item.description || '',
          isActive: Boolean(item.is_active),
          createdAt: item.created_at || new Date().toISOString(),
        }));
        setRoomTypes(mapped);
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    loadRoomTypes();
  }, []);

  const filteredRoomTypes = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return roomTypes.filter((roomType) => {
      const matchesSearch =
        !keyword ||
        roomType.name.toLowerCase().includes(keyword) ||
        roomType.description.toLowerCase().includes(keyword);
      const matchesStatus =
        !statusFilter ||
        (statusFilter === 'active' ? roomType.isActive : !roomType.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [roomTypes, searchTerm, statusFilter]);

  const handleOpenCreate = () => {
    setEditingRoomType(null);
    setFormState({
      name: '',
      count: '',
      nightlyRate: '',
      description: '',
      isActive: true
    });
    setOpenDialog(true);
  };

  const handleEdit = (roomType: RoomType) => {
    setEditingRoomType(roomType);
    setFormState({
      name: roomType.name,
      count: String(roomType.count),
      nightlyRate: String(roomType.nightlyRate),
      description: roomType.description,
      isActive: roomType.isActive
    });
    setOpenDialog(true);
  };

  const handleSave = () => {
    const saveRoomType = async () => {
      const name = formState.name.trim();
      const count = Number(formState.count);
      const nightlyRate = Number(formState.nightlyRate);

      if (!name || Number.isNaN(count) || Number.isNaN(nightlyRate)) {
        return;
      }

      if (editingRoomType) {
        const response = await roomTypeService.updateRoomType(editingRoomType.id, {
          name,
          room_count: count,
          nightly_rate: nightlyRate,
          description: formState.description.trim(),
          is_active: formState.isActive,
        });
        if (response.success) {
          await loadRoomTypes();
        }
      } else {
        const response = await roomTypeService.createRoomType({
          name,
          room_count: count,
          nightly_rate: nightlyRate,
          description: formState.description.trim(),
          is_active: formState.isActive,
        });
        if (response.success) {
          await loadRoomTypes();
        }
      }

      setOpenDialog(false);
    };

    const name = formState.name.trim();
    const count = Number(formState.count);
    const nightlyRate = Number(formState.nightlyRate);

    if (!name || Number.isNaN(count) || Number.isNaN(nightlyRate)) {
      return;
    }

    void saveRoomType();
  };

  const handleDelete = (roomTypeId: number) => {
    showConfirm(
      t('roomTypeManagement.confirmDelete'),
      () => {
        void (async () => {
          try {
            const response = await roomTypeService.deleteRoomType(roomTypeId);
            if (response.success) {
              await loadRoomTypes();
            }
          } catch {
      /* ignore */
    }
        })();
      },
      {
        title: t('common.confirm'),
        confirmColor: 'error',
        confirmText: t('common.delete'),
        cancelText: t('common.cancel')
      }
    );
  };

  return (
    <Box sx={{ ...mvsPageRootSx }}>
      <DaeheungPageHeader
        title={t('roomTypeManagement.title')}
        actions={
          <Button
            variant="contained"
            disableElevation
            startIcon={<AddIcon />}
            onClick={handleOpenCreate}
            sx={mvsBodyPrimaryBtnSx}
          >
            {t('roomTypeManagement.actions.register')}
          </Button>
        }
      />

      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 3 }}>
        <Box sx={mvsBodyFilterWrapSx}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 2fr) minmax(0, 1fr) auto' },
              gap: 2,
              alignItems: 'flex-end',
              ...(mvsSearchFieldSx as Record<string, unknown>),
            }}
          >
            <TextField
              fullWidth
              size="small"
              label={t('roomTypeManagement.filters.search')}
              placeholder={t('roomTypeManagement.placeholders.search')}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              sx={roomTypeFilterFieldSx}
              {...mvsOutlinedLabelProps}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              size="small"
              select
              label={t('roomTypeManagement.filters.status')}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              sx={roomTypeFilterFieldSx}
              {...mvsOutlinedLabelProps}
              SelectProps={{
                displayEmpty: true,
                renderValue: (selected) =>
                  selected === 'active'
                    ? t('roomTypeManagement.status.active')
                    : selected === 'inactive'
                      ? t('roomTypeManagement.status.inactive')
                      : t('roomTypeManagement.filters.statusAll'),
              }}
            >
              <MenuItem value="">{t('roomTypeManagement.filters.statusAll')}</MenuItem>
              <MenuItem value="active">{t('roomTypeManagement.status.active')}</MenuItem>
              <MenuItem value="inactive">{t('roomTypeManagement.status.inactive')}</MenuItem>
            </TextField>
            <Button
              variant="outlined"
              startIcon={<FilterIcon />}
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('');
              }}
              sx={{
                ...mvsBodyOutlinedBtnSx,
                height: 40,
                whiteSpace: 'nowrap',
                width: { xs: '100%', sm: 'auto' },
                minWidth: { sm: 120 },
              }}
            >
              {t('roomTypeManagement.actions.reset')}
            </Button>
          </Box>
        </Box>
      </Card>

      <Box sx={mvsBodyListZoneSx}>
        {filteredRoomTypes.length === 0 ? (
          <Box sx={listStateBoxSx}>
            <Typography variant="body2" color="text.secondary">
              {t('roomTypeManagement.empty.noData')}
            </Typography>
          </Box>
        ) : (
          <TableContainer sx={{ ...mvsBodyListTableSx, ...mvsTableScrollSx }}>
            <Table size="small" sx={roomTypeTableSx}>
              <TableHead sx={mvsTableHeadHighlightSx}>
                <TableRow>
                  {[
                    { label: t('roomTypeManagement.columns.roomType'), width: '16%', ellipsis: true },
                    { label: t('roomTypeManagement.columns.roomCount'), width: '10%' },
                    { label: t('roomTypeManagement.columns.nightlyRate'), width: '14%' },
                    { label: t('roomTypeManagement.columns.description'), width: '34%', ellipsis: true },
                    { label: t('roomTypeManagement.columns.status'), width: '12%' },
                    { label: t('roomTypeManagement.columns.actions'), width: '14%' },
                  ].map((col, index) => (
                    <TableCell
                      key={col.label}
                      align={index === 5 ? 'center' : 'left'}
                      width={col.width}
                      sx={{
                        whiteSpace: 'nowrap',
                        verticalAlign: 'middle',
                        ...(col.ellipsis ? roomTypeCellEllipsisSx : {}),
                      }}
                    >
                      {col.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody sx={mvsTableBodyRowSx}>
                {filteredRoomTypes.map((roomType) => (
                  <TableRow key={roomType.id} hover>
                    <TableCell sx={{ ...roomTypeCellBaseSx, ...roomTypeCellEllipsisSx }}>
                      {renderEllipsisText(roomType.name)}
                    </TableCell>
                    <TableCell sx={{ ...roomTypeCellBaseSx, whiteSpace: 'nowrap' }}>
                      {roomType.count}
                    </TableCell>
                    <TableCell sx={{ ...roomTypeCellBaseSx, whiteSpace: 'nowrap' }}>
                      Rs. {roomType.nightlyRate.toLocaleString()}
                    </TableCell>
                    <TableCell sx={{ ...roomTypeCellBaseSx, ...roomTypeCellEllipsisSx }}>
                      {roomType.description ? renderEllipsisText(roomType.description) : '-'}
                    </TableCell>
                    <TableCell sx={roomTypeCellBaseSx}>
                      <Chip
                        label={
                          roomType.isActive
                            ? t('roomTypeManagement.status.active')
                            : t('roomTypeManagement.status.inactive')
                        }
                        color={roomType.isActive ? 'success' : 'default'}
                        size="small"
                        variant="outlined"
                        sx={chipSx}
                      />
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{ ...roomTypeCellBaseSx, whiteSpace: 'nowrap' }}
                    >
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                        <Tooltip title={t('common.edit')}>
                          <IconButton
                            size="small"
                            onClick={() => handleEdit(roomType)}
                            sx={{ borderRadius: '10px' }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('common.delete')}>
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(roomType.id)}
                            sx={{ borderRadius: '10px' }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingRoomType ? t('roomTypeManagement.dialog.editTitle') : t('roomTypeManagement.dialog.registerTitle')}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 1 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mb: 0.5 }}>
                {t('roomTypeManagement.fields.roomTypeName')}
                <Box component="span" sx={{ color: 'error.main', ml: 0.5 }}>*</Box>
              </Typography>
              <TextField
                value={formState.name}
                onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                required
                size="small"
                fullWidth
                placeholder={t('roomTypeManagement.placeholders.roomTypeName')}
                sx={mvsSearchFieldSx}
              />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mb: 0.5 }}>
                {t('roomTypeManagement.fields.roomCount')}
                <Box component="span" sx={{ color: 'error.main', ml: 0.5 }}>*</Box>
              </Typography>
              <TextField
                value={formState.count}
                onChange={(event) => setFormState((prev) => ({ ...prev, count: event.target.value }))}
                type="number"
                inputProps={{ min: 0 }}
                required
                size="small"
                fullWidth
                placeholder={t('roomTypeManagement.placeholders.roomCount')}
                sx={mvsSearchFieldSx}
              />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mb: 0.5 }}>
                {t('roomTypeManagement.fields.nightlyRate')}
                <Box component="span" sx={{ color: 'error.main', ml: 0.5 }}>*</Box>
              </Typography>
              <TextField
                value={formState.nightlyRate}
                onChange={(event) => setFormState((prev) => ({ ...prev, nightlyRate: event.target.value }))}
                type="number"
                inputProps={{ min: 0 }}
                required
                size="small"
                fullWidth
                placeholder={t('roomTypeManagement.placeholders.nightlyRate')}
                sx={mvsSearchFieldSx}
              />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mb: 0.5 }}>
                {t('roomTypeManagement.fields.status')}
              </Typography>
              <TextField
                select
                size="small"
                fullWidth
                value={formState.isActive ? 'active' : 'inactive'}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, isActive: event.target.value === 'active' }))
                }
                sx={mvsSearchFieldSx}
              >
                <MenuItem value="active">{t('roomTypeManagement.status.active')}</MenuItem>
                <MenuItem value="inactive">{t('roomTypeManagement.status.inactive')}</MenuItem>
              </TextField>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mb: 0.5 }}>
                {t('roomTypeManagement.fields.description')}
              </Typography>
              <TextField
                value={formState.description}
                onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                multiline
                minRows={3}
                size="small"
                fullWidth
                placeholder={t('roomTypeManagement.placeholders.description')}
                sx={mvsSearchFieldSx}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" disableElevation onClick={handleSave} sx={mvsBodyPrimaryBtnSx}>
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
    </Box>
  );
};

export default RoomTypeManagement;
