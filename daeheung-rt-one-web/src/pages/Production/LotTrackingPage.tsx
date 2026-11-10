import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { getMvsDialogActionsSx, getMvsDialogPaperSx } from '../../components/Common/daeheungDialogShell';
import { mvsPageRootSx } from '../../theme/daeheungLayout';
import { productionLotService } from '../../services/api';
import { showErrorPopup, showSuccessPopup } from '../../utils/errorHandler';

type ProductOption = { id: number; product_code?: string; name?: string; unit?: string };
type LotRow = {
  id: number;
  lot_no: string;
  lot_kind: 'material' | 'finished';
  status: string;
  quantity_on_hand: string | number;
  location?: string | null;
  produced_on?: string | null;
  notes?: string | null;
  product?: ProductOption | null;
};
type MovementRow = {
  id: number;
  movement_type: string;
  quantity: string | number;
  notes?: string | null;
  created_at?: string;
  createdAt?: string;
  relatedLot?: { id: number; lot_no: string } | null;
};

const cellSx = {
  border: '1px solid #B4B4B4',
  fontSize: '0.75rem',
  py: 0.4,
  px: 0.75,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: 220,
} as const;

const headSx = {
  ...cellSx,
  bgcolor: '#C6EFCE',
  fontWeight: 700,
};

const qtyOf = (value: string | number | undefined) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const whenOf = (row: MovementRow) => {
  const raw = row.created_at || row.createdAt;
  if (!raw) return '-';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return String(raw).replace('T', ' ').slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const LotTrackingPage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { dialogState, showConfirm, handleConfirm, handleCancel } = useConfirmDialog();
  const [lots, setLots] = useState<LotRow[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState<null | 'receive' | 'produce' | 'consume' | 'ship'>(null);
  const [createForm, setCreateForm] = useState({
    product_id: '',
    lot_kind: 'material',
    lot_no: '',
    location: '',
    produced_on: '',
    notes: '',
    initial_quantity: '',
  });
  const [moveForm, setMoveForm] = useState({ quantity: '', related_lot_id: '', notes: '' });

  const statusLabel = useCallback(
    (status: string) => {
      const key = {
        open: 'statusOpen',
        in_process: 'statusInProcess',
        hold: 'statusHold',
        released: 'statusReleased',
        shipped: 'statusShipped',
        scrapped: 'statusScrapped',
      }[status];
      return key ? t(`productionLots.${key}`) : status;
    },
    [t]
  );

  const moveLabel = useCallback(
    (type: string) => {
      const key = { receive: 'receive', produce: 'produce', consume: 'consume', ship: 'ship' }[type];
      return key ? t(`productionLots.${key}`) : type;
    },
    [t]
  );

  const loadLots = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await productionLotService.list();
      setLots(response?.data?.lots || []);
      setProducts(response?.data?.products || []);
    } catch (error: any) {
      const message = error?.response?.data?.message || t('productionLots.loading');
      setLoadError(message);
      showErrorPopup(message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadDetail = useCallback(async (id: number) => {
    try {
      const response = await productionLotService.detail(id);
      setMovements(response?.data?.movements || []);
      if (response?.data?.lot) {
        setLots((prev) => prev.map((row) => (row.id === id ? { ...row, ...response.data.lot } : row)));
      }
    } catch (error: any) {
      showErrorPopup(error?.response?.data?.message || t('productionLots.loading'));
    }
  }, [t]);

  useEffect(() => {
    void loadLots();
  }, [loadLots]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lots;
    return lots.filter((lot) =>
      [lot.lot_no, lot.product?.name, lot.product?.product_code, lot.location]
        .map((v) => String(v || '').toLowerCase())
        .join(' ')
        .includes(q)
    );
  }, [lots, search]);

  const selected = lots.find((lot) => lot.id === selectedId) || null;
  const finishedLots = lots.filter((lot) => lot.lot_kind === 'finished');

  const openCreate = () => {
    setCreateForm({
      product_id: products[0] ? String(products[0].id) : '',
      lot_kind: 'material',
      lot_no: '',
      location: '',
      produced_on: '',
      notes: '',
      initial_quantity: '',
    });
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const response = await productionLotService.create({
        product_id: Number(createForm.product_id),
        lot_kind: createForm.lot_kind,
        lot_no: createForm.lot_no.trim(),
        location: createForm.location.trim(),
        produced_on: createForm.produced_on || null,
        notes: createForm.notes.trim(),
        initial_quantity: createForm.initial_quantity === '' ? 0 : Number(createForm.initial_quantity),
      });
      setCreateOpen(false);
      showSuccessPopup(response?.message || t('productionLots.add'));
      await loadLots();
      if (response?.data?.id) {
        setSelectedId(response.data.id);
        await loadDetail(response.data.id);
      }
    } catch (error: any) {
      showErrorPopup(error?.response?.data?.message || t('productionLots.add'));
    } finally {
      setSaving(false);
    }
  };

  const openMove = (type: 'receive' | 'produce' | 'consume' | 'ship') => {
    setMoveForm({ quantity: '', related_lot_id: finishedLots[0] ? String(finishedLots[0].id) : '', notes: '' });
    setMoveOpen(type);
  };

  const submitMove = async () => {
    if (!selected || !moveOpen || saving) return;
    setSaving(true);
    try {
      const response = await productionLotService.move(selected.id, {
        movement_type: moveOpen,
        quantity: Number(moveForm.quantity),
        related_lot_id: moveOpen === 'consume' ? Number(moveForm.related_lot_id) : null,
        notes: moveForm.notes.trim(),
      });
      setMoveOpen(null);
      showSuccessPopup(response?.message || t(`productionLots.${moveOpen}`));
      await loadLots();
      await loadDetail(selected.id);
    } catch (error: any) {
      showErrorPopup(error?.response?.data?.message || t(`productionLots.${moveOpen}`));
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (lot: LotRow) => {
    showConfirm(t('productionLots.confirmDelete'), async () => {
      try {
        const response = await productionLotService.remove(lot.id);
        if (selectedId === lot.id) {
          setSelectedId(null);
          setMovements([]);
        }
        setLots((prev) => prev.filter((row) => row.id !== lot.id));
        showSuccessPopup(response?.message || t('productionLots.delete'));
      } catch (error: any) {
        showErrorPopup(error?.response?.data?.message || t('productionLots.delete'));
      }
    }, { title: t('productionLots.delete'), confirmColor: 'error' });
  };

  return (
    <Box sx={mvsPageRootSx}>
      <DaeheungPageHeader title={t('productionLots.pageTitle')} description={t('productionLots.description')} />
      <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
        <TextField
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('productionLots.search')}
          sx={{ width: 280, '& .MuiOutlinedInput-root': { borderRadius: '2px', height: 32 } }}
        />
        <Button variant="contained" onClick={openCreate} sx={{ borderRadius: '2px', textTransform: 'none', boxShadow: 'none' }}>
          {t('productionLots.add')}
        </Button>
      </Box>

      <TableContainer sx={{ border: '1px solid #B4B4B4', bgcolor: '#fff' }}>
        <Table size="small" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              {[
                t('productionLots.lotNo'),
                t('productionLots.kind'),
                t('productionLots.product'),
                t('productionLots.status'),
                t('productionLots.quantity'),
                t('productionLots.location'),
                t('productionLots.producedOn'),
                t('productionLots.actions'),
              ].map((label) => (
                <TableCell key={label} sx={headSx}>{label}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} sx={cellSx}>
                  {loading ? t('productionLots.loading') : loadError || t('productionLots.empty')}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((lot) => (
                <TableRow
                  key={lot.id}
                  hover
                  selected={lot.id === selectedId}
                  onClick={() => {
                    setSelectedId(lot.id);
                    void loadDetail(lot.id);
                  }}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell sx={cellSx}>{lot.lot_no}</TableCell>
                  <TableCell sx={cellSx}>{lot.lot_kind === 'finished' ? t('productionLots.finished') : t('productionLots.material')}</TableCell>
                  <TableCell sx={cellSx} title={lot.product?.name || ''}>{lot.product?.name || '-'}</TableCell>
                  <TableCell sx={cellSx}>{statusLabel(lot.status)}</TableCell>
                  <TableCell sx={{ ...cellSx, textAlign: 'right' }}>{qtyOf(lot.quantity_on_hand)}</TableCell>
                  <TableCell sx={cellSx}>{lot.location || '-'}</TableCell>
                  <TableCell sx={cellSx}>{lot.produced_on || '-'}</TableCell>
                  <TableCell sx={cellSx} onClick={(e) => e.stopPropagation()}>
                    {lot.lot_kind === 'material' ? (
                      <Button size="small" onClick={() => { setSelectedId(lot.id); openMove('receive'); }} sx={{ minWidth: 0, px: 0.5, textTransform: 'none' }}>{t('productionLots.receive')}</Button>
                    ) : null}
                    {lot.lot_kind === 'finished' ? (
                      <Button size="small" onClick={() => { setSelectedId(lot.id); openMove('produce'); }} sx={{ minWidth: 0, px: 0.5, textTransform: 'none' }}>{t('productionLots.produce')}</Button>
                    ) : null}
                    {lot.lot_kind === 'material' ? (
                      <Button size="small" onClick={() => { setSelectedId(lot.id); openMove('consume'); }} sx={{ minWidth: 0, px: 0.5, textTransform: 'none' }}>{t('productionLots.consume')}</Button>
                    ) : null}
                    {lot.lot_kind === 'finished' ? (
                      <Button size="small" onClick={() => { setSelectedId(lot.id); openMove('ship'); }} sx={{ minWidth: 0, px: 0.5, textTransform: 'none' }}>{t('productionLots.ship')}</Button>
                    ) : null}
                    {qtyOf(lot.quantity_on_hand) === 0 ? (
                      <Button size="small" color="error" onClick={() => askDelete(lot)} sx={{ minWidth: 0, px: 0.5, textTransform: 'none' }}>{t('productionLots.delete')}</Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {selected ? (
        <Box sx={{ mt: 2 }}>
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, mb: 0.5 }}>
            {selected.lot_no} · {t('productionLots.movements')}
          </Typography>
          <TableContainer sx={{ border: '1px solid #B4B4B4', bgcolor: '#fff' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {[t('productionLots.when'), t('productionLots.kind'), t('productionLots.quantity'), t('productionLots.relatedLot'), t('productionLots.notes')].map((label) => (
                    <TableCell key={label} sx={headSx}>{label}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {movements.length === 0 ? (
                  <TableRow><TableCell colSpan={5} sx={cellSx}>{t('productionLots.noMovements')}</TableCell></TableRow>
                ) : movements.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell sx={cellSx}>{whenOf(row)}</TableCell>
                    <TableCell sx={cellSx}>{moveLabel(row.movement_type)}</TableCell>
                    <TableCell sx={{ ...cellSx, textAlign: 'right' }}>{qtyOf(row.quantity)}</TableCell>
                    <TableCell sx={cellSx}>{row.relatedLot?.lot_no || '-'}</TableCell>
                    <TableCell sx={cellSx}>{row.notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ) : null}

      <Dialog open={createOpen} onClose={() => !saving && setCreateOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: getMvsDialogPaperSx(theme) }}>
        <DialogTitle>{t('productionLots.add')}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, pt: 1 }}>
          <TextField select size="small" label={t('productionLots.product')} value={createForm.product_id} onChange={(e) => setCreateForm((p) => ({ ...p, product_id: e.target.value }))}>
            {products.map((product) => (
              <MenuItem key={product.id} value={String(product.id)}>{product.product_code ? `${product.product_code} ` : ''}{product.name}</MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label={t('productionLots.kind')} value={createForm.lot_kind} onChange={(e) => setCreateForm((p) => ({ ...p, lot_kind: e.target.value }))}>
            <MenuItem value="material">{t('productionLots.material')}</MenuItem>
            <MenuItem value="finished">{t('productionLots.finished')}</MenuItem>
          </TextField>
          <TextField size="small" label={t('productionLots.lotNo')} value={createForm.lot_no} helperText={t('productionLots.lotNoOptional')} onChange={(e) => setCreateForm((p) => ({ ...p, lot_no: e.target.value }))} />
          <TextField size="small" label={t('productionLots.initialQty')} type="number" value={createForm.initial_quantity} onChange={(e) => setCreateForm((p) => ({ ...p, initial_quantity: e.target.value }))} />
          <TextField size="small" label={t('productionLots.location')} value={createForm.location} onChange={(e) => setCreateForm((p) => ({ ...p, location: e.target.value }))} />
          <TextField size="small" label={t('productionLots.producedOn')} type="date" value={createForm.produced_on} InputLabelProps={{ shrink: true }} onChange={(e) => setCreateForm((p) => ({ ...p, produced_on: e.target.value }))} />
          <TextField size="small" label={t('productionLots.notes')} value={createForm.notes} onChange={(e) => setCreateForm((p) => ({ ...p, notes: e.target.value }))} />
        </DialogContent>
        <DialogActions sx={getMvsDialogActionsSx(theme)}>
          <Button onClick={() => setCreateOpen(false)} disabled={saving}>{t('productionLots.cancel')}</Button>
          <Button variant="contained" onClick={() => void submitCreate()} disabled={saving || !createForm.product_id}>{t('productionLots.save')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(moveOpen)} onClose={() => !saving && setMoveOpen(null)} maxWidth="xs" fullWidth PaperProps={{ sx: getMvsDialogPaperSx(theme) }}>
        <DialogTitle>{moveOpen ? t(`productionLots.${moveOpen}`) : ''}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, pt: 1 }}>
          <TextField size="small" label={t('productionLots.quantity')} type="number" value={moveForm.quantity} onChange={(e) => setMoveForm((p) => ({ ...p, quantity: e.target.value }))} />
          {moveOpen === 'consume' ? (
            <TextField select size="small" label={t('productionLots.selectFinished')} value={moveForm.related_lot_id} onChange={(e) => setMoveForm((p) => ({ ...p, related_lot_id: e.target.value }))}>
              {finishedLots.map((lot) => (
                <MenuItem key={lot.id} value={String(lot.id)}>{lot.lot_no}</MenuItem>
              ))}
            </TextField>
          ) : null}
          <TextField size="small" label={t('productionLots.notes')} value={moveForm.notes} onChange={(e) => setMoveForm((p) => ({ ...p, notes: e.target.value }))} />
        </DialogContent>
        <DialogActions sx={getMvsDialogActionsSx(theme)}>
          <Button onClick={() => setMoveOpen(null)} disabled={saving}>{t('productionLots.cancel')}</Button>
          <Button variant="contained" onClick={() => void submitMove()} disabled={saving || !moveForm.quantity}>{t('productionLots.save')}</Button>
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

export default LotTrackingPage;
