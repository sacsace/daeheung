import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Snackbar,
  TextField,
  Typography,
  Alert,
  Divider,
  Stack,
  CircularProgress,
  Tooltip
} from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import {
  mvsPageRootSx,
  mvsBodyCardSx,
  mvsBodyPrimaryBtnSx,
  mvsSearchFieldSx,
  mvsInnerCardSx } from '../../theme/daeheungLayout';
import { useTranslation } from 'react-i18next';
import { alpha, useTheme } from '@mui/material/styles';
import { inventoryService } from '../../services/api';
import { useMenuStore } from '../../store';
import { useMenuRoutePermissionFlags } from '../../hooks/useMenuRoutePermissionFlags';
import { resolveMediaUrl } from '../../utils/uploadUrl';

const STOCK_OUT_MENU_ROUTES = ['/inventory/stock-out', '/inventory'] as const;

type ProductPreview = {
  id: number;
  name?: string;
  product_code?: string;
  category?: string;
  unit?: string;
  stock_quantity?: number;
  min_stock_level?: number;
  location?: string;
  unit_price?: number;
  status?: string;
  image_url?: string;
};

const resolveProductImageUrl = resolveMediaUrl;

type ResolveStockOutProduct =
  | { product: ProductPreview | null; ambiguous: false; candidates: ProductPreview[] }
  | { product: null; ambiguous: true; candidates: ProductPreview[] };

/**
 * 바코드/품목코드(정확 일치) 우선, 그다음 제품명 정확 일치, 검색 결과 1건이면 확정.
 * 여러 건이면 ambiguous — 품목코드로 좁혀야 함.
 */
async function resolveProductForStockOut(query: string): Promise<ResolveStockOutProduct> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { product: null, ambiguous: false, candidates: [] };
  }
  const res = await inventoryService.getProducts({ search: trimmed, limit: 100, page: 1 });
  const rows = ((res as any)?.data ?? []) as ProductPreview[];
  const upper = trimmed.toUpperCase();

  const exactCode = rows.find((p) => (p.product_code || '').trim().toUpperCase() === upper);
  if (exactCode) {
    return { product: exactCode, ambiguous: false, candidates: [] };
  }

  const exactName = rows.find(
    (p) => (p.name || '').trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (exactName) {
    return { product: exactName, ambiguous: false, candidates: [] };
  }

  if (rows.length === 1) {
    return { product: rows[0], ambiguous: false, candidates: [] };
  }

  if (rows.length > 1) {
    return { product: null, ambiguous: true, candidates: rows };
  }

  return { product: null, ambiguous: false, candidates: [] };
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline', flexWrap: 'wrap' }}>
      <Typography component="span" variant="caption" color="text.secondary" sx={{ minWidth: 76, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography component="span" variant="body2" sx={{ wordBreak: 'break-word' }}>
        {value}
      </Typography>
    </Box>
  );
}

/** 재고 출고 — 바코드·품목코드·제품명으로 품목 특정 후 수량 출고 */
const StockOutBarcode: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { language } = useMenuStore();
  const perm = useMenuRoutePermissionFlags(STOCK_OUT_MENU_ROUTES);
  const txt = useCallback((ko: string, en: string) => (language === 'en' ? en : ko), [language]);
  const barcodeRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [releaseReason, setReleaseReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewProduct, setPreviewProduct] = useState<ProductPreview | null>(null);
  const [previewAmbiguous, setPreviewAmbiguous] = useState(false);
  const [previewCandidates, setPreviewCandidates] = useState<ProductPreview[]>([]);
  const [previewLookupDone, setPreviewLookupDone] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; ok: boolean }>({
    open: false,
    msg: '',
    ok: true
  });

  useEffect(() => {
    const code = barcode.trim();
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (!perm.canMutate) {
      setPreviewProduct(null);
      setPreviewAmbiguous(false);
      setPreviewCandidates([]);
      setPreviewLookupDone(false);
      setPreviewLoading(false);
      return;
    }
    if (!code) {
      setPreviewProduct(null);
      setPreviewAmbiguous(false);
      setPreviewCandidates([]);
      setPreviewLookupDone(false);
      setPreviewLoading(false);
      return;
    }
    setPreviewProduct(null);
    setPreviewAmbiguous(false);
    setPreviewCandidates([]);
    setPreviewLookupDone(false);
    setPreviewLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await resolveProductForStockOut(code);
        setPreviewProduct(r.product);
        setPreviewAmbiguous(r.ambiguous);
        setPreviewCandidates(r.candidates);
      } catch {
        setPreviewProduct(null);
        setPreviewAmbiguous(false);
        setPreviewCandidates([]);
      } finally {
        setPreviewLoading(false);
        setPreviewLookupDone(true);
        debounceRef.current = null;
      }
    }, 320);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [barcode, perm.canMutate]);

  const submit = useCallback(async () => {
    if (!perm.canMutate) {
      setSnack({ open: true, msg: t('common.menuNoMutate'), ok: false });
      return;
    }
    const code = barcode.trim();
    if (!code || quantity < 1) {
      setSnack({
        open: true,
        msg: txt('품목과 수량을 확인하세요.', 'Check product and quantity.'),
        ok: false
      });
      return;
    }
    setLoading(true);
    try {
      const r = await resolveProductForStockOut(code);
      if (r.ambiguous) {
        setSnack({
          open: true,
          msg: txt(
            '검색 결과가 여러 개입니다. 품목코드(바코드)로 입력하거나 제품명을 정확히 맞춰 주세요.',
            'Multiple matches. Enter the item code (barcode) or type the exact product name.'
          ),
          ok: false
        });
        return;
      }
      const product = r.product;
      if (!product?.id) {
        setSnack({
          open: true,
          msg: txt('등록된 품목을 찾을 수 없습니다.', 'No matching registered product.'),
          ok: false
        });
        return;
      }
      const reasonTrim = releaseReason.trim();
      const notes = reasonTrim
        ? language === 'en'
          ? `Stock out (barcode) · Reason: ${reasonTrim}`
          : `출고(바코드) · 출고 이유: ${reasonTrim}`
        : txt('출고(바코드)', 'Stock out (barcode)');
      await inventoryService.stockOut({
        product_id: product.id,
        quantity,
        notes
      });
      setSnack({
        open: true,
        msg:
          language === 'en'
            ? `Shipped · ${product.name} (−${quantity})`
            : `출고 완료 · ${product.name} (−${quantity})`,
        ok: true
      });
      setBarcode('');
      setQuantity(1);
      setReleaseReason('');
      setPreviewProduct(null);
      setPreviewAmbiguous(false);
      setPreviewCandidates([]);
      setPreviewLookupDone(false);
      barcodeRef.current?.focus();
    } catch (e: any) {
      setSnack({
        open: true,
        msg: e?.response?.data?.message || txt('출고 처리에 실패했습니다.', 'Stock-out failed.'),
        ok: false
      });
    } finally {
      setLoading(false);
    }
  }, [barcode, quantity, releaseReason, txt, language, perm.canMutate, t]);

  const fieldLabelSx = {
    mb: 1,
    fontSize: '0.875rem',
    fontWeight: 600,
    letterSpacing: '-0.015em',
    color: 'text.primary',
    lineHeight: 1.35,
    display: 'block' } as const;

  const appleInputSx = {
    ...(mvsSearchFieldSx as Record<string, unknown>),
    '& .MuiOutlinedInput-root': {
      borderRadius: '8px',
      bgcolor: alpha(theme.palette.grey[500], theme.palette.mode === 'dark' ? 0.1 : 0.05),
      minHeight: 48,
      transition: theme.transitions.create(['background-color', 'box-shadow', 'border-color'], { duration: 180 }),
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: '#CBD5E1' },
      '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: '#94A3B8' },
      '& fieldset': {
        borderColor: '#CBD5E1' },
      '&:hover fieldset': {
        borderColor: '#94A3B8' },
      '&:hover': {
        bgcolor: alpha(theme.palette.grey[500], theme.palette.mode === 'dark' ? 0.14 : 0.08) },
      '&.Mui-focused': {
        bgcolor: 'background.paper',
        boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.18)}`,
        '& fieldset': {
          borderColor: alpha(theme.palette.divider, 0.95),
          borderWidth: 1 } },
      '&.Mui-disabled': {
        bgcolor: alpha(theme.palette.grey[500], theme.palette.mode === 'dark' ? 0.06 : 0.04) } },
    '& .MuiOutlinedInput-input': {
      py: 1.35,
      fontSize: '0.9375rem',
      letterSpacing: '-0.02em' },
    '& .MuiOutlinedInput-input::placeholder': {
      color: alpha(theme.palette.text.secondary, 0.85),
      opacity: 1 },
    '& .MuiFormHelperText-root': {
      mt: 1.25,
      mx: 0,
      px: 0.25,
      letterSpacing: '-0.01em',
      fontSize: '0.75rem',
      lineHeight: 1.5,
      color: alpha(theme.palette.text.secondary, 0.95) } };

  return (
    <Box sx={mvsPageRootSx}>
      <DaeheungPageHeader
        title={txt('출고 관리', 'Outbound management')}
        description={txt(
          '재고(제품) 관리에서 등록된 품목만 출고할 수 있습니다. 바코드·품목코드·제품명으로 검색한 뒤 수량을 입력해 출고합니다.',
          'Only products registered in inventory can be shipped out. Find the item by barcode, item code, or name, then enter the quantity.'
        )}
      />

      <Card elevation={0} sx={mvsBodyCardSx}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, px: { xs: 2, sm: 2.5 }, py: 2.5 }}>
          <Stack spacing={2.5}>
            <Box>
              <Typography component="label" sx={fieldLabelSx}>
                {txt('바코드 / 품목코드 / 제품명', 'Barcode / item code / product name')}
              </Typography>
              <TextField
                disabled={perm.menusLoading || !perm.canMutate}
                inputRef={barcodeRef}
                hiddenLabel
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.preventDefault();
                }}
                autoFocus
                fullWidth
                size="medium"
                placeholder={txt(
                  '바코드 스캔 또는 품목코드·제품명 입력',
                  'Scan barcode or enter item code / product name'
                )}
                helperText={txt(
                  '등록된 품목만 조회됩니다. 입력하면 아래에서 품목 정보를 확인할 수 있습니다.',
                  'Only registered products are shown. Item details appear below as you type.'
                )}
                FormHelperTextProps={{ sx: { mx: 0 } }}
                sx={appleInputSx}
              />
            </Box>

            <Box sx={{ maxWidth: { xs: '100%', sm: 280 } }}>
              <Typography component="label" sx={fieldLabelSx}>
                {txt('수량', 'Quantity')}
              </Typography>
              <TextField
                hiddenLabel
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                inputProps={{ min: 1 }}
                fullWidth
                size="medium"
                disabled={perm.menusLoading || !perm.canMutate}
                placeholder="1"
                helperText={txt('출고할 수량을 입력하세요.', 'Enter the quantity to ship out.')}
                FormHelperTextProps={{ sx: { mx: 0 } }}
                sx={appleInputSx}
              />
            </Box>

            <Box>
              <Typography component="label" sx={fieldLabelSx}>
                {txt('출고 이유', 'Reason (optional)')}
              </Typography>
              <TextField
                hiddenLabel
                value={releaseReason}
                onChange={(e) => setReleaseReason(e.target.value)}
                disabled={perm.menusLoading || !perm.canMutate}
                placeholder={txt('선택 입력 (예: 샘플 제공, 현장 반출)', 'Optional (e.g. sample, field use)')}
                fullWidth
                size="medium"
                multiline
                minRows={2}
                maxRows={5}
                inputProps={{ maxLength: 2000 }}
                helperText={txt(
                  '입력 시 재고 거래 내역 비고에 함께 저장됩니다.',
                  'If set, it is saved with the inventory transaction notes.'
                )}
                FormHelperTextProps={{ sx: { mx: 0 } }}
                sx={appleInputSx}
              />
            </Box>

            <Divider sx={{ my: 0.25 }} />

            <Box>
              <Typography component="label" sx={fieldLabelSx}>
                {txt('출고 전 확인 (읽기 전용)', 'Review before release (read-only)')}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 1, letterSpacing: '-0.01em', lineHeight: 1.45 }}
              >
                {txt(
                  '바코드·품목코드·제품명을 입력하면 여기에 품목 정보가 표시됩니다.',
                  'Enter a barcode, item code, or product name to see details here.'
                )}
              </Typography>
              <Box
                sx={{
                  ...mvsInnerCardSx,
                  minHeight: 120,
                  p: 1.5 }}
              >
            {previewLoading && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={28} />
              </Box>
            )}
            {!previewLoading && previewAmbiguous && previewCandidates.length > 0 && (
              <Stack spacing={1} sx={{ py: 1 }}>
                <Typography variant="body2" color="warning.main" sx={{ fontWeight: 600 }}>
                  {txt(
                    '검색 결과가 여러 개입니다. 품목코드(바코드)를 입력하거나, 제품명을 정확히 일치시켜 주세요.',
                    'Multiple matches. Enter the item code (barcode) or use the exact product name.'
                  )}
                </Typography>
                <Stack spacing={0.5}>
                  {previewCandidates.slice(0, 12).map((c) => (
                    <Typography key={c.id} variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      · {c.name || '—'} <Typography component="span" variant="caption" color="text.disabled">({c.product_code || '—'})</Typography>
                    </Typography>
                  ))}
                  {previewCandidates.length > 12 ? (
                    <Typography variant="caption" color="text.disabled">
                      {language === 'en'
                        ? `+${previewCandidates.length - 12} more…`
                        : `외 ${previewCandidates.length - 12}건…`}
                    </Typography>
                  ) : null}
                </Stack>
              </Stack>
            )}
            {!previewLoading && previewProduct && (
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                alignItems="flex-start"
                sx={{ width: '100%' }}
              >
                {previewProduct.image_url ? (
                  <Box
                    sx={{
                      ...mvsInnerCardSx,
                      width: { xs: '100%', sm: 240 },
                      maxWidth: 336,
                      flexShrink: 0,
                      alignSelf: { xs: 'stretch', sm: 'flex-start' },
                      p: 0,
                      overflow: 'hidden',
                      aspectRatio: '1',
                      maxHeight: 312 }}
                  >
                    <Box
                      component="img"
                      src={resolveProductImageUrl(previewProduct.image_url)}
                      alt=""
                      sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </Box>
                ) : null}
                <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    {previewProduct.name || '—'}
                  </Typography>
                  <DetailRow label={txt('품목코드', 'Item code')} value={previewProduct.product_code || '—'} />
                  <DetailRow label={txt('카테고리', 'Category')} value={previewProduct.category || '—'} />
                  <DetailRow label={txt('단위', 'Unit')} value={previewProduct.unit || '—'} />
                  <DetailRow
                    label={txt('현재고', 'On hand')}
                    value={
                      typeof previewProduct.stock_quantity === 'number'
                        ? String(previewProduct.stock_quantity)
                        : String(previewProduct.stock_quantity ?? '—')
                    }
                  />
                  {previewProduct.location ? (
                    <DetailRow label={txt('위치', 'Location')} value={previewProduct.location} />
                  ) : null}
                  {previewProduct.min_stock_level != null && previewProduct.min_stock_level > 0 ? (
                    <DetailRow label={txt('최소 재고', 'Min stock')} value={String(previewProduct.min_stock_level)} />
                  ) : null}
                  {previewProduct.unit_price != null ? (
                    <DetailRow
                      label={txt('단가', 'Unit price')}
                      value={Number(previewProduct.unit_price).toLocaleString()}
                    />
                  ) : null}
                  {previewProduct.status ? (
                    <DetailRow label={txt('상태', 'Status')} value={previewProduct.status} />
                  ) : null}
                </Stack>
              </Stack>
            )}
            {!previewLoading &&
              !previewProduct &&
              !previewAmbiguous &&
              barcode.trim() &&
              previewLookupDone && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                {txt(
                  '일치하는 등록 품목이 없습니다. 품목코드·제품명을 확인하세요.',
                  'No matching product. Check the code or name.'
                )}
              </Typography>
            )}
            {!previewLoading && !previewProduct && !previewAmbiguous && !barcode.trim() && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                {txt('품목을 검색해 주세요.', 'Search for a product.')}
              </Typography>
            )}
              </Box>
            </Box>

            <Tooltip title={t('common.menuNoMutate')} disableHoverListener={perm.menusLoading || perm.canMutate}>
            <span style={{ display: 'block' }}>
              <Button
                variant="contained"
                disableElevation
                size="large"
                disabled={
                  loading ||
                  previewLoading ||
                  perm.menusLoading ||
                  !perm.canMutate ||
                  previewAmbiguous ||
                  (barcode.trim().length > 0 && !previewProduct && previewLookupDone)
                }
                onClick={submit}
                fullWidth
                sx={{
                  ...mvsBodyPrimaryBtnSx,
                  py: 1.35,
                  minHeight: 48,
                  fontSize: '0.95rem' }}
              >
                {txt('출고', 'Ship out')}
              </Button>
            </span>
          </Tooltip>
          </Stack>
        </CardContent>
      </Card>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.ok ? 'success' : 'error'} variant="filled" sx={{ width: '100%' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default StockOutBarcode;
